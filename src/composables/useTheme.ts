import { onMounted, ref, type Ref } from 'vue'

/**
 * Light/dark theme with a system default. The explicit choice is persisted and
 * applied as `data-theme` on <html>; with no choice, the OS preference (via the
 * CSS media query in tokens.css) wins.
 */
const STORAGE_KEY = 'jca:theme:v1'
export type ThemeChoice = 'light' | 'dark'

export function useTheme(): { theme: Ref<ThemeChoice>; toggle: () => void } {
  const theme = ref<ThemeChoice>('light')

  function systemPrefersDark(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    )
  }

  function apply(value: ThemeChoice) {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', value)
    }
  }

  onMounted(() => {
    let stored: string | null
    try {
      stored = localStorage.getItem(STORAGE_KEY)
    } catch {
      stored = null
    }
    theme.value =
      stored === 'light' || stored === 'dark' ? stored : systemPrefersDark() ? 'dark' : 'light'
    apply(theme.value)
  })

  function toggle() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
    apply(theme.value)
    try {
      localStorage.setItem(STORAGE_KEY, theme.value)
    } catch {
      // ignore
    }
  }

  return { theme, toggle }
}
