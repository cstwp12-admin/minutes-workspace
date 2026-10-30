import { useEffect, useMemo, useState, type SetStateAction } from 'react'
import { Archive, ChevronLeft, ChevronRight, ClipboardCheck, ClipboardList, Download, FileCheck2, FileOutput, FileUp, LayoutDashboard, MonitorPlay, PanelLeft, Radio, Search, Users } from 'lucide-react'
import { sampleMeeting } from './fixtures'
import { publicAppConfig } from './config'
import { PreparationView } from './PreparationView'
import { LiveMeetingView } from './LiveMeetingView'
import { ReviewView } from './ReviewView'
import { ExportView } from './ExportView'
import { ImportReview } from './ImportReview'
import { TechnicalTable } from './TechnicalTable'
import { exportSnapshot, openActionCount, type MeetingDocument, type MinuteItem, type Status } from './model'

type View = 'prepare'|'live'|'review'|'import'|'editor'|'presenter'|'actions'|'export'
const statusClass = (s: Status) => `status status-${s.toLowerCase().replace(' ','-')}`

function App({initialMeeting=sampleMeeting,onMeetingChange,onBack,onImportMeeting,readOnly=false,saveDelay=250,allowImport=true}:{initialMeeting?:MeetingDocument;onMeetingChange?:(meeting:MeetingDocument)=>void;onBack?:()=>void;onImportMeeting?:(meeting:MeetingDocument)=>Promise<void>|void;readOnly?:boolean;saveDelay?:number;allowImport?:boolean}){
  const [meeting,setMeetingState]=useState<MeetingDocument>(initialMeeting)
  const setMeeting=(update:SetStateAction<MeetingDocument>)=>setMeetingState(previous=>{
    if(readOnly)return previous
    const next=typeof update==='function'?update(previous):update
    if(previous.lifecycle==='finalized' && !(next.lifecycle==='draft_minutes' && next.revision===(previous.revision??1)+1)) return previous
    return next
  })
  const [view,setView]=useState<View>(readOnly?'presenter':'editor')
  const [currentId,setCurrentId]=useState('m31')
  const [query,setQuery]=useState('')
  const [filter,setFilter]=useState<Status|'All'>('All')
  const [toast,setToast]=useState('')
  const current=meeting.items.find(i=>i.id===currentId) ?? meeting.items.find(i=>i.type==='minute')!
  const minutes=meeting.items.filter(i=>i.type==='minute')
  const shown=useMemo(()=>meeting.items.filter(i=>(!query||`${i.itemRef} ${i.title}`.toLowerCase().includes(query.toLowerCase()))&&(filter==='All'||i.status===filter)),[meeting.items,query,filter])
  const updateItem=(id:string, patch:Partial<MinuteItem>)=>setMeeting(m=>({...m,items:m.items.map(i=>i.id===id?{...i,...patch}:i)}))
  const step=(d:number)=>{const idx=minutes.findIndex(i=>i.id===current.id);setCurrentId(minutes[Math.max(0,Math.min(minutes.length-1,idx+d))].id)}
  const exportJson=()=>{const blob=new Blob([exportSnapshot(meeting)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${meeting.id}-reviewed.json`;a.click();URL.revokeObjectURL(a.href);setToast('Canonical meeting package exported')}
  useEffect(()=>{if(readOnly||meeting===initialMeeting)return;if(saveDelay===0){onMeetingChange?.(meeting);return}const timer=setTimeout(()=>onMeetingChange?.({...meeting,updatedAt:new Date().toISOString()}),saveDelay);return()=>clearTimeout(timer)},[meeting,onMeetingChange,initialMeeting,readOnly,saveDelay])

  return <div className={`app ${view==='presenter'?'presenter-mode':''}`}>
    <a className="skip-link" href="#main-content">Skip to meeting content</a>
    <header className="topbar"><div className="brand"><span className="brand-mark" aria-hidden="true">MW</span><div><strong>{publicAppConfig.productName}</strong><small>{publicAppConfig.productTagline}</small></div></div><div className="meeting-title"><span className="eyebrow">{meeting.meetingType} · No. {meeting.meetingNumber}</span><b>{meeting.title}</b></div><div className="top-actions">{onBack&&<button className="ghost" onClick={onBack}><LayoutDashboard size={17}/> Dashboard</button>}<button className="ghost" onClick={()=>setView('presenter')}><MonitorPlay size={17}/> Present</button><button className="primary" onClick={()=>setView('export')}><Download size={17}/> Export</button></div></header>
    <nav className="modebar" aria-label="Workspace views">{([['prepare','Prepare',ClipboardList],['live','Live meeting',Radio],['review','Review',ClipboardCheck],['import','Import review',FileUp],['editor','Secretary',PanelLeft],['presenter','Presenter',MonitorPlay],['actions','Actions',Archive],['export','Export',FileOutput]] as const).filter(([key])=>(!readOnly||['presenter','actions','export'].includes(key))&&(key!=='import'||allowImport)).map(([key,label,Icon])=><button key={key} className={view===key?'active':''} onClick={()=>setView(key)}><Icon size={16}/>{label}{key==='actions'&&<span className="count">{openActionCount(meeting.items)}</span>}</button>)}</nav>
    {meeting.lifecycle==='finalized'&&<div className="final-lock-note" role="status">Final issue R{meeting.revision??1} is read-only. Open Review → Create amendment to make changes.</div>}
    {view==='prepare'?<PreparationView meeting={meeting} onChange={setMeeting}/>:
     view==='live'?<LiveMeetingView meeting={meeting} onChange={setMeeting}/>:
     view==='review'?<ReviewView meeting={meeting} onChange={setMeeting}/>:
     view==='export'?<ExportView meeting={meeting} onChange={setMeeting} notify={setToast} readOnly={readOnly}/>:
     view==='import'?<ImportReview onApprove={async imported=>{if(onImportMeeting)await onImportMeeting(imported);else setToast('Open the app dashboard to save imported meetings')}}/>:
     view==='actions'?<ActionRegister meeting={meeting} setCurrentId={id=>{setCurrentId(id);setView('editor')}}/>:
     <main className="workspace" id="main-content">
      <aside className="agenda"><div className="agenda-head"><div><span className="eyebrow">Agenda</span><b>{meeting.items.length} structured items</b></div><button aria-label="Participants"><Users size={18}/></button></div><label className="search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Find item or reference"/></label><div className="filters">{(['All','Open','Ongoing','Overdue','Closed'] as const).map(s=><button className={filter===s?'selected':''} onClick={()=>setFilter(s)} key={s}>{s}</button>)}</div><div className="agenda-list">{shown.map(item=><button key={item.id} className={`agenda-item ${item.id===current.id?'current':''} ${item.type==='section'?'section':''}`} style={{paddingLeft:14+item.depth*18}} onClick={()=>item.type==='minute'&&setCurrentId(item.id)}><span className="ref">{item.itemRef}</span><span className="agenda-label">{item.title}</span>{item.type==='minute'&&<span className={statusClass(item.status)}>{item.status}</span>}</button>)}</div></aside>
      <section className="canvas"><div className="canvas-meta"><span>{current.source.page?`Source page ${current.source.page} · `:''}Table {current.source.table}, row / paragraph {current.source.row}</span><span className="confidence">{Math.round(current.source.confidence*100)}% confidence</span></div><div className="item-heading"><div className="item-number">{current.itemRef}</div><div><span className="eyebrow">Current minute</span><h1>{current.title}</h1></div><span className={statusClass(current.status)}>{current.status}</span></div>{current.blocks.map((b,i)=>b.type==='paragraph'?<p className="body-copy" key={i}>{b.text}</p>:<div className="metric" key={i}><div className="metric-title">{b.title}</div><TechnicalTable block={b}/></div>)}<div className="source-note"><FileCheck2 size={17}/><div><b>Source evidence</b><p>“{current.source.excerpt}”</p></div></div><div className="pager"><button onClick={()=>step(-1)}><ChevronLeft size={18}/> Previous</button><span>{minutes.findIndex(i=>i.id===current.id)+1} of {minutes.length}</span><button onClick={()=>step(1)}>Next <ChevronRight size={18}/></button></div></section>
      {view==='editor'&&<aside className="inspector"><span className="eyebrow">Secretary controls</span><h2>Decision & action</h2><label>Status<select value={current.status} onChange={e=>updateItem(current.id,{status:e.target.value as Status})}>{['Open','Ongoing','Overdue','Closed','Info','-'].map(s=><option key={s}>{s}</option>)}</select></label><label>Action by<input value={current.owner} onChange={e=>updateItem(current.id,{owner:e.target.value})}/></label>{current.action?<><label>Required action<textarea value={current.action.requiredAction} onChange={e=>updateItem(current.id,{action:{...current.action!,requiredAction:e.target.value}})}/></label><div className="field-row"><label>Owner<input value={current.action.owner} onChange={e=>updateItem(current.id,{action:{...current.action!,owner:e.target.value}})}/></label><label>Deadline<input type="date" value={current.action.deadline} onChange={e=>updateItem(current.id,{action:{...current.action!,deadline:e.target.value}})}/></label></div><label>Action status<select value={current.action.status} onChange={e=>updateItem(current.id,{action:{...current.action!,status:e.target.value as Status}})}>{['Open','Ongoing','Overdue','Closed'].map(s=><option key={s}>{s}</option>)}</select></label></>:<button className="add-action" onClick={()=>updateItem(current.id,{action:{id:`a-${current.id}`,actionRef:`AP-${current.itemRef}`,requiredAction:'',owner:current.owner,deadline:'',status:'Open'}})}>+ Create follow-up action</button>}<button className="approve-item" onClick={()=>{updateItem(current.id,{status:'Closed',action:current.action?{...current.action,status:'Closed'}:undefined});setToast(`${current.itemRef} marked closed`)}}>Mark discussed & close</button><div className="audit"><b>Revision trail</b><p>Changes are stored as field-level events in this MVP session. The data model is ready for Supabase persistence and presence.</p></div></aside>}
     </main>}
    {toast&&<div className="toast" role="status" onAnimationEnd={()=>setToast('')}>{toast}</div>}
  </div>
}

function ActionRegister({meeting,setCurrentId}:{meeting:MeetingDocument;setCurrentId:(id:string)=>void}){
 const actions=meeting.items.filter(i=>i.action)
 return <main className="actions-page"><div className="page-heading"><div><span className="eyebrow">Linked action plan</span><h1>Action register</h1><p>Each action retains its minute reference and source-page evidence.</p></div><button className="primary"><Download size={17}/> Export register</button></div><div className="summary-cards"><div><span>Open actions</span><b>{openActionCount(meeting.items)}</b></div><div><span>Overdue</span><b>{actions.filter(i=>i.action?.status==='Overdue').length}</b></div><div><span>Due this month</span><b>3</b></div><div><span>Closed</span><b>{actions.filter(i=>i.action?.status==='Closed').length}</b></div></div><div className="action-table"><div className="action-row head"><span>Ref.</span><span>Required action</span><span>Owner</span><span>Deadline</span><span>Status</span></div>{actions.map(i=><button className="action-row" key={i.id} onClick={()=>setCurrentId(i.id)}><span><b>{i.action!.actionRef}</b><small>Minute {i.itemRef}</small></span><span>{i.action!.requiredAction}</span><span>{i.action!.owner}</span><span>{i.action!.deadline}</span><span><em className={statusClass(i.action!.status)}>{i.action!.status}</em></span></button>)}</div></main>
}
export default App
