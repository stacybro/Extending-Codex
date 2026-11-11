# Extending Codex: Building Custom Tools, Skills, and Integrations

A five-chapter tutorial series for developers who want to extend Codex with project instructions, MCP tools, APIs, and persistent storage. **TaskHub**, a small task manager, is the running example. The concepts and patterns apply to other projects too.

## Read the series

1. [Understanding Codex Extensibility](docs/tutorials/01-understanding-codex-extensibility.md) — where instructions, skills, MCP, APIs, and storage fit.
2. [Building Your First Codex MCP Server](docs/tutorials/02-building-your-first-mcp-server.md) — build a local task core, JSON store, and four MCP tools.
3. [Building Reliable MCP Tools](docs/tutorials/03-building-reliable-mcp-tools.md) — add revisions, idempotency, validation, and recovery.
4. [Choosing Cloud Storage for a Codex MCP Integration](docs/tutorials/04-choosing-cloud-storage.md) — understand Google Drive, Google Cloud, OAuth, and expected costs.
5. [Integrating Google Drive with a Codex MCP Server](docs/tutorials/05-integrating-google-drive.md) — connect the tools to one disposable Drive JSON file.

The [tutorial index](docs/tutorials/README.md) tracks the implementation commits and verification status. Chapters 2, 3, and 5 use committed TaskHub milestones so readers can inspect the code behind each example.

## Run the example

From the repository root, install dependencies and run the automated tests:

```text
npm ci
npm test
```

TaskHub exposes `list_tasks`, `create_task`, `update_task`, and `complete_task` through a local stdio MCP server. Its default store is a local JSON file; Chapter 5 shows an optional Google Drive mode. Start with [Chapter 2](docs/tutorials/02-building-your-first-mcp-server.md) for a reproducible build and Codex registration, or use the [Drive setup and recovery guide](docs/architecture/google-drive-storage.md) for the implemented Drive configuration.

Only create a task when the user explicitly requests one. A due date does not schedule an event or notification. Keep task data, OAuth tokens, credentials, and backups out of Git.

## Verification boundaries

The local workflow and Milestone 3 Drive integration were verified with tests and disposable data on **one computer**. Real-task migration and second-computer operation have not been verified. Drive mode uses a best-effort version check and local backups; simultaneous writes can still lose an update. The [development journal](docs/development-journal.md) records what was actually tested.

Google Calendar scheduling, a reusable skill, and a visual dashboard are possible later extensions, outside this five-chapter core series.
