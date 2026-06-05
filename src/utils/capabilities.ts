import type {
  AdvancedControlDescriptor,
  AdvancedControlId,
  AdvancedControlType,
} from '@/types/media'

/**
 * Capability normalization — turns a raw `MediaStreamTrack.getCapabilities()`
 * result (a loosely-typed, partly non-standard object) into a list of typed
 * {@link AdvancedControlDescriptor}s the UI can render. Isolated and
 * independently unit-tested.
 *
 * Per docs/browser-support.md, advanced photographic controls are essentially
 * Chromium-Android-only; on Firefox/Safari/desktop most are absent. So every
 * control is gated on presence in `caps` — unsupported controls are returned
 * with `supported: false` so the UI can hide/disable them with an explanation
 * rather than break.
 */

interface ControlDef {
  id: AdvancedControlId
  label: string
  type: AdvancedControlType
  /** Capability key in getCapabilities() output. */
  capKey: string
  /** Settings key in getSettings() output (defaults to capKey). */
  settingsKey?: string
}

export const ADVANCED_CONTROL_DEFS: readonly ControlDef[] = [
  { id: 'zoom', label: 'Zoom', type: 'range', capKey: 'zoom' },
  { id: 'torch', label: 'Torch (flashlight)', type: 'toggle', capKey: 'torch' },
  { id: 'focusMode', label: 'Focus mode', type: 'enum', capKey: 'focusMode' },
  { id: 'focusDistance', label: 'Focus distance', type: 'range', capKey: 'focusDistance' },
  { id: 'exposureMode', label: 'Exposure mode', type: 'enum', capKey: 'exposureMode' },
  {
    id: 'exposureCompensation',
    label: 'Exposure compensation',
    type: 'range',
    capKey: 'exposureCompensation',
  },
  { id: 'whiteBalanceMode', label: 'White balance', type: 'enum', capKey: 'whiteBalanceMode' },
  { id: 'brightness', label: 'Brightness', type: 'range', capKey: 'brightness' },
  { id: 'contrast', label: 'Contrast', type: 'range', capKey: 'contrast' },
  { id: 'saturation', label: 'Saturation', type: 'range', capKey: 'saturation' },
  { id: 'sharpness', label: 'Sharpness', type: 'range', capKey: 'sharpness' },
  { id: 'colorTemperature', label: 'Color temperature', type: 'range', capKey: 'colorTemperature' },
] as const

// Loose shapes — getCapabilities/getSettings include many non-standard members.
type LooseCapabilities = Record<string, unknown>
type LooseSettings = Record<string, unknown>

/**
 * Builds descriptors for all known advanced controls, marking each supported or
 * not based on the track's capabilities. Returns ALL controls (the caller
 * decides whether to render unsupported ones disabled or hide them).
 */
export function buildAdvancedControls(
  capabilities: LooseCapabilities | undefined,
  settings: LooseSettings | undefined,
): AdvancedControlDescriptor[] {
  const caps = capabilities ?? {}
  const set = settings ?? {}

  return ADVANCED_CONTROL_DEFS.map((def) => {
    const capValue = caps[def.capKey]
    const supported = def.capKey in caps && capValue != null
    const settingsKey = def.settingsKey ?? def.capKey
    const currentValue = set[settingsKey]

    const descriptor: AdvancedControlDescriptor = {
      id: def.id,
      label: def.label,
      type: def.type,
      supported,
    }

    if (!supported) return descriptor

    if (def.type === 'range' && isRange(capValue)) {
      descriptor.min = capValue.min
      descriptor.max = capValue.max
      if (typeof capValue.step === 'number') descriptor.step = capValue.step
      if (typeof currentValue === 'number') descriptor.value = currentValue
    } else if (def.type === 'toggle') {
      // torch capability is typically [true] or [false,true]
      descriptor.value = typeof currentValue === 'boolean' ? currentValue : false
    } else if (def.type === 'enum' && Array.isArray(capValue)) {
      descriptor.options = capValue.filter((v): v is string => typeof v === 'string')
      if (typeof currentValue === 'string') descriptor.value = currentValue
    }

    return descriptor
  })
}

/** Returns only the controls the active track actually supports. */
export function supportedAdvancedControls(
  capabilities: LooseCapabilities | undefined,
  settings: LooseSettings | undefined,
): AdvancedControlDescriptor[] {
  return buildAdvancedControls(capabilities, settings).filter((c) => c.supported)
}

interface RangeCap {
  min: number
  max: number
  step?: number
}

function isRange(value: unknown): value is RangeCap {
  return (
    !!value &&
    typeof value === 'object' &&
    'min' in value &&
    'max' in value &&
    typeof (value as RangeCap).min === 'number' &&
    typeof (value as RangeCap).max === 'number'
  )
}

/** Safely reads getCapabilities() (may be undefined on older browsers). */
export function readCapabilities(
  track: MediaStreamTrack | undefined,
): LooseCapabilities | undefined {
  if (!track || typeof track.getCapabilities !== 'function') return undefined
  try {
    return track.getCapabilities() as LooseCapabilities
  } catch {
    return undefined
  }
}

/** Safely reads getSettings(). */
export function readSettings(track: MediaStreamTrack | undefined): LooseSettings | undefined {
  if (!track || typeof track.getSettings !== 'function') return undefined
  try {
    return track.getSettings() as LooseSettings
  } catch {
    return undefined
  }
}
