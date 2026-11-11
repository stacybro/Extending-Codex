# TaskHub

TaskHub is a task-management system intended to work with Codex. It supports local JSON storage and optional Google Drive storage without a hosted database. Future goals include Google Calendar scheduling, access across devices, and a visual interface.

**Current status:** The version 2 task core, local JSON adapter, optional Google Drive adapter, and stdio MCP server are implemented. Local natural-language checks passed previously. Drive mode passed mocked tests and disposable MCP checks with two authorized accounts on one computer; real task migration and separate-device behavior remain unverified.

## Product rule

Only create tasks when a user explicitly asks to create them. Scheduling and notifications also require explicit requests.

## Repository guide

- [`AGENTS.md`](AGENTS.md): project-wide instructions.
- [`docs/development-journal.md`](docs/development-journal.md): factual implementation log.
- [`docs/architecture/overview.md`](docs/architecture/overview.md): proposed system architecture.
- [`docs/decisions/`](docs/decisions/): architecture decision records.
- [`docs/roadmap.md`](docs/roadmap.md): implementation milestones.
- [`docs/tutorials/README.md`](docs/tutorials/README.md): public tutorial series outline.

`packages/core/` holds task operations and storage adapters. `integrations/codex/` exposes MCP tools. `integrations/drive/` holds OAuth support. `tests/` covers the core, adapters, and MCP protocol. A web app is future work.

## Next milestone

Google Drive mode is available for a single shared JSON file. It uses best-effort version checks and local backups; simultaneous writes can still lose an update. See [Drive setup and recovery](docs/architecture/google-drive-storage.md) before enabling it. The default local mode remains available.

## Local setup

Run `npm ci`, then `npm test` from the repository root. `npm run start:mcp` starts the stdio server; an MCP host should launch it, rather than a person typing into its terminal. Data defaults to `.taskhub/tasks.json` in the server working directory. Set `TASKHUB_DATA_FILE` to an absolute path to choose another local file. The data directory is ignored by Git. The server reads valid version 1 files and saves version 2 on the first successful write. It keeps the previous valid file at `.bak`. If the primary is corrupt or missing while a backup exists, inspect both files before manually restoring; the server will not start an empty replacement. A stale `.lock` file after a crash also requires inspection before removal.

For Codex CLI, register the server with `codex mcp add taskhub -- node C:\Users\stacy\OneDrive\Documents\ChatGPT\TaskHub\integrations\codex\server.js`, then check `codex mcp list`. Set `TASKHUB_DATA_FILE` to an absolute path when registering the server so data does not depend on the Codex working directory. This local installation used `C:\Users\stacy\OneDrive\Documents\ChatGPT\TaskHub\.taskhub\tasks.json`. See [official OpenAI MCP documentation](https://developers.openai.com/learn/docs-mcp) for the current registration workflow.
