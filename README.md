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

- Browser-local DOCX and searchable PDF import with source evidence, editable staging and explicit approval into a new meeting
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

Choose **Import DOCX / PDF** in the meeting library or **Import review** in a meeting. Review the extracted details, source evidence and item hierarchy; correct text, references, owners and deadlines; remove or add inferred actions. Acknowledge the review and approve to save a separate meeting. Original meetings are not replaced.

The importer reads explicit numbered rows from common minutes tables. Unmatched tables and body paragraphs remain in source evidence. Automatic Word list numbering, unusual layouts and ambiguous rows require review. Images, original pagination, headers and footers are not reproduced. Retain the original file for visual comparison. Uploaded files are limited to 15 MB, document XML to 8 MB, and deeply nested or oversized tables are rejected.

## Searchable PDF import

PDFs are read locally with a bundled PDF.js worker. Drawn borders and text coordinates are used to reconstruct ruled tables, minute rows, owners, statuses and technical grids. Repeated headers and cross-page continuations are retained where recognized. Separate action registers are matched only by an exact, unique minute reference.

The staged review includes the original PDF page rendered on a canvas and a page selector. Extracted text, coordinates and reconstructed grids remain in saved source evidence; original PDF bytes and page images are not stored with the meeting. Keep the original file for later visual comparison.

Limits are 15 MB and 100 pages. Password-protected and invalid PDFs are rejected. Scanned-only PDFs need OCR, which is not implemented; mixed documents import their searchable content and warn about pages without text. Unruled layouts, unusual headers, repeated item references and complex technical grids need manual correction. Reconstructed tables are not a guarantee of the original cell structure.
