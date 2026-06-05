<script setup lang="ts">
import { APP_NAME, REPO_URL } from '@/app/app-meta'
import type { ThemeChoice } from '@/composables/useTheme'
import AppIcon from '@/components/AppIcon.vue'

defineProps<{ theme: ThemeChoice }>()
const emit = defineEmits<{ toggleTheme: []; openPrivacy: [] }>()
</script>

<template>
  <header class="header">
    <div class="header__brand">
      <AppIcon name="camera" :size="22" />
      <span class="header__name">{{ APP_NAME }}</span>
    </div>
    <div class="header__actions">
      <button class="header__badge" type="button" @click="emit('openPrivacy')">
        <AppIcon name="shield" :size="16" />
        <span>Private</span>
      </button>
      <a
        class="icon-btn header__icon"
        :href="REPO_URL"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="View source code (opens in a new tab)"
      >
        <AppIcon name="code" :size="20" />
      </a>
      <button
        class="icon-btn header__icon"
        type="button"
        :aria-label="theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'"
        @click="emit('toggleTheme')"
      >
        <AppIcon :name="theme === 'dark' ? 'sun' : 'moon'" :size="20" />
      </button>
    </div>
  </header>
</template>

<style scoped>
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: calc(var(--safe-top) + var(--space-2)) max(var(--space-4), var(--safe-right))
    var(--space-2) max(var(--space-4), var(--safe-left));
  background: var(--bg-elevated);
  border-block-end: 1px solid var(--border);
}
.header__brand {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--text);
}
.header__name {
  font-weight: 700;
  font-size: var(--text-lg);
}
.header__actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
.header__badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  min-block-size: var(--control-min);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-full);
  border: 1px solid var(--border-strong);
  background: var(--surface);
  color: var(--text);
  font-size: var(--text-sm);
  font-weight: 600;
  cursor: pointer;
}
.header__badge svg {
  color: var(--success);
}
.header__icon {
  inline-size: 40px;
  block-size: 40px;
}
@media (max-width: 480px) {
  .header__badge span {
    display: none;
  }
}
</style>
