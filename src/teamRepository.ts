import type { MeetingDocument } from './model'

export type TeamRole='owner'|'editor'|'viewer'
export interface TeamWorkspace {id:string;name:string;role:TeamRole}
export interface TeamMember {user_id:string;label:string;role:TeamRole}
export interface SharedMeeting {id:string;workspace_id:string;document:MeetingDocument;version:number;updated_at:string}
export interface TeamRepository {
  workspaces():Promise<TeamWorkspace[]>
  createWorkspace(name:string):Promise<string>
  members(workspace:string):Promise<TeamMember[]>
  addMember(workspace:string,email:string,role:'editor'|'viewer'):Promise<void>
  removeMember(workspace:string,user:string):Promise<void>
  meetings(workspace:string):Promise<SharedMeeting[]>
  save(workspace:string,document:MeetingDocument,expectedVersion:number):Promise<SharedMeeting>
  signIn(email:string,password:string):Promise<void>
  signOut():Promise<void>
  dispose():void
}
export const canEditTeam=(role:TeamRole)=>role==='owner'||role==='editor'
export class TeamConflict extends Error {constructor(){super('This meeting changed on the server. Your edits are retained. Reload the team version or save your edits as a separate meeting.')}}
export interface TeamConnection {url:string;key:string}
export function validateTeamConnection(value:TeamConnection):TeamConnection{
  const url=new URL(value.url.trim())
  if(url.protocol!=='https:'||! /^[a-z0-9-]+\.supabase\.co$/i.test(url.hostname)||url.username||url.password||url.search||url.hash||!['','/'].includes(url.pathname))throw new Error('Enter your HTTPS Supabase project URL, such as https://project-id.supabase.co.')
  const key=value.key.trim()
  let allowed=/^sb_publishable_[a-zA-Z0-9_-]{10,}$/.test(key)
  if(!allowed)try{allowed=JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).role==='anon'}catch{allowed=false}
  if(!allowed)throw new Error('Use the publishable key or legacy anon key. Administrative keys cannot be used in this app.')
  return {url:url.origin,key}
}
export function validateSharedDocument(value:unknown):asserts value is MeetingDocument{
  if(!value||typeof value!=='object')throw new Error('Invalid shared meeting document.')
  const m=value as MeetingDocument
  if(typeof m.id!=='string'||typeof m.title!=='string'||!Array.isArray(m.items)||!m.items.some(item=>item.type==='minute')||m.items.some(item=>typeof item.id!=='string'||typeof item.itemRef!=='string'||typeof item.title!=='string'||!Array.isArray(item.blocks)||!item.source))throw new Error('Shared meetings need a title, structured items and at least one minute.')
  if(new TextEncoder().encode(JSON.stringify(value)).byteLength>8_000_000)throw new Error('Shared meeting data exceeds 8 MB. Reduce source evidence or use a local backup.')
}
