# Implementation plan — justacamera.app

Living document. Updated as work progresses. Companion to
[architecture.md](./architecture.md), [privacy-model.md](./privacy-model.md),
[threat-model.md](./threat-model.md), [browser-support.md](./browser-support.md),
[testing-strategy.md](./testing-strategy.md), and
[telemetry-schema.md](./telemetry-schema.md).

## 1. Repository assessment

The repository was **greenfield** at the start: a git repo with no commits and
no files except the freshly added editor/ignore configs. There was no existing
framework, CI, or code to preserve, so no prior work was overwritten. Toolchain
on the build machine: Node v24.12.0, npm 11.6.2 (also pnpm 10.7, bun 1.3), git
2.34, Playwright 1.60 with cached Chromium + Firefox browsers, Chrome installed
(enables Chrome DevTools MCP validation).

## 2. Assumptions (explicit)

1. **Greenfield** → free choice of stack; chose Vue 3 + TS + Vite per the brief.
2. **Package manager: npm** — universally available, no extra tooling in CI,
   `package-lock.json` gives the locked graph the brief requires. (pnpm/bun were
   available but add setup friction.)
3. **License: AGPL-3.0-or-later** — the product's pitch is auditability and "your
   media never leaves"; AGPL's hosted-source reciprocity guarantees deployed
   forks must publish source, reinforcing trust. Apache-2.0 (max adoption) is the
   documented alternative; the maintainer can switch. This is a reversible,
   documented decision, surfaced in the final report.
4. **Single view** → no `vue-router`; **no app-wide store** → no `pinia`.
5. **WebKit not testable here** → media E2E on Chromium + Firefox; Safari covered
   by manual checklist + Chrome DevTools MCP for the Chromium path.
6. **PWA + optional local gallery are deferred** until MVP gates pass (per brief).
7. Repository URL assumed `github.com/sevsev9/justacameraapp`; the "View source"
   link is configurable via `VITE_REPO_URL` (falls back to that).

## 3. Selected architecture and rationale

See [architecture.md](./architecture.md). Key points: one `CameraController`
owns the single `MediaStream`; pure utils carry the privacy/correctness
invariants and are independently tested; two orthogonal discriminated-union state
machines (session lifecycle + capture activity) prevent invalid transitions; UI
holds no media business logic; native browser APIs over abstraction libraries.

## 4. Dependency decisions

Verified against the npm registry on 2026-06-05 (versions that did not exist were
corrected — e.g. `@eslint/js` is 10.0.x, not 10.4.x). Runtime dependency: **only
`vue`**. Dev-only: Vite 8, `@vitejs/plugin-vue` 6, TypeScript ~6.0 (kept in 6.0.x
because typescript-eslint caps `<6.1`), `vue-tsc` 3.3, Vitest 4.1 + jsdom 29 +
`@vue/test-utils` 2.4 + `@vitest/coverage-v8`, Playwright 1.60 (matches cached
browsers) + `@axe-core/playwright` 4.11, ESLint 10 flat + `typescript-eslint` 8.60

- `eslint-plugin-vue` 10.9 + `eslint-config-prettier` 10.1 + Prettier 3.8. No UI
  component framework, no heavy media-processing lib (no `ffmpeg.wasm`). `npm
install` reports **0 vulnerabilities**.

## 5. Phases (ordered; blocking relationships, no time estimates)

- **Phase 0 — Discovery & architecture.** Research, docs, scaffold, baseline.
  _Blocks everything._ Gate: no-media-upload architecture; stream ownership
  defined; cross-browser fallbacks defined; no unjustified dependency. ✅
- **Phase 1 — Core camera.** Onboarding, preview, enumerate/switch, stop, errors,
  responsive layout. _Blocks Phase 2/3._ Gate: camera never auto-requested; all
  tracks stop; no multi-stream leak; core states accessible+responsive.
- **Phase 2 — Photo & recording.** Capture (+fallback), countdown, mirror,
  record/pause/resume, playback, download, cleanup. Gate: flows pass tests; no
  capture/record network request; dynamic format selection; blobs/tracks cleaned.
- **Phase 3 — Diagnostics & advanced controls.** Sanitized report;
  capability-driven controls. Gate: unsupported controls can't break preview;
  export excludes identifiers; constraints fail gracefully.
- **Phase 4 — Security/privacy/deploy/CI.** Headers, privacy tests, deploy
  configs, validation gates (run manually), public docs. Gate: privacy+security reviews pass; no
  third-party runtime resources; build+deploy config validate.
- **Phase 5 — Browser & UX validation.** Chrome DevTools MCP inspection,
  screenshots, console/network/a11y/Lighthouse, responsive, remediation. Gate:
  no unexpected console errors / prohibited requests; critical flows polished;
  a11y blockers resolved; limitations documented.
- **Phase 6 — Independent review.** Multi-agent review (security/privacy/a11y/
  arch/tests/UX/docs); remediate; re-run affected gates.

## 6. Risks and mitigations

| Risk                                                              | Mitigation                                                                                                                      |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Cross-browser media divergence (Safari codecs, ImageCapture gaps) | Runtime detection everywhere; canvas-first photo; `isTypeSupported` ordering; documented matrix.                                |
| OverconstrainedError on strict resolutions                        | Use `ideal`; relax-and-retry.                                                                                                   |
| Camera not released (light stays on)                              | Single owner + teardown on Stop/unmount/`pagehide`/hidden.                                                                      |
| Accidental media/identifier leak                                  | Single-source sanitizer + leak detector + privacy E2E gate.                                                                     |
| Long/4K recording OOM                                             | Size estimate + long-recording warning; in-memory only.                                                                         |
| WebKit untested in CI                                             | Manual checklist; honest "pending" labeling; Firefox secondary.                                                                 |
| Strict CSP breaking the build app                                 | `style-src 'unsafe-inline'` only (Vue inline styles); preview applies real headers; Chrome DevTools MCP verifies no violations. |

## 7. Acceptance criteria

The 27 non-negotiable criteria from the brief are tracked in §9. "Done" means the
relevant automated gate passes (not a claim).

## 8. Validation commands

```bash
npm run format:check && npm run lint && npm run type-check \
  && npm run test:unit && npm run build \
  && npm run test:e2e && npm run audit:deps
# privacy + a11y subsets:
npm run test:privacy && npm run test:a11y
```

## 9. Progress checklist

### Phase 0

- [x] Research (deps, media APIs, security, e2e, a11y, pwa)
- [x] Docs: architecture, privacy-model, threat-model, browser-support,
      testing-strategy, telemetry-schema, implementation-plan
- [x] Scaffold (package.json, tsconfig×3, vite, eslint, prettier, playwright)
- [x] Install (0 vulnerabilities); baseline type-check/lint/build/test green
- [x] Typed foundation + pure utils + 67 unit tests

### Phase 1 — Core camera

- [x] Session + capture state machines (pure, tested)
- [x] CameraController service (single-stream owner) + tests
- [x] DeviceService (enumerate + debounced devicechange) + tests
- [x] useCameraSession composable (single orchestrator)
- [x] Onboarding screen (explicit Start; privacy promise; recovery help)
- [x] Live preview + active indicator + Stop
- [x] Device pickers (camera/mic) + front/rear switch
- [x] Error/unsupported/insecure/no-device/denied states
- [x] Responsive desktop/tablet/mobile layout + safe areas

### Phase 2 — Photo & recording

- [x] PhotoCaptureService (ImageCapture + canvas fallback) + tests
- [x] Countdown (off/3/5/10); mirror preview vs output controls
- [x] RecordingService (MediaRecorder lifecycle, dynamic mime) + tests
- [x] Record/pause/resume/stop/discard/playback/download
- [x] ExportService (File System Access + `<a download>` fallback) + cleanup + tests
- [x] Size estimate + long-recording warning

### Phase 3 — Diagnostics & advanced controls

- [x] DiagnosticsService (sanitized report) + Copy report + tests
- [x] Capability-driven advanced controls + graceful degradation

### Phase 4 — Security/privacy/deploy/CI

- [x] security-headers module + Caddy + nginx + sync test
- [x] Privacy E2E (no-exfil + no-persisted-media) + source guard
- [x] Validation gates wired as npm scripts (`validate` + `test:e2e`/`test:privacy`/`test:a11y`/`audit:deps`). CI/CD is intentionally manual for now — no GitHub Actions workflow.

### Phase 5 — Validation

- [x] Chrome DevTools MCP pass (welcome/dialogs/themes/responsive/console/network/Lighthouse)
- [x] Remediation (robots.txt/llms.txt) + re-test

### Phase 6 — Review

- [x] Independent multi-dimension review (6 agents) + remediation

### Release docs

- [x] README, CONTRIBUTING, SECURITY, LICENSE, repo CLAUDE.md, manual checklist
