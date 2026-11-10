# Isolated Google Drive connectivity probe

This Phase A probe uses only a disposable JSON file. It does not import TaskHub code or read `.taskhub/tasks.json`. It uses Node.js built-ins and adds no package dependencies. It is not a storage adapter.

## Setup

In a dedicated Google Cloud project, enable Google Drive API and Google Picker API. Configure an External OAuth app in Testing, add both Google accounts as test users, declare only `https://www.googleapis.com/auth/drive.file`, and create a Desktop OAuth client. Save its downloaded JSON as `oauth-client.json` under `%LOCALAPPDATA%\TaskHub\drive-poc\`, outside the repository.

The probe writes `poc-state.json` in the same directory. This contains OAuth tokens and the disposable file ID. Never copy either local JSON file into Git, issue reports, or chat. On Windows, the user profile protects these files; file mode `0600` is not a substitute for Windows ACLs.

From the repository root in PowerShell:

```powershell
node .\experiments\drive-connectivity\drive-poc.mjs auth personal
node .\experiments\drive-connectivity\drive-poc.mjs create personal
node .\experiments\drive-connectivity\drive-poc.mjs read personal
node .\experiments\drive-connectivity\drive-poc.mjs update personal
```

Share the created `taskhub-drive-poc.json` file from the personal Drive account to the work account with Editor permission. Then:

```powershell
node .\experiments\drive-connectivity\drive-poc.mjs auth work
node .\experiments\drive-connectivity\drive-poc.mjs pick work
node .\experiments\drive-connectivity\drive-poc.mjs read work
node .\experiments\drive-connectivity\drive-poc.mjs update work
node .\experiments\drive-connectivity\drive-poc.mjs read personal
```

The `auth` and `pick` commands print OAuth URLs. Open them locally and do not share the URLs or callback codes. `pick work` requires selecting the shared file in Google Picker. Sharing alone gave the work account browser access but did not give the OAuth client `drive.file` API access in this test.

## Disposable TaskHub storage test

`create-store personal` creates a separate empty version 2 file named `taskhub-drive-integration-test.json` and records its ID in the local POC state. It does not use the Phase A counter file or real TaskHub data. Share this new file with the work account as Editor. Set `TASKHUB_DRIVE_FILE_ID` to the new ID before running `pick work`, so Picker grants the app access to this file instead of the Phase A counter file. Then run `verify-mcp.mjs personal` and `verify-mcp.mjs work` from the repository root. Each run calls the four existing MCP tools and uses stable operation IDs, so rerunning does not duplicate its test task.

Keep `TASKHUB_DRIVE_POC_HOME` pointed to the local OAuth directory if your shell's `%LOCALAPPDATA%` is redirected. The verification script passes explicit credential, token-state, and backup paths outside the repository to a temporary MCP server. It does not alter an existing Codex MCP registration.

If a test fails, do not switch to the broader Drive scope as a shortcut. Check account selection, editor sharing, Picker selection, and workplace policy. In OAuth Testing status, refresh tokens may expire after seven days; rerun authorization if needed.

When the proof of concept is no longer needed, remove its access in both Google accounts and delete the local `%LOCALAPPDATA%\TaskHub\drive-poc\` folder and disposable Drive file deliberately. No cleanup is automatic. This probe has no version check or backup and must never be pointed at real task data.
