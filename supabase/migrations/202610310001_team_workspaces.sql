-- Run once in a dedicated Supabase project's SQL editor. No secrets or sample data.
begin;
create table public.mw_workspaces (
  id uuid primary key default gen_random_uuid(), name text not null check(length(btrim(name)) between 1 and 150),
  created_by uuid not null references auth.users(id), created_at timestamptz not null default now()
);
create table public.mw_members (
  workspace_id uuid not null references public.mw_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null, role text not null check(role in ('owner','editor','viewer')),
  primary key(workspace_id,user_id)
);
create table public.mw_meetings (
  id uuid primary key, workspace_id uuid not null references public.mw_workspaces(id),
  document jsonb not null check(jsonb_typeof(document)='object' and document->>'id'=id::text and octet_length(document::text)<=8000000),
  version integer not null check(version>0), updated_by uuid not null references auth.users(id), updated_at timestamptz not null default now()
);
create index mw_meetings_workspace on public.mw_meetings(workspace_id,updated_at desc);
create table public.mw_events (
  id bigint generated always as identity primary key, workspace_id uuid not null references public.mw_workspaces(id),
  actor uuid not null references auth.users(id), action text not null, meeting_id uuid, version integer, at timestamptz not null default now()
);
alter table public.mw_workspaces enable row level security;
alter table public.mw_members enable row level security;
alter table public.mw_meetings enable row level security;
alter table public.mw_events enable row level security;
revoke all on public.mw_workspaces,public.mw_members,public.mw_meetings,public.mw_events from public,anon,authenticated;
grant select on public.mw_workspaces,public.mw_members,public.mw_meetings,public.mw_events to authenticated;

create function public.mw_role(p_workspace uuid) returns text language sql stable security definer set search_path='' as $$
  select role from public.mw_members where workspace_id=p_workspace and user_id=(select auth.uid())
$$;
revoke all on function public.mw_role(uuid) from public,anon;
grant execute on function public.mw_role(uuid) to authenticated;
create policy mw_workspace_read on public.mw_workspaces for select to authenticated using(public.mw_role(id) is not null);
create policy mw_members_read on public.mw_members for select to authenticated using(public.mw_role(workspace_id) is not null);
create policy mw_meetings_read on public.mw_meetings for select to authenticated using(public.mw_role(workspace_id) is not null);
create policy mw_events_read on public.mw_events for select to authenticated using(public.mw_role(workspace_id) is not null);

create function public.mw_create_workspace(p_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; actor uuid:=auth.uid();
begin
  if actor is null then raise exception 'Sign in first.' using errcode='42501'; end if;
  insert into public.mw_workspaces(name,created_by) values(btrim(p_name),actor) returning id into result;
  insert into public.mw_members(workspace_id,user_id,label,role) values(result,actor,coalesce(auth.jwt()->>'email','Owner'),'owner');
  insert into public.mw_events(workspace_id,actor,action) values(result,actor,'Created workspace');
  return result;
end $$;
create function public.mw_add_member(p_workspace uuid,p_email text,p_role text) returns void language plpgsql security definer set search_path='' as $$
declare member_id uuid;
begin
  if public.mw_role(p_workspace) is distinct from 'owner' then raise exception 'Only the workspace owner can manage members.' using errcode='42501'; end if;
  if p_role not in ('editor','viewer') then raise exception 'Choose editor or viewer.'; end if;
  select id into member_id from auth.users where lower(email)=lower(btrim(p_email)) and email_confirmed_at is not null limit 1;
  if member_id is null then raise exception 'This person needs a confirmed account in this Supabase project first.'; end if;
  if exists(select 1 from public.mw_members where workspace_id=p_workspace and user_id=member_id and role='owner') then raise exception 'The owner role cannot be changed here.'; end if;
  insert into public.mw_members(workspace_id,user_id,label,role) values(p_workspace,member_id,btrim(p_email),p_role)
    on conflict(workspace_id,user_id) do update set role=excluded.role,label=excluded.label;
  insert into public.mw_events(workspace_id,actor,action) values(p_workspace,auth.uid(),'Added or updated member');
end $$;
create function public.mw_remove_member(p_workspace uuid,p_user uuid) returns void language plpgsql security definer set search_path='' as $$
begin
  if public.mw_role(p_workspace) is distinct from 'owner' then raise exception 'Only the workspace owner can manage members.' using errcode='42501'; end if;
  delete from public.mw_members where workspace_id=p_workspace and user_id=p_user and role<>'owner';
  if not found then raise exception 'Member not found or is the owner.'; end if;
  insert into public.mw_events(workspace_id,actor,action) values(p_workspace,auth.uid(),'Removed member');
end $$;
create function public.mw_save_meeting(p_workspace uuid,p_id uuid,p_expected_version integer,p_document jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare previous public.mw_meetings; saved public.mw_meetings;
begin
  if coalesce(public.mw_role(p_workspace),'') not in ('owner','editor') then raise exception 'Editor access is required.' using errcode='42501'; end if;
  if p_expected_version is null or p_expected_version<0 then raise exception 'An expected version is required.'; end if;
  if p_document ? 'finalIssues' and jsonb_typeof(p_document->'finalIssues') is distinct from 'array' then raise exception 'Invalid final issue history.'; end if;
  if jsonb_typeof(p_document->'items') is distinct from 'array' or jsonb_array_length(p_document->'items')=0 or jsonb_typeof(p_document->'title') is distinct from 'string' then raise exception 'Invalid meeting document.'; end if;
  if p_expected_version=0 then
    insert into public.mw_meetings(id,workspace_id,document,version,updated_by) values(p_id,p_workspace,p_document,1,auth.uid()) on conflict(id) do nothing returning * into saved;
    if not found then raise exception 'Meeting version conflict.' using errcode='40001'; end if;
  else
    select * into previous from public.mw_meetings where id=p_id and workspace_id=p_workspace for update;
    if not found or previous.version<>p_expected_version then raise exception 'Meeting version conflict.' using errcode='40001'; end if;
    if previous.document->>'lifecycle'='finalized' and (p_document->>'lifecycle' is distinct from 'draft_minutes' or (p_document->>'revision')::integer is distinct from coalesce((previous.document->>'revision')::integer,1)+1) then raise exception 'Create an amendment before editing a final issue.'; end if;
    if exists(select 1 from jsonb_array_elements(coalesce(previous.document->'finalIssues','[]'::jsonb)) with ordinality as history(value,position) where (p_document->'finalIssues'->(history.position::integer-1)) is distinct from history.value) then raise exception 'Saved final issues must be preserved in order.'; end if;
    if previous.document->>'lifecycle'='finalized' and jsonb_array_length(coalesce(previous.document->'finalIssues','[]'::jsonb))=0 and (p_document->'finalIssues'->0->'record') is distinct from (previous.document-'finalIssues') then raise exception 'Preserve the legacy final issue before amendment.'; end if;
    update public.mw_meetings set document=p_document,version=version+1,updated_by=auth.uid(),updated_at=now() where id=p_id returning * into saved;
  end if;
  insert into public.mw_events(workspace_id,actor,action,meeting_id,version) values(p_workspace,auth.uid(),'Saved meeting',p_id,saved.version);
  return to_jsonb(saved);
end $$;
revoke all on function public.mw_create_workspace(text),public.mw_add_member(uuid,text,text),public.mw_remove_member(uuid,uuid),public.mw_save_meeting(uuid,uuid,integer,jsonb) from public,anon;
grant execute on function public.mw_create_workspace(text),public.mw_add_member(uuid,text,text),public.mw_remove_member(uuid,uuid),public.mw_save_meeting(uuid,uuid,integer,jsonb) to authenticated;
commit;
