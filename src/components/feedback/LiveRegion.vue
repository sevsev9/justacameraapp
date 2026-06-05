<script setup lang="ts">
/**
 * Two persistent ARIA live regions, mounted once in the app shell. The
 * announcer composable mutates their text. role=alert is implicitly assertive,
 * so we intentionally do NOT add aria-live=assertive (avoids double-speak on
 * iOS VoiceOver). See docs/browser-support.md (a11y).
 */
import { useAnnouncer } from '@/composables/useAnnouncer'

const { polite, assertive } = useAnnouncer()
</script>

<template>
  <div class="sr-only" role="status" aria-live="polite" aria-atomic="true">{{ polite }}</div>
  <div class="sr-only" role="alert" aria-atomic="true">{{ assertive }}</div>
</template>
