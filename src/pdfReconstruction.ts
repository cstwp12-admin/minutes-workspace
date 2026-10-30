import type { Block, MeetingDocument, PdfPageEvidence, SourceCell } from './model'
import { parseDocxXml } from './docxImport'
import { contains, inside, textLines, type Bounds, type PdfTable } from './pdfGeometry'

const escapeXml=(value:string)=>value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
const p=(value:string)=>`<w:p><w:r><w:t xml:space="preserve">${escapeXml(value)}</w:t></w:r></w:p>`
const normalize=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]/g,'')
const cellBlock=(grid:SourceCell[][],title:string):Block=>({type:'metric_table',title,columns:[],rows:[],grid})

function tableXml(grid:SourceCell[][]):string{
  const count=Math.max(1,...grid.flat().map(cell=>cell.column+cell.colSpan))
  return '<w:tbl>'+grid.map((row,ri)=>{
    let cells=''
    for(let column=0;column<count;){
      const own=row.find(cell=>cell.column===column)
      const above=grid.slice(0,ri).flatMap((previous,r)=>previous.filter(cell=>cell.column===column&&r+cell.rowSpan>ri))
      const origin=own??above.at(-1)
      if(!origin){cells+='<w:tc>'+p('')+'</w:tc>';column++;continue}
      const blocks=own?origin.blocks:[]
      const content=blocks.length?blocks.map(block=>block.type==='paragraph'?block.text.split('\n').map(p).join(''):tableXml(block.grid??[])).join(''):p(own?origin.text:'')
      cells+=`<w:tc><w:tcPr><w:gridSpan w:val="${origin.colSpan}"/>${origin.rowSpan>1?`<w:vMerge${own?' w:val="restart"':''}/>`:''}</w:tcPr>${content}</w:tc>`
      column+=origin.colSpan
    }
    return '<w:tr>'+cells+'</w:tr>'
  }).join('')+'</w:tbl>'
}

function tableKind(table:PdfTable){
  const names=table.grid.slice(0,10).flat().map(cell=>normalize(cell.text))
  if(names.some(n=>n==='requiredaction')&&names.some(n=>n==='itemref'||n==='reference'))return 'actions'
  if(names.some(n=>n==='subject'||n==='description')&&names.some(n=>n==='no'||n==='itemref'||n==='ref'))return 'minutes'
  if(names.some(n=>n==='name')&&names.some(n=>n.startsWith('company')||n.startsWith('organization')))return 'attendance'
  return 'other'
}

function minutesGrid(table:PdfTable,page:PdfPageEvidence,allTables:PdfTable[]):SourceCell[][]{
  const headers=table.grid.slice(0,10).flat()
  const header=(pattern:RegExp)=>headers.find(cell=>pattern.test(normalize(cell.text)))
  const ref=header(/^(no|ref|itemref)$/),subject=header(/^(subject|description)$/),owner=header(/^(action|actionby|owner)$/),status=header(/^status$/)
  if(!ref||!subject)return table.grid
  const left=table.xs[subject.column],right=owner?table.xs[owner.column]:status?table.xs[status.column]:table.bounds[2]
  const refLeft=table.xs[ref.column],refRight=table.xs[ref.column+ref.colSpan]
  const lines=textLines(page.spans.filter(span=>span.x+span.width/2>=refLeft&&span.x+span.width/2<refRight))
  const refs=lines.map(line=>({line,value:line.text.replace(/\s*\.\s*/g,'.')})).filter(entry=>/^\d+(?:\.\d+)+(?:\([a-z]\))?\.?$/i.test(entry.value))
  const makeCell=(column:number,value:string,blocks:Block[]=[]):SourceCell=>({column,text:value,colSpan:1,rowSpan:1,blocks:blocks.length?blocks:value?[{type:'paragraph',text:value}]:[]})
  const rows:SourceCell[][]=[[makeCell(0,'No.'),makeCell(1,'Subject'),makeCell(2,'Action by'),makeCell(3,'Status')]]
  const topFor=(y:number)=>[...table.ys].reverse().find(value=>value<y-3)??table.bounds[1]
  const headerBottom=Math.max(...headers.filter(cell=>/^(no|ref|subject|action|actionby|status|by)$/.test(normalize(cell.text))).map(cell=>{
    const ri=table.grid.findIndex(row=>row.includes(cell));return table.ys[Math.min(table.ys.length-1,ri+cell.rowSpan)]
  }))
  const bands=[...(refs.length&&topFor(refs[0].line.y)>headerBottom+4?[{ref:'',top:headerBottom,bottom:topFor(refs[0].line.y)}]:[]),...refs.map((entry,index)=>({ref:entry.value.replace(/\.$/,''),top:topFor(entry.line.y),bottom:index+1<refs.length?topFor(refs[index+1].line.y):table.bounds[3]}))]
  if(!refs.length)bands.push({ref:'',top:headerBottom,bottom:table.bounds[3]})
  for(const band of bands){
    const region=(x1:number,x2:number)=>textLines(page.spans.filter(span=>inside(span,[x1,band.top,x2,band.bottom]))).map(line=>line.text).join('\n')
    const subjectText=region(left,right),ownerText=owner?region(table.xs[owner.column],table.xs[owner.column+owner.colSpan]):'',statusText=status?region(table.xs[status.column],table.xs[status.column+status.colSpan]):''
    if(!band.ref&&!subjectText)continue
    const leftIndex=subject.column,rightIndex=owner?.column??status?.column??table.xs.length-1
    const candidateRows=table.grid.map((row,ri)=>({ri,cells:row.filter(cell=>cell.column>=leftIndex&&cell.column+cell.colSpan<=rightIndex&&table.ys[ri]>=band.top-1&&table.ys[ri+cell.rowSpan]<=band.bottom+1)})).filter(row=>row.cells.filter(cell=>cell.text).length>1)
    const blocks:Block[]=subjectText?[{type:'paragraph',text:subjectText}]:[]
    const bandBounds:Bounds=[left,band.top,right,band.bottom]
    for(const nested of allTables.filter(candidate=>candidate!==table&&candidate.page===page.page&&contains(bandBounds,candidate.bounds)))blocks.push(cellBlock(nested.grid,`Reconstructed technical table · page ${page.page}`))
    if(candidateRows.length>=2&&candidateRows.some(row=>row.cells.some(cell=>/^\d+(?:[.,%]\d*)?$/.test(cell.text.trim())))){
      const start=candidateRows[0].ri,end=candidateRows.at(-1)!.ri
      const grid=table.grid.slice(start,end+1).map((row,index)=>row.filter(cell=>cell.column>=leftIndex&&cell.column+cell.colSpan<=rightIndex).map(cell=>({...structuredClone(cell),column:cell.column-leftIndex,rowSpan:Math.min(cell.rowSpan,end-start+1-index)})))
      blocks.push(cellBlock(grid,`Reconstructed technical grid · page ${table.page}`))
    }
    rows.push([makeCell(0,band.ref),makeCell(1,subjectText,blocks),makeCell(2,ownerText),makeCell(3,statusText)])
  }
  return rows
}

export function reconstructPdf(pages:PdfPageEvidence[],tables:PdfTable[],filename:string,initialWarnings:string[]=[]):MeetingDocument{
  const warnings=new Set(initialWarnings)
  const evidenceTables=tables.map((table,index)=>({index:index+1,page:table.page,bounds:table.bounds,grid:structuredClone(table.grid)}))
  const top=tables.filter(table=>!tables.some(other=>other!==table&&other.page===table.page&&contains(other.bounds,table.bounds)&&!contains(table.bounds,other.bounds)))
  const syntheticMaps:{table:PdfTable;originalIndex:number;rowMap:number[]}[]=[],paragraphPages:number[]=[]
  let xml='',lastHeader:SourceCell[]|undefined,lastMinutesTable:PdfTable|undefined
  const actionTables:PdfTable[]=[]
  for(const page of pages){
    if(page.page===1){
      for(const line of textLines(page.spans)){
        const metadata=line.text.match(/^(DATE|MEETING DATE|VENUE|LOCATION|CHAIRED BY|CHAIR|MEETING NO\.?)\s*:?\s+(.+)$/i)
        if(metadata){xml+=p(`${metadata[1]}: ${metadata[2]}`);paragraphPages.push(page.page)}
      }
    }
    const pageTables=top.filter(table=>table.page===page.page)
    const outside=textLines(page.spans.filter(span=>!pageTables.some(table=>inside(span,table.bounds))))
    for(const line of outside){xml+=p(line.text);paragraphPages.push(page.page)}
    for(const table of pageTables){
      const kind=tableKind(table)
      if(kind==='other')warnings.add(`Page ${page.page}: a table remains in source evidence; check its classification and placement.`)
      if(kind==='actions'){actionTables.push(table);warnings.add(`Page ${page.page}: action-register entries were matched by minute reference where possible; review all matches.`);continue}
      let grid=structuredClone(table.grid)
      if(kind==='minutes')grid=minutesGrid(table,page,tables)
      // Retain independent technical grids as nested content in their containing cell.
      for(let ri=0;ri<grid.length&&kind!=='minutes';ri++)for(const cell of grid[ri]){
        const b:Bounds=[table.xs[cell.column],table.ys[ri],table.xs[cell.column+cell.colSpan],table.ys[Math.min(table.ys.length-1,ri+cell.rowSpan)]]
        const nested=tables.filter(candidate=>candidate!==table&&candidate.page===page.page&&contains(b,candidate.bounds)&&!contains(candidate.bounds,table.bounds))
        const direct=nested.filter(candidate=>!nested.some(other=>other!==candidate&&contains(other.bounds,candidate.bounds)))
        if(direct.length){
          const remainder=textLines(page.spans.filter(span=>inside(span,b)&&!direct.some(candidate=>inside(span,candidate.bounds)))).map(line=>line.text).join('\n')
          cell.text=remainder
          cell.blocks=[...(remainder?[{type:'paragraph' as const,text:remainder}]:[]),...direct.map(candidate=>cellBlock(candidate.grid,`Reconstructed technical table · page ${page.page}`))]
        }
      }
      if(kind==='minutes'){
        for(const cell of grid[0]??[]){
          if(normalize(cell.text)==='action'){cell.text='Action by';cell.blocks=[{type:'paragraph',text:'Action by'}]}
        }
        lastHeader=structuredClone(grid[0])
        lastMinutesTable=table
      }else if(kind==='other'&&lastHeader&&lastHeader.length===grid[0]?.length&&(grid.some(row=>/^\d+\.\d+/.test(row[0]?.text??''))||(lastMinutesTable&&table.page===lastMinutesTable.page+1&&Math.abs(table.bounds[0]-lastMinutesTable.bounds[0])<4&&Math.abs(table.bounds[2]-lastMinutesTable.bounds[2])<4))){
        grid.unshift(structuredClone(lastHeader))
        lastMinutesTable=table
        warnings.add(`Page ${page.page}: a missing minutes header was inferred; verify column mapping.`)
      }
      xml+=tableXml(grid)
      const rowMap=grid.map((row,index)=>{
        if(kind!=='minutes')return index+1
        const ref=row[0]?.text.replace(/\s/g,'')
        const original=table.grid.findIndex(sourceRow=>sourceRow.some(cell=>cell.text.replace(/\s/g,'')===ref))
        return original>=0?original+1:1
      })
      syntheticMaps.push({table,originalIndex:tables.indexOf(table)+1,rowMap})
    }
  }
  const meeting=parseDocxXml(`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${xml}</w:body></w:document>`,filename.replace(/\.pdf$/i,'.docx'))
  const mapAnchor=(anchor:{table:number;row:number;page?:number})=>{
    const mapping=syntheticMaps[anchor.table-1]
    return mapping?{...anchor,row:mapping.rowMap[anchor.row-1]??anchor.row,table:mapping.originalIndex,page:mapping.table.page}:{...anchor,page:paragraphPages[anchor.row-1]??1}
  }
  meeting.items=meeting.items.map(item=>({...item,source:{...item.source,...mapAnchor(item.source),confidence:Math.min(item.source.confidence,.7),continuations:item.source.continuations?.map(mapAnchor)}}))
  // Action summaries often precede the discussion record. Merge only exact unique references.
  for(const table of actionTables){
    const header=table.grid[0]??[]
    const column=(label:RegExp)=>header.find(cell=>label.test(normalize(cell.text)))?.column
    const refColumn=column(/^(itemref|reference)$/),actionColumn=column(/^requiredaction$/),dateColumn=column(/^(deadline|due|duedate)$/)
    for(const row of table.grid.slice(1)){
      const value=(index:number|undefined)=>row.find(cell=>cell.column===index)?.text.trim()??''
      const ref=value(refColumn).replace(/\.$/,'')
      const matches=meeting.items.filter(item=>item.type==='minute'&&item.itemRef===ref)
      if(matches.length!==1||!value(actionColumn))continue
      const item=matches[0],rawDate=value(dateColumn)
      item.action={id:item.action?.id??crypto.randomUUID(),actionRef:item.action?.actionRef??`ACT-${ref}`,requiredAction:value(actionColumn),owner:item.action?.owner??item.owner,deadline:/^\d{4}-\d{2}-\d{2}$/.test(rawDate)?rawDate:item.action?.deadline??'',status:item.action?.status??'Open'}
      item.source.continuations=[...(item.source.continuations??[]),{page:table.page,table:tables.indexOf(table)+1,row:table.grid.indexOf(row)+1}]
    }
  }
  meeting.sourceFormat='PDF';meeting.sourceFile=filename
  // A repeated reference at a page break is usually the same continued minute.
  // Only adjacent matches on different pages are combined; other duplicates stay flagged.
  const mergedIds=new Map<string,string>()
  meeting.items=meeting.items.reduce<MeetingDocument['items']>((result,item)=>{
    const previous=result.at(-1)
    if(previous&&previous.itemRef===item.itemRef&&previous.source.page!==item.source.page){
      previous.blocks.push(...item.blocks)
      mergedIds.set(item.id,previous.id)
      previous.source.continuations=[...(previous.source.continuations??[]),{page:item.source.page,table:item.source.table,row:item.source.row},...(item.source.continuations??[])]
      warnings.add(`Reference ${item.itemRef}: combined an adjacent cross-page continuation; verify against both pages.`)
    }else result.push(item)
    return result
  },[])
  meeting.items.forEach(item=>{if(item.parentId&&mergedIds.has(item.parentId))item.parentId=mergedIds.get(item.parentId)})
  meeting.title=meeting.title.replace(/\.docx$/i,'')
  meeting.importEvidence={tables:evidenceTables,paragraphs:pages.flatMap(page=>textLines(page.spans).map(line=>`Page ${page.page}: ${line.text}`)),pdfPages:pages,warnings:[...warnings,...(meeting.importEvidence?.warnings??[]).filter(warning=>!warning.includes('Word')&&!warning.includes('Table ')&&!meeting.items.some(item=>item.action?.deadline&&warning===`${item.itemRef}: verify the action deadline; no unambiguous date was found.`))]}
  meeting.importEvidence.warnings.push('PDF tables and merged cells are reconstructed from drawing lines and text positions. Verify technical tables, repeated headers, cross-page continuations and action matches against the page preview.')
  if(!tables.length)meeting.importEvidence.warnings.push('No ruled tables were found. Numbered text was retained, but owners, statuses and column boundaries need manual review.')
  return meeting
}
