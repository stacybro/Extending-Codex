# Milestone 3 acceptance: single-user Drive storage

**Status:** Accepted on one computer with disposable data. Second-computer testing is deferred. Do not connect or migrate the real local task file.

## Required configuration

- `TASKHUB_STORAGE=drive`, `TASKHUB_DRIVE_ACCOUNT=personal`, and the disposable `TASKHUB_DRIVE_FILE_ID` are set for an isolated MCP registration. The existing local registration remains unchanged.
- Desktop OAuth uses the personal Google account and `drive.file` scope. Credentials, tokens, and local backups stay outside Git and task data.
- The four existing MCP tools remain `list_tasks`, `create_task`, `update_task`, and `complete_task`.

## Acceptance checks on this computer

1. In a Codex conversation using the isolated Drive-mode MCP server, explicitly request creation of one disposable task without supplying an operation ID. Confirm Codex invokes `create_task` and lists the saved task.
2. Explicitly request an update and completion without supplying revision numbers. Confirm Codex obtains each current revision with `list_tasks`, invokes `update_task` and `complete_task`, and reports the resulting state.
3. Discuss “Buy groceries” as a hypothetical task example without asking to save it. Confirm Codex does not invoke `create_task` for the example and a final list contains no example task.
4. Run `npm test`, syntax checks for changed JavaScript, and `git diff --check`. Confirm the existing local suite passes and no credentials, tokens, real task data, backups, or tutorial files are staged.

The earlier disposable MCP protocol test verified all four tools under both Google accounts on one computer. It does not replace the natural-language Codex smoke test. Second-computer and cross-device checks are deferred. The optional two-Google-account configuration remains supported but is not part of acceptance. Best-effort Drive version checks still leave a possible read-check-write race.

## Actual result

An ephemeral Codex CLI session used only an isolated `taskhub_drive` MCP entry pointed at the disposable file. It called `create_task`, `list_tasks`, `update_task`, `list_tasks`, `complete_task`, and `list_tasks` in that order. Codex generated all three operation IDs and supplied the current task revisions 1 and 2 without asking the user. The task ended completed at revision 3 with the requested updated notes. The session discussed “Buy groceries” without calling `create_task` for it; the final list contained only the three completed disposable verification tasks. The existing local MCP registration was not changed. This proves one Codex session on this computer, not cross-device visibility.
