# CLAUDE.md — justacamera.app

Durable, project-specific guidance. For the full plan see
[docs/implementation-plan.md](docs/implementation-plan.md).

## What this is

A privacy-first, **fully client-side** web camera app (Vue 3, strict TypeScript,
Vite). No backend, no accounts, no uploads, no telemetry. Single view; no router
or store.

## The invariant that overrides everything

**Media and exact device identifiers must never leave the browser.** No network
request occurs for any camera/photo/record/playback/download operation. Before
adding code that touches the network, storage, telemetry, or third-party
resources, re-read [docs/privacy-model.md](docs/privacy-model.md). The guards
that will catch violations:

- `src/utils/sanitize.ts` — the single denylist source of truth.
- `tests/unit/security/source-guard.spec.ts` — fails on `fetch`/XHR/WebSocket/
  `RTCPeerConnection`/`sendBeacon`/`FormData` or remote URLs in `src/`.
- `@privacy` Playwright suite — no-exfiltration + no-persisted-media.

## Architecture rules (don't break these)

- `CameraController` is the **only** place `getUserMedia` is called and tracks
  are stopped. Never start/stop tracks elsewhere.
- Recording-format selection (`utils/mime-support.ts`), sanitization
  (`utils/sanitize.ts`), capability mapping (`utils/capabilities.ts`), and Blob
  URL lifecycle (`utils/object-url.ts`) are isolated, pure, and unit-tested.
- Two orthogonal state machines (`features/camera/session-machine.ts`,
  `capture-machine.ts`) gate transitions. UI components hold no media logic.
- `useCameraSession` is the single orchestrator (provided once in `App.vue`).

## Cross-browser rules

- Detect at runtime; never assume a codec/control/API. Photo = canvas-first with
  an `ImageCapture` upgrade. Recording = `isTypeSupported` preference order, read
  back `recorder.mimeType`. Advanced controls are gated on `getCapabilities()`.
  See [docs/browser-support.md](docs/browser-support.md).
- Release the camera on Stop/unmount/`pagehide`/tab-hidden (use `pagehide`, not
  `unload`).

## Security headers

Defined once in `config/security-headers.ts`; mirrored into `deploy/Caddyfile`
and `deploy/nginx.conf`; a unit test asserts they stay in sync. Applied to the
Vite **preview** server (not dev — HMR needs a relaxed CSP).

## Commands

`npm run dev` · `npm run validate` (format+lint+types+unit+build) ·
`npm run test:e2e` (needs `npx playwright install chromium firefox`) ·
`npm run test:privacy` · `npm run test:a11y`.

## Conventions

- TypeScript strict + `noUncheckedIndexedAccess`. ESLint flat config + Prettier
  (no semicolons, single quotes, width 100). No `console.log` (warn/error only).
- Vue: `<script setup lang="ts">`, scoped styles, CSS custom properties from
  `assets/styles/tokens.css`. No remote fonts/scripts/images.
- Keep the bundle lean (one runtime dep: `vue`); lazy-load heavy/optional parts;
  never add `ffmpeg.wasm` to the initial bundle.

## Deferred (don't add without re-checking gates)

PWA/service worker and an optional local gallery (OPFS/IndexedDB) are
intentionally deferred. If added, the SW must use a top-of-fetch protocol guard
that never caches `blob:`/`data:`/media, and the no-persisted-media test must
still pass.
