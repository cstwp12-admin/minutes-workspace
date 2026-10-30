import { useEffect, useRef, useState } from 'react'

export function PdfSourcePreview({file,page}:{file:File;page:number}){
  const canvas=useRef<HTMLCanvasElement>(null)
  const [message,setMessage]=useState('')
  useEffect(()=>{
    let active=true
    setMessage(`Rendering source page ${page}…`)
    const target=document.createElement('canvas')
    void import('./pdfImport').then(module=>module.renderPdfPage(file,page,target)).then(()=>{
      if(!active||!canvas.current)return
      canvas.current.width=target.width;canvas.current.height=target.height
      canvas.current.getContext('2d')?.drawImage(target,0,0)
      setMessage('')
    }).catch(()=>{if(active)setMessage('The page preview could not be rendered. Check the original PDF and the extracted source evidence below.')})
    return ()=>{active=false}
  },[file,page])
  return <section className="pdf-source"><h3>Original PDF · page {page}</h3>{message&&<p role="status">{message}</p>}<canvas ref={canvas} aria-label={`Original PDF page ${page}`} hidden={!!message}/></section>
}
