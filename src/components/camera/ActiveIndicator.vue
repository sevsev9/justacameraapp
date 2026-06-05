<script setup lang="ts">
/**
 * Persistent "camera/mic active" indicator overlaid on the preview. Never relies
 * on color alone — uses icons + text. Shows the recording timer + chosen format
 * while recording (with a non-color-coded REC label and a pulsing dot that
 * respects reduced motion).
 */
import { computed } from 'vue'
import { useCameraSession } from '@/composables/useCameraSession'
import { formatDuration } from '@/utils/duration'
import AppIcon from '@/components/AppIcon.vue'

const s = useCameraSession()

const recordingLabel = computed(() => {
  if (s.isRecording.value) return 'Recording'
  if (s.isPaused.value) return 'Recording paused'
  return ''
})
const elapsed = computed(() => formatDuration(s.elapsedMs.value))
const format = computed(() => s.recordingFormat.value?.label ?? '')
</script>

<template>
  <div class="indicator" aria-hidden="false">
    <span class="indicator__chip">
      <AppIcon name="camera" :size="16" />
      <span>Camera on</span>
    </span>
    <span v-if="s.hasAudioTrack.value" class="indicator__chip">
      <AppIcon name="mic" :size="16" />
      <span>Mic on</span>
    </span>
    <span v-else class="indicator__chip indicator__chip--muted">
      <AppIcon name="mic-off" :size="16" />
      <span>Mic off</span>
    </span>

    <span
      v-if="s.isRecording.value || s.isPaused.value"
      class="indicator__chip indicator__chip--rec"
      :class="{ 'indicator__chip--paused': s.isPaused.value }"
    >
      <span class="indicator__dot" :class="{ 'indicator__dot--pulse': s.isRecording.value }" />
      <span class="indicator__rec-label">{{ recordingLabel }}</span>
      <span class="indicator__time">{{ elapsed }}</span>
      <span v-if="format" class="indicator__fmt">· {{ format }}</span>
    </span>
  </div>
</template>

<style scoped>
.indicator {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
}
.indicator__chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-full);
  background: rgba(0, 0, 0, 0.62);
  color: #fff;
  font-size: var(--text-sm);
  font-weight: 600;
  line-height: 1.4;
  border: 1px solid rgba(255, 255, 255, 0.18);
}
.indicator__chip--muted {
  color: #d6dae2;
}
.indicator__chip--rec {
  background: var(--recording);
  color: #fff;
  border-color: rgba(255, 255, 255, 0.5);
}
.indicator__chip--paused {
  background: #5a5f6b;
}
.indicator__dot {
  inline-size: 10px;
  block-size: 10px;
  border-radius: 50%;
  background: #fff;
}
.indicator__dot--pulse {
  animation: pulse 1.2s ease-in-out infinite;
}
.indicator__time {
  font-variant-numeric: tabular-nums;
}
.indicator__fmt {
  font-weight: 500;
  opacity: 0.9;
}
@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.35;
  }
}
@media (prefers-reduced-motion: reduce) {
  .indicator__dot--pulse {
    animation: none;
  }
}
</style>
