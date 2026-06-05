import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve, extname } from 'node:path'

/**
 * Deterministic privacy/security guard over the application source. Fails the
 * build if a network/exfiltration API, a remote runtime resource, or a
 * media-upload pattern appears in src/. This enforces the no-media-upload and
 * no-third-party-runtime-resource invariants from docs/privacy-model.md.
 */
const root = process.cwd()
const SRC = resolve(root, 'src')

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (['.ts', '.vue'].includes(extname(full))) out.push(full)
  }
  return out
}

const files = walk(SRC).map((path) => ({ path, text: readFileSync(path, 'utf8') }))

// Network/exfiltration APIs the app must never use (it makes no network calls).
const FORBIDDEN_APIS: { name: string; re: RegExp }[] = [
  { name: 'fetch()', re: /\bfetch\s*\(/ },
  { name: 'XMLHttpRequest', re: /\bXMLHttpRequest\b/ },
  { name: 'navigator.sendBeacon', re: /\bsendBeacon\b/ },
  { name: 'WebSocket', re: /\bnew\s+WebSocket\b/ },
  { name: 'RTCPeerConnection', re: /\bRTCPeerConnection\b/ },
  { name: 'EventSource', re: /\bnew\s+EventSource\b/ },
  { name: 'FormData (upload)', re: /\bnew\s+FormData\b/ },
]

// Hosts allowed to appear as link hrefs (not runtime fetches).
const ALLOWED_HOSTS = ['github.com', 'justacamera.app', 'www.w3.org']

function isCommentLine(line: string): boolean {
  const t = line.trim()
  return t.startsWith('*') || t.startsWith('//') || t.startsWith('/*') || t.startsWith('<!--')
}

describe('source guard — no network/exfiltration APIs in src', () => {
  for (const api of FORBIDDEN_APIS) {
    it(`src contains no ${api.name}`, () => {
      const offenders = files.filter((f) => api.re.test(f.text)).map((f) => f.path)
      expect(offenders, `${api.name} found in:\n${offenders.join('\n')}`).toEqual([])
    })
  }
})

describe('source guard — no remote runtime resources in src', () => {
  it('contains no non-allowlisted remote URLs (outside comments)', () => {
    const violations: string[] = []
    const urlRe = /https?:\/\/[^\s'"`)]+/g
    for (const { path, text } of files) {
      for (const rawLine of text.split('\n')) {
        if (isCommentLine(rawLine)) continue
        const matches = rawLine.match(urlRe)
        if (!matches) continue
        for (const url of matches) {
          const host = url.replace(/^https?:\/\//, '').split('/')[0] ?? ''
          if (!ALLOWED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) {
            violations.push(`${path}: ${url}`)
          }
        }
      }
    }
    expect(violations, `Remote URLs found:\n${violations.join('\n')}`).toEqual([])
  })
})

describe('source guard — denylist not referenced as live telemetry', () => {
  it('no module named like telemetry/analytics exists in src', () => {
    const offenders = files
      .map((f) => f.path)
      .filter((p) => /(telemetry|analytics|tracking)/i.test(p))
    expect(offenders).toEqual([])
  })
})
