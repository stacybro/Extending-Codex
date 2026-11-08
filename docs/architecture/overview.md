# System architecture

The local task core, JSON storage adapter, and stdio MCP adapter are implemented. Cloud and visual components remain proposals.

## Components and data flow

```text
Codex natural language -> local MCP tools -> task core -> storage interface
                                         -> local file first; Google Drive later
Visual dashboard (later) ---------------> task core
Explicit scheduling request -> Calendar adapter (later)
```

The task core owns task identity, fields, and create, list, update, and complete operations. The MCP server gives Codex structured actions; a later skill may provide reusable workflow guidance. The core receives a store with `read()` and `change(transform)` methods; JSON storage implements it. A future Drive adapter can implement the same contract after cloud concurrency is designed. A visual client should use the same operations. Calendar events and notifications require an explicit scheduling request and are outside task CRUD.

## Local data contract

Each task has a UUID v4 `id`, nonempty `title`, `notes`, optional `dueDate` as `YYYY-MM-DD` or `null`, `status` (`open` or `completed`), and UTC ISO `createdAt` and `updatedAt` timestamps. Completion is idempotent. A due date carries no scheduling effect. The file stores `{ "version": 1, "tasks": [...] }`. Saves write a sibling temporary file and rename it over the destination, with bounded retries for transient Windows file locks. Operations through one store instance are serialized. Separate processes writing the same file concurrently are not supported; cross-device writes need a defined conflict policy before implementation.

## Future cross-device access

Google Drive is the intended persistent cloud store without a hosted database. Before shared writes, define the file format, ownership, account authentication and authorization, and concurrent edit policy. Validate these with more than one device and separately authenticated accounts. The initial local milestone does not provide sync or account sharing.

## Proposed code layout

`packages/core/` holds task behavior and local JSON storage; `integrations/codex/` holds the MCP adapter; `tests/` holds verification. Google adapters and `apps/web/` remain future work.

See [ADR 0001](../decisions/0001-separate-task-core-from-integrations.md) for the boundary decision and [the roadmap](../roadmap.md) for sequencing.
