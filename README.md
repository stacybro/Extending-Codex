# TaskHub

TaskHub is a planned task-management system intended to work with Codex and potentially ChatGPT. Its goals include explicit natural-language task operations, Google Drive storage without a hosted database, optional Google Calendar scheduling, access across devices and accounts, and a visual interface where supported.

**Current status:** Project guidance and documentation only. No TaskHub application functionality has been implemented.

## Product rule

Only create tasks when a user explicitly asks to create them. Scheduling and notifications also require explicit requests.

## Repository guide

- [`AGENTS.md`](AGENTS.md): project-wide instructions.
- [`docs/development-journal.md`](docs/development-journal.md): factual implementation log.
- [`docs/architecture/overview.md`](docs/architecture/overview.md): proposed system architecture.
- [`docs/decisions/`](docs/decisions/): architecture decision records.
- [`docs/roadmap.md`](docs/roadmap.md): implementation milestones.
- [`docs/tutorials/README.md`](docs/tutorials/README.md): public tutorial series outline.

Application directories will be created when their first implementation is ready. The proposed layout is `packages/core/` for task behavior, `integrations/` for Google and Codex adapters, `apps/web/` for a visual interface, and `tests/` for meaningful verification.

## Next milestone

Implement a local task model and explicit create, list, update, and complete operations behind a storage interface, exposed to Codex through a local MCP server. Verify that task creation requires an explicit request. Google authentication and Drive storage follow once the core contract is established.
