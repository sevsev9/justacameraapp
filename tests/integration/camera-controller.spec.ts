import { describe, it, expect, afterEach } from 'vitest'
import { CameraController } from '@/services/camera-controller'
import {
  installMediaMocks,
  uninstallMediaMocks,
  type FakeMediaStreamTrack,
} from '../helpers/media-mocks'

afterEach(() => uninstallMediaMocks())

describe('CameraController', () => {
  it('reports media support and secure context with mocks installed', () => {
    installMediaMocks()
    expect(CameraController.isMediaSupported()).toBe(true)
  })

  it('starts a stream and is active', async () => {
    installMediaMocks()
    const controller = new CameraController()
    const stream = await controller.start({ video: true, audio: true })
    expect(stream.getTracks().length).toBe(2)
    expect(controller.isActive()).toBe(true)
    expect(controller.getVideoTrack()).toBeDefined()
    expect(controller.hasAudio()).toBe(true)
  })

  it('stops the previous stream when starting again (single-stream guarantee)', async () => {
    installMediaMocks()
    const controller = new CameraController()
    const first = await controller.start({ video: true })
    const firstTrack = first.getVideoTracks()[0] as unknown as FakeMediaStreamTrack
    await controller.start({ video: true })
    expect(firstTrack.readyState).toBe('ended')
  })

  it('stops every track on stop()', async () => {
    installMediaMocks()
    const controller = new CameraController()
    const stream = await controller.start({ video: true, audio: true })
    const tracks = stream.getTracks() as unknown as FakeMediaStreamTrack[]
    controller.stop()
    expect(tracks.every((t) => t.readyState === 'ended')).toBe(true)
    expect(controller.getStream()).toBeNull()
    expect(controller.isActive()).toBe(false)
  })

  it('stop() is safe to call repeatedly', async () => {
    installMediaMocks()
    const controller = new CameraController()
    await controller.start({ video: true })
    controller.stop()
    expect(() => controller.stop()).not.toThrow()
  })

  it('rejects with the underlying error from getUserMedia', async () => {
    installMediaMocks({ getUserMediaError: { name: 'NotAllowedError' } })
    const controller = new CameraController()
    await expect(controller.start({ video: true })).rejects.toMatchObject({
      name: 'NotAllowedError',
    })
  })

  it('throws a TypeError when media is unsupported', async () => {
    // No mocks installed → navigator.mediaDevices undefined.
    uninstallMediaMocks()
    const controller = new CameraController()
    await expect(controller.start({ video: true })).rejects.toBeInstanceOf(TypeError)
  })

  it('applyVideoConstraints returns false without a track and true with one', async () => {
    installMediaMocks()
    const controller = new CameraController()
    expect(await controller.applyVideoConstraints({ advanced: [{}] })).toBe(false)
    await controller.start({ video: true })
    expect(await controller.applyVideoConstraints({ width: { ideal: 640 } })).toBe(true)
  })
})
