'use strict'
// eddy packaging: Orca's electron-builder config with eddy's identity, artifact
// names and release repo. Applied by eddy/build/electron-builder.eddy.config.cjs.
const { linkSync, mkdtempSync, readFileSync, rmSync } = require('node:fs')
const { dirname, join } = require('node:path')

const EDDY_APP_ID = 'dev.eddy'
// File- and path-safe name: install folder, %APPDATA% folder, Linux /opt folder and WM_CLASS.
const EDDY_PRODUCT_NAME = 'eddy'
const EDDY_DISPLAY_NAME = 'eddy'
const EDDY_RELEASE_OWNER = 'Tom-from-6520'
const EDDY_RELEASE_REPO = 'eddy'

function readEddyVersion(root) {
  const product = JSON.parse(readFileSync(join(root, 'eddy', 'product.json'), 'utf8'))
  if (typeof product.eddyVersion !== 'string' || !/^\d+\.\d+\.\d+$/.test(product.eddyVersion)) {
    throw new Error('eddy/product.json needs eddyVersion like 0.1.0')
  }
  return product.eddyVersion
}

/** Artifact file names for a version; the release workflow and the update manifests use them. */
function eddyArtifactNames(eddyVersion) {
  return {
    windowsSetup: `eddy-${eddyVersion}-windows-x64-setup.exe`,
    linuxAppImage: `eddy-${eddyVersion}-linux-x86_64.AppImage`,
    linuxDeb: `eddy-${eddyVersion}-linux-amd64.deb`
  }
}

// electron-builder passes its Arch enum (1 = x64, 3 = arm64); accept names too.
const ORCA_APPIMAGE_NAME_BY_ARCH = new Map([
  [1, 'orca-linux.AppImage'],
  ['x64', 'orca-linux.AppImage'],
  [3, 'orca-linux-arm64.AppImage'],
  ['arm64', 'orca-linux-arm64.AppImage']
])

/**
 * Orca's artifactBuildCompleted hook verifies an AppImage (static runtime, architecture) but
 * only accepts Orca's file names. Run it on a hard link with Orca's name next to the artifact.
 */
function withOrcaAppImageName(baseHook) {
  if (typeof baseHook !== 'function') {
    return baseHook
  }
  return (context) => {
    const orcaName = ORCA_APPIMAGE_NAME_BY_ARCH.get(context.arch)
    if (!context.file.endsWith('.AppImage') || !orcaName) {
      return baseHook(context)
    }
    const aliasDir = mkdtempSync(join(dirname(context.file), '.eddy-appimage-check-'))
    try {
      const alias = join(aliasDir, orcaName)
      linkSync(context.file, alias)
      return baseHook({ ...context, file: alias })
    } finally {
      rmSync(aliasDir, { recursive: true, force: true })
    }
  }
}

function eddyElectronBuilderConfig(base, { eddyVersion, env, eddyDir }) {
  // Why: the identity below only makes sense with the eddy updater/identity switches compiled
  // in (EDDY_VERSION). Without them an eddy-named build would update itself from upstream Orca.
  if (env.EDDY_RELEASE_BUILD !== '1') {
    throw new Error('eddy packaging requires EDDY_RELEASE_BUILD=1 for the app build as well')
  }
  const names = eddyArtifactNames(eddyVersion)
  // Why drop publisherName: eddy builds are unsigned; electron-updater would otherwise reject
  // every eddy installer for not being signed by Orca's publisher.
  const { publisherName: _orcaPublisher, ...signtoolOptions } = base.win.signtoolOptions ?? {}
  return {
    ...base,
    appId: EDDY_APP_ID,
    productName: EDDY_PRODUCT_NAME,
    protocols: [{ name: EDDY_DISPLAY_NAME, schemes: ['eddy'] }],
    artifactBuildCompleted: withOrcaAppImageName(base.artifactBuildCompleted),
    extraMetadata: {
      ...base.extraMetadata,
      name: EDDY_PRODUCT_NAME,
      productName: EDDY_PRODUCT_NAME,
      eddyVersion
    },
    win: { ...base.win, signtoolOptions },
    nsis: {
      ...base.nsis,
      artifactName: names.windowsSetup.replace(/\.exe$/, '.${ext}'),
      shortcutName: EDDY_DISPLAY_NAME,
      uninstallDisplayName: EDDY_DISPLAY_NAME,
      include: join(eddyDir, 'nsis', 'eddy-installer-hooks.nsh')
    },
    linux: {
      ...base.linux,
      target: ['AppImage', 'deb'],
      maintainer: 'eddy contributors',
      desktop: {
        ...base.linux.desktop,
        entry: {
          ...base.linux.desktop?.entry,
          Name: EDDY_DISPLAY_NAME,
          StartupWMClass: EDDY_PRODUCT_NAME
        }
      }
    },
    appImage: {
      ...base.appImage,
      artifactName: names.linuxAppImage.replace(/\.AppImage$/, '.${ext}')
    },
    deb: {
      ...base.deb,
      packageName: EDDY_PRODUCT_NAME,
      artifactName: names.linuxDeb.replace(/\.deb$/, '.${ext}'),
      afterInstall: join(eddyDir, 'linux', 'after-install.sh'),
      afterRemove: join(eddyDir, 'linux', 'after-remove.sh')
    },
    publish: {
      provider: 'github',
      owner: EDDY_RELEASE_OWNER,
      repo: EDDY_RELEASE_REPO,
      releaseType: 'draft'
    }
  }
}

module.exports = {
  EDDY_APP_ID,
  EDDY_DISPLAY_NAME,
  EDDY_PRODUCT_NAME,
  eddyArtifactNames,
  eddyElectronBuilderConfig,
  readEddyVersion,
  withOrcaAppImageName
}
