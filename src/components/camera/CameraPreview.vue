<script setup lang="ts">
/**
 * The live preview. Binds the <video> element into the session (the session
 * sets srcObject directly — never a blob URL). Mirroring here affects only the
 * on-screen preview (CSS scaleX); the exported image/video mirror is a separate
 * preference handled in the capture pipeline. See docs/browser-support.md.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useCameraSession } from '@/composables/useCameraSession'

const s = useCameraSession()
const videoRef = ref<HTMLVideoElement | null>(null)

onMounted(() => {
  s.videoEl.value = videoRef.value
})
onBeforeUnmount(() => {
  if (s.videoEl.value === videoRef.value) s.videoEl.value = null
})

const mirrored = computed(() => s.preferences.mirrorPreview)
const switching = computed(() => s.session.value.kind === 'switching-device')
</script>

<template>
  <div class="preview">
    <video
      ref="videoRef"
      class="preview__video"
      :class="{ 'preview__video--mirrored': mirrored }"
      autoplay
      playsinline
      muted
      aria-label="Live camera preview"
    ></video>

    <div v-if="switching" class="preview__overlay" aria-hidden="true">
      <span class="preview__spinner" />
    </div>

    <slot />
  </div>
</template>

<style scoped>
.preview {
  position: relative;
  inline-size: 100%;
  block-size: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #000;
  overflow: hidden;
}
.preview__video {
  inline-size: 100%;
  block-size: 100%;
  object-fit: contain;
}
.preview__video--mirrored {
  transform: scaleX(-1);
}
.preview__overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.4);
}
.preview__spinner {
  inline-size: 36px;
  block-size: 36px;
  border-radius: 50%;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-block-start-color: #fff;
  animation: spin 0.9s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .preview__spinner {
    animation: none;
  }
}
</style>
