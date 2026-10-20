'use strict'
// Run with: node --test "eddy/build/*.test.cjs"
const assert = require('node:assert/strict')
const {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} = require('node:fs')
const { tmpdir } = require('node:os')
const { basename, join } = require('node:path')
const { describe, it } = require('node:test')
const {
  eddyArtifactNames,
  eddyElectronBuilderConfig,
  readEddyVersion,
  withOrcaAppImageName
} = require('./eddy-electron-builder.cjs')

const root = join(__dirname, '..', '..')
const eddyDir = join(root, 'eddy')
const releaseEnv = { EDDY_RELEASE_BUILD: '1' }

function fakeBase() {
  const sign = () => {}
  return {
    appId: 'com.stablyai.orca',
    productName: 'Orca',
    files: ['!src{,/**/*}'],
    win: {
      executableName: 'Orca',
      signtoolOptions: { sign, publisherName: 'SignPath Foundation' }
    },
    nsis: { artifactName: 'orca-windows-setup.${ext}', createDesktopShortcut: 'always' },
    linux: { executableName: 'orca-ide', desktop: { entry: { StartupWMClass: 'orca' } } },
    appImage: { artifactName: 'orca-linux.${ext}' },
    deb: { packageName: 'orca-ide', depends: ['xvfb'] },
    publish: { provider: 'github', owner: 'stablyai', repo: 'orca' }
  }
}

describe('eddy electron-builder config', () => {
  it('refuses to package without EDDY_RELEASE_BUILD=1', () => {
    assert.throws(
      () => eddyElectronBuilderConfig(fakeBase(), { eddyVersion: '0.1.0', env: {}, eddyDir }),
      /EDDY_RELEASE_BUILD=1/
    )
  })

  it("replaces Orca's identity, artifact names and release repo", () => {
    const config = eddyElectronBuilderConfig(fakeBase(), {
      eddyVersion: '0.1.3',
      env: releaseEnv,
      eddyDir
    })
    assert.equal(config.appId, 'dev.eddy.omega')
    assert.equal(config.productName, 'eddy-omega')
    assert.deepEqual(config.extraMetadata, {
      name: 'eddy-omega',
      productName: 'eddy-omega',
      eddyVersion: '0.1.3'
    })
    assert.equal(config.nsis.artifactName, 'eddy-omega-0.1.3-windows-x64-setup.${ext}')
    assert.equal(config.nsis.shortcutName, 'eddy omega')
    assert.equal(config.nsis.createDesktopShortcut, 'always')
    assert.equal(config.appImage.artifactName, 'eddy-omega-0.1.3-linux-x86_64.${ext}')
    assert.equal(config.deb.artifactName, 'eddy-omega-0.1.3-linux-amd64.${ext}')
    assert.equal(config.deb.packageName, 'eddy-omega')
    assert.deepEqual(config.deb.depends, ['xvfb'])
    assert.equal(config.linux.desktop.entry.StartupWMClass, 'eddy-omega')
    assert.deepEqual(config.linux.target, ['AppImage', 'deb'])
    assert.deepEqual(config.publish, {
      provider: 'github',
      owner: 'Tom-from-6520',
      repo: 'eddy-omega',
      releaseType: 'draft'
    })
    assert.deepEqual(config.files, ['!src{,/**/*}'])
  })

  it("keeps Orca's sign hook but drops its publisher, since eddy builds are unsigned", () => {
    const base = fakeBase()
    const config = eddyElectronBuilderConfig(base, {
      eddyVersion: '0.1.0',
      env: releaseEnv,
      eddyDir
    })
    assert.equal(config.win.signtoolOptions.sign, base.win.signtoolOptions.sign)
    assert.equal('publisherName' in config.win.signtoolOptions, false)
    assert.equal(config.win.executableName, 'Orca')
  })

  it('names artifacts after eddyVersion', () => {
    assert.deepEqual(eddyArtifactNames('0.2.0'), {
      windowsSetup: 'eddy-omega-0.2.0-windows-x64-setup.exe',
      linuxAppImage: 'eddy-omega-0.2.0-linux-x86_64.AppImage',
      linuxDeb: 'eddy-omega-0.2.0-linux-amd64.deb'
    })
  })

  it("runs Orca's AppImage check on a link with Orca's file name, then removes it", () => {
    const dir = mkdtempSync(join(tmpdir(), 'eddy-appimage-test-'))
    try {
      const file = join(dir, 'eddy-omega-0.1.0-linux-x86_64.AppImage')
      writeFileSync(file, 'appimage-bytes')
      const seen = []
      const hook = withOrcaAppImageName((context) => {
        seen.push({
          ...context,
          bytes: existsSync(context.file) ? readFileSync(context.file, 'utf8') : null
        })
      })
      hook({ file, arch: 1 })
      hook({ file: join(dir, 'eddy-omega-0.1.0-linux-amd64.deb'), arch: 1 })
      assert.equal(basename(seen[0].file), 'orca-linux.AppImage')
      assert.equal(seen[0].bytes, 'appimage-bytes')
      assert.equal(existsSync(seen[0].file), false)
      assert.equal(basename(seen[1].file), 'eddy-omega-0.1.0-linux-amd64.deb')
      assert.deepEqual(readdirSync(dir), ['eddy-omega-0.1.0-linux-x86_64.AppImage'])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('reads a valid eddyVersion from eddy/product.json', () => {
    assert.match(readEddyVersion(root), /^\d+\.\d+\.\d+$/)
  })

  it("applies to Orca's real config (needs node_modules)", (t) => {
    let base
    try {
      base = require('../../config/electron-builder.config.cjs')
    } catch (error) {
      if (error && error.code === 'MODULE_NOT_FOUND') {
        t.skip('dependencies not installed')
        return
      }
      throw error
    }
    const config = eddyElectronBuilderConfig(base, {
      eddyVersion: readEddyVersion(root),
      env: releaseEnv,
      eddyDir
    })
    assert.equal(config.appId, 'dev.eddy.omega')
    assert.equal(typeof config.beforePack, 'function')
    assert.equal(typeof config.win.signtoolOptions.sign, 'function')
    assert.equal(config.linux.executableName, 'orca-ide')
  })
})
