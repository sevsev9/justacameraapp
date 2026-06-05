<script setup lang="ts">
/**
 * Accessible modal built on the native <dialog> element + showModal(), which
 * provides a browser-managed focus trap, inert background, Escape handling,
 * implicit aria-modal, and focus restoration. We add the accessible name
 * (aria-labelledby), a visible close button, and backdrop-click to close.
 * See docs/browser-support.md (a11y) for the WebKit caveats this guards.
 */
import { nextTick, ref, watch } from 'vue'
import AppIcon from '@/components/AppIcon.vue'

const props = defineProps<{ open: boolean; title: string }>()
const emit = defineEmits<{ close: [] }>()

const dialog = ref<HTMLDialogElement | null>(null)
const titleId = `jca-dialog-${Math.random().toString(36).slice(2, 9)}`

watch(
  () => props.open,
  async (open) => {
    await nextTick()
    const el = dialog.value
    if (!el) return
    if (open && !el.open) el.showModal()
    else if (!open && el.open) el.close()
  },
  { immediate: true },
)

function onCancel(event: Event) {
  // Esc fires `cancel`; route it through our close handler.
  event.preventDefault()
  emit('close')
}

function onBackdropClick(event: MouseEvent) {
  if (event.target === dialog.value) emit('close')
}
</script>

<template>
  <dialog
    ref="dialog"
    class="dialog"
    :aria-labelledby="titleId"
    @close="emit('close')"
    @cancel="onCancel"
    @click="onBackdropClick"
  >
    <div class="dialog__panel">
      <header class="dialog__head">
        <h2 :id="titleId" class="dialog__title">{{ title }}</h2>
        <button class="icon-btn" type="button" aria-label="Close dialog" @click="emit('close')">
          <AppIcon name="close" :size="20" />
        </button>
      </header>
      <div class="dialog__body">
        <slot />
      </div>
      <footer v-if="$slots.footer" class="dialog__footer">
        <slot name="footer" />
      </footer>
    </div>
  </dialog>
</template>

<style scoped>
.dialog {
  padding: 0;
  border: none;
  background: transparent;
  max-inline-size: min(560px, calc(100vw - 2 * var(--space-4)));
  inline-size: 100%;
}
.dialog::backdrop {
  background: var(--scrim);
  backdrop-filter: blur(2px);
}
.dialog__panel {
  background: var(--surface);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-2);
  max-block-size: calc(100dvh - 2 * var(--space-5));
  display: flex;
  flex-direction: column;
}
.dialog__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  border-block-end: 1px solid var(--border);
}
.dialog__title {
  font-size: var(--text-xl);
  line-height: var(--leading-tight);
}
.dialog__body {
  padding: var(--space-5);
  overflow: auto;
}
.dialog__footer {
  display: flex;
  gap: var(--space-3);
  justify-content: flex-end;
  flex-wrap: wrap;
  padding: var(--space-4) var(--space-5);
  border-block-start: 1px solid var(--border);
}

/*
 * On touch devices, reserve clearance for the system navigation bar. Under
 * viewport-fit=cover the modal can otherwise extend under a 3-button nav bar
 * (which reports no safe-area inset), clipping the bottom action row. We cap the
 * panel height and pad the scroll area + footer so actions stay reachable.
 * (Real-device finding on Galaxy S26 Ultra.)
 */
@media (pointer: coarse) {
  .dialog__panel {
    max-block-size: calc(100dvh - 2 * var(--space-5) - max(var(--safe-bottom), 3rem));
  }
  .dialog__body {
    padding-block-end: max(var(--safe-bottom), 3rem);
  }
  .dialog__footer {
    padding-block-end: max(var(--safe-bottom), 3rem);
  }
}
</style>
