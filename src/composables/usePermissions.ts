import { ref, type Ref } from 'vue'
import type { PermissionStateValue } from '@/services/diagnostics-service'

/**
 * Best-effort camera/microphone permission state via the Permissions API.
 * Not all browsers support querying `camera`/`microphone` (Firefox notably), so
 * unknown is a normal result and never blocks the flow. Read-only / diagnostic.
 */
export function usePermissions(): {
  camera: Ref<PermissionStateValue>
  microphone: Ref<PermissionStateValue>
  refresh: () => Promise<void>
} {
  const camera = ref<PermissionStateValue>('unknown')
  const microphone = ref<PermissionStateValue>('unknown')

  async function query(name: 'camera' | 'microphone'): Promise<PermissionStateValue> {
    try {
      if (typeof navigator === 'undefined' || !navigator.permissions?.query) return 'unknown'
      // `camera`/`microphone` aren't in the standard PermissionName union everywhere.
      const status = await navigator.permissions.query({
        name: name as PermissionName,
      })
      const state = status.state
      return state === 'granted' || state === 'denied' || state === 'prompt' ? state : 'unknown'
    } catch {
      return 'unknown'
    }
  }

  async function refresh(): Promise<void> {
    camera.value = await query('camera')
    microphone.value = await query('microphone')
  }

  return { camera, microphone, refresh }
}
