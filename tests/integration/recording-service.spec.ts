import { describe, it, expect, afterEach } from 'vitest'
import { RecordingService } from '@/services/recording-service'
import {
  installMediaMocks,
  uninstallMediaMocks,
  FakeMediaStream,
  FakeMediaStreamTrack,
  FakeMediaRecorder,
} from '../helpers/media-mocks'

afterEach(() => {
  uninstallMediaMocks()
  FakeMediaRecorder.supported = new Set(['video/webm;codecs=vp9,opus', 'video/webm'])
})

function sourceStream(withAudio = true) {
  const tracks = [new FakeMediaStreamTrack('video')]
  if (withAudio) tracks.push(new FakeMediaStreamTrack('audio'))
  return new FakeMediaStream(tracks) as unknown as MediaStream
}

describe('RecordingService', () => {
  it('reports supported formats from isTypeSupported', () => {
    installMediaMocks()
    expect(RecordingService.isSupported()).toBe(true)
    const formats = RecordingService.getSupportedFormats()
    expect(formats.some((f) => f.mimeType === 'video/webm;codecs=vp9,opus')).toBe(true)
  })

  it('chooses the first supported format on start', () => {
    installMediaMocks()
    const svc = new RecordingService()
    const choice = svc.start(sourceStream(), { withAudio: true })
    expect(choice.mimeType).toBe('video/webm;codecs=vp9,opus')
    svc.dispose()
  })

  it('throws when no format is supported', () => {
    installMediaMocks()
    FakeMediaRecorder.supported = new Set()
    const svc = new RecordingService()
    expect(() => svc.start(sourceStream(), { withAudio: true })).toThrow()
  })

  it('tracks elapsed time across pause/resume with an injected clock', () => {
    installMediaMocks()
    let t = 1000
    const now = () => t
    const svc = new RecordingService()
    svc.start(sourceStream(), { withAudio: false, now })
    t = 3000
    expect(svc.getElapsedMs()).toBe(2000)
    svc.pause()
    t = 6000
    expect(svc.getElapsedMs()).toBe(2000) // frozen while paused
    svc.resume()
    t = 7000
    expect(svc.getElapsedMs()).toBe(3000) // 2000 + 1000
    svc.dispose()
  })

  it('finalizes into a non-empty blob and reports duration + audio flag', async () => {
    installMediaMocks()
    let t = 0
    const svc = new RecordingService()
    svc.start(sourceStream(true), { withAudio: true, now: () => t })
    t = 5000
    const result = await svc.stop()
    expect(result.blob.size).toBeGreaterThan(0)
    expect(result.durationMs).toBe(5000)
    expect(result.withAudio).toBe(true)
    expect(result.mimeType).toContain('webm')
  })

  it('records without audio when withAudio is false', async () => {
    installMediaMocks()
    const svc = new RecordingService()
    svc.start(sourceStream(true), { withAudio: false, now: () => 0 })
    const result = await svc.stop()
    expect(result.withAudio).toBe(false)
  })

  it('dispose stops an active recorder without throwing', () => {
    installMediaMocks()
    const svc = new RecordingService()
    svc.start(sourceStream(), { withAudio: false })
    expect(svc.isRecording()).toBe(true)
    expect(() => svc.dispose()).not.toThrow()
    expect(svc.isRecording()).toBe(false)
  })
})
