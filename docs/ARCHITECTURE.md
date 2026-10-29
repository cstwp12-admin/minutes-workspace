# Architecture

Minutes Workspace is intentionally split into three layers:

1. **Canonical meeting model** — meeting metadata, hierarchical agenda items, content blocks, actions, statuses and source anchors.
2. **Application UI** — import review, secretary workspace, presenter view and action register.
3. **Persistence adapters** — browser-local storage in the next phase, followed by an optional Supabase adapter for team workspaces.

The UI must not depend directly on Supabase. Both individual and team modes will implement the same repository interface so a meeting can be exported, restored or migrated without changing its meaning.

## Data and privacy boundaries

- The repository contains fictional demonstration data only.
- Organization names, projects, participants and logos are runtime data, not source-code constants.
- Local mode keeps meeting records in the browser and supports explicit JSON backup.
- Team mode will use authenticated Supabase access with row-level security.
- Service-role credentials must never be exposed through Vite environment variables.
- Uploaded documents and private exports are excluded from Git.

## Planned lifecycle

`draft_agenda → agenda_review → agenda_approved → in_progress → draft_minutes → minutes_review → approved → finalized`

Every server-side transition will eventually create an append-only audit event. Finalized revisions are immutable; amendments create a new revision.
