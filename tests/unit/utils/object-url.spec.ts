import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ObjectUrlRegistry } from '@/utils/object-url'

describe('ObjectUrlRegistry', () => {
  beforeEach(() => {
    vi.spyOn(URL, 'createObjectURL').mockImplementation((() => {
      return `blob:test/${Math.random().toString(36).slice(2)}`
    }) as typeof URL.createObjectURL)
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  })

  it('creates and tracks object URLs', () => {
    const registry = new ObjectUrlRegistry()
    const url = registry.create(new Blob(['x']))
    expect(url).toMatch(/^blob:/)
    expect(registry.size).toBe(1)
  })

  it('revokes a single tracked URL', () => {
    const registry = new ObjectUrlRegistry()
    const url = registry.create(new Blob(['x']))
    registry.revoke(url)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(url)
    expect(registry.size).toBe(0)
  })

  it('ignores revoking unknown or null URLs', () => {
    const registry = new ObjectUrlRegistry()
    registry.revoke('blob:unknown')
    registry.revoke(null)
    registry.revoke(undefined)
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
  })

  it('revokes every tracked URL on revokeAll', () => {
    const registry = new ObjectUrlRegistry()
    registry.create(new Blob(['a']))
    registry.create(new Blob(['b']))
    registry.create(new Blob(['c']))
    expect(registry.size).toBe(3)
    registry.revokeAll()
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(3)
    expect(registry.size).toBe(0)
  })

  it('does not double-revoke', () => {
    const registry = new ObjectUrlRegistry()
    const url = registry.create(new Blob(['x']))
    registry.revoke(url)
    registry.revoke(url)
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1)
  })
})
