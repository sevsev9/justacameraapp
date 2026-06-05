/**
 * Shared domain types for justacamera.app.
 *
 * These are framework-agnostic and contain no Vue imports so they can be used
 * by services, utils, composables and tests alike.
 */

/* ------------------------------------------------------------------ *
 * Errors
 * ------------------------------------------------------------------ */

/**
 * Normalized classification of every failure mode the media pipeline can hit.
 * Maps the various browser `DOMException` names (which differ subtly per
 * browser) onto a stable, exhaustively-handled set.
 */
export type MediaErrorKind =
  | 'permission-denied' // NotAllowedError / SecurityError
  | 'no-device' // NotFoundError
  | 'device-busy' // NotReadableError / AbortError
  | 'constraint-failed' // OverconstrainedError
  | 'insecure-context' // mediaDevices undefined on http://
  | 'unsupported' // API missing entirely
  | 'unknown'

export interface NormalizedMediaError {
  kind: MediaErrorKind
  /** User-facing message — never contains identifiers. */
  message: string
  /** Actionable recovery hint shown to the user. */
  recovery: string
  /** For constraint failures, the offending constraint name (e.g. "width"). */
  constraint?: string
  /** Original DOMException name, for diagnostics only. */
  name?: string
}

/* ------------------------------------------------------------------ *
 * Devices (sanitized — no deviceId/groupId ever leaves this layer)
 * ------------------------------------------------------------------ */

export type CameraFacing = 'user' | 'environment' | 'unknown'

/**
 * A device option presented to the UI. `deviceId` is kept ONLY for local use
 * (passing back into getUserMedia constraints); it must never be exported,
 * logged, or transmitted. See utils/sanitize.ts.
 */
export interface MediaDeviceOption {
  /** Local-only identifier used to re-select this device. Never exported. */
  deviceId: string
  kind: 'videoinput' | 'audioinput'
  /** Human label (may be empty before permission). */
  label: string
  /** Best-effort facing for cameras, derived from the label/track. */
  facing: CameraFacing
}

export interface DeviceList {
  cameras: MediaDeviceOption[]
  microphones: MediaDeviceOption[]
  /** True once labels are populated (i.e. permission was granted at least once). */
  labelsAvailable: boolean
}

/* ------------------------------------------------------------------ *
 * Preferences (persisted locally; safe subset only)
 * ------------------------------------------------------------------ */

export type Resolution = '480p' | '720p' | '1080p' | '4k' | 'auto'

export interface CameraPreferences {
  facing: CameraFacing
  /** Preferred resolution; negotiated as `ideal`, never `exact`. */
  resolution: Resolution
  withAudio: boolean
  mirrorPreview: boolean
  mirrorOutput: boolean
  countdownSeconds: 0 | 3 | 5 | 10
  photoFormat: PhotoFormat
  photoQuality: number // 0..1 for lossy formats
}

/* ------------------------------------------------------------------ *
 * Track snapshot (negotiated settings + capabilities)
 * ------------------------------------------------------------------ */

export interface VideoTrackSnapshot {
  width?: number
  height?: number
  frameRate?: number
  aspectRatio?: number
  facingMode?: string
  resizeMode?: string
}

export interface AudioTrackSnapshot {
  echoCancellation?: boolean
  noiseSuppression?: boolean
  autoGainControl?: boolean
  sampleRate?: number
  channelCount?: number
}

/* ------------------------------------------------------------------ *
 * Advanced (capability-driven) controls
 * ------------------------------------------------------------------ */

export type AdvancedControlId =
  | 'zoom'
  | 'torch'
  | 'focusMode'
  | 'focusDistance'
  | 'exposureMode'
  | 'exposureCompensation'
  | 'whiteBalanceMode'
  | 'brightness'
  | 'contrast'
  | 'saturation'
  | 'sharpness'
  | 'colorTemperature'

export type AdvancedControlType = 'range' | 'toggle' | 'enum'

export interface AdvancedControlDescriptor {
  id: AdvancedControlId
  label: string
  type: AdvancedControlType
  supported: boolean
  /** range controls */
  min?: number
  max?: number
  step?: number
  value?: number | boolean | string
  /** enum controls */
  options?: string[]
}

/* ------------------------------------------------------------------ *
 * Photo
 * ------------------------------------------------------------------ */

export type PhotoFormat = 'image/jpeg' | 'image/png' | 'image/webp'

export interface PhotoCaptureOptions {
  format: PhotoFormat
  quality: number // 0..1, ignored for png
  mirror: boolean
}

export type PhotoCaptureMethod = 'image-capture' | 'canvas'

export interface CapturedPhoto {
  blob: Blob
  width: number
  height: number
  format: PhotoFormat
  method: PhotoCaptureMethod
  /** Wall-clock capture time (local only). */
  capturedAt: number
}

/* ------------------------------------------------------------------ *
 * Recording
 * ------------------------------------------------------------------ */

export interface RecordingMimeChoice {
  /** Full mime type string, e.g. "video/webm;codecs=vp9,opus". */
  mimeType: string
  /** Short human label, e.g. "WebM (VP9)". */
  label: string
  container: 'webm' | 'mp4'
}

export interface RecordingResult {
  blob: Blob
  mimeType: string
  durationMs: number
  withAudio: boolean
  recordedAt: number
}

/* ------------------------------------------------------------------ *
 * State machines
 * ------------------------------------------------------------------ */

export type SessionStatus =
  | { kind: 'idle' }
  | { kind: 'requesting-permission' }
  | { kind: 'previewing' }
  | { kind: 'switching-device' }
  | { kind: 'stopped' }
  | { kind: 'permission-denied'; error: NormalizedMediaError }
  | { kind: 'no-device'; error: NormalizedMediaError }
  | { kind: 'constraint-failed'; error: NormalizedMediaError }
  | { kind: 'unsupported'; error: NormalizedMediaError }
  | { kind: 'error'; error: NormalizedMediaError }

export type SessionStatusKind = SessionStatus['kind']

export type CaptureStatus =
  | { kind: 'idle' }
  | { kind: 'counting-down'; remaining: number }
  | { kind: 'capturing-photo' }
  | { kind: 'recording'; startedAt: number; elapsedMs: number }
  | { kind: 'recording-paused'; elapsedMs: number }
  | { kind: 'finalizing-recording' }

export type CaptureStatusKind = CaptureStatus['kind']
