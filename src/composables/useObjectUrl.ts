import { ref, onScopeDispose, type Ref } from 'vue'
import { ObjectUrlRegistry } from '@/utils/object-url'

/**
 * Reactive object-URL holder. Creating a new URL revokes the previous one;
 * the URL is also revoked when the owning scope (component) is disposed.
 *
 * Used for captured-media previews/playback. We deliberately do NOT revoke on
 * the element's `load` event (that breaks right-click-save); revocation happens
 * on replacement or teardown. See docs/privacy-model.md §3.3.
 */
export function useObjectUrl(): {
  url: Ref<string | null>
  set: (blob: Blob | null) => string | null
  clear: () => void
} {
  const registry = new ObjectUrlRegistry()
  const url = ref<string | null>(null)

  function clear() {
    registry.revokeAll()
    url.value = null
  }

  function set(blob: Blob | null): string | null {
    // revoke any previous URL before creating the next
    registry.revokeAll()
    if (!blob) {
      url.value = null
      return null
    }
    const next = registry.create(blob)
    url.value = next
    return next
  }

  onScopeDispose(clear)

  return { url, set, clear }
}
