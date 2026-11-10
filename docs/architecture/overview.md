# System architecture

The task core, local JSON adapter, stdio MCP adapter, and optional Drive adapter are implemented. Local storage remains the default. The Drive adapter has passed mocked tests and disposable MCP checks with two accounts on one computer. Visual components remain proposals.

## Components and data flow

```text
Codex natural language -> local MCP tools -> task core -> storage interface
                                         -> local file first; Google Drive later
Visual dashboard (later) ---------------> task core
Explicit scheduling request -> Calendar adapter (later)
```

The task core owns task identity, fields, and create, list, update, and complete operations. The MCP server gives Codex structured actions; a later skill may provide reusable workflow guidance. The core receives a store with `read()` and `transact(transform)` methods; JSON and Drive storage implement it. Drive mode reads and validates one shared file, saves a local backup, checks its Drive version immediately before writing, and stops on a known newer version. That check does not eliminate the read-check-write race or make `transact` atomic across devices. A visual client should use the same operations. Calendar events and notifications require an explicit scheduling request and are outside task CRUD.

## Local data contract

Each task has a UUID v4 `id`, nonempty `title` (1–200 characters), `notes` (at most 10,000 characters), optional `dueDate` as `YYYY-MM-DD` or `null`, `status` (`open` or `completed`), UTC ISO `createdAt` and `updatedAt` timestamps, and a positive `revision`. A due date carries no scheduling effect. The version 2 file stores `version`, `storeRevision`, `tasks`, and an operation ledger. Valid version 1 files are read without modification and migrated on the first successful write. Every write has a stable UUID operation ID; update and complete compare the task revision and return the current task on conflict.

The JSON adapter writes and syncs a sibling temporary file, preserves the previous valid primary as `.bak`, and atomically renames the new file over the primary. It serializes calls within a process. An exclusive `.lock` file rejects overlapping writes from separate processes; a crash can leave a stale lock that requires manual inspection. This local lock does not establish cloud concurrency. Corrupt primary data is never treated as an empty list. If the primary is missing while a backup exists, recovery is required instead of creating an empty store. Recovery is manual after inspecting the backup.

## Future cross-device access

Google Drive mode uses one regular JSON file rather than `appDataFolder`. The primary setup uses the same personal Google account and file ID on both computers; each installation authorizes the Desktop OAuth client using `drive.file` and selects the file through Google Picker. Different Codex/ChatGPT accounts can launch those installations. The optional second-Google-account configuration was verified with disposable data on one computer. Phase B implements online-only best-effort version checks and local backups with documented manual restore. Simultaneous writes can still lose an update; the user accepts this for a single-user app. No real task data was connected or migrated, and cross-device behavior remains unverified.

## Proposed code layout

`packages/core/` holds task behavior and storage adapters; `integrations/codex/` holds the MCP adapter; `integrations/drive/` handles OAuth token loading; `tests/` holds verification. `apps/web/` remains future work.

See [ADR 0001](../decisions/0001-separate-task-core-from-integrations.md) for the boundary decision, [ADR 0004](../decisions/0004-single-drive-file.md) for the revised Drive plan, [Drive storage setup](google-drive-storage.md) for operation and recovery, [Milestone 3 acceptance](milestone-3-acceptance.md) for the two-computer checks, and [the roadmap](../roadmap.md) for sequencing.
