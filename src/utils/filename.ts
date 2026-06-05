/**
 * Deterministic, privacy-safe download filenames — independently unit-tested.
 *
 * Filenames contain only the app name, media kind, and a local timestamp. They
 * never contain device labels, identifiers, or user data. The timestamp is
 * injectable for deterministic tests.
 */

export type MediaKind = 'photo' | 'video' | 'audio'

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}

/** Formats a Date as `YYYYMMDD-HHMMSS` in local time. */
export function timestampSlug(date: Date): string {
  return (
    `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
    `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  )
}

/**
 * Builds a filename like `justacamera-photo-20260605-143022.jpg`.
 * @param kind  media kind
 * @param ext   file extension without the dot
 * @param date  capture time (defaults to now)
 */
export function buildFilename(kind: MediaKind, ext: string, date: Date = new Date()): string {
  const safeExt = ext.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'bin'
  return `justacamera-${kind}-${timestampSlug(date)}.${safeExt}`
}

const PHOTO_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export function extensionForPhotoFormat(format: string): string {
  return PHOTO_EXTENSIONS[format] ?? 'jpg'
}
