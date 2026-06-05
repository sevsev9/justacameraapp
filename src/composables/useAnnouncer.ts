import { inject, ref, type InjectionKey, type Ref } from 'vue'

/**
 * Screen-reader announcer backed by two persistent ARIA live regions (rendered
 * once in the app shell): a polite `role=status` region for milestones and an
 * assertive `role=alert` region for errors. See docs/browser-support.md (a11y).
 *
 * The regions must already exist in the DOM; we only mutate their text. To make
 * an identical repeated message re-announce, we clear then re-set on a tick.
 */
export type Urgency = 'polite' | 'assertive'

export interface Announcer {
  polite: Ref<string>
  assertive: Ref<string>
  announce: (message: string, urgency?: Urgency) => void
}

export const announcerKey: InjectionKey<Announcer> = Symbol('jca-announcer')

export function createAnnouncer(): Announcer {
  const polite = ref('')
  const assertive = ref('')

  function announce(message: string, urgency: Urgency = 'polite') {
    const target = urgency === 'assertive' ? assertive : polite
    // Clear first so AT re-announces identical consecutive messages.
    target.value = ''
    // Microtask/timeout to register the change as a new content mutation.
    setTimeout(() => {
      target.value = message
    }, 30)
  }

  return { polite, assertive, announce }
}

const noopAnnouncer: Announcer = {
  polite: ref(''),
  assertive: ref(''),
  announce: () => {},
}

export function useAnnouncer(): Announcer {
  return inject(announcerKey, noopAnnouncer)
}
