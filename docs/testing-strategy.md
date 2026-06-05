# Testing strategy — justacamera.app

Testing is part of implementation, not a final phase. The pyramid: many fast
unit tests over pure logic, integration tests over services with mocked media,
E2E over real browsers with deterministic fake media, plus accessibility and
privacy-invariant gates.

## Layers

### 1. Unit (Vitest + jsdom)

Pure, fast, no real browser. Media APIs are mocked. Covered logic:

- Constraint construction (`constraints.spec.ts`)
- MIME preference/selection (`mime-support.spec.ts`)
- Capability normalization + control visibility (`capabilities.spec.ts`)
- Diagnostic/telemetry sanitization + leak detection (`sanitize.spec.ts`)
- Filename + slug generation (`format.spec.ts`)
- Duration + byte formatting + size estimate (`format.spec.ts`)
- Resolution/duration/frame-rate bucketing (`format.spec.ts`)
- Error normalization (`errors.spec.ts`)
- Object-URL lifecycle/cleanup (`object-url.spec.ts`)
- State-machine transitions (`session-machine.spec.ts`, `recording-machine.spec.ts`)
- Security-header ↔ deploy-config sync (`security-headers.spec.ts`)
- Source guard: no remote runtime assets / upload patterns (`source-guard.spec.ts`)

Run: `npm run test:unit` (also `:watch`, `:coverage`).

### 2. Integration (Vitest + jsdom + media mocks)

Services exercised against `tests/helpers/media-mocks.ts` (fake
`navigator.mediaDevices`, `MediaStream`, `MediaStreamTrack`, `MediaRecorder`,
`ImageCapture`). Covered:

- CameraController: start/stop, single-stream guarantee, track stop on stop,
  switch device (stop-then-start), applyConstraints try/catch, teardown.
- DeviceService: enumerate mapping + sanitization, debounce + diff on devicechange.
- PhotoCaptureService: ImageCapture path vs canvas fallback selection; mirror flag.
- RecordingService: start/pause/resume/stop lifecycle; with/without audio;
  finalization; cleanup after error.

### 3. End-to-end (Playwright)

Against the **production preview build** (real CSP applied). Deterministic fake
media:

- **Chromium (primary):** `--use-fake-device-for-media-stream`,
  `--use-fake-ui-for-media-stream` (auto-grant), `--autoplay-policy=...`; the
  built-in synthetic video pattern is used (no fixture file needed).
- **Firefox (secondary):** `firefoxUserPrefs` fake media + permission disabled.
- **WebKit:** not installed / no dependable fake camera → media specs skip on
  webkit; manual validation covers Safari.

Failure states use an `installMediaMock(context, 'denied'|'not-found'|'unsupported')`
helper (`addInitScript`) rather than brittle UI flags.

Covered flows: initial page does **not** auto-request camera; permission granted;
permission denied; no device; unsupported/insecure; preview; device switch; photo
capture; countdown; mirror preview vs output; record; pause/resume; record without
mic; playback; download; stop-camera; responsive desktop+mobile; keyboard
operation; a11y (axe); privacy network assertions; console-error assertions.

### 4. Accessibility (`@axe-core/playwright`, tag `@a11y`)

`AxeBuilder().withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'])` on
each distinct UI state (idle, previewing, recording, permission-denied,
no-device, diagnostics open). `expect(violations).toHaveLength(0)`. Automation
catches ~57% of WCAG issues; manual review (focus order, live-region
announcements, SR labels) is still required and tracked in the manual checklist.

### 5. Privacy invariants (tag `@privacy`, release-blocking)

- `expectNoExfil(context)`: `serviceWorkers: 'block'`, `context.route('**/*')`
  aborting any non-same-origin or multipart/upload request, `routeWebSocket`
  closing+recording sockets, and an `addInitScript` that throws on
  `RTCPeerConnection` construction. Asserts the violation log is empty around the
  full capture/record/playback/download flow.
- `assertNoPersistedMedia(page)`: sweeps Cache Storage, IndexedDB,
  localStorage/sessionStorage for media; asserts `storage.estimate().usage`
  stays within tolerance of baseline after capture+download.

## Real-browser validation (Chrome DevTools MCP)

A manual-but-scripted pass (documented in the final report) drives a real Chrome:
every major flow, multiple viewports (desktop + 384 px mobile), console + network
inspection at each stage (startup, permission, photo, record, playback,
download), light/dark themes, and a Lighthouse audit. Findings are remediated and
re-tested. If unavailable, Playwright traces/screenshots/console/network stand in.

## Manual cross-browser checklist

See [../README.md](../README.md) and the manual checklist; it distinguishes
**tested** from **pending** across Chrome (Win/Linux/Android), Edge, Firefox
(Win/Linux), Safari (macOS/iOS), Samsung Internet, and device types (integrated/
USB/virtual cameras, capture cards, front/rear mobile).

## Commands

```bash
npm run format:check     # prettier
npm run lint             # eslint
npm run type-check       # vue-tsc --build
npm run test:unit        # vitest (unit + integration)
npm run test:coverage    # vitest with coverage
npm run build            # type-check + vite build
npm run test:e2e         # playwright (builds + previews first)
npm run test:a11y        # playwright @a11y subset
npm run test:privacy     # playwright @privacy subset
npm run audit:deps       # npm audit (high+)
```

## Coverage expectations

Pure utils and state machines: high coverage (they carry the privacy/correctness
invariants). Services: covered via integration with mocks. UI components: covered
via E2E flows and component smoke tests rather than chasing line coverage.
