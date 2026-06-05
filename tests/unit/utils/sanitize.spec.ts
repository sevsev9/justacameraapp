import { describe, it, expect } from 'vitest'
import { sanitizeForExport, findSensitiveLeaks, REDACTED, SENSITIVE_KEYS } from '@/utils/sanitize'

describe('sanitizeForExport', () => {
  it('redacts deviceId and groupId at any depth', () => {
    const input = {
      camera: { deviceId: 'abc123', groupId: 'grp1', label: 'FaceTime HD' },
      nested: [{ deviceId: 'x' }],
    }
    const out = sanitizeForExport(input) as Record<string, unknown>
    const camera = out.camera as Record<string, unknown>
    expect(camera.deviceId).toBe(REDACTED)
    expect(camera.groupId).toBe(REDACTED)
    expect(camera.label).toBe(REDACTED)
    expect((out.nested as Array<Record<string, unknown>>)[0]!.deviceId).toBe(REDACTED)
  })

  it('redacts Blob, ArrayBuffer and typed-array values', () => {
    const input = {
      photo: new Blob(['x'], { type: 'image/png' }),
      buffer: new ArrayBuffer(8),
      bytes: new Uint8Array([1, 2, 3]),
    }
    const out = sanitizeForExport(input) as Record<string, unknown>
    expect(out.photo).toBe(REDACTED)
    expect(out.buffer).toBe(REDACTED)
    expect(out.bytes).toBe(REDACTED)
  })

  it('redacts blob:/data: URLs and long base64 strings', () => {
    const out = sanitizeForExport({
      url: 'blob:https://justacamera.app/abc',
      data: 'data:image/png;base64,iVBOR',
      b64: 'A'.repeat(600),
      keep: 'hello world',
    }) as Record<string, unknown>
    expect(out.url).toBe(REDACTED)
    expect(out.data).toBe(REDACTED)
    expect(out.b64).toBe(REDACTED)
    expect(out.keep).toBe('hello world')
  })

  it('preserves safe values', () => {
    const input = { width: 1280, height: 720, facingMode: 'user', supported: true }
    expect(sanitizeForExport(input)).toEqual(input)
  })

  it('handles cyclic structures without throwing', () => {
    const obj: Record<string, unknown> = { a: 1 }
    obj.self = obj
    expect(() => sanitizeForExport(obj)).not.toThrow()
  })

  it('supports extra denied keys', () => {
    const out = sanitizeForExport({ custom: 'sensitive' }, { extraKeys: ['custom'] }) as Record<
      string,
      unknown
    >
    expect(out.custom).toBe(REDACTED)
  })
})

describe('findSensitiveLeaks', () => {
  it('returns empty for a clean object', () => {
    expect(findSensitiveLeaks({ width: 1280, ok: true })).toEqual([])
  })

  it('detects sensitive keys with real values', () => {
    const leaks = findSensitiveLeaks({ deviceId: 'abc', nested: { groupId: 'g' } })
    expect(leaks.length).toBe(2)
  })

  it('treats redacted/empty sensitive keys as safe', () => {
    expect(findSensitiveLeaks({ deviceId: REDACTED, groupId: '' })).toEqual([])
  })

  it('detects media-shaped values', () => {
    const leaks = findSensitiveLeaks({ blob: new Blob(['x']) })
    expect(leaks.length).toBe(1)
  })

  it('is consistent with the exported denylist', () => {
    expect(SENSITIVE_KEYS).toContain('deviceid')
    expect(SENSITIVE_KEYS).toContain('groupid')
  })
})
