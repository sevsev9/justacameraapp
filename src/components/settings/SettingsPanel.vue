<script setup lang="ts">
/**
 * Settings + devices + advanced controls + diagnostics, shown inside the
 * settings dialog. Capture preferences are two-way bound to the session's
 * reactive preferences (persisted locally). Changing the camera/mic or
 * resolution re-acquires the stream via the session.
 */
import { computed, watch } from 'vue'
import { useCameraSession } from '@/composables/useCameraSession'
import { cameraDisplayName } from '@/services/device-service'
import type { MediaDeviceOption } from '@/types/media'
import AdvancedControls from '@/components/camera/AdvancedControls.vue'
import DiagnosticsPanel from '@/components/diagnostics/DiagnosticsPanel.vue'
import AppIcon from '@/components/AppIcon.vue'

const s = useCameraSession()
const prefs = s.preferences

const recordingLocked = computed(() => s.isRecording.value || s.isPaused.value)
const showQuality = computed(() => prefs.photoFormat !== 'image/png')
const supportedAdvancedCount = computed(
  () => s.advancedControls.value.filter((c) => c.supported).length,
)

const cameraName = (cam: MediaDeviceOption) => cameraDisplayName(cam, s.devices.value.cameras)
const micLabel = (deviceId: string, index: number) => {
  const mic = s.devices.value.microphones.find((m) => m.deviceId === deviceId)
  return mic?.label || `Microphone ${index + 1}`
}

function onCameraChange(event: Event) {
  void s.switchCamera((event.target as HTMLSelectElement).value)
}
function onMicChange(event: Event) {
  void s.switchMicrophone((event.target as HTMLSelectElement).value)
}
function onAudioToggle(event: Event) {
  void s.setAudioEnabled((event.target as HTMLInputElement).checked)
}

// Re-acquire when the resolution preference changes mid-preview.
watch(
  () => prefs.resolution,
  () => {
    if (s.isPreviewing.value && s.selectedCameraId.value) {
      void s.switchCamera(s.selectedCameraId.value)
    }
  },
)
</script>

<template>
  <div class="settings">
    <!-- Devices -->
    <section aria-labelledby="dev-heading" class="settings__section">
      <h3 id="dev-heading" class="panel-heading">Devices</h3>
      <p v-if="!s.devices.value.labelsAvailable" class="settings__hint">
        Device names appear after you grant camera permission — browsers hide them beforehand to
        prevent fingerprinting.
      </p>

      <div class="field">
        <label for="camera-select">Camera</label>
        <select
          id="camera-select"
          :value="s.selectedCameraId.value ?? ''"
          :disabled="recordingLocked || s.devices.value.cameras.length === 0"
          @change="onCameraChange"
        >
          <option v-if="s.devices.value.cameras.length === 0" value="">No cameras found</option>
          <option v-for="cam in s.devices.value.cameras" :key="cam.deviceId" :value="cam.deviceId">
            {{ cameraName(cam) }}
          </option>
        </select>
      </div>

      <label class="settings__toggle">
        <input
          type="checkbox"
          :checked="prefs.withAudio"
          :disabled="recordingLocked"
          @change="onAudioToggle"
        />
        <span>Record microphone audio</span>
      </label>

      <div v-if="prefs.withAudio" class="field">
        <label for="mic-select">Microphone</label>
        <select
          id="mic-select"
          :value="s.selectedMicId.value ?? ''"
          :disabled="recordingLocked || s.devices.value.microphones.length === 0"
          @change="onMicChange"
        >
          <option v-if="s.devices.value.microphones.length === 0" value="">
            No microphones found
          </option>
          <option
            v-for="(mic, i) in s.devices.value.microphones"
            :key="mic.deviceId"
            :value="mic.deviceId"
          >
            {{ micLabel(mic.deviceId, i) }}
          </option>
        </select>
      </div>
    </section>

    <!-- Capture settings -->
    <section aria-labelledby="cap-heading" class="settings__section">
      <h3 id="cap-heading" class="panel-heading">Capture</h3>

      <div class="field">
        <label for="res-select">Resolution</label>
        <select id="res-select" v-model="prefs.resolution" :disabled="recordingLocked">
          <option value="auto">Auto (recommended)</option>
          <option value="480p">480p</option>
          <option value="720p">720p (HD)</option>
          <option value="1080p">1080p (Full HD)</option>
          <option value="4k">4K (Ultra HD)</option>
        </select>
      </div>

      <div class="field">
        <label for="fmt-select">Photo format</label>
        <select id="fmt-select" v-model="prefs.photoFormat">
          <option value="image/jpeg">JPEG (smaller)</option>
          <option value="image/png">PNG (lossless)</option>
          <option value="image/webp">WebP</option>
        </select>
      </div>

      <div v-if="showQuality" class="field">
        <label for="quality-range"
          >Photo quality ({{ Math.round(prefs.photoQuality * 100) }}%)</label
        >
        <input
          id="quality-range"
          v-model.number="prefs.photoQuality"
          type="range"
          min="0.3"
          max="1"
          step="0.05"
        />
      </div>

      <div class="field">
        <label for="countdown-select">Capture countdown</label>
        <select id="countdown-select" v-model.number="prefs.countdownSeconds">
          <option :value="0">Off</option>
          <option :value="3">3 seconds</option>
          <option :value="5">5 seconds</option>
          <option :value="10">10 seconds</option>
        </select>
      </div>

      <label class="settings__toggle">
        <input v-model="prefs.mirrorPreview" type="checkbox" />
        <span>Mirror preview <em>(what you see on screen)</em></span>
      </label>
      <label class="settings__toggle">
        <input v-model="prefs.mirrorOutput" type="checkbox" />
        <span>Mirror saved photo <em>(what gets saved to your device)</em></span>
      </label>
    </section>

    <!-- Advanced (collapsed by default; the count invites expansion) -->
    <details class="settings__disclosure">
      <summary class="settings__summary">
        <span>Advanced camera controls</span>
        <span class="settings__count">
          {{
            supportedAdvancedCount > 0
              ? `${supportedAdvancedCount} available`
              : 'none on this device'
          }}
        </span>
      </summary>
      <div class="settings__disclosure-body"><AdvancedControls /></div>
    </details>

    <!-- Diagnostics (collapsible; technical, collapsed by default) -->
    <details class="settings__disclosure">
      <summary class="settings__summary"><span>Diagnostics</span></summary>
      <div class="settings__disclosure-body"><DiagnosticsPanel /></div>
    </details>

    <p class="settings__footer">
      <AppIcon name="shield" :size="16" /> Everything here stays on your device.
    </p>
  </div>
</template>

<style scoped>
.settings {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}
.settings__section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.settings__hint {
  font-size: var(--text-sm);
  color: var(--text-muted);
  background: var(--surface-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
}
.settings__toggle {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  cursor: pointer;
}
.settings__toggle input {
  inline-size: 20px;
  block-size: 20px;
  accent-color: var(--accent);
  flex: none;
}
.settings__toggle em {
  color: var(--text-faint);
  font-style: normal;
  font-size: var(--text-sm);
}
.settings__footer {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  color: var(--text-muted);
}
.settings__footer svg {
  color: var(--success);
}
.settings__disclosure {
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface);
}
.settings__summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  min-block-size: var(--control-min);
  padding: var(--space-3) var(--space-4);
  cursor: pointer;
  font-weight: 650;
  list-style-position: inside;
}
.settings__summary::-webkit-details-marker {
  /* keep the native disclosure triangle but let it sit inline with the label */
  order: -1;
}
.settings__count {
  font-weight: 500;
  font-size: var(--text-sm);
  color: var(--text-faint);
}
.settings__disclosure-body {
  padding: 0 var(--space-4) var(--space-4);
}
</style>
