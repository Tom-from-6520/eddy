# eddy

eddy is our fork for the working-context workflow we want to build. It is intentionally small, opinionated, and focused on the product decisions in `eddy/DESIGN.md` instead of the upstream Orca product messaging.

## What this repo is for

- keep the fork's own product logic in `eddy/` and `src/{main,renderer/src,shared}/eddy/`
- build around Working Contexts, session state, and work-in-progress organization
- keep upstream changes minimal and rebased cleanly
- avoid carrying stale upstream docs and product messaging into this repo

## Current repo shape

- `eddy/AGENTS.md` — fork workflow and sync rules
- `eddy/DESIGN.md` — architecture decisions and product constraints
- `src/main/eddy/`, `src/renderer/src/eddy/`, `src/shared/eddy/` — product-specific code and hooks
- the rest of the tree — mostly upstream Orca, kept as the base we build on

## Local development

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Common validation commands:

```bash
pnpm tc
pnpm test <path/to/test>
pnpm run check:code-quality:changed
```

## Repo hygiene

This repo should stay about eddy: our decisions, our code, and our design notes. Public docs and PRs should not mention unrelated upstream Orca PRs or issues just to explain the fork; that creates noise on the original upstream thread without helping this project.
