import { describe, it, expect, afterEach } from 'vitest'
import { DiagnosticsService } from '@/services/diagnostics-service'
import { findSensitiveLeaks } from '@/utils/sanitize'
import {
  installMediaMocks,
  uninstallMediaMocks,
  FakeMediaStreamTrack,
} from '../helpers/media-mocks'

afterEach(() => uninstallMediaMocks())

function videoTrack() {
  return new FakeMediaStreamTrack(
    'video',
    'Front Camera',
    { width: 1920, height: 1080, frameRate: 30, facingMode: 'user' },
    { zoom: { min: 1, max: 4, step: 0.1 }, torch: true },
  ) as unknown as MediaStreamTrack
}

describe('DiagnosticsService.build', () => {
  it('assembles negotiated settings, buckets, formats and advanced controls', () => {
    installMediaMocks()
    const report = new DiagnosticsService().build({
      videoTrack: videoTrack(),
      selectedCamera: {
        deviceId: 'cam-secret',
        kind: 'videoinput',
        label: 'Front Camera',
        facing: 'user',
      },
      requestedConstraints: { video: { width: { ideal: 1920 } } },
      cameraPermission: 'granted',
      now: () => new Date('2026-06-05T10:00:00Z'),
    })

    expect(report.video?.width).toBe(1920)
    expect(report.video?.resolutionBucket).toBe('1080p')
    expect(report.video?.frameRateBucket).toBe('30')
    expect(report.permission.camera).toBe('granted')
    expect(report.recordingFormats.length).toBeGreaterThan(0)
    const zoom = report.advancedControls.find((c) => c.id === 'zoom')
    expect(zoom?.supported).toBe(true)
    // raw (local) report keeps the label for on-screen display
    expect(report.selectedCamera?.label).toBe('Front Camera')
  })
})

describe('DiagnosticsService.toExport / toReportText', () => {
  it('strips device labels and ids and leaves no sensitive leaks', () => {
    installMediaMocks()
    const svc = new DiagnosticsService()
    const report = svc.build({
      videoTrack: videoTrack(),
      selectedCamera: {
        deviceId: 'cam-secret-id',
        kind: 'videoinput',
        label: 'Front Camera',
        facing: 'user',
      },
      now: () => new Date('2026-06-05T10:00:00Z'),
    })
    const exported = svc.toExport(report)
    expect(findSensitiveLeaks(exported)).toEqual([])

    const text = svc.toReportText(report)
    expect(text).not.toContain('Front Camera')
    expect(text).not.toContain('cam-secret-id')
    // still contains useful, non-identifying info
    expect(text).toContain('resolutionBucket')
    expect(JSON.parse(text)).toBeTypeOf('object')
  })

  it('redacts a deviceId embedded in requestedConstraints', () => {
    installMediaMocks()
    const svc = new DiagnosticsService()
    const report = svc.build({
      videoTrack: videoTrack(),
      requestedConstraints: { video: { deviceId: { exact: 'cam-secret-id' } }, audio: false },
      now: () => new Date('2026-06-05T10:00:00Z'),
    })
    const text = svc.toReportText(report)
    expect(text).not.toContain('cam-secret-id')
    expect(findSensitiveLeaks(svc.toExport(report))).toEqual([])
  })
})
