import { describe, it, expect } from 'vitest'
import { normalizeMediaError, unsupportedError, insecureContextError } from '@/utils/errors'

function domException(name: string, extra: Record<string, unknown> = {}) {
  return Object.assign(new Error(`${name} message`), { name }, extra)
}

describe('normalizeMediaError', () => {
  it('maps NotAllowedError and SecurityError to permission-denied', () => {
    expect(normalizeMediaError(domException('NotAllowedError')).kind).toBe('permission-denied')
    expect(normalizeMediaError(domException('SecurityError')).kind).toBe('permission-denied')
  })

  it('maps NotFoundError to no-device', () => {
    expect(normalizeMediaError(domException('NotFoundError')).kind).toBe('no-device')
  })

  it('maps NotReadableError and AbortError to device-busy', () => {
    expect(normalizeMediaError(domException('NotReadableError')).kind).toBe('device-busy')
    expect(normalizeMediaError(domException('AbortError')).kind).toBe('device-busy')
  })

  it('maps OverconstrainedError to constraint-failed and surfaces the constraint', () => {
    const result = normalizeMediaError(
      domException('OverconstrainedError', { constraint: 'width' }),
    )
    expect(result.kind).toBe('constraint-failed')
    expect(result.constraint).toBe('width')
  })

  it('omits the constraint field when absent', () => {
    const result = normalizeMediaError(domException('OverconstrainedError'))
    expect(result.kind).toBe('constraint-failed')
    expect(result.constraint).toBeUndefined()
  })

  it('maps TypeError to insecure-context', () => {
    expect(normalizeMediaError(domException('TypeError')).kind).toBe('insecure-context')
  })

  it('falls back to unknown for unrecognized errors', () => {
    expect(normalizeMediaError(domException('WeirdError')).kind).toBe('unknown')
    expect(normalizeMediaError('a string').kind).toBe('unknown')
    expect(normalizeMediaError(null).kind).toBe('unknown')
  })

  it('always provides a user message and recovery hint without identifiers', () => {
    const result = normalizeMediaError(domException('NotReadableError'))
    expect(result.message.length).toBeGreaterThan(0)
    expect(result.recovery.length).toBeGreaterThan(0)
  })

  it('builds explicit unsupported and insecure-context errors', () => {
    expect(unsupportedError().kind).toBe('unsupported')
    expect(insecureContextError().kind).toBe('insecure-context')
  })
})
