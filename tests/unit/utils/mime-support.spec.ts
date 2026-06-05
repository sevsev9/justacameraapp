import { describe, it, expect } from 'vitest'
import {
  selectRecordingMimeType,
  listSupportedMimeTypes,
  extensionForMimeType,
  RECORDING_MIME_CANDIDATES,
} from '@/utils/mime-support'

describe('selectRecordingMimeType', () => {
  it('prefers MP4/H.264 first when everything is supported (iOS-friendly)', () => {
    const choice = selectRecordingMimeType(() => true)
    expect(choice?.container).toBe('mp4')
    expect(choice?.mimeType).toContain('avc1')
  })

  it('falls back to WebM VP9 when MP4 is unsupported', () => {
    const choice = selectRecordingMimeType((m) => m.startsWith('video/webm'))
    expect(choice?.mimeType).toBe('video/webm;codecs=vp9,opus')
  })

  it('falls back to WebM VP8 when only VP8 webm is supported', () => {
    const choice = selectRecordingMimeType((m) => m === 'video/webm;codecs=vp8,opus')
    expect(choice?.mimeType).toBe('video/webm;codecs=vp8,opus')
  })

  it('returns null when nothing is supported', () => {
    expect(selectRecordingMimeType(() => false)).toBeNull()
  })

  it('honors the order of the candidate list', () => {
    // Only the last candidate supported -> it should be chosen.
    const last = RECORDING_MIME_CANDIDATES[RECORDING_MIME_CANDIDATES.length - 1]!
    const choice = selectRecordingMimeType((m) => m === last.mimeType)
    expect(choice?.mimeType).toBe(last.mimeType)
  })
})

describe('listSupportedMimeTypes', () => {
  it('returns every supported candidate', () => {
    const supported = listSupportedMimeTypes((m) => m.startsWith('video/webm'))
    expect(supported.length).toBeGreaterThanOrEqual(3)
    expect(supported.every((c) => c.container === 'webm')).toBe(true)
  })

  it('returns an empty list when none are supported', () => {
    expect(listSupportedMimeTypes(() => false)).toEqual([])
  })
})

describe('extensionForMimeType', () => {
  it('maps containers to extensions', () => {
    expect(extensionForMimeType('video/mp4;codecs=avc1')).toBe('mp4')
    expect(extensionForMimeType('video/webm;codecs=vp9,opus')).toBe('webm')
    expect(extensionForMimeType('audio/webm;codecs=opus')).toBe('webm')
    expect(extensionForMimeType('audio/mp4;codecs=mp4a.40.2')).toBe('m4a')
  })
})
