import { describe, expect, it, vi } from 'vitest'
import { applyEddyUpdaterVersion, getUpdaterAppVersion } from './eddy-updater-version'

vi.mock('electron', () => ({ app: { getVersion: () => '1.4.230' } }))

class FakeSemVer {
  constructor(readonly version: string) {}
}

describe('eddy updater version', () => {
  it('uses the app version outside eddy release builds', () => {
    expect(getUpdaterAppVersion()).toBe('1.4.230')
  })

  it("replaces electron-updater's current version with eddyVersion, keeping its class", () => {
    const updater = { currentVersion: new FakeSemVer('1.4.230') }
    applyEddyUpdaterVersion(updater, '0.1.2')
    expect(updater.currentVersion).toBeInstanceOf(FakeSemVer)
    expect(updater.currentVersion.version).toBe('0.1.2')
  })

  it('leaves the updater alone outside eddy release builds', () => {
    const original = new FakeSemVer('1.4.230')
    const updater = { currentVersion: original }
    applyEddyUpdaterVersion(updater, null)
    expect(updater.currentVersion).toBe(original)
  })

  it('ignores an updater without a version object', () => {
    const updater = { currentVersion: '1.4.230' }
    applyEddyUpdaterVersion(updater, '0.1.2')
    expect(updater.currentVersion).toBe('1.4.230')
  })
})
