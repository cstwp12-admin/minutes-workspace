// @vitest-environment node
import { beforeAll,describe,expect,it } from 'vitest'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { importPdf } from './pdfImport'
import { fictionalPdf,makePdf } from './test/pdfFixture'

beforeAll(()=>{
  const {JSDOM}=createRequire(import.meta.url)('jsdom')
  globalThis.DOMParser=new JSDOM('').window.DOMParser
  pdfjs.GlobalWorkerOptions.workerSrc=pathToFileURL(createRequire(import.meta.url).resolve('pdfjs-dist/legacy/build/pdf.worker.min.mjs')).href
})
const file=(bytes:Uint8Array)=>({name:'fictional.pdf',size:bytes.length,arrayBuffer:async()=>bytes.slice().buffer} as File)

describe('searchable PDF import',()=>{
  it('reads real PDF bytes, reconstructs tables and tracks cross-page continuations',async()=>{
    const meeting=await importPdf(file(fictionalPdf()))
    expect(meeting.sourceFormat).toBe('PDF')
    expect(meeting.importEvidence?.pdfPages).toHaveLength(3)
    const minute=meeting.items.find(item=>item.itemRef==='1.1')!
    expect(minute).toBeDefined()
    expect(minute.source.page).toBe(1)
    expect(minute.source.continuations?.some(anchor=>anchor.page===2)).toBe(true)
    expect(minute.action).toMatchObject({owner:'Team',deadline:'2026-11-05',requiredAction:'Publish the plan'})
    expect(minute.blocks.some(block=>block.type==='metric_table')).toBe(true)
    expect(meeting.items.find(item=>item.itemRef==='1.2')?.source.page).toBe(2)
    expect(meeting.items.find(item=>item.itemRef==='1.2')?.action).toMatchObject({requiredAction:'Provide closeout evidence',deadline:'2026-11-07'})
  })
  it('rejects empty scanned-style files and invalid PDF bytes clearly',async()=>{
    await expect(importPdf(file(makePdf([''])))).rejects.toThrow('OCR')
    await expect(importPdf(file(new Uint8Array([1,2,3])))).rejects.toThrow('valid')
  })
  it('retains mixed searchable/scanned pages and enforces document limits',async()=>{
    const one=makePdf(['','BT /F1 10 Tf 40 700 Td (1.1 Searchable item) Tj ET'])
    const meeting=await importPdf(file(one))
    expect(meeting.importEvidence?.warnings.some(note=>note.includes('Page 1 has no extractable text'))).toBe(true)
    expect(meeting.items[0].source.page).toBe(2)
    await expect(importPdf({...file(one),size:15_000_001})).rejects.toThrow('15 MB')
    await expect(importPdf(file(makePdf(Array.from({length:101},()=>''))))).rejects.toThrow('100 pages')
  })
})
