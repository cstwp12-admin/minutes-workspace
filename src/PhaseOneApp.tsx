import { useCallback, useEffect, useState } from 'react'
import App from './App'
import { Dashboard } from './Dashboard'
import { publicAppConfig } from './config'
import { createBlankMeeting, duplicateMeeting, listMeetings, saveMeeting, saveMeetings } from './meetingRepository'
import type { MeetingDocument } from './model'

export default function PhaseOneApp(){
  const [meetings,setMeetings]=useState<MeetingDocument[]>([]),[selected,setSelected]=useState<MeetingDocument>(),[ready,setReady]=useState(false),[notice,setNotice]=useState('')
  useEffect(()=>{listMeetings().then(setMeetings).finally(()=>setReady(true))},[])
  const persist=useCallback((meeting:MeetingDocument)=>{setMeetings(all=>all.map(m=>m.id===meeting.id?meeting:m));void saveMeeting(meeting)},[])
  const create=()=>{const meeting=createBlankMeeting();setMeetings(all=>[meeting,...all]);void saveMeeting(meeting);setSelected(meeting)}
  const duplicate=(source:MeetingDocument)=>{const meeting=duplicateMeeting(source);setMeetings(all=>[meeting,...all]);void saveMeeting(meeting);setNotice('Meeting duplicated')}
  const archive=(source:MeetingDocument)=>{const meeting={...source,archivedAt:new Date().toISOString(),updatedAt:new Date().toISOString()};persist(meeting);setNotice('Meeting archived')}
  const restore=(source:MeetingDocument)=>{const meeting={...source,archivedAt:undefined,updatedAt:new Date().toISOString()};persist(meeting);setNotice('Meeting restored')}
  const backup=()=>{const blob=new Blob([JSON.stringify({schemaVersion:1,exportedAt:new Date().toISOString(),meetings},null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='minutes-workspace-backup.json';a.click();URL.revokeObjectURL(a.href);setNotice('Backup downloaded')}
  const importBackup=async(file:File)=>{try{const parsed=JSON.parse(await file.text());if(!Array.isArray(parsed.meetings))throw new Error();await saveMeetings(parsed.meetings);setMeetings(parsed.meetings);setNotice(`${parsed.meetings.length} meetings restored`)}catch{setNotice('This backup could not be restored')}}
  if(!ready)return <main className="loading-screen"><span className="brand-mark">MW</span><p>Opening your meeting library…</p></main>
  if(selected)return <App key={selected.id} initialMeeting={selected} onMeetingChange={persist} onBack={()=>setSelected(undefined)}/>
  return <div className="app"><a className="skip-link" href="#main-content">Skip to meetings</a><header className="dashboard-topbar"><div className="brand"><span className="brand-mark">MW</span><div><strong>{publicAppConfig.productName}</strong><small>{publicAppConfig.productTagline}</small></div></div><span className="storage-pill">Browser-local preview</span></header><Dashboard meetings={meetings} onOpen={setSelected} onCreate={create} onDuplicate={duplicate} onArchive={archive} onRestore={restore} onBackup={backup} onImport={importBackup}/>{notice&&<div className="toast" role="status" onAnimationEnd={()=>setNotice('')}>{notice}</div>}</div>
}
