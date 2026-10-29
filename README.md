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

- Structured DOCX/PDF import-review shell with source anchors and confidence
- Hierarchical minute references stored as text
- Secretary/editor and presenter modes
- Editable owner, deadline, action, and status fields
- Linked action register
- Embedded technical metric-table block
- Canonical JSON export as the first deterministic export path
- Domain model kept independent from UI state for later Supabase repositories, audit events, and presence
- GitHub Pages deployment workflow

The included Northstar programme is fictional demonstration data. Real documents stay local to the user's browser in this MVP.
