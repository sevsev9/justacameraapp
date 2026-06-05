import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildCsp,
  securityHeaders,
  PERMISSIONS_POLICY,
  REQUIRED_DEPLOY_TOKENS,
} from '../../../config/security-headers'

const root = process.cwd()
const caddy = readFileSync(resolve(root, 'deploy/Caddyfile'), 'utf8')
const nginx = readFileSync(resolve(root, 'deploy/nginx.conf'), 'utf8')

describe('security headers — definition', () => {
  it('builds a strict CSP with the locked-down directives', () => {
    const csp = buildCsp()
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("script-src 'self'")
    expect(csp).toContain("connect-src 'self'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("base-uri 'none'")
    expect(csp).toContain("form-action 'none'")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).toContain('upgrade-insecure-requests')
    // blob: is allowed for captured-media previews/downloads
    expect(csp).toContain("img-src 'self' blob:")
    expect(csp).toContain("media-src 'self' blob:")
    // data: is NOT allowed (assetsInlineLimit: 0)
    expect(csp).not.toContain('data:')
  })

  it('restricts camera/microphone to self and denies other powerful features', () => {
    expect(PERMISSIONS_POLICY).toContain('camera=(self)')
    expect(PERMISSIONS_POLICY).toContain('microphone=(self)')
    expect(PERMISSIONS_POLICY).toContain('geolocation=()')
  })

  it('sets the supporting headers and intentionally omits COEP', () => {
    const headers = securityHeaders()
    expect(headers['Referrer-Policy']).toBe('no-referrer')
    expect(headers['X-Content-Type-Options']).toBe('nosniff')
    expect(headers['X-Frame-Options']).toBe('DENY')
    expect(headers['Cross-Origin-Opener-Policy']).toBe('same-origin')
    // COEP must NOT be set (breaks cross-origin subresources; not needed).
    expect(headers['Cross-Origin-Embedder-Policy']).toBeUndefined()
  })
})

describe('deploy configs stay in sync with the header policy', () => {
  for (const token of REQUIRED_DEPLOY_TOKENS) {
    it(`Caddyfile contains "${token}"`, () => {
      expect(caddy).toContain(token)
    })
    it(`nginx.conf contains "${token}"`, () => {
      expect(nginx).toContain(token)
    })
  }

  it('both configs ship the full CSP string', () => {
    const csp = buildCsp()
    expect(caddy).toContain(csp)
    expect(nginx).toContain(csp)
  })

  it('both configs force HTTPS via HSTS', () => {
    expect(caddy).toContain('Strict-Transport-Security')
    expect(nginx).toContain('Strict-Transport-Security')
  })
})
