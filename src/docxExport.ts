import {
  AlignmentType, BorderStyle, Document, Footer, Header, HeadingLevel, ImageRun,
  PageNumber, Paragraph, Packer, ShadingType, Table, TableCell, TableRow, TextRun,
  VerticalAlign, WidthType, type ISectionOptions
} from 'docx'
import type { Block, ExportProfile, MeetingDocument } from './model'
import { getExportTemplate, type ExportTemplate } from './exportTemplates'
import { documentReference } from './issueManagement'

const PAGE_WIDTH = 9000
const border = { style: BorderStyle.SINGLE, size: 1, color: 'AEB8B3' }
const borders = { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border }
const shade = { fill: 'EEF2F0', type: ShadingType.CLEAR, color: 'auto' }

const text = (value: string, options: { bold?: boolean; size?: number; color?: string } = {}) =>
  new TextRun({ text: value || '—', bold: options.bold, size: options.size, color: options.color, font: 'Arial' })

const paragraph = (value: string, options: { bold?: boolean; size?: number; color?: string; before?: number; after?: number; alignment?: typeof AlignmentType[keyof typeof AlignmentType] } = {}) =>
  new Paragraph({ children: [text(value, options)], spacing: { before: options.before, after: options.after ?? 100 }, alignment: options.alignment })

const cell = (children: (Paragraph | Table)[], width: number, heading = false) => new TableCell({
  width: { size: width, type: WidthType.DXA }, children,
  shading: heading ? shade : undefined, verticalAlign: VerticalAlign.TOP,
  margins: { top: 90, bottom: 90, left: 100, right: 100 }
})

const labelCell = (value: string, width: number) => cell([paragraph(value.toUpperCase(), { bold: true, size: 17 })], width, true)
const valueCell = (value: string, width: number) => cell([paragraph(value, { size: 19 })], width)

const table = (rows: TableRow[], columnWidths: number[]) => new Table({
  rows, width: { size: PAGE_WIDTH, type: WidthType.DXA }, columnWidths, borders
})

const metadataTable = (meeting: MeetingDocument) => {
  const widths = [1400, 3100, 1400, 3100]
  const row = (a: string, b: string, c: string, d: string) => new TableRow({ children: [labelCell(a,widths[0]),valueCell(b,widths[1]),labelCell(c,widths[2]),valueCell(d,widths[3])] })
  return table([
    row('Meeting type', meeting.meetingType, 'Meeting no.', meeting.meetingNumber),
    row('Date', meeting.date, 'Venue', meeting.venue),
    row('Chair', meeting.chair, 'Status', meeting.lifecycle.replaceAll('_',' '))
  ], widths)
}

const technicalTable = (block: Extract<Block, {type:'metric_table'}>) => {
  const count = Math.max(1, block.columns.length)
  const base = Math.floor(5200 / count)
  const widths = block.columns.map((_, index) => index === count - 1 ? 5200 - base * (count - 1) : base)
  const header = new TableRow({ tableHeader: true, children: block.columns.map((value,index)=>cell([paragraph(value,{bold:true,size:16})],widths[index],true)) })
  const rows = block.rows.map(row=>new TableRow({children:widths.map((width,index)=>cell([paragraph(row[index] ?? '',{size:16})],width))}))
  return new Table({ rows:[header,...rows], width:{size:5200,type:WidthType.DXA}, columnWidths:widths, borders })
}

const minuteContent = (meeting: MeetingDocument, item: MeetingDocument['items'][number], template: ExportTemplate) => {
  const children: (Paragraph|Table)[] = [paragraph(item.title,{bold:true,size:19,after:80})]
  if (item.discussion) children.push(paragraph(item.discussion,{size:18}))
  item.blocks.forEach(block => {
    if (block.type === 'paragraph') children.push(paragraph(block.text,{size:18}))
    else {
      children.push(paragraph(block.title,{bold:true,size:17,before:80,after:50}))
      children.push(technicalTable(block))
    }
  })
  if (item.decision) children.push(new Paragraph({ children:[text(`${template.decisionLabel}: `,{bold:true,size:18}),text(item.decision,{size:18})], spacing:{before:100,after:80}, border:{left:{style:BorderStyle.SINGLE,size:8,color:'173B2F',space:6}} }))
  if (item.action) {
    children.push(new Paragraph({ children:[text(`${template.actionLabel}: `,{bold:true,size:18}),text(item.action.requiredAction,{size:18})], spacing:{before:100,after:40}, border:{left:{style:BorderStyle.SINGLE,size:8,color:'173B2F',space:6}} }))
    children.push(new Paragraph({ children:[text('Due: ',{bold:true,size:18}),text(item.action.deadline || 'Not set',{size:18})], spacing:{after:80}, border:{left:{style:BorderStyle.SINGLE,size:8,color:'173B2F',space:6}} }))
  }
  return children
}

const minutesTable = (meeting: MeetingDocument, template: ExportTemplate) => {
  const widths = [700, 5700, 1400, 1200]
  const header = new TableRow({ tableHeader:true, children:['No.',template.subjectHeading,template.ownerHeading,template.statusHeading].map((value,index)=>cell([paragraph(value,{bold:true,size:17})],widths[index],true)) })
  const rows = meeting.items.map(item=>item.type==='section'?new TableRow({cantSplit:true,children:[new TableCell({columnSpan:4,width:{size:PAGE_WIDTH,type:WidthType.DXA},shading:shade,children:[paragraph(`${item.itemRef}  ${item.title}`,{bold:true,size:19})]})]}):new TableRow({ children:[
    cell([paragraph(item.itemRef,{bold:true,size:18})],widths[0]),
    cell(minuteContent(meeting,item,template),widths[1]),
    cell([paragraph(item.action?.owner || item.owner,{size:18})],widths[2]),
    cell([paragraph(item.action?.status || item.status,{size:18})],widths[3])
  ] }))
  return table([header,...rows],widths)
}

const attendanceTable = (meeting: MeetingDocument) => {
  const widths=[2400,2400,2400,1800]
  const header=new TableRow({tableHeader:true,children:['Name','Organization','Role','Attendance'].map((value,index)=>cell([paragraph(value,{bold:true,size:17})],widths[index],true))})
  const rows=(meeting.participants ?? []).map(p=>new TableRow({children:[valueCell(p.name,widths[0]),valueCell(p.organization,widths[1]),valueCell(p.role,widths[2]),valueCell(p.attendance,widths[3])] }))
  return table([header,...rows],widths)
}

const approvalsTable = (meeting: MeetingDocument) => {
  const widths=[3000,3000,3000]
  const approvals: [string,string|undefined][]=[['Prepared by',meeting.preparedBy],['Checked by',meeting.checkedBy],['Approved by',meeting.approvedBy]]
  return table([new TableRow({cantSplit:true,children:approvals.map(([label,value],index)=>cell([
    paragraph(label,{bold:true,size:16}), paragraph(value || '—',{size:18,before:220,after:40})
  ],widths[index]))})],widths)
}

const logoRun = (profile: ExportProfile) => {
  const match = profile.logoDataUrl?.match(/^data:image\/(png|jpeg);base64,(.+)$/)
  if (!match) return undefined
  const bytes = Uint8Array.from(atob(match[2]), char => char.charCodeAt(0))
  return new ImageRun({ data: bytes, type: match[1] === 'jpeg' ? 'jpg' : 'png', transformation:{width:90,height:50} })
}

export const createMeetingDocxDocument = (meeting: MeetingDocument, profile: ExportProfile) => {
  const logo=logoRun(profile)
  const template=getExportTemplate(profile.templateId)
  const children:(Paragraph|Table)[]=[
    new Paragraph({children:[...(logo?[logo]:[]),text(profile.organizationName || 'Meeting workspace',{bold:true,size:22})],spacing:{after:80},border:{bottom:{style:BorderStyle.SINGLE,size:18,color:profile.primaryColor.replace('#','')}}}),
    paragraph(profile.projectName,{size:17,color:'53625C',after:180}),
    new Paragraph({heading:HeadingLevel.TITLE,children:[text(profile.documentTitle,{bold:true,size:34})],spacing:{after:80}}),
    paragraph(meeting.title,{size:22,color:'4C5B55',after:220}),
    paragraph(`${meeting.lifecycle==='finalized'?'FINAL':'DRAFT'} · REVISION ${meeting.revision ?? 1}`,{bold:true,size:17,color:meeting.lifecycle==='finalized'?'285442':'8A3838',after:160}),
    paragraph(`Document reference: ${documentReference(meeting)}`,{size:17,after:160}),
    metadataTable(meeting),
  ]
  if (template.showAttendance&&meeting.participants?.length) children.push(new Paragraph({heading:HeadingLevel.HEADING_2,children:[text('Attendance',{bold:true,size:24})],spacing:{before:240,after:100}}),attendanceTable(meeting))
  children.push(new Paragraph({heading:HeadingLevel.HEADING_2,children:[text(template.sectionTitle,{bold:true,size:24})],spacing:{before:240,after:100}}),minutesTable(meeting,template))
  if(profile.includeActionSummary){
    children.push(new Paragraph({heading:HeadingLevel.HEADING_2,children:[text('Action summary',{bold:true,size:24})],spacing:{before:240,after:100}}))
    const actions=meeting.items.filter(item=>item.action)
    const widths=[1000,3900,1500,1400,1200]
    children.push(actions.length?table([
      new TableRow({tableHeader:true,children:['Minute / action','Required action','Owner','Due','Status'].map((value,index)=>labelCell(value,widths[index]))}),
      ...actions.map(item=>new TableRow({children:[`${item.itemRef} / ${item.action!.actionRef}`,item.action!.requiredAction,item.action!.owner,item.action!.deadline,item.action!.status].map((value,index)=>valueCell(value,widths[index]))}))
    ],widths):paragraph('No actions recorded.'))
  }
  if(profile.includeDecisionSummary){
    children.push(new Paragraph({heading:HeadingLevel.HEADING_2,children:[text('Decision summary',{bold:true,size:24})],spacing:{before:240,after:100}}))
    const decisions=meeting.items.filter(item=>item.decision?.trim())
    children.push(decisions.length?table([
      new TableRow({tableHeader:true,children:[labelCell('Minute',1000),labelCell('Decision',8000)]}),
      ...decisions.map(item=>new TableRow({children:[valueCell(item.itemRef,1000),valueCell(item.decision!,8000)]}))
    ],[1000,8000]):paragraph('No decisions recorded.'))
  }
  children.push(new Paragraph({heading:HeadingLevel.HEADING_2,children:[text('Issue and approval',{bold:true,size:24})],spacing:{before:260,after:100}}),approvalsTable(meeting))
  if(template.showDistribution&&profile.distribution) children.push(paragraph('Distribution',{bold:true,size:18,before:200,after:30}),paragraph(profile.distribution,{size:18}))
  const section:ISectionOptions={
    properties:{page:{size:{width:11906,height:16838},margin:{top:900,right:900,bottom:900,left:900}}},
    headers:{default:new Header({children:[new Paragraph({children:[text(profile.documentTitle,{size:15,color:'65736D'}),text(`  |  ${meeting.meetingType} ${meeting.meetingNumber}`,{size:15,color:'65736D'})],alignment:AlignmentType.RIGHT})]})},
    footers:{default:new Footer({children:[new Paragraph({alignment:AlignmentType.CENTER,children:[text(`${meeting.lifecycle==='finalized'?'Final':'Draft'} · Revision ${meeting.revision ?? 1} · Page `,{size:15,color:'65736D'}),new TextRun({children:[PageNumber.CURRENT],size:15,color:'65736D',font:'Arial'}),text(' of ',{size:15,color:'65736D'}),new TextRun({children:[PageNumber.TOTAL_PAGES],size:15,color:'65736D',font:'Arial'})]})]})},
    children
  }
  return new Document({creator:'Minutes Workspace',title:profile.documentTitle,description:meeting.title,styles:{default:{document:{run:{font:'Arial',size:20},paragraph:{spacing:{line:276}}}}},sections:[section]})
}

export const generateMeetingDocx = async (meeting: MeetingDocument, profile: ExportProfile) => Packer.toBlob(createMeetingDocxDocument(meeting,profile))
