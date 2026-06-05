/**
 * Byte formatting + recording-size estimation — pure, independently unit-tested.
 */

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const

/** Formats a byte count as a human string, e.g. 1536 → "1.5 KB". */
export function formatBytes(bytes: number, fractionDigits = 1): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), UNITS.length - 1)
  const value = bytes / Math.pow(1024, exponent)
  const unit = UNITS[exponent] ?? 'B'
  // Whole bytes don't need a fraction.
  const digits = exponent === 0 ? 0 : fractionDigits
  return `${value.toFixed(digits)} ${unit}`
}

/**
 * Rough estimate of a recording's size, used only to warn the user before/while
 * recording. Bitrate defaults are conservative midpoints; this is intentionally
 * approximate and labeled as such in the UI.
 */
export function estimateRecordingBytes(
  durationMs: number,
  opts: { withAudio: boolean; videoBitsPerSecond?: number; audioBitsPerSecond?: number } = {
    withAudio: true,
  },
): number {
  const videoBps = opts.videoBitsPerSecond ?? 2_500_000 // ~2.5 Mbps
  const audioBps = opts.withAudio ? (opts.audioBitsPerSecond ?? 128_000) : 0
  const seconds = Math.max(0, durationMs / 1000)
  return Math.round(((videoBps + audioBps) * seconds) / 8)
}

/** Duration (ms) past which we warn the user that recordings get large. */
export const LONG_RECORDING_WARNING_MS = 5 * 60 * 1000
