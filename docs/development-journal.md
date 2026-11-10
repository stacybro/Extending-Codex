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

## 2026-11-09 — Drive Phase A connectivity verified

- The user created Google Cloud project `taskhub-drive-poc`, enabled Google Drive API and Google Picker API, configured an External OAuth consent screen with personal and work test users, selected only `drive.file`, and created a Desktop OAuth client. The credential file was saved outside the repository. The user completed both account consent flows without sharing credentials in chat.
- Added an isolated Node probe under `experiments/drive-connectivity/`; it does not import the TaskHub application, use the real task file, or add dependencies. Tokens and the disposable file ID are kept under the user's local application-data directory, outside Git. `node --check` passed; the status command initially reported both accounts unauthorized.
- Personal account: created `taskhub-drive-poc.json`, read expected `counter: 0`, updated it once, and read back `counter: 1`. The user shared this file with the work account as Editor and confirmed the work account could open it in the Drive browser UI.
- Work account: OAuth authorization succeeded, but a Drive API read initially returned 404. After the user selected the file through Google Picker, the API read succeeded, an update produced `counter: 2`, and a personal-account API read confirmed `counter: 2`. This verified cross-account access on one computer, not cross-device synchronization.
- A sandboxed API call first failed DNS resolution; an approved unsandboxed call succeeded. No TaskHub cloud adapter, version check, backup, migration, or real task-data access was tested. The existing local TaskHub integration remains unchanged. A separate pre-existing README modification was left untouched. No tutorial file, commit, push, or publication was made.
- After documenting the result, `npm test` passed all 10 local tests, `node --check experiments/drive-connectivity/drive-poc.mjs` passed, and `git diff --check` found no whitespace errors. These checks do not establish two-device behavior.

## 2026-11-09 — Drive Phase B implementation and disposable MCP verification

- Added `TASKHUB_STORAGE=local|drive`, defaulting to local. Drive mode uses the existing task core and four MCP tools, a Drive adapter, a Desktop OAuth token provider, and a reusable OAuth/Picker setup command. The adapter reads and validates the remote version 2 JSON for each operation, saves a validated local backup before changed writes, and checks Drive `version` immediately before upload. A known version mismatch stops the write. Upload timeouts and ambiguous responses return `OUTCOME_UNKNOWN`; the core checks the durable operation ledger instead of blindly uploading again.
- Created a separate empty `taskhub-drive-integration-test.json` file in the personal Drive account. The user shared it with the work account as Editor and selected it in Google Picker under the work account. No real TaskHub task file was connected or migrated. OAuth files and backups remained under local application data outside Git.
- An MCP protocol harness exposed the same four tool names and performed list, create, update, complete, and list with the personal account, then with the work account. Each account's final list contained both completed disposable verification tasks; a repeated run used the same operation IDs and did not add tasks. One personal completion and one work update initially stopped with `DRIVE_CHANGED`; reloading and retrying with the same operation ID after confirming the task revision had not changed succeeded. This is a single-computer, two-account check, not a separate-device or concurrent-write test.
- The mocked Drive adapter and token-provider tests, together with all prior local tests, passed 21/21 in the final run. Syntax checks passed for the changed JavaScript files, and `git diff --check` found no whitespace errors. The latest personal and work local backups each validated as version 2 data using `integrations/drive/validate-backup.js`. No tutorial files were modified by this conversation; concurrent tutorial edits were preserved. No commit, push, or publication was performed.

## 2026-11-09 — Two-computer acceptance plan revised

- The user chose one personal Google account for TaskHub on both computers. Different Codex/ChatGPT accounts may still be used. The same disposable Drive JSON file ID will be configured on both; cross-account file sharing is no longer needed for the main setup. The prior personal/work account test remains historical and optional.
- Updated the setup and acceptance documents for natural-language operations and visibility in both directions. The Drive adapter, version checks, backups, errors, and four MCP tools were not changed. Two-computer acceptance has not yet been run; no real tasks were connected or migrated. No tutorial files, commit, push, or publication were changed by this revision.

## 2026-11-09 — Milestone 3 local acceptance smoke test

- The user deferred second-computer acceptance and chose one personal Google account as the primary setup. The optional two-account procedure was moved to an advanced section. No application behavior changed for that decision.
- An ephemeral Codex CLI session used an isolated `taskhub_drive` MCP configuration pointing only to the disposable version 2 Drive file. The first attempt in the sandbox could not open Codex's state database; an approved unsandboxed run succeeded. The existing local `taskhub` registration was not changed.
- Codex called `create_task`, `list_tasks`, `update_task`, `list_tasks`, `complete_task`, and `list_tasks` for one explicitly requested disposable task. It generated operation IDs and used current revisions 1 and 2 without asking the user. The final task was completed at revision 3 with updated notes. It discussed “Buy groceries” as hypothetical and made no create call for it; the final list contained no example task.
- This test confirms natural-language use on one computer with the personal Google account. It does not verify cross-device access, simultaneous writes, or migration of real task data. After the documentation update, `npm test` passed 21 tests with 0 failures; JavaScript syntax checks passed; `git diff --check` found no whitespace errors. A targeted scan of the Milestone 3 files found no credential, token, API-key, or private-key values. The commit review excludes README and tutorial edits made outside this milestone.
