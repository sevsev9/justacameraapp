/**
 * Builds GitHub "new issue" deep-links — pure and independently unit-tested.
 *
 * Uses GitHub Issue Forms (.github/ISSUE_TEMPLATE/*.yml): selecting a form with
 * `template=<file>.yml` and prefilling its fields via query params keyed by each
 * field's `id` (see docs/ links in the PR). The forms' `labels:` auto-apply, so
 * we don't pass `labels=` here. Values are encoded with URLSearchParams; the
 * prefilled diagnostics are length-clamped to stay under GitHub's URL limit
 * (over-long new-issue URLs return HTTP 414).
 */
export const ISSUE_TEMPLATES = {
  bug: 'bug_report.yml',
  feature: 'feature_request.yml',
} as const

/** Conservative cap for a single prefilled field (GitHub 414s on huge URLs). */
export const MAX_PREFILL_LEN = 6000

function clamp(value: string, max = MAX_PREFILL_LEN): string {
  if (value.length <= max) return value
  return `${value.slice(0, max - 16)}\n…(truncated)…`
}

function trimSlashes(repoUrl: string): string {
  return repoUrl.replace(/\/+$/, '')
}

/** The template chooser page (lists Bug report + Feature request). */
export function issueChooseUrl(repoUrl: string): string {
  return `${trimSlashes(repoUrl)}/issues/new/choose`
}

/** Deep-link to the Bug report form, optionally prefilling title + diagnostics. */
export function bugReportUrl(
  repoUrl: string,
  opts: { title?: string; diagnostics?: string } = {},
): string {
  const params = new URLSearchParams({ template: ISSUE_TEMPLATES.bug })
  if (opts.title) params.set('title', opts.title)
  if (opts.diagnostics) params.set('diagnostics', clamp(opts.diagnostics))
  return `${trimSlashes(repoUrl)}/issues/new?${params.toString()}`
}

/** Deep-link to the Feature request form, optionally prefilling a title. */
export function featureRequestUrl(repoUrl: string, opts: { title?: string } = {}): string {
  const params = new URLSearchParams({ template: ISSUE_TEMPLATES.feature })
  if (opts.title) params.set('title', opts.title)
  return `${trimSlashes(repoUrl)}/issues/new?${params.toString()}`
}
