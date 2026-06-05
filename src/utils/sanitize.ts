/**
 * Diagnostic / telemetry sanitization — isolated and independently unit-tested.
 *
 * This is the single source of truth for "what must never leave the browser".
 * It is used both by the diagnostics export (Copy report) and by any future
 * telemetry path. See docs/privacy-model.md and docs/telemetry-schema.md.
 *
 * The sanitizer is deny-by-recursion: it walks an arbitrary value and removes
 * any object key on the denylist, plus any value that looks like media (Blob,
 * ArrayBuffer, typed arrays, blob:/data: URLs, long base64 blobs).
 */

/** Keys that must be stripped from any exported/transmitted object. */
export const SENSITIVE_KEYS: readonly string[] = [
  'deviceid',
  'groupid',
  'id', // generic identifier — err on the side of removal in exports
  'label', // raw device labels can identify hardware/user
  'labels',
  'filename',
  'filepath',
  'path',
  'hash',
  'fingerprint',
  'token',
  'secret',
  'email',
  'user',
  'username',
] as const

/** Marker substituted in place of a removed value. */
export const REDACTED = '[redacted]'

const BLOB_OR_DATA_URL = /^(blob:|data:)/i
/** A long, mostly-base64 string is treated as possible encoded media. */
const LIKELY_BASE64_MEDIA = /^[A-Za-z0-9+/=]{512,}$/

export interface SanitizeOptions {
  /** Extra keys to strip in addition to {@link SENSITIVE_KEYS}. */
  extraKeys?: readonly string[]
  /** Max recursion depth (guards against cyclic / huge structures). */
  maxDepth?: number
}

/**
 * Returns a deep copy of `value` with all sensitive keys and media-shaped
 * values removed/redacted. Never throws; unknown shapes pass through safely.
 */
export function sanitizeForExport(value: unknown, options: SanitizeOptions = {}): unknown {
  const deny = new Set(
    [...SENSITIVE_KEYS, ...(options.extraKeys ?? [])].map((k) => k.toLowerCase()),
  )
  const maxDepth = options.maxDepth ?? 8
  const seen = new WeakSet<object>()

  function walk(input: unknown, depth: number): unknown {
    if (depth > maxDepth) return REDACTED

    // Media-shaped binary values are always removed.
    if (isMediaValue(input)) return REDACTED

    if (typeof input === 'string') {
      if (BLOB_OR_DATA_URL.test(input)) return REDACTED
      if (LIKELY_BASE64_MEDIA.test(input)) return REDACTED
      return input
    }

    if (input === null || typeof input !== 'object') return input

    if (seen.has(input)) return REDACTED
    seen.add(input)

    if (Array.isArray(input)) {
      return input.map((item) => walk(item, depth + 1))
    }

    const out: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(input)) {
      if (deny.has(key.toLowerCase())) {
        out[key] = REDACTED
        continue
      }
      out[key] = walk(val, depth + 1)
    }
    return out
  }

  return walk(value, 0)
}

/**
 * Deeply scans a value and returns the list of policy violations found
 * (sensitive keys with real values, or media-shaped values). Used by tests and
 * as a last-line guard before any export. An empty array means "safe".
 */
export function findSensitiveLeaks(value: unknown): string[] {
  const deny = new Set(SENSITIVE_KEYS.map((k) => k.toLowerCase()))
  const leaks: string[] = []
  const seen = new WeakSet<object>()

  function walk(input: unknown, pathStr: string, depth: number): void {
    if (depth > 12) return
    if (isMediaValue(input)) {
      leaks.push(`${pathStr || '<root>'}: media value`)
      return
    }
    if (typeof input === 'string') {
      if (BLOB_OR_DATA_URL.test(input)) leaks.push(`${pathStr}: blob/data url`)
      else if (LIKELY_BASE64_MEDIA.test(input)) leaks.push(`${pathStr}: base64 blob`)
      return
    }
    if (input === null || typeof input !== 'object') return
    if (seen.has(input)) return
    seen.add(input)
    if (Array.isArray(input)) {
      input.forEach((item, i) => walk(item, `${pathStr}[${i}]`, depth + 1))
      return
    }
    for (const [key, val] of Object.entries(input)) {
      const next = pathStr ? `${pathStr}.${key}` : key
      if (deny.has(key.toLowerCase()) && val != null && val !== REDACTED && val !== '') {
        leaks.push(`${next}: sensitive key`)
      }
      walk(val, next, depth + 1)
    }
  }

  walk(value, '', 0)
  return leaks
}

function isMediaValue(input: unknown): boolean {
  if (input instanceof ArrayBuffer) return true
  if (typeof Blob !== 'undefined' && input instanceof Blob) return true
  if (typeof File !== 'undefined' && input instanceof File) return true
  if (ArrayBuffer.isView(input)) return true
  if (typeof MediaStream !== 'undefined' && input instanceof MediaStream) return true
  return false
}
