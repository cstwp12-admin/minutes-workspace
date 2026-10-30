import type { PdfTextSpan, SourceCell } from './model'

export type Bounds=[number,number,number,number]
export interface Ruling {x1:number;y1:number;x2:number;y2:number}
export interface PdfTable {page:number; bounds:Bounds; xs:number[]; ys:number[]; grid:SourceCell[][]}
const near=(a:number,b:number)=>Math.abs(a-b)<2
const unique=(values:number[])=>values.sort((a,b)=>a-b).filter((value,index,array)=>!index||value-array[index-1]>2)
export const contains=(outer:Bounds,inner:Bounds)=>outer[0]<=inner[0]+1&&outer[1]<=inner[1]+1&&outer[2]>=inner[2]-1&&outer[3]>=inner[3]-1
export const inside=(span:PdfTextSpan,b:Bounds)=>span.x+span.width/2>=b[0]-1&&span.x+span.width/2<=b[2]+1&&span.y-span.height/2>=b[1]-1&&span.y-span.height/2<=b[3]+1

export function textLines(spans:PdfTextSpan[]):{text:string;spans:PdfTextSpan[];y:number}[]{
  const rows:{text:string;spans:PdfTextSpan[];y:number}[]=[]
  for(const span of [...spans].sort((a,b)=>a.y-b.y||a.x-b.x)){
    const row=rows.at(-1)
    if(row&&Math.abs(row.y-span.y)<=Math.max(2,span.height*.28))row.spans.push(span)
    else rows.push({text:'',spans:[span],y:span.y})
  }
  for(const row of rows){row.spans.sort((a,b)=>a.x-b.x);row.text=row.spans.map(span=>span.text).join(' ').replace(/\s+/g,' ').trim()}
  return rows
}

export function ruledTables(page:number,spans:PdfTextSpan[],input:Ruling[]):PdfTable[]{
  const raw=input.filter(line=>Math.hypot(line.x2-line.x1,line.y2-line.y1)>8).map(line=>({x1:Math.min(line.x1,line.x2),y1:Math.min(line.y1,line.y2),x2:Math.max(line.x1,line.x2),y2:Math.max(line.y1,line.y2)}))
  // Word-produced PDFs often draw each cell border several times. Collapse those
  // overlapping strokes before finding connected grid components.
  const lines:Ruling[]=[]
  for(const orientation of ['horizontal','vertical']){
    const horizontal=orientation==='horizontal'
    const candidates=raw.filter(line=>horizontal?near(line.y1,line.y2):near(line.x1,line.x2)).map(line=>({coordinate:horizontal?line.y1:line.x1,start:horizontal?line.x1:line.y1,end:horizontal?line.x2:line.y2})).sort((a,b)=>a.coordinate-b.coordinate||a.start-b.start)
    const groups:{coordinate:number;intervals:{start:number;end:number}[]}[]=[]
    for(const entry of candidates){const group=groups.at(-1);if(group&&near(group.coordinate,entry.coordinate))group.intervals.push(entry);else groups.push({coordinate:entry.coordinate,intervals:[entry]})}
    for(const group of groups){
      const intervals:{start:number;end:number}[]=[]
      for(const interval of group.intervals.sort((a,b)=>a.start-b.start)){const last=intervals.at(-1);if(last&&interval.start<=last.end+2)last.end=Math.max(last.end,interval.end);else intervals.push({...interval})}
      for(const interval of intervals)lines.push(horizontal?{x1:interval.start,y1:group.coordinate,x2:interval.end,y2:group.coordinate}:{x1:group.coordinate,y1:interval.start,x2:group.coordinate,y2:interval.end})
    }
  }
  if(lines.length>2500)throw new Error('This PDF page contains too many drawing lines. Split or simplify the document.')
  const parents=lines.map((_,index)=>index)
  const root=(i:number):number=>parents[i]===i?i:(parents[i]=root(parents[i]))
  for(let i=0;i<lines.length;i++)for(let j=i+1;j<lines.length;j++){
    const a=lines[i],b=lines[j]
    if(a.x1<=b.x2+4&&a.x2>=b.x1-4&&a.y1<=b.y2+4&&a.y2>=b.y1-4)parents[root(j)]=root(i)
  }
  const groups=new Map<number,Ruling[]>()
  lines.forEach((line,index)=>{const key=root(index);groups.set(key,[...(groups.get(key)??[]),line])})
  const tables:PdfTable[]=[]
  for(const group of groups.values()){
    const horizontal=group.filter(line=>near(line.y1,line.y2)),vertical=group.filter(line=>near(line.x1,line.x2))
    const xs=unique(vertical.map(line=>(line.x1+line.x2)/2)),ys=unique(horizontal.map(line=>(line.y1+line.y2)/2))
    if(xs.length<3||ys.length<2||xs.length>61||ys.length>501)continue
    const bounds:Bounds=[xs[0],ys[0],xs.at(-1)!,ys.at(-1)!]
    if(!spans.some(span=>inside(span,bounds)))continue
    const covered=new Set<string>(),grid:SourceCell[][]=[]
    for(let r=0;r<ys.length-1;r++){
      const row:SourceCell[]=[]
      for(let c=0;c<xs.length-1;c++){
        if(covered.has(r+':'+c))continue
        const cy=(ys[r]+ys[r+1])/2
        let end=c+1
        while(end<xs.length-1&&!vertical.some(line=>near(line.x1,xs[end])&&line.y1<=cy+1&&line.y2>=cy-1))end++
        let bottom=r+1
        while(bottom<ys.length-1&&!horizontal.some(line=>near(line.y1,ys[bottom])&&line.x1<=(xs[c]+xs[end])/2+1&&line.x2>=(xs[c]+xs[end])/2-1))bottom++
        for(let rr=r;rr<bottom;rr++)for(let cc=c;cc<end;cc++)covered.add(rr+':'+cc)
        const b:Bounds=[xs[c],ys[r],xs[end],ys[bottom]]
        const value=textLines(spans.filter(span=>inside(span,b))).map(line=>line.text).join('\n')
        row.push({column:c,text:value,colSpan:end-c,rowSpan:bottom-r,blocks:value?[{type:'paragraph',text:value}]:[]})
      }
      grid.push(row)
    }
    tables.push({page,bounds,xs,ys,grid})
  }
  return tables.sort((a,b)=>a.bounds[1]-b.bounds[1]||a.bounds[0]-b.bounds[0])
}
