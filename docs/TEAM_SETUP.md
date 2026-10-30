# Optional team workspaces · Phase 7.1

Team mode is available from **Team workspaces** on the individual dashboard. It is disconnected until an administrator prepares a Supabase project and a user explicitly connects. No project connection, account creation or document upload is performed just by visiting the site. Existing individual meetings and templates remain browser-local.

## Administrator setup

1. Create a dedicated Supabase project. Open its SQL editor and run `supabase/migrations/202610310001_team_workspaces.sql` once. The migration creates four `mw_` tables, read policies and permission-checked write functions. It contains no private documents or live configuration. Do not rerun it over an existing installation without a reviewed upgrade migration.
2. Enable email/password authentication and provision confirmed accounts for the owner and team members using Supabase's administrator tools. This increment signs in existing accounts; signup, email invitations and password recovery are managed outside the app.
3. Get the project's HTTPS `https://project-id.supabase.co` URL and publishable key (or legacy anon key). Never use an administrative/service key in the browser. Custom auth domains and self-hosted endpoints are not supported by the current connection form.
4. In the app, choose **Team workspaces**, enter that URL and public key, and select **Connect project**. Sign in with a confirmed account. Create a workspace; the creator becomes its owner. Owners can add existing confirmed users by email and select editor or viewer access.

The app does not use `.env` Supabase values yet: connection settings and authenticated sessions are kept in memory for this visit. Refreshing or leaving team mode requires reconnecting and signing in. Nothing needs to be added to the public repository to connect a private team project.

These setup choices follow the official [Supabase password authentication](https://supabase.com/docs/guides/auth/passwords), [row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security), and [database function](https://supabase.com/docs/guides/database/functions) guidance.

## Work with shared minutes

- Choose a workspace to see its meetings. Create a new team meeting, or choose a local meeting and **Share a separate copy with this team**. Sharing uploads the selected record, including its evidence, branding, participants and saved issues, to the configured Supabase project. The original local meeting is not moved or overwritten. There is no background upload of your library.
- Owners and editors can edit and finalize minutes using the existing workspace views. **Save to team** explicitly publishes changes. Approving a document import while editing a team meeting creates a new shared meeting. Viewers can present, read and export, with document settings locked.
- Team meeting lists refresh every 15 seconds while the selected workspace is open. Refreshing a list never replaces an open draft. **Reload team version** explicitly opens the latest saved record. Saving sends the version that was originally opened; the database rejects a stale version rather than overwriting another person's changes.
- On conflict, your draft stays open. Download it, explicitly discard it to reload the current version, or save a separate recovery meeting. No automatic field merge or offline upload queue is provided. Unsaved drafts are in memory: download a backup before closing or refreshing the browser if a save cannot finish.
- Shared JSON records are bounded to 8 MB, including source evidence and final issue history. This is separate from the unchanged document import limits. Source PDF/image bytes are not uploaded or persisted by the parser.
- Local personal templates stay local. A layout applied to a shared meeting travels with that meeting's export profile snapshot. Template library backups and all meeting exports may contain private runtime data.

## Permission boundaries

All four tables enable RLS. Anonymous clients have no table access. Authenticated users have only SELECT grants, restricted to workspace membership. Direct inserts, updates and deletes are not granted. Security-definer mutation functions set an empty search path and check `auth.uid()` plus membership on every operation; roles are not taken from editable user metadata or the meeting JSON.

Owners manage membership; editors and owners can save records; viewers cannot save. Owners cannot remove or demote themselves through these functions. Writes to an existing meeting take a row lock and compare its expected version. A final issue requires a new amendment revision before editing. Existing saved issue history must remain unchanged and in order. Successful writes append a server-owned audit event; client-provided meeting audit notes are not a substitute for that record.

The migration and real Postgres permission behavior are exercised locally using PGlite, including anonymous denial, cross-workspace isolation, viewer denial, stale-version rejection, membership revocation, sealed finals and immutable history. Browser tests use a fictional repository to exercise sharing, recovery and viewer controls. Live Supabase Auth/PostgREST integration must still be verified after a real project is connected; no live project was provisioned or tested in this increment.

## Remaining Phase 7 increments

Self-service onboarding/invitations, account recovery, separate reviewer/approver roles, server-side readiness enforcement for formal approvals, shared cursor/presence and real-time delivery, richer field-level conflict resolution, and server-managed attachment storage remain future work. Team comments currently use the existing editor review workflow and the same versioned document save.
