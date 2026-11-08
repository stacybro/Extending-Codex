# Proposed system architecture

TaskHub has no application implementation yet. The boundaries below are proposals to guide incremental development, not verified capabilities.

## Components and data flow

```text
Codex natural language -> local MCP tools -> task core -> storage interface
                                         -> local file first; Google Drive later
Visual dashboard (later) ---------------> task core
Explicit scheduling request -> Calendar adapter (later)
```

The task core owns task identity, fields, and create, list, update, and complete operations. An MCP server gives Codex structured actions; a later skill may provide reusable workflow guidance. Storage implementations sit behind an interface so a local file can be replaced or supplemented by Google Drive without moving task rules. A visual client should use the same operations. Calendar events and notifications require an explicit scheduling request.

## Future cross-device access

Google Drive is the intended persistent cloud store without a hosted database. Before shared writes, define the file format, ownership, account authentication and authorization, and concurrent edit policy. Validate these with more than one device and separately authenticated accounts. The initial local milestone does not provide sync or account sharing.

## Proposed code layout

`packages/core/` holds task behavior; `integrations/codex/`, `integrations/google-drive/`, and `integrations/google-calendar/` hold adapters; `apps/web/` holds a future dashboard; `tests/` holds meaningful verification. Add directories as code is implemented.

See [ADR 0001](../decisions/0001-separate-task-core-from-integrations.md) for the boundary decision and [the roadmap](../roadmap.md) for sequencing.
