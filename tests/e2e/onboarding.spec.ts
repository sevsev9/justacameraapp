import { test, expect } from '@playwright/test'
import { installMediaMock, installGumCounter, getGumCalls, trackConsoleErrors } from './helpers'

test.describe('onboarding & permission flow', () => {
  test('does not request the camera on initial load', async ({ context, page }) => {
    await installGumCounter(context)
    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'justacamera.app' })).toBeVisible()
    await expect(page.locator('#main').getByText(/everything stays local/i)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Start camera' })).toBeVisible()

    expect(await getGumCalls(page)).toBe(0)
  })

  test('starts the camera only after the explicit Start action', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'needs the deterministic fake camera')
    const errors = trackConsoleErrors(page)
    await page.goto('/')
    await page.getByRole('button', { name: 'Start camera' }).click()

    await expect(page.getByRole('button', { name: 'Take photo' })).toBeVisible({ timeout: 15000 })
    await expect(page.getByText('Camera on')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('shows a recovery path when permission is denied', async ({ context, page }) => {
    await installMediaMock(context, 'denied')
    await page.goto('/')
    await page.getByRole('button', { name: 'Start camera' }).click()

    await expect(page.getByText(/access was blocked/i)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
  })

  test('shows the no-device state', async ({ context, page }) => {
    await installMediaMock(context, 'not-found')
    await page.goto('/')
    await page.getByRole('button', { name: 'Start camera' }).click()

    await expect(page.getByText(/no camera or microphone was found/i)).toBeVisible()
  })

  test('shows the unsupported state without crashing', async ({ context, page }) => {
    await installMediaMock(context, 'unsupported')
    await page.goto('/')

    await expect(page.getByText(/does not support camera access/i)).toBeVisible()
  })

  test('header exposes a "report an issue" deep-link to GitHub', async ({ page }) => {
    await page.goto('/')
    const link = page.getByRole('link', { name: /report a bug or request a feature/i })
    await expect(link).toHaveAttribute('href', /github\.com\/.+\/issues\/new\/choose$/)
    await expect(link).toHaveAttribute('target', '_blank')
    await expect(link).toHaveAttribute('rel', /noopener/)
  })

  test('opens the privacy dialog from the welcome screen', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'How privacy works' }).click()
    await expect(page.getByRole('dialog', { name: 'How privacy works' })).toBeVisible()
    await page.getByRole('button', { name: 'Close dialog' }).click()
    await expect(page.getByRole('dialog', { name: 'How privacy works' })).not.toBeVisible()
  })

  test('offers browser-compatibility help from an error state', async ({ context, page }) => {
    await installMediaMock(context, 'not-found')
    await page.goto('/')
    await page.getByRole('button', { name: 'Start camera' }).click()
    await expect(page.getByText(/no camera or microphone was found/i)).toBeVisible()
    await page.getByRole('button', { name: 'Browser compatibility' }).click()
    await expect(page.getByRole('dialog', { name: 'Browser compatibility' })).toBeVisible()
  })
})
