# Extending Codex: Building Custom Tools, Skills, and Integrations

TaskHub is the working example for this five-chapter developer tutorial series. Nothing has been published.

Conceptual chapters may use clearly labeled proposed designs. Write implementation tutorials against working code and an identifiable Git milestone. Keep examples aligned with the application and distinguish planned behavior from verified behavior. Application progress takes priority over tutorial polish.

## Complete core series

1. **[Understanding Codex Extensibility](01-understanding-codex-extensibility.md)** — project instructions, skills, MCP, APIs, persistence, and enforcement boundaries.
2. **[Building Your First Codex MCP Server: A Task Manager from Scratch](02-building-your-first-mcp-server.md)** — reproduce the verified local task core, JSON store, MCP tools, and tests.
3. **[Building Reliable MCP Tools: Revisions, Idempotency, and Recovery](03-building-reliable-mcp-tools.md)** — evolve the local workflow using Milestone 2 revisions, operation IDs, migration, validation, and recovery.
4. **[Choosing Cloud Storage for a Codex MCP Integration](04-choosing-cloud-storage.md)** — Google Drive versus Google Cloud, the architecture, OAuth roles, storage limits, and expected costs.
5. **[Integrating Google Drive with a Codex MCP Server](05-integrating-google-drive.md)** — reproduce Milestone 3 `bd13797` with one personal Google account and one disposable JSON file. Cross-account sharing and Picker troubleshooting are optional. Second-computer use remains untested.

## Tutorial milestone tracker

The local task core, JSON storage, and MCP tools were committed in `29a1fea`; Chapter 2 reproduces that milestone. Chapter 3 covers the reliable local write contract in `1ee220c`. Both milestones and their local checks are recorded in the [development journal](../development-journal.md). Add examples to later chapters when they are written and verified.

The [development journal](../development-journal.md) records a disposable Google Drive connectivity probe with two accounts on one computer, then the Milestone 3 Drive adapter and one-computer Codex smoke test. Chapter 5 uses those verified results and is a draft for review. Real-task migration and second-computer testing remain deferred.

**Optional advanced section for Chapter 5:** In Phase A, sharing the disposable file as Editor let a second account open it in Drive, but its initial `drive.file` API read returned 404. Selecting that same file through Google Picker gave the application per-file access and the API read succeeded. This tested two accounts on one computer, not two devices or full cross-device synchronization.

The separate Tutorial Writer skill is outside this series' current implementation scope.

## Future Extensions

Google Calendar scheduling and notifications could become a standalone **Additional Functions** tutorial after implementation and explicit-request behavior are verified. They are outside the five-chapter core series.
