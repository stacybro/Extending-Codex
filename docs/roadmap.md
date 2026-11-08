# Implementation roadmap

These are proposed milestones. Mark completion only after implementation and verification; record actual results in the [development journal](development-journal.md).

1. **Local Codex task workflow (verified locally):** task core, versioned local JSON persistence, MCP create/list/update/complete tools, automated tests, and manual natural-language create/list/update/complete checks passed. Discussing a tutorial example did not create a task. No cloud or cross-device behavior was tested.
2. **Reliable local write contract (verified locally):** version 2 schema, version 1 migration, revisions, idempotent writes, local lock, backup inspection, and structured MCP results passed automated tests. A fresh isolated Codex run completed create/list/update/complete and left a hypothetical example unsaved. No cloud or cross-device behavior was tested.
3. **Google Drive prototype:** regular shareable file, authenticated adapter, enforceable conditional writes, and cross-device read/write verification.
4. **Multiple accounts:** ownership, authorization, sharing, and concurrent edit policy verified across separate accounts.
5. **Reusable Codex skill:** workflow instructions grounded in tested MCP behavior.
6. **Google Calendar:** explicitly requested events and notifications, with verified account authorization.
7. **Visual dashboard:** task views and actions using the same core contract, including mobile usability checks.
8. **Release preparation:** documentation, tutorial examples linked to actual Git milestones, and publication review.

Do not publish, push, or deploy without asking the user first.
