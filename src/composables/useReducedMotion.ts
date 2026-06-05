import { onScopeDispose, readonly, ref, type Ref } from 'vue'

/**
 * Reactive `prefers-reduced-motion` flag, mirrored in JS so animations driven
 * by script (e.g. the capture flash, pulsing record dot) can be gated and react
 * if the user toggles the OS setting while the app is open.
 */
export function useReducedMotion(): Readonly<Ref<boolean>> {
  const prefersReduced = ref(false)

  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    prefersReduced.value = mql.matches
    const handler = (e: MediaQueryListEvent) => {
      prefersReduced.value = e.matches
    }
    mql.addEventListener('change', handler)
    onScopeDispose(() => mql.removeEventListener('change', handler))
  }

  return readonly(prefersReduced)
}
