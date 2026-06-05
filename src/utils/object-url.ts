/**
 * Blob URL lifecycle management — isolated and independently unit-tested.
 *
 * Every `URL.createObjectURL` MUST be paired with a `revokeObjectURL` or it
 * leaks memory (and keeps a media Blob alive) until the document unloads. This
 * registry tracks live object URLs and guarantees cleanup on teardown.
 *
 * Rules (see docs/privacy-model.md):
 *  - The LIVE preview never uses an object URL (it uses video.srcObject).
 *  - Captured-media previews keep their URL alive until the element is replaced
 *    or the component unmounts (revoking on `load` breaks right-click-save).
 *  - Download URLs are revoked immediately after the click initiates.
 */
export class ObjectUrlRegistry {
  private urls = new Set<string>()

  /** Creates and tracks an object URL for a blob. */
  create(blob: Blob): string {
    const url = URL.createObjectURL(blob)
    this.urls.add(url)
    return url
  }

  /** Revokes a single tracked URL (no-op if unknown/already revoked). */
  revoke(url: string | undefined | null): void {
    if (!url) return
    if (this.urls.has(url)) {
      URL.revokeObjectURL(url)
      this.urls.delete(url)
    }
  }

  /** Revokes every tracked URL. Call on teardown. */
  revokeAll(): void {
    for (const url of this.urls) {
      URL.revokeObjectURL(url)
    }
    this.urls.clear()
  }

  /** Number of live tracked URLs (for tests/diagnostics). */
  get size(): number {
    return this.urls.size
  }
}

/** A process-wide registry used by the download helper for one-shot URLs. */
export const downloadUrlRegistry = new ObjectUrlRegistry()
