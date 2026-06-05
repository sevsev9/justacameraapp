import { test, expect, type Page, type Download } from '@playwright/test'
import { promises as fs } from 'node:fs'
import { forceDownloadFallback, trackConsoleErrors } from './helpers'

async function expectNonEmptyDownload(download: Download) {
  const path = await download.path()
  expect(path).toBeTruthy()
  if (path) {
    const stat = await fs.stat(path)
    expect(stat.size, 'downloaded file is non-empty').toBeGreaterThan(0)
  }
}

// The capture flow needs the deterministic Chromium fake camera + MediaRecorder.
test.skip(({ browserName }) => browserName !== 'chromium', 'media flow validated on Chromium')

test.beforeEach(async ({ context }) => {
  await forceDownloadFallback(context)
})

async function startCamera(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Start camera' }).click()
  await expect(page.getByRole('button', { name: 'Take photo' })).toBeVisible({ timeout: 15000 })
}

test('captures a photo and downloads it (no errors)', async ({ page }) => {
  const errors = trackConsoleErrors(page)
  await startCamera(page)

  await page.getByRole('button', { name: 'Take photo' }).click()
  await expect(page.getByRole('dialog', { name: 'Photo' })).toBeVisible()

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download' }).click(),
  ])
  expect(download.suggestedFilename()).toMatch(/^justacamera-photo-\d{8}-\d{6}\.(jpg|png|webp)$/)
  await expectNonEmptyDownload(download)
  expect(errors).toEqual([])
})

test('records a video, plays it back, and downloads it', async ({ page }) => {
  await startCamera(page)

  await page.getByRole('button', { name: 'Start recording' }).click()
  await expect(page.getByRole('button', { name: 'Stop recording' })).toBeVisible()
  await page.waitForTimeout(1200)
  await page.getByRole('button', { name: 'Stop recording' }).click()

  const dialog = page.getByRole('dialog', { name: 'Recording' })
  await expect(dialog).toBeVisible({ timeout: 10000 })
  await expect(dialog.locator('video')).toBeVisible()

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    dialog.getByRole('button', { name: 'Download' }).click(),
  ])
  expect(download.suggestedFilename()).toMatch(/^justacamera-video-\d{8}-\d{6}\.(webm|mp4)$/)
  await expectNonEmptyDownload(download)
})

test('pauses and resumes a recording', async ({ page }) => {
  await startCamera(page)
  await page.getByRole('button', { name: 'Start recording' }).click()
  await page.getByRole('button', { name: 'Pause recording' }).click()
  await expect(page.getByRole('button', { name: 'Resume recording' })).toBeVisible()
  await page.getByRole('button', { name: 'Resume recording' }).click()
  await expect(page.getByRole('button', { name: 'Pause recording' })).toBeVisible()
  await page.getByRole('button', { name: 'Stop recording' }).click()
  await expect(page.getByRole('dialog', { name: 'Recording' })).toBeVisible({ timeout: 10000 })
})

test('runs a capture countdown', async ({ page }) => {
  await startCamera(page)
  await page.getByRole('button', { name: 'Open settings and diagnostics' }).click()
  await page.getByLabel('Capture countdown').selectOption('3')
  await page.getByRole('button', { name: 'Close dialog' }).click()

  await page.getByRole('button', { name: 'Take photo' }).click()
  // Photo dialog appears after the countdown completes.
  await expect(page.getByRole('dialog', { name: 'Photo' })).toBeVisible({ timeout: 8000 })
})

test('exposes separate mirror-preview and mirror-output controls', async ({ page }) => {
  await startCamera(page)
  await page.getByRole('button', { name: 'Open settings and diagnostics' }).click()
  await expect(page.getByText('Mirror preview', { exact: false })).toBeVisible()
  await expect(page.getByText('Mirror saved photo', { exact: false })).toBeVisible()
})

test('records without microphone audio when disabled', async ({ page }) => {
  await startCamera(page)
  await page.getByRole('button', { name: 'Open settings and diagnostics' }).click()
  await page.getByLabel('Record microphone audio').uncheck()
  await page.getByRole('button', { name: 'Close dialog' }).click()

  await page.getByRole('button', { name: 'Start recording' }).click()
  await page.waitForTimeout(1000)
  await page.getByRole('button', { name: 'Stop recording' }).click()

  const dialog = page.getByRole('dialog', { name: 'Recording' })
  await expect(dialog).toBeVisible({ timeout: 10000 })
  await expect(dialog.getByText(/without microphone audio/i)).toBeVisible()
})

test('stops the camera and returns to the welcome screen', async ({ page }) => {
  await startCamera(page)
  await page.getByRole('button', { name: 'Stop camera' }).click()
  await expect(page.getByRole('button', { name: 'Start camera' })).toBeVisible()
})
