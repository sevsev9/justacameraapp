<script setup lang="ts">
/**
 * Captured-photo preview (body of the Photo dialog). The <img> shows the actual
 * saved bytes (NOT CSS-mirrored), so the user sees exactly what will be
 * downloaded — which is why we explain when the saved image differs from the
 * mirrored on-screen preview. The Retake/Discard/Download actions live in the
 * dialog footer (App.vue) so they never overlap this scrollable content.
 */
import { computed } from 'vue'
import { useCameraSession } from '@/composables/useCameraSession'
import { formatBytes } from '@/utils/format-bytes'
import AppIcon from '@/components/AppIcon.vue'

const s = useCameraSession()
const photo = computed(() => s.pendingPhoto.value)
const size = computed(() => (photo.value ? formatBytes(photo.value.blob.size) : ''))
const formatName = computed(() => photo.value?.format.replace('image/', '').toUpperCase() ?? '')

const mirrorNote = computed(() => {
  if (!s.preferences.mirrorPreview) return null
  return s.preferences.mirrorOutput
    ? 'Saved image is mirrored to match the preview.'
    : 'Saved image is not mirrored (it shows what others see), so it may look flipped versus the preview.'
})
</script>

<template>
  <div v-if="photo" class="photo-result">
    <div class="photo-result__frame">
      <img :src="s.photoUrl.value ?? ''" alt="Captured photo preview" class="photo-result__img" />
    </div>
    <p class="photo-result__meta">
      <template v-if="photo.width > 0 && photo.height > 0">
        {{ photo.width }}×{{ photo.height }} ·
      </template>
      {{ formatName }} · {{ size }} ·
      <span class="photo-result__method">{{
        photo.method === 'image-capture' ? 'full-resolution' : 'frame capture'
      }}</span>
    </p>
    <p v-if="mirrorNote" class="photo-result__note">
      <AppIcon name="info" :size="16" /> {{ mirrorNote }}
    </p>
    <p
      v-if="s.saveOutcome.value === 'saved' || s.saveOutcome.value === 'downloaded'"
      class="photo-result__saved"
      role="status"
    >
      <AppIcon name="check" :size="16" /> Saved to your device.
    </p>
  </div>
</template>

<style scoped>
.photo-result {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.photo-result__frame {
  background: #000;
  border-radius: var(--radius-md);
  overflow: hidden;
  display: grid;
  place-items: center;
  max-block-size: 42vh;
}
.photo-result__img {
  max-inline-size: 100%;
  max-block-size: 42vh;
  object-fit: contain;
}
.photo-result__meta {
  color: var(--text-muted);
  font-size: var(--text-sm);
}
.photo-result__note {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  font-size: var(--text-sm);
  color: var(--text-muted);
  background: var(--surface-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
}
.photo-result__note svg {
  flex: none;
  margin-block-start: 2px;
}
.photo-result__saved {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--success);
  font-weight: 600;
}
</style>
