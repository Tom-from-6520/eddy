'use strict'
// electron-builder config for eddy release builds:
//   pnpm exec electron-builder --config eddy/build/electron-builder.eddy.config.cjs --win
const { join } = require('node:path')
const base = require('../../config/electron-builder.config.cjs')
const { eddyElectronBuilderConfig, readEddyVersion } = require('./eddy-electron-builder.cjs')

const root = join(__dirname, '..', '..')

module.exports = eddyElectronBuilderConfig(base, {
  eddyVersion: readEddyVersion(root),
  env: process.env,
  eddyDir: join(root, 'eddy')
})
