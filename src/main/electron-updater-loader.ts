import type { autoUpdater as electronUpdaterAutoUpdater } from 'electron-updater'
import { applyEddyUpdaterVersion } from './eddy/eddy-updater-version'

export type ElectronAutoUpdater = typeof electronUpdaterAutoUpdater

export function loadElectronAutoUpdater(): ElectronAutoUpdater {
  // Why: electron-updater validates app.getVersion() while loading. Keep the
  // require behind packaged-update guards so direct dev/E2E launches do not
  // fail before setupAutoUpdater() can return.
  const updater = (require('electron-updater') as { autoUpdater: ElectronAutoUpdater }).autoUpdater
  // eddy: compare against eddyVersion in eddy release builds.
  applyEddyUpdaterVersion(updater)
  return updater
}
