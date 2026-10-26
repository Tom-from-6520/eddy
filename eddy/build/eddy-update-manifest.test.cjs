'use strict'
const assert = require('node:assert/strict')
const { describe, it } = require('node:test')
const { stampManifestVersion } = require('./eddy-update-manifest.cjs')

const manifest = `version: 1.4.230
files:
  - url: eddy-0.1.1-windows-x64-setup.exe
    sha512: abc
    size: 10
path: eddy-0.1.1-windows-x64-setup.exe
sha512: abc
releaseDate: '2026-10-19T10:00:00.000Z'
`

describe('eddy update manifest', () => {
  it('replaces only the top-level version with eddyVersion', () => {
    const stamped = stampManifestVersion(manifest, '0.1.1')
    assert.match(stamped, /^version: 0\.1\.1$/m)
    assert.equal(stamped.replace('version: 0.1.1', 'version: 1.4.230'), manifest)
  })

  it('rejects a manifest without a version', () => {
    assert.throws(() => stampManifestVersion('path: x\n', '0.1.1'), /no top-level version/)
  })
})
