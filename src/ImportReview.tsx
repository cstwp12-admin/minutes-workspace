import { useRef, useState } from 'react'
import { FileUp, ShieldCheck } from 'lucide-react'
import type { MeetingDocument, MinuteItem, Status } from './model'
import { TechnicalTable } from './TechnicalTable'
import { PdfSourcePreview } from './PdfSourcePreview'
import { ItemCorrectionTools, ImportColumnMapping } from './ImportCorrectionTools'
import { importProblems, reparentImportItem } from './importCorrections'

const statuses:Status[]=['Open','Ongoing','Overdue','Closed','Info','-']
export function ImportReview({onApprove,onCancel}:{onApprove:(meeting:MeetingDocument)=>Promise<void>|void;onCancel?:()=>void}){
  const [sourceFile,setSourceFile]=useState<File>()
  const [progress,setProgress]=useState('')
  const [previewPage,setPreviewPage]=useState<number>()
  const [history,setHistory]=useState<MeetingDocument[]>([])
  const [draft,setDraft]=useState<MeetingDocument>()
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[reviewed,setReviewed]=useState(false),[activeId,setActiveId]=useState('')
  const attempt=useRef(0)
  const current=draft?.items.find(item=>item.id===activeId)??draft?.items[0]
  const problems=draft?importProblems(draft):[]
  const commitDraft=(next:MeetingDocument)=>{if(draft&&next!==draft){setHistory(previous=>[...previous,draft].slice(-20));setReviewed(false);setDraft(next)}}
  const changeItem=(patch:Partial<MinuteItem>)=>{if(draft&&current)commitDraft({...draft,items:draft.items.map(item=>item.id===current.id?{...item,...patch}:item)})}
  const changeParent=(parentId?:string)=>{if(draft&&current)try{setError('');commitDraft(reparentImportItem(draft,current.id,parentId))}catch(reason){setError(reason instanceof Error?reason.message:'Parent could not be changed.')}}
  const undo=()=>{const previous=history.at(-1);if(previous){setDraft(previous);setHistory(history.slice(0,-1));setReviewed(false);setError('')}}
  const load=async(file?:File)=>{
    if(!file)return
    const id=++attempt.current
    setBusy(true);setError('');setDraft(undefined);setReviewed(false);setSourceFile(file);setProgress('Opening document…');setPreviewPage(undefined);setHistory([])
    try{let result:MeetingDocument;if(/\.pdf$/i.test(file.name)){const {importPdf}=await import('./pdfImport');result=await importPdf(file,message=>{if(attempt.current===id)setProgress(message)})}else{const {importDocx}=await import('./docxImport');result=await importDocx(file)}if(attempt.current===id){setDraft(result);setActiveId(result.items[0]?.id??'')}}
    catch(reason){if(attempt.current===id)setError(reason instanceof Error?reason.message:'The document could not be imported.')}
    finally{if(attempt.current===id)setBusy(false)}
  }
  const approve=async()=>{
    if(!draft||!reviewed||problems.length||busy)return
    setBusy(true);setError('')
    try{await onApprove({...draft,importStatus:'approved',updatedAt:new Date().toISOString(),auditEvents:[...(draft.auditEvents??[]),{id:crypto.randomUUID(),at:new Date().toISOString(),action:`Reviewed and approved ${draft.sourceFormat} import`}]})}
    catch{setError('The new meeting could not be saved. Your review is still available; try again.')}
    finally{setBusy(false)}
  }
  return <main className="document-import" id="main-content">
    <header className="import-intro"><div><span className="eyebrow">Document import</span><h1>Review a document as structured minutes.</h1><p>Import creates a new meeting after your review. Files are processed in this browser.</p></div>{onCancel&&<button className="ghost" disabled={busy} onClick={onCancel}>Back to meetings</button>}</header>
    <label className="import-upload"><FileUp size={25}/><span><b>{busy?progress||'Processing…':'Choose a DOCX or PDF document'}</b><small>Up to 15 MB · Searchable PDF up to 100 pages · Scans need OCR</small></span><input aria-label="Choose DOCX or PDF document" type="file" accept=".docx,.pdf" disabled={busy} onChange={e=>{void load(e.target.files?.[0]);e.target.value=''}}/></label>
    {error&&<p className="import-error" role="alert">{error}</p>}
    {!draft&&!busy&&<div className="import-note"><ShieldCheck size={20}/><p>Review the extracted text, table structure and inferred actions before approving. Keep the original file for page layout, images and formatting.</p></div>}
    {draft&&<>
      <section className="import-metadata"><h2>Meeting details</h2><div>{(['title','meetingType','meetingNumber','date','venue','chair'] as const).map((key,index)=><label key={key}>{['Meeting title','Meeting type','Meeting number','Meeting date','Venue','Chair'][index]}<input value={draft[key]} disabled={busy} onChange={e=>commitDraft({...draft,[key]:e.target.value})}/></label>)}</div></section>
      <details className="import-findings" open><summary>{draft.importEvidence?.warnings.length??0} review notes · {draft.items.length} items · {draft.importEvidence?.tables.length??0} source tables</summary><ul>{draft.importEvidence?.warnings.map((warning,index)=><li key={index}>{warning}</li>)}</ul></details>
      <div className="import-undo"><button className="ghost" disabled={busy||!history.length} onClick={undo}>Undo correction</button><span>{history.length} undo step{history.length===1?'':'s'} available · latest 20 edits</span></div>
      <ImportColumnMapping meeting={draft} currentId={current?.id} onCommit={commitDraft} onError={setError} disabled={busy}/>
      <section className="import-workbench"><aside aria-label="Extracted items"><h2>Reconstructed outline</h2>{draft.items.map(item=><button key={item.id} className={item.id===current?.id?'active':''} onClick={()=>{setActiveId(item.id);setPreviewPage(undefined)}}><b>{item.itemRef}</b><span>{item.title}</span><small>{item.source.page?`Page ${item.source.page} · `:''}T{item.source.table} · row {item.source.row}</small></button>)}</aside>
        {current&&<section className="import-item"><h2>Review item {current.itemRef}</h2><p>{current.source.page?`PDF page ${current.source.page} · `:''}Source table {current.source.table || '—'}, row / paragraph {current.source.row} · {current.source.confidence>=.8?'Recognized pattern':'Check placement'}</p><div className="import-fields"><label>Item reference<input value={current.itemRef} disabled={busy} onChange={e=>changeItem({itemRef:e.target.value})}/></label><label>Item type<select value={current.type} disabled={busy} onChange={e=>changeItem({type:e.target.value as MinuteItem['type']})}><option value="section">Section</option><option value="minute">Minute</option></select></label><label className="full">Item title<input value={current.title} disabled={busy} onChange={e=>changeItem({title:e.target.value})}/></label><label>Parent item<select value={current.parentId??''} disabled={busy} onChange={e=>changeParent(e.target.value||undefined)}><option value="">Top level</option>{draft.items.slice(0,draft.items.indexOf(current)).map(item=><option value={item.id} key={item.id}>{item.itemRef} {item.title.slice(0,70)}</option>)}</select></label><label>Owner<input value={current.owner} disabled={busy} onChange={e=>changeItem({owner:e.target.value})}/></label><label>Status<select value={current.status} disabled={busy} onChange={e=>changeItem({status:e.target.value as Status})}>{statuses.map(status=><option key={status}>{status}</option>)}</select></label></div>
          <ItemCorrectionTools key={current.id} meeting={draft} item={current} onCommit={commitDraft} onError={setError} disabled={busy}/>
          <h3>Retained content</h3>{current.blocks.map((block,index)=>block.type==='paragraph'?<label className="import-paragraph" key={index}>Paragraph {index+1}<textarea disabled={busy} value={block.text} onChange={e=>changeItem({blocks:current.blocks.map((b,bi)=>bi===index?{type:'paragraph',text:e.target.value}:b)})}/></label>:<div className="import-technical" key={index}><TechnicalTable block={block}/></div>)}
          {current.action?<fieldset disabled={busy} className="import-action"><legend>Inferred follow-up action</legend><label>Required action<textarea value={current.action.requiredAction} onChange={e=>changeItem({action:{...current.action!,requiredAction:e.target.value}})}/></label><div className="import-fields"><label>Action owner<input value={current.action.owner} onChange={e=>changeItem({action:{...current.action!,owner:e.target.value}})}/></label><label>Action deadline<input type="date" value={current.action.deadline} onChange={e=>changeItem({action:{...current.action!,deadline:e.target.value}})}/></label></div><label>Action status<select value={current.action.status} onChange={e=>changeItem({action:{...current.action!,status:e.target.value as Status}})}>{statuses.map(status=><option key={status}>{status}</option>)}</select></label><button type="button" className="ghost" onClick={()=>changeItem({action:undefined})}>Remove inferred action</button></fieldset>:current.type==='minute'&&<button type="button" className="ghost" disabled={busy} onClick={()=>changeItem({action:{id:crypto.randomUUID(),actionRef:`ACT-${current.itemRef}`,requiredAction:'',owner:current.owner,deadline:'',status:'Open'}})}>Add follow-up action</button>}
        </section>}
      </section>
      {draft.sourceFormat==='PDF'&&sourceFile&&<><label className="pdf-page-selector">Source page<select value={previewPage??current?.source.page??1} onChange={e=>setPreviewPage(Number(e.target.value))}>{draft.importEvidence?.pdfPages?.map(page=><option key={page.page} value={page.page}>Page {page.page}</option>)}</select></label><PdfSourcePreview file={sourceFile} page={previewPage??current?.source.page??1}/></>}
      <details className="import-evidence"><summary>Source evidence · extracted text and table grids</summary><p>{draft.sourceFormat==='PDF'?'PDF grids are reconstructed. Compare them with the original page preview; all extracted page text remains below.':'These are extracted Word structures, not a page image. Blank merged continuations remain part of the original grid.'}</p>{draft.importEvidence?.paragraphs.map((value,index)=><p key={index}>{value}</p>)}{draft.importEvidence?.tables.map(table=><TechnicalTable key={table.index} block={{type:'metric_table',title:`Source table ${table.index}${table.page?` · page ${table.page}`:''}`,columns:[],rows:[],grid:table.grid}}/>)}</details>
      <footer className="import-approval">{problems.length>0&&<ul className="import-validation" role="alert">{problems.map(problem=><li key={problem}>{problem}</li>)}</ul>}<label><input type="checkbox" checked={reviewed} disabled={busy} onChange={e=>setReviewed(e.target.checked)}/>I reviewed the metadata, item hierarchy, technical tables and inferred actions.</label><button className="primary" disabled={busy||!reviewed||problems.length>0} onClick={()=>void approve()}>{busy?'Saving…':'Approve import & create meeting'}</button></footer>
    </>}
  </main>
}
