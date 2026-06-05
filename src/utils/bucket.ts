/**
 * Bucketing helpers for any future telemetry — pure, independently unit-tested.
 *
 * Telemetry is DISABLED in this app (see docs/telemetry-schema.md). These
 * helpers exist so that IF telemetry is ever added, exact hardware
 * characteristics (which are fingerprinting vectors) are coarsened into buckets
 * before they could ever be transmitted. They are also used to label
 * diagnostics in a privacy-preserving way.
 */

/** Coarse resolution bucket from a pixel width/height. */
export function bucketResolution(width: number | undefined, height: number | undefined): string {
  if (!width || !height) return 'unknown'
  const longEdge = Math.max(width, height)
  if (longEdge >= 3840) return '4k'
  if (longEdge >= 2560) return '1440p'
  if (longEdge >= 1920) return '1080p'
  if (longEdge >= 1280) return '720p'
  if (longEdge >= 640) return 'sd'
  return 'low'
}

/** Coarse duration bucket in seconds. */
export function bucketDuration(ms: number): string {
  const seconds = ms / 1000
  if (seconds < 5) return '<5s'
  if (seconds < 30) return '5-30s'
  if (seconds < 120) return '30-120s'
  if (seconds < 600) return '2-10m'
  return '>10m'
}

/** Coarse frame-rate bucket. */
export function bucketFrameRate(fps: number | undefined): string {
  if (!fps) return 'unknown'
  if (fps >= 55) return '60'
  if (fps >= 28) return '30'
  if (fps >= 20) return '24'
  return '<20'
}
