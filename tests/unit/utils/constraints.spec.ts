import { describe, it, expect } from 'vitest'
import {
  buildVideoConstraints,
  buildAudioConstraints,
  buildGumConstraints,
  relaxVideoConstraints,
} from '@/utils/constraints'

const basePrefs = { facing: 'user' as const, resolution: '720p' as const, withAudio: true }

describe('buildVideoConstraints', () => {
  it('uses deviceId exact when a device is selected (priority over facing)', () => {
    const v = buildVideoConstraints({
      preferences: basePrefs,
      videoDeviceId: 'cam-1',
    })
    expect(v.deviceId).toEqual({ exact: 'cam-1' })
    expect(v.facingMode).toBeUndefined()
  })

  it('uses ideal facingMode when no device selected', () => {
    const v = buildVideoConstraints({ preferences: { ...basePrefs, facing: 'environment' } })
    expect(v.facingMode).toEqual({ ideal: 'environment' })
  })

  it('never uses exact width/height (uses ideal)', () => {
    const v = buildVideoConstraints({ preferences: { ...basePrefs, resolution: '1080p' } })
    expect(v.width).toEqual({ ideal: 1920 })
    expect(v.height).toEqual({ ideal: 1080 })
  })

  it('omits width/height for auto resolution', () => {
    const v = buildVideoConstraints({ preferences: { ...basePrefs, resolution: 'auto' } })
    expect(v.width).toBeUndefined()
    expect(v.height).toBeUndefined()
  })

  it('omits facingMode when facing is unknown', () => {
    const v = buildVideoConstraints({ preferences: { ...basePrefs, facing: 'unknown' } })
    expect(v.facingMode).toBeUndefined()
  })
})

describe('buildAudioConstraints', () => {
  it('returns false when audio is disabled', () => {
    expect(buildAudioConstraints({ preferences: { ...basePrefs, withAudio: false } })).toBe(false)
  })

  it('enables echo/noise/gain ideals when audio is on', () => {
    const a = buildAudioConstraints({ preferences: basePrefs })
    expect(a).not.toBe(false)
    if (a !== false) {
      expect(a.echoCancellation).toEqual({ ideal: true })
      expect(a.noiseSuppression).toEqual({ ideal: true })
      expect(a.autoGainControl).toEqual({ ideal: true })
    }
  })

  it('uses audio deviceId exact when provided', () => {
    const a = buildAudioConstraints({ preferences: basePrefs, audioDeviceId: 'mic-1' })
    if (a !== false) expect(a.deviceId).toEqual({ exact: 'mic-1' })
  })
})

describe('buildGumConstraints', () => {
  it('combines video and audio', () => {
    const c = buildGumConstraints({ preferences: basePrefs })
    expect(c.video).toBeTruthy()
    expect(c.audio).toBeTruthy()
  })
})

describe('relaxVideoConstraints', () => {
  it('drops width/height but keeps device/facing', () => {
    const relaxed = relaxVideoConstraints({
      deviceId: { exact: 'cam-1' },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    })
    expect(relaxed.deviceId).toEqual({ exact: 'cam-1' })
    expect(relaxed.width).toBeUndefined()
    expect(relaxed.height).toBeUndefined()
  })
})
