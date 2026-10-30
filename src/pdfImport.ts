import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'
import type { PdfPageEvidence } from './model'
import { ruledTables, type PdfTable, type Ruling } from './pdfGeometry'
import { reconstructPdf } from './pdfReconstruction'

pdfjs.GlobalWorkerOptions.workerSrc=workerUrl
type Progress=(message:string)=>void
const transformPoint=(x:number,y:number,m:number[])=>({x:m[0]*x+m[2]*y+m[4],y:m[1]*x+m[3]*y+m[5]})

export async function importPdf(file:File,onProgress:Progress=()=>{}){
  if(!/\.pdf$/i.test(file.name))throw new Error('Choose a PDF document.')
  if(file.size>15_000_000)throw new Error('Choose a PDF smaller than 15 MB.')
  const task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),useSystemFonts:true,disableFontFace:true,useWorkerFetch:false})
  try{
    const document=await task.promise
    if(document.numPages>100)throw new Error('This PDF exceeds 100 pages. Split it into smaller documents before importing.')
    const pages:PdfPageEvidence[]=[],tables:PdfTable[]=[],warnings:string[]=[]
    let characters=0
    for(let n=1;n<=document.numPages;n++){
      onProgress(`Reading PDF page ${n} of ${document.numPages}…`)
      const page=await document.getPage(n),viewport=page.getViewport({scale:1})
      const content=await page.getTextContent()
      const spans=content.items.flatMap(item=>{
        if(!('str' in item)||!item.str.trim())return []
        const matrix=pdfjs.Util.transform(viewport.transform,item.transform)
        const span={text:item.str,x:matrix[4],y:matrix[5],width:Math.abs(item.width),height:Math.max(1,Math.hypot(matrix[2],matrix[3]))}
        if(!Object.values(span).every(value=>typeof value==='string'||Number.isFinite(value)))return []
        return [span]
      })
      characters+=spans.reduce((sum,span)=>sum+span.text.length,0)
      if(characters>2_000_000||content.items.length>30000)throw new Error('This PDF contains too much text for one import. Split it into smaller documents.')
      if(!spans.length)warnings.push(`Page ${n} has no extractable text and may be scanned. OCR is not included in this phase.`)
      const evidence={page:n,width:viewport.width,height:viewport.height,spans}
      pages.push(evidence)
      const ops=await page.getOperatorList(),rulings:Ruling[]=[]
      if(ops.fnArray.length>250000)throw new Error('A PDF page is too complex to reconstruct. Split or simplify the file.')
      let matrix=[1,0,0,1,0,0];const stack:number[][]=[]
      const add=(x1:number,y1:number,x2:number,y2:number)=>{
        const m=pdfjs.Util.transform(viewport.transform,matrix),a=transformPoint(x1,y1,m),b=transformPoint(x2,y2,m)
        if(Math.abs(a.x-b.x)<1||Math.abs(a.y-b.y)<1)rulings.push({x1:a.x,y1:a.y,x2:b.x,y2:b.y})
      }
      ops.fnArray.forEach((operation,index)=>{
        const args=ops.argsArray[index]
        if(operation===pdfjs.OPS.save)stack.push([...matrix])
        else if(operation===pdfjs.OPS.restore)matrix=stack.pop()??[1,0,0,1,0,0]
        else if(operation===pdfjs.OPS.transform)matrix=pdfjs.Util.transform(matrix,args)
        else if(operation===pdfjs.OPS.constructPath){
          // PDF.js 6 draw paths: move, line, cubic, quadratic, close.
          for(const path of args[1]??[]){
            if(!ArrayBuffer.isView(path)&&!Array.isArray(path))continue
            const data=Array.from(path as ArrayLike<number>);let x=0,y=0,sx=0,sy=0
            for(let i=0;i<data.length;){
              const command=data[i++]
              if(command===0){x=sx=data[i++];y=sy=data[i++]}
              else if(command===1){const nx=data[i++],ny=data[i++];add(x,y,nx,ny);x=nx;y=ny}
              else if(command===2){i+=4;x=data[i++];y=data[i++]}
              else if(command===3){i+=2;x=data[i++];y=data[i++]}
              else if(command===4){add(x,y,sx,sy);x=sx;y=sy}
              else break
            }
          }
        }
      })
      tables.push(...ruledTables(n,spans,rulings))
      page.cleanup()
      await new Promise(resolve=>setTimeout(resolve,0))
    }
    if(!characters)throw new Error('No searchable text was found. This PDF needs OCR, which will be added in a later phase.')
    return reconstructPdf(pages,tables,file.name,warnings)
  }catch(error){
    if(error instanceof Error&&error.name==='PasswordException')throw new Error('This PDF is password-protected. Export an unlocked copy before importing.')
    if(error instanceof Error&&['InvalidPDFException','MissingPDFException','UnknownErrorException'].includes(error.name))throw new Error('This PDF could not be read. Check that it is a valid, unlocked PDF.')
    throw error
  }finally{await task.destroy()}
}

export async function renderPdfPage(file:File,pageNumber:number,canvas:HTMLCanvasElement){
  const task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),useSystemFonts:true,useWorkerFetch:false})
  try{
    const document=await task.promise,page=await document.getPage(pageNumber),viewport=page.getViewport({scale:1.25})
    canvas.width=viewport.width;canvas.height=viewport.height
    await page.render({canvas,viewport}).promise
  }finally{await task.destroy()}
}
