<script setup lang="ts">
import { computed, onMounted, provide, ref } from 'vue'
import { announcerKey, createAnnouncer } from '@/composables/useAnnouncer'
import { provideCameraSession } from '@/composables/useCameraSession'
import { useTheme } from '@/composables/useTheme'
import { APP_NAME, PRIVACY_PROMISE, REPO_URL } from '@/app/app-meta'
import AppHeader from '@/components/layout/AppHeader.vue'
import LiveRegion from '@/components/feedback/LiveRegion.vue'
import OnboardingScreen from '@/components/camera/OnboardingScreen.vue'
import CameraStage from '@/components/camera/CameraStage.vue'
import AppDialog from '@/components/feedback/AppDialog.vue'
import SettingsPanel from '@/components/settings/SettingsPanel.vue'
import PhotoResult from '@/components/media/PhotoResult.vue'
import RecordingResult from '@/components/media/RecordingResult.vue'
import AppIcon from '@/components/AppIcon.vue'

// Provide the announcer before the session (the session injects it).
const announcer = createAnnouncer()
provide(announcerKey, announcer)
const s = provideCameraSession()
const { theme, toggle } = useTheme()

const showSettings = ref(false)
const showPrivacy = ref(false)
const showSupport = ref(false)
const showPhoto = computed({
  get: () => s.pendingPhoto.value !== null,
  set: (v) => {
    if (!v) s.discardPhoto()
  },
})
const showRecording = computed({
  get: () => s.pendingRecording.value !== null,
  set: (v) => {
    if (!v) s.discardRecording()
  },
})

function retakePhoto() {
  s.discardPhoto()
  void s.capturePhoto()
}

onMounted(() => s.init())
</script>

<template>
  <a class="skip-link" href="#main">Skip to camera</a>
  <LiveRegion />

  <AppHeader :theme="theme" @toggle-theme="toggle" @open-privacy="showPrivacy = true" />

  <main id="main" class="main" :class="{ 'main--active': s.isActive.value }">
    <CameraStage v-if="s.isActive.value" @open-settings="showSettings = true" />
    <OnboardingScreen
      v-else
      @open-privacy="showPrivacy = true"
      @open-support="showSupport = true"
    />
  </main>

  <!-- Settings / devices / advanced / diagnostics -->
  <AppDialog :open="showSettings" title="Settings & diagnostics" @close="showSettings = false">
    <SettingsPanel v-if="showSettings" />
  </AppDialog>

  <!-- Captured photo -->
  <AppDialog :open="showPhoto" title="Photo" @close="showPhoto = false">
    <PhotoResult />
    <template #footer>
      <button class="btn btn--ghost" type="button" @click="retakePhoto">
        <AppIcon name="retry" :size="18" /> Retake
      </button>
      <button class="btn btn--ghost" type="button" @click="s.discardPhoto()">
        <AppIcon name="trash" :size="18" /> Discard
      </button>
      <button class="btn btn--primary" type="button" @click="s.downloadPhoto()">
        <AppIcon name="download" :size="18" /> Download
      </button>
    </template>
  </AppDialog>

  <!-- Recorded clip -->
  <AppDialog :open="showRecording" title="Recording" @close="showRecording = false">
    <RecordingResult />
    <template #footer>
      <button class="btn btn--ghost" type="button" @click="s.discardRecording()">
        <AppIcon name="trash" :size="18" /> Discard
      </button>
      <button class="btn btn--primary" type="button" @click="s.downloadRecording()">
        <AppIcon name="download" :size="18" /> Download
      </button>
    </template>
  </AppDialog>

  <!-- How privacy works -->
  <AppDialog :open="showPrivacy" title="How privacy works" @close="showPrivacy = false">
    <div class="prose">
      <p class="prose__lead"><AppIcon name="shield" :size="18" /> {{ PRIVACY_PROMISE }}</p>
      <ul>
        <li>
          <strong>No upload.</strong> {{ APP_NAME }} has no backend. Your camera feed, photos, video
          and audio are processed entirely in this browser tab.
        </li>
        <li>
          <strong>No account, no tracking.</strong> There are no accounts, cookies, analytics, or
          third-party scripts.
        </li>
        <li>
          <strong>Explicit permission.</strong> The camera is requested only when you press “Start
          camera”, never on page load.
        </li>
        <li>
          <strong>Discarded by default.</strong> Captures live only in memory until you download
          them. Refreshing or closing the tab discards everything.
        </li>
        <li>
          <strong>Identifiers stay local.</strong> Device IDs and labels are used only to pick a
          camera and are stripped from the diagnostic report.
        </li>
        <li>
          <strong>Auditable.</strong> The full source is public so you can verify all of the above.
        </li>
      </ul>
      <p>
        <a :href="REPO_URL" target="_blank" rel="noopener noreferrer">
          <AppIcon name="code" :size="16" /> Read the source code
        </a>
      </p>
    </div>
  </AppDialog>

  <!-- Browser compatibility -->
  <AppDialog :open="showSupport" title="Browser compatibility" @close="showSupport = false">
    <div class="prose">
      <p>
        {{ APP_NAME }} works in current versions of Chrome, Edge, Firefox, and Safari (including
        iOS), over HTTPS.
      </p>
      <ul>
        <li><strong>Photos</strong> work everywhere (a canvas fallback is always available).</li>
        <li>
          <strong>Video recording</strong> uses the best format your browser supports (MP4 or WebM),
          detected at runtime.
        </li>
        <li>
          <strong>Advanced controls</strong> like zoom, torch and focus appear only when your camera
          and browser expose them — most often on Android Chrome.
        </li>
        <li>
          <strong>Camera access requires HTTPS</strong> (or localhost). Over plain HTTP the camera
          is unavailable.
        </li>
      </ul>
      <p class="prose__muted">
        If the camera is in use by another app or browser tab, close that first, then try again.
      </p>
    </div>
  </AppDialog>
</template>

<style scoped>
.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-block-size: 0;
}
.main--active {
  background: #000;
}
.prose {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  line-height: var(--leading-normal);
}
.prose__lead {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-weight: 600;
}
.prose__lead svg {
  color: var(--success);
  flex: none;
}
.prose ul {
  margin: 0;
  padding-inline-start: var(--space-5);
  display: grid;
  gap: var(--space-2);
}
.prose__muted {
  color: var(--text-muted);
  font-size: var(--text-sm);
}
</style>
