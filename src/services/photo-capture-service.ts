import type { CapturedPhoto, PhotoCaptureOptions } from '@/types/media'

/**
 * PhotoCaptureService — captures a still image entirely locally.
 *
 * Strategy (see docs/browser-support.md):
 *  - Canvas (`drawImage(video) → toBlob`) is the universal default that works in
 *    every browser.
 *  - ImageCapture.takePhoto() is an opportunistic upgrade used ONLY when it is
 *    present AND getPhotoCapabilities() resolves (full-resolution stills on
 *    Chromium/Android). Any failure falls back to canvas.
 *
 * Mirroring is independent of the preview: the exported image is flipped only
 * when `options.mirror` is true (the "mirror saved output" preference). The
 * canvas captures raw, un-mirrored pixels otherwise.
 *
 * No network request is ever made; the result is an in-memory Blob.
 */
export class PhotoCaptureService {
  /** A reusable canvas to avoid per-capture allocation. */
  private canvas: HTMLCanvasElement | null = null

  async capture(
    video: HTMLVideoElement,
    track: MediaStreamTrack | undefined,
    options: PhotoCaptureOptions,
    now: () => number = () => Date.now(),
  ): Promise<CapturedPhoto> {
    // Try ImageCapture upgrade first (only worthwhile when not mirroring the
    // output, since ImageCapture cannot mirror — mirrored output always uses the
    // canvas path).
    if (!options.mirror && track && this.canUseImageCapture()) {
      const viaImageCapture = await this.tryImageCapture(track, options, now)
      if (viaImageCapture) return viaImageCapture
    }
    return this.captureViaCanvas(video, options, now)
  }

  private canUseImageCapture(): boolean {
    return typeof window !== 'undefined' && 'ImageCapture' in window
  }

  private async tryImageCapture(
    track: MediaStreamTrack,
    options: PhotoCaptureOptions,
    now: () => number,
  ): Promise<CapturedPhoto | null> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Ctor = (window as any).ImageCapture
      const capturer = new Ctor(track)
      // Probe capabilities; Firefox's partial impl throws here.
      if (typeof capturer.getPhotoCapabilities === 'function') {
        await capturer.getPhotoCapabilities()
      }
      const blob: Blob = await capturer.takePhoto()
      // ImageCapture returns the device's native format (usually JPEG/PNG); if
      // the user asked for a different format, re-encode via canvas instead.
      if (options.format !== 'image/jpeg' && blob.type !== options.format) {
        return null
      }
      const dims = await blobDimensions(blob)
      return {
        blob,
        width: dims.width,
        height: dims.height,
        format: options.format,
        method: 'image-capture',
        capturedAt: now(),
      }
    } catch {
      return null
    }
  }

  private async captureViaCanvas(
    video: HTMLVideoElement,
    options: PhotoCaptureOptions,
    now: () => number,
  ): Promise<CapturedPhoto> {
    const width = video.videoWidth || video.clientWidth
    const height = video.videoHeight || video.clientHeight
    if (!width || !height) {
      throw new Error('Video frame is not ready for capture')
    }

    const canvas = this.getCanvas()
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas 2D context unavailable')

    if (options.mirror) {
      ctx.save()
      ctx.translate(width, 0)
      ctx.scale(-1, 1)
      ctx.drawImage(video, 0, 0, width, height)
      ctx.restore()
    } else {
      ctx.drawImage(video, 0, 0, width, height)
    }

    const blob = await canvasToBlob(canvas, options.format, options.quality)
    return {
      blob,
      width,
      height,
      format: options.format,
      method: 'canvas',
      capturedAt: now(),
    }
  }

  private getCanvas(): HTMLCanvasElement {
    if (!this.canvas) this.canvas = document.createElement('canvas')
    return this.canvas
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('canvas.toBlob produced no blob'))
      },
      type,
      type === 'image/png' ? undefined : quality,
    )
  })
}

async function blobDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  try {
    if (typeof createImageBitmap === 'function') {
      const bmp = await createImageBitmap(blob)
      const dims = { width: bmp.width, height: bmp.height }
      bmp.close()
      return dims
    }
  } catch {
    // fall through
  }
  return { width: 0, height: 0 }
}
