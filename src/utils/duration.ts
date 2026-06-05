/**
 * Duration + byte formatting helpers — pure, independently unit-tested.
 */

/** Formats milliseconds as `M:SS` or `H:MM:SS`. Clamps negatives to 0. */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const mm = hours > 0 ? minutes.toString().padStart(2, '0') : minutes.toString()
  const ss = seconds.toString().padStart(2, '0')
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`
}

/** Formats a clock-style duration for screen readers, e.g. "1 minute 5 seconds". */
export function formatDurationSpoken(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const parts: string[] = []
  if (minutes > 0) parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`)
  parts.push(`${seconds} ${seconds === 1 ? 'second' : 'seconds'}`)
  return parts.join(' ')
}
