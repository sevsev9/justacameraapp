# Privacy model — justacamera.app

> Just a camera. Your photos, videos, audio, and camera frames never leave this
> device.

Privacy is the **top-priority, non-negotiable invariant** of this project. When
any requirement conflicts with privacy, privacy wins (see the decision priority
in the project brief). This document states the promise, how the architecture
enforces it, and how it is proven by automated tests.

## 1. The promise, precisely

The application is a **static, client-only** web app. After the initial
page/asset load over HTTPS, it makes **no network requests** as part of any
camera, photo, recording, playback, or download operation. There is:

- **No backend.** No API, no media-processing server, no upload endpoint.
- **No accounts, no cookies, no persistent identifiers.**
- **No third-party runtime scripts, fonts, images, or analytics.**
- **No telemetry.** (See [telemetry-schema.md](./telemetry-schema.md).)

## 2. What must NEVER leave the browser

The following are prohibited from transmission by any means (fetch, XHR,
`sendBeacon`, WebSocket, WebRTC `RTCPeerConnection`, form submit, `<img>`/`<a>`
pinging, or embedding into a URL):

| Category                  | Examples                                                                                                                           |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Media payloads            | camera frames, photos, video, audio, `Blob`, `File`, `ArrayBuffer`, typed arrays, base64-encoded media, `blob:`/`data:` media URLs |
| Stable device identifiers | `deviceId`, `groupId`, exact device `label`s                                                                                       |
| Derived identifiers       | media hashes/fingerprints, exact filenames                                                                                         |
| User identifiers          | any persistent visitor ID, email, account                                                                                          |

These are encoded as the denylist in
[`src/utils/sanitize.ts`](../src/utils/sanitize.ts) (`SENSITIVE_KEYS` +
media-shape detection), the single source of truth used by the diagnostics
export and any future telemetry path.

## 3. How the architecture enforces it

### 3.1 No network surface for media

- The app issues **no cross-origin requests**. The CSP `connect-src 'self'`
  (and `default-src 'self'`) blocks any attempt — accidental or malicious — to
  reach another origin. See [threat-model.md](./threat-model.md).
- There is no code path that uploads media. A privacy E2E test asserts that the
  full capture → record → preview → download flow produces **zero** non-same-origin
  requests and no multipart/upload bodies.

### 3.2 Live preview never serializes frames

The live preview binds `video.srcObject = MediaStream` directly. Frames are
never copied to a canvas, blob, or URL for the _preview_. A canvas is touched
only at the explicit moment of a photo capture, and the result stays in memory
as a `Blob`.

### 3.3 Captured media lifecycle

- Photos and recordings live **only in memory** as `Blob`s plus one `blob:`
  object URL for preview/playback.
- Object URLs are tracked and revoked on replacement/teardown
  ([`src/utils/object-url.ts`](../src/utils/object-url.ts)).
- Media is **discarded on refresh/close** — nothing is written to
  `localStorage`, `sessionStorage`, IndexedDB, Cache Storage, OPFS, or cookies.
- The user must explicitly **Download** (or, as progressive enhancement, save via
  the File System Access picker) to persist anything; that write goes to the
  user's own disk, never the network.

### 3.4 Device identifiers stay local

- `deviceId` is used **only** to re-select a device in `getUserMedia`
  constraints. It is held in the device/service layer and the (optional) local
  preferences, and is **stripped** from every diagnostic export and any
  telemetry by the sanitizer.
- Device `label`s are shown in the local UI (after permission) but are **redacted**
  from exports.
- Local preferences persisted to `localStorage` deliberately store the **facing
  preference and resolution choice**, not raw `deviceId`s by default (a `deviceId`
  is profile/origin-scoped and not portable; see
  [browser-support.md](./browser-support.md)). If a future version persists a
  selected `deviceId` for convenience, it stays on-device and is never exported.

## 4. Permission discipline

- The initial page **never** calls `getUserMedia`/`enumerateDevices`
  automatically. Access is requested **only** after the explicit **Start camera**
  user gesture.
- Device **labels** are intentionally blank until permission is granted (browser
  behavior); the UI explains why.
- Stopping the camera stops **every** track, releasing the OS camera indicator.
  Teardown also runs on `pagehide` and on tab-hidden, per
  [browser-support.md](./browser-support.md).

## 5. How we prove it (automated, release-blocking)

The following are CI gates; their failure blocks release:

1. **Unit** — `sanitize.spec.ts`: deviceId/groupId/label/blob/ArrayBuffer/base64/
   blob-url values are redacted; `findSensitiveLeaks` returns empty for a clean
   diagnostic report.
2. **Unit** — `diagnostics` report builder output passes `findSensitiveLeaks`.
3. **E2E (`@privacy`)** — a deny-by-default network guard fails the test on any
   request to a non-same-origin host, any multipart/upload body, and on any
   `RTCPeerConnection` construction (WebRTC bypasses HTTP interception, so it is
   neutralized and asserted in-page). The guard wraps the full
   capture/record/playback/download flow.
4. **E2E (`@privacy`)** — `assertNoPersistedMedia`: after a capture+download
   cycle, Cache Storage, IndexedDB, localStorage and sessionStorage contain no
   media; `navigator.storage.estimate().usage` stays near baseline.
5. **Build/source guard** — a script + test scans the source for prohibited
   patterns (upload endpoints, third-party runtime URLs, `deviceId`/`groupId` in
   any telemetry module).

## 6. Transparency

- The project is open source (AGPL-3.0-or-later) so anyone can audit these
  claims; the hosted-source reciprocity of AGPL means deployed forks must also
  publish their source. See the README and `LICENSE`.
- The UI surfaces the promise on the first screen and links to the source and to
  this document.
- A user-triggered **Copy diagnostic report** produces only sanitized, support-
  useful data — never identifiers or media.
