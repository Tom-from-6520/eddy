# eddy-omega — Design Doc (v1, living)

> **Committed and public.** Unlike eddy's design doc, this one contains no employer-internal details, so it lives in the repo. Keep it that way: no internal tool names, cluster URLs, tokens or machine paths.
> **How to use:** read §1–4 for what eddy-omega is and why it's built on Orca, §5 for how it maps onto Orca, §11 for what's next. When you decide something, add a row to §13 and update the affected section.
> **Lineage:** eddy-omega carries the design of [eddy](https://github.com/Tom-from-6520/eddy) (a VS Code fork). Decisions that still hold are copied into §13; eddy's own docs are history only.
> Last updated: 2026-10-23 (eddy omega 0.1.7 alpha; base `upstream/main` at `d667e54b02`, stamped Orca 1.4.237; see O24).

## 0. Public-repo hygiene and upstream noise

- Keep this repo focused on `eddy-omega` itself: product decisions, fork-local code, and the design work that matters to us.
- Do not cite unrelated upstream Orca PRs or issues in public docs, PR descriptions, commit messages, or session notes unless there is a direct and necessary engineering reason.
- In particular, do not mention the unmerged Orca PR `#30899` or its linked issue in this repo's public materials. It adds noise to the upstream PR and does not help this fork.
- If a reference to upstream work is needed, keep it generic (for example: "upstream sync" or "upstream fork note") and avoid issue numbers or original-thread references that create spam on the upstream PR.

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

### Design agreement from 2026-10-22: workspace layout stays stable, root is separate

The core agreement from the current session is that the **workspace should remain the stable layout container**: it owns tabs, chat sessions, editor state, terminal layout and the split panes. The part that must become more flexible is the **source root** or **active checkout** behind that layout.

We agree on the following model:
- **One workspace = one stable layout container.** The layout follows the workspace, not the branch or repo.
- **One canonical writable root per workspace.** This is the repo/worktree that the workspace treats as its default source-control owner.
- **Zero or more attached reference roots.** These may be read-only snapshots of `main`, other repos, or investigation branches. They are useful for cross-repo lookup and comparison, not for the default commit/diff flow.
- **Root switching must preserve the workspace layout.** Changing the active root should not destroy tabs, agent sessions, editor state, or the tab split layout.
- **Cross-repo investigation is not the same as multi-root writable commit ownership.** If a task needs production edits in another repo, the clean model is to switch the active root or open a different workspace rooted in that repo, not to let one workspace pretend it owns multiple Git write targets at once.
- **Reference roots must be visible in the file explorer and source-control UI when read-only.** They need to be navigable for understanding, diffing and reasoning, even when they are not the active writable root.

This keeps Orca's strengths (persisted layout, in-place switching, multiple chat sessions) while admitting the real requirement: a workspace must sometimes hold a read-only reference set that spans repos or branches.

### Investigation-first workspace creation

For the investigation-heavy case, the workspace creation form should not force a canonical writable root before the user knows where the bug is. We should split the form into two creation modes:

- **Work on code**: create a workspace with a canonical writable root and a branch/worktree. The current form is fine here.
- **Investigate first**: create a stable workspace layout with no commit owner yet, then attach read-only roots or snapshots from one or more repos and branches.

Recommended UX:
- **Workspace name** and **project / folder context** still come first.
- **Mode**: `Investigate first` or `Start coding`.
- In `Investigate first` mode, the form asks for:
  - one or more **reference roots** (repo + branch/ref + optional snapshot)
  - optional **preferred active root** (which one is visually primary, but not necessarily writable)
  - whether the investigation should be **single-repo** or **cross-repo**
  - an **agent preset** or quick-start prompt for the first 1–2 agents
- The created workspace is still fully usable as a layout container, with tabs, chats, file explorer and git history all available.
- The user can later press **Convert to coding workspace** to assign a canonical writable root and branch/worktree when the likely fix becomes clear.

This makes the form match the actual workflow: the user often wants a safe, fast read-only investigation shell before committing to editing anything.

## 5. Mapping onto Orca

### 5.1 Orca's model (as of v1.4.230)
- **Project → Repo → Workspace.** A workspace is a git worktree (main checkout, branch worktree, detached HEAD) or a **folder workspace** (non-git folder). Types: `src/shared/project-types.ts`, `src/shared/repo-types.ts`, `src/shared/worktree/types.ts`, kinds in `src/shared/worktree/workspace-kinds.ts`.
- **Project groups** group projects in the sidebar (`src/shared/project-group-types.ts`, `src/main/project-groups/`). They group repos, not workspaces.
- Each workspace has **tabs and split panes**: terminals, native chats, editor (Monaco), browser, diffs. Layout is kept **per workspace** (`src/renderer/src/store/workspace-layout-cache.ts`).
- **Native chat** (`src/main/native-chat/`, `src/renderer/src/components/native-chat/`): Claude, Codex, Pi, and ACP agents (`src/main/acp/acp-launch-specs.ts`: Grok, OpenCode, omp, Antigravity). Every other agent, **including GitHub Copilot CLI, runs as a terminal agent**.
- Execution hosts: local, WSL, SSH, and paired remote Orca runtimes. Mobile companion via Orca's relay service.
- State lives in the renderer store (`src/renderer/src/store/`, Zustand slices) and is persisted by main (`src/shared/persisted-state-types.ts`).

#### Study notes 10-23: folder workspaces as investigation workspaces (v0.1.7)
Folder workspaces are the closest Orca concept to an "Investigate first" workspace (§4): named, not tied to a branch, and they can be opened as several parallel workspaces on the same folder.
- **What one is:** `FolderWorkspace` (`src/shared/folder-workspace-types.ts`). It has an `id` (a fresh `randomUUID()` per create), a `name`, a `folderPath`, a `projectGroupId` and optional linked tasks. Its workspace key is `folder:<id>`, so tabs, chats and layout are kept per workspace, like worktrees.
- **Several per folder:** `createFolderWorkspace` (`src/main/persistence/restoring-sessions/folder-workspace-operations.ts`) never checks whether another folder workspace uses the same path. Two investigations over the same parent folder (for example, one on repos A + B and one on B + C) are two folder workspaces with their own names, tabs and chats.
- **How to create one (UI):**
  1. Use **Add project** on the *parent folder* and choose the "group them and work from the parent folder" import. This makes a project group with a `parentPath`.
  2. In **New Workspace**, pick the **group** (not one of its repos) as the project. Only groups with a `parentPath` are offered (`src/renderer/src/lib/new-workspace-project-options.ts`, `buildNewWorkspaceCreateTargetOptions`).
  3. Name the workspace and create. Repeat for each investigation.
- **What it already gives:** the full window with the file explorer and a saved layout. Chats find their folder again by workspace id. Worktrees can be attached under it via workspace lineage (`src/renderer/src/components/right-sidebar/FolderWorkspaceWorktreesPanel.tsx`).
- **Limits found:**
  - Source control: none in a folder workspace.
  - Focus: one `folderPath` per workspace. Every workspace on a parent folder shows *all* its repos; nothing records which repos an investigation is about.
  - Moving chats: a chat can't move to another workspace. `moveTabToWorkspace` (`src/shared/workspace-layout/workspace-layout-workspace-move.ts`) moves only editor tabs, and a chat's main-side record is filed under its workspace (`AgentSessionRecord.location.workspaceId`, `src/shared/agent-session-record.ts`).
  - Project groups: a repo belongs to at most one group (`Repo.projectGroupId`, `src/shared/repo-types.ts`). Adding a repo to a second group takes it out of the first.
- **Not the floating workspace:** the floating workspace is a single global workspace with the fixed id `FLOATING_TERMINAL_WORKTREE_ID` (`src/shared/constants.ts`). That id is special-cased across about 500 files. Its one directory comes from the `floatingTerminalCwd` setting (`src/main/ipc/floating-workspace-directory.ts`). It has no file explorer or source control, so it is a poor base for several named investigations.

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
- **Copilot CLI as a native chat (W3, backported 10-20, O18):** Copilot CLI serves ACP with `copilot --acp --stdio`. Upstream PR [stablyai/orca#30899](https://github.com/stablyai/orca/pull/30899) adds one `COPILOT_LAUNCH_SPEC` to `acp-launch-specs.ts` (plus sign-in, permission-mode and visuals rows), which gives Copilot an agent-session tab with the message rail, markdown and inline visuals, model/effort picker, permission cards, Stop, `/compact` and reattach. eddy-omega carries it as a verbatim backport until an Orca release ships it. Limits: needs Copilot CLI ≥ 1.0.98 (since 0.1.7, under upstream's minimum-version rule, a prerelease at or above it such as `1.0.101-0` also runs, and an older one keeps the terminal); no transcript import (terminal Copilot conversations can't be resumed in chat); models appear after the first session. **Ask is authoritative (O19):** an Ask chat withholds `/allow-all`, `/autopilot` and `/permissions` (arguments or not), starts only once Copilot confirms autopilot and `allow_all` are off, and turns either back off when Copilot reports it on (ending the chat if Copilot refuses); Copilot can still approve a request in the moment before that write lands. Code: `src/main/eddy/acp-ask-guard.ts`. Rebase notes: §7.1.
- The employer-internal agent hub and its internal MCP servers are **out of scope** for eddy-omega.
- **MCP:** each agent reads its own MCP config. Plan (from eddy): an eddy MCP catalog; each Working Context enables a subset; passed to each agent in its own format. Q8.

## 7. Fork & sync model

Details and commands: [`eddy/AGENTS.md`](./AGENTS.md).

- Light fork, **rebase model**: `main` = eddy-omega's commits on top of an upstream **stable release tag** (currently an exception: `upstream/main` at `d667e54b02`, see O24 and §7.1 "Base off a stable tag").
- `origin` = eddy-omega (personal GitHub account), `upstream` = stablyai/orca (push disabled). Upstream fetches only `main` and `v*` tags, stored as `upstream/v*`, so they never collide with eddy-omega's own `v0.x` release tags.
- Orca releases every 1–3 days (tags on short release branches). Sync every week or two onto the latest stable tag; never onto `-rc` tags.
- Upstream edits stay small and marked `// eddy:`; new code goes in `src/{main,renderer/src,shared}/eddy/`.
- All upstream GitHub workflows (~90) are disabled on eddy-omega; only `eddy-*.yml` run. Upstream's Dependabot config is removed (dependency updates come with upstream syncs).

### 7.1 Carried changes: rebase notes

Read this before every upstream sync. Each entry says what eddy-omega carries, how to tell whether upstream has caught up, and how to resolve the conflicts it causes.

#### Base off a stable tag (O24)

**What is carried** (since 0.1.7): `main` sits on `upstream/main` at `d667e54b02` (10-22), not on a tag, to ship upstream's fix `752f531b0a` (ACP and Pi chats refused a message sent after picking another model with no effort, shown as "The agent didn't accept this message."). No stable tag had it yet. One extra commit, "Stamp Orca version 1.4.237 on the upstream/main base", sets `package.json` `version` back to `1.4.237`, because `upstream/main` carries a stale `1.4.214` that only Orca's release-branch commit replaces.

**Next sync:** go back to a stable tag that contains `752f531b0a` (`git tag --contains 752f531b0a --list "upstream/v*"`). Rebase with `git rebase --onto upstream/<new-tag> d667e54b02 main`, drop the version-stamp commit (the tag stamps its own version), and remove this entry and the exception notes in §7 and `eddy/AGENTS.md`.

#### Copilot chat (W3: O18, O19)

**What is carried** (on `main` since 0.1.4/0.1.5):

| Commit | Kind | What it is |
|---|---|---|
| `6c73c44dfb` feat(chat): backport GitHub Copilot ACP chat | **Upstream, verbatim** | stablyai/orca#30899 by Morten Trydal (its commits `8841c3c434`, `7f576bc576`, `c5408b6e79`), cherry-picked onto `upstream/v1.4.230`. Production code is 6 files: `src/main/acp/acp-launch-specs.ts` (`COPILOT_LAUNCH_SPEC`, `COPILOT_SESSION_HISTORY`), `src/main/acp/acp-visuals-skill.ts` (`loadCopilotVisualsSkill`), `src/shared/agent-chat-permission-mode.ts`, `src/shared/agent-session-sign-in.ts`, `src/shared/app-version.ts` (accepts `1.0.98.`), `docs/site/content/docs/agents/native-chat.mdx`. The rest is tests and `src/main/acp/fixtures/copilot-v1-*.jsonl` recordings. |
| `6c73c44dfb` (same commit) | eddy adaptation of tests | Our base predates upstream's `opencode2` agent and OMP's catalog probe, so the agent lists in `acp-structured-compaction.test.ts`, `structured-agent-launch-parity.test.ts`, `structured-agent-model-catalog-discovery.test.ts` and `structured-agent-runtime-registrations-acp.test.ts` drop `opencode2` and keep OMP excluded. The launch-parity snapshot was rebuilt by hand (see "Snapshot" below). |
| `94335ec384` test(chat): adapt Copilot tests to v1.4.230 test helpers | eddy adaptation of tests | `acp-structured-copilot-recordings.test.ts` reads the start link from `acquire()` and the refusal from its rejection (our rig has no `rig.started()`/`rig.openFailure()`); `structured-agent-launch-support-probe-copilot.test.ts` passes the selector `'id:w'` (our `structuredAgentSupportsLaunch` takes a selector, not a function). |
| `dd715ba06b` Docs: W3 Copilot chat backported | eddy docs | §6, §11 W3, O18. |
| `0cc3c28005` feat(chat): keep Ask authoritative over Copilot's own approval switches | **eddy feature** | The Ask guard (O19): `src/main/eddy/acp-ask-guard.ts` and its test, plus the `eddy:` hooks listed below. Closes the PR's known limit ("Copilot's own `allow_all` / autopilot can approve while the chat says Ask"). |

**Ask guard hooks in upstream files** (`git grep -n "eddy:" -- src/main/acp`):

- `acp-structured-handshake.ts`: `await guardAcpAsk(child, acquire.permissionMode, deps.logger)` in `initializeAcpStructuredSession`, right after the new session's options (and permission-mode config) are adopted and before the handle link is built, plus its import. It must run here, not after `acquireAcpStructuredSession`: since v1.4.237 `session/new` happens in `child.open()`, so the options are empty until the handshake. `guardAcpAsk` accepts a child whose `lane` is still null.
- `acp-structured-options.ts`: `readConfigOptions()` accessor on `AcpStructuredOptions`.
- `acp-prompt-content.ts`: `isWithheldCommand` delegates to `sendsWithheldAcpCommand` (matches a command's name in any text block, arguments and case aside; this also tightens Antigravity's `/logout`), plus its import.
- `acp-launch-specs.ts`: Copilot's `dialect: COPILOT_ACP_DIALECT` (the generic dialect plus `withheldCommands: ['allow-all', 'autopilot', 'permissions']`), plus its import; the file imports only `type AcpDialect` from `acp-dialect` again.
- `acp-structured-copilot-recordings.test.ts`: the two command-list assertions expect 24 commands, not 27.

**Is it upstream yet?** Check the target tag before rebasing:

```powershell
gh pr view 30899 --repo stablyai/orca --json state,mergeCommit,headRefOid
git grep -n "COPILOT_LAUNCH_SPEC" upstream/<new-tag> -- src/main/acp/acp-launch-specs.ts
```

As of 10-23 the PR is still open at head `c5408b6e79`; neither a `upstream/v*` tag nor `upstream/main` at `d667e54b02` has it, so the 0.1.7 sync replayed the backport (case B).

**Case A: the new tag ships Copilot chat.**

1. Rebase interactively and **drop** `6c73c44dfb` and `94335ec384`; keep `dd715ba06b` and `0cc3c28005`. Don't resolve the backport's conflicts by hand: upstream's version wins.
2. Re-apply the Ask guard onto upstream's code:
   - If upstream gave Copilot its own dialect, make `COPILOT_ACP_DIALECT` spread that dialect instead of `GENERIC_ACP_DIALECT`, or move `withheldCommands` into a hook on upstream's dialect.
   - Re-apply the 24-command expectations in upstream's `acp-structured-copilot-recordings.test.ts`.
3. Check whether upstream fixed the known limit itself: search the lane for `allow_all`, `autopilot`, a multi-option `permissionModeConfig` or a Copilot `withheldCommands`. If it did, remove the eddy guard and its hooks, and mark O19 reversed in the decision log. If it fixed it only partly, keep the parts it lacks.
4. Update §6 and O18 to say which Orca release shipped it.

**Case B: the new tag doesn't ship it** (the backport is replayed):

- **Agent lists in tests:** upstream may have added agents. Keep upstream's list and append `copilot` last, as the PR did; drop entries for agents our new base doesn't have.
- **Launch-parity snapshot** (`src/main/runtime/__snapshots__/structured-agent-launch-parity.test.ts.snap`): regenerate it with `pnpm test src/main/runtime/structured-agent-launch-parity.test.ts -u` and check that the diff holds only Copilot rows plus the configured rows' id shifts. Without a working install, rebuild it by hand as `6c73c44dfb` did:
  - case *i* gets session id `00000000-0000-4000-8000-<i+1, 12 digits>`;
  - non-configured cases come first (5 per agent, in `AGENTS` order), then configured cases (2 per agent);
  - the chat scratch folder is the first 32 hex characters of `sha256(session id)`;
  - nothing else in a row depends on the index.
- **Test-helper drift:** the ported tests target upstream's newer helpers. Once the new base has `AcpAdapterRig.started()`/`openFailure()` and the function form of `structuredAgentSupportsLaunch`, drop `94335ec384`'s edits and take the PR's test versions. CI's type-check finds any other drift. (Done in the 0.1.7 sync: the base has both, so the recordings test is the PR's again.)
- **API drift met in the 0.1.7 sync** (commit "Port the carried Copilot chat to upstream's minimum-version check"): upstream replaced `supportsVersion` with `minimumVersions` (Copilot: `['1.0.98']`; its launch-resolution and version-probe tests follow OMP's port) and removed `imagePrompts` from `AcpLaunchSpec` (the agent's `initialize` answer decides; Copilot advertises images). OMP gained a catalog probe, so only Antigravity and Copilot stay out of the catalog-discovery list. The launch-parity snapshot only shifted ids, by 5 for upstream's `opencode2`.
- **Production files:** these applied cleanly to v1.4.230. If upstream amended the PR (its `headRefOid` is no longer `c5408b6e79`), re-cherry-pick the new commits instead of carrying the old ones.
- **Ask guard:** if upstream changed `acp-structured-handshake.ts`, `AcpStructuredOptions`, `withheldCommands`, the session-update types (`config_option_update`, `current_mode_update`) or `setConfigOption`, adjust the hooks.
  - The guard depends on Copilot's protocol facts: config ids `mode` and `allow_all`; values `on`/`off`; mode ids `…/session-modes#agent` and `…#autopilot`.
  - If Copilot renames them, the guard silently does nothing. Its test reads `copilot-v1-handshake.jsonl`, so check new recordings when upstream re-records them.

**Verify after the sync:**

- `git grep -n "eddy:" -- src/main/acp` shows the hooks above (none, in case A step 3, if the guard was removed).
- `eddy-checks` runs `src/main/eddy/acp-ask-guard.test.ts` and the tests next to hooked files (adapter, options, prompt content). It does **not** run the ported Copilot tests; run them locally:

  ```powershell
  pnpm test src/main/acp/acp-structured-copilot-recordings.test.ts src/main/acp/acp-structured-launch-resolution-copilot.test.ts src/main/runtime/structured-agent-launch-parity.test.ts src/main/runtime/structured-agent-launch-support-probe-copilot.test.ts src/main/runtime/structured-agent-runtime-registrations-acp.test.ts src/main/runtime/structured-agent-model-catalog-discovery.test.ts src/main/acp/acp-structured-compaction.test.ts
  ```

  On the work machine `pnpm install` fails, because the Microsoft npm feed proxy lacks a locked package, so run them where public npm is reachable.
- By hand, with a **stable** Copilot CLI ≥ 1.0.98 and Chat UI on:
  - a new Copilot agent opens as a chat tab;
  - `/allow-all on` is refused in Ask;
  - Full access still works.

#### Per-group workspace kind filter (O25)

**What is carried:** a folder-backed project group's "…" menu has **Show → Worktrees and folders / Worktrees only / Folders only**. The choice is stored on the group as `workspaceKindFilter` (`'worktrees' | 'folders'`; absent = both), so it persists and syncs through the group's owning host like `color` and `isCollapsed`, and is deleted with the group. It applies in **Group by: Project** only.

- eddy code: `src/shared/eddy/project-group-workspace-filter.ts` (type, schema, normalize/update/show helpers) with its tests, and `src/renderer/src/eddy/project-group-workspace-filter-menu.tsx` (the submenu).
- `eddy:` hooks (`git grep -n "eddy:" -- src/shared src/main src/preload src/renderer`): the field on `ProjectGroup` (`project-group-types.ts`); `normalizeProjectGroups` (`project-groups.ts`); the catalog schema (`project-section-catalog-schema.ts`); the update schemas `ProjectGroupUpdateArgs` (`repo-ipc-arg-schemas.ts`) and `ProjectGroupUpdate` (`rpc-contract/repo-params.ts`); `updates: ProjectGroupUpdates` in `project-group-operations.ts` (which also applies the field), `repository-api.ts`, `repo-state.ts` and `runtime-project-group-controller.ts`; the row planner (`sidebar-list/project-group-sections.ts`: subtree count, folder rows, project rows); the menu item in `project-group-header-actions.tsx`.

**Limits:** "Folders only" also hides non-git folder repos (they are project sections; unconfirmed whether that's wanted, Q-G1). Revealing a hidden workspace won't find its sidebar row. Hosts running an older build drop the field, so their groups show both.

**On sync:** if upstream adds fields to the group update type or reworks `appendProjectGroup`, re-apply the hooks; the row tests in `project-group-workspace-filter-rows.test.ts` catch planner drift.

#### Kept closed chats (O26)

**What is carried:** closing a native chat's tab no longer drops it from its workspace card. Below the live agent rows the sidebar lists the closed chats: a hollow dot, the agent icon, the title and "closed X ago". Clicking a row reopens the chat through `activateAiVaultStructuredSession`, the same path Agent Session History uses. The trash button on hover only removes the row from this list; the chat stays in Agent Session History. Closing a chat in upstream only hides its tab, while the host keeps the record and journal, so a kept entry is just a pointer: `sessionId` plus `worktreeId`.

- eddy code: `src/renderer/src/eddy/kept-chat-sessions.ts` (a localStorage store `eddy:keptChatSessions:v1`, capped at 50 per workspace, newest first, plus the close hook `keepClosedChatTab`) and `src/renderer/src/eddy/KeptChatSessionRows.tsx` (the rows), with tests `kept-chat-sessions.test.ts` and `kept-chat-sessions-close-hook.test.ts`.
- `eddy:` hooks: `closeUnifiedTab` in `store/slices/tabs/tabs-close-actions.ts` calls `keepClosedChatTab` for a user close. A close counts as a user close when it has an owning host, the chat isn't provisional, and `recordInteraction` isn't `false`, which excludes teardown and launch replacement. `worktree-card-secondary-rows.tsx` renders `<KeptChatSessionRows>` after `WorktreeCardAgents`.

**Limits:**
- Only native (structured) chats are kept; terminal agents such as the Copilot CLI are not.
- The list lives per device in localStorage. It doesn't sync, and paired or mobile clients don't see it.
- Rows show only when the card's inline-agents property is on.
- Removing a workspace or repo doesn't clear its entries yet (they are orphaned and hidden).
- Close paths that don't pass `recordInteraction: false` also keep the chat: resume-here replacement and host-twin teardown.

**On sync:** if upstream reworks `closeUnifiedTab`'s agent-session branch or the card's secondary rows, re-apply the two hooks; `kept-chat-sessions-close-hook.test.ts` catches a lost close hook.

#### ACP effort menus for models a session doesn't run (O27)

**What is carried:** an ACP session reports a thought-level menu only for the model it runs (Copilot does), but upstream records every other model's menu as empty, an explicit "no efforts". The saved catalog then refused a new chat whose saved effort belongs to such a model ("copilot model … does not offer effort high", shown as "Chat connection could not be confirmed."), and the catalog never refreshed because no chat could start. Two `eddy:` hooks:

- `acp-structured-options.ts` `read()`: a model other than the running one gets `effortsKnown: false` when the session has an effort option, so admission admits its saved effort.
- `acp-message-execution-options.ts` `applyAcpMessageOptions`: an effort is skipped when, after the model write, the agent offers no effort option, so an effort kept from another model doesn't refuse the message.

**On sync:** drop the hooks if upstream marks these menus unknown itself (look for `effortsKnown` in `acp-structured-options.ts`). Tests: the `eddy:` cases in `acp-structured-options.test.ts` and `acp-message-execution-options.test.ts`.

**Saved lists (O28):** the two hooks only change lists saved from then on. A list saved earlier still refuses the chat, and for Copilot and Antigravity only a chat replaces it, so 0.1.10 still failed. `src/main/eddy/acp-saved-effort-repair.ts` repairs such a list as it loads: in a session-listed Copilot or Antigravity list where some models have efforts, a model with none gets `effortsKnown: false`. Hook: `parseEntry` in `agent-model-catalog-persistence.ts`. Test: `acp-saved-effort-repair.test.ts`. Drop it along with the two hooks above.

## 8. Versions, releases, updates

- **Version:** `eddyVersion` in `eddy/product.json` — **0.1.x = alpha, 0.2.x = beta, 1.x = stable**; bump the patch for each release; tags `v<eddyVersion>`. `quality` names the stage.
- **`package.json` `version` stays Orca's.** Orca uses it for compatibility with remote/mobile peers (`minCompatibleDesktopVersion`), CLI stamping and crash reports. eddyVersion is kept in its own file because upstream's release commit rewrites the `version` line every release.
- **eddy release builds.** Everything eddy-specific at runtime switches on a compile-time constant: `EDDY_RELEASE_BUILD=1` → electron-vite defines `EDDY_VERSION` (`eddy/build/eddy-vite-defines.mjs`) → `src/shared/eddy/eddy-build.ts`. Dev runs, tests and plain Orca builds keep Orca's behavior, so upstream's own tests keep passing. The eddy packaging config refuses to run without the flag, so an eddy-named installer can't ship with Orca's updater.
- **Updater (Spike U1 → option (a), built 10-19).** Orca's updater (`src/main/updater/`) lists newer release tags from the GitHub atom feed (`updater-prerelease-feed.ts`), pins electron-updater's generic feed to that tag, and electron-updater installs only a `latest*.yml` whose version is greater than its current version. In eddy release builds:
  - every channel's repo, the atom feed and the fallback feed are `Tom-from-6520/eddy-omega` (`release-channel.ts`, `updater-prerelease-feed.ts`, `updater-setup.ts`, `updater-release-feed.ts`);
  - version comparisons use `eddyVersion` (`getUpdaterAppVersion()` in `updater-release-feed.ts`, `updater-events.ts`, `updater-install-support.ts`), and electron-updater's own current version is replaced with `eddyVersion` when it loads (`electron-updater-loader.ts` → `src/main/eddy/eddy-updater-version.ts`);
  - the release workflow writes `eddyVersion` into `latest.yml` / `latest-linux.yml` (`eddy/build/eddy-update-manifest.cjs`);
  - Orca's changelog (keyed to Orca versions) is off. Update nudges come from eddy's own `eddy/update-nudge.json` (§9).
  - Releases are full GitHub releases, not pre-releases: the updater's fallback reads `/releases/latest`, which skips pre-releases.
  - Not adapted: the hidden build picker (Alt-click on the release channel) still checks profile compatibility against Orca's version.
- **Platforms:** Windows x64 (NSIS installer, self-updating) and Linux x64 (AppImage, self-updating; `.deb`). macOS needs an Apple Developer account and notarization; later, if ever.
- **Signing:** Orca signs Windows builds via SignPath Foundation. eddy builds are unsigned (SmartScreen warns); the packaging drops Orca's `publisherName` so electron-updater doesn't reject unsigned eddy installers. Later: eddy's own SignPath (OSS) project or certificate, then restore a `publisherName`.
- **Identity (Q-N1 decided 10-19: "eddy omega").** App id `dev.eddy.omega`; name `eddy-omega` (install folder, Electron data folder `%APPDATA%\eddy-omega`, `/opt/eddy-omega`, Linux WM class); display name "eddy" (shortcuts, Start menu, desktop entry, window/app name; app icon is eddy's pinwheel, `resources/build/icon.*`); `%LOCALAPPDATA%\eddy-omega` for the relocated terminal daemon; `/usr/bin/eddy-omega`; own document ProgIDs; protocol `eddy-omega://`. Implemented in `eddy/build/eddy-electron-builder.cjs` (wraps Orca's electron-builder config), `eddy/nsis/eddy-installer-hooks.nsh`, `eddy/linux/after-*.sh`, and hooks in `dev-instance-identity.ts` and `daemon-host-relocation.ts`.
- **Still shared with Orca** (fine unless both are installed and used on one machine):
  - `~/.orca` and the per-repo `.orca/`: **moved to `~/.eddy` and `.eddy/` (10-20, §9.1)**; `orca.yaml` → `eddy.yaml` pending (W-S2c).
  - Executable names: `Orca.exe` on Windows (Orca's Rust CLI launcher looks for it), `orca-ide` on Linux, the `orca` / `orca-ide` CLI commands (Q-I1).
  - The eddy uninstaller doesn't kill a running eddy terminal daemon (Orca's kills by image name, which would also hit Orca's); a leftover `%LOCALAPPDATA%\eddy-omega` may remain.
  - `orca://` deep links in app code; Orca's `agent-state-rules` live update still reads Orca's releases (data, harmless).
  - UI text still says "Orca" (and "orca.yaml"). Proposal: one rebranding hook in Orca's i18n `translate()`, like eddy's `brandMessage`, instead of editing strings (W-B1).

## 9. Orca services (decided 10-20, built 10-20 as W-S1)

Orca talks to Stably/Orca services. Decisions for eddy release builds (UI entry points use `src/renderer/src/eddy/orca-feature.tsx`):

| Service | Where | Decision |
|---|---|---|
| Telemetry (PostHog) | `src/main/telemetry/` | **Off** (already): only sends when CI injects `ORCA_POSTHOG_WRITE_KEY` + build identity. Never inject it. |
| Feedback, crash reports | `FEEDBACK_API_URL` (`www.onorca.dev/v1/feedback`) in `src/main/ipc/feedback-request.ts`; crash reports go through it (`crash-reporting-submission.ts`) | **Never sent.** Block the request in main; disable the submit buttons with "(orca feat)" in their tooltip. Crash data stays local. |
| Update nudges | `src/main/updater-nudge.ts` (fetch), `src/main/updater/updater-nudge.ts` (apply) | **On, from eddy.** A nudge is `{ id, minVersion?, maxVersion? }`; when the installed version is in range, the app re-checks for updates at once and re-shows the update card even if dismissed. Host `eddy/update-nudge.json` on `main` (raw GitHub URL), compare with `eddyVersion`; no file = no nudge. Two hooks. Use it to push users off a broken release. |
| "Star the repo" prompt | `src/main/star-nag/`, `StarNagCard`, `StarNagToastHost` | **Off.** |
| Mobile companion (relay, push), Orca account (login), share/publish links, skill sharing | `relay*/push/login/share.onorca.dev`; UI: sidebar Mobile button (`SidebarNav.tsx`), `MobilePage`, `OrcaAccountSettingsPane`, `ShareSkillsSettingsPane`, `ArtifactPublishButton`, `doc-preview-artifact-share`, `EditorPanelHeader`, browser toolbars, `NativeChatInlineVisual`, skill install dialogs | **Disabled for now.** Buttons stay visible but disabled, with **"(orca feat)"** appended to their title/tooltip, so we remember to replace or remove them later. ~8–10 small UI hooks. |
| Update feed, changelog | `github.com/stablyai/orca/releases`, `onorca.dev/whats-new/changelog.json` | **eddy-omega's releases** (done, §8); Orca's changelog off. |

### 9.1 Home and repo folders (decided 10-20; `~/.eddy` and `.eddy/` built 10-20 as W-S2a/b, `eddy.yaml` pending as W-S2c)

**`~/.orca` → `~/.eddy`.** `~/.eddy` is also the VS Code-based eddy's data folder (`extensions/`, `argv.json`); no file names clash. What eddy omega keeps there:

| What | Files | Notes |
|---|---|---|
| Agent-hook scripts | `agent-hooks/` (Claude, Codex, Gemini, Cursor, Copilot, Grok, …), install lock, `grok-owners`, `claude-agent-teams-bin/` | Each agent CLI's **global** config (e.g. `~/.claude/settings.json`) gets a hook entry pointing at these scripts; that is how Orca knows an agent is working/idle/waiting. Events go to whichever app launched the agent (`ORCA_AGENT_HOOK_PORT/TOKEN/ENDPOINT` in that terminal), not to the script's owner. Orca recognises its entries by `agent-hooks/<script>` whatever the folder, so eddy replaces the old `~/.orca` entries (from eddy 0.1.x or Orca) instead of adding duplicates; if Orca also runs, it takes them back. Either script works for either app. |
| Credentials and API keys | Bitbucket, Jira, Linear, MiniMax cookies, OpenAI (speech) key, ZCode key, the encrypted API-key store, `orcad` secret key | Encrypted with the OS secret store. After the move you sign in again once in eddy omega; old copies stay in `~/.orca`. |
| Keybindings | `keybindings.json` | Orca's format. Not shared with the VS Code eddy in practice: VS Code keeps its keybindings in `%APPDATA%\eddy\User\` in another format. Not migrated: copy `~/.orca/keybindings.json` by hand if you customised it. |
| Headless server (`orcad`) data | user data (`$XDG_DATA_HOME/eddy` or `~/.eddy`), e2ee keypair, profile-state access | Only when running `orca serve` / remote runtimes. The `orcad` esbuild bundle gets the eddy constants too (`config/scripts/orcad-entry-build.mjs`). |
| Remote hosts (SSH, WSL) | `~/.orca` on the remote: deployed runtime, hook scripts | `~/.eddy` on the remote too. |

Built as `APP_HOME_DIR_NAME` / `REPO_DATA_DIR_NAME` in `src/shared/eddy/eddy-build.ts` (`.orca` outside eddy builds), used in ~50 files; each has an import marked `// eddy:`. **Test by hand:** agent hooks on Windows, WSL and one SSH host (the shell/PowerShell hook commands embed the path).

**Per-repo `.orca/` → `.eddy/` (built).** Dropped files, markdown templates, issue commands and browser downloads; `.eddy` is added to the repo's `.gitignore`.

**`orca.yaml` → `eddy.yaml` (W-S2c, pending).** The committable project config (setup scripts, hooks). It is read in `src/main/hooks.ts`, over SSH, by worktree setup and the trust dialog, and by the CLI (compiled without the eddy switch); its name also appears in many UI strings. Plan: read `eddy.yaml` if present, else `orca.yaml`, in every build (Orca never writes `eddy.yaml`, so no switch is needed), together with the UI rebranding hook W-B1.

## 10. Security and supply chain

- **Dependencies:** frozen installs only; review `pnpm-lock.yaml` diffs on every sync. Orca already enforces a 3-day `minimumReleaseAge`, an `allowBuilds` allow-list for install scripts, a hash-pinned pnpm and patched dependencies; keep them. Optional: OSV-Scanner / Socket in eddy CI.
- **Isolation:** build and run agents in a dev container, WSL or VM without personal tokens/SSH keys where practical.
- **CI/release:** eddy workflows pin actions by SHA, minimal permissions, a protected environment for the release token, tag protection rules, build provenance attestations. The update feed is the highest-value target: whoever can publish to it ships code to every install.
- **Agents:** pin MCP server versions; be careful with auto-approve; treat untrusted repos as prompt-injection sources.
- **Accounts:** personal GitHub account (with a hardware security key), personal model subscriptions; nothing from an employer.

## 11. What's next (trial plan)

Priority order, agreed 2026-10-22:
1. **Root-switching without layout loss** — preserving the workspace layout and chat/agent state while switching the active repo/worktree or branch.
2. **Attached read-only roots / snapshots** — read-only reference branches from the same or other repos, including branch- or snapshot-backed investigation views.
3. **Right-panel reading flow** — make the file explorer, git history, diff and blame views usable on attached reference roots so investigation is a real part of the workspace, not a second-class mode.

1. ~~**T0 — Fork setup**~~ — done 10-19: clone, `upstream` remote, `main` on `upstream/v1.4.230`, docs, version file, workflow-disable script; pushed to `Tom-from-6520/eddy-omega` (public).
2. ~~**CI/CD**~~ — 10-19: `eddy-checks.yml`, `eddy-build.yml`, eddy omega identity and updater (§8). Actions enabled with every upstream workflow disabled. See §11a for verification status.
3. ~~**T1 — Updater by hand**~~ — 10-20: installed 0.1.0 (Windows user setup), it updated itself to 0.1.1 (installed `eddyVersion` 0.1.1, installer fetched from eddy-omega's release). Building from source on the personal machine is still to do.
4. ~~**W-S1 — Orca services**~~ (§9) — 10-20: feedback/crash blocked, star prompt off, eddy-hosted update nudges, "(orca feat)" disabled buttons; About/Settings show `eddyVersion`.
5. **T2 — Orca study** (§1.1): use eddy omega for real work for a few days and read the code behind what you use, then write **§5.1 "Orca's model"** in Orca's own terms: projects/repos/workspaces, the sidebar, tabs/splits and layout (answers Q-L1), native chat sessions (how many per workspace, history), file explorer and source control (what drives them), keybindings and the command palette, settings/profiles. End with a gap list: each need in §3–4 → "Orca already does it", "small change to an Orca concept", or "new concept". 10-23: folder workspaces studied (§5.1 study notes).
6. **W-S2 — folders** (§9.1): ~~`~/.eddy` (W-S2a)~~ and ~~`.eddy/` (W-S2b)~~ built 10-20; test agent hooks by hand (Windows, WSL, SSH). `eddy.yaml` (W-S2c) together with W-B1.
7. **T3 — Root model change, preserving workspace layout:** build the minimal model that keeps a workspace's layout and chat sessions stable while introducing one canonical writable root plus attached read-only reference roots. This is the first concrete product behavior from the 2026-10-22 session. It should support: switching the active root; preserving tabs and agent sessions; read-only branches/snapshots from same or other repos; and explicit cross-repo investigation flows without breaking the current workspace layout model.
8. **T3b — Right-panel reference browsing:** make the file explorer and git history panels read a selected attached root or branch snapshot, including the same-repo and cross-repo investigation cases. The goal is that an investigation branch or reference snapshot can be read and understood without being the workspace's write target.
9. **T4 — First change in Orca's terms:** the smallest gap from T2 that makes Orca feel like §3–4 (replacing the old "Working Context spike"). It must work with Orca's file explorer, source control, layout and keybindings. **Measure the upstream files touched and hook lines added.**
10. **W3 — Copilot CLI as an ACP native chat** (§6) — 10-20: backported stablyai/orca#30899 (O18); try it by hand on Windows from the next alpha. Not run locally: the Microsoft npm feed proxy lacks a locked package (`@vitest/mocker@5.0.5`), so `pnpm install --frozen-lockfile` fails on the work machine.
11. **Upstream sync** onto the newest stable Orca tag (after W-S1 and again after T3/T3b) to measure rebase cost.
12. **T5 — Decide:** continue eddy-omega or return to eddy. Pass if the root model needs only small hooks in upstream files, the chat is good enough, and the syncs go through without major conflicts.
13. If continuing: UI rebranding hook (W-B1, §8), exe/CLI names (Q-I1), signing, show `eddyVersion` in Settings/About, MCP/skills panels (Q-UI1).

### 11a. Verification status (CI/CD)
- 10-20: `eddy-checks` green (type-check of ~16.6k files, lint/format of changed files, 36 test files + eddy build-script tests). `eddy-build` green on Windows x64 and Linux x64; the build verifies the packaged app is `eddy-omega` with `eddyVersion` and Orca's internal version.
- **v0.1.0 published** (full release, built-in Actions token; no `EDDY_RELEASE_TOKEN` needed). The atom feed, `/releases/latest/download/latest.yml` and `latest-linux.yml` resolve with `version: 0.1.0`. **v0.1.1** (eddy branding, PR #1) published the same way.
- **Verified by hand 10-20 (Windows, user setup):** 0.1.0 updated itself to 0.1.1. Not yet tried: AppImage and `.deb` installs/updates.
- Cosmetic: the install folder's uninstaller is named `Uninstall Orca.exe` (electron-builder names it after the executable, `Orca.exe`); Apps & features shows "eddy".

## 12. Open questions

- ~~**Q-N1**~~ Decided 10-19: "eddy omega" (§8).
- ~~**Q-U1**~~ Decided 10-19: compare by `eddyVersion` (§8).
- **Q-I1** Executable and CLI names (`Orca.exe`, `orca-ide`, `orca`): rename so eddy omega and Orca can coexist fully? (Home/repo folders decided: O15.)
- ~~**Q-S2**~~ Decided 10-20: §9 (O12–O14).
- **Q-L1** Can Orca's main area show panes from several workspaces at once, or does it switch between workspaces? (T2)
- **Q-UI1** MCP / skills panels and placement of explorer/git: decide later (O16).
- **Q8** MCP source of truth: eddy catalog vs. per-agent config.
- **Q-X1** Should contexts sync across machines? Not needed yet.
- **Q-Y1** `eddy.yaml`: read `eddy.yaml`, else `orca.yaml`, in every build (proposed, §9.1), or `eddy.yaml` only?
- **Q-G1** Group filter "Folders only" (O25) also hides non-git folder repos in the group, because the sidebar treats them as projects, not folder workspaces. Keep that, or show them under "Folders only" too? Check while testing 0.1.8.

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
| O17 | 10-20 | Help → About and Settings show eddy's version: `0.1.x alpha (Orca 1.4.230)`, like eddy's `0.1.5 alpha (Code - OSS 1.141.0)`. |
| O18 | 10-20 | Copilot chat (W3) = backport of upstream PR stablyai/orca#30899, kept verbatim (no `eddy:` markers) so it drops out at the rebase onto an Orca release that ships it, instead of a parallel eddy implementation. |
| O19 | 10-22 | Ask is authoritative for Copilot chats, closing upstream's known limit: withhold the access-raising commands, confirm autopilot and `allow_all` off at start, revert them when Copilot reports one on (end the chat if it refuses). eddy code (`src/main/eddy/acp-ask-guard.ts`) with `eddy:` hooks in the ACP adapter, options, prompt check and Copilot's launch row. The shared withheld-command check now matches the command's name in any text block, which also tightens Antigravity's `/logout`. |
| O20 | 10-22 | Keep the **workspace** as the stable layout/session container, but separate it from the **active source root**. One workspace may have one canonical writable root, plus attached read-only reference roots from the same repo or other repos. |
| O21 | 10-22 | Root switching must preserve the workspace layout and agent/chat state. Cross-repo investigation should be modeled as a reference root or an active-root switch, not as a workspace that tries to own multiple writable Git roots at once. |
| O22 | 10-22 | Right-panel browsing must work on attached reference roots: file explorer, git history, blame and diff views are read operations for investigation work and should not require the reference root to become the workspace's primary writable target. |
| O23 | 10-22 | Public repo docs and PRs must not mention unrelated upstream Orca issue/PR references, including the unmerged PR `#30899` and its linked issue, because they create spam on the original upstream thread without value to this fork. |
| O24 | 10-23 | One-off exception to O3: 0.1.7 rebases onto `upstream/main` (`d667e54b02`) instead of a stable tag, to ship upstream fix `752f531b0a` (Copilot and other ACP chats refused messages after a model change with "The agent didn't accept this message."). `package.json` keeps Orca `1.4.237` through a stamp commit. The next sync returns to a stable tag (§7.1 "Base off a stable tag"). |
| O25 | 10-24 | Project groups get a workspace kind filter (both / worktrees only / folders only) in their "…" menu, stored on the group record (synced, deleted with the group) rather than as a per-device UI setting (§7.1 "Per-group workspace kind filter"). |
| O26 | 10-25 | Closing a native chat keeps it listed under its workspace card until the user removes it with the row's trash button. Removing only drops the list entry; the chat stays in Agent Session History. The list is kept per device in localStorage, and terminal agents are not included (§7.1 "Kept closed chats"). |
| O27 | 10-25 | An ACP model's effort menu is unknown, not empty, unless the session runs that model: a saved effort for another model is admitted, and dropped at send if that model has no effort option (§7.1 "ACP effort menus"). Fixes Copilot chats that never start with "Chat connection could not be confirmed." |
| O28 | 10-25 | Model lists saved before O27 are repaired when loaded, not left to a refresh: for Copilot and Antigravity only a chat refreshes the list, and the stale list stops every chat from starting (§7.1 "ACP effort menus", "Saved lists"). |
