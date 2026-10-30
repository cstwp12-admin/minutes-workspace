import { useEffect, useState } from 'react'
export function ImageSourcePreview({file}:{file:File}){
  const [url,setUrl]=useState('')
  useEffect(()=>{const value=URL.createObjectURL(file);setUrl(value);return()=>URL.revokeObjectURL(value)},[file])
  return <section className="pdf-source"><h2>Original scan</h2>{url&&<img src={url} alt="Original imported meeting scan" style={{maxWidth:'100%',height:'auto'}}/>}</section>
}
