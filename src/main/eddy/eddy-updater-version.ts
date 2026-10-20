import { app } from 'electron'
import { EDDY_BUILD_VERSION } from '../../shared/eddy/eddy-build'

/**
 * The version the updater compares releases against. eddy omega releases are versioned by
 * eddyVersion (0.1.x), while app.getVersion() stays Orca's version for peer compatibility.
 */
export function getUpdaterAppVersion(): string {
  return EDDY_BUILD_VERSION ?? app.getVersion()
}

/**
 * electron-updater takes its current version from app.getVersion() when it loads and only
 * installs a manifest whose version is greater. Point it at eddyVersion so eddy omega's
 * release manifests (which carry eddyVersion) compare correctly.
 */
export function applyEddyUpdaterVersion(
  updater: object,
  eddyVersion: string | null = EDDY_BUILD_VERSION
): void {
  if (eddyVersion === null) {
    return
  }
  const current: unknown = Reflect.get(updater, 'currentVersion')
  if (typeof current !== 'object' || current === null) {
    return
  }
  // Why the instance's own class: electron-updater compares with its bundled semver.
  const SemVer: unknown = Reflect.getPrototypeOf(current)?.constructor
  if (typeof SemVer !== 'function') {
    return
  }
  Reflect.set(updater, 'currentVersion', Reflect.construct(SemVer, [eddyVersion]))
}
