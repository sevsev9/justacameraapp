import {
  computed,
  inject,
  provide,
  ref,
  shallowRef,
  watch,
  onScopeDispose,
  type ComputedRef,
  type InjectionKey,
  type Ref,
} from 'vue'
import type {
  AdvancedControlDescriptor,
  AdvancedControlId,
  AudioTrackSnapshot,
  CameraPreferences,
  CaptureStatus,
  CapturedPhoto,
  DeviceList,
  RecordingMimeChoice,
  RecordingResult,
  SessionStatus,
  VideoTrackSnapshot,
} from '@/types/media'
import { CameraController } from '@/services/camera-controller'
import { DeviceService, devicesChanged } from '@/services/device-service'
import { RecordingService } from '@/services/recording-service'
import { PhotoCaptureService } from '@/services/photo-capture-service'
import { exportService, type SaveOutcome } from '@/services/export-service'
import { diagnosticsService, type DiagnosticsReport } from '@/services/diagnostics-service'
import {
  buildGumConstraints,
  relaxVideoConstraints,
  relaxAudioConstraints,
} from '@/utils/constraints'
import { normalizeMediaError, insecureContextError, unsupportedError } from '@/utils/errors'
import { readCapabilities, readSettings, buildAdvancedControls } from '@/utils/capabilities'
import {
  selectRecordingMimeType,
  listSupportedMimeTypes,
  extensionForMimeType,
} from '@/utils/mime-support'
import { buildFilename, extensionForPhotoFormat } from '@/utils/filename'
import { estimateRecordingBytes, LONG_RECORDING_WARNING_MS } from '@/utils/format-bytes'
import {
  initialSessionStatus,
  sessionStatusForError,
  isSessionActive,
  canStart,
  canStop,
  canSwitchDevice,
} from '@/features/camera/session-machine'
import {
  initialCaptureStatus,
  beginCountdown,
  tickCountdown,
  beginRecording,
  pauseRecording as pauseRec,
  resumeRecording as resumeRec,
  beginFinalize,
  endRecording,
  canCapturePhoto,
  canStartRecording,
  canPauseRecording,
  canResumeRecording,
  canStopRecording,
} from '@/features/camera/capture-machine'
import { useObjectUrl } from './useObjectUrl'
import { useAnnouncer } from './useAnnouncer'
import { usePreferences } from './usePreferences'
import { usePermissions } from './usePermissions'

export interface CameraSession {
  // state
  session: Ref<SessionStatus>
  capture: Ref<CaptureStatus>
  devices: Ref<DeviceList>
  preferences: CameraPreferences
  selectedCameraId: Ref<string | null>
  selectedMicId: Ref<string | null>
  videoSettings: Ref<VideoTrackSnapshot | null>
  audioSettings: Ref<AudioTrackSnapshot | null>
  advancedControls: Ref<AdvancedControlDescriptor[]>
  recordingFormat: Ref<RecordingMimeChoice | null>
  supportedFormats: Ref<RecordingMimeChoice[]>
  elapsedMs: Ref<number>
  pendingPhoto: Ref<CapturedPhoto | null>
  photoUrl: Ref<string | null>
  pendingRecording: Ref<RecordingResult | null>
  recordingUrl: Ref<string | null>
  videoEl: Ref<HTMLVideoElement | null>
  saveOutcome: Ref<SaveOutcome | null>
  audioFellBack: Ref<boolean>
  // derived
  isActive: ComputedRef<boolean>
  isPreviewing: ComputedRef<boolean>
  isRecording: ComputedRef<boolean>
  isPaused: ComputedRef<boolean>
  hasAudioTrack: ComputedRef<boolean>
  estimatedBytes: ComputedRef<number>
  longRecording: ComputedRef<boolean>
  recordingSupported: ComputedRef<boolean>
  // actions
  init: () => void
  start: () => Promise<void>
  stop: () => Promise<void>
  switchCamera: (deviceId: string) => Promise<void>
  switchMicrophone: (deviceId: string) => Promise<void>
  setAudioEnabled: (enabled: boolean) => Promise<void>
  capturePhoto: () => Promise<void>
  cancelCountdown: () => void
  discardPhoto: () => void
  downloadPhoto: () => Promise<void>
  startRecording: () => void
  pauseRecording: () => void
  resumeRecording: () => void
  stopRecording: () => Promise<void>
  discardRecording: () => void
  downloadRecording: () => Promise<void>
  applyAdvancedControl: (
    id: AdvancedControlId,
    value: number | boolean | string,
  ) => Promise<boolean>
  buildDiagnostics: () => DiagnosticsReport
  teardown: () => void
}

export const cameraSessionKey: InjectionKey<CameraSession> = Symbol('jca-camera-session')

export function createCameraSession(): CameraSession {
  const controller = new CameraController()
  const deviceService = new DeviceService()
  const recordingService = new RecordingService()
  const photoService = new PhotoCaptureService()
  const announcer = useAnnouncer()
  const preferences = usePreferences()
  const permissions = usePermissions()

  const session = ref<SessionStatus>(initialSessionStatus)
  const capture = ref<CaptureStatus>(initialCaptureStatus)
  const devices = ref<DeviceList>({ cameras: [], microphones: [], labelsAvailable: false })
  const selectedCameraId = ref<string | null>(null)
  const selectedMicId = ref<string | null>(null)
  const videoSettings = ref<VideoTrackSnapshot | null>(null)
  const audioSettings = ref<AudioTrackSnapshot | null>(null)
  const advancedControls = ref<AdvancedControlDescriptor[]>([])
  const recordingFormat = ref<RecordingMimeChoice | null>(null)
  const supportedFormats = ref<RecordingMimeChoice[]>([])
  const elapsedMs = ref(0)
  const pendingPhoto = ref<CapturedPhoto | null>(null)
  const pendingRecording = ref<RecordingResult | null>(null)
  const videoEl = ref<HTMLVideoElement | null>(null)
  const saveOutcome = ref<SaveOutcome | null>(null)
  const audioFellBack = ref(false)
  const hasAudioTrackRef = ref(false)
  const lastRequestedConstraints = shallowRef<MediaStreamConstraints | null>(null)

  const photo = useObjectUrl()
  const recording = useObjectUrl()

  let countdownTimer: ReturnType<typeof setInterval> | undefined
  let recordingTimer: ReturnType<typeof setInterval> | undefined
  let stopDeviceWatch: (() => void) | undefined
  let initialized = false

  /* ----------------------------- derived ----------------------------- */
  const isActive = computed(() => isSessionActive(session.value))
  const isPreviewing = computed(() => session.value.kind === 'previewing')
  const isRecording = computed(() => capture.value.kind === 'recording')
  const isPaused = computed(() => capture.value.kind === 'recording-paused')
  const hasAudioTrack = computed(() => hasAudioTrackRef.value)
  const estimatedBytes = computed(() =>
    estimateRecordingBytes(elapsedMs.value, { withAudio: hasAudioTrackRef.value }),
  )
  const longRecording = computed(() => elapsedMs.value >= LONG_RECORDING_WARNING_MS)
  const recordingSupported = computed(() => RecordingService.isSupported())

  /* ------------------------------ helpers ---------------------------- */
  function bindStream(): void {
    const stream = controller.getStream()
    const el = videoEl.value
    if (el && stream) {
      el.srcObject = stream
      el.muted = true
      el.playsInline = true
      void el.play().catch(() => {})
    }
  }

  function refreshTrackInfo(): void {
    const videoTrack = controller.getVideoTrack()
    const audioTrack = controller.getAudioTrack()
    hasAudioTrackRef.value = !!audioTrack
    const vs = readSettings(videoTrack)
    const vc = readCapabilities(videoTrack)
    videoSettings.value = vs
      ? {
          width: numberOf(vs.width),
          height: numberOf(vs.height),
          frameRate: numberOf(vs.frameRate),
          aspectRatio: numberOf(vs.aspectRatio),
          facingMode: stringOf(vs.facingMode),
          resizeMode: stringOf(vs.resizeMode),
        }
      : null
    const as = readSettings(audioTrack)
    audioSettings.value = as
      ? {
          echoCancellation: boolOf(as.echoCancellation),
          noiseSuppression: boolOf(as.noiseSuppression),
          autoGainControl: boolOf(as.autoGainControl),
          sampleRate: numberOf(as.sampleRate),
          channelCount: numberOf(as.channelCount),
        }
      : null
    advancedControls.value = buildAdvancedControls(vc, vs)
    // reflect the actual active device id locally (never exported)
    const activeId = stringOf(vs?.deviceId)
    if (activeId) selectedCameraId.value = activeId
    const activeMic = stringOf(as?.deviceId)
    if (activeMic) selectedMicId.value = activeMic
  }

  async function refreshDevices(): Promise<void> {
    try {
      devices.value = await deviceService.enumerate()
    } catch {
      // ignore enumerate failures
    }
  }

  /** Starts a stream with relax-on-constraint and audio-fallback resilience. */
  async function acquire(constraints: MediaStreamConstraints): Promise<void> {
    lastRequestedConstraints.value = constraints
    try {
      await controller.start(constraints)
    } catch (err) {
      const norm = normalizeMediaError(err)
      // Relax resolution AND audio device once on OverconstrainedError — the
      // failing constraint could be on either track (e.g. a stale mic deviceId).
      if (
        norm.kind === 'constraint-failed' &&
        constraints.video &&
        typeof constraints.video === 'object'
      ) {
        const relaxed: MediaStreamConstraints = {
          ...constraints,
          video: relaxVideoConstraints(constraints.video),
        }
        if (constraints.audio) relaxed.audio = relaxAudioConstraints(constraints.audio)
        await controller.start(relaxed)
        lastRequestedConstraints.value = relaxed
        return
      }
      // If a mic is missing but a camera exists, retry video-only.
      if (norm.kind === 'no-device' && constraints.audio) {
        const videoOnly: MediaStreamConstraints = { video: constraints.video, audio: false }
        await controller.start(videoOnly)
        lastRequestedConstraints.value = videoOnly
        audioFellBack.value = true
        return
      }
      throw err
    }
  }

  function clearTimers(): void {
    if (countdownTimer) clearInterval(countdownTimer)
    if (recordingTimer) clearInterval(recordingTimer)
    countdownTimer = undefined
    recordingTimer = undefined
  }

  /* ------------------------------ actions ---------------------------- */
  function init(): void {
    if (initialized) return
    initialized = true
    if (!CameraController.isSecureContextOk()) {
      session.value = sessionStatusForError(insecureContextError())
      return
    }
    if (!CameraController.isMediaSupported()) {
      session.value = sessionStatusForError(unsupportedError())
      return
    }
    supportedFormats.value = listSupportedMimeTypes()

    // Watch for the preview element being mounted/unmounted.
    watch(videoEl, () => bindStream())

    // Device hot-plug handling (debounced + diffed).
    if (DeviceService.isSupported()) {
      stopDeviceWatch = deviceService.onDeviceChange((list) => {
        const prev = devices.value
        devices.value = list
        if (!devicesChanged(prev, list)) return
        // If the active camera vanished while previewing, stop gracefully.
        if (
          isActive.value &&
          selectedCameraId.value &&
          !list.cameras.some((c) => c.deviceId === selectedCameraId.value)
        ) {
          announcer.announce('The active camera was disconnected.', 'assertive')
          void stop()
        }
      })
    }

    // Teardown on page hide / tab hidden to release the camera light.
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', handlePageHide)
      window.addEventListener('beforeunload', handleBeforeUnload)
      document.addEventListener('visibilitychange', handleVisibility)
    }
  }

  function handlePageHide(): void {
    teardown()
  }
  // Warn before leaving while a recording is in progress (prevents accidental loss).
  function handleBeforeUnload(event: BeforeUnloadEvent): void {
    if (isRecording.value || isPaused.value) {
      event.preventDefault()
      event.returnValue = ''
    }
  }
  function handleVisibility(): void {
    if (
      document.visibilityState === 'hidden' &&
      isActive.value &&
      !isRecording.value &&
      !isPaused.value
    ) {
      void stop()
    }
  }

  async function start(): Promise<void> {
    if (!canStart(session.value)) return
    audioFellBack.value = false
    session.value = { kind: 'requesting-permission' }
    const constraints = buildGumConstraints({
      preferences,
      ...(selectedCameraId.value ? { videoDeviceId: selectedCameraId.value } : {}),
      ...(selectedMicId.value ? { audioDeviceId: selectedMicId.value } : {}),
    })
    try {
      await acquire(constraints)
      bindStream()
      refreshTrackInfo()
      await refreshDevices()
      await permissions.refresh()
      recordingFormat.value = selectRecordingMimeType()
      supportedFormats.value = listSupportedMimeTypes()
      session.value = { kind: 'previewing' }
      announcer.announce('Camera started.')
      if (audioFellBack.value) {
        announcer.announce('No microphone was found; recording video without audio.', 'assertive')
      }
    } catch (err) {
      const norm = normalizeMediaError(err)
      session.value = sessionStatusForError(norm)
      announcer.announce(norm.message, 'assertive')
    }
  }

  async function stop(): Promise<void> {
    if (!canStop(session.value)) {
      // Still allow teardown of a stuck state.
      controller.stop()
      return
    }
    // Finalize an in-flight recording first.
    if (isRecording.value || isPaused.value) {
      await stopRecording()
    }
    clearTimers()
    controller.stop()
    if (videoEl.value) videoEl.value.srcObject = null
    capture.value = initialCaptureStatus
    session.value = { kind: 'stopped' }
    hasAudioTrackRef.value = false
    announcer.announce('Camera stopped.')
  }

  async function switchCamera(deviceId: string): Promise<void> {
    if (!canSwitchDevice(session.value)) return
    selectedCameraId.value = deviceId
    session.value = { kind: 'switching-device' }
    const constraints = buildGumConstraints({
      preferences,
      videoDeviceId: deviceId,
      ...(selectedMicId.value ? { audioDeviceId: selectedMicId.value } : {}),
    })
    try {
      await acquire(constraints)
      bindStream()
      refreshTrackInfo()
      session.value = { kind: 'previewing' }
      announcer.announce('Camera switched.')
    } catch (err) {
      const norm = normalizeMediaError(err)
      session.value = sessionStatusForError(norm)
      announcer.announce(norm.message, 'assertive')
    }
  }

  async function switchMicrophone(deviceId: string): Promise<void> {
    if (!canSwitchDevice(session.value)) return
    selectedMicId.value = deviceId
    session.value = { kind: 'switching-device' }
    const constraints = buildGumConstraints({
      preferences,
      ...(selectedCameraId.value ? { videoDeviceId: selectedCameraId.value } : {}),
      audioDeviceId: deviceId,
    })
    try {
      await acquire(constraints)
      bindStream()
      refreshTrackInfo()
      session.value = { kind: 'previewing' }
      announcer.announce('Microphone switched.')
    } catch (err) {
      const norm = normalizeMediaError(err)
      session.value = sessionStatusForError(norm)
    }
  }

  async function setAudioEnabled(enabled: boolean): Promise<void> {
    const previous = preferences.withAudio
    preferences.withAudio = enabled
    if (isPreviewing.value && !isRecording.value && !isPaused.value) {
      // Restart to (de)acquire the microphone track.
      session.value = { kind: 'switching-device' }
      const constraints = buildGumConstraints({
        preferences,
        ...(selectedCameraId.value ? { videoDeviceId: selectedCameraId.value } : {}),
        ...(selectedMicId.value && enabled ? { audioDeviceId: selectedMicId.value } : {}),
      })
      try {
        audioFellBack.value = false
        await acquire(constraints)
        bindStream()
        refreshTrackInfo()
        session.value = { kind: 'previewing' }
      } catch (err) {
        // Revert the preference so it reflects the actual (unchanged) stream.
        preferences.withAudio = previous
        session.value = sessionStatusForError(normalizeMediaError(err))
      }
    }
  }

  /* ------------------------------- photo ----------------------------- */
  async function doCapture(): Promise<void> {
    capture.value = { kind: 'capturing-photo' }
    try {
      const el = videoEl.value
      if (!el) throw new Error('No preview element')
      const result = await photoService.capture(el, controller.getVideoTrack(), {
        format: preferences.photoFormat,
        quality: preferences.photoQuality,
        mirror: preferences.mirrorOutput,
      })
      pendingPhoto.value = result
      photo.set(result.blob)
      announcer.announce('Photo captured.')
    } catch {
      announcer.announce('Could not capture the photo. Please try again.', 'assertive')
    } finally {
      capture.value = initialCaptureStatus
    }
  }

  async function capturePhoto(): Promise<void> {
    if (!isPreviewing.value || !canCapturePhoto(capture.value)) return
    const seconds = preferences.countdownSeconds
    if (seconds > 0) {
      capture.value = beginCountdown(seconds)
      announcer.announce(`Capturing in ${seconds} seconds.`, 'assertive')
      countdownTimer = setInterval(() => {
        const next = tickCountdown(capture.value)
        capture.value = next
        if (next.kind === 'counting-down' && next.remaining > 0) {
          // Announce each remaining second so screen-reader users track progress.
          announcer.announce(`${next.remaining}`)
        } else if (next.kind === 'capturing-photo') {
          if (countdownTimer) clearInterval(countdownTimer)
          countdownTimer = undefined
          void doCapture()
        }
      }, 1000)
    } else {
      await doCapture()
    }
  }

  function cancelCountdown(): void {
    if (capture.value.kind === 'counting-down') {
      if (countdownTimer) clearInterval(countdownTimer)
      countdownTimer = undefined
      capture.value = initialCaptureStatus
      announcer.announce('Countdown cancelled.')
    }
  }

  function discardPhoto(): void {
    pendingPhoto.value = null
    photo.clear()
    saveOutcome.value = null
  }

  async function downloadPhoto(): Promise<void> {
    const current = pendingPhoto.value
    if (!current) return
    const name = buildFilename('photo', extensionForPhotoFormat(current.format))
    saveOutcome.value = await exportService.save(current.blob, name)
    if (saveOutcome.value !== 'cancelled') announcer.announce('Photo saved to your device.')
  }

  /* ----------------------------- recording --------------------------- */
  function startRecording(): void {
    if (!isPreviewing.value || !canStartRecording(capture.value)) return
    const stream = controller.getStream()
    if (!stream || !RecordingService.isSupported()) return
    discardRecording()
    try {
      const choice = recordingService.start(stream, {
        withAudio: preferences.withAudio,
        timeslice: 1000,
      })
      recordingFormat.value = choice
      elapsedMs.value = 0
      capture.value = beginRecording(Date.now())
      recordingTimer = setInterval(() => {
        elapsedMs.value = recordingService.getElapsedMs()
      }, 200)
      announcer.announce('Recording started.', 'assertive')
    } catch {
      // Ensure no half-started recorder/timer/state lingers on failure.
      if (recordingTimer) clearInterval(recordingTimer)
      recordingTimer = undefined
      recordingService.dispose()
      capture.value = initialCaptureStatus
      announcer.announce('Recording could not start in this browser.', 'assertive')
    }
  }

  function pauseRecording(): void {
    if (!canPauseRecording(capture.value)) return
    recordingService.pause()
    capture.value = pauseRec(capture.value, recordingService.getElapsedMs())
    if (recordingTimer) clearInterval(recordingTimer)
    recordingTimer = undefined
    announcer.announce('Recording paused.', 'assertive')
  }

  function resumeRecording(): void {
    if (!canResumeRecording(capture.value)) return
    recordingService.resume()
    capture.value = resumeRec(capture.value, Date.now())
    recordingTimer = setInterval(() => {
      elapsedMs.value = recordingService.getElapsedMs()
    }, 200)
    announcer.announce('Recording resumed.', 'assertive')
  }

  async function stopRecording(): Promise<void> {
    if (!canStopRecording(capture.value)) return
    capture.value = beginFinalize()
    if (recordingTimer) clearInterval(recordingTimer)
    recordingTimer = undefined
    try {
      const result = await recordingService.stop()
      pendingRecording.value = result
      recording.set(result.blob)
      elapsedMs.value = result.durationMs
      announcer.announce('Recording stopped.', 'assertive')
    } catch {
      announcer.announce('Recording failed to finalize.', 'assertive')
    } finally {
      capture.value = endRecording()
    }
  }

  function discardRecording(): void {
    pendingRecording.value = null
    recording.clear()
    elapsedMs.value = 0
    saveOutcome.value = null
  }

  async function downloadRecording(): Promise<void> {
    const current = pendingRecording.value
    if (!current) return
    const name = buildFilename('video', extensionForMimeType(current.mimeType))
    saveOutcome.value = await exportService.save(current.blob, name)
    if (saveOutcome.value !== 'cancelled') announcer.announce('Video saved to your device.')
  }

  /* ------------------------- advanced controls ----------------------- */
  async function applyAdvancedControl(
    id: AdvancedControlId,
    value: number | boolean | string,
  ): Promise<boolean> {
    const ok = await controller.applyVideoConstraints({
      advanced: [{ [id]: value } as MediaTrackConstraintSet],
    })
    if (ok) refreshTrackInfo()
    return ok
  }

  /* ------------------------------ diagnostics ------------------------ */
  function buildDiagnostics(): DiagnosticsReport {
    const selectedCamera =
      devices.value.cameras.find((c) => c.deviceId === selectedCameraId.value) ?? null
    const selectedMicrophone =
      devices.value.microphones.find((m) => m.deviceId === selectedMicId.value) ?? null
    return diagnosticsService.build({
      videoTrack: controller.getVideoTrack(),
      audioTrack: controller.getAudioTrack(),
      selectedCamera,
      selectedMicrophone,
      requestedConstraints: lastRequestedConstraints.value,
      cameraPermission: permissions.camera.value,
      microphonePermission: permissions.microphone.value,
    })
  }

  /* ------------------------------ teardown --------------------------- */
  function teardown(): void {
    clearTimers()
    recordingService.dispose()
    controller.stop()
    if (videoEl.value) videoEl.value.srcObject = null
    photo.clear()
    recording.clear()
    pendingPhoto.value = null
    pendingRecording.value = null
    stopDeviceWatch?.()
    stopDeviceWatch = undefined
    if (typeof window !== 'undefined') {
      window.removeEventListener('pagehide', handlePageHide)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
    initialized = false
  }

  onScopeDispose(teardown)

  return {
    session,
    capture,
    devices,
    preferences,
    selectedCameraId,
    selectedMicId,
    videoSettings,
    audioSettings,
    advancedControls,
    recordingFormat,
    supportedFormats,
    elapsedMs,
    pendingPhoto,
    photoUrl: photo.url,
    pendingRecording,
    recordingUrl: recording.url,
    videoEl,
    saveOutcome,
    audioFellBack,
    isActive,
    isPreviewing,
    isRecording,
    isPaused,
    hasAudioTrack,
    estimatedBytes,
    longRecording,
    recordingSupported,
    init,
    start,
    stop,
    switchCamera,
    switchMicrophone,
    setAudioEnabled,
    capturePhoto,
    cancelCountdown,
    discardPhoto,
    downloadPhoto,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    discardRecording,
    downloadRecording,
    applyAdvancedControl,
    buildDiagnostics,
    teardown,
  }
}

export function provideCameraSession(): CameraSession {
  const session = createCameraSession()
  provide(cameraSessionKey, session)
  return session
}

export function useCameraSession(): CameraSession {
  const session = inject(cameraSessionKey)
  if (!session) throw new Error('useCameraSession must be used within provideCameraSession')
  return session
}

function numberOf(v: unknown): number | undefined {
  return typeof v === 'number' ? v : undefined
}
function stringOf(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined
}
function boolOf(v: unknown): boolean | undefined {
  return typeof v === 'boolean' ? v : undefined
}
