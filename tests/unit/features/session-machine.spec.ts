import { describe, it, expect } from 'vitest'
import {
  initialSessionStatus,
  sessionStatusForError,
  isSessionActive,
  isSessionError,
  canStart,
  canStop,
  canSwitchDevice,
} from '@/features/camera/session-machine'
import type { NormalizedMediaError, SessionStatus } from '@/types/media'

function err(kind: NormalizedMediaError['kind']): NormalizedMediaError {
  return { kind, message: 'm', recovery: 'r' }
}

describe('sessionStatusForError', () => {
  it('routes each error kind to the right session state', () => {
    expect(sessionStatusForError(err('permission-denied')).kind).toBe('permission-denied')
    expect(sessionStatusForError(err('no-device')).kind).toBe('no-device')
    expect(sessionStatusForError(err('constraint-failed')).kind).toBe('constraint-failed')
    expect(sessionStatusForError(err('insecure-context')).kind).toBe('unsupported')
    expect(sessionStatusForError(err('unsupported')).kind).toBe('unsupported')
    expect(sessionStatusForError(err('device-busy')).kind).toBe('error')
    expect(sessionStatusForError(err('unknown')).kind).toBe('error')
  })
})

describe('session guards', () => {
  const previewing: SessionStatus = { kind: 'previewing' }
  const denied: SessionStatus = { kind: 'permission-denied', error: err('permission-denied') }

  it('starts initial state idle', () => {
    expect(initialSessionStatus.kind).toBe('idle')
  })

  it('isSessionActive only for previewing/switching', () => {
    expect(isSessionActive(previewing)).toBe(true)
    expect(isSessionActive({ kind: 'switching-device' })).toBe(true)
    expect(isSessionActive({ kind: 'idle' })).toBe(false)
  })

  it('isSessionError for terminal error states', () => {
    expect(isSessionError(denied)).toBe(true)
    expect(isSessionError({ kind: 'no-device', error: err('no-device') })).toBe(true)
    expect(isSessionError(previewing)).toBe(false)
  })

  it('canStart from idle/stopped/error states only', () => {
    expect(canStart({ kind: 'idle' })).toBe(true)
    expect(canStart({ kind: 'stopped' })).toBe(true)
    expect(canStart(denied)).toBe(true)
    expect(canStart(previewing)).toBe(false)
    expect(canStart({ kind: 'requesting-permission' })).toBe(false)
  })

  it('canStop only while active', () => {
    expect(canStop(previewing)).toBe(true)
    expect(canStop({ kind: 'idle' })).toBe(false)
  })

  it('canSwitchDevice only while previewing', () => {
    expect(canSwitchDevice(previewing)).toBe(true)
    expect(canSwitchDevice({ kind: 'switching-device' })).toBe(false)
  })
})
