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
