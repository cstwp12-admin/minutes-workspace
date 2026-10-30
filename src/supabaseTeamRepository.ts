import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { MeetingDocument } from './model'
import { TeamConflict, validateSharedDocument, validateTeamConnection, type SharedMeeting, type TeamConnection, type TeamRepository, type TeamRole } from './teamRepository'

// The SDK is imported only after the user explicitly connects from Team workspaces.
export function createSupabaseTeamRepository(connection:TeamConnection):TeamRepository{
  const config=validateTeamConnection(connection)
  const client=createClient(config.url,config.key,{auth:{persistSession:false,detectSessionInUrl:false,autoRefreshToken:true}})
  return new SupabaseTeamRepository(client)
}
export class SupabaseTeamRepository implements TeamRepository {
  constructor(private client:SupabaseClient){}
  dispose(){this.client.auth.stopAutoRefresh()}
  private check(error:{message:string;code?:string}|null){if(error){if(['40001','23505'].includes(error.code??''))throw new TeamConflict();throw new Error(error.message)}}
  async signIn(email:string,password:string){const {error}=await this.client.auth.signInWithPassword({email,password});this.check(error)}
  async signOut(){const {error}=await this.client.auth.signOut({scope:'local'});this.check(error)}
  async workspaces(){
    const {data,error}=await this.client.from('mw_workspaces').select('id,name,mw_members!inner(role,user_id)');this.check(error)
    const {data:auth,error:authError}=await this.client.auth.getUser();this.check(authError)
    return (data??[]).map(row=>({id:row.id as string,name:row.name as string,role:(row.mw_members as {role:TeamRole;user_id:string}[]).find(member=>member.user_id===auth.user?.id)?.role??'viewer' as TeamRole}))
  }
  async createWorkspace(name:string){const {data,error}=await this.client.rpc('mw_create_workspace',{p_name:name});this.check(error);return data as string}
  async members(workspace:string){const {data,error}=await this.client.from('mw_members').select('user_id,label,role').eq('workspace_id',workspace);this.check(error);return data??[]}
  async addMember(workspace:string,email:string,role:'editor'|'viewer'){const {error}=await this.client.rpc('mw_add_member',{p_workspace:workspace,p_email:email,p_role:role});this.check(error)}
  async removeMember(workspace:string,user:string){const {error}=await this.client.rpc('mw_remove_member',{p_workspace:workspace,p_user:user});this.check(error)}
  async meetings(workspace:string){const {data,error}=await this.client.from('mw_meetings').select('id,workspace_id,document,version,updated_at').eq('workspace_id',workspace).order('updated_at',{ascending:false});this.check(error);for(const row of data??[])validateSharedDocument(row.document);return (data??[]) as SharedMeeting[]}
  async save(workspace:string,document:MeetingDocument,expectedVersion:number){
    validateSharedDocument(document)
    const {data,error}=await this.client.rpc('mw_save_meeting',{p_workspace:workspace,p_id:document.id,p_expected_version:expectedVersion,p_document:document});this.check(error)
    const saved=data as SharedMeeting;validateSharedDocument(saved.document);return saved
  }
}
