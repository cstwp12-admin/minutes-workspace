import { render,screen,waitFor,within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TeamWorkspace } from './TeamWorkspace'
import { sampleMeeting } from './fixtures'
import { TeamConflict,validateTeamConnection, type SharedMeeting, type TeamRepository, type TeamRole } from './teamRepository'

const row=():SharedMeeting=>({id:'20000000-0000-4000-8000-000000000001',workspace_id:'fictional-workspace',version:1,updated_at:'2026-10-31T00:00:00Z',document:{...structuredClone(sampleMeeting),id:'20000000-0000-4000-8000-000000000001'}})
function service(role:TeamRole='editor'){
  const repo:TeamRepository={workspaces:vi.fn(async()=>[{id:'fictional-workspace',name:'Fictional team',role}]),createWorkspace:vi.fn(async()=> 'new-workspace'),members:vi.fn(async()=>[]),addMember:vi.fn(async()=>{}),removeMember:vi.fn(async()=>{}),meetings:vi.fn(async()=>[row()]),save:vi.fn(async(_workspace,document,version)=>({...row(),document:structuredClone(document),version:version+1})),signIn:vi.fn(async()=>{}),signOut:vi.fn(async()=>{}),dispose:vi.fn()}
  return repo
}
const setup=async(repo:TeamRepository)=>{
  const user=userEvent.setup(),factory=vi.fn(async()=>repo)
  render(<TeamWorkspace localMeetings={[sampleMeeting]} onBack={vi.fn()} factory={factory}/>)
  await user.type(screen.getByLabelText('Project URL'),'https://fictional-team.supabase.co')
  await user.type(screen.getByLabelText('Publishable or legacy anon key'),'sb_publishable_fictional_123456')
  await user.click(screen.getByRole('button',{name:'Connect project'}))
  await user.type(await screen.findByLabelText('Email'),'editor@example.test');await user.type(screen.getByLabelText('Password'),'fictional-password')
  await user.click(screen.getByRole('button',{name:'Sign in'}))
  await user.selectOptions(await screen.findByLabelText('Team workspace'),'fictional-workspace')
  await screen.findByText('Fictional team',{selector:'h2'})
  return {user,factory}
}
test('does not connect or upload local records on entry and rejects administrative keys',async()=>{
  const factory=vi.fn();render(<TeamWorkspace localMeetings={[sampleMeeting]} onBack={()=>{}} factory={factory}/> )
  expect(screen.getByText(/Team collaboration is not connected/)).toBeInTheDocument()
  expect(factory).not.toHaveBeenCalled()
  expect(()=>validateTeamConnection({url:'http://fictional-team.supabase.co',key:'sb_publishable_fictional_123456'})).toThrow('HTTPS')
  expect(()=>validateTeamConnection({url:'https://fictional-team.supabase.co',key:'sb_secret_fictional'})).toThrow('Administrative')
  const serviceKey=`e30.${btoa(JSON.stringify({role:'service_role'}))}.signature`
  expect(()=>validateTeamConnection({url:'https://fictional-team.supabase.co',key:serviceKey})).toThrow('Administrative')
})
test('shares an explicit separate copy and leaves the local meeting unchanged',async()=>{
  const repo=service(),{user}=await setup(repo),original=structuredClone(sampleMeeting)
  expect(repo.save).not.toHaveBeenCalled()
  await user.selectOptions(screen.getByLabelText('Local meeting to share'),sampleMeeting.id)
  await user.click(screen.getByRole('button',{name:'Share a separate copy with this team'}))
  await waitFor(()=>expect(repo.save).toHaveBeenCalledTimes(1))
  const args=vi.mocked(repo.save).mock.calls[0]
  expect(args[0]).toBe('fictional-workspace');expect(args[2]).toBe(0)
  expect(args[1].id).not.toBe(sampleMeeting.id);expect(args[1].items).toEqual(sampleMeeting.items)
  expect(sampleMeeting).toEqual(original)
})
test('retains dirty edits on a save conflict and saves a separate recovery copy',async()=>{
  const repo=service(),{user}=await setup(repo)
  vi.mocked(repo.save).mockRejectedValueOnce(new TeamConflict())
  await user.click(await screen.findByRole('button',{name:'Open shared meeting'}))
  expect(repo.save).not.toHaveBeenCalled()
  const owner=screen.getByLabelText('Action by');await user.clear(owner);await user.type(owner,'Changed team owner')
  const save=screen.getByRole('button',{name:'Save to team'});await waitFor(()=>expect(save).toBeEnabled())
  expect(repo.save).not.toHaveBeenCalled()
  await user.click(save)
  await screen.findByRole('alert')
  expect(screen.getByLabelText('Action by')).toHaveValue('Changed team owner')
  expect(vi.mocked(repo.save).mock.calls[0][2]).toBe(1)
  await user.click(screen.getByRole('button',{name:'Save edits as separate team meeting'}))
  await waitFor(()=>expect(repo.save).toHaveBeenCalledTimes(2))
  expect(vi.mocked(repo.save).mock.calls[1][2]).toBe(0)
  expect(vi.mocked(repo.save).mock.calls[1][1].id).not.toBe(row().id)
})
test('viewer access allows presentation and export but does not expose editing or sharing',async()=>{
  const repo=service('viewer'),{user}=await setup(repo)
  expect(screen.queryByRole('button',{name:'New team meeting'})).not.toBeInTheDocument()
  await user.click(await screen.findByRole('button',{name:'View shared meeting'}))
  expect(screen.queryByRole('button',{name:'Save to team'})).not.toBeInTheDocument()
  expect(screen.queryByRole('button',{name:'Secretary'})).not.toBeInTheDocument()
  await user.click(within(screen.getByRole('navigation',{name:'Workspace views'})).getByRole('button',{name:'Export'}))
  expect(screen.getByLabelText('Document title')).toBeDisabled()
  expect(screen.getByRole('button',{name:'Editable Word'})).toBeEnabled()
  expect(repo.save).not.toHaveBeenCalled()
})
