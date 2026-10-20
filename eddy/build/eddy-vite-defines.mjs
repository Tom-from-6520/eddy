import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Reads eddy/product.json; builds run from the repo root, like electron.vite.config.ts. */
export function readEddyProduct(root = process.cwd()) {
  const product = JSON.parse(readFileSync(join(root, 'eddy', 'product.json'), 'utf8'))
  if (typeof product.eddyVersion !== 'string' || typeof product.quality !== 'string') {
    throw new Error('eddy/product.json must contain string eddyVersion and quality')
  }
  return { eddyVersion: product.eddyVersion, quality: product.quality }
}

/**
 * Compile-time constants for src/shared/eddy/eddy-build.ts. They are only defined when
 * EDDY_RELEASE_BUILD=1 (eddy's release workflow); elsewhere they stay undeclared, which reads
 * as off, so dev runs keep Orca's behavior and Orca's build output is byte-identical.
 * @returns {Record<string, string>}
 */
export function eddyViteDefines(env = process.env) {
  if (env.EDDY_RELEASE_BUILD !== '1') {
    return {}
  }
  const product = readEddyProduct()
  return {
    EDDY_VERSION: JSON.stringify(product.eddyVersion),
    EDDY_QUALITY: JSON.stringify(product.quality)
  }
}
