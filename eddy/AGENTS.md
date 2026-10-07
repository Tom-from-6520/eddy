# Agent instructions (eddy)

**eddy** is a light fork of VS Code built around "Contexts": named units of work that keep their own tabs, mounts and chats, and switch in place.

- `eddy/` holds eddy's own docs and assets. The rest of the repo is VS Code plus eddy's changes.
- `eddy/DESIGN.md` is the source of truth for design decisions. It is **local-only** (gitignored, because it contains internal details), so it may not exist in every clone. When it exists, read it first. When a decision is made or reversed, add a row to its Decision Log and update the affected sections and open questions.
- Keep changes to upstream VS Code files minimal. Put new code in eddy-owned folders (e.g. `src/vs/workbench/contrib/contexts/`) and only add small hook lines to upstream files, so rebases stay cheap.

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
