<script setup lang="ts">
/**
 * Camera workspace: the preview with overlaid active indicator, countdown,
 * capture flash, and the bottom control bar (over a legibility scrim).
 */
import { computed, ref, watch } from 'vue'
import { useCameraSession } from '@/composables/useCameraSession'
import { useReducedMotion } from '@/composables/useReducedMotion'
import CameraPreview from './CameraPreview.vue'
import ActiveIndicator from './ActiveIndicator.vue'
import CaptureControls from './CaptureControls.vue'
import AppIcon from '@/components/AppIcon.vue'

const emit = defineEmits<{ openSettings: [] }>()
const s = useCameraSession()
const reduced = useReducedMotion()

const countdown = computed(() =>
  s.capture.value.kind === 'counting-down' ? s.capture.value.remaining : null,
)
const flash = ref(false)

watch(
  () => s.capture.value.kind,
  (kind) => {
    if (kind === 'capturing-photo' && !reduced.value) {
      flash.value = true
      setTimeout(() => (flash.value = false), 180)
    }
  },
)
</script>

<template>
  <section class="stage" aria-label="Camera workspace">
    <CameraPreview>
      <div class="stage__top">
        <ActiveIndicator />
        <p v-if="s.audioFellBack.value" class="stage__warn" role="note">
          <AppIcon name="mic-off" :size="16" /> No microphone found — recording video only.
        </p>
      </div>

      <div v-if="countdown !== null" class="stage__countdown" aria-hidden="true">
        <span class="stage__countdown-num">{{ countdown === 0 ? '' : countdown }}</span>
      </div>

      <div v-if="flash" class="stage__flash" aria-hidden="true" />

      <div class="stage__bottom">
        <CaptureControls @open-settings="emit('openSettings')" />
      </div>
    </CameraPreview>
  </section>
</template>

<style scoped>
.stage {
  flex: 1;
  min-block-size: 0;
  display: flex;
}
.stage__top {
  position: absolute;
  inset-block-start: calc(var(--safe-top) + var(--space-3));
  inset-inline: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  align-items: flex-start;
  pointer-events: none;
}
.stage__warn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  /* High-contrast scrim (white on near-black ≈ 18:1) instead of dark-on-amber,
     with an amber icon as the non-color-dependent warning cue. */
  background: rgba(0, 0, 0, 0.78);
  color: #fff;
  border: 1px solid var(--warning);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-full);
  font-size: var(--text-sm);
  font-weight: 600;
}
.stage__warn svg {
  color: var(--warning);
  flex: none;
}
.stage__countdown {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
}
.stage__countdown-num {
  font-size: clamp(4rem, 22vmin, 9rem);
  font-weight: 800;
  color: #fff;
  text-shadow: 0 2px 24px rgba(0, 0, 0, 0.7);
  font-variant-numeric: tabular-nums;
}
.stage__flash {
  position: absolute;
  inset: 0;
  background: #fff;
  animation: flash 180ms ease-out;
}
@keyframes flash {
  from {
    opacity: 0.9;
  }
  to {
    opacity: 0;
  }
}
.stage__bottom {
  position: absolute;
  inset-inline: 0;
  inset-block-end: 0;
  padding-block-end: var(--safe-bottom);
  background: linear-gradient(to top, rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0));
}
/*
 * On touch devices, guarantee the controls clear the system navigation bar.
 * Android 3-button navigation does NOT report env(safe-area-inset-bottom) under
 * viewport-fit=cover, so --safe-bottom is 0 and the controls would sit under the
 * nav keys. Floor the clearance at ~3rem (covers a 48dp button nav); max() still
 * honors larger insets from gesture nav / the iOS home indicator.
 */
@media (pointer: coarse) {
  .stage__bottom {
    padding-block-end: max(var(--safe-bottom), 3rem);
  }
}
</style>
