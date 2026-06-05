import { test, expect } from '@playwright/test'
import {
  installExfilGuard,
  forceDownloadFallback,
  assertNoPersistedMedia,
  trackConsoleErrors,
} from './helpers'

// Release-blocking privacy invariants. Run on Chromium (deterministic media).
test.skip(
  ({ browserName }) => browserName !== 'chromium',
  'privacy invariants validated on Chromium',
)

test('@privacy full capture/record/playback/download flow makes no exfiltration', async ({
  context,
  page,
}) => {
  const guard = await installExfilGuard(context)
  await forceDownloadFallback(context)
  const errors = trackConsoleErrors(page)

  await page.goto('/')
  await page.getByRole('button', { name: 'Start camera' }).click()
  await expect(page.getByRole('button', { name: 'Take photo' })).toBeVisible({ timeout: 15000 })

  // Photo
  await page.getByRole('button', { name: 'Take photo' }).click()
  await expect(page.getByRole('dialog', { name: 'Photo' })).toBeVisible()
  await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download' }).click(),
  ])
  await page.getByRole('button', { name: 'Discard' }).click()

  // Recording + playback + download
  await page.getByRole('button', { name: 'Start recording' }).click()
  await page.waitForTimeout(1200)
  await page.getByRole('button', { name: 'Stop recording' }).click()
  const dialog = page.getByRole('dialog', { name: 'Recording' })
  await expect(dialog).toBeVisible({ timeout: 10000 })
  await dialog.locator('video').evaluate((v: HTMLVideoElement) => v.play().catch(() => {}))
  await Promise.all([
    page.waitForEvent('download'),
    dialog.getByRole('button', { name: 'Download' }).click(),
  ])

  // Assertions: nothing left the browser.
  const rtcBlocked = await page.evaluate(
    () => (window as unknown as { __rtcBlocked: boolean }).__rtcBlocked,
  )
  expect(rtcBlocked, 'app never constructs RTCPeerConnection').toBe(false)
  expect(guard.violations, `exfiltration violations:\n${guard.violations.join('\n')}`).toEqual([])
  expect(errors).toEqual([])

  await assertNoPersistedMedia(page)
})

test('@privacy diagnostic export contains no device identifiers', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Start camera' }).click()
  await expect(page.getByRole('button', { name: 'Take photo' })).toBeVisible({ timeout: 15000 })
  await page.getByRole('button', { name: 'Open settings and diagnostics' }).click()
  // Diagnostics is a collapsed disclosure by default — expand it.
  await page.getByText('Diagnostics', { exact: true }).click()
  await expect(page.getByText(/excludes device IDs/i)).toBeVisible()

  // The rendered diagnostics must not expose raw deviceId/groupId keys.
  const report = await page.evaluate(() => document.body.innerText)
  expect(report).not.toMatch(/"deviceId"/)
  expect(report).not.toMatch(/"groupId"/)
})
