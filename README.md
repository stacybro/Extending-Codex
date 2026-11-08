# TaskHub

TaskHub is a local task-management system intended to work with Codex. Future goals include Google Drive storage without a hosted database, optional Google Calendar scheduling, access across devices and accounts, and a visual interface.

**Current status:** Local task core, JSON persistence, and a stdio MCP server are implemented. Local Codex natural-language create, list, update, and complete checks passed. Cloud and cross-device behavior remain unverified.

## Product rule

Only create tasks when a user explicitly asks to create them. Scheduling and notifications also require explicit requests.

## Repository guide

- [`AGENTS.md`](AGENTS.md): project-wide instructions.
- [`docs/development-journal.md`](docs/development-journal.md): factual implementation log.
- [`docs/architecture/overview.md`](docs/architecture/overview.md): proposed system architecture.
- [`docs/decisions/`](docs/decisions/): architecture decision records.
- [`docs/roadmap.md`](docs/roadmap.md): implementation milestones.
- [`docs/tutorials/README.md`](docs/tutorials/README.md): public tutorial series outline.

`packages/core/` holds task operations and JSON persistence. `integrations/codex/` exposes MCP tools. `tests/` covers the core and MCP protocol. Google adapters and a web app are future work.

## Next milestone

Google authentication and Drive storage are the next proposed milestone. Account ownership and concurrent edit behavior must be defined before enabling cloud writes.

## Local setup

Run `npm ci`, then `npm test` from the repository root. `npm run start:mcp` starts the stdio server; an MCP host should launch it, rather than a person typing into its terminal. Data defaults to `.taskhub/tasks.json` in the server working directory. Set `TASKHUB_DATA_FILE` to an absolute path to choose another local file. The data directory is ignored by Git.

For Codex CLI, register the server with `codex mcp add taskhub -- node C:\Users\stacy\OneDrive\Documents\ChatGPT\TaskHub\integrations\codex\server.js`, then check `codex mcp list`. Set `TASKHUB_DATA_FILE` to an absolute path when registering the server so data does not depend on the Codex working directory. This local installation used `C:\Users\stacy\OneDrive\Documents\ChatGPT\TaskHub\.taskhub\tasks.json`. See [official OpenAI MCP documentation](https://developers.openai.com/learn/docs-mcp) for the current registration workflow.
