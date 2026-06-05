/**
 * Minimal, configurable fakes for the browser media APIs, for integration tests
 * in jsdom (which implements none of them). Install with installMediaMocks(),
 * tear down with uninstallMediaMocks() (call in afterEach).
 */
import { vi } from 'vitest'

export class FakeMediaStreamTrack {
  readyState: 'live' | 'ended' = 'live'
  enabled = true
  constructor(
    public kind: 'video' | 'audio',
    public label = `${kind} track`,
    private settings: Record<string, unknown> = {},
    private capabilities: Record<string, unknown> = {},
  ) {}
  stop() {
    this.readyState = 'ended'
  }
  getSettings() {
    return { ...this.settings }
  }
  getCapabilities() {
    return { ...this.capabilities }
  }
  applyConstraints = vi.fn(async () => {})
}

export class FakeMediaStream {
  private tracks: FakeMediaStreamTrack[]
  constructor(tracks: FakeMediaStreamTrack[] = []) {
    this.tracks = [...tracks]
  }
  getTracks() {
    return [...this.tracks]
  }
  getVideoTracks() {
    return this.tracks.filter((t) => t.kind === 'video')
  }
  getAudioTracks() {
    return this.tracks.filter((t) => t.kind === 'audio')
  }
  addTrack(t: FakeMediaStreamTrack) {
    this.tracks.push(t)
  }
}

export class FakeMediaRecorder {
  static supported = new Set<string>(['video/webm;codecs=vp9,opus', 'video/webm'])
  static isTypeSupported(type: string) {
    return FakeMediaRecorder.supported.has(type)
  }
  state: 'inactive' | 'recording' | 'paused' = 'inactive'
  ondataavailable: ((e: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  onerror: (() => void) | null = null
  mimeType: string
  constructor(
    public stream: FakeMediaStream,
    options?: { mimeType?: string },
  ) {
    this.mimeType = options?.mimeType ?? 'video/webm'
  }
  start(_timeslice?: number) {
    this.state = 'recording'
  }
  pause() {
    this.state = 'paused'
  }
  resume() {
    this.state = 'recording'
  }
  stop() {
    this.state = 'inactive'
    // emit a final chunk then stop, per spec ordering
    this.ondataavailable?.({ data: new Blob(['video-bytes'], { type: this.mimeType }) })
    this.onstop?.()
  }
}

export interface MediaMockConfig {
  cameras?: { deviceId: string; label: string }[]
  microphones?: { deviceId: string; label: string }[]
  videoSettings?: Record<string, unknown>
  videoCapabilities?: Record<string, unknown>
  /** Make getUserMedia reject with this DOMException-like error. */
  getUserMediaError?: { name: string; constraint?: string }
}

interface DeviceChangeListeners {
  listeners: Set<() => void>
}

let saved: {
  mediaDevices?: PropertyDescriptor | undefined
  MediaStream?: unknown
  MediaRecorder?: unknown
  MediaStreamTrack?: unknown
} | null = null

export function installMediaMocks(config: MediaMockConfig = {}) {
  const cameras = config.cameras ?? [{ deviceId: 'cam-default', label: 'Integrated Camera' }]
  const microphones = config.microphones ?? [{ deviceId: 'mic-default', label: 'Built-in Mic' }]
  const dc: DeviceChangeListeners = { listeners: new Set() }

  const getUserMedia = vi.fn(async (constraints: MediaStreamConstraints) => {
    if (config.getUserMediaError) {
      throw Object.assign(new Error('gum failed'), config.getUserMediaError)
    }
    const tracks: FakeMediaStreamTrack[] = []
    if (constraints.video) {
      tracks.push(
        new FakeMediaStreamTrack(
          'video',
          cameras[0]?.label ?? 'camera',
          config.videoSettings ?? { width: 1280, height: 720, frameRate: 30, facingMode: 'user' },
          config.videoCapabilities ?? {},
        ),
      )
    }
    if (constraints.audio) {
      tracks.push(
        new FakeMediaStreamTrack('audio', microphones[0]?.label ?? 'mic', {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }),
      )
    }
    return new FakeMediaStream(tracks) as unknown as MediaStream
  })

  const enumerateDevices = vi.fn(async () => {
    return [
      ...cameras.map((c) => ({ ...c, kind: 'videoinput', groupId: 'g', toJSON: () => ({}) })),
      ...microphones.map((m) => ({ ...m, kind: 'audioinput', groupId: 'g', toJSON: () => ({}) })),
    ] as unknown as MediaDeviceInfo[]
  })

  const mediaDevices = {
    getUserMedia,
    enumerateDevices,
    addEventListener: (type: string, cb: () => void) => {
      if (type === 'devicechange') dc.listeners.add(cb)
    },
    removeEventListener: (type: string, cb: () => void) => {
      if (type === 'devicechange') dc.listeners.delete(cb)
    },
    dispatchEvent: () => true,
  }

  saved = {
    mediaDevices: Object.getOwnPropertyDescriptor(navigator, 'mediaDevices'),
    MediaStream: (globalThis as Record<string, unknown>).MediaStream,
    MediaRecorder: (globalThis as Record<string, unknown>).MediaRecorder,
    MediaStreamTrack: (globalThis as Record<string, unknown>).MediaStreamTrack,
  }

  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: mediaDevices,
  })
  ;(globalThis as Record<string, unknown>).MediaStream = FakeMediaStream
  ;(globalThis as Record<string, unknown>).MediaRecorder = FakeMediaRecorder
  ;(globalThis as Record<string, unknown>).MediaStreamTrack = FakeMediaStreamTrack

  return {
    getUserMedia,
    enumerateDevices,
    fireDeviceChange: () => dc.listeners.forEach((cb) => cb()),
    listenerCount: () => dc.listeners.size,
  }
}

export function uninstallMediaMocks() {
  if (!saved) return
  if (saved.mediaDevices) {
    Object.defineProperty(navigator, 'mediaDevices', saved.mediaDevices)
  } else {
    // remove our stub
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined })
  }
  ;(globalThis as Record<string, unknown>).MediaStream = saved.MediaStream
  ;(globalThis as Record<string, unknown>).MediaRecorder = saved.MediaRecorder
  ;(globalThis as Record<string, unknown>).MediaStreamTrack = saved.MediaStreamTrack
  saved = null
}
