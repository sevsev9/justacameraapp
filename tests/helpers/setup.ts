/**
 * Vitest global setup (jsdom environment).
 *
 * jsdom does not implement the media APIs. We provide minimal, overridable
 * polyfills for the few primitives the pure utils touch (object URLs). Tests
 * that exercise getUserMedia / MediaRecorder / ImageCapture install their own
 * mocks (see tests/helpers/media-mocks.ts).
 */
import { afterEach, vi } from 'vitest'

// Stable, inspectable object-URL polyfill for jsdom.
let objectUrlCounter = 0
if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = vi.fn(() => `blob:jsdom/${++objectUrlCounter}`)
}
if (typeof URL.revokeObjectURL !== 'function') {
  URL.revokeObjectURL = vi.fn()
}

afterEach(() => {
  vi.restoreAllMocks()
})
