# Agent instructions (eddy-omega)

**eddy-omega** is a light fork of [Orca](https://github.com/stablyai/orca) built around **Working Contexts**: named units of work (a project, feature or incident) that group agent threads, context files and read-only background material, and restore their layout when you switch back. It is the Orca-based successor experiment to [eddy](https://github.com/Tom-from-6520/eddy) (a VS Code fork).

- `eddy/` holds eddy-omega's own docs, scripts and version. The rest of the repo is Orca plus eddy-omega's changes.
- [`eddy/DESIGN.md`](./DESIGN.md) is the source of truth for design decisions. Read it first. When a decision is made or reversed, add a row to its Decision Log and update the affected sections and open questions.
- Orca's root [`AGENTS.md`](../AGENTS.md) still applies to all code: style guide, lint ratchets, cross-platform rules, SSH and folder-workspace use cases.
- Keep changes to upstream Orca files minimal. Put new code in eddy-owned folders (`src/main/eddy/`, `src/renderer/src/eddy/`, `src/shared/eddy/`, tests next to the code) and only add small hook lines to upstream files, marked with an `// eddy:` comment, so rebases stay cheap.
- Orca files have no per-file copyright header; eddy files don't either. `LICENSE` (MIT) stays as it is.

## Syncing with Orca (rebase model)

- Remotes: `origin` = eddy-omega, `upstream` = stablyai/orca (push disabled).
- `upstream` fetches only `main` and release tags. Its tags are stored as **`upstream/v*`** so they never mix with eddy-omega's own `v0.x` tags (Orca already has a `v0.0.1` tag). Set this up in a new clone with:
  ```powershell
  git remote add upstream https://github.com/stablyai/orca.git
  git remote set-url --push upstream DISABLED
  git config remote.upstream.tagOpt --no-tags
  git config --replace-all remote.upstream.fetch '+refs/heads/main:refs/remotes/upstream/main'
  git config --add remote.upstream.fetch '+refs/tags/v*:refs/tags/upstream/v*'
  git fetch upstream
  ```
- eddy-omega's `main` is a short stack of commits on top of an upstream **stable release tag** (currently `upstream/v1.4.230`).
- Orca tags a stable release every 1–3 days, each on a short release branch cut from `main` (the tagged commit is not on `upstream/main`). Don't chase every release: sync every week or two, or when an upstream fix is needed. Only rebase onto stable tags (never `-rc.N`).
- To move to a newer release:
  ```powershell
  git fetch upstream
  gh release view --repo stablyai/orca --json tagName -q .tagName   # latest stable, e.g. v1.4.240
  git rebase --onto upstream/<new-tag> upstream/<old-tag> main
  git push --force-with-lease origin main
  ```
  Then update "currently `upstream/…`" above and in `DESIGN.md`.
- Check what eddy-omega changes: `git log --oneline upstream/<base-tag>..main` and `git diff --stat upstream/<base-tag> main`.
- After a sync:
  - `pnpm install --frozen-lockfile`, then review the `pnpm-lock.yaml` and `pnpm-workspace.yaml` diffs (new packages, new `allowBuilds` or `minimumReleaseAgeExclude` entries) before running anything else.
  - Type-check and run eddy's tests (see Building).
  - Workflows that upstream *adds* start out enabled on GitHub: run `pwsh eddy/scripts/disable-upstream-workflows.ps1 -Repo <owner>/eddy-omega`.
- **Never `git push --tags`**: it would publish the ~1,000 `upstream/*` tags. Push single tags only.

## First push to a new GitHub repo (once)

Orca has ~90 workflows (push/PR triggers, hourly scheduled builds, self-hosted runners, cloud deployments). None of them should run here.

1. Make sure `gh` is signed in to the account that owns the repo (`gh auth status`, `gh auth switch`).
2. Create an empty repo (no README/license). Before the first push, turn Actions off:
   `gh api -X PUT repos/<owner>/eddy-omega/actions/permissions -F enabled=false`
3. `git remote add origin https://<user>@github.com/<owner>/eddy-omega.git` (the user name in the URL pins Git Credential Manager to that account), then `git push -u origin main`.
4. Turn Actions back on and disable every upstream workflow:
   `gh api -X PUT repos/<owner>/eddy-omega/actions/permissions -F enabled=true`
   `pwsh eddy/scripts/disable-upstream-workflows.ps1 -Repo <owner>/eddy-omega`
   Only eddy-owned workflows (`.github/workflows/eddy-*.yml`) stay enabled.

## Building locally

- Prerequisites: Node 24, pnpm (exact version pinned by `packageManager` in `package.json`; use `corepack enable`), Bun (version in `config/.bun-version`, used by `pnpm test`). Native modules (`node-pty`, Windows process tree) build with node-gyp. Linux packaging needs Docker.
- Install with `pnpm install --frozen-lockfile` (never `pnpm update` or an unfrozen install; dependency changes come from upstream syncs). Run with `pnpm dev`.
- Verify: `pnpm tc` (type-check), `pnpm test <path>` (tests), `pnpm run check:code-quality:changed` (lint changed files), `pnpm format`.
- Agent-launched app runs and tests use `ORCA_BACKGROUND_LAUNCH=1` (see Orca's `AGENTS.md`).
- Packaging: `pnpm build:win`, `pnpm build:linux`, or `pnpm build:unpack` (unpacked app). Cross-architecture builds need `pnpm install:release` first.
- Parallel work: one Git worktree per task, next to the main clone: `git worktree add -b <branch> ..\eddy-omega-worktrees\<name> main`. Each worktree needs its own `pnpm install --frozen-lockfile`. Remove it with `git worktree remove ..\eddy-omega-worktrees\<name>`.

## Versions

- eddy-omega's own version is `eddyVersion` in [`eddy/product.json`](./product.json): **0.1.x = alpha, 0.2.x = beta, 1.x = stable**; bump the patch for each release. `quality` (`alpha`, `beta`, `stable`) names the stage and the update channel. Release tags are `v<eddyVersion>` (e.g. `v0.1.0`).
- The `version` in `package.json` stays **Orca's** (e.g. `1.4.230`). Never change it: remote and mobile peers check it (`minCompatibleDesktopVersion`), the CLI is stamped with it, and the updater and crash reports use it.
- `eddyVersion` lives in its own file because upstream's release commit rewrites the `version` line of `package.json` every release; a field next to it would conflict at every rebase.
- The release pipeline and updater are not built yet (`DESIGN.md` §8).

## Supply chain

- The lockfile is the contract: frozen installs only; review lockfile diffs on every sync.
- Keep Orca's protections: `minimumReleaseAge` (3-day delay) and its explicit exemptions, the `allowBuilds` allow-list for install scripts, the hash-pinned pnpm, patched dependencies. Don't add exemptions or allow-list entries for eddy additions without a written reason in the commit.
- Prefer building in an isolated environment (dev container, WSL or VM) that holds no personal tokens or SSH keys.
- eddy-owned workflows: pin actions to a commit SHA, give `GITHUB_TOKEN` minimal permissions, never run pull-request code with secrets.

## Pushing

- Git identity for this repo: a GitHub noreply address (`git config user.name/user.email` in the clone).
- Orca uses no Git LFS (unlike VS Code), so plain `git push` works. Never push with `--no-verify`.
