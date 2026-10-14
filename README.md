# eddy

**eddy** is an editor for people who switch between pieces of work all day: a feature, a bug, an incident, an investigation. Each piece of work is a **Working Context** that holds its agent threads (chat sessions), its own files, and read-only background material. Switching contexts brings back the threads you had open side by side.

eddy is a fork of [Code - OSS](https://github.com/microsoft/vscode), the open-source core of Visual Studio Code, and opens VS Code's Agents window as its main window.

> **Status: alpha.** eddy is a personal project under active development. Expect rough edges and breaking changes between releases.

## Features

- **Working Contexts** in the left list, each with its threads. Create one with **New Working Context…** in the Sessions header.
- **New threads join the context you're working in.** A context's **+** starts a thread in that context.
- **Per-context layout:** opening a thread of another context shows that context's threads, arranged the way you left them.
- **A folder per context** (`~/eddy/contexts/<name>-<id>`) for notes and files. Open it with the folder button on the context.
- Everything from the Agents window: chat history, several chats side by side, Files and Changes, MCP servers and skills under Customizations.

## Install

Download the latest build from [Releases](https://github.com/Tom-from-6520/eddy/releases):

- **Windows:** `…-win32-x64-user-setup.exe` (installer, no admin rights needed) or `…-win32-x64.zip` (portable).
- **Linux:** `…-linux-amd64.deb` for Ubuntu/Debian (`sudo apt install ./eddy-….deb`) or `…-linux-x64.tar.gz`.

Builds are not code-signed yet, so Windows SmartScreen may warn about an unknown publisher.

## Build from source

See [`eddy/AGENTS.md`](eddy/AGENTS.md) for the build, release and upstream-sync workflow.

## Relationship to Visual Studio Code

eddy is not affiliated with or endorsed by Microsoft. "Visual Studio Code" and "VS Code" are trademarks of Microsoft Corporation. eddy follows upstream Code - OSS releases and keeps its own changes small; see `eddy/AGENTS.md` for how it stays in sync.

Microsoft-only extensions and the Visual Studio Marketplace are not available in eddy; extensions can be installed from `.vsix` files whose licenses allow it.

## License

[MIT](LICENSE.txt). eddy contains code from Code - OSS, copyright Microsoft Corporation, also under the MIT license. Third-party notices are in [ThirdPartyNotices.txt](ThirdPartyNotices.txt).
