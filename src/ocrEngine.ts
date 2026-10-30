import { createWorker, OEM, PSM } from 'tesseract.js'
import { rasterRulings, wordSpans } from './ocrGeometry'

export function checkOcrAbort(signal?:AbortSignal){if(signal?.aborted)throw new DOMException('Import cancelled.','AbortError')}
export async function createOcrSession(progress:(message:string)=>void,signal?:AbortSignal){
  checkOcrAbort(signal)
  const assets=new URL('ocr/',new URL(import.meta.env.BASE_URL,window.location.href)).href
  let pageNumber=1,stopped=false
  let rejectAbort:((reason:unknown)=>void)|undefined
  const aborted=new Promise<never>((_,reject)=>{rejectAbort=reject})
  const pending=createWorker('eng',OEM.LSTM_ONLY,{workerPath:`${assets}worker.min.js`,corePath:assets,langPath:assets,gzip:true,workerBlobURL:false,cacheMethod:'none',errorHandler:()=>rejectAbort?.(new Error('OCR could not finish. Check the scan and your connection for the recognition assets, then try again.')),logger:event=>{if(!stopped)progress(`OCR page ${pageNumber}: ${event.status} ${Math.round(event.progress*100)||0}%`)}})
  // Cancellation during engine initialization must also terminate the eventual worker.
  let worker:Awaited<typeof pending>|undefined
  const cancel=()=>{stopped=true;rejectAbort?.(new DOMException('Import cancelled.','AbortError'));if(worker)void worker.terminate()}
  signal?.addEventListener('abort',cancel,{once:true})
  void pending.then(value=>{worker=value;if(stopped)void value.terminate()},()=>{})
  try{
    worker=await Promise.race([pending,aborted]);checkOcrAbort(signal)
    await worker.setParameters({tessedit_pageseg_mode:PSM.AUTO,preserve_interword_spaces:'1',user_defined_dpi:'200'})
    return {
      async recognize(canvas:HTMLCanvasElement,page:number,scale:number){
        checkOcrAbort(signal);pageNumber=page
        const context=canvas.getContext('2d');if(!context)throw new Error('This browser cannot read scan images.')
        const rulings=rasterRulings(context.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height,scale)
        const {data}=await Promise.race([worker!.recognize(canvas,{}, {blocks:true,text:true}),aborted]);checkOcrAbort(signal)
        const words=(data.blocks??[]).flatMap(block=>block.paragraphs.flatMap(paragraph=>paragraph.lines.flatMap(line=>line.words)))
        return {spans:wordSpans(words,scale),rulings,evidence:{page,confidence:data.confidence,text:data.text,reviewed:false}}
      },
      async close(){stopped=true;signal?.removeEventListener('abort',cancel);if(!signal?.aborted)await worker!.terminate()},
    }
  }catch(error){stopped=true;signal?.removeEventListener('abort',cancel);if(worker&&!signal?.aborted)await worker.terminate();throw error}
}

export function scanCanvas(width:number,height:number){
  if(!Number.isFinite(width*height)||width<=0||height<=0||width*height>40_000_000)throw new Error('The scan is too large. Resize it below 40 megapixels.')
  const scale=Math.min(2.5,2200/Math.max(width,height))
  const canvas=document.createElement('canvas');canvas.width=Math.ceil(width*scale);canvas.height=Math.ceil(height*scale)
  const context=canvas.getContext('2d');if(!context)throw new Error('This browser cannot render scan images.')
  context.fillStyle='white';context.fillRect(0,0,canvas.width,canvas.height)
  return {canvas,context,scale}
}
