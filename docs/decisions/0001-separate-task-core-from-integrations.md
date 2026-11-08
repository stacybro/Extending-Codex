# ADR 0001: Separate task behavior from integrations

- **Status:** Partially implemented (local core and MCP boundary)
- **Date:** 2026-11-07

## Context

TaskHub is intended to support local development, Google Drive persistence, Google Calendar scheduling, Codex tools, and a visual interface. These integrations have different authentication and runtime needs. The local core and MCP boundary are now implemented; cloud and visual integrations remain proposed.

## Proposed decision

Define task data and operations in a core package that depends on a storage interface. Implement Drive storage, Calendar scheduling, Codex access, and visual presentation as separate adapters or clients. Require explicit user intent at the operation boundary for task creation and scheduling.

## Alternatives and tradeoffs

- A single application directly calling Google APIs would be quicker to prototype, but would couple task rules to provider behavior and make local verification harder.
- A hosted database could simplify some query and concurrency concerns, but conflicts with the current goal of Google Drive storage without a hosted database.
- Separate components add interfaces and some initial setup. They allow local development before cloud authentication and make provider behavior easier to test in isolation.

## Consequences and open questions

The local storage contract is implemented. Drive file format, ownership and sharing model, and concurrent edit policy remain to be designed and verified. This record does not claim that Google Drive storage or cross-account access works.
