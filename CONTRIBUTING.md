# Contributing to justacamera.app

Thanks for your interest! This is a privacy-first, fully client-side camera app.
The most important rule: **never weaken the privacy invariant.**

## The one hard rule

No media (camera frames, photos, video, audio, blobs, buffers, base64, blob
URLs) and no exact device identifiers (`deviceId`, `groupId`, raw labels) may
ever leave the browser. There is no backend and no network request for any
capture/record/playback/download operation. See
[docs/privacy-model.md](docs/privacy-model.md). Changes that add a network call,
a third-party runtime resource, telemetry, or media persistence will be rejected
unless they preserve this invariant — and the automated guards
(`tests/unit/security/source-guard.spec.ts`, the `@privacy` E2E suite) must stay
green.

## Principles

- **Native over libraries** for the media pipeline (`getUserMedia`,
  `MediaRecorder`, `ImageCapture`, canvas, `MediaStreamTrack`).
- **One owner of the stream.** Only `CameraController` calls `getUserMedia` and
  stops tracks. Don't start/stop tracks elsewhere.
- **Capability detection over assumptions.** Gate advanced features on runtime
  detection; degrade gracefully and never break the preview.
- **Pure, tested utilities** carry the invariants (`src/utils/`). Add unit tests
  for new logic there.
- **Accessibility is a requirement**, not a nice-to-have (WCAG 2.2 AA).

## Development

```bash
npm install
npm run dev
```

Before opening a PR, run:

```bash
npm run validate      # format:check + lint + type-check + unit + build
npm run test:e2e      # Playwright (needs: npx playwright install chromium firefox)
```

All checks also run in CI ([.github/workflows/ci.yml](.github/workflows/ci.yml)).

## Pull requests

- Keep PRs focused; describe the change and its privacy/security implications.
- Add or update tests (unit/integration for logic; E2E for flows). New media
  behavior needs a test; new exported fields need a sanitizer test.
- Update the relevant doc under `docs/` if you change architecture, browser
  behavior, or the privacy/security posture.
- Match the existing code style (Prettier + ESLint enforce it).
- No `console.log` (only `warn`/`error`), no debug code, no disabled tests.

## Reporting security issues

Please follow [SECURITY.md](SECURITY.md) — do not open a public issue for
vulnerabilities.

## License

By contributing you agree your contributions are licensed under
[AGPL-3.0-or-later](LICENSE).
