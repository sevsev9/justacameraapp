import { type BrowserContext, type Page, expect } from '@playwright/test'

/**
 * E2E helpers: deterministic media-failure mocks, the privacy no-exfiltration
 * guard, and the no-persisted-media sweep. See docs/testing-strategy.md.
 */

export type MediaMode = 'granted' | 'denied' | 'not-found' | 'unsupported'

/**
 * Installs a media mock BEFORE app scripts run. 'granted' uses the real Chromium
 * fake device; the others override getUserMedia/mediaDevices to drive the
 * corresponding error UI deterministically.
 */
export async function installMediaMock(context: BrowserContext, mode: MediaMode): Promise<void> {
  if (mode === 'granted') return
  await context.addInitScript((m: string) => {
    if (m === 'unsupported') {
      Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined })
      return
    }
    const md = navigator.mediaDevices
    if (!md) return
    const errName = m === 'denied' ? 'NotAllowedError' : 'NotFoundError'
    md.getUserMedia = () =>
      Promise.reject(Object.assign(new Error('mock media error'), { name: errName }))
    md.enumerateDevices = () => Promise.resolve([])
  }, mode)
}

/**
 * Forces the universal `<a download>` export path (disables the File System
 * Access picker) so downloads surface as Playwright download events instead of a
 * native save dialog the test cannot drive.
 */
export async function forceDownloadFallback(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    Object.defineProperty(window, 'showSaveFilePicker', {
      configurable: true,
      writable: true,
      value: undefined,
    })
  })
}

/** Counts getUserMedia invocations so a test can prove it isn't auto-called. */
export async function installGumCounter(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const w = window as unknown as { __gumCalls: number }
    w.__gumCalls = 0
    const md = navigator.mediaDevices
    if (md && md.getUserMedia) {
      const original = md.getUserMedia.bind(md)
      md.getUserMedia = (...args: Parameters<typeof original>) => {
        w.__gumCalls += 1
        return original(...args)
      }
    }
  })
}

export async function getGumCalls(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as { __gumCalls: number }).__gumCalls)
}

export interface ExfilGuard {
  violations: string[]
}

/**
 * Deny-by-default exfiltration guard. Records any non-same-origin request, any
 * multipart/upload body, any WebSocket, and neutralizes RTCPeerConnection
 * (WebRTC bypasses HTTP routing). Assert `violations` is empty after the flow.
 */
export async function installExfilGuard(context: BrowserContext): Promise<ExfilGuard> {
  const guard: ExfilGuard = { violations: [] }

  await context.addInitScript(() => {
    const w = window as unknown as { __rtcBlocked: boolean }
    w.__rtcBlocked = false
    const blocked = function () {
      w.__rtcBlocked = true
      throw new Error('RTCPeerConnection blocked by privacy guard')
    }
    try {
      // @ts-expect-error override
      window.RTCPeerConnection = blocked
      // @ts-expect-error override
      window.webkitRTCPeerConnection = blocked
    } catch {
      /* ignore */
    }
  })

  const sameOrigin = (url: string) => {
    try {
      const u = new URL(url)
      return u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.protocol === 'data:'
    } catch {
      return true // blob:/data: parse oddly; treat as local
    }
  }

  context.on('request', (req) => {
    const url = req.url()
    if (url.startsWith('blob:') || url.startsWith('data:')) return
    if (!sameOrigin(url)) guard.violations.push(`cross-origin request: ${url}`)
    const ct = req.headers()['content-type'] ?? ''
    if (ct.includes('multipart/form-data')) guard.violations.push(`multipart upload: ${url}`)
  })

  await context.routeWebSocket(/.*/, (ws) => {
    guard.violations.push(`websocket: ${ws.url()}`)
    ws.close()
  })

  return guard
}

/** Sweeps client storage to prove no captured media was persisted. */
export async function assertNoPersistedMedia(page: Page): Promise<void> {
  const result = await page.evaluate(async () => {
    const localValues: string[] = []
    const localKeys = Object.keys(localStorage)
    for (const k of localKeys) localValues.push(localStorage.getItem(k) ?? '')
    const sessionKeys = Object.keys(sessionStorage)

    let cacheKeys: string[] = []
    try {
      if (window.caches) cacheKeys = await caches.keys()
    } catch {
      /* ignore */
    }

    let idbNames: (string | undefined)[] = []
    try {
      if (indexedDB.databases) idbNames = (await indexedDB.databases()).map((d) => d.name)
    } catch {
      /* ignore */
    }

    return { localKeys, localValues, sessionKeys, cacheKeys, idbNames }
  })

  // No service-worker caches and no IndexedDB databases at all.
  expect(result.cacheKeys, 'no Cache Storage entries').toEqual([])
  expect(result.idbNames, 'no IndexedDB databases').toEqual([])
  // Only the app's small preference/theme keys may exist in localStorage.
  for (const key of result.localKeys) {
    expect(key.startsWith('jca:'), `unexpected localStorage key: ${key}`).toBe(true)
  }
  // No stored value looks like media (blob/data URL or large base64).
  for (const value of [...result.localValues]) {
    expect(/^(blob:|data:)/.test(value), 'no media URL in storage').toBe(false)
    expect(value.length, 'no large blob in storage').toBeLessThan(4096)
  }
  expect(result.sessionKeys, 'no sessionStorage media').toEqual([])
}

/** Fails if the page logged any console error during the test. */
export function trackConsoleErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  page.on('pageerror', (err) => errors.push(err.message))
  return errors
}
