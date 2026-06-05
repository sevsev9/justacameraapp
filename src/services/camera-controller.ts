/**
 * CameraController — THE single authoritative owner of the active MediaStream.
 *
 * This is the only module that calls getUserMedia, holds the MediaStream, and
 * stops tracks. This guarantees:
 *   - exactly one stream is open at a time (no leaks), and
 *   - "stop camera" reliably stops every track (releases the OS camera light).
 *
 * It is framework-agnostic (no Vue). The composable layer adapts it to reactive
 * state. See docs/architecture.md §3.
 */
export class CameraController {
  private stream: MediaStream | null = null

  /** True if the browser exposes the media-capture API at all. */
  static isMediaSupported(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function'
    )
  }

  /** True if we're in a secure context (HTTPS or localhost). */
  static isSecureContextOk(): boolean {
    if (typeof window === 'undefined') return false
    if (window.isSecureContext) return true
    const host = window.location?.hostname ?? ''
    return host === 'localhost' || host === '127.0.0.1' || host === '::1'
  }

  /**
   * Starts a stream with the given constraints. Any existing stream is stopped
   * FIRST so only one stream is ever open (avoids multi-stream leaks and iOS
   * "second getUserMedia mutes the first" issues). On failure the previous
   * stream is already gone and the caller transitions to an error state.
   */
  async start(constraints: MediaStreamConstraints): Promise<MediaStream> {
    if (!CameraController.isMediaSupported()) {
      // Surface as a TypeError so errors.ts maps it to insecure/unsupported.
      throw new TypeError('navigator.mediaDevices.getUserMedia is unavailable')
    }
    this.stop()
    const stream = await navigator.mediaDevices.getUserMedia(constraints)
    this.stream = stream
    return stream
  }

  /** Stops every track and clears the stream. Safe to call repeatedly. */
  stop(): void {
    if (!this.stream) return
    for (const track of this.stream.getTracks()) {
      try {
        track.stop()
      } catch {
        // a track may already be ended; ignore
      }
    }
    this.stream = null
  }

  getStream(): MediaStream | null {
    return this.stream
  }

  getVideoTrack(): MediaStreamTrack | undefined {
    return this.stream?.getVideoTracks()[0]
  }

  getAudioTrack(): MediaStreamTrack | undefined {
    return this.stream?.getAudioTracks()[0]
  }

  hasAudio(): boolean {
    return (this.stream?.getAudioTracks().length ?? 0) > 0
  }

  isActive(): boolean {
    return !!this.stream && this.stream.getTracks().some((t) => t.readyState === 'live')
  }

  /**
   * Applies advanced video constraints (zoom/torch/focus/etc.) to the active
   * video track. Wrapped in try/catch because applying an unsupported `advanced`
   * constraint may reject or no-op depending on the browser — and must never
   * break the live preview. Returns whether it succeeded.
   */
  async applyVideoConstraints(constraints: MediaTrackConstraints): Promise<boolean> {
    const track = this.getVideoTrack()
    if (!track || typeof track.applyConstraints !== 'function') return false
    try {
      await track.applyConstraints(constraints)
      return true
    } catch {
      return false
    }
  }
}
