# TaskHub project instructions

## Product rules

- Create a task only when the user explicitly requests its creation. Never save a task inferred from a discussion, suggestion, or example.
- Require an explicit request before scheduling a task or creating a Google Calendar event. A due date alone does not authorize a calendar event or notification.
- Keep task behavior independent of storage providers, user interfaces, and Codex or ChatGPT integrations.
- Protect private task data and credentials. Do not commit secrets, tokens, or personal task data.
- Define authentication, authorization, and concurrent edit behavior before enabling shared cloud writes.

## Development workflow

- Prioritize a working TaskHub application over polished tutorial content.
- Record significant architectural choices in `docs/decisions/`, including alternatives and tradeoffs. Label proposals as proposals until implementation verifies them.
- Record actual milestones, problems, and solutions in `docs/development-journal.md`. Do not invent history, functionality, or test results.
- Keep tutorial material in `docs/tutorials/` and update it when the corresponding implementation changes. Identify examples and Git commits only after they exist.
- Run appropriate tests after implementation changes and state what was tested. Never invent test results or present local checks as proof of cloud or cross-device behavior.
- Ask the user before publishing, pushing, or making destructive changes. Do not build the separate Tutorial Writer skill until requested in a later phase.
- Keep documentation concise and accurate. Update the roadmap and identify relevant tutorial milestones as working features are verified.
