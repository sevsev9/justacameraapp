/**
 * Single source of truth for the application's HTTP security headers.
 *
 * These values are intentionally duplicated (in static text) into the
 * deployment configs under `deploy/` (Caddyfile, nginx.conf). The unit test
 * `tests/unit/security/security-headers.spec.ts` asserts the deployment configs
 * stay in sync with the directives declared here, so this object is the
 * authoritative definition.
 *
 * The same headers are applied to the Vite *preview* server (which serves the
 * production build) so that CSP violations are caught locally before deploy.
 * They are NOT applied to the Vite *dev* server, which requires its own relaxed
 * CSP for HMR (inline scripts + eval + websocket to localhost).
 *
 * Privacy/security rationale lives in docs/threat-model.md and docs/privacy-model.md.
 */

/**
 * Content-Security-Policy directives.
 *
 * - script-src 'self'        : a default Vite build emits only external hashed
 *                              modules — no inline scripts — so no 'unsafe-inline'
 *                              or nonce is required. The @vitejs/plugin-legacy
 *                              plugin is deliberately NOT used (it would inject
 *                              inline scripts).
 * - style-src 'self' 'unsafe-inline'
 *                            : Vue's runtime sets inline `style` attributes for
 *                              v-show and :style bindings. Inline style
 *                              ATTRIBUTES are governed by the style-src directive
 *                              (no separate style-src-attr is sent), which must
 *                              include 'unsafe-inline' to allow them. This is low
 *                              risk because script-src stays strict, so injected
 *                              styles cannot execute code.
 * - img-src / media-src 'self' blob'
 *                            : captured stills/clips use URL.createObjectURL()
 *                              (blob: URLs). The LIVE preview uses
 *                              video.srcObject (no blob: needed). data: is NOT
 *                              allowed — Vite's build.assetsInlineLimit is set to
 *                              0 so no asset is inlined as a data: URI.
 * - connect-src 'self'       : the app makes no cross-origin requests at all.
 * - worker-src 'self' blob'  : reserved for the optional (deferred) service
 *                              worker / blob workers.
 */
export const CSP_DIRECTIVES: Record<string, string[]> = {
  'default-src': ["'self'"],
  'script-src': ["'self'"],
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", 'blob:'],
  'media-src': ["'self'", 'blob:'],
  'connect-src': ["'self'"],
  'worker-src': ["'self'", 'blob:'],
  'font-src': ["'self'"],
  'manifest-src': ["'self'"],
  'object-src': ["'none'"],
  'base-uri': ["'none'"],
  'form-action': ["'none'"],
  'frame-ancestors': ["'none'"],
  'upgrade-insecure-requests': [],
}

export function buildCsp(directives: Record<string, string[]> = CSP_DIRECTIVES): string {
  return Object.entries(directives)
    .map(([key, values]) => (values.length > 0 ? `${key} ${values.join(' ')}` : key))
    .join('; ')
}

/**
 * Permissions-Policy: allow camera + microphone for our own origin only; deny
 * every other powerful feature. display-capture/fullscreen are allowed to self
 * in case a future "share screen to inspect" or fullscreen-preview feature is
 * added; everything privacy-sensitive is denied with an empty allowlist.
 */
export const PERMISSIONS_POLICY = [
  'camera=(self)',
  'microphone=(self)',
  'display-capture=(self)',
  'fullscreen=(self)',
  'geolocation=()',
  'browsing-topics=()',
  'payment=()',
  'usb=()',
  'serial=()',
  'hid=()',
  'bluetooth=()',
  'accelerometer=()',
  'gyroscope=()',
  'magnetometer=()',
  'midi=()',
].join(', ')

/**
 * The complete set of response headers for production / preview.
 * COEP is deliberately NOT set (no SharedArrayBuffer need; it breaks
 * cross-origin subresources). COOP same-origin is a safe hardening win.
 */
export function securityHeaders(): Record<string, string> {
  return {
    'Content-Security-Policy': buildCsp(),
    'Permissions-Policy': PERMISSIONS_POLICY,
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    // HSTS is only meaningful over HTTPS; the deploy configs add it. We omit it
    // from the local preview server (which is plain HTTP on localhost).
  }
}

/** Directive keys that the deployment-config sync test must verify are present. */
export const REQUIRED_DEPLOY_TOKENS = [
  'Content-Security-Policy',
  'Permissions-Policy',
  'Cross-Origin-Opener-Policy',
  'Referrer-Policy',
  'X-Content-Type-Options',
  'frame-ancestors',
  'object-src',
  'base-uri',
  'form-action',
  'camera=(self)',
  'microphone=(self)',
] as const
