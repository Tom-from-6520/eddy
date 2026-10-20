// eddy omega identity and release settings. They apply only to eddy release builds, where
// electron-vite substitutes EDDY_VERSION (see eddy/build/eddy-vite-defines.ts); dev runs, tests
// and plain Orca builds keep Orca's behavior.
declare const EDDY_VERSION: string | null

/** eddy omega's own version (eddy/product.json) in an eddy release build, else null. */
export const EDDY_BUILD_VERSION: string | null =
  typeof EDDY_VERSION === 'string' && EDDY_VERSION.length > 0 ? EDDY_VERSION : null

export const EDDY_RELEASE_REPO = 'Tom-from-6520/eddy-omega'
export const EDDY_APP_NAME = 'eddy omega'
export const EDDY_APP_USER_MODEL_ID = 'dev.eddy.omega'
/** Folder name for eddy omega's machine-local data (e.g. under %LOCALAPPDATA%). */
export const EDDY_LOCAL_DATA_DIR_NAME = 'eddy-omega'

export function isEddyBuild(): boolean {
  return EDDY_BUILD_VERSION !== null
}

/** The GitHub repo releases and updates come from: eddy-omega's in an eddy build. */
export function eddyAwareReleaseRepo(upstreamRepo: string): string {
  return isEddyBuild() ? EDDY_RELEASE_REPO : upstreamRepo
}

/** Orca's identity value, or eddy omega's in an eddy build. */
export function eddyAwareIdentity(upstreamValue: string, eddyValue: string): string {
  return isEddyBuild() ? eddyValue : upstreamValue
}
