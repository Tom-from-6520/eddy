# Agent instructions (eddy)

**eddy** is a light fork of VS Code built around **Working Contexts**: named units of work (a project, feature or incident) that group agent threads, context files and read-only background material, and restore their layout when you switch back. eddy is built on VS Code's Agents window.

- `eddy/` holds eddy's own docs and assets. The rest of the repo is VS Code plus eddy's changes.
- `eddy/DESIGN.md` is the source of truth for design decisions. It is **local-only** (gitignored, because it contains internal details), so it may not exist in every clone. When it exists, read it first. When a decision is made or reversed, add a row to its Decision Log and update the affected sections and open questions.
- Keep changes to upstream VS Code files minimal. Put new code in eddy-owned folders (e.g. `src/vs/sessions/contrib/workingContexts/`) and only add small hook lines to upstream files, marked with an `eddy:` comment, so rebases stay cheap.
- New eddy files use the header `Copyright (c) eddy contributors. All rights reserved.` (lint and hygiene accept it); upstream files keep Microsoft's header, as the MIT license requires.
- User-facing "VS Code" text becomes "eddy" automatically: at build time for core UI strings (`build/next/nls-plugin.ts`) and at runtime for extension manifests and extension strings (`brandMessage` in `src/vs/nls.ts`). Don't edit upstream strings just to rename the product.

## Syncing with VS Code (rebase model)

- Remotes: `origin` = eddy, `upstream` = microsoft/vscode (push disabled).
- eddy's `main` is a short stack of commits on top of an upstream **release tag** (currently `1.141.0`).
- To move to a newer release:
  ```powershell
  git fetch upstream --tags
  git rebase --onto <new-tag> <old-tag> main
  git push --force-with-lease origin main
  ```
- Check what eddy changes: `git log --oneline <base-tag>..main` and `git diff --stat <base-tag> main`.
- After a sync, check GitHub Actions: upstream's own workflows are **disabled** on the eddy repo (they need Microsoft runners or burn minutes). A workflow that upstream *adds* starts out enabled, so disable it (Actions → workflow → "Disable workflow"). Only `eddy-build.yml` and `eddy-checks.yml` should be enabled.

## Building locally

- Set once (user environment): `FOUNDRY_LOCAL_SKIP_INSTALL=1` (its install script downloads from NuGet, which some networks block) and, with Visual Studio 2026, `vs2022_install=<VS install folder>` (upstream's preinstall check only knows VS 2019/2022). Visual Studio needs the Spectre-mitigated libs for its **default** MSVC toolset.
- `npm ci`, then `npm run watch`; wait for the first build to finish before launching `.\scripts\code.bat` (the dev build lists CSS files once at startup).

## Releases and updates

- eddy is in **alpha**: `product.json` has `"quality": "alpha"` (the app reports version `1.141.0-alpha`), releases are GitHub **pre-releases**, and tags are `v<upstream-version>-alpha.<n>`.
- **Release:** `git tag v1.141.0-alpha.2; git push origin v1.141.0-alpha.2`. `.github/workflows/eddy-build.yml` builds Windows x64 (user installer + portable zip) and Linux x64 (`.deb` + `.tar.gz`) in parallel, publishes the pre-release with `SHA256SUMS.txt`, and updates the **update feed**. Publishing needs the repo secret **`EDDY_RELEASE_TOKEN`** (a fine-grained token with *Contents: read and write* on this repo): the built-in Actions token gets HTTP 403 when creating releases on this account.
- **Update feed:** the release tagged `updates` holds one JSON manifest per quality and platform (`alpha-win32-x64-user.json`, `alpha-win32-x64-archive.json`, `alpha-linux-x64.json`). Installed builds read `<updateUrl>/<quality>-<platform>.json` (patched `createUpdateURL` in `src/vs/platform/update/electron-main/abstractUpdateService.ts`); a manifest for another commit is an update. Windows (installed with the user setup) downloads and installs it in the background, then shows **Restart to Update**. The portable zip and Linux show **Download Update**, which opens the release page. The feed needs a **public** repo, because updates are downloaded without signing in.
- **Checks:** `.github/workflows/eddy-checks.yml` runs on every push and pull request to `main`: compile (type-check), lint changed files, and eddy's unit tests (all test files with the eddy header).
- Test build without releasing: run **eddy build** manually (Actions → eddy build → Run workflow); the installers are kept as run artifacts for 14 days.
- **Local fallback** (if Actions is unavailable): `pwsh eddy/scripts/release.ps1 -Tag <tag>` builds Windows and creates the release from this machine. Linux is built in WSL (Ubuntu 24.04) from a clone on the Linux disk (`/root/eddy`), not from `/mnt/c` (too slow):
  ```powershell
  wsl -d Ubuntu-24.04 -u root -- bash -c 'cd /root/eddy && git fetch --depth 1 origin main && git reset --hard FETCH_HEAD && ./eddy/scripts/linux-build.sh build'
  pwsh eddy/scripts/release-linux.ps1 -Tag <tag>   # attach to the existing release
  ```
  The local scripts don't update the update feed.
- `linux-build.sh deps` (once, as root) installs the apt packages and Node. The Linux build follows upstream's pipeline (glibc 2.28 sysroot, Chromium clang), so the `.deb` also runs on older Ubuntu/Debian releases. The Rust tunnel CLI (`bin/eddy-tunnel`) isn't built on any platform. To start eddy inside WSL, set `DONT_PROMPT_WSL_INSTALL=1`.
- Branding lives in `product.json` (name, data folder `.eddy`, installer app IDs). Never change the `win32*AppId` GUIDs: they identify the installed app for upgrades. Package metadata (publisher, maintainer) is in `build/lib/electron.ts`, `build/gulpfile.vscode.ts`, `build/win32/code.iss` and `resources/linux/`. The `.deb` must not register Microsoft's apt repository (`resources/linux/debian/postinst.template`).

## Pushing

- `origin` is pinned to the GitHub account in its URL (`https://Tom-from-6520@github.com/...`), so Git Credential Manager uses that account's stored login without prompting.
- Upstream keeps Copilot simulation-test caches (`extensions/copilot/**/*.sqlite`) in **Git LFS**. GitHub rejects pushes whose history refers to LFS objects it doesn't have (`GH008`). **Never push with `--no-verify`**: that skips the LFS upload hook.
- After syncing to a new upstream tag, fetch any new LFS objects from upstream before pushing:
  ```powershell
  git lfs fetch --all upstream main
  git lfs push --all origin main
  git push --force-with-lease origin main
  ```
- Cloning eddy elsewhere: a normal `git clone` works, since the LFS objects are on GitHub (about 0.26 GB).
