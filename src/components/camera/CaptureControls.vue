<script setup lang="ts">
/**
 * The primary capture control bar. Photo shutter + video record/pause/stop +
 * switch-camera + stop-camera + settings. Controls are disabled (with reasons)
 * when not applicable; switching the camera is blocked while recording.
 */
import { computed } from 'vue'
import { useCameraSession } from '@/composables/useCameraSession'
import { pickFlipTarget } from '@/services/device-service'
import type { CameraFacing } from '@/types/media'
import AppIcon from '@/components/AppIcon.vue'

const emit = defineEmits<{ openSettings: [] }>()
const s = useCameraSession()

const canSwitch = computed(
  () =>
    s.devices.value.cameras.length > 1 &&
    s.isPreviewing.value &&
    !s.isRecording.value &&
    !s.isPaused.value,
)
const countdownActive = computed(() => s.capture.value.kind === 'counting-down')
const recordingOrPaused = computed(() => s.isRecording.value || s.isPaused.value)
const photoDisabled = computed(
  () => !s.isPreviewing.value || recordingOrPaused.value || countdownActive.value,
)

function nextCamera() {
  const cams = s.devices.value.cameras
  // Prefer the live facingMode from the active track; fall back to the label.
  const settingsFacing = s.videoSettings.value?.facingMode
  const currentFacing: CameraFacing =
    settingsFacing === 'user' || settingsFacing === 'environment'
      ? settingsFacing
      : (cams.find((c) => c.deviceId === s.selectedCameraId.value)?.facing ?? 'user')
  const target = pickFlipTarget(cams, s.selectedCameraId.value, currentFacing)
  if (target) void s.switchCamera(target.deviceId)
}
</script>

<template>
  <div class="controls" role="group" aria-label="Capture controls">
    <!-- Left cluster -->
    <div class="controls__cluster">
      <button
        class="icon-btn controls__secondary"
        type="button"
        :disabled="!canSwitch"
        :title="canSwitch ? 'Switch camera' : 'Switching is unavailable'"
        aria-label="Switch camera"
        @click="nextCamera"
      >
        <AppIcon name="flip" :size="22" />
      </button>
    </div>

    <!-- Center cluster: shutter + record -->
    <div class="controls__cluster controls__cluster--center">
      <button
        v-if="!recordingOrPaused"
        class="shutter"
        type="button"
        :disabled="photoDisabled"
        aria-label="Take photo"
        @click="s.capturePhoto()"
      >
        <AppIcon name="shutter" :size="40" />
      </button>

      <button
        v-if="!recordingOrPaused && !countdownActive"
        class="rec-btn"
        type="button"
        :disabled="!s.isPreviewing.value || !s.recordingSupported.value"
        :title="
          s.recordingSupported.value
            ? 'Start recording'
            : 'Recording is not supported in this browser'
        "
        aria-label="Start recording"
        @click="s.startRecording()"
      >
        <AppIcon name="record" :size="26" />
        <span>Record</span>
      </button>

      <button
        v-if="countdownActive"
        class="btn btn--ghost"
        type="button"
        aria-label="Cancel countdown"
        @click="s.cancelCountdown()"
      >
        Cancel
      </button>

      <template v-if="recordingOrPaused">
        <button
          v-if="s.isRecording.value"
          class="icon-btn controls__secondary"
          type="button"
          aria-label="Pause recording"
          @click="s.pauseRecording()"
        >
          <AppIcon name="pause" :size="22" />
        </button>
        <button
          v-else
          class="icon-btn controls__secondary"
          type="button"
          aria-label="Resume recording"
          @click="s.resumeRecording()"
        >
          <AppIcon name="play" :size="22" />
        </button>
        <button
          class="rec-btn rec-btn--stop"
          type="button"
          aria-label="Stop recording"
          @click="s.stopRecording()"
        >
          <AppIcon name="stop" :size="22" />
          <span>Stop</span>
        </button>
      </template>
    </div>

    <!-- Right cluster -->
    <div class="controls__cluster controls__cluster--end">
      <button
        class="icon-btn controls__secondary"
        type="button"
        aria-label="Open settings and diagnostics"
        @click="emit('openSettings')"
      >
        <AppIcon name="settings" :size="22" />
      </button>
      <button
        class="icon-btn controls__secondary controls__stop"
        type="button"
        aria-label="Stop camera"
        title="Stop camera"
        @click="s.stop()"
      >
        <AppIcon name="close" :size="22" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.controls {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
}
.controls__cluster {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}
.controls__cluster--center {
  justify-content: center;
}
.controls__cluster--end {
  justify-content: flex-end;
}
.controls__secondary {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  border-color: rgba(255, 255, 255, 0.28);
}
.controls__secondary:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.22);
}
.controls__stop {
  border-color: rgba(255, 255, 255, 0.4);
}
.shutter {
  inline-size: 72px;
  block-size: 72px;
  border-radius: 50%;
  border: 4px solid rgba(255, 255, 255, 0.85);
  background: #fff;
  color: #11151c;
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: transform var(--transition-fast);
}
.shutter:hover:not(:disabled) {
  transform: scale(1.04);
}
.shutter:active:not(:disabled) {
  transform: scale(0.96);
}
.shutter:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.rec-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-block-size: var(--control-min);
  padding: var(--space-2) var(--space-5);
  border-radius: var(--radius-full);
  border: 1px solid var(--recording);
  background: var(--recording);
  color: #fff;
  font-weight: 650;
  cursor: pointer;
}
.rec-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.rec-btn--stop {
  background: #fff;
  color: var(--recording);
}
@media (prefers-reduced-motion: reduce) {
  .shutter {
    transition: none;
  }
}
@media (max-width: 560px) {
  .rec-btn span {
    display: none;
  }
}
</style>
