<script setup lang="ts">
/**
 * Local diagnostics view + a "Copy diagnostic report" action. The on-screen view
 * may show the device label (local only); the COPIED report is passed through the
 * sanitizer so deviceId/groupId/labels/media never leave the browser.
 */
import { computed, ref } from 'vue'
import { useCameraSession } from '@/composables/useCameraSession'
import { diagnosticsService } from '@/services/diagnostics-service'
import AppIcon from '@/components/AppIcon.vue'

const s = useCameraSession()
const report = computed(() => s.buildDiagnostics())
const copyState = ref<'idle' | 'copied' | 'error'>('idle')

async function copyReport() {
  try {
    const text = diagnosticsService.toReportText(report.value)
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
    } else {
      throw new Error('clipboard unavailable')
    }
    copyState.value = 'copied'
    setTimeout(() => (copyState.value = 'idle'), 2500)
  } catch {
    copyState.value = 'error'
    setTimeout(() => (copyState.value = 'idle'), 3000)
  }
}

const yn = (v: boolean | undefined) => (v === undefined ? '—' : v ? 'Yes' : 'No')
</script>

<template>
  <section class="diag" aria-label="Diagnostics">
    <dl class="diag__grid">
      <dt>Secure context</dt>
      <dd>{{ yn(report.environment.secureContext) }}</dd>
      <dt>Browser engine</dt>
      <dd>{{ report.environment.browserEngine }}</dd>
      <dt>Camera permission</dt>
      <dd>{{ report.permission.camera }}</dd>
      <dt>Microphone permission</dt>
      <dd>{{ report.permission.microphone }}</dd>
      <dt>Active camera</dt>
      <dd>{{ report.selectedCamera?.label || '—' }}</dd>
      <dt>Resolution</dt>
      <dd>
        <template v-if="report.video">
          {{ report.video.width }}×{{ report.video.height }} ({{ report.video.resolutionBucket }})
        </template>
        <template v-else>—</template>
      </dd>
      <dt>Frame rate</dt>
      <dd>{{ report.video?.frameRate ?? '—' }} fps</dd>
      <dt>Aspect ratio</dt>
      <dd>{{ report.video?.aspectRatio?.toFixed?.(2) ?? '—' }}</dd>
      <dt>Facing mode</dt>
      <dd>{{ report.video?.facingMode ?? '—' }}</dd>
      <dt>Audio enabled</dt>
      <dd>{{ report.audio ? 'Yes' : 'No' }}</dd>
      <dt>Echo cancellation</dt>
      <dd>{{ yn(report.audio?.echoCancellation) }}</dd>
      <dt>Noise suppression</dt>
      <dd>{{ yn(report.audio?.noiseSuppression) }}</dd>
      <dt>Auto gain control</dt>
      <dd>{{ yn(report.audio?.autoGainControl) }}</dd>
      <dt>ImageCapture</dt>
      <dd>{{ yn(report.support.imageCapture) }}</dd>
      <dt>MediaRecorder</dt>
      <dd>{{ yn(report.support.mediaRecorder) }}</dd>
      <dt>getCapabilities</dt>
      <dd>{{ yn(report.support.getCapabilities) }}</dd>
      <dt>File System Access</dt>
      <dd>{{ yn(report.support.fileSystemAccess) }}</dd>
    </dl>

    <div class="diag__section">
      <h4>Supported recording formats</h4>
      <ul v-if="report.recordingFormats.length" class="diag__chips">
        <li v-for="f in report.recordingFormats" :key="f">{{ f }}</li>
      </ul>
      <p v-else class="diag__muted">None detected.</p>
    </div>

    <p v-if="report.notes.length" class="diag__notes">
      <AppIcon name="info" :size="16" />
      <span>{{ report.notes.join(' ') }}</span>
    </p>

    <div class="diag__copy">
      <button class="btn btn--primary" type="button" @click="copyReport">
        <AppIcon name="code" :size="18" /> Copy diagnostic report
      </button>
      <span v-if="copyState === 'copied'" class="diag__copied" role="status"
        >Copied (sanitized).</span
      >
      <span v-else-if="copyState === 'error'" class="diag__error" role="alert">
        Couldn’t copy — your browser blocked clipboard access.
      </span>
    </div>
    <p class="diag__excluded">
      The copied report excludes device IDs, group IDs, raw device labels, and any media — only
      support-useful, non-identifying information is included.
    </p>
  </section>
</template>

<style scoped>
.diag {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.diag__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--space-1) var(--space-3);
  margin: 0;
  font-size: var(--text-sm);
}
.diag__grid dt {
  color: var(--text-muted);
}
.diag__grid dd {
  margin: 0;
  font-weight: 600;
  word-break: break-word;
}
.diag__section h4 {
  margin: 0 0 var(--space-1);
  font-size: var(--text-sm);
  color: var(--text-muted);
}
.diag__chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  list-style: none;
  margin: 0;
  padding: 0;
}
.diag__chips li {
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  padding: var(--space-1) var(--space-3);
  font-size: var(--text-xs);
}
.diag__muted {
  color: var(--text-faint);
  font-size: var(--text-sm);
}
.diag__notes {
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
  font-size: var(--text-sm);
  color: var(--text-muted);
  background: var(--surface-2);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
}
.diag__notes svg {
  flex: none;
  margin-block-start: 2px;
}
.diag__copy {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  flex-wrap: wrap;
}
.diag__copied {
  color: var(--success);
  font-weight: 600;
}
.diag__error {
  color: var(--danger);
}
.diag__excluded {
  font-size: var(--text-xs);
  color: var(--text-faint);
}
</style>
