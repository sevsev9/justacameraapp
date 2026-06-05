<script setup lang="ts">
/**
 * Inline SVG icon set (no remote assets). Icons are decorative by default
 * (aria-hidden); the surrounding control supplies the accessible name.
 */
const props = withDefaults(defineProps<{ name: IconName; size?: number }>(), { size: 24 })

export type IconName =
  | 'camera'
  | 'stop'
  | 'shutter'
  | 'record'
  | 'pause'
  | 'play'
  | 'download'
  | 'trash'
  | 'flip'
  | 'settings'
  | 'mic'
  | 'mic-off'
  | 'info'
  | 'close'
  | 'check'
  | 'chevron-down'
  | 'sun'
  | 'moon'
  | 'alert'
  | 'retry'
  | 'code'
  | 'torch'
  | 'shield'
  | 'bug'

const PATHS: Record<IconName, string> = {
  camera:
    'M3 8.5A2.5 2.5 0 0 1 5.5 6h1.7l1.1-1.7A1 1 0 0 1 10.1 4h3.8a1 1 0 0 1 .8.4L15.8 6h2.7A2.5 2.5 0 0 1 21 8.5v8A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z M12 9.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z',
  stop: 'M6 6h12v12H6z',
  shutter: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z',
  record: 'M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14z',
  pause: 'M8 5h3v14H8z M13 5h3v14h-3z',
  play: 'M7 5l12 7-12 7z',
  download: 'M12 3v12 M7 11l5 5 5-5 M5 20h14',
  trash: 'M5 7h14 M9 7V5h6v2 M7 7l1 13h8l1-13 M10 11v6 M14 11v6',
  flip: 'M4 8a8 8 0 0 1 14-3 M20 5v4h-4 M20 16a8 8 0 0 1-14 3 M4 19v-4h4',
  settings:
    'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M19 12a7 7 0 0 0-.1-1l2-1.6-2-3.4-2.4 1a7 7 0 0 0-1.7-1l-.4-2.5h-4l-.4 2.5a7 7 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7 7 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7 7 0 0 0 1.7-1l2.4 1 2-3.4-2-1.6c.1-.3.1-.7.1-1z',
  mic: 'M12 4a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V7a3 3 0 0 0-3-3z M6 11a6 6 0 0 0 12 0 M12 17v3 M9 20h6',
  'mic-off':
    'M9 9V7a3 3 0 0 1 5.6-1.5 M15 11v1a3 3 0 0 1-4.7 2.5 M6 11a6 6 0 0 0 9.6 4.8 M12 17v3 M9 20h6 M4 4l16 16',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 11v6 M12 7.5h.01',
  close: 'M6 6l12 12 M18 6L6 18',
  check: 'M5 13l4 4L19 7',
  'chevron-down': 'M6 9l6 6 6-6',
  sun: 'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z M12 2v2 M12 20v2 M4 12H2 M22 12h-2 M5 5l1.5 1.5 M17.5 17.5L19 19 M19 5l-1.5 1.5 M6.5 17.5L5 19',
  moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
  alert: 'M12 4l9 16H3z M12 10v4 M12 17h.01',
  retry: 'M20 11a8 8 0 1 0-2 5.7 M20 5v6h-6',
  code: 'M9 8l-5 4 5 4 M15 8l5 4-5 4',
  torch: 'M9 3h6l-1 5h-4z M9 8h6v3l-2 2v6h-2v-6l-2-2z',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M9 12l2 2 4-4',
  bug: 'M12 7.5a3 3 0 0 0-3 3v3.5a3 3 0 0 0 6 0v-3.5a3 3 0 0 0-3-3z M9.5 8 8 6 M14.5 8 16 6 M9 11H5.5 M9 14H6 M15 11h3.5 M15 14h3',
}

const isFilled = (name: IconName) =>
  name === 'shutter' || name === 'record' || name === 'pause' || name === 'play' || name === 'stop'
</script>

<template>
  <svg
    :width="props.size"
    :height="props.size"
    viewBox="0 0 24 24"
    :fill="isFilled(props.name) ? 'currentColor' : 'none'"
    stroke="currentColor"
    :stroke-width="isFilled(props.name) ? 0 : 1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path :d="PATHS[props.name]" />
  </svg>
</template>
