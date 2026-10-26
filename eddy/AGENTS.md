# Agent instructions (eddy)

**eddy** is a light fork of [Orca](https://github.com/stablyai/orca) built around **Working Contexts**: named units of work (a project, feature or incident) that group agent threads, context files and read-only background material, and restore their layout when you switch back. It succeeds an earlier VS Code fork, also called eddy (retired; "eddy-vscode" in `DESIGN.md`). Until 10-26 this repo was named `eddy-omega` (`DESIGN.md` O29).

- `eddy/` holds eddy's own docs, scripts and version. The rest of the repo is Orca plus eddy's changes.
- [`eddy/DESIGN.md`](./DESIGN.md) is the source of truth for design decisions. Read it first. When a decision is made or reversed, add a row to its Decision Log and update the affected sections and open questions.
- Orca's root [`AGENTS.md`](../AGENTS.md) still applies to all code: style guide, lint ratchets, cross-platform rules, SSH and folder-workspace use cases.
- Keep changes to upstream Orca files minimal. Put new code in eddy-owned folders (`src/main/eddy/`, `src/renderer/src/eddy/`, `src/shared/eddy/`, tests next to the code) and only add small hook lines to upstream files, marked with an `// eddy:` comment, so rebases stay cheap.
- Orca files have no per-file copyright header; eddy files don't either. `LICENSE` (MIT) stays as it is.

## Syncing with Orca (rebase model)

- Remotes: `origin` = eddy, `upstream` = stablyai/orca (push disabled).
- `upstream` fetches only `main` and release tags. Its tags are stored as **`upstream/v*`** so they never mix with eddy's own `v0.x` tags (Orca already has a `v0.0.1` tag). Set this up in a new clone with:
  ```powershell
  git remote add upstream https://github.com/stablyai/orca.git
  git remote set-url --push upstream DISABLED
  git config remote.upstream.tagOpt --no-tags
  git config --replace-all remote.upstream.fetch '+refs/heads/main:refs/remotes/upstream/main'
  git config --add remote.upstream.fetch '+refs/tags/v*:refs/tags/upstream/v*'
  git fetch upstream
  ```
- eddy's `main` is a short stack of commits on top of an upstream **stable release tag** (currently an exception: `upstream/main` at `d667e54b02` plus a commit stamping Orca `1.4.237`; see `DESIGN.md` O24 and §7.1 "Base off a stable tag" before the next sync).
- Orca tags a stable release every 1–3 days, each on a short release branch cut from `main` (the tagged commit is not on `upstream/main`). Don't chase every release: sync every week or two, or when an upstream fix is needed. Only rebase onto stable tags (never `-rc.N`).
- Before a sync, read **"Carried changes: rebase notes" in [`DESIGN.md`](./DESIGN.md) §7.1**: it lists the upstream work eddy carries ahead of Orca (Copilot chat, a backport of stablyai/orca#30899, plus its Ask guard), how to tell whether the new tag already ships it, which commits to drop or keep (use `git rebase -i --onto …`), and how to resolve its known conflicts.
- To move to a newer release:
  ```powershell
  git fetch upstream
  gh release view --repo stablyai/orca --json tagName -q .tagName   # latest stable, e.g. v1.4.240
  git rebase --onto upstream/<new-tag> upstream/<old-tag> main
  git push --force-with-lease origin main
  ```
  Then update "currently `upstream/…`" above and in `DESIGN.md`.
- Check what eddy changes: `git log --oneline upstream/<base-tag>..main` and `git diff --stat upstream/<base-tag> main`.
- After a sync:
  - `pnpm install --frozen-lockfile`, then review the `pnpm-lock.yaml` and `pnpm-workspace.yaml` diffs (new packages, new `allowBuilds` or `minimumReleaseAgeExclude` entries) before running anything else.
  - Type-check and run eddy's tests (see Building). For carried changes, also run the checks in `DESIGN.md` §7.1 ("Verify after the sync"): eddy CI does not run the ported Copilot tests.
  - Workflows that upstream _adds_ start out enabled on GitHub: run `pwsh eddy/scripts/disable-upstream-workflows.ps1 -Repo <owner>/eddy`.
- **Never `git push --tags`**: it would publish the ~1,000 `upstream/*` tags. Push single tags only.

## First push to a new GitHub repo (once)

Orca has ~90 workflows (push/PR triggers, hourly scheduled builds, self-hosted runners, cloud deployments). None of them should run here.

1. Create an empty repo. Before the first push, turn Actions off: Settings → Actions → General → "Disable actions" (or `gh api -X PUT repos/<owner>/eddy/actions/permissions -F enabled=false`).
2. `git remote add origin https://<user>@github.com/<owner>/eddy.git` (the user name in the URL pins Git Credential Manager to that account), then `git push -u origin main` (`--force` if GitHub created an initial commit; Orca's MIT `LICENSE` must stay as it is).
3. Leave Actions off until eddy has its own workflows. Then, with `gh` signed in to the account that owns the repo (`gh auth status`, `gh auth switch`), turn Actions on and immediately disable every upstream workflow:
   `gh api -X PUT repos/<owner>/eddy/actions/permissions -F enabled=true`
   `pwsh eddy/scripts/disable-upstream-workflows.ps1 -Repo <owner>/eddy`
   Only eddy-owned workflows (`.github/workflows/eddy-*.yml`) stay enabled.

Done for `Tom-from-6520/eddy` on 2026-10-19: pushed with Actions off, then Actions on with every upstream workflow disabled.

## Building locally

- Prerequisites: Node 24, pnpm (exact version pinned by `packageManager` in `package.json`; use `corepack enable`), Bun (version in `config/.bun-version`, used by `pnpm test`). Native modules (`node-pty`, Windows process tree) build with node-gyp. Linux packaging needs Docker.
- Install with `pnpm install --frozen-lockfile` (never `pnpm update` or an unfrozen install; dependency changes come from upstream syncs). Run with `pnpm dev`.
- Verify: `pnpm tc` (type-check), `pnpm test <path>` (tests), `pnpm run check:code-quality:changed` (lint changed files), `pnpm format`. eddy's own test set: `node --test "eddy/build/*.test.cjs"` and `pnpm run test:node $(node eddy/scripts/eddy-test-files.mjs)`.
- Agent-launched app runs and tests use `ORCA_BACKGROUND_LAUNCH=1` (see Orca's `AGENTS.md`).
- Packaging: `pnpm build:win`, `pnpm build:linux`, or `pnpm build:unpack` build **Orca-branded** apps. An eddy package needs `EDDY_RELEASE_BUILD=1` for the whole build, then `pnpm build:release` and `pnpm exec electron-builder --config eddy/build/electron-builder.eddy.config.cjs --win` (or `--linux AppImage deb`); see `.github/workflows/eddy-build.yml`. Cross-architecture builds need `pnpm install:release` first.
- Parallel work: one Git worktree per task, next to the main clone: `git worktree add -b <branch> ..\eddy-worktrees\<name> main`. Each worktree needs its own `pnpm install --frozen-lockfile`. Remove it with `git worktree remove ..\eddy-worktrees\<name>`.

## Versions

- eddy's own version is `eddyVersion` in [`eddy/product.json`](./product.json): **0.1.x = alpha, 0.2.x = beta, 1.x = stable**; bump the patch for each release. `quality` (`alpha`, `beta`, `stable`) names the stage. Release tags are `v<eddyVersion>` (e.g. `v0.1.0`).
- The `version` in `package.json` stays **Orca's** (e.g. `1.4.230`). Never change it: remote and mobile peers check it (`minCompatibleDesktopVersion`), the CLI is stamped with it, and crash reports use it. Only the updater uses `eddyVersion` (below).
- `eddyVersion` lives in its own file because upstream's release commit rewrites the `version` line of `package.json` every release; a field next to it would conflict at every rebase.

## eddy release builds (identity and updater)

eddy differs from Orca only in **release builds**: `EDDY_RELEASE_BUILD=1` makes electron-vite (and the `orcad` esbuild bundle) define `EDDY_VERSION` and `EDDY_QUALITY` (`eddy/build/eddy-vite-defines.mjs`), which `src/shared/eddy/eddy-build.ts` reads. Outside eddy release builds nothing is defined, so dev runs, tests and plain `pnpm build:*` keep Orca's behavior and bytes, and upstream tests stay valid.

- **Identity:** app id `dev.eddy`, name `eddy` (install folder, `%APPDATA%\eddy`, `/opt/eddy`), display name "eddy" (the pinwheel icon lives in `resources/build/icon.*` and `resources/logo.svg`), `%LOCALAPPDATA%\eddy` for the relocated terminal daemon, `/usr/bin/eddy` on Linux. Packaging: `eddy/build/eddy-electron-builder.cjs` (applied to Orca's config by `electron-builder.eddy.config.cjs`, which refuses to run without `EDDY_RELEASE_BUILD=1`), `eddy/nsis/eddy-installer-hooks.nsh`, `eddy/linux/after-*.sh` (copies of Orca's; re-check them after upstream syncs).
- **Folders:** `~/.eddy` instead of `~/.orca` (agent hooks, credentials, keybindings, `orcad` data, the same on SSH/WSL hosts) and `.eddy/` instead of `.orca/` inside repos: `APP_HOME_DIR_NAME` / `REPO_DATA_DIR_NAME` in `src/shared/eddy/eddy-build.ts`. When upstream adds a new `'.orca'` path, use these constants (`git grep -n "'\.orca" -- src` after a sync).
- **Updater:** reads `Tom-from-6520/eddy` releases for every channel and compares `eddyVersion`: the release tags (`v0.x`), electron-updater's current version (`src/main/eddy/eddy-updater-version.ts`), and the `version` in the published `latest.yml` / `latest-linux.yml` (`eddy/build/eddy-update-manifest.cjs`). Orca's changelog is off.
- **Update nudges (push users off a broken release):** commit `eddy/update-nudge.json` on `main`, e.g. `{ "id": "fix-0.1.3", "maxVersion": "0.1.2" }` (`minVersion` / `maxVersion` are `eddyVersion`s; a new `id` re-shows the update card even if dismissed). Installed builds poll it from `raw.githubusercontent.com`; delete the file when the campaign is over.
- **About and Settings** show `0.1.2 alpha (Orca 1.4.230)` (`eddyVersionLabel` in `src/shared/eddy/eddy-build.ts`, from `EDDY_VERSION` / `EDDY_QUALITY`).
- **Orca cloud features** (feedback, crash reports, mobile, Orca account, artifact/skill sharing): feedback and crash reports are blocked in `postFeedback`; the UI entry points are disabled and marked "(orca feat)" via `src/renderer/src/eddy/orca-feature.tsx` (`git grep -n "orca-feature" -- src` lists them). The star prompt is off.
- Hooks in upstream files are marked `eddy:` (`git grep -n "eddy:" -- src electron.vite.config.ts`).

## CI/CD

- **`eddy-checks.yml`** (push and pull request to `main`): type-check, `oxlint` + `oxfmt --check` on changed files, eddy's build-script tests, and the unit tests from `eddy/scripts/eddy-test-files.mjs` (eddy-owned tests, the tests next to every file with an `eddy:` hook, the updater tests).
- **`eddy-build.yml`**: a `v<eddyVersion>` tag builds Windows x64 (NSIS installer, self-updating) and Linux x64 (AppImage, self-updating; `.deb`) and publishes a GitHub release with `SHA256SUMS.txt`. Run it manually (Actions → eddy build → Run workflow) to build without releasing; installers stay as run artifacts for 14 days.
- **Release:** set `eddyVersion` in `eddy/product.json`, commit ("Release 0.1.1"), push, then `git tag v0.1.1; git push origin v0.1.1`. The workflow checks the tag matches `eddyVersion`.
- Releases are **full releases, not pre-releases** (the updater's fallback reads `/releases/latest`, which skips pre-releases); the stage is in the title. Publishing creates a draft first, then publishes it, so installed builds never see a half-uploaded release.
- Publishing uses the built-in Actions token (works on this repo); `secrets.EDDY_RELEASE_TOKEN` (fine-grained, Contents: read and write) takes precedence if set.

## Supply chain

- The lockfile is the contract: frozen installs only; review lockfile diffs on every sync.
- Keep Orca's protections: `minimumReleaseAge` (3-day delay) and its explicit exemptions, the `allowBuilds` allow-list for install scripts, the hash-pinned pnpm, patched dependencies. Don't add exemptions or allow-list entries for eddy additions without a written reason in the commit.
- Prefer building in an isolated environment (dev container, WSL or VM) that holds no personal tokens or SSH keys.
- eddy-owned workflows: pin actions to a commit SHA, give `GITHUB_TOKEN` minimal permissions, never run pull-request code with secrets.

## Pushing

- Git identity for this repo: a GitHub noreply address (`git config user.name/user.email` in the clone). Use `core.autocrlf input` so files stay LF like Orca's.
- Orca uses no Git LFS (unlike VS Code), so plain `git push` works. Never push with `--no-verify`.
