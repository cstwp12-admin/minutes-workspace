import type { Block, MeetingDocument, MinuteItem, SourceCell, Status } from './model'

export function importProblems(meeting:MeetingDocument):string[]{
  const issues:string[]=[],refs=new Set<string>(),ids=new Map(meeting.items.map(item=>[item.id,item]))
  if(!meeting.title.trim())issues.push('Meeting title is required.')
  for(const page of meeting.importEvidence?.ocrPages??[])if(!page.reviewed)issues.push(`OCR page ${page.page} must be checked against its preview before approval.`)
  if(!meeting.items.some(item=>item.type==='minute'))issues.push('At least one minute is required.')
  for(const item of meeting.items){
    if(!item.itemRef.trim())issues.push('An item needs a reference.')
    else if(refs.has(item.itemRef.trim()))issues.push(`Duplicate reference ${item.itemRef}.`)
    refs.add(item.itemRef.trim())
    if(!item.title.trim())issues.push(`${item.itemRef}: item title is required.`)
    if(item.parentId){
      const parent=ids.get(item.parentId)
      if(!parent||meeting.items.indexOf(parent)>=meeting.items.indexOf(item))issues.push(`${item.itemRef}: the parent must appear before its child.`)
      else if(item.depth!==parent.depth+1)issues.push(`${item.itemRef}: hierarchy depth needs correction.`)
    }
  }
  return [...new Set(issues)]
}
const get=(meeting:MeetingDocument,id:string)=>{const item=meeting.items.find(item=>item.id===id);if(!item)throw new Error('Select an item first.');return item}
const event=(meeting:MeetingDocument,items:MinuteItem[],action:string):MeetingDocument=>({...meeting,items,updatedAt:new Date().toISOString(),auditEvents:[...(meeting.auditEvents??[]),{id:crypto.randomUUID(),at:new Date().toISOString(),action}]})
function descendants(items:MinuteItem[],id:string):Set<string>{
  const ids=new Set([id])
  for(let pass=0;pass<items.length;pass++){let changed=false;for(const item of items)if(item.parentId&&ids.has(item.parentId)&&!ids.has(item.id)){ids.add(item.id);changed=true}if(!changed)break}
  return ids
}
export function reparentImportItem(meeting:MeetingDocument,id:string,parentId?:string):MeetingDocument{
  const item=get(meeting,id),family=descendants(meeting.items,id),parent=parentId?get(meeting,parentId):undefined
  if(parent&&(family.has(parent.id)||meeting.items.indexOf(parent)>=meeting.items.indexOf(item)))throw new Error('Choose an earlier item outside this item’s descendants.')
  const depth=parent?parent.depth+1:0,delta=depth-item.depth
  return event(meeting,meeting.items.map(entry=>entry.id===id?{...entry,parentId,depth}:family.has(entry.id)?{...entry,depth:entry.depth+delta}:entry),`Changed parent of ${item.itemRef}`)
}
export function moveImportItem(meeting:MeetingDocument,id:string,direction:-1|1):MeetingDocument{
  const item=get(meeting,id),siblings=meeting.items.filter(entry=>entry.parentId===item.parentId),neighbor=siblings[siblings.indexOf(item)+direction]
  if(!neighbor)return meeting
  const family=descendants(meeting.items,id),neighborFamily=descendants(meeting.items,neighbor.id)
  const moved=meeting.items.filter(entry=>family.has(entry.id)),remaining=meeting.items.filter(entry=>!family.has(entry.id))
  const position=direction<0?remaining.findIndex(entry=>entry.id===neighbor.id):Math.max(...remaining.map((entry,index)=>neighborFamily.has(entry.id)?index:-1))+1
  return event(meeting,[...remaining.slice(0,position),...moved,...remaining.slice(position)],`Moved ${item.itemRef} ${direction<0?'up':'down'}`)
}
export function splitImportItem(meeting:MeetingDocument,id:string,after:number,newReference:string):MeetingDocument{
  const item=get(meeting,id),reference=newReference.trim()
  if(item.type!=='minute'||after<1||after>=item.blocks.length)throw new Error('Choose a split point between content blocks of a minute.')
  if(!reference||meeting.items.some(entry=>entry.itemRef===reference))throw new Error('Enter a unique reference for the new item.')
  const family=descendants(meeting.items,id),position=Math.max(...meeting.items.map((entry,index)=>family.has(entry.id)?index:-1))+1
  const first={...item,blocks:item.blocks.slice(0,after)},blocks=structuredClone(item.blocks.slice(after))
  const second:MinuteItem={...structuredClone(item),id:crypto.randomUUID(),itemRef:reference,title:blocks[0]?.type==='paragraph'?blocks[0].text.slice(0,140):'Split technical content',blocks,action:undefined,discussion:undefined,decision:undefined,source:{...structuredClone(item.source),confidence:Math.min(item.source.confidence,.5)}}
  const items=meeting.items.map(entry=>entry.id===id?first:entry)
  return event(meeting,[...items.slice(0,position),second,...items.slice(position)],`Split ${item.itemRef} into ${item.itemRef} and ${reference}; action retained on the first item`)
}
export function mergeImportItem(meeting:MeetingDocument,id:string):MeetingDocument{
  const item=get(meeting,id),index=meeting.items.indexOf(item),previous=meeting.items[index-1]
  if(!previous||previous.type!=='minute'||item.type!=='minute'||previous.parentId!==item.parentId)throw new Error('Merge requires an immediately preceding minute with the same parent. Move or reparent the item first.')
  if(previous.action&&item.action)throw new Error('Both items have actions. Keep or remove the appropriate action before merging.')
  const notes:Block[]=[{type:'paragraph',text:`Merged item ${item.itemRef}: ${item.title}`}]
  if(item.owner&&item.owner!==previous.owner)notes.push({type:'paragraph',text:`Source owner for ${item.itemRef}: ${item.owner}`})
  if(item.status!==previous.status)notes.push({type:'paragraph',text:`Source status for ${item.itemRef}: ${item.status}`})
  const merged:MinuteItem={...previous,blocks:[...previous.blocks,...notes,...structuredClone(item.blocks)],action:previous.action??item.action,discussion:[previous.discussion,item.discussion].filter(Boolean).join('\n')||undefined,decision:[previous.decision,item.decision].filter(Boolean).join('\n')||undefined,source:{...previous.source,continuations:[...(previous.source.continuations??[]),{page:item.source.page,table:item.source.table,row:item.source.row},...(item.source.continuations??[])]}}
  const interim={...meeting,items:meeting.items.filter(entry=>entry.id!==id).map(entry=>entry.id===previous.id?merged:entry)}
  const result=meeting.items.filter(entry=>entry.parentId===id).reduce((record,child)=>reparentImportItem(record,child.id,previous.id),interim)
  return event(result,result.items,`Merged ${item.itemRef} into ${previous.itemRef}`)
}
export interface ImportColumnMap {reference:number;subject:number;owner?:number;status?:number;action?:number;deadline?:number;firstRow:number;lastRow:number}
const sourceCell=(row:SourceCell[],column:number|undefined)=>column===undefined?undefined:row.find(cell=>column>=cell.column&&column<cell.column+cell.colSpan)
const status=(value:string):Status=>({open:'Open',ongoing:'Ongoing',inprogress:'Ongoing',overdue:'Overdue',closed:'Closed',completed:'Closed',info:'Info',information:'Info'} as Record<string,Status>)[value.toLowerCase().replace(/\s/g,'')]??'-'

export function mapImportTable(meeting:MeetingDocument,index:number,map:ImportColumnMap,mode:'replace'|'append'|'continuation',targetId?:string):MeetingDocument{
  const table=meeting.importEvidence?.tables.find(table=>table.index===index)
  if(!table)throw new Error('Select a source table.')
  const columns=[map.reference,map.subject,map.owner,map.status,map.action,map.deadline].filter((value):value is number=>value!==undefined)
  const count=Math.max(0,...table.grid.flat().map(cell=>cell.column+cell.colSpan))
  if(!Number.isInteger(map.firstRow)||!Number.isInteger(map.lastRow)||map.firstRow<1||map.lastRow>table.grid.length||map.lastRow<map.firstRow)throw new Error('Choose a valid source row range.')
  if(mode!=='continuation'&&(columns.some(column=>!Number.isInteger(column)||column<0||column>=count)||new Set(columns).size!==columns.length))throw new Error('Map fields to different valid columns.')
  const rows=table.grid.slice(map.firstRow-1,map.lastRow)
  if(mode==='continuation'){
    const target=get(meeting,targetId??'')
    const block:Block={type:'metric_table',title:`Attached source table ${index}, rows ${map.firstRow}–${map.lastRow}`,columns:[],rows:[],grid:structuredClone(rows)}
    return event(meeting,meeting.items.map(item=>item.id===target.id?{...item,blocks:[...item.blocks,block],source:{...item.source,continuations:[...(item.source.continuations??[]),{page:table.page,table:index,row:map.firstRow}]}}:item),`Attached source rows to ${target.itemRef}`)
  }
  const mapped:MinuteItem[]=[]
  for(const [offset,row] of rows.entries()){
    const refCell=sourceCell(row,map.reference),subjectCell=sourceCell(row,map.subject),owner=sourceCell(row,map.owner)?.text??'',state=status(sourceCell(row,map.status)?.text??'')
    let ref=refCell?.text.trim()??'',subject=subjectCell?.text??''
    if(['no','number','ref','reference','itemref','itemno'].includes(ref.toLowerCase().replace(/[^a-z0-9]/g,'')))continue
    if(refCell&&refCell===subjectCell){const match=ref.match(/^(\d+(?:\.\d+)*)(?:[.)])?\s+(.+)$/s);if(match){ref=match[1];subject=match[2]}}
    const blocks:Block[]=subjectCell?.blocks.length?structuredClone(subjectCell.blocks):subject?[{type:'paragraph',text:subject}]:[]
    if(!ref){
      if(!row.some(cell=>cell.text||cell.blocks.length))continue
      const previous=mapped.at(-1)
      if(!previous)throw new Error('The range starts with an unnumbered row. Select a numbered first row or attach the range as a continuation.')
      previous.blocks.push(...(blocks.length?blocks:[{type:'metric_table' as const,title:`Unnumbered source row ${map.firstRow+offset}`,columns:[],rows:[],grid:structuredClone([row])}]))
      previous.source.continuations=[...(previous.source.continuations??[]),{page:table.page,table:index,row:map.firstRow+offset}]
      continue
    }
    const section=/\.0$/.test(ref),depth=section?0:Math.max(1,ref.split('.').length-1)
    const item:MinuteItem={id:crypto.randomUUID(),itemRef:ref,type:section?'section':'minute',depth,title:subject.split('\n')[0].slice(0,160)||'Mapped item',blocks,owner,status:state,source:{page:table.page,table:index,row:map.firstRow+offset,confidence:.65,excerpt:subject.slice(0,600)}}
    const parent=[...mapped].reverse().find(candidate=>ref.startsWith(candidate.itemRef+'.')||candidate.type==='section'&&candidate.itemRef.split('.')[0]===ref.split('.')[0])
    item.parentId=parent?.id;item.depth=parent?parent.depth+1:0
    const action=sourceCell(row,map.action)?.text,rawDate=sourceCell(row,map.deadline)?.text?.trim()??''
    if(!section&&(action||owner&&!['info','information','-'].includes(owner.toLowerCase())))item.action={id:crypto.randomUUID(),actionRef:`ACT-${ref}`,requiredAction:action||subject,owner,deadline:/^\d{4}-\d{2}-\d{2}$/.test(rawDate)?rawDate:'',status:['-','Info'].includes(state)?'Open':state}
    mapped.push(item)
  }
  if(!mapped.length)throw new Error('No items were found in the selected range.')
  const removed=mode==='replace'?meeting.items.filter(item=>item.source.table===index):[],removedIds=new Set(removed.map(item=>item.id))
  const replacementIds=new Map(removed.map(item=>[item.id,mapped.find(candidate=>candidate.itemRef===item.itemRef)?.id]))
  const position=mode==='replace'&&removed.length?meeting.items.indexOf(removed[0]):meeting.items.length
  const remaining=meeting.items.filter(item=>!removedIds.has(item.id)),insert=Math.min(position,remaining.length)
  const items=[...remaining.slice(0,insert),...mapped,...remaining.slice(insert)].map(item=>{
    if(!item.parentId||!removedIds.has(item.parentId))return item
    const parentId=replacementIds.get(item.parentId)
    return {...item,parentId,depth:parentId?item.depth:0}
  })
  return event(meeting,items,`Mapped table ${index}, rows ${map.firstRow}–${map.lastRow} (${mode})`)
}
