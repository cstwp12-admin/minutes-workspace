# Architecture

Minutes Workspace is intentionally split into three layers:

1. **Canonical meeting model** — meeting metadata, hierarchical agenda items, content blocks, actions, statuses and source anchors.
2. **Application UI** — import review, secretary workspace, presenter view and action register.
3. **Persistence adapters** — IndexedDB for browser-local meetings, followed by a future optional Supabase adapter for team workspaces.

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

## Import boundary

The DOCX parser loads only the main document XML from a bounded ZIP archive and constructs text and table data. Imported content is rendered through React rather than inserted as HTML. External relationships, scripts and macros are not executed.

Import staging owns an independent draft until approval. Each imported record keeps extracted table grids, body paragraphs, original references and review notes in its local source evidence. Rich table cells carry column positions and row/column spans alongside recursively nested content blocks. The preview and Word export consume the same cell model.

Pattern confidence values are review hints, not calibrated accuracy measurements. Word pages are not inferred from XML. PDF parsing remains a separate future path.
