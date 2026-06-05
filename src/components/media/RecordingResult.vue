<script setup lang="ts">
/**
 * Recorded-clip preview with local playback + discard / download. Playback uses
 * the in-memory blob object URL; no network request is made.
 */
import { computed } from 'vue'
import { useCameraSession } from '@/composables/useCameraSession'
import { formatBytes, LONG_RECORDING_WARNING_MS } from '@/utils/format-bytes'
import { formatDuration } from '@/utils/duration'
import AppIcon from '@/components/AppIcon.vue'

const s = useCameraSession()
const clip = computed(() => s.pendingRecording.value)
const size = computed(() => (clip.value ? formatBytes(clip.value.blob.size) : ''))
const duration = computed(() => (clip.value ? formatDuration(clip.value.durationMs) : ''))
const formatName = computed(() => s.recordingFormat.value?.label ?? clip.value?.mimeType ?? '')
const isLong = computed(() => (clip.value?.durationMs ?? 0) >= LONG_RECORDING_WARNING_MS)
</script>

<template>
  <div v-if="clip" class="rec-result">
    <video
      class="rec-result__video"
      :src="s.recordingUrl.value ?? ''"
      controls
      playsinline
      aria-label="Recorded clip playback"
    ></video>
    <p class="rec-result__meta">{{ duration }} · {{ formatName }} · {{ size }}</p>
    <p v-if="clip.withAudio === false" class="rec-result__note">
      <AppIcon name="mic-off" :size="16" /> Recorded without microphone audio.
    </p>
    <p v-if="isLong" class="rec-result__note rec-result__note--warn">
      <AppIcon name="alert" :size="16" /> This is a long recording — the file may be large.
    </p>
    <p
      v-if="s.saveOutcome.value === 'saved' || s.saveOutcome.value === 'downloaded'"
      class="rec-result__saved"
      role="status"
    >
      <AppIcon name="check" :size="16" /> Saved to your device.
    </p>
  </div>
</template>

<style scoped>
.rec-result {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.rec-result__video {
  inline-size: 100%;
  max-block-size: 42vh;
  background: #000;
  border-radius: var(--radius-md);
}
.rec-result__meta {
  color: var(--text-muted);
  font-size: var(--text-sm);
}
.rec-result__note {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  color: var(--text-muted);
}
.rec-result__note--warn {
  color: var(--warning);
}
.rec-result__saved {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  color: var(--success);
  font-weight: 600;
}
</style>
