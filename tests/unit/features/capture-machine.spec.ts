import { describe, it, expect } from 'vitest'
import {
  initialCaptureStatus,
  canStartCountdown,
  canCapturePhoto,
  canStartRecording,
  canPauseRecording,
  canResumeRecording,
  canStopRecording,
  isRecordingActive,
  isBusy,
  beginCountdown,
  tickCountdown,
  beginRecording,
  tickRecording,
  pauseRecording,
  resumeRecording,
  beginFinalize,
  endRecording,
  elapsedOf,
} from '@/features/camera/capture-machine'

describe('capture machine — countdown', () => {
  it('begins a countdown and ticks down to capture', () => {
    let s = beginCountdown(3)
    expect(s).toEqual({ kind: 'counting-down', remaining: 3 })
    s = tickCountdown(s)
    expect(s).toEqual({ kind: 'counting-down', remaining: 2 })
    s = tickCountdown(s)
    s = tickCountdown(s)
    expect(s.kind).toBe('capturing-photo')
  })

  it('clamps negative countdown seconds', () => {
    expect(beginCountdown(-5)).toEqual({ kind: 'counting-down', remaining: 0 })
  })

  it('tickCountdown is a no-op on non-countdown states', () => {
    expect(tickCountdown({ kind: 'idle' })).toEqual({ kind: 'idle' })
  })
})

describe('capture machine — recording', () => {
  it('begins, ticks, pauses, resumes, finalizes', () => {
    let s = beginRecording(1000)
    expect(s).toEqual({ kind: 'recording', startedAt: 1000, elapsedMs: 0 })

    s = tickRecording(s, 2500)
    expect(elapsedOf(s)).toBe(2500)

    s = pauseRecording(s, 2500)
    expect(s.kind).toBe('recording-paused')
    expect(elapsedOf(s)).toBe(2500)

    s = resumeRecording(s, 5000)
    expect(s.kind).toBe('recording')
    expect(elapsedOf(s)).toBe(2500)

    s = beginFinalize()
    expect(s.kind).toBe('finalizing-recording')

    s = endRecording()
    expect(s.kind).toBe('idle')
  })

  it('guards reflect the active state', () => {
    expect(canStartCountdown(initialCaptureStatus)).toBe(true)
    expect(canCapturePhoto(initialCaptureStatus)).toBe(true)
    expect(canStartRecording(initialCaptureStatus)).toBe(true)

    const rec = beginRecording(0)
    expect(canStartRecording(rec)).toBe(false)
    expect(canPauseRecording(rec)).toBe(true)
    expect(canStopRecording(rec)).toBe(true)
    expect(isRecordingActive(rec)).toBe(true)
    expect(isBusy(rec)).toBe(true)

    const paused = pauseRecording(rec, 1000)
    expect(canResumeRecording(paused)).toBe(true)
    expect(canPauseRecording(paused)).toBe(false)
    expect(canStopRecording(paused)).toBe(true)
  })

  it('transitions are no-ops from the wrong state', () => {
    expect(pauseRecording({ kind: 'idle' }, 100).kind).toBe('idle')
    expect(resumeRecording({ kind: 'idle' }, 100).kind).toBe('idle')
    expect(tickRecording({ kind: 'idle' }, 100).kind).toBe('idle')
  })
})
