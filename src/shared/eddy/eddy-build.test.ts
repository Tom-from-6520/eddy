import { describe, expect, it } from 'vitest'
import {
  EDDY_BUILD_VERSION,
  EDDY_RELEASE_REPO,
  eddyAwareIdentity,
  eddyAwareReleaseRepo,
  isEddyBuild
} from './eddy-build'

describe('eddy build switches', () => {
  it('keeps Orca behavior when EDDY_VERSION is not substituted (dev, tests)', () => {
    expect(EDDY_BUILD_VERSION).toBeNull()
    expect(isEddyBuild()).toBe(false)
    expect(eddyAwareReleaseRepo('stablyai/orca')).toBe('stablyai/orca')
    expect(eddyAwareIdentity('Orca', 'eddy omega')).toBe('Orca')
  })

  it('names the eddy-omega release repo', () => {
    expect(EDDY_RELEASE_REPO).toBe('Tom-from-6520/eddy-omega')
  })
})
