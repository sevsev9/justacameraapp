import { describe, it, expect } from 'vitest'
import {
  buildAdvancedControls,
  supportedAdvancedControls,
  readCapabilities,
  readSettings,
} from '@/utils/capabilities'

describe('buildAdvancedControls', () => {
  it('marks all controls unsupported when capabilities are empty', () => {
    const controls = buildAdvancedControls({}, {})
    expect(controls.length).toBeGreaterThan(0)
    expect(controls.every((c) => !c.supported)).toBe(true)
  })

  it('marks all controls unsupported when capabilities are undefined', () => {
    const controls = buildAdvancedControls(undefined, undefined)
    expect(controls.every((c) => !c.supported)).toBe(true)
  })

  it('builds a range descriptor for zoom with min/max/step/value', () => {
    const controls = buildAdvancedControls({ zoom: { min: 1, max: 4, step: 0.1 } }, { zoom: 2 })
    const zoom = controls.find((c) => c.id === 'zoom')!
    expect(zoom.supported).toBe(true)
    expect(zoom.type).toBe('range')
    expect(zoom.min).toBe(1)
    expect(zoom.max).toBe(4)
    expect(zoom.step).toBe(0.1)
    expect(zoom.value).toBe(2)
  })

  it('builds a toggle descriptor for torch', () => {
    const controls = buildAdvancedControls({ torch: true }, { torch: false })
    const torch = controls.find((c) => c.id === 'torch')!
    expect(torch.supported).toBe(true)
    expect(torch.type).toBe('toggle')
    expect(torch.value).toBe(false)
  })

  it('builds an enum descriptor for focusMode with options', () => {
    const controls = buildAdvancedControls(
      { focusMode: ['continuous', 'manual'] },
      { focusMode: 'continuous' },
    )
    const focus = controls.find((c) => c.id === 'focusMode')!
    expect(focus.supported).toBe(true)
    expect(focus.type).toBe('enum')
    expect(focus.options).toEqual(['continuous', 'manual'])
    expect(focus.value).toBe('continuous')
  })

  it('does not break when only some controls are supported', () => {
    const controls = buildAdvancedControls({ zoom: { min: 1, max: 2 } }, {})
    expect(controls.find((c) => c.id === 'zoom')!.supported).toBe(true)
    expect(controls.find((c) => c.id === 'torch')!.supported).toBe(false)
  })
})

describe('supportedAdvancedControls', () => {
  it('returns only supported controls', () => {
    const controls = supportedAdvancedControls({ torch: true }, {})
    expect(controls.length).toBe(1)
    expect(controls[0]!.id).toBe('torch')
  })
})

describe('readCapabilities / readSettings', () => {
  it('returns undefined when methods are missing', () => {
    expect(readCapabilities(undefined)).toBeUndefined()
    expect(readSettings(undefined)).toBeUndefined()
    expect(readCapabilities({} as MediaStreamTrack)).toBeUndefined()
  })

  it('returns the capabilities object when present', () => {
    const track = {
      getCapabilities: () => ({ zoom: { min: 1, max: 3 } }),
      getSettings: () => ({ width: 1280 }),
    } as unknown as MediaStreamTrack
    expect(readCapabilities(track)).toEqual({ zoom: { min: 1, max: 3 } })
    expect(readSettings(track)).toEqual({ width: 1280 })
  })

  it('swallows throwing getCapabilities', () => {
    const track = {
      getCapabilities: () => {
        throw new Error('nope')
      },
    } as unknown as MediaStreamTrack
    expect(readCapabilities(track)).toBeUndefined()
  })
})
