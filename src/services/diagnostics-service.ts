import type { AudioTrackSnapshot, MediaDeviceOption, VideoTrackSnapshot } from '@/types/media'
import { APP_NAME, APP_VERSION } from '@/app/app-meta'
import { buildAdvancedControls, readCapabilities, readSettings } from '@/utils/capabilities'
import { listSupportedMimeTypes } from '@/utils/mime-support'
import { bucketFrameRate, bucketResolution } from '@/utils/bucket'
import { findSensitiveLeaks, sanitizeForExport } from '@/utils/sanitize'
import { CameraController } from './camera-controller'
import { DeviceService } from './device-service'
import { RecordingService } from './recording-service'
import { ExportService } from './export-service'

export type PermissionStateValue = 'granted' | 'denied' | 'prompt' | 'unknown'

export interface DiagnosticsReport {
  app: { name: string; version: string }
  generatedAt: string
  environment: {
    browserEngine: 'chromium' | 'gecko' | 'webkit' | 'unknown'
    secureContext: boolean
  }
  support: {
    getUserMedia: boolean
    enumerateDevices: boolean
    imageCapture: boolean
    mediaRecorder: boolean
    getCapabilities: boolean
    applyConstraints: boolean
    fileSystemAccess: boolean
  }
  permission: { camera: PermissionStateValue; microphone: PermissionStateValue }
  selectedCamera: { label: string; facing: string } | null
  selectedMicrophone: { label: string } | null
  requestedConstraints: MediaStreamConstraints | null
  video: (VideoTrackSnapshot & { resolutionBucket: string; frameRateBucket: string }) | null
  audio: AudioTrackSnapshot | null
  recordingFormats: string[]
  advancedControls: { id: string; supported: boolean }[]
  notes: string[]
}

export interface DiagnosticsInput {
  videoTrack?: MediaStreamTrack | undefined
  audioTrack?: MediaStreamTrack | undefined
  selectedCamera?: MediaDeviceOption | null
  selectedMicrophone?: MediaDeviceOption | null
  requestedConstraints?: MediaStreamConstraints | null
  cameraPermission?: PermissionStateValue
  microphonePermission?: PermissionStateValue
  now?: () => Date
}

/**
 * DiagnosticsService — assembles a useful, privacy-preserving diagnostic report.
 * The full report is shown locally (with device labels); the EXPORT version is
 * passed through the sanitizer so identifiers/labels/media never leave the
 * browser. See docs/privacy-model.md.
 */
export class DiagnosticsService {
  build(input: DiagnosticsInput = {}): DiagnosticsReport {
    const now = input.now ?? (() => new Date())
    const videoSettings = readSettings(input.videoTrack)
    const videoCaps = readCapabilities(input.videoTrack)
    const audioSettings = readSettings(input.audioTrack)

    const video: DiagnosticsReport['video'] = videoSettings
      ? {
          width: num(videoSettings.width),
          height: num(videoSettings.height),
          frameRate: num(videoSettings.frameRate),
          aspectRatio: num(videoSettings.aspectRatio),
          facingMode: str(videoSettings.facingMode),
          resizeMode: str(videoSettings.resizeMode),
          resolutionBucket: bucketResolution(num(videoSettings.width), num(videoSettings.height)),
          frameRateBucket: bucketFrameRate(num(videoSettings.frameRate)),
        }
      : null

    const audio: AudioTrackSnapshot | null = audioSettings
      ? {
          echoCancellation: bool(audioSettings.echoCancellation),
          noiseSuppression: bool(audioSettings.noiseSuppression),
          autoGainControl: bool(audioSettings.autoGainControl),
          sampleRate: num(audioSettings.sampleRate),
          channelCount: num(audioSettings.channelCount),
        }
      : null

    const advanced = buildAdvancedControls(videoCaps, videoSettings).map((c) => ({
      id: c.id,
      supported: c.supported,
    }))

    return {
      app: { name: APP_NAME, version: APP_VERSION },
      generatedAt: now().toISOString(),
      environment: {
        browserEngine: detectEngine(),
        secureContext: CameraController.isSecureContextOk(),
      },
      support: {
        getUserMedia: CameraController.isMediaSupported(),
        enumerateDevices: DeviceService.isSupported(),
        imageCapture: typeof window !== 'undefined' && 'ImageCapture' in window,
        mediaRecorder: RecordingService.isSupported(),
        getCapabilities:
          typeof MediaStreamTrack !== 'undefined' &&
          typeof MediaStreamTrack.prototype.getCapabilities === 'function',
        applyConstraints:
          typeof MediaStreamTrack !== 'undefined' &&
          typeof MediaStreamTrack.prototype.applyConstraints === 'function',
        fileSystemAccess: ExportService.supportsFilePicker(),
      },
      permission: {
        camera: input.cameraPermission ?? 'unknown',
        microphone: input.microphonePermission ?? 'unknown',
      },
      selectedCamera: input.selectedCamera
        ? { label: input.selectedCamera.label, facing: input.selectedCamera.facing }
        : null,
      selectedMicrophone: input.selectedMicrophone
        ? { label: input.selectedMicrophone.label }
        : null,
      requestedConstraints: input.requestedConstraints ?? null,
      video,
      audio,
      recordingFormats: listSupportedMimeTypes().map((c) => c.label),
      advancedControls: advanced,
      notes: buildNotes(),
    }
  }

  /**
   * Produces the sanitized, copyable export. Strips device labels/ids/media via
   * the sanitizer and verifies no leaks remain (throws in the impossible case a
   * leak survives, turning a privacy bug into a hard failure).
   */
  toExport(report: DiagnosticsReport): unknown {
    const sanitized = sanitizeForExport(report)
    const leaks = findSensitiveLeaks(sanitized)
    if (leaks.length > 0) {
      throw new Error(`Diagnostic export blocked: ${leaks.join(', ')}`)
    }
    return sanitized
  }

  /** Pretty JSON string for the clipboard. */
  toReportText(report: DiagnosticsReport): string {
    return JSON.stringify(this.toExport(report), null, 2)
  }
}

export const diagnosticsService = new DiagnosticsService()

function buildNotes(): string[] {
  const notes: string[] = []
  if (!CameraController.isSecureContextOk()) {
    notes.push('Insecure context: camera access requires HTTPS or localhost.')
  }
  if (!(typeof window !== 'undefined' && 'ImageCapture' in window)) {
    notes.push('ImageCapture is unavailable; photos use the canvas fallback.')
  }
  if (!ExportService.supportsFilePicker()) {
    notes.push('File System Access API is unavailable; downloads use the standard fallback.')
  }
  return notes
}

function detectEngine(): DiagnosticsReport['environment']['browserEngine'] {
  if (typeof navigator === 'undefined') return 'unknown'
  const ua = navigator.userAgent
  // Order matters: Chromium UA also contains "Safari".
  if (/Edg|Chrome|Chromium|CriOS/.test(ua)) return 'chromium'
  if (/Firefox|FxiOS/.test(ua)) return 'gecko'
  if (/Safari/.test(ua)) return 'webkit'
  return 'unknown'
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' ? v : undefined
}
function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined
}
function bool(v: unknown): boolean | undefined {
  return typeof v === 'boolean' ? v : undefined
}
