# Security Policy

## Reporting a vulnerability

Please report security vulnerabilities **privately**. Do not open a public GitHub
issue for security reports.

- Preferred: use GitHub's **private vulnerability reporting** ("Report a
  vulnerability" under the repository's _Security_ tab).
- Alternatively, open a minimal GitHub issue asking a maintainer to contact you,
  without disclosing details.

Please include: a description, reproduction steps, affected version/commit, and
the impact (especially anything that could cause media or device identifiers to
leave the browser, or that bypasses the Content-Security-Policy).

We aim to acknowledge reports promptly and will coordinate a fix and disclosure
timeline with you.

## Scope

justacamera.app is a static, client-only web app with **no backend**. The
security model and threats are documented in
[docs/threat-model.md](docs/threat-model.md). Highest-priority concerns:

- Any path that could exfiltrate media (frames/photos/video/audio) or device
  identifiers (`deviceId`/`groupId`/labels) — this is the project's core invariant.
- XSS or CSP bypasses.
- Insecure deployment guidance.

Out of scope: a compromised browser/OS/extension, or another native app
accessing the camera — no web app can defend those layers.

## Supply chain & deployment

- The only runtime dependency is `vue`. The dependency graph is locked
  (`package-lock.json`) and `npm audit` runs in CI.
- Production should be served over HTTPS with the headers in
  [`deploy/`](deploy) (CSP, Permissions-Policy, HSTS, etc.), which are kept in
  sync with [`config/security-headers.ts`](config/security-headers.ts) by a unit
  test.

## Verifying the privacy claim yourself

- Read [docs/privacy-model.md](docs/privacy-model.md).
- Run `npm run test:privacy` (no-exfiltration + no-persisted-media invariants).
- Inspect network activity in your browser's DevTools while using the app — you
  should see only the initial same-origin asset loads.
