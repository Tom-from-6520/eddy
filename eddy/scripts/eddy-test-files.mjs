// Prints the vitest files eddy's checks run: eddy-owned tests, the tests next to every upstream
// file with an `eddy:` hook, and all updater tests (the updater carries most of eddy's hooks).
//   node eddy/scripts/eddy-test-files.mjs
import { execFileSync } from 'node:child_process'
import { basename, dirname, extname, posix } from 'node:path'
import { pathToFileURL } from 'node:url'

const isEddyOwned = (file) => file.split('/').includes('eddy')

function git(args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
      .split('\n')
      .filter(Boolean)
  } catch (error) {
    // git grep exits 1 when nothing matches.
    if (error.status === 1 && args[0] === 'grep') {
      return []
    }
    throw error
  }
}

export function selectEddyTestFiles(testFiles, hookedFiles) {
  const selected = new Set(
    testFiles.filter(
      (file) =>
        isEddyOwned(file) ||
        /^src\/main\/updater[^/]*\.test\.ts$/.test(file) ||
        file.startsWith('src/main/updater/')
    )
  )
  for (const file of hookedFiles) {
    if (isEddyOwned(file) || /\.test\.tsx?$/.test(file)) {
      continue
    }
    const stem = posix.join(dirname(file), basename(file, extname(file)))
    for (const test of testFiles) {
      if (test.startsWith(`${stem}.`) && !test.slice(stem.length + 1).includes('/')) {
        selected.add(test)
      }
    }
  }
  return [...selected].sort()
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const testFiles = git(['ls-files', '--', 'src/*.test.ts', 'src/*.test.tsx'])
  const hookedFiles = git(['grep', '-l', '-E', '(//|;|#|/\\*) eddy:', '--', 'src'])
  console.log(selectEddyTestFiles(testFiles, hookedFiles).join('\n'))
}
