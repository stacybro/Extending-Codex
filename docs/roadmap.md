# Implementation roadmap

The core tutorial ends with the committed Google Drive milestone (`bd13797`). Completion and verification details are recorded in the [development journal](development-journal.md).

1. **Local Codex task workflow (verified locally):** task core, versioned local JSON persistence, MCP create/list/update/complete tools, automated tests, and manual natural-language create/list/update/complete checks passed. Discussing a tutorial example did not create a task. No cloud or cross-device behavior was tested.
2. **Reliable local write contract (verified locally):** version 2 schema, version 1 migration, revisions, idempotent writes, local lock, backup inspection, and structured MCP results passed automated tests. A fresh isolated Codex run completed create/list/update/complete and left a hypothetical example unsaved. No cloud or cross-device behavior was tested.
3. **Google Drive, Phase A (connectivity verified):** a standalone probe created and updated a disposable regular JSON file with the personal account. The work account authorized the same OAuth client, selected the shared file with Google Picker, read it, and updated it; the personal account read back the change. These checks used one computer and did not exercise TaskHub's storage adapter.
4. **Google Drive, Phase B (verified on one computer):** online-only adapter for one Drive JSON file, best-effort version check before upload, automatic local backups, documented manual restore, and `TASKHUB_STORAGE=local|drive` are implemented. Mocked tests, disposable MCP operations, and a Codex natural-language create/list/update/complete smoke test passed on this computer; a hypothetical example remained unsaved. The primary setup uses one personal Google account. Second-computer testing is deferred; simultaneous writes may lose an update. The separate-Google-account configuration remains optional and was previously verified on one computer.
## Core tutorial release preparation

- Check reproducible setup from a clean checkout, including Node installation, `npm ci`, local MCP registration, and the optional Drive OAuth setup with disposable data.
- Review tutorial examples against committed behavior and identify the relevant milestone commits. Keep unverified cross-device access and real-data migration clearly labeled.
- Review documentation, privacy guidance, and publication readiness. No new application feature is required for the core tutorial.

## Future optional enhancements

- **Google Calendar (deferred):** explicit scheduling and phone reminders belong in a separate optional “Additional Functions” tutorial. Do not add Calendar dependencies, scopes, scheduling logic, or notifications to the core milestone.
- **Reusable Codex skill:** optional workflow instructions grounded in tested MCP behavior.
- **Visual dashboard:** optional task views and actions using the same core contract.

Do not publish, push, or deploy without asking the user first.
