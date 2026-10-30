import { createOcrSession, scanCanvas, checkOcrAbort } from './ocrEngine'
import { ruledTables } from './pdfGeometry'
import { reconstructPdf } from './pdfReconstruction'

export async function importImage(file:File,progress:(message:string)=>void=()=>{},signal?:AbortSignal){
  if(!/\.(png|jpe?g)$/i.test(file.name))throw new Error('Choose a PNG or JPEG scan.')
  if(file.size>15_000_000)throw new Error('Choose an image smaller than 15 MB.')
  checkOcrAbort(signal)
  const bitmap=await createImageBitmap(file)
  let session:Awaited<ReturnType<typeof createOcrSession>>|undefined
  try{
    const {canvas,context,scale}=scanCanvas(bitmap.width,bitmap.height)
    context.drawImage(bitmap,0,0,canvas.width,canvas.height)
    session=await createOcrSession(progress,signal)
    const result=await session.recognize(canvas,1,scale)
    if(!result.spans.length)throw new Error('No text was recognized. Try a sharper, upright scan with English printed text.')
    const meeting=reconstructPdf([{page:1,width:bitmap.width,height:bitmap.height,spans:result.spans,origin:'ocr'}],ruledTables(1,result.spans,result.rulings),file.name,[])
    meeting.sourceFormat='IMAGE';meeting.importEvidence!.ocrPages=[result.evidence]
    meeting.importEvidence!.warnings.push('English OCR can misread references, numbers and table cells. Compare every item and technical table with the original image. Page transcripts do not automatically update structured minutes.')
    return meeting
  }finally{bitmap.close();await session?.close()}
}
