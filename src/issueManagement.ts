import type { FinalIssue, MeetingDocument } from './model'

export function completenessIssues(meeting: MeetingDocument): string[] {
  const issues: string[] = []
  if(meeting.importEvidence&&meeting.importStatus==='review') issues.push('Document import has not been approved')
  for (const [label,value] of [['Meeting title',meeting.title],['Meeting number',meeting.meetingNumber],['Meeting date',meeting.date],['Chair',meeting.chair],['Prepared by',meeting.preparedBy],['Checked by',meeting.checkedBy],['Approved by',meeting.approvedBy]]) {
    if (!value?.trim()) issues.push(`${label} is required`)
  }
  const minutes=meeting.items.filter(item=>item.type==='minute')
  if (!minutes.length) issues.push('At least one minute is required')
  const refs=new Set<string>()
  meeting.items.forEach(item=>{
    if (!item.itemRef.trim()) issues.push('An item has no reference')
    else if(refs.has(item.itemRef)) issues.push(`${item.itemRef}: duplicate item reference`)
    refs.add(item.itemRef)
    if (!item.title.trim()) issues.push(`${item.itemRef}: missing title`)
    if(item.type!=='minute') return
    if(item.outcome==='discussed'&&!item.discussion?.trim()) issues.push(`${item.itemRef}: missing discussion summary`)
    if(item.action){
      if(!item.action.requiredAction.trim()) issues.push(`${item.itemRef}: action has no description`)
      if(!item.action.owner.trim()) issues.push(`${item.itemRef}: action has no owner`)
      if(!item.action.deadline) issues.push(`${item.itemRef}: action has no deadline`)
    }
    if(item.outcome==='deferred'||item.outcome==='skipped') {
      if(!item.action?.requiredAction.trim()) issues.push(`${item.itemRef}: ${item.outcome} item requires follow-up`)
    }
  })
  if((meeting.participants??[]).some(p=>p.attendance==='expected')) issues.push('Attendance is not fully confirmed')
  const unresolved=(meeting.reviewComments??[]).filter(comment=>!comment.resolved).length
  if(unresolved) issues.push(`${unresolved} unresolved review comment${unresolved===1?'':'s'}`)
  if(meeting.exportProfile?.primaryColor&&!/^#[0-9a-f]{6}$/i.test(meeting.exportProfile.primaryColor)) issues.push('Document accent must be a six-digit hex colour')
  return issues
}

function captureIssue(meeting:MeetingDocument, at:string):FinalIssue {
  const {finalIssues: _history,...record}=structuredClone(meeting)
  return {revision:meeting.revision??1,issuedAt:at,record}
}

export function finalizeMeeting(meeting:MeetingDocument, at=new Date().toISOString()):MeetingDocument {
  if(meeting.lifecycle!=='under_review') throw new Error('Submit the minutes for review first')
  const issues=completenessIssues(meeting)
  if(issues.length) throw new Error('Complete the readiness checks before finalizing')
  const finalized:MeetingDocument={...meeting,lifecycle:'finalized',revision:meeting.revision??1,updatedAt:at,auditEvents:[...(meeting.auditEvents??[]),{id:crypto.randomUUID(),action:'Approved and saved final issue',at}]}
  return {...finalized,finalIssues:[...(meeting.finalIssues??[]),captureIssue(finalized,at)]}
}

export function createAmendment(meeting:MeetingDocument, at=new Date().toISOString()):MeetingDocument {
  if(meeting.lifecycle!=='finalized') throw new Error('Only a final issue can be amended')
  const history=meeting.finalIssues??[]
  // Preserve legacy final records that predate saved issue history.
  const finalIssues=history.some(issue=>issue.revision===(meeting.revision??1))?history:[...history,captureIssue(meeting,at)]
  return {...structuredClone(meeting),finalIssues,lifecycle:'draft_minutes',revision:(meeting.revision??1)+1,checkedBy:'',approvedBy:'',updatedAt:at,auditEvents:[...(meeting.auditEvents??[]),{id:crypto.randomUUID(),action:'Opened amendment revision',at}]}
}

export function compareWithIssue(meeting:MeetingDocument, issue:FinalIssue):string[] {
  const before=issue.record, changes:string[]=[]
  const fields: [keyof MeetingDocument,string][]=[['title','Meeting title'],['meetingType','Meeting type'],['meetingNumber','Meeting number'],['date','Meeting date'],['venue','Venue'],['chair','Chair'],['preparedBy','Prepared by'],['checkedBy','Checked by'],['approvedBy','Approved by'],['participants','Attendance'],['exportProfile','Document settings']]
  fields.forEach(([key,label])=>{if(JSON.stringify(before[key as keyof typeof before])!==JSON.stringify(meeting[key])) changes.push(`${label} changed`)})
  const oldItems=new Map(before.items.map(item=>[item.id,item]))
  meeting.items.forEach(item=>{
    const old=oldItems.get(item.id)
    if(!old) changes.push(`${item.itemRef}: item added`)
    else {
      const changed=(['itemRef','parentId','depth','title','blocks','discussion','decision','owner','status','action','outcome'] as const).filter(key=>JSON.stringify(old[key])!==JSON.stringify(item[key]))
      if(changed.length) changes.push(`${item.itemRef}: ${changed.join(', ')} changed`)
      oldItems.delete(item.id)
    }
  })
  oldItems.forEach(item=>changes.push(`${item.itemRef}: item removed`))
  if(before.items.map(i=>i.id).join('|')!==meeting.items.map(i=>i.id).join('|')) changes.push('Agenda order changed')
  return changes
}

export function documentReference(meeting:MeetingDocument){return meeting.exportProfile?.documentReference?.trim() || `${meeting.meetingType}-${meeting.meetingNumber}`}
export function exportBaseName(meeting:MeetingDocument){
  const ref=documentReference(meeting).normalize('NFKC').replace(/[<>:"/\\|?*\u0000-\u001f]/g,'-').replace(/\s+/g,'-').replace(/^[. -]+|[. -]+$/g,'').slice(0,100)||'meeting'
  return `${ref}-R${meeting.revision??1}-${meeting.lifecycle==='finalized'?'final':'draft'}`
}
