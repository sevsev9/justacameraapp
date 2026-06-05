# Manual test checklist — justacamera.app

Repeatable manual verification matrix. Automated coverage (Vitest + Playwright on
Chromium/Firefox + axe) is described in [testing-strategy.md](./testing-strategy.md).
This checklist tracks what must be verified **by hand** on real devices, and
honestly separates **tested** from **pending**.

Legend: ✅ verified · 🟡 partial · ⬜ pending · n/a not applicable

## Status as delivered

| Environment                                     | Engine   | How verified                                                                                   | Status |
| ----------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------- | ------ |
| Linux + Chromium (this repo's dev/test env)     | Chromium | Playwright fake-media E2E + Chrome DevTools MCP (welcome/dialogs/themes/responsive/Lighthouse) | ✅     |
| Linux + Firefox                                 | Gecko    | Playwright fake-media (non-media + a11y; media specs skipped)                                  | 🟡     |
| Chrome on Windows                               | Chromium | —                                                                                              | ⬜     |
| Galaxy S26 Ultra (SM-S948B), Android 16, Chrome | Chromium | adb-driven real-device run (see §"Verified on Galaxy S26 Ultra")                               | ✅     |
| Chrome on Windows                               | Chromium | —                                                                                              | ⬜     |
| Edge on Windows                                 | Chromium | —                                                                                              | ⬜     |
| Firefox on Windows/Linux                        | Gecko    | a11y/onboarding only                                                                           | 🟡     |
| Safari on macOS                                 | WebKit   | — (no headless fake camera; not in the test env)                                               | ⬜     |
| Safari on iOS                                   | WebKit   | —                                                                                              | ⬜     |
| Samsung Internet                                | Chromium | —                                                                                              | ⬜     |

WebKit/Safari and the remaining hardware are **pending manual verification** —
the honest limitation documented in the README and
[browser-support.md](./browser-support.md).

## Verified on Galaxy S26 Ultra (real device, adb-driven)

SM-S948B, Android 16, Chrome (Chromium), 1080×2340 @ density 450 → 384×832 CSS
px. Driven over `adb` with an `adb reverse` localhost tunnel (so the device sees
`http://localhost` — a secure context — and the camera works with no cert).
Confirmed working:

- ✅ Loads; camera **not** requested until "Start camera" (site prompt appeared
  only after the gesture); "Allow while visiting the site" → live preview.
- ✅ Front camera preview; **front↔rear flip** (after fix — see below).
- ✅ **Photo capture used `ImageCapture.takePhoto()`** → **3060×4080 (12 MP) JPEG,
  4.9 MB, "full-resolution"** (far above the 720p preview — proves the
  ImageCapture upgrade path on real Android). Mirror note shown correctly.
- ✅ **Download** → Android save dialog with the correct filename →
  `/sdcard/Download/justacamera-photo-20260605-192334.jpg` (5,085,721 bytes).
- ✅ **Video recording** → `0:07 · MP4 (H.264/AAC) · 4.9 MB` with in-dialog
  playback (real H.264 on Android).
- ✅ Negotiated track: 720×1280 @ **60 fps**; supported recording formats were
  MP4 (H.264/AAC) and WebM (VP9/Opus); advanced controls **exposed**: Zoom, Focus
  mode/distance, Exposure mode/compensation, White balance, Color temperature
  (5 unavailable on the front lens, including torch — expected).
- ✅ Secure context: yes · engine: chromium · permissions: granted.

### Issues found on real hardware → fixed

1. **Flip didn't toggle facing** — the device exposes several logical cameras;
   "next index" landed on another front camera. Fixed with `pickFlipTarget`
   (toggle front↔rear by facing). Unit-tested.
2. **Capture controls hidden behind the 3-button nav bar** — Android 3-button
   navigation reports **no `env(safe-area-inset-bottom)`** under
   `viewport-fit=cover`, so the control bar rendered under the nav keys. Fixed
   with a `@media (pointer: coarse)` bottom-clearance floor.
3. **Dialog action row (Download) clipped / below the fold** — same nav-bar cause
   plus tall portrait photos pushed actions off-screen. Fixed with dialog
   nav-clearance.
4. **Result-dialog buttons obscured the clip/photo info text** — the first
   attempt (a sticky in-body action bar) overlapped the meta/note. Fixed by
   moving the actions into the dialog's dedicated footer region (outside the
   scroll area, bordered) and trimming the media preview height so the info is
   always visible above the buttons.

Also validated: countdown overlay (large number + Cancel), record-without-mic
note, light/dark theme toggle, landscape layout (controls reachable), and
Stop-camera returning to the welcome screen (tracks released).

### UX refinements from the critical pass

- **Friendly camera names** — the device picker showed raw, confusing labels
  ("camera 2, facing back", duplicate "facing front" entries with non-sequential
  numbers). Now "Front camera" / "Back camera" (numbered only when more than one
  share a facing); real labels kept for named USB webcams. Unit-tested.
- **Settings simplicity (progressive disclosure)** — the panel was one long
  technical scroll. Advanced controls and Diagnostics are now collapsed
  disclosure sections (Advanced shows an "N available" badge), so the everyday
  controls (camera, mic, resolution, format, countdown, mirror) are front and
  centre.

## Per-environment checklist

For each browser/device, verify:

### Onboarding & permissions

- [ ] Initial load does **not** prompt for the camera.
- [ ] Privacy promise + "no account / not uploaded" messaging is visible.
- [ ] "Start camera" prompts, and Allow → live preview.
- [ ] Deny → clear recovery instructions; "Try again" works.
- [ ] No camera connected → "no device" state.
- [ ] Plain HTTP (non-localhost) → "HTTPS required" state.

### Preview & devices

- [ ] Live preview renders; camera-active indicator shows.
- [ ] Camera switch works (front/rear on mobile).
- [ ] Microphone toggle + selection works; mic indicator reflects state.
- [ ] Stop camera releases the hardware (OS camera light turns off).
- [ ] Connect/disconnect a camera while open is handled.
- [ ] Backgrounding the tab and returning works (esp. iOS).

### Photo

- [ ] Capture works; preview shows the actual saved image.
- [ ] Countdown (3/5/10) works and is announced.
- [ ] Mirror-preview vs mirror-output behave independently and correctly.
- [ ] JPEG/PNG/WebP + quality produce expected files.
- [ ] Retake / discard / download all work; no network request (DevTools).

### Recording

- [ ] Start/stop produces a playable clip; format label is shown.
- [ ] Pause/resume works (note Safari quirks).
- [ ] Record without microphone works.
- [ ] Elapsed time + large-recording warning appear.
- [ ] Leaving mid-recording warns about loss.
- [ ] Download works; no network request (DevTools).

### Diagnostics & advanced

- [ ] Diagnostics show negotiated settings; "Copy report" copies sanitized text
      (no deviceId/groupId/label).
- [ ] Advanced controls appear only when supported (try Android Chrome for
      zoom/torch/focus) and never break the preview.

### Accessibility & responsive

- [ ] Full keyboard operation; visible focus; Esc closes dialogs; focus returns.
- [ ] Screen reader announces camera/recording/photo/error state changes.
- [ ] Light & dark themes both legible; respects OS preference.
- [ ] Usable at 320 px width and 400% zoom with no content loss.
- [ ] Touch targets comfortable; safe-area insets respected on notched devices.
- [ ] Reduced-motion disables non-essential animation.

### Privacy (manual spot-check)

- [ ] DevTools Network: only same-origin asset loads; nothing during capture.
- [ ] Application storage: no media in Cache/IndexedDB/localStorage.
