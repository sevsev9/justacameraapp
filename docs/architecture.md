# Architecture — justacamera.app

> Just a camera. Your photos, videos, audio, and camera frames never leave this device.

This document describes the runtime architecture, module boundaries, and the
state model. It is a living document and must stay synchronized with the code.

## 1. Goals and constraints

- **Privacy is a hard invariant.** No media (frames, photos, video, audio,
  blobs, buffers, base64, blob URLs) and no exact device identifiers
  (`deviceId`, `groupId`, raw labels) may ever leave the browser. There is no
  backend, no upload endpoint, no third-party runtime script. See
  [privacy-model.md](./privacy-model.md).
- **Fully client-side static SPA.** The deployable artifact is a directory of
  static files served over HTTPS. All processing is local.
- **Native-first.** The core media pipeline uses native browser APIs directly
  (`getUserMedia`, `MediaRecorder`, `ImageCapture`, canvas, `MediaStreamTrack`)
  rather than abstraction libraries.
- **Progressive enhancement.** Capability detection drives every advanced
  feature; unsupported features degrade gracefully and never break the preview.

## 2. Technology choices

| Concern          | Choice                                       | Rationale                                                                                |
| ---------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Framework        | Vue 3 (`^3.5`) SFCs                          | Small runtime, excellent reactivity for live device/track state, first-class TS.         |
| Language         | TypeScript (`~6.0`), strict                  | `strict` + `noUncheckedIndexedAccess` + `noImplicitReturns` etc.                         |
| Build            | Vite (`^8`)                                  | Fast, emits hashed external modules → strict CSP with no inline scripts.                 |
| Routing          | **none**                                     | Single view. `vue-router` adds no value; omitted.                                        |
| Global state     | **none** (`pinia` omitted)                   | Session state lives in one composable backed by one service; no cross-view store needed. |
| Unit/integration | Vitest (`^4.1`) + jsdom                      | Media APIs are mocked in jsdom; see [testing-strategy.md](./testing-strategy.md).        |
| E2E / a11y       | Playwright (`1.60`) + `@axe-core/playwright` | Chromium fake-media is deterministic; axe for WCAG scans.                                |
| Lint/format      | ESLint 10 flat config + Prettier             | `eslint-config-prettier` disables conflicting rules.                                     |

Dependency selection rationale and pinned versions: see
[implementation-plan.md](./implementation-plan.md#dependency-decisions).

## 3. Layering and ownership

```
┌──────────────────────────────────────────────────────────────┐
│ UI components (src/components, src/features)                   │
│  - Vue SFCs. Presentational + small interaction logic only.    │
│  - NO getUserMedia / MediaRecorder / track logic lives here.   │
└───────────────▲───────────────────────────────────────────────┘
                │ reactive state + intent calls
┌───────────────┴───────────────────────────────────────────────┐
│ Composables (src/composables)                                  │
│  - Vue glue: adapt services to reactive refs, lifecycle hooks. │
│  - useCameraSession, useRecorder, usePhoto, useMediaDevices,   │
│    useObjectUrl, useAnnouncer, usePreferences, useReducedMotion│
└───────────────▲───────────────────────────────────────────────┘
                │ framework-agnostic calls
┌───────────────┴───────────────────────────────────────────────┐
│ Services (src/services) — plain TS, no Vue imports             │
│  - CameraController   ← THE single owner of the MediaStream    │
│  - DeviceService      enumerate + devicechange                 │
│  - PhotoCaptureService ImageCapture + canvas fallback          │
│  - RecordingService   MediaRecorder lifecycle                  │
│  - DiagnosticsService sanitized report builder                 │
│  - ExportService      saveBlob (File System Access + fallback) │
└───────────────▲───────────────────────────────────────────────┘
                │ pure helpers
┌───────────────┴───────────────────────────────────────────────┐
│ Utils (src/utils) — pure, independently unit-tested            │
│  constraints · mime-support · capabilities · sanitize ·        │
│  filename · duration · format-bytes · errors · object-url      │
└────────────────────────────────────────────────────────────────┘
```

### Mandatory ownership rules

1. **One authoritative owner of the active `MediaStream`: `CameraController`.**
   It is the only module that calls `getUserMedia`, holds the `MediaStream`, and
   calls `MediaStreamTrack.stop()`. No component or other service starts/stops
   tracks directly. This guarantees we never leak a second stream and that "stop
   camera" reliably stops _every_ track.
2. **Recording-format selection is isolated** in `utils/mime-support.ts` and
   independently unit-tested (no DOM needed beyond a `MediaRecorder.isTypeSupported`
   probe, which is injected for testability).
3. **Diagnostic + telemetry sanitization is isolated** in `utils/sanitize.ts`
   and independently unit-tested. The denylist (deviceId/groupId/label/…) is a
   single source of truth.
4. **Blob URL lifecycle is isolated** in `utils/object-url.ts` +
   `useObjectUrl()` and independently unit-tested. Creation always pairs with
   revocation on teardown/replacement.
5. **UI components contain no browser-media business logic.**

## 4. State model

Two **orthogonal** state machines (modeled as TypeScript discriminated unions)
prevent invalid transitions. The mission's flat list of states maps onto these
two machines — every required state exists; splitting them avoids impossible
combinations (e.g. "recording" is only valid while "previewing").

### 4.1 Session lifecycle (`SessionStatus`)

```
idle ─Start─▶ requesting-permission ─┬─ok──▶ previewing
                                     ├─ NotAllowedError ─▶ permission-denied
                                     ├─ NotFoundError ───▶ no-device
                                     ├─ OverconstrainedError ▶ constraint-failed
                                     ├─ (no mediaDevices) ─▶ unsupported
                                     └─ other ───────────▶ error

previewing ─Switch─▶ switching-device ─┬─ok─▶ previewing
                                       └─err─▶ error | constraint-failed
previewing ─Stop──▶ stopped ─Start─▶ requesting-permission
any-error-state ─Retry─▶ requesting-permission
```

`unsupported` is also entered synchronously at boot if `navigator.mediaDevices`
or `getUserMedia` is missing or the context is insecure (non-HTTPS, non-localhost).

### 4.2 Capture activity (`CaptureStatus`, valid only while `previewing`)

```
idle ─▶ counting-down ─▶ capturing-photo ─▶ (photo result) ─▶ idle
idle ─▶ recording ⇄ recording-paused ─stop─▶ finalizing-recording ─▶ (clip) ─▶ idle
```

Guards: cannot start recording while counting-down/capturing; cannot switch
device while recording (must stop first); stopping the camera while recording
finalizes the recording first.

All transitions are funneled through pure reducer-style functions so they are
unit-testable without a browser (`src/features/camera/session-machine.ts` and
`src/features/recording/recording-machine.ts`).

## 5. Key flows

### Start camera

1. User clicks **Start camera** (explicit gesture — never auto-requested).
2. `useCameraSession.start(prefs)` → `SessionStatus = requesting-permission`.
3. `CameraController.start(constraints)` builds constraints
   (`utils/constraints.ts`) from preferences (facingMode / deviceId / resolution).
4. On success: stream stored, tracks' `getSettings()`/`getCapabilities()` read,
   `SessionStatus = previewing`, `<video>.srcObject = stream` (never a blob URL),
   announcer says "Camera started".
5. On error: `errors.normalizeMediaError()` maps the `DOMException` to a session
   state + human message + recovery hint.

### Take photo

1. Optional countdown (off/3/5/10) via `CaptureStatus = counting-down`.
2. `PhotoCaptureService.capture()` tries `ImageCapture.takePhoto()` when
   available & reliable, else draws the current `<video>` frame to a canvas.
3. **Mirroring is two independent flags**: preview mirror (CSS
   `transform: scaleX(-1)` on `<video>`) and export mirror (canvas flip). The
   exported image honors only the export-mirror flag.
4. Result → `Blob` → object URL for preview. User picks retake / discard /
   download. Download uses `ExportService.save()`. No network request occurs.

### Record video

1. `RecordingService.start({ withAudio })` chooses a supported MIME via
   `utils/mime-support.ts` (`isTypeSupported` preference list), creates a
   `MediaRecorder` over the (optionally audio-stripped) stream.
2. `start`/`pause`/`resume`/`stop`; chunks collected from `dataavailable`;
   `stop` → assemble `Blob(chunks, { type })` → object URL for playback.
3. Elapsed time + selected format shown prominently; large/long-recording
   warning surfaced. Download via `ExportService`. No network request occurs.

### Stop / teardown

`CameraController.stop()` stops every track and clears `srcObject`. On
`pagehide`/`visibilitychange`(hidden→long) and component unmount, the same path
runs so the camera indicator (OS LED) turns off. All active object URLs are
revoked via the `useObjectUrl` registry.

## 6. Directory structure

```
src/
├── app/                 App.vue, app-level providers, theme
├── assets/              styles (design tokens, base), inline icon components
├── components/
│   ├── camera/          preview, controls, device pickers, mirror toggles
│   ├── diagnostics/     diagnostics panel + copy report
│   ├── feedback/        dialogs, toasts, live-region announcer, error states
│   ├── layout/          app shell, header, panels, safe-area handling
│   └── media/           photo/clip preview + download UI
├── composables/         Vue glue (see §3)
├── features/
│   ├── camera/          session-machine, onboarding
│   ├── diagnostics/     report assembly
│   ├── photo/           photo orchestration
│   ├── recording/       recording-machine
│   └── settings/        preferences
├── services/            CameraController, DeviceService, …
├── types/               shared domain types
└── utils/               pure helpers (see §3)
```

## 7. Performance & resource model

- Initial bundle is small (Vue + app only). Advanced controls / diagnostics use
  lazy `defineAsyncComponent` where worthwhile.
- No heavy media-processing dependency (no `ffmpeg.wasm`) in the bundle.
- Exactly one `MediaStream` at a time; tracks stopped the moment they are unused.
- Object URLs revoked on teardown/replacement; canvas reused, not re-allocated
  per frame.
- Recording size is estimated and surfaced; recordings are kept in memory only
  until the user downloads or discards.
- Budgets: see [implementation-plan.md](./implementation-plan.md#performance-budgets).

## 8. Security & deployment

CSP, Permissions-Policy and the rest are defined once in
`config/security-headers.ts`, applied to the Vite preview server, and mirrored
into `deploy/Caddyfile` and `deploy/nginx.conf` (a unit test asserts they stay in
sync). Details: [threat-model.md](./threat-model.md) and
[browser-support.md](./browser-support.md).
