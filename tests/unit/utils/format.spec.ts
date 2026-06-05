import { describe, it, expect } from 'vitest'
import { formatDuration, formatDurationSpoken } from '@/utils/duration'
import { formatBytes, estimateRecordingBytes } from '@/utils/format-bytes'
import { buildFilename, timestampSlug, extensionForPhotoFormat } from '@/utils/filename'
import { bucketResolution, bucketDuration, bucketFrameRate } from '@/utils/bucket'

describe('formatDuration', () => {
  it('formats sub-hour as M:SS', () => {
    expect(formatDuration(0)).toBe('0:00')
    expect(formatDuration(5_000)).toBe('0:05')
    expect(formatDuration(65_000)).toBe('1:05')
    expect(formatDuration(600_000)).toBe('10:00')
  })

  it('formats hours as H:MM:SS', () => {
    expect(formatDuration(3_661_000)).toBe('1:01:01')
  })

  it('clamps negatives to zero', () => {
    expect(formatDuration(-1000)).toBe('0:00')
  })
})

describe('formatDurationSpoken', () => {
  it('produces screen-reader friendly text', () => {
    expect(formatDurationSpoken(65_000)).toBe('1 minute 5 seconds')
    expect(formatDurationSpoken(1_000)).toBe('1 second')
    expect(formatDurationSpoken(125_000)).toBe('2 minutes 5 seconds')
  })
})

describe('formatBytes', () => {
  it('formats common sizes', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB')
  })

  it('handles invalid input', () => {
    expect(formatBytes(-5)).toBe('0 B')
    expect(formatBytes(NaN)).toBe('0 B')
  })
})

describe('estimateRecordingBytes', () => {
  it('scales with duration and audio', () => {
    const withAudio = estimateRecordingBytes(10_000, { withAudio: true })
    const withoutAudio = estimateRecordingBytes(10_000, { withAudio: false })
    expect(withAudio).toBeGreaterThan(withoutAudio)
    expect(estimateRecordingBytes(0, { withAudio: true })).toBe(0)
  })
})

describe('buildFilename / timestampSlug', () => {
  const date = new Date(2026, 5, 5, 14, 30, 22) // 2026-06-05 14:30:22 local

  it('builds a deterministic slug', () => {
    expect(timestampSlug(date)).toBe('20260605-143022')
  })

  it('builds privacy-safe filenames', () => {
    expect(buildFilename('photo', 'jpg', date)).toBe('justacamera-photo-20260605-143022.jpg')
    expect(buildFilename('video', 'webm', date)).toBe('justacamera-video-20260605-143022.webm')
  })

  it('sanitizes the extension', () => {
    expect(buildFilename('photo', '.JPG', date)).toBe('justacamera-photo-20260605-143022.jpg')
  })

  it('maps photo formats to extensions', () => {
    expect(extensionForPhotoFormat('image/jpeg')).toBe('jpg')
    expect(extensionForPhotoFormat('image/png')).toBe('png')
    expect(extensionForPhotoFormat('image/webp')).toBe('webp')
    expect(extensionForPhotoFormat('image/unknown')).toBe('jpg')
  })
})

describe('bucketing', () => {
  it('buckets resolution', () => {
    expect(bucketResolution(3840, 2160)).toBe('4k')
    expect(bucketResolution(1920, 1080)).toBe('1080p')
    expect(bucketResolution(1280, 720)).toBe('720p')
    expect(bucketResolution(undefined, undefined)).toBe('unknown')
  })

  it('buckets duration', () => {
    expect(bucketDuration(2_000)).toBe('<5s')
    expect(bucketDuration(60_000)).toBe('30-120s')
    expect(bucketDuration(700_000)).toBe('>10m')
  })

  it('buckets frame rate', () => {
    expect(bucketFrameRate(60)).toBe('60')
    expect(bucketFrameRate(30)).toBe('30')
    expect(bucketFrameRate(undefined)).toBe('unknown')
  })
})
