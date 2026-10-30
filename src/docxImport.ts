import { strFromU8, unzipSync } from 'fflate'
import type { Block, ImportEvidence, MeetingDocument, MinuteItem, SourceCell, Status } from './model'

const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const children=(element:Element,name:string)=>Array.from(element.children).filter(child=>child.namespaceURI===W&&child.localName===name)
const descendants=(element:Element,name:string)=>Array.from(element.getElementsByTagNameNS(W,name))
const attr=(element:Element|undefined,name:string)=>element?.getAttributeNS(W,name)??''
const clean=(value:string)=>value.replace(/\s+/g,' ').trim()
const uid=()=>crypto.randomUUID()

function paragraphText(element:Element):string {
  const visit=(node:Element):string=>{
    if(node.namespaceURI===W&&['del','moveFrom','instrText','delText'].includes(node.localName))return ''
    if(node.namespaceURI===W&&node.localName==='t')return node.textContent??''
    if(node.namespaceURI===W&&node.localName==='tab')return ' '
    if(node.namespaceURI===W&&['br','cr'].includes(node.localName))return '\n'
    return Array.from(node.children).map(visit).join('')
  }
  return visit(element).trim()
}

function readTable(element:Element,warnings:Set<string>,depth=0):SourceCell[][] {
  if(depth>8)throw new Error('This document contains more than eight nested table levels. Simplify the table structure before importing.')
  const grid:SourceCell[][]=[], active=new Map<number,SourceCell>()
  children(element,'tr').forEach(row=>{
    let column=Number(attr(descendants(children(row,'trPr')[0]??row,'gridBefore')[0],'val'))||0
    const cells:SourceCell[]=[],continued=new Set<number>()
    children(row,'tc').forEach(tc=>{
      const props=children(tc,'tcPr')[0]
      const span=Math.max(1,Number(attr(props?descendants(props,'gridSpan')[0]:undefined,'val'))||1)
      if(span>100||column+span>100)throw new Error('A table exceeds the supported 100-column limit.')
      const merge=props?descendants(props,'vMerge')[0]:undefined
      const blocks:Block[]=Array.from(tc.children).flatMap<Block>(child=>{
        if(child.namespaceURI!==W)return []
        if(child.localName==='p'){const value=paragraphText(child);return value?[{type:'paragraph' as const,text:value}]:[]}
        if(child.localName==='tbl')return [tableBlock(readTable(child,warnings,depth+1),'Embedded technical table')]
        return []
      })
      const text=blocks.filter(b=>b.type==='paragraph').map(b=>b.text).join('\n')
      if(merge&&attr(merge,'val')!=='restart'&&active.has(column)){
        const origin=active.get(column)!
        origin.rowSpan+=1;continued.add(column)
        if(text){origin.blocks.push(...blocks);origin.text+='\n'+text;warnings.add('Text inside a continued merged cell was retained with its starting cell; check the source table.')}
      }else{
        const cell={column,text,colSpan:span,rowSpan:1,blocks}
        cells.push(cell)
        if(merge){active.set(column,cell);continued.add(column)}else active.delete(column)
      }
      column+=span
    })
    for(const key of active.keys())if(!continued.has(key))active.delete(key)
    grid.push(cells)
  })
  return grid
}

function tableBlock(grid:SourceCell[][],title:string):Extract<Block,{type:'metric_table'}>{
  const count=Math.max(1,...grid.flat().map(cell=>cell.column+cell.colSpan))
  const values=grid.map(row=>Array.from({length:count},(_,column)=>row.find(cell=>cell.column===column)?.text??''))
  return {type:'metric_table',title,columns:values[0]??[],rows:values.slice(1),grid}
}

const normalize=(value:string)=>clean(value).toLowerCase().replace(/[^a-z0-9]/g,'')
const parseStatus=(value:string):Status=>{
  const key=normalize(value)
  if(['closed','completed','complete','done'].includes(key))return 'Closed'
  if(['ongoing','inprogress','pending'].includes(key))return 'Ongoing'
  if(key==='overdue')return 'Overdue'
  if(['info','information','noted'].includes(key))return 'Info'
  if(key==='open')return 'Open'
  return '-'
}
const reference=(value:string)=>clean(value).match(/^\d+(?:\.\d+)*(?:\([a-z]\))?\.?$/i)?.[0].replace(/\.$/,'')
const referenceDepth=(ref:string)=>Math.max(0,ref.replace(/\([a-z]\)$/i,'').split('.').length-1-(ref.endsWith('.0')?1:0))+(ref.includes('(')?1:0)

function normalizedDate(value:string):string{
  const monthNames=['january','february','march','april','may','june','july','august','september','october','november','december']
  const literal=value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const spelled=value.trim().match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)\s+(\d{4})(?:\s*\([^)]*\))?$/i)
  const year=literal?Number(literal[1]):spelled?Number(spelled[3]):0
  const month=literal?Number(literal[2]):spelled?monthNames.indexOf(spelled[2].toLowerCase())+1:0
  const day=literal?Number(literal[3]):spelled?Number(spelled[1]):0
  if(!year||!month||!day)return ''
  const date=new Date(Date.UTC(year,month-1,day))
  return date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day?date.toISOString().slice(0,10):''
}

export function parseDocxXml(xml:string,filename='meeting.docx'):MeetingDocument {
  if(xml.length>8_000_000||/<!DOCTYPE|<!ENTITY/i.test(xml))throw new Error('The document XML is too large or uses unsupported entity declarations.')
  const parsed=new DOMParser().parseFromString(xml,'application/xml')
  if(parsed.getElementsByTagName('parsererror').length)throw new Error('The Word document contains invalid XML.')
  const body=parsed.getElementsByTagNameNS(W,'body')[0]
  if(!body)throw new Error('No Word document body was found.')
  if(body.getElementsByTagName('*').length>120_000)throw new Error('The document is too complex for this import. Split it into smaller files.')
  const warnings=new Set<string>()
  const tables:ImportEvidence['tables']=[], paragraphs:string[]=[], items:MinuteItem[]=[], participants:NonNullable<MeetingDocument['participants']>=[]
  const metadata:Record<string,string>={}
  let last:MinuteItem|undefined
  if(descendants(body,'numPr').length)warnings.add('Automatic Word list numbering may need reference correction; text is retained for review.')
  if(descendants(body,'drawing').length||descendants(body,'pict').length)warnings.add('Images and drawings are not imported. Retain the original file for visual evidence.')
  if(descendants(body,'ins').length||descendants(body,'del').length)warnings.add('Tracked changes were read as accepted text: insertions included, deletions excluded. Check against the original.')
  const readMetadata=(key:string,value:string)=>{
    const name=normalize(key)
    const field=({date:'date',meetingdate:'date',venue:'venue',location:'venue',chair:'chair',chairedby:'chair',meetingno:'meetingNumber',meetingnumber:'meetingNumber',meetingtype:'meetingType',meetingtitle:'title'} as Record<string,string>)[name]
    if(field&&value.trim())metadata[field]=value.trim()
  }
  const addItem=(ref:string,title:string,blocks:Block[],owner:string,status:Status,table:number,row:number,isSection=false,actionText='',deadline='')=>{
    const section=isSection||ref.endsWith('.0')
    const duplicate=items.some(item=>item.itemRef===ref)
    if(duplicate)warnings.add(`Duplicate reference ${ref}; correct it before approving.`)
    const meaningfulOwner=owner&&!['info','information','all','-'].includes(owner.toLowerCase())
    const item:MinuteItem={id:uid(),itemRef:ref,depth:referenceDepth(ref),type:section?'section':'minute',title:title||'Untitled imported item',blocks:structuredClone(blocks),owner,status,source:{table,row,confidence:duplicate?.4:.85,excerpt:[title,...blocks.filter(b=>b.type==='paragraph').map(b=>b.text)].join(' ').slice(0,600)}}
    const candidate=[...items].reverse().find(parent=>parent.type==='section'&&parent.depth<item.depth || !section&&ref.startsWith(parent.itemRef+'.'))
    if(candidate)item.parentId=candidate.id
    if(!section&&(actionText||meaningfulOwner))item.action={id:uid(),actionRef:`ACT-${ref}`,requiredAction:actionText||blocks.filter(b=>b.type==='paragraph').map(b=>b.text).join('\n')||title,owner,deadline,status:['Info','-'].includes(status)?'Open':status}
    if(item.action&&!deadline)warnings.add(`${ref}: verify the action deadline; no unambiguous date was found.`)
    items.push(item);last=item
    return item
  }
  const extractSubactions=(parent:MinuteItem,blocks:Block[])=>{
    for(const block of blocks){
      if(block.type!=='paragraph')continue
      for(const line of block.text.split('\n')){
        const match=line.trim().match(/^([a-z])\)\s+(.+)$/i)
        if(!match)continue
        const ref=`${parent.itemRef}(${match[1].toLowerCase()})`
        const child=addItem(ref,match[2].slice(0,120),[{type:'paragraph',text:match[2]}],parent.owner,parent.status,parent.source.table,parent.source.row)
        child.parentId=parent.id;child.depth=parent.depth+1;child.source.confidence=.55
        warnings.add(`${ref}: inferred subaction; verify its owner, deadline and reference.`)
      }
    }
  }
  for(const element of Array.from(body.children)){
    if(element.namespaceURI!==W)continue
    if(element.localName==='p'){
      const value=paragraphText(element)
      if(!value)continue
      paragraphs.push(value)
      const pair=value.match(/^([^:]{2,35}):\s*(.+)$/s)
      if(pair)readMetadata(pair[1],pair[2])
      const numbered=value.match(/^(\d+(?:\.\d+)+(?:\([a-z]\))?)\.?\s+(.+)$/is)
      if(numbered)addItem(numbered[1],numbered[2].slice(0,140),[{type:'paragraph',text:numbered[2]}],'','-',0,paragraphs.length)
      continue
    }
    if(element.localName!=='tbl')continue
    const index=tables.length+1, grid=readTable(element,warnings)
    tables.push({index,grid})
    let mapping:Record<string,number>|undefined, attendance:Record<string,number>|undefined, recognized=false
    for(let ri=0;ri<grid.length;ri++){
      const row=grid[ri], mappingForRow:Record<string,number>={}
      for(const cell of row){
        const name=normalize(cell.text)
        if(['no','number','item','ref','reference','itemno'].includes(name))mappingForRow.ref=cell.column
        if(/^(subject|description|discussion|matter|workstream|technicalitem|topic)/.test(name))mappingForRow.subject=cell.column
        if(/^(actionby|owner|responsible|executiveowner|lead)$/.test(name))mappingForRow.owner=cell.column
        if(/^(status|state|disposition|progress)$/.test(name))mappingForRow.status=cell.column
        if(/^(requiredaction|nextaction|commitment|followup)$/.test(name))mappingForRow.action=cell.column
        if(/^(due|deadline|duedate)$/.test(name))mappingForRow.deadline=cell.column
        if(name==='name')mappingForRow.name=cell.column
        if(/^(company|organization|companyposition)/.test(name))mappingForRow.organization=cell.column
        if(name==='role')mappingForRow.role=cell.column
      }
      if(mappingForRow.ref!==undefined&&mappingForRow.subject!==undefined){mapping=mappingForRow;recognized=true;continue}
      if(mappingForRow.name!==undefined&&mappingForRow.organization!==undefined){attendance=mappingForRow;recognized=true;continue}
      if(attendance){
        const value=(field:string)=>row.find(cell=>cell.column===attendance![field])?.text??''
        if(value('name'))participants.push({id:uid(),name:value('name'),organization:value('organization'),role:value('role'),attendance:'expected'})
        continue
      }
      if(!mapping){for(let ci=0;ci<row.length-1;ci+=2)readMetadata(row[ci].text,row[ci+1].text);continue}
      const getCell=(field:string)=>row.find(cell=>cell.column===mapping![field])
      const refText=getCell('ref')?.text??''
      const combined=refText.match(/^(\d+(?:\.\d+)+)\s+(.+)$/s)
      const ref=reference(refText)||combined?.[1]
      const subject=getCell('subject'), owner=getCell('owner')?.text??'',rawStatus=getCell('status')?.text??''
      const blocks=subject?.blocks??[]
      if(ref){
        const content=subject?.text??combined?.[2]??row.filter(c=>c!==getCell('ref')).map(c=>c.text).join(' ')
        const heading=content.split('\n')[0].slice(0,160)
        const labelled=(label:RegExp)=>blocks.filter(block=>block.type==='paragraph').map(block=>block.text.match(label)?.[1]?.trim()).find(Boolean)||''
        const action=getCell('action')?.text||labelled(/^(?:Action|Required action|Next action|Corrective action|Required response|Commitment|Backlog action|Next step):\s*(.+)$/is)
        const rawDate=getCell('deadline')?.text||labelled(/^(?:Due|Deadline|Due date):\s*(.+)$/is)
        const deadline=normalizedDate(rawDate)
        const item=addItem(ref,heading,blocks,owner,parseStatus(rawStatus),index,ri+1,false,action,deadline)
        item.decision=labelled(/^(?:Decision|Agreement|Technical disposition|Control decision|Agreed outcome|Product decision):\s*(.+)$/is)||undefined
        if(rawStatus.trim()&&parseStatus(rawStatus)==='-'&&rawStatus.trim()!=='-')warnings.add(`${ref}: status “${rawStatus}” was not mapped; check the original.`)
        extractSubactions(item,blocks)
      }else if(last&&row.some(c=>c.text||c.blocks.some(b=>b.type==='metric_table'))){
        last.source.continuations=[...(last.source.continuations??[]),{table:index,row:ri+1}]
        last.blocks.push(...(blocks.length?blocks:[tableBlock([row],`Unnumbered source row · table ${index}, row ${ri+1}`)]))
        last.source.confidence=Math.min(last.source.confidence,.6)
        warnings.add(`Table ${index}, row ${ri+1}: retained as a continuation of ${last.itemRef}; verify placement.`)
      }
    }
    if(!recognized){
      const block=tableBlock(grid,`Source table ${index}`)
      if(last)last.blocks.push(block)
      warnings.add(`Table ${index}: retained in source evidence; check its classification and placement.`)
    }
  }
  // Free text and unmatched tables always remain in evidence, even when no agenda can be inferred.
  if(!paragraphs.length&&!tables.some(table=>table.grid.flat().some(cell=>cell.text||cell.blocks.length)))throw new Error('No readable text or tables were found in this document.')
  if(!items.some(item=>item.type==='minute')){
    addItem('1.1','Unstructured imported content',[...paragraphs.map(text=>({type:'paragraph' as const,text})),...tables.map(t=>tableBlock(t.grid,`Source table ${t.index}`))],'','-',0,0)
    warnings.add('No numbered minute rows were recognized. Review and organize the retained content manually.')
  }
  const title=metadata.title||paragraphs.find(p=>/meeting|minutes/i.test(p))||filename.replace(/\.docx$/i,'')
  const meetingNumber=metadata.meetingNumber||title.match(/(?:no\.?|number)\s*[:#.]?\s*(\d+)/i)?.[1]||''
  warnings.add('Check all metadata, item boundaries, owners and inferred actions before approval. Original page layout, headers, footers and contact columns are retained only in your original file or source evidence.')
  warnings.add('Owner-based actions are suggestions. Edit or remove inferred follow-ups during review if the source does not require an action.')
  const date=normalizedDate(metadata.date||'')
  if(metadata.date&&!date)warnings.add('Meeting date could not be normalized without guessing. Enter the date after checking source evidence.')
  const meeting:MeetingDocument={id:uid(),title,meetingType:metadata.meetingType||'Imported meeting',meetingNumber,date,venue:metadata.venue||'',chair:metadata.chair||'',sourceFile:filename,sourceFormat:'DOCX',importStatus:'review',lifecycle:'draft_minutes',revision:1,updatedAt:new Date().toISOString(),participants,items,importEvidence:{tables,paragraphs,warnings:[...warnings]}}
  return meeting
}

export async function importDocx(file:File):Promise<MeetingDocument>{
  if(!/\.docx$/i.test(file.name))throw new Error('Choose a DOCX document. PDF import is coming in the next increment.')
  if(file.size>15_000_000)throw new Error('Choose a DOCX smaller than 15 MB.')
  let documentBytes:Uint8Array|undefined
  try{
    const entries=unzipSync(new Uint8Array(await file.arrayBuffer()),{filter:entry=>{
      if(entry.name!=='word/document.xml')return false
      if(entry.originalSize>8_000_000)throw new Error('Document content exceeds the 8 MB import limit.')
      return true
    }})
    documentBytes=entries['word/document.xml']
  }catch{throw new Error('This file could not be read as a supported DOCX. It may be corrupt, encrypted or too large.')}
  if(!documentBytes)throw new Error('This archive has no Word document content.')
  return parseDocxXml(strFromU8(documentBytes),file.name)
}
