# System architecture

The local task core, JSON storage adapter, and stdio MCP adapter are implemented. Cloud and visual components remain proposals.

## Components and data flow

```text
Codex natural language -> local MCP tools -> task core -> storage interface
                                         -> local file first; Google Drive later
Visual dashboard (later) ---------------> task core
Explicit scheduling request -> Calendar adapter (later)
```

The task core owns task identity, fields, and create, list, update, and complete operations. The MCP server gives Codex structured actions; a later skill may provide reusable workflow guidance. The core receives a store with `read()` and `transact(transform)` methods; JSON storage implements it. A future Drive adapter must implement the same transaction semantics with enforceable conditional writes. A visual client should use the same operations. Calendar events and notifications require an explicit scheduling request and are outside task CRUD.

## Local data contract

Each task has a UUID v4 `id`, nonempty `title` (1–200 characters), `notes` (at most 10,000 characters), optional `dueDate` as `YYYY-MM-DD` or `null`, `status` (`open` or `completed`), UTC ISO `createdAt` and `updatedAt` timestamps, and a positive `revision`. A due date carries no scheduling effect. The version 2 file stores `version`, `storeRevision`, `tasks`, and an operation ledger. Valid version 1 files are read without modification and migrated on the first successful write. Every write has a stable UUID operation ID; update and complete compare the task revision and return the current task on conflict.

The JSON adapter writes and syncs a sibling temporary file, preserves the previous valid primary as `.bak`, and atomically renames the new file over the primary. It serializes calls within a process. An exclusive `.lock` file rejects overlapping writes from separate processes; a crash can leave a stale lock that requires manual inspection. This local lock does not establish cloud concurrency. Corrupt primary data is never treated as an empty list. If the primary is missing while a backup exists, recovery is required instead of creating an empty store. Recovery is manual after inspecting the backup.

## Future cross-device access

Google Drive is the intended persistent cloud store without a hosted database. Use a regular shareable file rather than `appDataFolder` to allow separate accounts. Before shared writes, define file ownership, account authentication and authorization, sharing and revocation, and an enforceable conditional-write policy. A read followed by an unconditional upload could overwrite another device's changes. Validate the design with more than one device and separately authenticated accounts. No sync or account sharing is implemented yet.

## Proposed code layout

`packages/core/` holds task behavior and local JSON storage; `integrations/codex/` holds the MCP adapter; `tests/` holds verification. Google adapters and `apps/web/` remain future work.

See [ADR 0001](../decisions/0001-separate-task-core-from-integrations.md) for the boundary decision and [the roadmap](../roadmap.md) for sequencing.
