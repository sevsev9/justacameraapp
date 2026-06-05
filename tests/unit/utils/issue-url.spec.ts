import { describe, it, expect } from 'vitest'
import {
  issueChooseUrl,
  bugReportUrl,
  featureRequestUrl,
  ISSUE_TEMPLATES,
  MAX_PREFILL_LEN,
} from '@/utils/issue-url'

const REPO = 'https://github.com/sevsev9/justacameraapp'

describe('issueChooseUrl', () => {
  it('points at the template chooser', () => {
    expect(issueChooseUrl(REPO)).toBe(`${REPO}/issues/new/choose`)
  })
  it('tolerates a trailing slash', () => {
    expect(issueChooseUrl(`${REPO}/`)).toBe(`${REPO}/issues/new/choose`)
  })
})

describe('bugReportUrl', () => {
  it('selects the bug form template', () => {
    const url = new URL(bugReportUrl(REPO))
    expect(url.pathname).toBe('/sevsev9/justacameraapp/issues/new')
    expect(url.searchParams.get('template')).toBe(ISSUE_TEMPLATES.bug)
  })

  it('encodes the title and diagnostics into the matching field ids', () => {
    const url = new URL(
      bugReportUrl(REPO, { title: 'Camera = busy!', diagnostics: '{"a":1,"b":"x y"}' }),
    )
    expect(url.searchParams.get('title')).toBe('Camera = busy!')
    expect(url.searchParams.get('diagnostics')).toBe('{"a":1,"b":"x y"}')
  })

  it('omits empty fields', () => {
    const url = new URL(bugReportUrl(REPO, {}))
    expect(url.searchParams.has('title')).toBe(false)
    expect(url.searchParams.has('diagnostics')).toBe(false)
  })

  it('clamps oversized diagnostics to stay under the URL limit', () => {
    const huge = 'x'.repeat(MAX_PREFILL_LEN + 5000)
    const value = new URL(bugReportUrl(REPO, { diagnostics: huge })).searchParams.get(
      'diagnostics',
    )!
    expect(value.length).toBeLessThanOrEqual(MAX_PREFILL_LEN)
    expect(value).toContain('truncated')
  })
})

describe('featureRequestUrl', () => {
  it('selects the feature form template', () => {
    const url = new URL(featureRequestUrl(REPO, { title: 'Add X' }))
    expect(url.searchParams.get('template')).toBe(ISSUE_TEMPLATES.feature)
    expect(url.searchParams.get('title')).toBe('Add X')
  })
})
