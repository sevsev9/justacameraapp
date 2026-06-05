<script setup lang="ts">
/**
 * Capability-driven advanced camera controls. Only controls the active track
 * actually reports are rendered as interactive; everything else is listed as
 * unavailable with an explanation. Applying a control is best-effort (try/catch
 * in the session) and never breaks the preview.
 */
import { computed } from 'vue'
import { useCameraSession } from '@/composables/useCameraSession'
import type { AdvancedControlDescriptor, AdvancedControlId } from '@/types/media'

const s = useCameraSession()

const supported = computed(() => s.advancedControls.value.filter((c) => c.supported))
const unsupported = computed(() => s.advancedControls.value.filter((c) => !c.supported))

function onRange(id: AdvancedControlId, event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  void s.applyAdvancedControl(id, value)
}
function onToggle(id: AdvancedControlId, event: Event) {
  void s.applyAdvancedControl(id, (event.target as HTMLInputElement).checked)
}
function onEnum(id: AdvancedControlId, event: Event) {
  void s.applyAdvancedControl(id, (event.target as HTMLSelectElement).value)
}
function rangeValue(c: AdvancedControlDescriptor): number {
  return typeof c.value === 'number' ? c.value : (c.min ?? 0)
}
</script>

<template>
  <section class="adv" aria-label="Advanced camera controls">
    <p v-if="supported.length === 0" class="adv__empty">
      This camera and browser don’t expose any adjustable advanced controls. On most desktops these
      are unavailable; controls like zoom, torch and focus typically appear only on Android Chrome.
    </p>

    <div v-for="c in supported" :key="c.id" class="adv__control">
      <template v-if="c.type === 'range'">
        <label :for="`adv-${c.id}`">{{ c.label }}</label>
        <input
          :id="`adv-${c.id}`"
          type="range"
          :min="c.min"
          :max="c.max"
          :step="c.step ?? 0.01"
          :value="rangeValue(c)"
          @input="onRange(c.id, $event)"
        />
      </template>

      <template v-else-if="c.type === 'toggle'">
        <label class="adv__toggle">
          <input type="checkbox" :checked="c.value === true" @change="onToggle(c.id, $event)" />
          <span>{{ c.label }}</span>
        </label>
      </template>

      <template v-else-if="c.type === 'enum'">
        <label :for="`adv-${c.id}`">{{ c.label }}</label>
        <select :id="`adv-${c.id}`" :value="c.value" @change="onEnum(c.id, $event)">
          <option v-for="opt in c.options" :key="opt" :value="opt">{{ opt }}</option>
        </select>
      </template>
    </div>

    <details v-if="unsupported.length" class="adv__unsupported">
      <summary>Unavailable on this device ({{ unsupported.length }})</summary>
      <ul>
        <li v-for="c in unsupported" :key="c.id">{{ c.label }}</li>
      </ul>
    </details>
  </section>
</template>

<style scoped>
.adv {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.adv__empty {
  color: var(--text-muted);
  font-size: var(--text-sm);
}
.adv__control {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}
.adv__control label {
  font-size: var(--text-sm);
  color: var(--text-muted);
  font-weight: 550;
}
.adv__toggle {
  flex-direction: row;
  align-items: center;
  gap: var(--space-2);
  color: var(--text);
}
.adv__toggle input {
  inline-size: 20px;
  block-size: 20px;
  accent-color: var(--accent);
}
.adv__unsupported {
  font-size: var(--text-sm);
  color: var(--text-faint);
}
.adv__unsupported ul {
  margin: var(--space-2) 0 0;
  padding-inline-start: var(--space-5);
}
</style>
