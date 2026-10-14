# Contributing to eddy

Thanks for your interest in eddy!

- **Questions, bugs and ideas:** open an [issue](https://github.com/Tom-from-6520/eddy/issues). For bugs, include the eddy version (Help → About) and steps to reproduce.
- **Code changes:** open a pull request against `main`. eddy is a light fork that is rebased onto new VS Code releases, so:
  - put new code in eddy-owned folders (for example `src/vs/sessions/contrib/workingContexts/`), and keep edits to upstream files small;
  - new eddy files use the header `Copyright (c) eddy contributors. All rights reserved.`; keep Microsoft's header on upstream files;
  - add or update unit tests for behavior changes.
- **Building:** see [`eddy/AGENTS.md`](eddy/AGENTS.md).

Issues that also affect Visual Studio Code belong in the [VS Code repository](https://github.com/microsoft/vscode/issues).
