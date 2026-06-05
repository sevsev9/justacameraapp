import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import { ExportService } from '@/services/export-service'

/**
 * Unit coverage for the dual save paths: File System Access picker (with
 * success / cancel / failure-fallback) and the universal <a download> fallback,
 * including object-URL cleanup. No network is involved.
 */
describe('ExportService', () => {
  beforeEach(() => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test/export')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
    delete (window as unknown as Record<string, unknown>).showSaveFilePicker
  })

  function blob() {
    return new Blob(['data'], { type: 'image/jpeg' })
  }

  it('supportsFilePicker reflects window.showSaveFilePicker presence', () => {
    expect(ExportService.supportsFilePicker()).toBe(false)
    ;(window as unknown as Record<string, unknown>).showSaveFilePicker = () => {}
    expect(ExportService.supportsFilePicker()).toBe(true)
  })

  it('uses the <a download> fallback when the picker is unavailable', async () => {
    const click = vi.fn()
    const anchor = {
      href: '',
      download: '',
      rel: '',
      style: {},
      click,
    } as unknown as HTMLAnchorElement
    const createSpy = vi.spyOn(document, 'createElement').mockReturnValue(anchor)
    const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((n) => n)
    const removeSpy = vi.spyOn(document.body, 'removeChild').mockImplementation((n) => n)

    const outcome = await new ExportService().save(blob(), 'photo.jpg')
    expect(outcome).toBe('downloaded')
    expect(anchor.download).toBe('photo.jpg')
    expect(click).toHaveBeenCalledTimes(1)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test/export')

    createSpy.mockRestore()
    appendSpy.mockRestore()
    removeSpy.mockRestore()
  })

  it('saves via the picker when available', async () => {
    const write = vi.fn(async () => {})
    const close = vi.fn(async () => {})
    ;(window as unknown as Record<string, unknown>).showSaveFilePicker = vi.fn(async () => ({
      createWritable: async () => ({ write, close }),
    }))
    const outcome = await new ExportService().save(blob(), 'photo.jpg')
    expect(outcome).toBe('saved')
    expect(write).toHaveBeenCalledOnce()
    expect(close).toHaveBeenCalledOnce()
  })

  it('treats a cancelled picker (AbortError) as a silent no-op', async () => {
    ;(window as unknown as Record<string, unknown>).showSaveFilePicker = vi.fn(async () => {
      throw Object.assign(new Error('cancelled'), { name: 'AbortError' })
    })
    const outcome = await new ExportService().save(blob(), 'photo.jpg')
    expect(outcome).toBe('cancelled')
  })

  it('falls back to download when the picker fails for another reason', async () => {
    ;(window as unknown as Record<string, unknown>).showSaveFilePicker = vi.fn(async () => {
      throw Object.assign(new Error('security'), { name: 'SecurityError' })
    })
    const click = vi.fn()
    const anchor = {
      href: '',
      download: '',
      rel: '',
      style: {},
      click,
    } as unknown as HTMLAnchorElement
    vi.spyOn(document, 'createElement').mockReturnValue(anchor)
    vi.spyOn(document.body, 'appendChild').mockImplementation((n) => n)
    vi.spyOn(document.body, 'removeChild').mockImplementation((n) => n)

    const outcome = await new ExportService().save(blob(), 'photo.jpg')
    expect(outcome).toBe('downloaded')
    expect(click).toHaveBeenCalledTimes(1)
  })
})
