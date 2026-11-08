# ADR 0002: Local JSON storage and stdio MCP

- **Status:** Implemented and verified locally
- **Date:** 2026-11-07

## Context and decision

The first milestone needs a runnable task workflow without cloud credentials. Use a Node task core with a replaceable `read`/`change` storage contract, a versioned JSON file adapter, and an MCP stdio adapter. Use the MCP server SDK and Zod for protocol and tool input schemas; Node supplies tests and file operations. Data lives outside Git.

## Alternatives and tradeoffs

- A Codex skill alone cannot provide structured persistence; defer it until tool behavior is verified.
- A hosted database adds operational cost outside the product goal.
- JSON is easy to inspect and test but supports only one writer process. A future Drive adapter requires an explicit ownership and conflict policy.
- The SDK adds dependencies but avoids maintaining MCP protocol handling ourselves.

## Consequences

Atomic rename protects against partially written files. It does not coordinate separate writer processes. A due date is stored as data and never schedules an event. Local Codex checks verified explicit create, list, update, and complete requests, plus discussion of an example without creation. Cloud and cross-device behavior remain unverified.
