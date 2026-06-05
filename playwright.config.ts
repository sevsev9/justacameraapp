import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright E2E config for justacamera.app.
 *
 * Media support reality (see docs/testing-strategy.md):
 *  - Chromium: full fake-media support (--use-fake-device-for-media-stream +
 *    --use-fake-ui-for-media-stream auto-grants camera/mic; built-in synthetic
 *    video pattern is used, so no Y4M fixture file is required).
 *  - Firefox: fake media via firefoxUserPrefs (synthetic pattern only).
 *  - WebKit: no dependable headless fake-camera path and not installed in this
 *    environment; media specs skip on webkit.
 *
 * Tests run against the PRODUCTION PREVIEW build so the real artifact (with the
 * production CSP/headers applied by the preview plugin) is validated.
 */
const PORT = 4173
const baseURL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : [['html', { open: 'never' }]],
  timeout: 30_000,
  expect: { timeout: 7_500 },

  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
    // The privacy guard fixture relies on no service worker hiding requests.
    serviceWorkers: 'block',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        permissions: ['camera', 'microphone'],
        launchOptions: {
          args: [
            '--use-fake-device-for-media-stream',
            '--use-fake-ui-for-media-stream',
            '--autoplay-policy=no-user-gesture-required',
          ],
        },
      },
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        launchOptions: {
          firefoxUserPrefs: {
            'media.navigator.streams.fake': true,
            'media.navigator.permission.disabled': true,
            'permissions.default.camera': 1,
            'permissions.default.microphone': 1,
            'media.autoplay.default': 0,
            'media.autoplay.blocking_policy': 0,
          },
        },
      },
    },
  ],

  webServer: {
    command: `npm run build-only && npm run preview -- --port ${PORT} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
})
