import type { NormalizedMediaError } from '@/types/media'

/**
 * Normalizes the many browser-specific `getUserMedia` / media failures into a
 * stable {@link NormalizedMediaError}. Pure and independently unit-tested.
 *
 * Cross-browser mapping (see docs/browser-support.md):
 *  - NotAllowedError / SecurityError → permission-denied
 *  - NotFoundError                   → no-device
 *  - NotReadableError / AbortError   → device-busy
 *  - OverconstrainedError            → constraint-failed (has .constraint)
 *  - TypeError + missing mediaDevices→ insecure-context / unsupported
 */
export function normalizeMediaError(err: unknown): NormalizedMediaError {
  const name = getErrorName(err)
  const constraint = getConstraint(err)

  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return {
        kind: 'permission-denied',
        name,
        message: 'Camera and microphone access was blocked.',
        recovery:
          'Allow access from your browser’s address-bar camera icon (or site settings), then try again.',
      }
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return {
        kind: 'no-device',
        name,
        message: 'No camera or microphone was found.',
        recovery: 'Connect a camera or microphone and try again.',
      }
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return {
        kind: 'device-busy',
        name,
        message: 'Your camera could not be started.',
        recovery:
          'It may be in use by another app or browser tab. Close anything else using the camera, then try again.',
      }
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return {
        kind: 'constraint-failed',
        name,
        ...(constraint ? { constraint } : {}),
        message: 'The requested camera settings are not supported by this device.',
        recovery: 'We’ll retry with relaxed settings. You can also pick a different resolution.',
      }
    case 'TypeError':
      return {
        kind: 'insecure-context',
        name,
        message: 'Camera access requires a secure (HTTPS) connection.',
        recovery: 'Open this site over HTTPS (or on localhost) to use the camera.',
      }
    default:
      return {
        kind: 'unknown',
        ...(name ? { name } : {}),
        message: 'Something went wrong while accessing your camera.',
        recovery: 'Please try again. If it keeps happening, try another browser.',
      }
  }
}

/** Builds the "browser doesn't support the media APIs at all" error. */
export function unsupportedError(detail = 'media-devices'): NormalizedMediaError {
  return {
    kind: 'unsupported',
    name: detail,
    message: 'This browser does not support camera access.',
    recovery: 'Try a recent version of Chrome, Edge, Firefox, or Safari over HTTPS.',
  }
}

/** Builds the insecure-context error (mediaDevices unavailable on http://). */
export function insecureContextError(): NormalizedMediaError {
  return {
    kind: 'insecure-context',
    message: 'Camera access requires a secure (HTTPS) connection.',
    recovery: 'Open this site over HTTPS (or on localhost) to use the camera.',
  }
}

function getErrorName(err: unknown): string | undefined {
  if (err && typeof err === 'object' && 'name' in err && typeof err.name === 'string') {
    return err.name
  }
  if (err instanceof Error) return err.name
  return undefined
}

function getConstraint(err: unknown): string | undefined {
  if (
    err &&
    typeof err === 'object' &&
    'constraint' in err &&
    typeof err.constraint === 'string' &&
    err.constraint.length > 0
  ) {
    return err.constraint
  }
  return undefined
}
