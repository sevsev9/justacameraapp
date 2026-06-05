import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  DeviceService,
  devicesChanged,
  facingFromLabel,
  pickFlipTarget,
  cameraDisplayName,
} from '@/services/device-service'
import type { MediaDeviceOption } from '@/types/media'
import { installMediaMocks, uninstallMediaMocks } from '../helpers/media-mocks'

afterEach(() => {
  uninstallMediaMocks()
  vi.useRealTimers()
})

describe('DeviceService.enumerate', () => {
  it('maps cameras and microphones with facing and labels', async () => {
    installMediaMocks({
      cameras: [
        { deviceId: 'cam-front', label: 'Front Camera' },
        { deviceId: 'cam-back', label: 'Back Camera' },
      ],
      microphones: [{ deviceId: 'mic-1', label: 'Built-in Microphone' }],
    })
    const list = await new DeviceService().enumerate()
    expect(list.cameras).toHaveLength(2)
    expect(list.microphones).toHaveLength(1)
    expect(list.cameras[0]!.facing).toBe('user')
    expect(list.cameras[1]!.facing).toBe('environment')
    expect(list.labelsAvailable).toBe(true)
  })

  it('reports labelsAvailable false when labels are blank (pre-permission)', async () => {
    installMediaMocks({ cameras: [{ deviceId: 'cam', label: '' }], microphones: [] })
    const list = await new DeviceService().enumerate()
    expect(list.labelsAvailable).toBe(false)
  })
})

describe('DeviceService.onDeviceChange', () => {
  it('debounces and delivers a fresh list, and unsubscribes cleanly', async () => {
    vi.useFakeTimers()
    const mocks = installMediaMocks()
    const service = new DeviceService()
    const cb = vi.fn()
    const off = service.onDeviceChange(cb, 300)

    mocks.fireDeviceChange()
    mocks.fireDeviceChange() // coalesced
    expect(cb).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(300)
    expect(cb).toHaveBeenCalledTimes(1)

    expect(mocks.listenerCount()).toBe(1)
    off()
    expect(mocks.listenerCount()).toBe(0)
  })
})

describe('facingFromLabel', () => {
  it('classifies labels', () => {
    expect(facingFromLabel('FaceTime HD (front)')).toBe('user')
    expect(facingFromLabel('Rear wide camera')).toBe('environment')
    expect(facingFromLabel('USB Webcam')).toBe('unknown')
  })
})

describe('pickFlipTarget', () => {
  const cam = (deviceId: string, facing: MediaDeviceOption['facing']): MediaDeviceOption => ({
    deviceId,
    kind: 'videoinput',
    label: `${deviceId}`,
    facing,
  })

  it('toggles to the opposite facing rather than cycling by index (S26 Ultra case)', () => {
    // Several front cameras then a back one — naive next-index would stay front.
    const cams = [cam('f0', 'user'), cam('f1', 'user'), cam('b0', 'environment')]
    const target = pickFlipTarget(cams, 'f0', 'user')
    expect(target?.deviceId).toBe('b0')
  })

  it('flips back to a front camera from the rear', () => {
    const cams = [cam('f0', 'user'), cam('b0', 'environment')]
    expect(pickFlipTarget(cams, 'b0', 'environment')?.deviceId).toBe('f0')
  })

  it('falls back to the next index when facing is unknown', () => {
    const cams = [cam('c0', 'unknown'), cam('c1', 'unknown')]
    expect(pickFlipTarget(cams, 'c0', 'unknown')?.deviceId).toBe('c1')
  })

  it('returns undefined with fewer than two cameras', () => {
    expect(pickFlipTarget([cam('c0', 'user')], 'c0', 'user')).toBeUndefined()
  })
})

describe('cameraDisplayName', () => {
  const cam = (
    deviceId: string,
    facing: MediaDeviceOption['facing'],
    label = '',
  ): MediaDeviceOption => ({
    deviceId,
    kind: 'videoinput',
    label,
    facing,
  })

  it('names single front/back cameras simply', () => {
    const cams = [cam('f', 'user'), cam('b', 'environment')]
    expect(cameraDisplayName(cams[0]!, cams)).toBe('Front camera')
    expect(cameraDisplayName(cams[1]!, cams)).toBe('Back camera')
  })

  it('numbers duplicates of the same facing (the S26 Ultra case)', () => {
    // Raw labels would be "camera 1/3, facing front" + "camera 0/2, facing back".
    const cams = [
      cam('f1', 'user', 'camera 1, facing front'),
      cam('f3', 'user', 'camera 3, facing front'),
      cam('b2', 'environment', 'camera 2, facing back'),
      cam('b0', 'environment', 'camera 0, facing back'),
    ]
    expect(cameraDisplayName(cams[0]!, cams)).toBe('Front camera 1')
    expect(cameraDisplayName(cams[1]!, cams)).toBe('Front camera 2')
    expect(cameraDisplayName(cams[2]!, cams)).toBe('Back camera 1')
    expect(cameraDisplayName(cams[3]!, cams)).toBe('Back camera 2')
  })

  it('keeps a real label for named devices with unknown facing', () => {
    const cams = [cam('u', 'unknown', 'Logitech BRIO')]
    expect(cameraDisplayName(cams[0]!, cams)).toBe('Logitech BRIO')
  })

  it('falls back to an index for unlabeled unknown cameras', () => {
    const cams = [cam('a', 'unknown', ''), cam('b', 'unknown', '')]
    expect(cameraDisplayName(cams[1]!, cams)).toBe('Camera 2')
  })
})

describe('devicesChanged', () => {
  it('detects added/removed devices', () => {
    const base = {
      cameras: [
        { deviceId: 'a', kind: 'videoinput' as const, label: '', facing: 'unknown' as const },
      ],
      microphones: [],
      labelsAvailable: false,
    }
    const more = {
      ...base,
      cameras: [
        ...base.cameras,
        { deviceId: 'b', kind: 'videoinput' as const, label: '', facing: 'unknown' as const },
      ],
    }
    expect(devicesChanged(base, base)).toBe(false)
    expect(devicesChanged(base, more)).toBe(true)
  })
})
