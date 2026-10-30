import type { SupabaseClient } from '@supabase/supabase-js'
import { SupabaseTeamRepository } from './supabaseTeamRepository'
import { TeamConflict } from './teamRepository'
import { sampleMeeting } from './fixtures'

test('sends scoped document versions to the atomic save RPC and reports conflicts',async()=>{
  const meeting={...structuredClone(sampleMeeting),id:crypto.randomUUID()}
  const rpc=vi.fn().mockResolvedValueOnce({data:{id:meeting.id,workspace_id:'team-one',document:meeting,version:4},error:null}).mockResolvedValueOnce({data:null,error:{code:'40001',message:'Meeting version conflict'}})
  const repo=new SupabaseTeamRepository({rpc} as unknown as SupabaseClient)
  const saved=await repo.save('team-one',meeting,3)
  expect(saved.version).toBe(4)
  expect(rpc).toHaveBeenCalledWith('mw_save_meeting',{p_workspace:'team-one',p_id:meeting.id,p_expected_version:3,p_document:meeting})
  await expect(repo.save('team-one',meeting,3)).rejects.toBeInstanceOf(TeamConflict)
})
test('rejects oversized shared records before making any network request',async()=>{
  const rpc=vi.fn(),repo=new SupabaseTeamRepository({rpc} as unknown as SupabaseClient)
  await expect(repo.save('team-one',{...sampleMeeting,title:'x'.repeat(8_000_001)},1)).rejects.toThrow('8 MB')
  expect(rpc).not.toHaveBeenCalled()
})
