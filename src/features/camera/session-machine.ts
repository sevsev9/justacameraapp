import type { NormalizedMediaError, SessionStatus } from '@/types/media'

/**
 * Pure helpers for the session lifecycle state. Centralizes which transitions
 * are legal so the orchestrating composable never produces an invalid state.
 * Independently unit-tested (no browser needed).
 */

export const initialSessionStatus: SessionStatus = { kind: 'idle' }

/** Maps a normalized media error onto the appropriate terminal session state. */
export function sessionStatusForError(error: NormalizedMediaError): SessionStatus {
  switch (error.kind) {
    case 'permission-denied':
      return { kind: 'permission-denied', error }
    case 'no-device':
      return { kind: 'no-device', error }
    case 'constraint-failed':
      return { kind: 'constraint-failed', error }
    case 'insecure-context':
    case 'unsupported':
      return { kind: 'unsupported', error }
    case 'device-busy':
    case 'unknown':
    default:
      return { kind: 'error', error }
  }
}

/** True while a live stream exists (preview or mid-switch). */
export function isSessionActive(status: SessionStatus): boolean {
  return status.kind === 'previewing' || status.kind === 'switching-device'
}

/** True for any terminal error-ish state the user can retry from. */
export function isSessionError(status: SessionStatus): boolean {
  return (
    status.kind === 'permission-denied' ||
    status.kind === 'no-device' ||
    status.kind === 'constraint-failed' ||
    status.kind === 'unsupported' ||
    status.kind === 'error'
  )
}

/** Whether a Start action is allowed from the current state. */
export function canStart(status: SessionStatus): boolean {
  return status.kind === 'idle' || status.kind === 'stopped' || isSessionError(status)
}

/** Whether a Stop action is allowed. */
export function canStop(status: SessionStatus): boolean {
  return isSessionActive(status)
}

/** Whether a device switch is allowed (only while previewing). */
export function canSwitchDevice(status: SessionStatus): boolean {
  return status.kind === 'previewing'
}
