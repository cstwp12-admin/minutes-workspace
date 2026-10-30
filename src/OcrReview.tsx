import { useEffect, useState } from 'react'
import type { MeetingDocument, OcrPageEvidence } from './model'

export function updateOcrPage(meeting:MeetingDocument,page:number,patch:Partial<Pick<OcrPageEvidence,'correctedText'|'reviewed'>>):MeetingDocument{
  if(!meeting.importEvidence?.ocrPages?.some(entry=>entry.page===page))throw new Error('OCR page not found.')
  return {...meeting,importEvidence:{...meeting.importEvidence,ocrPages:meeting.importEvidence.ocrPages.map(entry=>entry.page===page?{...entry,...patch,...(patch.correctedText!==undefined?{reviewed:false}:{})}:entry)},auditEvents:[...(meeting.auditEvents??[]),{id:crypto.randomUUID(),at:new Date().toISOString(),action:patch.correctedText!==undefined?`Corrected OCR transcript for page ${page}; original recognition retained`:`${patch.reviewed?'Reviewed':'Reopened'} OCR page ${page}`}]}
}
function OcrPageReview({meeting,page,onCommit}:{meeting:MeetingDocument;page:OcrPageEvidence;onCommit:(meeting:MeetingDocument)=>void}){
  const saved=page.correctedText??page.text
  const [text,setText]=useState(saved)
  useEffect(()=>setText(saved),[saved])
  const dirty=text!==saved
  return <section className="ocr-page"><h3>Page {page.page} · engine confidence {Math.round(page.confidence)}%</h3><p>Confidence is an engine estimate, not an accuracy score. Compare numbers, references and merged cells with the page preview.</p>
    <label>Editable transcript for page {page.page}<textarea maxLength={200000} rows={9} value={text} onChange={event=>{setText(event.target.value);if(page.reviewed)onCommit(updateOcrPage(meeting,page.page,{reviewed:false}))}}/></label>
    <button className="ghost" disabled={!dirty} onClick={()=>onCommit(updateOcrPage(meeting,page.page,{correctedText:text}))}>Save page {page.page} transcript</button>
    <p>Saving a transcript preserves your corrected reference text. Correct the structured items and tables separately using the review tools below; saving does not replace them.</p>
    <details><summary>Original OCR text for page {page.page}</summary><pre style={{whiteSpace:'pre-wrap'}}>{page.text}</pre></details>
    <label><input type="checkbox" checked={page.reviewed} disabled={dirty} onChange={event=>onCommit(updateOcrPage(meeting,page.page,{reviewed:event.target.checked}))}/>I checked page {page.page}, saved any transcript corrections, and corrected its structured items and technical tables.</label>
    {dirty&&<p role="status">Save this transcript before acknowledging the page.</p>}
  </section>
}
export function OcrReview({meeting,onCommit}:{meeting:MeetingDocument;onCommit:(meeting:MeetingDocument)=>void}){
  if(!meeting.importEvidence?.ocrPages?.length)return null
  return <section className="ocr-review"><h2>Check recognized scan text</h2><p>English printed text only. Original recognition and corrected transcripts are kept separately in your local meeting record.</p>{meeting.importEvidence.ocrPages.map(page=><OcrPageReview key={page.page} meeting={meeting} page={page} onCommit={onCommit}/>)}</section>
}
