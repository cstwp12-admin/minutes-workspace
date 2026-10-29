import { useRef, useState } from 'react'
import { FileUp, ShieldCheck } from 'lucide-react'
import type { Block, MeetingDocument, MinuteItem, Status } from './model'
import { TechnicalTable } from './TechnicalTable'

const statuses:Status[]=['Open','Ongoing','Overdue','Closed','Info','-']
export function ImportReview({onApprove,onCancel}:{onApprove:(meeting:MeetingDocument)=>Promise<void>|void;onCancel?:()=>void}){
  const [draft,setDraft]=useState<MeetingDocument>()
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[reviewed,setReviewed]=useState(false),[activeId,setActiveId]=useState('')
  const attempt=useRef(0)
  const current=draft?.items.find(item=>item.id===activeId)??draft?.items[0]
  const duplicates=draft?.items.some((item,index)=>!item.itemRef.trim()||draft.items.findIndex(other=>other.itemRef===item.itemRef)!==index)
  const changeItem=(patch:Partial<MinuteItem>)=>{if(draft&&current){setReviewed(false);setDraft({...draft,items:draft.items.map(item=>item.id===current.id?{...item,...patch}:item)})}}
  const load=async(file?:File)=>{
    if(!file)return
    const id=++attempt.current
    setBusy(true);setError('');setDraft(undefined);setReviewed(false)
    try{const {importDocx}=await import('./docxImport');const result=await importDocx(file);if(attempt.current===id){setDraft(result);setActiveId(result.items[0]?.id??'')}}
    catch(reason){if(attempt.current===id)setError(reason instanceof Error?reason.message:'The document could not be imported.')}
    finally{if(attempt.current===id)setBusy(false)}
  }
  const approve=async()=>{
    if(!draft||!reviewed||duplicates||busy)return
    setBusy(true);setError('')
    try{await onApprove({...draft,importStatus:'approved',updatedAt:new Date().toISOString(),auditEvents:[{id:crypto.randomUUID(),at:new Date().toISOString(),action:'Reviewed and approved DOCX import'}]})}
    catch{setError('The new meeting could not be saved. Your review is still available; try again.')}
    finally{setBusy(false)}
  }
  return <main className="document-import" id="main-content">
    <header className="import-intro"><div><span className="eyebrow">Document import</span><h1>Review a Word document as structured minutes.</h1><p>Import creates a new meeting after your review. Files are processed in this browser.</p></div>{onCancel&&<button className="ghost" disabled={busy} onClick={onCancel}>Back to meetings</button>}</header>
    <label className="import-upload"><FileUp size={25}/><span><b>{busy?'Processing…':'Choose a DOCX document'}</b><small>Up to 15 MB · PDF import is planned for the next increment</small></span><input aria-label="Choose DOCX document" type="file" accept=".docx" disabled={busy} onChange={e=>{void load(e.target.files?.[0]);e.target.value=''}}/></label>
    {error&&<p className="import-error" role="alert">{error}</p>}
    {!draft&&!busy&&<div className="import-note"><ShieldCheck size={20}/><p>Review the extracted text, table structure and inferred actions before approving. Keep the original file for page layout, images and formatting.</p></div>}
    {draft&&<>
      <section className="import-metadata"><h2>Meeting details</h2><div>{(['title','meetingType','meetingNumber','date','venue','chair'] as const).map((key,index)=><label key={key}>{['Meeting title','Meeting type','Meeting number','Meeting date','Venue','Chair'][index]}<input value={draft[key]} disabled={busy} onChange={e=>{setReviewed(false);setDraft({...draft,[key]:e.target.value})}}/></label>)}</div></section>
      <details className="import-findings" open><summary>{draft.importEvidence?.warnings.length??0} review notes · {draft.items.length} items · {draft.importEvidence?.tables.length??0} source tables</summary><ul>{draft.importEvidence?.warnings.map((warning,index)=><li key={index}>{warning}</li>)}</ul></details>
      <section className="import-workbench"><aside aria-label="Extracted items"><h2>Reconstructed outline</h2>{draft.items.map(item=><button key={item.id} className={item.id===current?.id?'active':''} onClick={()=>setActiveId(item.id)}><b>{item.itemRef}</b><span>{item.title}</span><small>T{item.source.table} · row {item.source.row}</small></button>)}</aside>
        {current&&<section className="import-item"><h2>Review item {current.itemRef}</h2><p>Source table {current.source.table || '—'}, row / paragraph {current.source.row} · {current.source.confidence>=.8?'Recognized pattern':'Check placement'}</p><div className="import-fields"><label>Item reference<input value={current.itemRef} disabled={busy} onChange={e=>changeItem({itemRef:e.target.value})}/></label><label>Item type<select value={current.type} disabled={busy} onChange={e=>changeItem({type:e.target.value as MinuteItem['type']})}><option value="section">Section</option><option value="minute">Minute</option></select></label><label className="full">Item title<input value={current.title} disabled={busy} onChange={e=>changeItem({title:e.target.value})}/></label><label>Parent item<select value={current.parentId??''} disabled={busy} onChange={e=>{const parent=draft.items.find(item=>item.id===e.target.value);changeItem({parentId:parent?.id,depth:parent?parent.depth+1:0})}}><option value="">Top level</option>{draft.items.slice(0,draft.items.indexOf(current)).map(item=><option value={item.id} key={item.id}>{item.itemRef} {item.title.slice(0,70)}</option>)}</select></label><label>Owner<input value={current.owner} disabled={busy} onChange={e=>changeItem({owner:e.target.value})}/></label><label>Status<select value={current.status} disabled={busy} onChange={e=>changeItem({status:e.target.value as Status})}>{statuses.map(status=><option key={status}>{status}</option>)}</select></label></div>
          <h3>Retained content</h3>{current.blocks.map((block,index)=>block.type==='paragraph'?<label className="import-paragraph" key={index}>Paragraph {index+1}<textarea disabled={busy} value={block.text} onChange={e=>changeItem({blocks:current.blocks.map((b,bi)=>bi===index?{type:'paragraph',text:e.target.value}:b)})}/></label>:<div className="import-technical" key={index}><TechnicalTable block={block}/></div>)}
          {current.action&&<fieldset disabled={busy} className="import-action"><legend>Inferred follow-up action</legend><label>Required action<textarea value={current.action.requiredAction} onChange={e=>changeItem({action:{...current.action!,requiredAction:e.target.value}})}/></label><div className="import-fields"><label>Action owner<input value={current.action.owner} onChange={e=>changeItem({action:{...current.action!,owner:e.target.value}})}/></label><label>Action deadline<input type="date" value={current.action.deadline} onChange={e=>changeItem({action:{...current.action!,deadline:e.target.value}})}/></label></div><label>Action status<select value={current.action.status} onChange={e=>changeItem({action:{...current.action!,status:e.target.value as Status}})}>{statuses.map(status=><option key={status}>{status}</option>)}</select></label></fieldset>}
        </section>}
      </section>
      <details className="import-evidence"><summary>Source evidence · extracted text and table grids</summary><p>These are extracted Word structures, not a page image. Blank merged continuations remain part of the original grid.</p>{draft.importEvidence?.paragraphs.map((value,index)=><p key={index}>{value}</p>)}{draft.importEvidence?.tables.map(table=><TechnicalTable key={table.index} block={{type:'metric_table',title:`Source table ${table.index}`,columns:[],rows:[],grid:table.grid}}/>)}</details>
      <footer className="import-approval">{duplicates&&<p role="alert">Give each item a unique, non-empty reference before approving.</p>}<label><input type="checkbox" checked={reviewed} disabled={busy} onChange={e=>setReviewed(e.target.checked)}/>I reviewed the metadata, item hierarchy, technical tables and inferred actions.</label><button className="primary" disabled={busy||!reviewed||duplicates||!draft.title.trim()||!draft.items.some(item=>item.type==='minute')} onClick={()=>void approve()}>{busy?'Saving…':'Approve import & create meeting'}</button></footer>
    </>}
  </main>
}
