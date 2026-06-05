import { reactive, watch } from 'vue'
import type { CameraPreferences } from '@/types/media'

/**
 * Reactive, locally-persisted preferences. ONLY a safe, non-identifying subset
 * is stored (facing/resolution/audio/mirror/countdown/format/quality). We do NOT
 * persist deviceId by default — a deviceId is profile/origin-scoped, not portable,
 * and keeping device identity out of storage is the privacy-conservative choice
 * (see docs/privacy-model.md §3.4).
 */
const STORAGE_KEY = 'jca:prefs:v1'

export const defaultPreferences: CameraPreferences = {
  facing: 'user',
  resolution: '720p',
  withAudio: true,
  mirrorPreview: true,
  mirrorOutput: false,
  countdownSeconds: 0,
  photoFormat: 'image/jpeg',
  photoQuality: 0.92,
}

const VALID_RESOLUTIONS = new Set(['480p', '720p', '1080p', '4k', 'auto'])
const VALID_FORMATS = new Set(['image/jpeg', 'image/png', 'image/webp'])
const VALID_COUNTDOWNS = new Set([0, 3, 5, 10])
const VALID_FACING = new Set(['user', 'environment', 'unknown'])

export function sanitizePreferences(raw: unknown): CameraPreferences {
  const p = { ...defaultPreferences }
  if (!raw || typeof raw !== 'object') return p
  const r = raw as Record<string, unknown>
  if (typeof r.facing === 'string' && VALID_FACING.has(r.facing)) p.facing = r.facing as never
  if (typeof r.resolution === 'string' && VALID_RESOLUTIONS.has(r.resolution))
    p.resolution = r.resolution as never
  if (typeof r.withAudio === 'boolean') p.withAudio = r.withAudio
  if (typeof r.mirrorPreview === 'boolean') p.mirrorPreview = r.mirrorPreview
  if (typeof r.mirrorOutput === 'boolean') p.mirrorOutput = r.mirrorOutput
  if (typeof r.countdownSeconds === 'number' && VALID_COUNTDOWNS.has(r.countdownSeconds))
    p.countdownSeconds = r.countdownSeconds as never
  if (typeof r.photoFormat === 'string' && VALID_FORMATS.has(r.photoFormat))
    p.photoFormat = r.photoFormat as never
  if (typeof r.photoQuality === 'number' && r.photoQuality >= 0 && r.photoQuality <= 1)
    p.photoQuality = r.photoQuality
  return p
}

function load(): CameraPreferences {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return { ...defaultPreferences }
    return sanitizePreferences(JSON.parse(stored))
  } catch {
    return { ...defaultPreferences }
  }
}

let singleton: CameraPreferences | null = null

export function usePreferences(): CameraPreferences {
  if (singleton) return singleton
  const prefs = reactive<CameraPreferences>(load())
  watch(
    prefs,
    (value) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
      } catch {
        // storage may be unavailable (private mode / disabled) — ignore
      }
    },
    { deep: true },
  )
  singleton = prefs
  return prefs
}

/** Test-only: reset the singleton so each test gets fresh prefs. */
export function __resetPreferencesForTests(): void {
  singleton = null
}
