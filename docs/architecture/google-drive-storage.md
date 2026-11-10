# Google Drive storage setup and recovery

TaskHub defaults to local JSON storage. Drive mode uses one regular JSON file in the user's personal Google Drive and never falls back to local storage. The file must contain a valid TaskHub version 2 document. Do not point Drive mode at the real local `.taskhub/tasks.json`; migration of real data requires a separate explicit decision.

## Configure an authorized computer

Use a Desktop OAuth client with `drive.file` scope, as described in [ADR 0004](../decisions/0004-single-drive-file.md). Set `TASKHUB_DRIVE_ACCOUNT=personal` and `TASKHUB_DRIVE_FILE_ID` to the TaskHub JSON file ID. Authorize with `node integrations/drive/authorize.js auth`, choosing the **personal Google account** in the browser. Then select that file with `node integrations/drive/authorize.js pick`. These commands use Desktop OAuth with PKCE; never paste the printed URL or callback code into chat. Keep OAuth state and backups local. Codex/ChatGPT account sign-ins do not determine Google Drive authorization.

`personal` is a local token-slot label, not a verified Google identity. Confirm that the browser uses the intended personal Google account. The `drive.file` scope alone does not authorize TaskHub to inspect the account's email address.

Set the following environment variables for the MCP server process. Use absolute paths for the credential, state, and backup settings. The defaults shown are for the current Windows installation; the OAuth files and backups live outside Git.

| Setting | Value |
| --- | --- |
| `TASKHUB_STORAGE` | `drive` to use Drive, or `local` (the default) |
| `TASKHUB_DRIVE_FILE_ID` | The TaskHub JSON file ID; use the disposable file until real-data migration is approved |
| `TASKHUB_DRIVE_ACCOUNT` | `personal` |
| `TASKHUB_DRIVE_CREDENTIALS_FILE` | Defaults to `%LOCALAPPDATA%\TaskHub\drive-poc\oauth-client.json` |
| `TASKHUB_DRIVE_STATE_FILE` | Defaults to `%LOCALAPPDATA%\TaskHub\drive-poc\poc-state.json` |
| `TASKHUB_DRIVE_BACKUP_DIR` | Defaults to `%LOCALAPPDATA%\TaskHub\drive-backups` |

Keep separate local and Drive MCP registrations if both are needed; do not change the existing local registration's environment while testing Drive. The four tool names remain `list_tasks`, `create_task`, `update_task`, and `complete_task`. In local mode, `TASKHUB_DATA_FILE` retains its existing meaning. In Drive mode, it is ignored. A missing Drive configuration, offline network, expired authorization, unreadable file, or invalid task JSON fails the operation without switching stores.

For a PowerShell process launched by an MCP host, set `TASKHUB_STORAGE='drive'`, `TASKHUB_DRIVE_FILE_ID='<FILE_ID>'`, and `TASKHUB_DRIVE_ACCOUNT='personal'`. Set the three absolute file/directory paths above when their defaults do not match the machine. To return that MCP registration to local storage, remove `TASKHUB_STORAGE` or set it to `local`; set `TASKHUB_DATA_FILE` explicitly if its local path should not depend on the host's working directory. Restart the MCP process after changing its environment.

## Write behavior and limits

Every operation reads the Drive file and validates its task document. Before each changed write, TaskHub saves a validated local copy of the previous document, syncs that backup to disk, then checks the Drive file's `version` again. A mismatch returns `DRIVE_CHANGED` and skips upload. A metadata change can advance Drive `version` even if task content is unchanged. The second check is not an atomic precondition: a truly simultaneous write after the check can still be lost. Multiple server processes also have no shared cloud lock.

Network failure or timeout during upload returns `OUTCOME_UNKNOWN`. The core reads the file again and checks the stable operation ID. If the operation is present with identical normalized arguments, it returns the saved result. If the result cannot be confirmed, it leaves the outcome unknown. Retry only with the same operation ID after rechecking; a new ID could duplicate a create. There is no offline queue or automatic merge.

Backups are stored per write, named with the Drive file ID and observed version, and are not automatically pruned. Plan retention based on available disk space. They contain private task data; protect the Windows account and backup directory. OAuth state contains access and refresh tokens and must never be copied into the repository or shared with task data. An External OAuth app in Testing can require reauthorization after seven days.

## Manual restore

1. Stop TaskHub Drive MCP processes on every computer and inspect the latest Drive file and local backups. Determine which backup contains the intended task state; do not assume the newest file is correct after an uncertain write.
2. Validate a chosen backup locally with `node integrations/drive/validate-backup.js "C:\absolute\path\to\backup.json"`. This prints only task count and store revision. Keep an additional copy of the current Drive file before replacing it.
3. In the Drive browser UI, select the **same** JSON file, choose **File information → Manage versions → Upload new version**, and upload the validated backup. This preserves the shared file ID. [Google Drive Help](https://support.google.com/drive/answer/2409045) documents this operation for non-Google files.
4. Restart one account's MCP server, run `list_tasks`, and verify the restored data before resuming writes on other computers. If authorization or Picker access was lost, reauthorize and select the file again.

Restoring an older backup can discard later valid changes. It is a deliberate manual recovery action, not an automatic response to corrupt data.

## Advanced: optional second Google account

The adapter also supports `TASKHUB_DRIVE_ACCOUNT=work`. To use a separate Google account, share the file with that account as Editor, add it as an OAuth test user when the app is in Testing, authorize that account into its own token slot, and select the file in Google Picker. Phase A verified this path on one computer. It is not needed for the primary single-Google-account setup.
