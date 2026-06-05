import type { RecordingMimeChoice } from '@/types/media'

/**
 * Recording MIME-type selection — isolated and independently unit-testable.
 *
 * Preference order rationale (see docs/browser-support.md §MediaRecorder):
 * justacamera.app saves files to the user's device and has a likely iOS
 * audience, so we lead with MP4/H.264+AAC (plays natively in iOS Photos and
 * virtually everywhere), then fall back to WebM (VP9 → VP8) for
 * Chromium/Firefox/Safari 18.4+, then a bare container as a last resort.
 *
 * NEVER assume a codec is available — always probe with the injected
 * `isTypeSupported` (defaults to `MediaRecorder.isTypeSupported`) and read back
 * the recorder's actual `mimeType` afterwards.
 */
export const RECORDING_MIME_CANDIDATES: readonly RecordingMimeChoice[] = [
  {
    mimeType: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    label: 'MP4 (H.264/AAC)',
    container: 'mp4',
  },
  { mimeType: 'video/mp4;codecs=avc1,mp4a.40.2', label: 'MP4 (H.264/AAC)', container: 'mp4' },
  { mimeType: 'video/webm;codecs=vp9,opus', label: 'WebM (VP9/Opus)', container: 'webm' },
  { mimeType: 'video/webm;codecs=vp8,opus', label: 'WebM (VP8/Opus)', container: 'webm' },
  { mimeType: 'video/webm;codecs=av01,opus', label: 'WebM (AV1/Opus)', container: 'webm' },
  { mimeType: 'video/webm', label: 'WebM', container: 'webm' },
  { mimeType: 'video/mp4', label: 'MP4', container: 'mp4' },
] as const

/** Audio-only candidates, for completeness/diagnostics. */
export const AUDIO_MIME_CANDIDATES: readonly RecordingMimeChoice[] = [
  { mimeType: 'audio/webm;codecs=opus', label: 'WebM (Opus)', container: 'webm' },
  { mimeType: 'audio/mp4;codecs=mp4a.40.2', label: 'MP4 (AAC)', container: 'mp4' },
  { mimeType: 'audio/webm', label: 'WebM', container: 'webm' },
  { mimeType: 'audio/mp4', label: 'MP4', container: 'mp4' },
] as const

export type IsTypeSupportedFn = (mimeType: string) => boolean

function defaultIsTypeSupported(mimeType: string): boolean {
  return (
    typeof MediaRecorder !== 'undefined' &&
    typeof MediaRecorder.isTypeSupported === 'function' &&
    MediaRecorder.isTypeSupported(mimeType)
  )
}

/**
 * Returns the first supported recording choice from the candidate list, or
 * `null` if none are supported (the recorder UI must then be disabled).
 */
export function selectRecordingMimeType(
  isSupported: IsTypeSupportedFn = defaultIsTypeSupported,
  candidates: readonly RecordingMimeChoice[] = RECORDING_MIME_CANDIDATES,
): RecordingMimeChoice | null {
  for (const candidate of candidates) {
    if (isSupported(candidate.mimeType)) return candidate
  }
  return null
}

/** Lists every supported candidate (for the diagnostics panel). */
export function listSupportedMimeTypes(
  isSupported: IsTypeSupportedFn = defaultIsTypeSupported,
  candidates: readonly RecordingMimeChoice[] = RECORDING_MIME_CANDIDATES,
): RecordingMimeChoice[] {
  return candidates.filter((c) => isSupported(c.mimeType))
}

/** Maps a recording mime type to a file extension. */
export function extensionForMimeType(mimeType: string): string {
  const base = mimeType.split(';')[0]?.toLowerCase() ?? ''
  if (base === 'video/mp4' || base === 'audio/mp4') return base.startsWith('audio') ? 'm4a' : 'mp4'
  if (base === 'video/webm') return 'webm'
  if (base === 'audio/webm') return 'webm'
  if (base.startsWith('audio/')) return 'webm'
  return 'webm'
}
