<script setup lang="ts">
/**
 * The pre-camera screen. Handles the welcome (idle/stopped), the
 * requesting-permission loading state, and every terminal error state
 * (permission-denied / no-device / unsupported / constraint-failed / error)
 * with a clear message, recovery hint, and retry. Never auto-requests the camera.
 */
import { computed } from 'vue'
import { useCameraSession } from '@/composables/useCameraSession'
import { APP_NAME, REPO_URL, AUTHOR_URL } from '@/app/app-meta'
import { isSessionError } from '@/features/camera/session-machine'
import AppIcon from '@/components/AppIcon.vue'

const emit = defineEmits<{ openPrivacy: []; openSupport: [] }>()
const s = useCameraSession()

const isRequesting = computed(() => s.session.value.kind === 'requesting-permission')
const errorState = computed(() => (isSessionError(s.session.value) ? s.session.value : null))
const errorInfo = computed(() => {
  const st = errorState.value
  if (st && 'error' in st) return st.error
  return null
})

const errorIcon = computed(() => {
  const st = errorState.value
  if (!st) return 'alert'
  if (st.kind === 'unsupported') return 'info'
  return 'alert'
})
</script>

<template>
  <section class="onboarding" aria-labelledby="onboarding-title">
    <!-- Error states -->
    <div v-if="errorInfo" class="card onboarding__card onboarding__card--error" role="group">
      <AppIcon :name="errorIcon" :size="40" class="onboarding__icon onboarding__icon--error" />
      <h1 id="onboarding-title" class="onboarding__title">{{ errorInfo.message }}</h1>
      <p class="onboarding__lead">{{ errorInfo.recovery }}</p>
      <div class="onboarding__actions">
        <button
          class="btn btn--primary btn--lg"
          type="button"
          :disabled="isRequesting"
          @click="s.start()"
        >
          <AppIcon name="retry" :size="20" /> Try again
        </button>
        <button class="btn btn--ghost" type="button" @click="emit('openSupport')">
          Browser compatibility
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-else-if="isRequesting" class="card onboarding__card" aria-live="polite">
      <div class="onboarding__spinner" aria-hidden="true" />
      <h1 id="onboarding-title" class="onboarding__title">Waiting for camera permission…</h1>
      <p class="onboarding__lead">
        Your browser is asking whether to allow camera and microphone access. Choose
        <strong>Allow</strong> to continue. Nothing is uploaded.
      </p>
    </div>

    <!-- Welcome -->
    <div v-else class="card onboarding__card">
      <AppIcon name="camera" :size="44" class="onboarding__icon" />
      <h1 id="onboarding-title" class="onboarding__title">{{ APP_NAME }}</h1>
      <p class="onboarding__tagline">Simple · Local · Open Source · Secure</p>

      <p class="onboarding__lead">
        Made it because I needed it, open-sourced it so everyone else can use it.
      </p>

      <p class="onboarding__secure">
        <AppIcon name="shield" :size="18" />
        <span>
          Secure by design — everything stays local.
          <a :href="REPO_URL" target="_blank" rel="noopener noreferrer">Check out the repository</a>
          and read the code yourself.
        </span>
      </p>

      <div class="onboarding__actions">
        <button class="btn btn--primary btn--lg" type="button" @click="s.start()">
          <AppIcon name="camera" :size="20" /> Start camera
        </button>
      </div>

      <p class="onboarding__why">
        <a :href="AUTHOR_URL" target="_blank" rel="noopener noreferrer">Hit me up</a>
        or
        <a :href="REPO_URL" target="_blank" rel="noopener noreferrer">create a PR</a>
        if you want additional features.
      </p>
      <nav class="onboarding__links" aria-label="More information">
        <button class="linklike" type="button" @click="emit('openPrivacy')">
          How privacy works
        </button>
      </nav>
    </div>
  </section>
</template>

<style scoped>
.onboarding {
  flex: 1;
  display: grid;
  place-items: center;
  padding: var(--space-5) var(--space-4);
  padding-block-end: calc(var(--space-5) + var(--safe-bottom));
}
.onboarding__card {
  inline-size: min(560px, 100%);
  padding: var(--space-6);
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
}
.onboarding__icon {
  color: var(--accent);
}
.onboarding__icon--error {
  color: var(--danger);
}
.onboarding__title {
  font-size: var(--text-2xl);
  line-height: var(--leading-tight);
}
.onboarding__tagline {
  font-size: var(--text-lg);
  font-weight: 650;
  letter-spacing: 0.01em;
  color: var(--text);
}
.onboarding__lead {
  color: var(--text-muted);
  max-inline-size: 44ch;
}
.onboarding__secure {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  text-align: start;
  color: var(--text-muted);
  /* Bordered (not filled) so the inline link sits on the card surface, where the
     accent colour meets 4.5:1 contrast (it falls to ~4.06:1 on --surface-2). */
  border: 1px solid var(--border);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-md);
  max-inline-size: 46ch;
}
.onboarding__secure svg {
  color: var(--success);
  flex: none;
  margin-block-start: 2px;
}
.onboarding__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  justify-content: center;
  margin-block-start: var(--space-2);
}
.onboarding__why {
  font-size: var(--text-sm);
  color: var(--text-faint);
  max-inline-size: 46ch;
}
.onboarding__links {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4);
  justify-content: center;
  margin-block-start: var(--space-2);
}
.linklike {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  background: none;
  border: none;
  color: var(--accent);
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
  font-size: var(--text-sm);
  padding: var(--space-1);
}
.linklike:hover {
  color: var(--accent-hover);
}
.onboarding__spinner {
  inline-size: 40px;
  block-size: 40px;
  border-radius: 50%;
  border: 3px solid var(--surface-3);
  border-block-start-color: var(--accent);
  animation: spin 0.9s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .onboarding__spinner {
    animation: none;
    border-block-start-color: var(--accent);
  }
}
</style>
