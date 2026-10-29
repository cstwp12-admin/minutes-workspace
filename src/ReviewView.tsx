import { useState } from 'react'
import { AlertTriangle, Check, CheckCircle2, Lock, MessageSquarePlus, RotateCcw } from 'lucide-react'
import type { MeetingDocument, MinuteItem } from './model'
import { compareWithIssue, completenessIssues, createAmendment, finalizeMeeting } from './issueManagement'
export { completenessIssues } from './issueManagement'

export function ReviewView({meeting,onChange}:{meeting:MeetingDocument;onChange:(m:MeetingDocument)=>void}){
  const [compareRevision,setCompareRevision]=useState<number>()
  const issues=completenessIssues(meeting),comments=meeting.reviewComments??[],locked=meeting.lifecycle==='finalized'
  const history=meeting.finalIssues??[]
  const selectedIssue=history.find(issue=>issue.revision===compareRevision)??history.at(-1)
  const changes=selectedIssue?compareWithIssue(meeting,selectedIssue):[]
  const change=(patch:Partial<MeetingDocument>,action?:string)=>onChange({...meeting,...patch,updatedAt:new Date().toISOString(),auditEvents:action?[...(meeting.auditEvents??[]),{id:crypto.randomUUID(),action,at:new Date().toISOString()}]:meeting.auditEvents})
  const addComment=(item:MinuteItem)=>change({reviewComments:[...comments,{id:crypto.randomUUID(),minuteItemId:item.id,text:`Review ${item.itemRef}: `,resolved:false,createdAt:new Date().toISOString()}]})
  return <main className="review-page" id="main-content">
    <header className="review-head"><div><span className="eyebrow">Minutes review</span><h1>Review, approve and finalize the official record.</h1><p>Revision {meeting.revision??1} · {locked?'Finalized and read-only':'Working revision'}</p></div><div className="review-actions">
      {meeting.lifecycle==='draft_minutes'&&<button className="primary" onClick={()=>change({lifecycle:'under_review'},'Submitted minutes for review')}>Submit for review</button>}
      {meeting.lifecycle==='under_review'&&<button className="primary" disabled={issues.length>0} onClick={()=>onChange(finalizeMeeting(meeting))}><Lock size={16}/> Approve & finalize</button>}
      {locked&&<button className="ghost" onClick={()=>onChange(createAmendment(meeting))}><RotateCcw size={16}/> Create amendment</button>}
    </div></header>
    <section className="review-layout"><div>
      <div className="review-card"><h2>Completeness check</h2>{issues.length?<ul className="issue-list">{issues.map((issue,index)=><li key={index}><AlertTriangle size={16}/>{issue}</li>)}</ul>:<div className="all-clear"><CheckCircle2 size={21}/>Ready for approval</div>}</div>
      <div className="review-card"><h2>Approval details</h2><div className="approval-grid">{(['preparedBy','checkedBy','approvedBy'] as const).map((key,index)=><label key={key}>{['Prepared by','Checked by','Approved by'][index]}<input disabled={locked} value={meeting[key]??''} onChange={e=>change({[key]:e.target.value})}/></label>)}</div></div>
      <div className="review-card"><h2>Saved final issues</h2>{!history.length?<p>Finalizing saves a separate copy of this revision, including its document settings. Copies remain in this browser and in meeting backups.</p>:<><label>Compare working record with<select value={selectedIssue?.revision} onChange={e=>setCompareRevision(Number(e.target.value))}>{history.map(issue=><option key={issue.revision} value={issue.revision}>Revision {issue.revision} · {new Date(issue.issuedAt).toLocaleString()}</option>)}</select></label>{changes.length?<ul className="issue-list">{changes.map((entry,index)=><li key={index}>{entry}</li>)}</ul>:<p>No content changes from this saved issue.</p>}</>}</div>
      <div className="review-card"><h2>Minute-by-minute review</h2>{meeting.items.filter(i=>i.type==='minute').map(item=><div className="review-item" key={item.id}><span>{item.itemRef}</span><div><b>{item.title}</b><small>{item.discussion||'No live discussion summary recorded'}</small></div><button disabled={locked} className="ghost" onClick={()=>addComment(item)}><MessageSquarePlus size={15}/> Comment</button></div>)}</div>
    </div><aside>
      <div className="review-card"><h2>Reviewer comments</h2>{comments.length===0?<p>No comments yet.</p>:comments.map(c=><label className={c.resolved?'resolved':''} key={c.id}><textarea disabled={locked||c.resolved} value={c.text} onChange={e=>change({reviewComments:comments.map(x=>x.id===c.id?{...x,text:e.target.value}:x)})}/><button disabled={locked||c.resolved} onClick={()=>change({reviewComments:comments.map(x=>x.id===c.id?{...x,resolved:true}:x)},'Resolved review comment')}><Check size={14}/> Resolve</button></label>)}</div>
      <div className="review-card audit-card"><h2>Revision history</h2>{(meeting.auditEvents??[]).slice().reverse().map(e=><p key={e.id}><b>{e.action}</b><small>{new Date(e.at).toLocaleString()}</small></p>)}</div>
    </aside></section>
  </main>
}
