# Development journal

Record dated, factual milestones, problems, solutions, and verification here. Do not add entries for planned work as though it has happened.

## 2026-11-07 — Project initialization

- Inspected the TaskHub folder. It contained an existing Git repository with no commits and no project files.
- Added project instructions, architecture documentation, a decision record, and the tutorial outline.
- Application functionality and tests have not been created or run.

## 2026-11-07 — Documentation layout update

- Added a proposed system overview and implementation roadmap.
- Moved the existing proposed ADR into `docs/decisions/` and updated project instructions and links to use that location.
- Clarified that the first implementation is a local Codex task workflow using MCP. No application code or dependencies were added; no application tests were run.

## 2026-11-07 — Local implementation in progress

- Added the task core, version 1 JSON file adapter, and four MCP stdio tools. Added Node tests for operations, validation, missing IDs, concurrent changes through one store, MCP discovery, and persistence across a server restart.
- Initial test run failed with `EPERM` during file rename in the sandbox temporary directory. Moving test fixtures under ignored `.taskhub/test/` resolved that case, but rapid replacement in the OneDrive workspace also produced `EPERM`. Added bounded retry around rename; the next `npm test` run passed 4 tests, 0 failed.
- `node --check integrations/codex/server.js` passed. Codex host registration and natural-language prompts have not been tested. No cloud or cross-device behavior was tested.
- Another Codex conversation is editing `docs/tutorials/`; this implementation did not edit those files. No commit, push, or publication was performed.

## 2026-11-07 — Local Codex integration verified

- Registered the local MCP server in Codex with `TASKHUB_DATA_FILE` set to the ignored `.taskhub/tasks.json` file. Confirmed the registration was enabled and exposed `list_tasks`, `create_task`, `update_task`, and `complete_task`.
- `list_tasks` initially returned `[]`. An explicit request to add “Review the Chapter 1 tutorial” created one open task with a UUID and no due date. A subsequent list returned that task.
- An explicit request to change its description updated its `notes` to “Review and approve Chapter 1.” A later list returned the updated value. An explicit completion request set its status to `completed`; a final request for open tasks returned none.
- Discussion of “Buy groceries” as a tutorial example did not invoke `create_task`. The later list contained only the completed Chapter 1 task, so no example task was saved.
- These were local, single-device checks. Google Drive, Google Calendar, cross-device access, and concurrent writers remain unverified. No tutorial files were changed by this conversation.

## 2026-11-07 — Reliable local write contract in progress

- Added version 2 validation and in-memory reading of version 1 data, with migration on the first successful write. Added per-task revisions, stable operation IDs for all writes, conflict responses, a durable operation ledger, and structured MCP success and error bodies.
- Added an exclusive local lock file, previous-file backup, explicit backup inspection, and errors for corrupt or missing primary data when a backup exists. A stale lock requires manual inspection. No automatic backup restoration was added.
- Ran `npm test`: 10 tests passed, 0 failed. Tests cover core operations, MCP discovery and restart, version 1 migration, idempotent retries, conflicts, malformed data, lock rejection, persistence failure, and uncertain-outcome resolution with a test store.
- The changed MCP tool schemas and natural-language behavior have not yet been checked in a fresh Codex connection. Google Drive, Calendar, authentication, and cross-device behavior were not implemented or tested.

## 2026-11-07 — Reliable local write contract verified locally

- Reran `npm test` after recovery and response-shape changes: 10 tests passed, 0 failed. An initial MCP assertion expected an absent `isError` field, but the new response explicitly returns `false`; corrected the assertion and reran the suite successfully.
- A first fresh Codex CLI run discovered TaskHub and listed tasks but could not create its test task because its `approval: never` policy rejected the write. No task was created by that run.
- Reran a fresh Codex CLI session with automatic approval handling and an isolated ignored `.taskhub/test/manual-v2.json` data path. It invoked `create_task`, `list_tasks`, `update_task`, `list_tasks`, `complete_task`, and `list_tasks`. The final file held one completed “Milestone 2 verification” task with notes “Verified via Codex,” revision 3, and three operation ledger entries. Discussion of “Buy groceries” as a hypothetical example did not create a task.
- The manual run used isolated local data and did not test migration of the user's primary task file, Google Drive, Calendar, authentication, cross-device access, or cloud conditional writes. No tutorial files were modified and no commit or push was made.
- Read the existing primary version 1 task file with the new adapter without modifying it. Validation succeeded and returned one task in the version 2 in-memory shape. The file remains version 1 on disk; its first-write migration was tested with an isolated fixture, not on the primary file.

## 2026-11-07 — Concurrent local data change observed during commit review

- Before the Milestone 2 commit, the ignored primary `.taskhub/tasks.json` was found at version 2 with two tasks and two operation records. It had been version 1 with one task at the earlier read. The original Chapter 1 task's ID, title, notes, due date, status, and timestamps were still preserved; its revision was 1. The source of the intervening writes was not established. The primary data was not modified during this review.
- At the user's request, saved an ignored local snapshot of that version 2 file and converted the primary file back to version 1, preserving both task records and their fields. Verified the primary file reports version 1 and two tasks. The version 2 operation ledger remains only in the ignored snapshot; the version 1 format cannot retain it.
