# ADR 0002: Local JSON storage and stdio MCP

- **Status:** Superseded in part by [ADR 0003](0003-revisioned-task-writes.md)
- **Date:** 2026-11-07

## Context and decision

The first milestone needed a runnable task workflow without cloud credentials. It used a Node task core with a replaceable `read`/`change` storage contract, a versioned JSON file adapter, and an MCP stdio adapter. ADR 0003 replaces `change` with `transact`, adds revisions and a local lock, and retains the MCP boundary. Data lives outside Git.

## Alternatives and tradeoffs

- A Codex skill alone cannot provide structured persistence; defer it until tool behavior is verified.
- A hosted database adds operational cost outside the product goal.
- JSON is easy to inspect and test. ADR 0003 adds local lock rejection for overlapping writers. A future Drive adapter still requires an ownership and enforceable conflict policy.
- The SDK adds dependencies but avoids maintaining MCP protocol handling ourselves.

## Consequences

Atomic rename protects against partially written files. ADR 0003 adds a separate-process write lock and revision checks. A due date is stored as data and never schedules an event. Cloud and cross-device behavior remain unverified.
