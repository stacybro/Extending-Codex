# Extending Codex: Building Custom Tools, Skills, and Integrations

TaskHub is the working example for this proposed public developer tutorial series. Publication destinations may include GitHub, GitHub Pages, Dev.to, or Medium. Nothing has been published.

Conceptual chapters may use clearly labeled proposed designs. Write implementation tutorials against working code and an identifiable Git milestone. Keep examples aligned with the application and distinguish planned behavior from verified behavior. Application progress takes priority over tutorial polish.

## Proposed series

1. **[Understanding Codex Extensibility](01-understanding-codex-extensibility.md)** — project instructions, skills, MCP, APIs, persistence, and enforcement boundaries.
2. **Introducing TaskHub and the repository** — scope, explicit task creation, and development rules.
3. **Separating task behavior from integrations** — the core model, storage interface, and local operations.
4. **Building a Codex tool with MCP** — expose verified local task operations and handle user intent.
5. **Writing a reusable Codex skill** — instructions and workflows around the tool.
6. **Adding Google Drive persistence** — authentication, data format, and storage adapter.
7. **Supporting multiple devices and accounts** — sharing, authorization, and concurrent edits.
8. **Adding Google Calendar scheduling** — explicit events and notifications.
9. **Building a visual task interface** — reuse the same task operations.
10. **Preparing a release and tutorial artifacts** — verification, examples, and publication preparation.

## Tutorial milestone tracker

The local task core, JSON storage, and MCP tools were committed in `29a1fea` and verified locally as recorded in the [development journal](../development-journal.md). Chapter 1 uses that milestone to explain the architecture without a code walkthrough. Add reproducible examples to implementation chapters when they are written and verified.

The separate Tutorial Writer skill is outside this series' current implementation scope.
