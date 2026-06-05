# Threat model — justacamera.app

Scope: a static, client-only camera web app with no backend. The primary asset
to protect is **the user's media and device identity** — it must never leave the
device (see [privacy-model.md](./privacy-model.md)). Secondary assets: the
integrity of the served app, and the user's trust.

Method: per-threat, we note the vector, impact, and the mitigation(s) actually
implemented in this repo.

## Trust boundaries

- **Browser ↔ network.** Only the initial same-origin asset load crosses it.
  Everything else (camera, capture, recording, export) stays inside the browser.
- **App ↔ device hardware.** Mediated by the browser permission + Permissions-Policy.
- **App ↔ user disk.** Only via an explicit user-initiated download/save.

## Threats and mitigations

### T1 — XSS leading to camera/media access or exfiltration

- **Vector:** injected script reads frames/blobs and posts them out, or silently
  starts the camera.
- **Mitigations:**
  - Strict **CSP**: `script-src 'self'` (no inline scripts, no `eval`, no remote
    scripts — Vite emits only hashed external modules; the legacy plugin is not
    used). `connect-src 'self'` blocks exfiltration to other origins.
    `object-src 'none'`, `base-uri 'none'`, `form-action 'none'`.
  - Vue escapes interpolated content by default; we never use `v-html` on
    untrusted data (there is no untrusted external data — the app has no inputs
    that round-trip through a server).
  - No `eval`, no dynamic `Function`, no `innerHTML` assembly of remote content.

### T2 — Compromised / malicious dependency (supply chain)

- **Vector:** a transitive dependency ships exfiltration or a backdoor.
- **Mitigations:**
  - Minimal dependency footprint; **one** runtime dependency (`vue`). Everything
    else is dev-only and not shipped to users.
  - Locked dependency graph (`package-lock.json`), `npm audit` gate (run manually; CI/CD is manual for now).
  - The **CSP `connect-src 'self'`** means even a malicious dependency cannot
    reach a remote origin from the browser.
  - No third-party runtime scripts/fonts/images — a source-scan test enforces
    this.

### T3 — Malicious third-party runtime resource

- **Vector:** remote font/script/analytics added later leaks data or enables XSS.
- **Mitigations:** CSP forbids it at runtime; a repo source-scan test fails the
  build if a non-relative `http(s)://` runtime asset/URL appears in `src/` or
  `index.html`.

### T4 — Accidental telemetry / diagnostic leakage

- **Vector:** a diagnostic export or future telemetry includes deviceId/label/media.
- **Mitigations:** single-source sanitizer (`utils/sanitize.ts`) with unit tests;
  diagnostics report runs through it and through `findSensitiveLeaks`; telemetry
  is disabled and documented; a test asserts prohibited fields cannot be exported.

### T5 — Device fingerprinting

- **Vector:** exact capabilities/hardware enumerated and shipped, identifying the
  user.
- **Mitigations:** nothing is shipped at all. Diagnostics are local-only;
  exported diagnostics bucket exact hardware values (`utils/bucket.ts`) and omit
  identifiers. `enumerateDevices` labels are only read after permission and never
  exported.

### T6 — Clickjacking

- **Vector:** the app is framed by a malicious site to trick the user into
  granting camera access.
- **Mitigations:** CSP `frame-ancestors 'none'` (+ legacy `X-Frame-Options:
DENY`). Permissions-Policy restricts camera/microphone to `self`.

### T7 — Media retention in memory or storage

- **Vector:** captured media lingers and is recoverable, or is cached by a SW.
- **Mitigations:** media kept only as in-memory `Blob`s + tracked object URLs,
  revoked on teardown; nothing persisted by default; the (deferred) service
  worker uses a protocol guard that never caches `blob:`/`data:`/media; an E2E
  test (`assertNoPersistedMedia`) proves storage stays clean.

### T8 — Blob URL leakage

- **Vector:** object URLs leak memory or are transmitted.
- **Mitigations:** `ObjectUrlRegistry` tracks + revokes; sanitizer treats
  `blob:` strings as media and redacts them; CSP `connect-src 'self'` prevents
  sending one anywhere.

### T9 — Service-worker caching mistakes (deferred feature)

- **Vector:** an SW caches captured media or serves a stale, insecure version.
- **Mitigations:** SW is deferred until MVP gates pass; when added it precaches
  only the app shell, uses a top-of-fetch protocol guard, prompts (not forces)
  updates, and is covered by the no-persisted-media test. See
  [browser-support.md](./browser-support.md) and the SW ADR (added with the SW).

### T10 — Permission confusion

- **Vector:** user unsure what is active; camera stays on unexpectedly.
- **Mitigations:** explicit Start gesture; persistent, non-color-only
  "camera/mic active" indicator; reachable Stop; SR announcements of
  start/stop/record state; teardown on `pagehide`/hidden.

### T11 — Insecure deployment (no HTTPS)

- **Vector:** served over HTTP; camera silently unavailable or downgraded.
- **Mitigations:** the app detects insecure context (`mediaDevices` undefined)
  and shows an "HTTPS required" state; deploy configs force HTTPS + HSTS
  (`deploy/Caddyfile`, `deploy/nginx.conf`).

### T12 — Denial of service via long/high-res recordings

- **Vector:** an extremely long or 4K recording exhausts memory and crashes the
  tab (self-inflicted, but a reliability/usability risk).
- **Mitigations:** elapsed time + estimated size shown prominently; a long-
  recording warning past a threshold (`LONG_RECORDING_WARNING_MS`); resolution
  is negotiated (`ideal`) and selectable; recordings stay in memory only until
  download/discard; the user is warned before large operations.

### T13 — Cross-origin isolation misconfiguration

- **Vector:** enabling COEP breaks subresources or, conversely, a missing COOP
  enables cross-window attacks.
- **Mitigations:** we deliberately **do not** set COEP (no SharedArrayBuffer
  need; it breaks things). We set `Cross-Origin-Opener-Policy: same-origin` and
  `Cross-Origin-Resource-Policy: same-origin` as low-risk hardening. Documented
  tradeoff in `config/security-headers.ts`.

## Residual risks / accepted limitations

- A user with a compromised browser/OS/extension is out of scope — no web app
  can defend the camera at that layer.
- The app cannot prevent the OS or another native app from accessing the camera.
- WebRTC exfiltration cannot be blocked by HTTP-layer tooling; we mitigate by
  never constructing `RTCPeerConnection` and asserting this in tests, and by CSP
  (which restricts `connect-src` but not raw ICE). A network-isolated deployment
  is the only hard guarantee against a hypothetical malicious build — hence the
  open-source/auditable posture.

## Security headers (summary)

Defined once in [`config/security-headers.ts`](../config/security-headers.ts),
applied to the Vite preview server, and mirrored into the deploy configs (a unit
test asserts they stay in sync):

- `Content-Security-Policy` (strict; `script-src 'self'`, `connect-src 'self'`,
  `img/media-src 'self' blob:`, `object-src/base-uri/form-action/frame-ancestors`
  locked down, `upgrade-insecure-requests`).
- `Permissions-Policy: camera=(self), microphone=(self), …=()`.
- `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`.
- `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, `Strict-Transport-Security` (deploy only).
