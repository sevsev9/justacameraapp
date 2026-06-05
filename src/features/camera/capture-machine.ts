import type { CaptureStatus } from '@/types/media'

/**
 * Pure transition helpers for the capture activity (countdown → photo, and
 * record → pause/resume → finalize). All transitions are total functions that
 * return the next state, with guard predicates the caller checks first.
 * Independently unit-tested.
 *
 * Recording elapsed time is computed by the caller (it owns the clock); these
 * helpers just carry the accumulated `elapsedMs` across pause/resume.
 */

export const initialCaptureStatus: CaptureStatus = { kind: 'idle' }

/* --------------------------- guards --------------------------- */

export function canStartCountdown(status: CaptureStatus): boolean {
  return status.kind === 'idle'
}

export function canCapturePhoto(status: CaptureStatus): boolean {
  return status.kind === 'idle' || status.kind === 'counting-down'
}

export function canStartRecording(status: CaptureStatus): boolean {
  return status.kind === 'idle'
}

export function canPauseRecording(status: CaptureStatus): boolean {
  return status.kind === 'recording'
}

export function canResumeRecording(status: CaptureStatus): boolean {
  return status.kind === 'recording-paused'
}

export function canStopRecording(status: CaptureStatus): boolean {
  return status.kind === 'recording' || status.kind === 'recording-paused'
}

export function isRecordingActive(status: CaptureStatus): boolean {
  return (
    status.kind === 'recording' ||
    status.kind === 'recording-paused' ||
    status.kind === 'finalizing-recording'
  )
}

export function isBusy(status: CaptureStatus): boolean {
  return status.kind !== 'idle'
}

/* ------------------------ transitions ------------------------- */

export function beginCountdown(seconds: number): CaptureStatus {
  return { kind: 'counting-down', remaining: Math.max(0, Math.floor(seconds)) }
}

/**
 * Advances a countdown by one tick. When it reaches zero, returns the
 * capturing-photo state so the caller fires the capture.
 */
export function tickCountdown(status: CaptureStatus): CaptureStatus {
  if (status.kind !== 'counting-down') return status
  const remaining = status.remaining - 1
  return remaining <= 0 ? { kind: 'capturing-photo' } : { kind: 'counting-down', remaining }
}

export function beginCapture(): CaptureStatus {
  return { kind: 'capturing-photo' }
}

export function endCapture(): CaptureStatus {
  return { kind: 'idle' }
}

export function beginRecording(startedAt: number): CaptureStatus {
  return { kind: 'recording', startedAt, elapsedMs: 0 }
}

export function tickRecording(status: CaptureStatus, elapsedMs: number): CaptureStatus {
  if (status.kind !== 'recording') return status
  return { kind: 'recording', startedAt: status.startedAt, elapsedMs: Math.max(0, elapsedMs) }
}

export function pauseRecording(status: CaptureStatus, elapsedMs: number): CaptureStatus {
  if (status.kind !== 'recording') return status
  return { kind: 'recording-paused', elapsedMs: Math.max(0, elapsedMs) }
}

export function resumeRecording(status: CaptureStatus, startedAt: number): CaptureStatus {
  if (status.kind !== 'recording-paused') return status
  return { kind: 'recording', startedAt, elapsedMs: status.elapsedMs }
}

export function beginFinalize(): CaptureStatus {
  return { kind: 'finalizing-recording' }
}

export function endRecording(): CaptureStatus {
  return { kind: 'idle' }
}

/** Reads the accumulated elapsed time out of any recording-ish state. */
export function elapsedOf(status: CaptureStatus): number {
  if (status.kind === 'recording' || status.kind === 'recording-paused') return status.elapsedMs
  return 0
}
