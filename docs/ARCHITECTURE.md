# Architecture

Minutes Workspace is intentionally split into three layers:

1. **Canonical meeting model** — meeting metadata, hierarchical agenda items, content blocks, actions, statuses and source anchors.
2. **Application UI** — import review, secretary workspace, presenter view and action register.
3. **Persistence adapters** — IndexedDB for browser-local meetings, plus an optional Supabase team repository with a separate library and explicit sharing.

The UI must not depend directly on Supabase. Both individual and team modes will implement the same repository interface so a meeting can be exported, restored or migrated without changing its meaning.

Phase 7.1 exposes a TeamRepository contract for cloud operations. The SDK adapter is loaded only after an explicit connection. Local IndexedDB APIs remain independent. Shared records carry server versions outside the canonical MeetingDocument; optimistic saves and server-side role checks protect team data. An opened team draft never follows polling updates automatically. Team changes use explicit Save to team; local editing retains browser autosave. No backend configuration is embedded in a build. See TEAM_SETUP.md for the SQL and security model.

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

DOCX list reconstruction also reads bounded numbering and style parts. Labels are calculated once in document order to avoid advancing counters twice when a table is revisited. Supported definitions include style inheritance, list instances, level start overrides and common restart rules; unsupported formats produce review notes.

Import corrections are pure transformations of the staged record. Source evidence is not rewritten. Operations preserve technical blocks, track related source anchors and create review audit events. The review UI keeps the latest 20 prior draft states for Undo. Split operations do not duplicate actions, and conflicting actions prevent an automatic merge.

Import staging owns an independent draft until approval. Each imported record keeps extracted table grids, body paragraphs, original references and review notes in its local source evidence. Rich table cells carry column positions and row/column spans alongside recursively nested content blocks. The preview and Word export consume the same cell model.

Pattern confidence values are review hints, not calibrated accuracy measurements. Word pages are not inferred from XML.

The PDF reader is loaded on demand with a bundled local worker. Its geometry layer clusters text and merges overlapping border strokes before constructing table grids. A reconstruction adapter feeds common minutes structures into the canonical importer and maps resulting anchors back to PDF pages and source grids. All page text and positions remain in evidence, including text that could not be classified. Page previews use the staged File object; the original PDF is not persisted.

PDF extraction and reconstruction have file, page, text, operator and grid limits. Password entry is not included. PDF JavaScript, attachments and external links are not executed by the review interface.

Phase 6.4 adds an on-demand Tesseract worker for English printed scans. Generated worker, core and language assets use explicit same-origin paths, including the GitHub Pages base path. No remote OCR API or default engine CDN is used. OCR ranges are bounded to ten pages and rasterization to 2,200 pixels per side. Workers process pages sequentially and terminate on success, failure or cancellation; staged source image URLs are revoked on unmount.

Raster borders and OCR word coordinates feed the existing geometry layer, retaining reconstructed grids, hierarchy and original recognition evidence. Each OCR page records raw text, engine confidence and review state, with an optional corrected transcript stored separately. Transcript changes never regenerate or discard structured items; reviewers correct those using the import workbench. Approval checks every OCR page acknowledgement. Source bytes are not persisted, while evidence and corrections are included in local JSON backups.
