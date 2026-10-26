import { describe, expect, it } from 'vitest'
import {
  EDDY_BUILD_QUALITY,
  EDDY_BUILD_VERSION,
  EDDY_RELEASE_REPO,
  EDDY_UPDATE_NUDGE_URL,
  eddyAwareIdentity,
  eddyAwareReleaseRepo,
  eddyVersionLabel,
  isEddyBuild
} from './eddy-build'

describe('eddy build switches', () => {
  it('keeps Orca behavior when EDDY_VERSION is not substituted (dev, tests)', () => {
    expect(EDDY_BUILD_VERSION).toBeNull()
    expect(EDDY_BUILD_QUALITY).toBeNull()
    expect(isEddyBuild()).toBe(false)
    expect(eddyAwareReleaseRepo('stablyai/orca')).toBe('stablyai/orca')
    expect(eddyAwareIdentity('Orca', 'eddy')).toBe('Orca')
    expect(eddyVersionLabel('1.4.230')).toBe('1.4.230')
  })

  it('names the eddy release repo and its update campaign file', () => {
    expect(EDDY_RELEASE_REPO).toBe('Tom-from-6520/eddy')
    expect(EDDY_UPDATE_NUDGE_URL).toBe(
      'https://raw.githubusercontent.com/Tom-from-6520/eddy/main/eddy/update-nudge.json'
    )
  })

  it('labels eddy versions with their stage and the Orca base', () => {
    expect(eddyVersionLabel('1.4.230', '0.1.2', 'alpha')).toBe('0.1.2 alpha (Orca 1.4.230)')
    expect(eddyVersionLabel('1.4.230', '1.0.0', 'stable')).toBe('1.0.0 (Orca 1.4.230)')
    expect(eddyVersionLabel('1.4.230', '0.1.2', null)).toBe('0.1.2 (Orca 1.4.230)')
  })
})
