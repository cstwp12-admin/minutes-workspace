import { useState } from 'react'
import { Download, FileJson, FileSpreadsheet, FileType2, ImagePlus, Printer, ShieldCheck, Trash2 } from 'lucide-react'
import { exportSnapshot, type ExportProfile, type MeetingDocument } from './model'

export const defaultExportProfile: ExportProfile = {
  organizationName: '', projectName: '', documentTitle: 'Minutes of Meeting',
  primaryColor: '#173b2f', distribution: ''
}

const safeName = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'meeting'
const csvCell = (value: string) => `"${value.replace(/"/g, '""')}"`
export const exportActionsCsv = (meeting: MeetingDocument) => {
  const rows = [['Action reference','Minute reference','Required action','Owner','Deadline','Status']]
  meeting.items.filter(item => item.action).forEach(item => rows.push([
    item.action!.actionRef, item.itemRef, item.action!.requiredAction, item.action!.owner,
    item.action!.deadline, item.action!.status
  ]))
  return rows.map(row => row.map(csvCell).join(',')).join('\r\n')
}

const download = (content: BlobPart, filename: string, type: string) => {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click()
  URL.revokeObjectURL(url)
}

const printableStyles = `
  *{box-sizing:border-box} body{margin:0;background:#fff;color:#18201d;font:12px/1.45 Arial,sans-serif}
  .official-document{max-width:210mm;margin:auto;padding:16mm;color:#18201d;background:#fff}
  .document-masthead{display:grid;grid-template-columns:72px 1fr auto;gap:16px;align-items:center;border-bottom:4px solid var(--doc-color);padding-bottom:12px}
  .document-logo{max-width:64px;max-height:58px}.document-brand{font-size:11px;text-transform:uppercase;letter-spacing:.08em}.document-brand b{display:block;font-size:17px;text-transform:none;letter-spacing:0}
  .issue-badge{border:1px solid #aeb8b3;border-radius:3px;padding:7px 10px;text-align:center;font-size:10px;text-transform:uppercase}.issue-badge b{display:block;font-size:12px}
  h1{font-size:23px;margin:24px 0 4px} .document-subtitle{margin:0 0 18px;color:#4c5b55}
  table{width:100%;border-collapse:collapse;margin:0 0 18px} th,td{border:1px solid #aeb8b3;padding:7px;text-align:left;vertical-align:top} th{background:#eef2f0;font-size:10px;text-transform:uppercase;letter-spacing:.04em}
  .metadata th{width:16%}.metadata td{width:34%}.minutes-table .ref-col{width:8%}.minutes-table .owner-col{width:14%}.minutes-table .status-col{width:10%}
  .minute-title{font-weight:700}.minute-copy{margin-top:4px;white-space:pre-wrap}.minute-decision{border-left:3px solid var(--doc-color);margin-top:6px;padding-left:7px}.nested-table{margin:8px 0 0;font-size:10px}.nested-table th,.nested-table td{padding:5px}
  .approval-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin:28px 0 16px}.approval-box{border-top:1px solid #718078;padding-top:7px;min-height:42px}.approval-box span{display:block;color:#65736d;font-size:10px;text-transform:uppercase}
  .distribution{border-top:1px solid #c7cfcb;padding-top:10px}.draft-watermark{position:fixed;inset:42% auto auto 24%;font-size:72px;transform:rotate(-28deg);color:rgba(135,45,45,.08);font-weight:800;pointer-events:none}
  @page{size:A4;margin:10mm} @media print{.official-document{max-width:none;padding:0}thead{display:table-header-group}tr,.nested-table{break-inside:avoid}.draft-watermark{position:fixed}}
`

export function ExportView({ meeting, onChange, notify }: { meeting: MeetingDocument; onChange: (meeting: MeetingDocument) => void; notify: (message: string) => void }) {
  const [generatingWord,setGeneratingWord]=useState(false)
  const profile = { ...defaultExportProfile, ...meeting.exportProfile }
  const updateProfile = (patch: Partial<ExportProfile>) => onChange({ ...meeting, exportProfile: { ...profile, ...patch } })
  const baseName = safeName(`${meeting.meetingType}-${meeting.meetingNumber}`)
  const exportHtml = () => {
    const documentMarkup = document.querySelector('.official-document')?.outerHTML
    if (!documentMarkup) return
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${profile.documentTitle}</title><style>${printableStyles}</style></head><body>${documentMarkup}</body></html>`
    download(html, `${baseName}.html`, 'text/html;charset=utf-8'); notify('Standalone minutes document exported')
  }
  const uploadLogo = (file?: File) => {
    if (!file) return
    if (!['image/png','image/jpeg','image/svg+xml'].includes(file.type) || file.size > 1_000_000) { notify('Choose a PNG, JPG or SVG logo under 1 MB'); return }
    const reader = new FileReader(); reader.onload = () => updateProfile({ logoDataUrl: String(reader.result) }); reader.readAsDataURL(file)
  }
  const printPdf = () => { notify('Use the print dialog to save as PDF'); window.setTimeout(() => window.print(), 100) }
  const exportWord = async () => {
    setGeneratingWord(true)
    try { const {generateMeetingDocx}=await import('./docxExport'); download(await generateMeetingDocx(meeting,profile),`${baseName}-${meeting.lifecycle==='finalized'?'final':'draft'}.docx`,'application/vnd.openxmlformats-officedocument.wordprocessingml.document'); notify('Editable Word document exported') }
    catch { notify('Word export could not be generated') }
    finally { setGeneratingWord(false) }
  }
  return <main className="export-page" id="main-content">
    <section className="export-controls">
      <div><span className="eyebrow">Phase 5 · Official output</span><h1>Publish-ready minutes</h1><p>Set document identity at runtime. Nothing here is embedded in the public app source.</p></div>
      <div className="privacy-note"><ShieldCheck size={19}/><span><b>Project-neutral by design</b> Identity and logo are saved only with this local meeting record.</span></div>
      <div className="export-form">
        <label>Document title<input value={profile.documentTitle} onChange={e=>updateProfile({documentTitle:e.target.value})}/></label>
        <label>Organization name<input value={profile.organizationName} placeholder="Optional" onChange={e=>updateProfile({organizationName:e.target.value})}/></label>
        <label>Project or programme<input value={profile.projectName} placeholder="Optional" onChange={e=>updateProfile({projectName:e.target.value})}/></label>
        <label>Accent colour<span className="color-field"><input type="color" value={profile.primaryColor} onChange={e=>updateProfile({primaryColor:e.target.value})}/><input value={profile.primaryColor} onChange={e=>updateProfile({primaryColor:e.target.value})}/></span></label>
        <label className="wide">Distribution<textarea value={profile.distribution} placeholder="Optional recipients or distribution note" onChange={e=>updateProfile({distribution:e.target.value})}/></label>
        <div className="logo-control"><span>Document logo (optional)</span><div>{profile.logoDataUrl&&<img src={profile.logoDataUrl} alt="Current document logo"/>}<label className="secondary-button"><ImagePlus size={16}/> Choose logo<input type="file" accept="image/png,image/jpeg,image/svg+xml" onChange={e=>uploadLogo(e.target.files?.[0])}/></label>{profile.logoDataUrl&&<button className="icon-button" onClick={()=>updateProfile({logoDataUrl:undefined})} aria-label="Remove logo"><Trash2 size={16}/></button>}</div></div>
      </div>
      <div className="export-actions">
        <button className="primary" onClick={exportWord} disabled={generatingWord}><FileType2 size={17}/> {generatingWord?'Building Word…':'Editable Word'}</button>
        <button className="primary" onClick={printPdf}><Printer size={17}/> Print / Save PDF</button>
        <button onClick={exportHtml}><Download size={17}/> Standalone HTML</button>
        <button onClick={()=>{download(exportActionsCsv(meeting),`${baseName}-actions.csv`,'text/csv;charset=utf-8');notify('Action register exported')}}><FileSpreadsheet size={17}/> Action CSV</button>
        <button onClick={()=>{download(exportSnapshot(meeting),`${baseName}-backup.json`,'application/json');notify('Meeting backup exported')}}><FileJson size={17}/> Data backup</button>
      </div>
      <p className="export-hint">Word export creates a genuine editable DOCX with A4 pages, repeating table headers, technical tables and page numbering. Raster logos (PNG/JPG) are included in Word; SVG remains available in HTML/PDF.</p>
    </section>
    <section className="document-preview" aria-label="Official minutes preview"><div className="preview-label">A4 preview · {meeting.lifecycle==='finalized'?'Final issue':'Draft issue'}</div>
      <OfficialDocument meeting={meeting} profile={profile}/>
    </section>
  </main>
}

function OfficialDocument({ meeting, profile }: { meeting: MeetingDocument; profile: ExportProfile }) {
  const minutes = meeting.items.filter(item => item.type === 'minute')
  return <article className="official-document" style={{'--doc-color': profile.primaryColor} as React.CSSProperties}>
    {meeting.lifecycle!=='finalized'&&<div className="draft-watermark">DRAFT</div>}
    <header className="document-masthead">{profile.logoDataUrl?<img className="document-logo" src={profile.logoDataUrl} alt="Organization logo"/>:<div/>}<div className="document-brand">{profile.projectName&&<span>{profile.projectName}</span>}<b>{profile.organizationName || 'Meeting workspace'}</b></div><div className="issue-badge">Issue<b>{meeting.lifecycle==='finalized'?'Final':'Draft'}</b>Revision {meeting.revision ?? 1}</div></header>
    <h1>{profile.documentTitle}</h1><p className="document-subtitle">{meeting.title}</p>
    <table className="metadata"><tbody><tr><th>Meeting type</th><td>{meeting.meetingType}</td><th>Meeting no.</th><td>{meeting.meetingNumber}</td></tr><tr><th>Date</th><td>{meeting.date}</td><th>Venue</th><td>{meeting.venue}</td></tr><tr><th>Chair</th><td>{meeting.chair}</td><th>Status</th><td>{meeting.lifecycle.replaceAll('_',' ')}</td></tr></tbody></table>
    {!!meeting.participants?.length&&<><h2>Attendance</h2><table><thead><tr><th>Name</th><th>Organization</th><th>Role</th><th>Attendance</th></tr></thead><tbody>{meeting.participants.map(p=><tr key={p.id}><td>{p.name}</td><td>{p.organization}</td><td>{p.role}</td><td>{p.attendance}</td></tr>)}</tbody></table></>}
    <h2>Meeting minutes</h2><table className="minutes-table"><thead><tr><th className="ref-col">No.</th><th>Subject / discussion / decision</th><th className="owner-col">Action by</th><th className="status-col">Status</th></tr></thead><tbody>{minutes.map(item=><tr key={item.id}><td>{item.itemRef}</td><td><div className="minute-title" style={{marginLeft:`${Math.max(0,item.depth-1)*10}px`}}>{item.title}</div>{item.discussion&&<div className="minute-copy">{item.discussion}</div>}{item.blocks.map((block,index)=>block.type==='paragraph'?<div className="minute-copy" key={index}>{block.text}</div>:<table className="nested-table" key={index}><caption>{block.title}</caption><thead><tr>{block.columns.map(column=><th key={column}>{column}</th>)}</tr></thead><tbody>{block.rows.map((row,rowIndex)=><tr key={rowIndex}>{row.map((cell,cellIndex)=><td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table>)}{item.decision&&<div className="minute-decision"><b>Decision:</b> {item.decision}</div>}{item.action&&<div className="minute-decision"><b>Action:</b> {item.action.requiredAction}<br/><b>Due:</b> {item.action.deadline || 'Not set'}</div>}</td><td>{item.action?.owner || item.owner}</td><td>{item.action?.status || item.status}</td></tr>)}</tbody></table>
    <div className="approval-grid"><div className="approval-box"><span>Prepared by</span>{meeting.preparedBy || '—'}</div><div className="approval-box"><span>Checked by</span>{meeting.checkedBy || '—'}</div><div className="approval-box"><span>Approved by</span>{meeting.approvedBy || '—'}</div></div>
    {profile.distribution&&<div className="distribution"><b>Distribution</b><div>{profile.distribution}</div></div>}
  </article>
}
