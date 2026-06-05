import { describe, it, expect, afterEach, vi } from 'vitest'
import { PhotoCaptureService } from '@/services/photo-capture-service'
import type { PhotoCaptureOptions } from '@/types/media'

/**
 * jsdom has no real canvas/ImageCapture, so we stub document.createElement to
 * return a fake canvas and (optionally) install a fake window.ImageCapture.
 */
function fakeCtx() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    drawImage: vi.fn(),
  }
}

function stubCanvas() {
  const ctx = fakeCtx()
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => ctx),
    toBlob: (cb: (b: Blob | null) => void, type: string) => {
      cb(new Blob(['img'], { type }))
    },
  }
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
    if (tag === 'canvas') return canvas as unknown as HTMLElement
    return document.createElementNS('http://www.w3.org/1999/xhtml', tag) as HTMLElement
  }) as typeof document.createElement)
  return { canvas, ctx }
}

function fakeVideo(): HTMLVideoElement {
  return {
    videoWidth: 1280,
    videoHeight: 720,
    clientWidth: 1280,
    clientHeight: 720,
  } as HTMLVideoElement
}

const opts = (over: Partial<PhotoCaptureOptions> = {}): PhotoCaptureOptions => ({
  format: 'image/jpeg',
  quality: 0.92,
  mirror: false,
  ...over,
})

afterEach(() => {
  vi.restoreAllMocks()
  delete (window as unknown as Record<string, unknown>).ImageCapture
})

describe('PhotoCaptureService — canvas fallback', () => {
  it('captures via canvas when ImageCapture is unavailable', async () => {
    const { canvas } = stubCanvas()
    const svc = new PhotoCaptureService()
    const photo = await svc.capture(fakeVideo(), undefined, opts(), () => 123)
    expect(photo.method).toBe('canvas')
    expect(photo.width).toBe(1280)
    expect(photo.height).toBe(720)
    expect(photo.blob.type).toBe('image/jpeg')
    expect(photo.capturedAt).toBe(123)
    expect(canvas.width).toBe(1280)
  })

  it('mirrors the exported image only when mirror is true', async () => {
    const { ctx } = stubCanvas()
    const svc = new PhotoCaptureService()
    await svc.capture(fakeVideo(), undefined, opts({ mirror: true }), () => 0)
    expect(ctx.translate).toHaveBeenCalledWith(1280, 0)
    expect(ctx.scale).toHaveBeenCalledWith(-1, 1)
  })

  it('does not flip the canvas when mirror is false', async () => {
    const { ctx } = stubCanvas()
    const svc = new PhotoCaptureService()
    await svc.capture(fakeVideo(), undefined, opts({ mirror: false }), () => 0)
    expect(ctx.scale).not.toHaveBeenCalled()
  })

  it('throws when the video frame is not ready', async () => {
    stubCanvas()
    const svc = new PhotoCaptureService()
    const notReady = {
      videoWidth: 0,
      videoHeight: 0,
      clientWidth: 0,
      clientHeight: 0,
    } as HTMLVideoElement
    await expect(svc.capture(notReady, undefined, opts(), () => 0)).rejects.toThrow()
  })
})

describe('PhotoCaptureService — ImageCapture upgrade', () => {
  it('uses ImageCapture.takePhoto when available and format matches', async () => {
    stubCanvas()
    class FakeImageCapture {
      constructor(public track: unknown) {}
      async getPhotoCapabilities() {
        return {}
      }
      async takePhoto() {
        return new Blob(['jpeg'], { type: 'image/jpeg' })
      }
    }
    ;(window as unknown as Record<string, unknown>).ImageCapture = FakeImageCapture
    const svc = new PhotoCaptureService()
    const track = {} as MediaStreamTrack
    const photo = await svc.capture(fakeVideo(), track, opts({ format: 'image/jpeg' }), () => 0)
    expect(photo.method).toBe('image-capture')
  })

  it('falls back to canvas when ImageCapture throws', async () => {
    stubCanvas()
    class ThrowingImageCapture {
      constructor() {
        throw new Error('not really supported')
      }
    }
    ;(window as unknown as Record<string, unknown>).ImageCapture = ThrowingImageCapture
    const svc = new PhotoCaptureService()
    const photo = await svc.capture(fakeVideo(), {} as MediaStreamTrack, opts(), () => 0)
    expect(photo.method).toBe('canvas')
  })

  it('uses canvas (not ImageCapture) when mirror output is requested', async () => {
    stubCanvas()
    class FakeImageCapture {
      async getPhotoCapabilities() {
        return {}
      }
      async takePhoto() {
        return new Blob(['jpeg'], { type: 'image/jpeg' })
      }
    }
    ;(window as unknown as Record<string, unknown>).ImageCapture = FakeImageCapture
    const svc = new PhotoCaptureService()
    const photo = await svc.capture(
      fakeVideo(),
      {} as MediaStreamTrack,
      opts({ mirror: true }),
      () => 0,
    )
    expect(photo.method).toBe('canvas')
  })
})
