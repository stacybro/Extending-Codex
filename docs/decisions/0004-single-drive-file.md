# ADR 0004: One shared Drive file for TaskHub

- **Status:** Phase A connectivity verified; Phase B verified with two accounts on one computer
- **Date:** 2026-11-09

## Decision

TaskHub's optional Drive mode uses one regular, shareable Google Drive JSON file as its authoritative store. It preserves version 2 task records, revisions, and operation IDs. The adapter is online-only, reads the current Drive file version immediately before upload, and rejects a write when that version differs from the version it read. This is a best-effort check, not an atomic precondition: another client can write between the check and upload, causing a lost update. The user accepts this risk because simultaneous task edits are not expected.

The primary setup now uses the same personal Google account on both computers, with the same file ID and separate local OAuth state and backups. Each installation authorizes using the narrow `drive.file` scope and selects the file through Google Picker. The Codex/ChatGPT accounts may differ without affecting Drive authorization. No cross-account Drive sharing is needed in this setup. The earlier two-Google-account path remains optional: Phase A showed that sharing alone did not grant the work account's OAuth client per-file access, so Picker selection was required. OAuth tokens and client configuration stay outside Git and task data.

Phase B recovery uses automatic local backups and a documented manual restore procedure. It does not implement immutable operation files, distributed locks, event sourcing, or conflict merging. The local JSON adapter remains the default. No Google Calendar integration is included.

## Alternatives and tradeoffs

- A broad Drive scope could simplify access to already-shared files, but would grant more access than this single-file app needs.
- Immutable operation files or a backend could reduce lost-update risk, but add complexity the user does not want for a single-user app.
- Drive version checks can stop an overwrite of known newer data. They cannot guarantee safety against truly simultaneous writes.
- Drive `version` also changes for server-side changes that are not visible to the user, so a mismatch may require a reload even when JSON content did not change.
- A single file keeps setup, sharing, backup, and recovery simple, but all clients must agree on its file ID and permissions.

## Phase A evidence and limits

An isolated Node probe used a Desktop OAuth client and `drive.file` to create, read, and update disposable JSON from the personal account. The work account could open the shared file in Drive but initially received API 404. After selecting it in Google Picker, the work account read it and updated its counter from 1 to 2; the personal account read back 2. The test used one computer and one file, not two devices or real TaskHub data. The probe does not implement version checks, backups, or the TaskHub storage contract. Google OAuth Testing status can expire refresh tokens after seven days, requiring reauthorization.

Phase B added a separate disposable version 2 file. Both accounts used the existing four MCP tools to create, list, update, and complete their own verification tasks and list the other account's task. Best-effort version checks stopped two writes during testing; reloading and retrying with the original operation IDs succeeded. These results do not establish atomic cloud writes or two-device behavior.

The 2026-11-09 acceptance plan changes the main configuration to one personal Google account on two computers. The two-account checks above remain historical evidence, not evidence that the new two-computer setup passed. No adapter or MCP tool change is needed for this decision.
