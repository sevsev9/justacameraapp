import type { CameraPreferences, Resolution } from '@/types/media'

/**
 * Builds `getUserMedia` constraints from user preferences — isolated and
 * independently unit-tested.
 *
 * Design rules (see docs/browser-support.md):
 *  - Resolution/frameRate use `ideal` (soft) so the UA negotiates rather than
 *    rejecting. We never use `exact` width/height (a frequent OverconstrainedError
 *    source).
 *  - Device selection uses `deviceId: { exact }` when a specific device is
 *    chosen (the only reliable cross-platform switch).
 *  - `facingMode` is a soft `ideal` hint, only useful on mobile.
 */

const RESOLUTION_DIMENSIONS: Record<
  Exclude<Resolution, 'auto'>,
  { width: number; height: number }
> = {
  '480p': { width: 854, height: 480 },
  '720p': { width: 1280, height: 720 },
  '1080p': { width: 1920, height: 1080 },
  '4k': { width: 3840, height: 2160 },
}

export interface BuildConstraintsInput {
  preferences: Pick<CameraPreferences, 'facing' | 'resolution' | 'withAudio'>
  /** Specific camera to use (local deviceId). When set, takes priority. */
  videoDeviceId?: string
  /** Specific microphone to use (local deviceId). */
  audioDeviceId?: string
}

export function buildVideoConstraints(input: BuildConstraintsInput): MediaTrackConstraints {
  const { preferences, videoDeviceId } = input
  const video: MediaTrackConstraints = {}

  if (videoDeviceId) {
    video.deviceId = { exact: videoDeviceId }
  } else if (preferences.facing === 'user' || preferences.facing === 'environment') {
    video.facingMode = { ideal: preferences.facing }
  }

  if (preferences.resolution !== 'auto') {
    const dims = RESOLUTION_DIMENSIONS[preferences.resolution]
    video.width = { ideal: dims.width }
    video.height = { ideal: dims.height }
  }

  return video
}

export function buildAudioConstraints(input: BuildConstraintsInput): MediaTrackConstraints | false {
  if (!input.preferences.withAudio) return false
  const audio: MediaTrackConstraints = {
    echoCancellation: { ideal: true },
    noiseSuppression: { ideal: true },
    autoGainControl: { ideal: true },
  }
  if (input.audioDeviceId) {
    audio.deviceId = { exact: input.audioDeviceId }
  }
  return audio
}

export function buildGumConstraints(input: BuildConstraintsInput): MediaStreamConstraints {
  return {
    video: buildVideoConstraints(input),
    audio: buildAudioConstraints(input),
  }
}

/**
 * Relaxes constraints after an OverconstrainedError: drops the failing
 * width/height/frameRate to let the UA pick anything. Keeps device selection.
 */
export function relaxVideoConstraints(video: MediaTrackConstraints): MediaTrackConstraints {
  const relaxed: MediaTrackConstraints = {}
  if (video.deviceId) relaxed.deviceId = video.deviceId
  if (video.facingMode) relaxed.facingMode = video.facingMode
  return relaxed
}

/**
 * Relaxes audio constraints after an OverconstrainedError: drops a possibly-stale
 * `deviceId: { exact }` (a frequent cause when a selected mic disappears) while
 * keeping the processing ideals. Returns `true` to fall back to the default mic.
 */
export function relaxAudioConstraints(
  audio: MediaTrackConstraints | boolean,
): MediaTrackConstraints | boolean {
  if (typeof audio === 'boolean') return audio
  return {
    echoCancellation: { ideal: true },
    noiseSuppression: { ideal: true },
    autoGainControl: { ideal: true },
  }
}
