import type { CameraFacing, DeviceList, MediaDeviceOption } from '@/types/media'

/**
 * DeviceService — enumerates cameras/microphones and watches for hardware
 * changes. Maps raw MediaDeviceInfo into the app's sanitized device options
 * (deviceId kept for local re-selection only; never exported).
 *
 * Framework-agnostic. See docs/browser-support.md for the enumerate/devicechange
 * caveats this guards against (blank labels pre-permission; spurious Safari
 * events; coalesced Firefox events).
 */
export class DeviceService {
  static isSupported(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices &&
      typeof navigator.mediaDevices.enumerateDevices === 'function'
    )
  }

  async enumerate(): Promise<DeviceList> {
    if (!DeviceService.isSupported()) {
      return { cameras: [], microphones: [], labelsAvailable: false }
    }
    const devices = await navigator.mediaDevices.enumerateDevices()
    const cameras: MediaDeviceOption[] = []
    const microphones: MediaDeviceOption[] = []

    for (const d of devices) {
      if (d.kind === 'videoinput') {
        cameras.push({
          deviceId: d.deviceId,
          kind: 'videoinput',
          label: d.label,
          facing: facingFromLabel(d.label),
        })
      } else if (d.kind === 'audioinput') {
        microphones.push({
          deviceId: d.deviceId,
          kind: 'audioinput',
          label: d.label,
          facing: 'unknown',
        })
      }
    }

    const labelsAvailable = [...cameras, ...microphones].some((d) => d.label.trim().length > 0)
    return { cameras, microphones, labelsAvailable }
  }

  /**
   * Subscribes to devicechange with a trailing debounce. The callback receives a
   * freshly enumerated list (the caller diffs against its cached list). Returns
   * an unsubscribe function.
   */
  onDeviceChange(callback: (devices: DeviceList) => void, debounceMs = 400): () => void {
    if (
      !DeviceService.isSupported() ||
      typeof navigator.mediaDevices.addEventListener !== 'function'
    ) {
      return () => {}
    }
    let timer: ReturnType<typeof setTimeout> | undefined

    const handler = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        void this.enumerate().then(callback)
      }, debounceMs)
    }

    navigator.mediaDevices.addEventListener('devicechange', handler)
    return () => {
      if (timer) clearTimeout(timer)
      navigator.mediaDevices.removeEventListener('devicechange', handler)
    }
  }
}

/** Derives a best-effort facing from a device label. */
export function facingFromLabel(label: string): CameraFacing {
  const l = label.toLowerCase()
  if (/(back|rear|environment|world)/.test(l)) return 'environment'
  if (/(front|face|user|selfie)/.test(l)) return 'user'
  return 'unknown'
}

/**
 * Builds a human-friendly display name for a camera. Browsers (especially
 * Android Chrome) expose raw labels like "camera 2, facing back" with
 * non-sequential numbers and multiple same-facing entries, which are confusing.
 * We show "Front camera" / "Back camera" (numbered only when more than one share
 * a facing), but keep a real, meaningful label for named devices (e.g. a USB
 * webcam) whose facing is unknown. Pure and independently unit-tested.
 */
export function cameraDisplayName(camera: MediaDeviceOption, cameras: MediaDeviceOption[]): string {
  if (camera.facing === 'user' || camera.facing === 'environment') {
    const base = camera.facing === 'user' ? 'Front camera' : 'Back camera'
    const sameFacing = cameras.filter((c) => c.facing === camera.facing)
    if (sameFacing.length <= 1) return base
    const position = sameFacing.findIndex((c) => c.deviceId === camera.deviceId) + 1
    return `${base} ${position}`
  }
  // Unknown facing: prefer a real label (named USB webcams), else a stable index.
  const label = camera.label.trim()
  if (label) return label
  const index = cameras.findIndex((c) => c.deviceId === camera.deviceId) + 1
  return `Camera ${index}`
}

/**
 * Picks the camera to switch to when the user taps "flip". Toggles facing
 * (front ↔ rear) rather than cycling by index — important on phones (e.g. Galaxy
 * S26 Ultra) that expose several logical cameras of the same facing, where a
 * naive next-index cycle can land on another front camera and appear to do
 * nothing. Falls back to the next camera by index when facing is unknown.
 */
export function pickFlipTarget(
  cameras: MediaDeviceOption[],
  currentDeviceId: string | null,
  currentFacing: CameraFacing,
): MediaDeviceOption | undefined {
  if (cameras.length < 2) return undefined
  const target: CameraFacing = currentFacing === 'environment' ? 'user' : 'environment'
  const opposite = cameras.find((c) => c.facing === target && c.deviceId !== currentDeviceId)
  if (opposite) return opposite
  const idx = cameras.findIndex((c) => c.deviceId === currentDeviceId)
  return cameras[(idx + 1) % cameras.length]
}

/**
 * Diffs two device lists by deviceId, returning whether the set of cameras or
 * microphones changed (used to decide whether a devicechange is meaningful).
 */
export function devicesChanged(a: DeviceList, b: DeviceList): boolean {
  const ids = (list: MediaDeviceOption[]) =>
    list
      .map((d) => d.deviceId)
      .sort()
      .join('|')
  return ids(a.cameras) !== ids(b.cameras) || ids(a.microphones) !== ids(b.microphones)
}
