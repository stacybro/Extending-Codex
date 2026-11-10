# ADR 0003: Revisioned and idempotent task writes

- **Status:** Implemented and verified locally
- **Date:** 2026-11-07

## Decision

Version 2 task data adds a positive per-task `revision`, a nonnegative `storeRevision`, and an operation ledger. Every write takes a caller-generated UUID `operationId`. Repeating the same ID with the same normalized arguments returns the original result; different arguments return `OPERATION_ID_REUSED`. Update and complete require `expectedRevision`; a mismatch returns `CONFLICT` with the current task and does not write. Codex should list tasks first and supply revisions without asking the user for numbers.

The local JSON adapter serializes writes in one process and uses an exclusive `.lock` file to reject overlapping writes from another process. A stale lock after an abrupt termination requires manual inspection and removal. It does not automatically decide that an old lock is safe to delete. A future Drive adapter must offer enforceable conditional writes across devices; read then upload is insufficient.

Version 1 files are validated and read in memory as version 2. The first successful write saves version 2 and preserves a version 1 backup. The primary is never silently replaced with an empty list when it is corrupt or missing while a backup exists. The `.bak` file is inspectable through the store but restoration is a deliberate manual action.

## Alternatives and tradeoffs

- Automatic conflict merging would conceal competing edits; return the current state for user review instead.
- Automatic backup restoration could discard a later valid change; require inspection first.
- An operation ledger increases file size but gives retries a durable identity without a hosted service. Its retention policy must be designed before large-scale use.
- A lock file is simple and dependency-free but can remain after a crash. It is a local safety mechanism, not a cloud concurrency design.

## Future authorization

Shared data will live in a regular, shareable Google Drive file, not `appDataFolder`. Before cloud writes, define owner and editor identities, per-account authentication, file sharing and revocation, task-level authorization if needed, and behavior when an account loses access. No authentication or Drive access is implemented here.

## Verification limit

The earlier enforceable Drive conditional-write requirement in this record is superseded by [ADR 0004](0004-single-drive-file.md) for the single-user Drive plan. That plan accepts a residual read-check-write race.

Automated tests and one isolated fresh Codex session verified the local contract. The fresh session created, listed, updated, and completed one test task while leaving a hypothetical example unsaved. This does not verify every possible natural-language prompt, cloud conflict handling, or cross-account access.
