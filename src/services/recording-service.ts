import type { RecordingMimeChoice, RecordingResult } from '@/types/media'
import { listSupportedMimeTypes, selectRecordingMimeType } from '@/utils/mime-support'

/**
 * RecordingService — wraps a single MediaRecorder. Dynamic codec selection,
 * optional microphone audio, pause/resume, and defensive finalization.
 *
 * Important: the recording stream is a thin MediaStream wrapper over tracks
 * OWNED by CameraController. This service NEVER stops those tracks — it only
 * stops the recorder. Stopping tracks is exclusively CameraController's job.
 *
 * All data stays in memory (an array of Blob chunks → one Blob). No network.
 */
export interface RecordingStartOptions {
  withAudio: boolean
  timeslice?: number
  now?: () => number
  /** Fallback timeout (ms) if the `stop` event never fires (iOS flakiness). */
  finalizeTimeoutMs?: number
}

export class RecordingService {
  private recorder: MediaRecorder | null = null
  private chunks: Blob[] = []
  private choice: RecordingMimeChoice | null = null
  private withAudio = false
  private now: () => number = () => Date.now()
  private accumulatedMs = 0
  private lastResumeAt = 0
  private paused = false
  private startedAtEpoch = 0
  private finalizeTimeoutMs = 4000

  /** Lists the recording formats this browser actually supports. */
  static getSupportedFormats(): RecordingMimeChoice[] {
    return listSupportedMimeTypes()
  }

  /** True if MediaRecorder exists and at least one candidate format is supported. */
  static isSupported(): boolean {
    return typeof MediaRecorder !== 'undefined' && selectRecordingMimeType() !== null
  }

  /**
   * Starts recording from the given source stream. Returns the chosen format.
   * Throws if no format is supported.
   */
  start(source: MediaStream, options: RecordingStartOptions): RecordingMimeChoice {
    const choice = selectRecordingMimeType()
    if (!choice) throw new Error('No supported recording format')

    this.now = options.now ?? (() => Date.now())
    this.withAudio = options.withAudio
    this.choice = choice
    this.chunks = []
    this.paused = false
    this.finalizeTimeoutMs = options.finalizeTimeoutMs ?? 4000

    const recordingStream = this.buildRecordingStream(source, options.withAudio)
    const recorder = new MediaRecorder(recordingStream, { mimeType: choice.mimeType })

    recorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) this.chunks.push(event.data)
    }

    this.recorder = recorder
    this.startedAtEpoch = this.now()
    this.lastResumeAt = this.startedAtEpoch
    this.accumulatedMs = 0

    if (typeof options.timeslice === 'number') recorder.start(options.timeslice)
    else recorder.start()

    return choice
  }

  pause(): void {
    if (!this.recorder || this.recorder.state !== 'recording') return
    this.accumulatedMs += this.now() - this.lastResumeAt
    this.paused = true
    if (typeof this.recorder.pause === 'function') this.recorder.pause()
  }

  resume(): void {
    if (!this.recorder || this.recorder.state !== 'paused') return
    this.lastResumeAt = this.now()
    this.paused = false
    if (typeof this.recorder.resume === 'function') this.recorder.resume()
  }

  /** Stops recording and resolves with the assembled clip. */
  stop(): Promise<RecordingResult> {
    return new Promise((resolve, reject) => {
      const recorder = this.recorder
      if (!recorder) {
        reject(new Error('Recorder is not active'))
        return
      }

      const durationMs = this.getElapsedMs()
      const mimeType = recorder.mimeType || this.choice?.mimeType || 'video/webm'
      const withAudio = this.withAudio
      const recordedAt = this.now()

      let settled = false
      const finalize = () => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        const blob = new Blob(this.chunks, { type: mimeType })
        this.cleanup()
        resolve({ blob, mimeType, durationMs, withAudio, recordedAt })
      }

      recorder.onstop = finalize
      recorder.onerror = () => {
        // Even on error, return whatever we managed to capture.
        finalize()
      }

      // Defensive: some iOS builds don't fire `stop` reliably.
      const timer = setTimeout(finalize, this.finalizeTimeoutMs)

      try {
        if (recorder.state !== 'inactive') recorder.stop()
        else finalize()
      } catch {
        finalize()
      }
    })
  }

  getElapsedMs(): number {
    if (!this.recorder) return this.accumulatedMs
    if (this.paused) return this.accumulatedMs
    return this.accumulatedMs + (this.now() - this.lastResumeAt)
  }

  state(): RecordingState | 'inactive' {
    return this.recorder?.state ?? 'inactive'
  }

  isRecording(): boolean {
    return this.recorder?.state === 'recording' || this.recorder?.state === 'paused'
  }

  /** Stops the recorder if active without resolving a result (teardown). */
  dispose(): void {
    if (this.recorder && this.recorder.state !== 'inactive') {
      try {
        this.recorder.stop()
      } catch {
        // ignore
      }
    }
    this.cleanup()
  }

  private cleanup(): void {
    this.recorder = null
    this.chunks = []
  }

  private buildRecordingStream(source: MediaStream, withAudio: boolean): MediaStream {
    const tracks: MediaStreamTrack[] = []
    const video = source.getVideoTracks()[0]
    if (video) tracks.push(video)
    if (withAudio) {
      const audio = source.getAudioTracks()[0]
      if (audio) tracks.push(audio)
    }
    return new MediaStream(tracks)
  }
}
