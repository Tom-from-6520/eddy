import { describe, expect, it } from 'vitest'
import { ORCA_FEATURE_DISABLED, orcaFeatureLabel } from './orca-feature'

describe('orca feature marking', () => {
  it('leaves Orca features enabled and unmarked outside eddy release builds', () => {
    expect(ORCA_FEATURE_DISABLED).toBe(false)
    expect(orcaFeatureLabel('Send Feedback')).toBe('Send Feedback')
  })
})
