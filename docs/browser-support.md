# Browser support — justacamera.app

Target: current versions of Chrome/Edge (Chromium), Firefox, and Safari
(macOS + iOS), plus Android Chrome and Samsung Internet. The core flow (start
camera → preview → photo → record → download) works on all of them; advanced
photographic controls are capability-gated and appear mostly on Chromium Android.

This document is the implementation reference for cross-browser behavior. It is
distilled from current primary sources (MDN, caniuse, W3C/WHATWG, WebKit/Mozilla)
researched 2026-06.

## Secure context

`navigator.mediaDevices` exists **only in a secure context** (HTTPS, or
`localhost`/`127.0.0.1`). On plain HTTP it is `undefined`, so calling
`getUserMedia` throws `TypeError`. The app guards at startup and shows an
"HTTPS required" state rather than letting the error bubble.

## getUserMedia constraints

- Resolution/frameRate use **`ideal`** (soft) so the UA negotiates; we never use
  `exact` width/height (a common `OverconstrainedError`). On
  `OverconstrainedError` we **relax and retry** (drop width/height, keep device).
- Camera selection uses **`deviceId: { exact }`** (the only reliable cross-platform
  switch). `facingMode` is a soft `ideal` hint, useful only on mobile; desktops
  often ignore it (single camera).
- Error mapping (`utils/errors.ts`): `NotAllowedError`/`SecurityError` →
  permission-denied; `NotFoundError` → no-device; `NotReadableError`/`AbortError`
  → device-busy (camera in use elsewhere — common on Windows); `OverconstrainedError`
  → constraint-failed (+ `.constraint`); `TypeError`/missing `mediaDevices` →
  insecure-context.

## enumerateDevices

- Labels (and often `deviceId`/`groupId`) are **blank before permission**; they
  populate after a `getUserMedia` grant. Flow: request permission → enumerate →
  present chooser. The UI explains the pre-permission blank-label behavior.
- Order is **not** guaranteed; never assume index 0 is the front/default camera.
- `deviceId` is stable per origin+profile, **not** across origins/browsers or
  after clearing site data.
- iOS Safari: multiple rear lenses may have generic/duplicated labels.

## devicechange

Fires on add/remove. Firefox coalesces; Safari may fire spuriously right after a
`getUserMedia` success. The app **debounces** (~400 ms) and **re-enumerates +
diffs** rather than reacting blindly, and verifies the active camera still exists.

## Photo capture — canvas-first

The universal path is `ctx.drawImage(video) → canvas.toBlob()`, which works in
**all** browsers. `ImageCapture.takePhoto()` is used as an **opportunistic
upgrade** only when `'ImageCapture' in window` **and** `getPhotoCapabilities()`
resolves (full-resolution stills on Chromium/Android); any throw falls back to
canvas. ImageCapture is absent in Safari and effectively absent in Firefox.

## Video recording — MediaRecorder

- Codec/container support is detected at runtime with `isTypeSupported`, then the
  recorder's actual `mimeType` is read back. **No codec is assumed.**
- Preference order (`utils/mime-support.ts`), chosen so saved files play natively
  on iOS and broadly:
  1. `video/mp4;codecs=avc1.42E01E,mp4a.40.2`
  2. `video/mp4;codecs=avc1,mp4a.40.2`
  3. `video/webm;codecs=vp9,opus`
  4. `video/webm;codecs=vp8,opus`
  5. `video/webm;codecs=av01,opus`
  6. `video/webm`
  7. `video/mp4`
- Safari ≤18.3 records **MP4 only**; **Safari 18.4+ added WebM (VP8/VP9) + AV1/HEVC**.
  Chromium/Firefox produce WebM; Chromium MP4 output is unreliable.
- `pause()/resume()` are reliable on Chromium/Firefox but **buggy on Safari**
  (can emit huge chunks on resume). The UI exposes pause/resume but the recording
  machine tolerates absence and we document the Safari caveat.
- On `stop()`, the final `dataavailable` fires **before** `stop`; we collect
  chunks in `dataavailable` and finalize in `stop`, with a defensive
  finalization timeout for iOS flakiness.
- Recording without audio is implemented by building a recording `MediaStream`
  containing only the video track.

## Advanced controls (capability-driven)

`track.getCapabilities()` may be `undefined` on older builds (always
feature-detected). Even where present, **photographic controls are essentially
Chromium-Android-only**:

| Control                                  | Chromium Android | Chromium desktop | Firefox | Safari |
| ---------------------------------------- | ---------------- | ---------------- | ------- | ------ |
| zoom                                     | common           | rare (HW-dep)    | no      | no     |
| torch                                    | common (rear)    | no               | no      | no     |
| focusMode/Distance                       | often            | rare             | no      | no     |
| exposureMode/Compensation                | often            | rare             | no      | no     |
| whiteBalance/colorTemperature            | sometimes        | rare             | no      | no     |
| brightness/contrast/saturation/sharpness | device-dep       | rare             | no      | no     |
| frameRate/aspectRatio (standard)         | yes              | yes              | yes     | yes    |

Every control is gated on presence in `getCapabilities()`; unsupported controls
are hidden/disabled with an explanation and **never break the preview**.
`applyConstraints({ advanced: [...] })` is always wrapped in try/catch.

## Mirroring

Two independent flags (`utils`/preferences):

- **Preview mirror** — CSS `transform: scaleX(-1)` on `<video>` for the
  user-facing camera (matches selfie expectation). Affects only the screen.
- **Output mirror** — the canvas is flipped (`translate + scale(-1,1)`) before
  `drawImage` when the user opts in. Default output is **un-mirrored** ("what
  others see"). Recorded video is saved un-mirrored.

## Page lifecycle / teardown

Hiding a tab does **not** stop tracks (desktop camera light stays on); iOS mutes
capture on background. To release the camera we explicitly
`getTracks().forEach(t => t.stop())` and clear `video.srcObject` on: user Stop,
component unmount, `pagehide`, and `visibilitychange → hidden`. We use `pagehide`
(not the deprecated `unload`/`beforeunload`). On iOS we re-acquire a fresh stream
on return-to-foreground rather than reusing a muted track.

## Known limitations (honest)

- **WebKit/Playwright:** no dependable headless fake-camera path, and WebKit is
  not installed in this repo's CI. Media E2E runs on **Chromium (primary)** and
  **Firefox (secondary)**; Safari/WebKit media behavior is validated manually
  (see [testing-strategy.md](./testing-strategy.md) and the manual checklist).
- **Advanced controls** can't be exercised by Chromium fake devices (no
  zoom/torch capabilities), so their UI logic is unit-tested and manually
  verified on real Android Chrome.
- **ImageCapture** is exercised via the canvas fallback in automated tests; the
  ImageCapture upgrade path is unit-tested with a mock and manually verified on
  Chromium.
