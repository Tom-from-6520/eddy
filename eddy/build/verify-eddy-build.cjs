'use strict'
// Fails an eddy release build that lacks eddy omega's identity or updater switch:
//   node eddy/build/verify-eddy-build.cjs <unpacked app resources dir>
// - out/ must not contain an unsubstituted EDDY_VERSION (the switch would read as off, and
//   the app would update itself from upstream Orca);
// - the packaged package.json must carry eddy omega's name and eddyVersion, and Orca's version.
const { readdirSync, readFileSync } = require('node:fs')
const { join } = require('node:path')
const { readEddyVersion } = require('./eddy-electron-builder.cjs')

function findUnsubstitutedDefine(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      const found = findUnsubstitutedDefine(path)
      if (found) {
        return found
      }
    } else if (
      /\.(c|m)?js$/.test(entry.name) &&
      readFileSync(path, 'utf8').includes('EDDY_VERSION')
    ) {
      return path
    }
  }
  return null
}

function main([resourcesDir]) {
  if (!resourcesDir) {
    throw new Error('usage: verify-eddy-build.cjs <unpacked app resources dir>')
  }
  const root = join(__dirname, '..', '..')
  // Only the electron-vite bundles get the define; out/cli is compiled by tsc without it.
  for (const bundle of ['main', 'renderer']) {
    const unsubstituted = findUnsubstitutedDefine(join(root, 'out', bundle))
    if (unsubstituted) {
      throw new Error(
        `EDDY_VERSION was not substituted in ${unsubstituted}; set EDDY_RELEASE_BUILD=1`
      )
    }
  }
  const asar = require('@electron/asar')
  const packaged = JSON.parse(asar.extractFile(join(resourcesDir, 'app.asar'), 'package.json'))
  const orcaVersion = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version
  const expected = { name: 'eddy-omega', eddyVersion: readEddyVersion(root), version: orcaVersion }
  for (const [key, value] of Object.entries(expected)) {
    if (packaged[key] !== value) {
      throw new Error(`packaged package.json ${key} is ${packaged[key]}, expected ${value}`)
    }
  }
  console.log(`eddy build verified: ${JSON.stringify(expected)}`)
}

main(process.argv.slice(2))
