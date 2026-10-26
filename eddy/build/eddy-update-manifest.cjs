'use strict'
// Writes eddyVersion into electron-updater manifests (latest.yml, latest-linux.yml).
// electron-builder writes the app version (Orca's), but installed eddy builds compare
// eddyVersion (src/main/eddy/eddy-updater-version.ts).
//   node eddy/build/eddy-update-manifest.cjs <eddyVersion> <manifest>...
const { readFileSync, writeFileSync } = require('node:fs')

function stampManifestVersion(text, eddyVersion) {
  const versionLine = /^version: .*$/m
  if (!versionLine.test(text)) {
    throw new Error('update manifest has no top-level version line')
  }
  return text.replace(versionLine, `version: ${eddyVersion}`)
}

function main(args) {
  const [eddyVersion, ...manifests] = args
  if (!eddyVersion || manifests.length === 0) {
    throw new Error('usage: eddy-update-manifest.cjs <eddyVersion> <manifest>...')
  }
  for (const manifest of manifests) {
    writeFileSync(manifest, stampManifestVersion(readFileSync(manifest, 'utf8'), eddyVersion))
    console.log(`${manifest}: version ${eddyVersion}`)
  }
}

if (require.main === module) {
  main(process.argv.slice(2))
}

module.exports = { stampManifestVersion }
