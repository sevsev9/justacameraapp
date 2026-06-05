# Telemetry schema — justacamera.app

## Status: telemetry is DISABLED

justacamera.app ships with **no telemetry, no analytics, and no network
reporting of any kind**. There is no collector, no endpoint, and no client code
that transmits usage data. This document exists so that the privacy posture is
explicit and auditable, and so that _if_ telemetry were ever proposed, there is a
binding schema and an enforced denylist already in place.

## Hard rules (binding)

If telemetry is ever added, it MUST obey all of the following, or it does not
ship:

1. **No media, ever.** No camera frames, photos, video, audio, `Blob`,
   `File`, `ArrayBuffer`, typed arrays, base64-encoded media, or `blob:`/`data:`
   media URLs.
2. **No exact device identifiers.** No `deviceId`, `groupId`, raw device
   `label`s, media hashes, exact filenames, or any persistent visitor ID.
3. **No third-party runtime scripts** and **no cookies**. First-party only.
4. **Disabled by default**, opt-in only, with a strict allowlist of fields.
5. **Bucketed values** for any hardware characteristic (fingerprinting defense),
   using [`src/utils/bucket.ts`](../src/utils/bucket.ts).
6. **Every field documented** in the allowlist below before it may be sent.
7. **Automated tests** prove prohibited fields cannot be transmitted
   (the sanitizer denylist + `findSensitiveLeaks` already enforce this).

The denylist is the single source of truth in
[`src/utils/sanitize.ts`](../src/utils/sanitize.ts) (`SENSITIVE_KEYS` + media
detection). Any telemetry payload would be passed through `sanitizeForExport`
and rejected if `findSensitiveLeaks` returned anything.

## Hypothetical allowlist (NOT active)

The ONLY fields that could ever be considered, all coarse and non-identifying:

| Field                     | Type   | Example                           | Source / bucketing             |
| ------------------------- | ------ | --------------------------------- | ------------------------------ |
| `event`                   | enum   | `camera_started`                  | fixed event name               |
| `appVersion`              | string | `0.1.0`                           | build constant                 |
| `resolutionBucket`        | enum   | `1080p`                           | `bucketResolution()`           |
| `frameRateBucket`         | enum   | `30`                              | `bucketFrameRate()`            |
| `recordingDurationBucket` | enum   | `30-120s`                         | `bucketDuration()`             |
| `recordingContainer`      | enum   | `webm` \| `mp4`                   | from chosen mime container     |
| `photoMethod`             | enum   | `canvas` \| `image-capture`       | capture method                 |
| `captureMethodFallback`   | bool   | `true`                            | whether ImageCapture fell back |
| `prefersReducedMotion`    | bool   | `true`                            | media query                    |
| `browserEngine`           | enum   | `chromium` \| `gecko` \| `webkit` | coarse UA family               |

Explicitly forbidden (never in any allowlist): IP-derived geo, user agent string,
screen fingerprint, canvas/WebGL fingerprint, install ID, session ID, exact
timestamps tied to a user, device labels/IDs, file names.

## If telemetry is implemented later

1. Add an explicit, default-off opt-in toggle in settings.
2. Build payloads only from the allowlist above; bucket every numeric.
3. Pass through `sanitizeForExport` and assert `findSensitiveLeaks(payload)` is
   empty before any send.
4. Use a **first-party** endpoint reachable under a CSP that would have to be
   widened from `connect-src 'self'` — that CSP change is itself the review gate.
5. Update this document and the README; add tests for every new field.
