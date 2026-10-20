# eddy-omega — Design Doc (v1, living)

> **Committed and public.** Unlike eddy's design doc, this one contains no employer-internal details, so it lives in the repo. Keep it that way: no internal tool names, cluster URLs, tokens or machine paths.
> **How to use:** read §1–4 for what eddy-omega is and why it's built on Orca, §5 for how it maps onto Orca, §11 for what's next. When you decide something, add a row to §13 and update the affected section.
> **Lineage:** eddy-omega carries the design of [eddy](https://github.com/Tom-from-6520/eddy) (a VS Code fork). Decisions that still hold are copied into §13; eddy's own docs are history only.
> Last updated: 2026-10-20 (eddy omega 0.1.1 alpha; base `upstream/v1.4.230`).

---

## 1. Why eddy-omega (and why Orca)

eddy was a light fork of VS Code, built around its Agents window. Two constraints drove that choice: it had to **build on an employer-managed machine** (whose package feed lacked some of Orca's dependencies), and it had to use an **employer-internal agent hub** as the backend. eddy-omega is a personal project developed outside that environment, so neither constraint applies.

Without them, Orca is the closer base:
- **What Orca gives for free:** in-place switching, several agents side by side, worktree management, native chat, an updater with an "Update available" card, SSH hosts, a mobile companion, a CLI. It is MIT-licensed, built on Electron + React + TypeScript, and much smaller than VS Code.
- **What Orca lacks:** its unit of work is **one workspace = one git worktree (or folder)**. That is exactly the limitation in §2. eddy-omega must add a layer above workspaces without fighting Orca's core.

eddy-omega is a **time-boxed trial**. It succeeds if the behavior in §3–4 can be built on Orca's own concepts with a small number of hook lines in upstream files, and the rebase cost stays low. Otherwise eddy (VS Code) remains the main line. See §11 for the pass/fail checks.

### 1.1 Approach: learn Orca's way first
- **Names are not requirements.** "Working Context", "thread", "context files" and "background" are brainstorming names. The product can use Orca's names (project, workspace, chat session, …) as long as the behavior in §3–4 is met. Prefer Orca's concepts and names; add a new concept only when no Orca concept can carry the behavior.
- **Lesson from eddy:** eddy added Working Contexts beside VS Code's model. They had no relation to the workspace used for file exploring and git, and no native shortcut. In eddy-omega, every feature must work *with* Orca's file explorer, source control, layout and keybindings, not next to them.
- So: first understand how Orca does things (§5.1, the Orca study in §11), then change it to fit.

## 2. Problem

I switch work context all the time: a feature on a branch; interrupts (bug, incident, data investigation) that need read-only access to `main` or other repos, sometimes before any branch exists; a fix on a bug-fix branch in parallel. When I come back to a piece of work, everything must be where I left it.

| Tool | Problem |
|---|---|
| VS Code | Everything is tied to a folder; two efforts in one repo collide; the layout reorganizes itself. |
| Orca | Great in-place switching, but each unit is locked to one git branch/worktree; no parallel read-only `main`; no grouping of several workspaces/repos into one piece of work. |
| Chat history (VS Code, Copilot CLI) | Flat by date; no grouping by piece of work. |

## 3. Design input (from the original drawing)

- **Dislike: "one conversation per line."** I need more than one conversation for the same work, or to investigate two things at once.
- **Each Working Context needs:**
  - **context files:** `.md`, `.html` and other notes/artifacts;
  - **background info:** for reference, rarely edited: **reference repos (read-only)** and **reference files/folders**;
  - **working threads:** the agent sessions. *The most important part: the equivalent of files in a traditional file system.*
- **Main area:** shows whatever is selected. **The layout is saved per Working Context.**
- **Also needed:** MCP servers; skills (local and global); a real file explorer; git source control. Smaller: git blame; the current thread's branch.
- **Every function gets its own keyboard shortcut.**
- **Keep:** a real chat layout (not only a terminal) and a way to jump between turns of a conversation.
- **Updates like Orca:** a small "Update available" card with one **Update** button; sessions aren't interrupted.

## 4. Core model (brainstorm names; see §1.1)

A **Working Context** = one piece of work (feature, bug, incident, investigation). In the product this may simply be an Orca project/workspace (or a group of them) that behaves this way. It owns:

| Part | What | Access |
|---|---|---|
| **Threads** | Agent sessions (native chats or agent terminals). **1 thread = 1 conversation.** A context has many; several can run and be open side by side. | read/write |
| **Context files** | Notes and artifacts, kept in the context's own folder. | read/write |
| **Background** | Reference repos (read-only snapshots, e.g. `main`) and reference files/folders. | read-only (mostly) |
| **Layout** | Which threads/files are open and how they're arranged. Restored when you come back. | — |

Rules (carried over from eddy):
- The context folder is **eddy-managed by default** (`~/eddy/contexts/<name>-<id>/`) and **easy to open** (reveal in the OS file manager; visible in the file explorer so files can be dropped in).
- When a thread starts changing code, **ask per thread**: its own worktree + branch, or work directly in the checkout. Reference repos are always read-only.
- Everything stays loaded; switching context only swaps what's shown (instant). Orca already behaves this way for workspaces.
- Whatever is selected drives the **file explorer, source control and the current branch** shown, and every action has a **keybinding** in Orca's keybinding system (`~/.eddy/keybindings.json`, §9.1).

## 5. Mapping onto Orca

### 5.1 Orca's model (as of v1.4.230)
- **Project → Repo → Workspace.** A workspace is a git worktree (main checkout, branch worktree, detached HEAD) or a **folder workspace** (non-git folder). Types: `src/shared/project-types.ts`, `src/shared/repo-types.ts`, `src/shared/worktree/types.ts`, kinds in `src/shared/worktree/workspace-kinds.ts`.
- **Project groups** group projects in the sidebar (`src/shared/project-group-types.ts`, `src/main/project-groups/`). They group repos, not workspaces.
- Each workspace has **tabs and split panes**: terminals, native chats, editor (Monaco), browser, diffs. Layout is kept **per workspace** (`src/renderer/src/store/workspace-layout-cache.ts`).
- **Native chat** (`src/main/native-chat/`, `src/renderer/src/components/native-chat/`): Claude, Codex, Pi, and ACP agents (`src/main/acp/acp-launch-specs.ts`: Grok, OpenCode, omp, Antigravity). Every other agent, **including GitHub Copilot CLI, runs as a terminal agent**.
- Execution hosts: local, WSL, SSH, and paired remote Orca runtimes. Mobile companion via Orca's relay service.
- State lives in the renderer store (`src/renderer/src/store/`, Zustand slices) and is persisted by main (`src/shared/persisted-state-types.ts`).

### 5.2 First guess: Working Context on Orca (revisit after the Orca study)

This table was written before studying Orca in depth. Treat it as hypotheses for the Orca study (§11), not a plan.

| Working Context part | Orca building block | Gap / eddy work |
|---|---|---|
| The context itself | none | New eddy entity `WorkingContext { id, name, folder, workspaceIds[], layout }` in an eddy-owned store slice, persisted by main. Sidebar hook to list contexts → their workspaces/threads. |
| Context folder | **folder workspace** (non-git) | Create the folder, register it as a folder workspace, attach it to the context. This also gives a **branch-less investigation space** for free. |
| Threads | native chats / agent terminals inside workspaces (tabs, splits) | Assign threads to the context; a context spans several workspaces (and repos). |
| Thread needs code changes | Orca's worktree creation; "direct" = the repo's main workspace | The per-thread "own worktree or direct?" prompt (W2c). |
| Background: reference repo | **detached-HEAD workspace** of `main` | Create it on demand, mark it read-only (eddy-enforced), show it under the context's Background. |
| Background: reference files/folders | folder workspace / file links | Read-only marker. |
| Per-context layout | per-workspace layout cache | Context layout = which workspaces/threads are visible and how they're split. **Unknown: can Orca's main area show panes from different workspaces side by side?** Trial check T3. |
| Chat history menu (jump between turns) | native chat timeline | Check what Orca's native chat already offers. |
| MCP / skills panels | Orca skills, plugins, per-agent config | Decide placement later (Q-UI1). |

## 6. Agent backends

- Orca is agent-agnostic. Native chat currently covers Claude, Codex, Pi and some ACP agents.
- **Copilot CLI as a native chat:** Copilot CLI supports `--acp` (Agent Client Protocol over stdio). Adding one ACP launch spec (`agent`, `command: 'copilot'`, `args: ['--acp', …]`, sign-in command) next to the existing ones in `acp-launch-specs.ts` should give Copilot a real chat UI. Small, contained change → good first eddy feature (W3).
- The employer-internal agent hub and its internal MCP servers are **out of scope** for eddy-omega.
- **MCP:** each agent reads its own MCP config. Plan (from eddy): an eddy MCP catalog; each Working Context enables a subset; passed to each agent in its own format. Q8.

## 7. Fork & sync model

Details and commands: [`eddy/AGENTS.md`](./AGENTS.md).

- Light fork, **rebase model**: `main` = eddy-omega's commits on top of an upstream **stable release tag** (currently `upstream/v1.4.230`).
- `origin` = eddy-omega (personal GitHub account), `upstream` = stablyai/orca (push disabled). Upstream fetches only `main` and `v*` tags, stored as `upstream/v*`, so they never collide with eddy-omega's own `v0.x` release tags.
- Orca releases every 1–3 days (tags on short release branches). Sync every week or two onto the latest stable tag; never onto `-rc` tags.
- Upstream edits stay small and marked `// eddy:`; new code goes in `src/{main,renderer/src,shared}/eddy/`.
- All upstream GitHub workflows (~90) are disabled on eddy-omega; only `eddy-*.yml` run. Upstream's Dependabot config is removed (dependency updates come with upstream syncs).

## 8. Versions, releases, updates

- **Version:** `eddyVersion` in `eddy/product.json` — **0.1.x = alpha, 0.2.x = beta, 1.x = stable**; bump the patch for each release; tags `v<eddyVersion>`. `quality` names the stage.
- **`package.json` `version` stays Orca's.** Orca uses it for compatibility with remote/mobile peers (`minCompatibleDesktopVersion`), CLI stamping and crash reports. eddyVersion is kept in its own file because upstream's release commit rewrites the `version` line every release.
- **eddy release builds.** Everything eddy-specific at runtime switches on a compile-time constant: `EDDY_RELEASE_BUILD=1` → electron-vite defines `EDDY_VERSION` (`eddy/build/eddy-vite-defines.mjs`) → `src/shared/eddy/eddy-build.ts`. Dev runs, tests and plain Orca builds keep Orca's behavior, so upstream's own tests keep passing. The eddy packaging config refuses to run without the flag, so an eddy-named installer can't ship with Orca's updater.
- **Updater (Spike U1 → option (a), built 10-19).** Orca's updater (`src/main/updater/`) lists newer release tags from the GitHub atom feed (`updater-prerelease-feed.ts`), pins electron-updater's generic feed to that tag, and electron-updater installs only a `latest*.yml` whose version is greater than its current version. In eddy release builds:
  - every channel's repo, the atom feed and the fallback feed are `Tom-from-6520/eddy-omega` (`release-channel.ts`, `updater-prerelease-feed.ts`, `updater-setup.ts`, `updater-release-feed.ts`);
  - version comparisons use `eddyVersion` (`getUpdaterAppVersion()` in `updater-release-feed.ts`, `updater-events.ts`, `updater-install-support.ts`), and electron-updater's own current version is replaced with `eddyVersion` when it loads (`electron-updater-loader.ts` → `src/main/eddy/eddy-updater-version.ts`);
  - the release workflow writes `eddyVersion` into `latest.yml` / `latest-linux.yml` (`eddy/build/eddy-update-manifest.cjs`);
  - Orca's changelog (keyed to Orca versions) is off. Update nudges are off until eddy's own nudge file exists (§9: decided to host it, to build).
  - Releases are full GitHub releases, not pre-releases: the updater's fallback reads `/releases/latest`, which skips pre-releases.
  - Not adapted: the hidden build picker (Alt-click on the release channel) still checks profile compatibility against Orca's version.
- **Platforms:** Windows x64 (NSIS installer, self-updating) and Linux x64 (AppImage, self-updating; `.deb`). macOS needs an Apple Developer account and notarization; later, if ever.
- **Signing:** Orca signs Windows builds via SignPath Foundation. eddy builds are unsigned (SmartScreen warns); the packaging drops Orca's `publisherName` so electron-updater doesn't reject unsigned eddy installers. Later: eddy's own SignPath (OSS) project or certificate, then restore a `publisherName`.
- **Identity (Q-N1 decided 10-19: "eddy omega").** App id `dev.eddy.omega`; name `eddy-omega` (install folder, Electron data folder `%APPDATA%\eddy-omega`, `/opt/eddy-omega`, Linux WM class); display name "eddy" (shortcuts, Start menu, desktop entry, window/app name; app icon is eddy's pinwheel, `resources/build/icon.*`); `%LOCALAPPDATA%\eddy-omega` for the relocated terminal daemon; `/usr/bin/eddy-omega`; own document ProgIDs; protocol `eddy-omega://`. Implemented in `eddy/build/eddy-electron-builder.cjs` (wraps Orca's electron-builder config), `eddy/nsis/eddy-installer-hooks.nsh`, `eddy/linux/after-*.sh`, and hooks in `dev-instance-identity.ts` and `daemon-host-relocation.ts`.
- **Still shared with Orca** (fine unless both are installed and used on one machine):
  - `~/.orca` and the per-repo `.orca/` + `orca.yaml`: **decided 10-20 to move to `~/.eddy`, `.eddy/` and `eddy.yaml`** (§9.1; to build).
  - Executable names: `Orca.exe` on Windows (Orca's Rust CLI launcher looks for it), `orca-ide` on Linux, the `orca` / `orca-ide` CLI commands (Q-I1).
  - The eddy uninstaller doesn't kill a running eddy terminal daemon (Orca's kills by image name, which would also hit Orca's); a leftover `%LOCALAPPDATA%\eddy-omega` may remain.
  - `orca://` deep links in app code; Orca's `agent-state-rules` live update still reads Orca's releases (data, harmless).
  - UI text still says "Orca" (and "orca.yaml"). Proposal: one rebranding hook in Orca's i18n `translate()`, like eddy's `brandMessage`, instead of editing strings (W-B1).

## 9. Orca services (decided 10-20, to build as W-S1)

Orca talks to Stably/Orca services. Decisions for eddy release builds:

| Service | Where | Decision |
|---|---|---|
| Telemetry (PostHog) | `src/main/telemetry/` | **Off** (already): only sends when CI injects `ORCA_POSTHOG_WRITE_KEY` + build identity. Never inject it. |
| Feedback, crash reports | `FEEDBACK_API_URL` (`www.onorca.dev/v1/feedback`) in `src/main/ipc/feedback-request.ts`; crash reports go through it (`crash-reporting-submission.ts`) | **Never sent.** Block the request in main; disable the submit buttons with "(orca feat)" in their tooltip. Crash data stays local. |
| Update nudges | `src/main/updater-nudge.ts` (fetch), `src/main/updater/updater-nudge.ts` (apply) | **On, from eddy.** A nudge is `{ id, minVersion?, maxVersion? }`; when the installed version is in range, the app re-checks for updates at once and re-shows the update card even if dismissed. Host `eddy/update-nudge.json` on `main` (raw GitHub URL), compare with `eddyVersion`; no file = no nudge. Two hooks. Use it to push users off a broken release. |
| "Star the repo" prompt | `src/main/star-nag/`, `StarNagCard`, `StarNagToastHost` | **Off.** |
| Mobile companion (relay, push), Orca account (login), share/publish links, skill sharing | `relay*/push/login/share.onorca.dev`; UI: sidebar Mobile button (`SidebarNav.tsx`), `MobilePage`, `OrcaAccountSettingsPane`, `ShareSkillsSettingsPane`, `ArtifactPublishButton`, `doc-preview-artifact-share`, `EditorPanelHeader`, browser toolbars, `NativeChatInlineVisual`, skill install dialogs | **Disabled for now.** Buttons stay visible but disabled, with **"(orca feat)"** appended to their title/tooltip, so we remember to replace or remove them later. ~8–10 small UI hooks. |
| Update feed, changelog | `github.com/stablyai/orca/releases`, `onorca.dev/whats-new/changelog.json` | **eddy-omega's releases** (done, §8); Orca's changelog off. |

### 9.1 Home and repo folders (decided 10-20, to build as W-S2)

**`~/.orca` → `~/.eddy`.** `~/.eddy` is also the VS Code-based eddy's data folder (`extensions/`, `argv.json`); no file names clash. What eddy omega keeps there:

| What | Files | Notes |
|---|---|---|
| Agent-hook scripts | `agent-hooks/` (Claude, Codex, Gemini, Cursor, Copilot, Grok, …), install lock, `grok-owners`, `claude-agent-teams-bin/` | Each agent CLI's **global** config (e.g. `~/.claude/settings.json`) gets a hook entry pointing at these scripts; that is how Orca knows an agent is working/idle/waiting. Events go to whichever app launched the agent (`ORCA_AGENT_HOOK_PORT/TOKEN/ENDPOINT` in that terminal), not to the script's owner. **Check while building:** with Orca also installed, both apps register an entry, so each hook may fire twice; and how Orca cleans up entries it doesn't own. |
| Credentials and API keys | Bitbucket, Jira, Linear, MiniMax cookies, OpenAI (speech) key, ZCode key, the encrypted API-key store, `orcad` secret key | Encrypted with the OS secret store. After the move you sign in again once in eddy omega; Orca's copies stay in `~/.orca`. |
| Keybindings | `keybindings.json` | Orca's format. Not shared with the VS Code eddy in practice: VS Code keeps its keybindings in `%APPDATA%\eddy\User\` in another format. |
| Headless server (`orcad`) data | user data, e2ee keypair, profile-state access | Only when running `orca serve` / remote runtimes. |
| Remote hosts (SSH, WSL) | `~/.orca` on the remote: deployed runtime, hook scripts | Becomes `~/.eddy` on the remote too. |

Scope: ~40 lines in ~35 files (a shared `EDDY_HOME_DIR` constant via `eddyAwareIdentity('.orca', '.eddy')`). Shell/PowerShell hook command strings embed the path, so test hooks by hand on Windows, WSL and one SSH host.

**Per-repo `.orca/` → `.eddy/`, `orca.yaml` → `eddy.yaml`.** `.orca/` holds dropped files, markdown templates, issue commands and browser downloads, and is added to `.gitignore`. `orca.yaml` is the committable project config (setup scripts, hooks); proposal: read `eddy.yaml` and fall back to `orca.yaml`, so repos set up for Orca still work. ~10 code sites for each; UI strings via W-B1.

## 10. Security and supply chain

- **Dependencies:** frozen installs only; review `pnpm-lock.yaml` diffs on every sync. Orca already enforces a 3-day `minimumReleaseAge`, an `allowBuilds` allow-list for install scripts, a hash-pinned pnpm and patched dependencies; keep them. Optional: OSV-Scanner / Socket in eddy CI.
- **Isolation:** build and run agents in a dev container, WSL or VM without personal tokens/SSH keys where practical.
- **CI/release:** eddy workflows pin actions by SHA, minimal permissions, a protected environment for the release token, tag protection rules, build provenance attestations. The update feed is the highest-value target: whoever can publish to it ships code to every install.
- **Agents:** pin MCP server versions; be careful with auto-approve; treat untrusted repos as prompt-injection sources.
- **Accounts:** personal GitHub account (with a hardware security key), personal model subscriptions; nothing from an employer.

## 11. What's next (trial plan)

1. ~~**T0 — Fork setup**~~ — done 10-19: clone, `upstream` remote, `main` on `upstream/v1.4.230`, docs, version file, workflow-disable script; pushed to `Tom-from-6520/eddy-omega` (public).
2. ~~**CI/CD**~~ — 10-19: `eddy-checks.yml`, `eddy-build.yml`, eddy omega identity and updater (§8). Actions enabled with every upstream workflow disabled. See §11a for verification status.
3. **T1 — Build and run from source** on the personal machine (`pnpm install --frozen-lockfile`, `pnpm dev`, `pnpm tc`, one test), and **test the updater by hand**: install 0.1.0, release 0.1.1, update. Note every prerequisite in `eddy/AGENTS.md`.
4. **W-S1 — Orca services** (§9): block feedback/crash submission, star prompt off, eddy-hosted update nudges, "(orca feat)" disabled buttons. Small, independent of the Orca study; can run in parallel with it.
5. **T2 — Orca study** (§1.1): use eddy omega for real work for a few days and read the code behind what you use, then write **§5.1 "Orca's model"** in Orca's own terms: projects/repos/workspaces, the sidebar, tabs/splits and layout (answers Q-L1), native chat sessions (how many per workspace, history), file explorer and source control (what drives them), keybindings and the command palette, settings/profiles. End with a gap list: each need in §3–4 → "Orca already does it", "small change to an Orca concept", or "new concept".
6. **W-S2 — `~/.eddy`, `.eddy/`, `eddy.yaml`** (§9.1). After T1, because agent hooks must be tested by hand.
7. **T3 — First change in Orca's terms:** the smallest gap from T2 that makes Orca feel like §3–4 (replacing the old "Working Context spike"). It must work with Orca's file explorer, source control, layout and keybindings. **Measure the upstream files touched and hook lines added.**
8. **W3 — Copilot CLI as an ACP native chat** (§6).
9. **Upstream sync** onto the newest stable Orca tag (after W-S1 and again after T3) to measure rebase cost.
10. **T4 — Decide:** continue eddy-omega or return to eddy. Pass if T3 needs only small hooks in upstream files, the chat is good enough, and the syncs go through without major conflicts.
11. If continuing: UI rebranding hook (W-B1, §8), exe/CLI names (Q-I1), signing, show `eddyVersion` in Settings/About, MCP/skills panels (Q-UI1).

### 11a. Verification status (CI/CD)
- 10-20: `eddy-checks` green (type-check of ~16.6k files, lint/format of changed files, 36 test files + eddy build-script tests). `eddy-build` green on Windows x64 and Linux x64; the build verifies the packaged app is `eddy-omega` with `eddyVersion` and Orca's internal version.
- **v0.1.0 published** (full release, built-in Actions token; no `EDDY_RELEASE_TOKEN` needed). The atom feed, `/releases/latest/download/latest.yml` and `latest-linux.yml` resolve with `version: 0.1.0`. **v0.1.1** (eddy branding, PR #1) published the same way.
- **Not yet verified by hand:** installing 0.1.0 (Windows, AppImage, .deb) and updating to 0.1.1. Do this first on the personal machine.

## 12. Open questions

- ~~**Q-N1**~~ Decided 10-19: "eddy omega" (§8).
- ~~**Q-U1**~~ Decided 10-19: compare by `eddyVersion` (§8).
- **Q-I1** Executable and CLI names (`Orca.exe`, `orca-ide`, `orca`): rename so eddy omega and Orca can coexist fully? (Home/repo folders decided: O15.)
- ~~**Q-S2**~~ Decided 10-20: §9 (O12–O14).
- **Q-L1** Can Orca's main area show panes from several workspaces at once, or does it switch between workspaces? (T2)
- **Q-UI1** MCP / skills panels and placement of explorer/git: decide later (O16).
- **Q8** MCP source of truth: eddy catalog vs. per-agent config.
- **Q-X1** Should contexts sync across machines? Not needed yet.
- **Q-Y1** `eddy.yaml`: fall back to `orca.yaml` when absent (proposed), or `eddy.yaml` only?

## 13. Decision log

Carried over from eddy, still valid:
| # | Decision |
|---|---|
| D1 | The unit is a **Working Context**, not a folder or branch. *(10-20: the behavior, not the name; see O11.)* |
| D2 | Switch **in place** in one window; everything stays loaded, only the UI swaps. |
| D3 | **Light fork** (small, marked upstream edits; new code in eddy-owned folders). |
| D15 | Rebase eddy's commits onto upstream **release tags**, not upstream `main`. |
| V2 | 1 thread = 1 conversation; eddy-managed context folder; worktree-vs-direct asked per thread. |
| V13 | Own versioning: `eddyVersion` 0.1.x alpha / 0.2.x beta / 1.x stable; tags `v<eddyVersion>`; the upstream version field is never changed. |

eddy-omega decisions:
| # | Date | Decision |
|---|---|---|
| O1 | 10-19 | Try a light fork of **Orca** as eddy-omega (time-boxed; §1, §11). The employer-internal build and agent-hub constraints no longer apply. |
| O2 | 10-19 | Remotes: `origin` = eddy-omega, `upstream` = stablyai/orca (push disabled, fetches `main` + `v*` tags only). Upstream tags live under `upstream/v*` (Orca already has a `v0.0.1` tag; avoids mixing with our `v0.x`). Never `git push --tags`. |
| O3 | 10-19 | `main` starts on **`upstream/v1.4.230`** (latest stable). Sync every week or two onto a stable tag, not every release. |
| O4 | 10-19 | `eddyVersion` + `quality` live in `eddy/product.json` (not `package.json`: upstream rewrites its `version` line every release, so an adjacent field would conflict). Starts at `0.1.0` alpha. |
| O5 | 10-19 | Design doc is committed (no internal details), unlike eddy's local-only doc. |
| O6 | 10-19 | All upstream workflows disabled on GitHub via `eddy/scripts/disable-upstream-workflows.ps1`; upstream Dependabot config removed. No per-file copyright headers (Orca convention). |
| O7 | 10-19 | Repo `Tom-from-6520/eddy-omega` (public) force-pushed over GitHub's initial LICENSE commit (Orca's MIT `LICENSE` kept). Actions stay disabled repo-wide until eddy has its own workflows. |
| O8 | 10-19 | CI/CD like eddy: `eddy-checks.yml` (type-check, lint/format changed files, eddy tests + tests next to hooked files + updater tests) and `eddy-build.yml` (tag `v<eddyVersion>` → Windows x64 NSIS + Linux x64 AppImage/.deb, GitHub release with `SHA256SUMS.txt`). Actions pinned by SHA; Actions enabled with all upstream workflows disabled. |
| O9 | 10-19 | Identity "eddy omega" (`dev.eddy.omega`, `eddy-omega` folders) and an updater on eddy-omega's releases compared by `eddyVersion`, all behind the compile-time `EDDY_VERSION` switch so dev/tests keep Orca's behavior (§8). `~/.orca`, exe and CLI names stay shared (Q-I1). |
| O10 | 10-19 | Releases are full GitHub releases (not pre-releases), published from a draft, because the updater's fallback reads `/releases/latest`. |
| O11 | 10-20 | "Working Context", "thread", etc. are brainstorm names. Use Orca's concepts and names where they can carry the behavior; study Orca first (§1.1, T2), then change it. Every feature must work with Orca's file explorer, source control, layout and keybindings (lesson from eddy). |
| O12 | 10-20 | Feedback and crash reports are never sent (we debug our own failures). Star prompt off. |
| O13 | 10-20 | Update nudges stay on, fed by an eddy-hosted `eddy/update-nudge.json` compared with `eddyVersion`. |
| O14 | 10-20 | Mobile companion, Orca account, share/publish and skill sharing: buttons disabled, with "(orca feat)" in their title, until replaced or removed. |
| O15 | 10-20 | Home folder `~/.orca` → `~/.eddy` (shared folder with the VS Code eddy; no name clashes). Per-repo `.orca/` → `.eddy/`, `orca.yaml` → `eddy.yaml` (proposed: fall back to `orca.yaml`). |
| O16 | 10-20 | MCP / skills panels: decide later (Q-UI1). |
