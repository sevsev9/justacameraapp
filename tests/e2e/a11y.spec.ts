import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { installMediaMock } from './helpers'

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

async function scan(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
  return results.violations
}

test('@a11y welcome screen has no WCAG 2.2 AA violations', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Start camera' })).toBeVisible()
  expect(await scan(page)).toEqual([])
})

test('@a11y permission-denied screen has no violations', async ({ context, page }) => {
  await installMediaMock(context, 'denied')
  await page.goto('/')
  await page.getByRole('button', { name: 'Start camera' }).click()
  await expect(page.getByText(/access was blocked/i)).toBeVisible()
  expect(await scan(page)).toEqual([])
})

test('@a11y privacy dialog has no violations', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'How privacy works' }).click()
  await expect(page.getByRole('dialog', { name: 'How privacy works' })).toBeVisible()
  expect(await scan(page)).toEqual([])
})

test('@a11y active camera workspace has no violations', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'needs the deterministic fake camera')
  await page.goto('/')
  await page.getByRole('button', { name: 'Start camera' }).click()
  await expect(page.getByRole('button', { name: 'Take photo' })).toBeVisible({ timeout: 15000 })
  expect(await scan(page)).toEqual([])
})

test('@a11y settings & diagnostics dialog has no violations', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'needs the deterministic fake camera')
  await page.goto('/')
  await page.getByRole('button', { name: 'Start camera' }).click()
  await expect(page.getByRole('button', { name: 'Take photo' })).toBeVisible({ timeout: 15000 })
  await page.getByRole('button', { name: 'Open settings and diagnostics' }).click()
  await expect(page.getByRole('dialog', { name: 'Settings & diagnostics' })).toBeVisible()
  expect(await scan(page)).toEqual([])
})
