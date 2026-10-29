# Minutes Workspace

A reusable React/TypeScript/Vite meeting-minutes workspace for individuals and teams. The public demo uses entirely fictional names and content; it contains no customer names, project identifiers, logos, or source documents.

## Run locally

```powershell
pnpm install
pnpm dev
```

## Verify

```powershell
pnpm test
pnpm build
```

## Included MVP flow

- Browser-local DOCX import with table/row evidence, editable staging and explicit approval into a new meeting
- Metadata, attendance, numbered agenda and suggested action extraction
- Nested technical tables with horizontal and vertical cell spans retained in preview and Word re-export
- Hierarchical minute references stored as text
- Secretary/editor and presenter modes
- Editable owner, deadline, action, and status fields
- Linked action register
- Embedded technical metric-table block
- Editable Word, browser print/PDF, standalone HTML, action CSV and JSON backups
- Eight document templates, readiness checks, final issue snapshots and amendment comparison
- Domain model kept independent from UI state for later Supabase repositories, audit events, and presence
- GitHub Pages deployment workflow

The included Northstar programme is fictional demonstration data. Real documents stay local to the user's browser in this MVP.

## DOCX import

Choose **Import DOCX** in the meeting library or **Import review** in a meeting. Review the extracted details, source evidence and item hierarchy; correct text, references, owners and deadlines; remove or add inferred actions. Acknowledge the review and approve to save a separate meeting. Original meetings are not replaced.

The importer reads explicit numbered rows from common minutes tables. Unmatched tables and body paragraphs remain in source evidence. Automatic Word list numbering, unusual layouts and ambiguous rows require review. Images, original pagination, headers and footers are not reproduced. Retain the original file for visual comparison. Uploaded files are limited to 15 MB, document XML to 8 MB, and deeply nested or oversized tables are rejected.

PDF parsing and OCR are not implemented yet. The upload control currently accepts DOCX only.
