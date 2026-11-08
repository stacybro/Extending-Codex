# Extending Codex: Building Custom Tools, Skills, and Integrations

TaskHub is the working example for this proposed public developer tutorial series. Publication destinations may include GitHub, GitHub Pages, Dev.to, or Medium. Nothing has been published.

Conceptual chapters may use clearly labeled proposed designs. Write implementation tutorials against working code and an identifiable Git milestone. Keep examples aligned with the application and distinguish planned behavior from verified behavior. Application progress takes priority over tutorial polish.

## Proposed series

1. **[Understanding Codex Extensibility](01-understanding-codex-extensibility.md)** — project instructions, skills, MCP, APIs, persistence, and enforcement boundaries.
2. **[Building Your First Codex MCP Server: A Task Manager from Scratch](02-building-your-first-mcp-server.md)** — reproduce the verified local task core, JSON store, MCP tools, and tests.
3. **[Building Reliable MCP Tools: Revisions, Idempotency, and Recovery](03-building-reliable-mcp-tools.md)** — evolve the local workflow using Milestone 2 revisions, operation IDs, migration, validation, and recovery.
4. **Designing safer MCP workflows** — examine tool schemas, descriptions, and explicit-intent limits in more detail.
5. **Writing a reusable Codex skill** — instructions and workflows around the tool.
6. **Adding Google Drive persistence** — authentication, data format, and storage adapter.
7. **Supporting multiple devices and accounts** — sharing, authorization, and concurrent edits.
8. **Adding Google Calendar scheduling** — explicit events and notifications.
9. **Building a visual task interface** — reuse the same task operations.
10. **Preparing a release and tutorial artifacts** — verification, examples, and publication preparation.

## Tutorial milestone tracker

The local task core, JSON storage, and MCP tools were committed in `29a1fea`; Chapter 2 reproduces that milestone. Chapter 3 covers the reliable local write contract in `1ee220c`. Both milestones and their local checks are recorded in the [development journal](../development-journal.md). Add examples to later chapters when they are written and verified.

The separate Tutorial Writer skill is outside this series' current implementation scope.
