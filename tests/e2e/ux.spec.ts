import { test, expect } from '@playwright/test'

test.describe('keyboard & dialogs', () => {
  test('closes a dialog with the Escape key and returns focus', async ({ page }) => {
    await page.goto('/')
    const trigger = page.getByRole('button', { name: 'How privacy works' })
    await trigger.click()
    await expect(page.getByRole('dialog', { name: 'How privacy works' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'How privacy works' })).not.toBeVisible()
    // Native <dialog> restores focus to the invoker.
    await expect(trigger).toBeFocused()
  })
})

test.describe('media-dependent UX', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'needs the fake camera')

  test('dismissing the photo dialog discards the capture', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Start camera' }).click()
    await expect(page.getByRole('button', { name: 'Take photo' })).toBeVisible({ timeout: 15000 })

    await page.getByRole('button', { name: 'Take photo' }).click()
    await expect(page.getByRole('dialog', { name: 'Photo' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Photo' })).not.toBeVisible()
    // Back to the live workspace; the capture was discarded (not retained).
    await expect(page.getByRole('button', { name: 'Take photo' })).toBeVisible()
  })

  test('mobile layout keeps the capture controls reachable at 384px', async ({ page }) => {
    await page.setViewportSize({ width: 384, height: 832 })
    await page.goto('/')
    await page.getByRole('button', { name: 'Start camera' }).click()
    const shutter = page.getByRole('button', { name: 'Take photo' })
    await expect(shutter).toBeVisible({ timeout: 15000 })
    await expect(shutter).toBeInViewport()
    await expect(page.getByRole('button', { name: 'Stop camera' })).toBeInViewport()
  })
})
