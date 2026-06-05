/**
 * ExportService — saves a Blob to the user's device. No network involved.
 *
 * Progressive enhancement:
 *  - File System Access API (`showSaveFilePicker`) when present (Chromium
 *    desktop) — lets the user choose a location. A cancelled dialog (AbortError)
 *    is a silent no-op, not an error.
 *  - Otherwise the universal `<a download>` + object-URL fallback (the path used
 *    by virtually all mobile users), revoking the URL right after the click.
 *
 * Object URLs created here are revoked immediately after the download initiates;
 * preview URLs are managed separately by ObjectUrlRegistry/useObjectUrl.
 */
export type SaveOutcome = 'saved' | 'downloaded' | 'cancelled'

export class ExportService {
  static supportsFilePicker(): boolean {
    return (
      typeof window !== 'undefined' &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      typeof (window as any).showSaveFilePicker === 'function'
    )
  }

  async save(blob: Blob, filename: string): Promise<SaveOutcome> {
    if (ExportService.supportsFilePicker()) {
      const outcome = await this.saveViaPicker(blob, filename)
      if (outcome) return outcome
      // null → picker unusable, fall through to download
    }
    this.saveViaAnchor(blob, filename)
    return 'downloaded'
  }

  private async saveViaPicker(blob: Blob, filename: string): Promise<SaveOutcome | null> {
    try {
      const ext = filename.split('.').pop() ?? ''
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: filename,
        types: ext
          ? [
              {
                description: 'Media file',
                accept: { [blob.type || 'application/octet-stream']: [`.${ext}`] },
              },
            ]
          : undefined,
      })
      const writable = await handle.createWritable()
      await writable.write(blob)
      await writable.close()
      return 'saved'
    } catch (err) {
      if (err && typeof err === 'object' && 'name' in err && err.name === 'AbortError') {
        return 'cancelled'
      }
      // Any other failure (e.g. SecurityError without a user gesture) → fallback.
      return null
    }
  }

  private saveViaAnchor(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.rel = 'noopener'
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    // Revoke right after the click initiates the download.
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }
}

export const exportService = new ExportService()
