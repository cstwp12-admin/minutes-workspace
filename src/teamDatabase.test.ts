// @vitest-environment node
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { sampleMeeting } from './fixtures'

const owner='10000000-0000-4000-8000-000000000001',editor='10000000-0000-4000-8000-000000000002',viewer='10000000-0000-4000-8000-000000000003',outsider='10000000-0000-4000-8000-000000000004'
let db:PGlite,workspace:string,otherWorkspace:string,meetingId:string
const login=async(user:string,role='authenticated')=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[user,JSON.stringify({sub:user,email:'owner@example.test'})]);await db.exec(`set role ${role}`)}
const save=(workspaceId:string,id:string,version:number|null,document:unknown)=>db.query<{record:unknown}>('select public.mw_save_meeting($1::uuid,$2::uuid,$3::integer,$4::jsonb) as record',[workspaceId,id,version,JSON.stringify(document)])
const document=(id:string)=>({...structuredClone(sampleMeeting),id})

beforeAll(async()=>{
  db=new PGlite()
  await db.exec(`create role anon;create role authenticated;create schema auth;grant usage on schema auth to anon,authenticated;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;`)
  for(const [id,email] of [[owner,'owner@example.test'],[editor,'editor@example.test'],[viewer,'viewer@example.test'],[outsider,'outsider@example.test']])await db.query('insert into auth.users values($1,$2,now())',[id,email])
  await db.exec(readFileSync(new URL('../supabase/migrations/202610310001_team_workspaces.sql',import.meta.url),'utf8'))
  await login(owner)
  workspace=(await db.query<{id:string}>("select public.mw_create_workspace('Fictional team') as id")).rows[0].id
  await db.query("select public.mw_add_member($1,'editor@example.test','editor'),public.mw_add_member($1,'viewer@example.test','viewer')",[workspace])
  meetingId=crypto.randomUUID();await save(workspace,meetingId,0,document(meetingId))
  await login(outsider);otherWorkspace=(await db.query<{id:string}>("select public.mw_create_workspace('Other team') as id")).rows[0].id
},120000)
afterAll(async()=>{await db?.close()})

test('isolates workspaces and rejects anonymous access and direct table writes',async()=>{
  await login(viewer)
  expect((await db.query('select * from public.mw_workspaces')).rows).toHaveLength(1)
  expect((await db.query('select * from public.mw_meetings')).rows).toHaveLength(1)
  expect((await db.query('select * from public.mw_workspaces where id=$1',[otherWorkspace])).rows).toHaveLength(0)
  await expect(db.query("update public.mw_members set role='owner' where user_id=$1",[viewer])).rejects.toThrow(/permission denied/i)
  await expect(save(workspace,meetingId,1,document(meetingId))).rejects.toThrow('Editor access')
  await expect(db.query("select public.mw_add_member($1,'outsider@example.test','editor')",[workspace])).rejects.toThrow('Only the workspace owner')
  await login('', 'anon')
  await expect(db.query('select * from public.mw_meetings')).rejects.toThrow(/permission denied/i)
  await expect(save(workspace,meetingId,1,document(meetingId))).rejects.toThrow(/permission denied/i)
})
test('requires membership and rejects stale or missing expected versions',async()=>{
  await login(outsider)
  await expect(save(workspace,meetingId,1,document(meetingId))).rejects.toThrow('Editor access')
  await login(editor)
  const result=await save(workspace,meetingId,1,{...document(meetingId),title:'Updated by editor'})
  expect(result.rows[0].record).toMatchObject({version:2})
  await expect(save(workspace,meetingId,1,{...document(meetingId),title:'Stale overwrite'})).rejects.toThrow('version conflict')
  await expect(save(workspace,meetingId,null,document(meetingId))).rejects.toThrow('expected version')
  const rows=await db.query<{document:{title:string}}>('select document from public.mw_meetings where id=$1',[meetingId])
  expect(rows.rows[0].document.title).toBe('Updated by editor')
})
test('preserves saved final issues and requires a new amendment revision',async()=>{
  await login(editor)
  const id=crypto.randomUUID(),record={...document(id),lifecycle:'finalized',revision:1},final={...record,finalIssues:[{revision:1,issuedAt:'2026-10-31T00:00:00Z',record}]}
  await save(workspace,id,0,final)
  await expect(save(workspace,id,1,{...final,title:'Changed sealed record'})).rejects.toThrow('amendment')
  await expect(save(workspace,id,1,{...final,lifecycle:undefined,revision:undefined})).rejects.toThrow('amendment')
  const amendment={...final,lifecycle:'draft_minutes',revision:2}
  await expect(save(workspace,id,1,{...amendment,finalIssues:[]})).rejects.toThrow('preserved')
  await expect(save(workspace,id,1,{...amendment,finalIssues:[{...final.finalIssues[0],record:{...record,title:'Tampered'}}]})).rejects.toThrow('preserved')
  expect((await save(workspace,id,1,amendment)).rows[0].record).toMatchObject({version:2})
  await expect(db.query('delete from public.mw_events')).rejects.toThrow(/permission denied/i)
})
test('owners can revoke access, while owner membership cannot be removed or downgraded',async()=>{
  await login(owner)
  await expect(db.query("select public.mw_add_member($1,'owner@example.test','viewer')",[workspace])).rejects.toThrow('owner role')
  await expect(db.query('select public.mw_remove_member($1,$2)',[workspace,owner])).rejects.toThrow('owner')
  await db.query('select public.mw_remove_member($1,$2)',[workspace,viewer])
  await login(viewer)
  expect((await db.query('select * from public.mw_meetings')).rows).toHaveLength(0)
})
