# Implementation roadmap

These are proposed milestones. Mark completion only after implementation and verification; record actual results in the [development journal](development-journal.md).

1. **Local Codex task workflow (verified locally):** task core, versioned local JSON persistence, MCP create/list/update/complete tools, automated tests, and manual natural-language create/list/update/complete checks passed. Discussing a tutorial example did not create a task. No cloud or cross-device behavior was tested.
2. **Google Drive prototype:** authenticated storage adapter, file format, and cross-device read/write verification.
3. **Multiple accounts:** ownership, authorization, sharing, and concurrent edit policy verified across separate accounts.
4. **Reusable Codex skill:** workflow instructions grounded in tested MCP behavior.
5. **Google Calendar:** explicitly requested events and notifications, with verified account authorization.
6. **Visual dashboard:** task views and actions using the same core contract, including mobile usability checks.
7. **Release preparation:** documentation, tutorial examples linked to actual Git milestones, and publication review.

Do not publish, push, or deploy without asking the user first.
