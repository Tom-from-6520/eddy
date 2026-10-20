// eddy omega identity and release settings. They apply only to eddy release builds, where
// electron-vite substitutes EDDY_VERSION and EDDY_QUALITY (see eddy/build/eddy-vite-defines.mjs);
// dev runs, tests and plain Orca builds keep Orca's behavior.
declare const EDDY_VERSION: string | null
declare const EDDY_QUALITY: string | null

/** eddy omega's own version (eddy/product.json) in an eddy release build, else null. */
export const EDDY_BUILD_VERSION: string | null =
  typeof EDDY_VERSION === 'string' && EDDY_VERSION.length > 0 ? EDDY_VERSION : null

/** Release stage (alpha, beta, stable) in an eddy release build, else null. */
export const EDDY_BUILD_QUALITY: string | null =
  typeof EDDY_QUALITY === 'string' && EDDY_QUALITY.length > 0 ? EDDY_QUALITY : null

export const EDDY_RELEASE_REPO = 'Tom-from-6520/eddy-omega'
export const EDDY_APP_NAME = 'eddy'
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

/** eddy's update campaigns (format in eddy/AGENTS.md); no file means no campaign. */
export const EDDY_UPDATE_NUDGE_URL = `https://raw.githubusercontent.com/${EDDY_RELEASE_REPO}/main/eddy/update-nudge.json`

/** Per-user home folder: `~/.orca`, or `~/.eddy` in eddy release builds. */
export const APP_HOME_DIR_NAME = eddyAwareIdentity('.orca', '.eddy')

/** Per-repo folder (drops, templates, issue command, downloads): `.orca/`, or `.eddy/`. */
export const REPO_DATA_DIR_NAME = eddyAwareIdentity('.orca', '.eddy')

/** The version people see: "0.1.1 alpha (Orca 1.4.230)" in an eddy build, else Orca's version. */
export function eddyVersionLabel(
  orcaVersion: string,
  version: string | null = EDDY_BUILD_VERSION,
  quality: string | null = EDDY_BUILD_QUALITY
): string {
  if (version === null) {
    return orcaVersion
  }
  const stage = quality && quality !== 'stable' ? ` ${quality}` : ''
  return `${version}${stage} (Orca ${orcaVersion})`
}
