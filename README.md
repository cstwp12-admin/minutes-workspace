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

- Browser-local DOCX, searchable/scanned PDF and PNG/JPEG import with source evidence, editable staging and explicit approval into a new meeting
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

The importer reads explicit numbered rows and common automatic Word list numbering, including inherited paragraph styles, decimal levels, letter and Roman labels, start overrides and restarts. Unsupported numbering formats, unusual layouts and ambiguous rows remain flagged for review. Repeated inferred list labels receive a temporary unique suffix and retain their original list text in source evidence. Images, original pagination, headers and footers are not reproduced. Retain the original file for visual comparison. Uploaded files are limited to 15 MB, document XML to 8 MB, numbering to 1 MB, and styles to 2 MB.

## Personal templates

In **Export**, open **Customize layout & personal templates** to edit the reference, discussion, owner and status column labels, minutes heading, decision/action labels, attendance/distribution/approval visibility, and document section order. Minutes remain required; action and decision summary switches control those optional sections. The preview, standalone HTML, browser print/PDF and editable Word output use the same saved layout settings.

Use **Save as personal template** to keep a copy in this browser (up to 20). Apply it to another meeting from **Saved personal template**, or update a selected library template from the current layout. Each meeting keeps its own layout snapshot: updating a library template does not change previous meetings or saved final issues. Finalized issues keep layout controls locked until an amendment is created.

Organization name, logo and distribution are included only when explicitly selected. Project names and meeting references are excluded from reusable templates. **Export personal templates** downloads a separate JSON backup; restoring it adds validated copies rather than replacing existing templates. Meeting backups retain the layout applied to that meeting, but do not include the entire personal library. Templates and backups may contain private organization settings; no personal templates are bundled in the public repository. Browser storage failure is reported without claiming a successful save. Existing Word-template file import and visual Word pagination verification remain outstanding.

## Import correction tools

- Use **Correct item boundaries and order** to move an item with its children, split between content blocks, or merge with the preceding minute. Splitting keeps an existing action on the first item; merging refuses to discard either of two actions.
- Change **Parent item** to correct nesting. Descendant depths update together.
- Use **Map source columns or attach continuation rows** to choose a source table, row range and field columns. Rebuild that table’s reconstructed items, append mapped items, or attach the raw rows to the selected minute.
- **Undo correction** restores the previous draft, including technical content and hierarchy, for the latest 20 edits. This history exists during the current staged review.
- Approval requires unique non-empty references, item titles and valid parent order. Inferred actions and dates still need human review. Source evidence is retained separately from these corrections.

## Searchable PDF import

PDFs are read locally with a bundled PDF.js worker. Drawn borders and text coordinates are used to reconstruct ruled tables, minute rows, owners, statuses and technical grids. Repeated headers and cross-page continuations are retained where recognized. Separate action registers are matched only by an exact, unique minute reference.

The staged review includes the original PDF page rendered on a canvas and a page selector. Extracted text, coordinates and reconstructed grids remain in saved source evidence; original PDF bytes and page images are not stored with the meeting. Keep the original file for later visual comparison.

Limits are 15 MB and 100 pages. Password-protected and invalid PDFs are rejected. Enable scanned PDF OCR to recognize image pages, or choose OCR for every selected page to replace an unreliable text layer. Unruled layouts, unusual headers, repeated item references and complex technical grids need manual correction. Reconstructed tables are not a guarantee of the original cell structure.

## Scanned PDFs and meeting images · Phase 6.4

- English printed text recognition using Tesseract.js. PNG/JPEG images automatically use OCR; PDFs require the OCR option. Upright, sharp scans work best; handwriting and rotated or complex layouts are not reliable.
- OCR imports are limited to 10 selected PDF pages, 15 MB per file and 40 megapixels per image. Set first/last PDF page before selecting the file. Blank last page means document end. Pages outside the selected range are explicitly excluded.
- Recognition renders at up to 2,200 pixels on the longest side. Long dark borders and word positions feed the same table reconstruction and nested item review used by searchable PDFs. Check every technical value, merged cell and nested reference against the original preview.
- Review each page's engine confidence and editable transcript. Saving a transcript retains the original OCR text separately and resets that page's review acknowledgement. Transcript corrections do not automatically replace structured minutes: use the existing item, source column and technical table correction tools. Every recognized page needs acknowledgement before approval.
- Cancel stops an import without creating a meeting. The original PDF/image is available during staging only; retain it separately. Backups include recognition evidence and corrected transcripts, so treat backup files as private meeting data.
- Worker, WASM cores and English language data are copied from installed packages into generated `public/ocr/` assets by the dev/build commands. GitHub Pages serves these assets from the app's own origin. No document is uploaded to an OCR service. Initial recognition needs network access to download the engine and roughly 11 MB of compressed English data; offline OCR is not guaranteed.
