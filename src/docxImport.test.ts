import { describe,expect,it } from 'vitest'
import { zipSync,strToU8,unzipSync,strFromU8 } from 'fflate'
import { Packer } from 'docx'
import { importDocx,parseDocxXml } from './docxImport'
import { createMeetingDocxDocument } from './docxExport'
import { defaultExportProfile } from './ExportView'

import { fictionalMinutesXml, p, wrap } from './test/docxFixture'

describe('DOCX import and export',()=>{
  it('extracts metadata, hierarchy, attendance and honest source anchors',()=>{
    const result=parseDocxXml(fictionalMinutesXml)
    expect(result.date).toBe('2026-10-29')
    expect(result.chair).toBe('Team lead')
    expect(result.participants?.[0].attendance).toBe('expected')
    const minute=result.items.find(i=>i.itemRef==='1.1')!
    expect(minute.parentId).toBe(result.items.find(i=>i.itemRef==='1.0')!.id)
    expect(minute.source).toMatchObject({table:3,row:3})
    expect(minute.source.page).toBeUndefined()
    expect(minute.action?.owner).toBe('Delivery team')
    expect(minute.action?.deadline).toBe('2026-11-05')
    expect(result.items.find(i=>i.itemRef==='1.1(a)')?.parentId).toBe(minute.id)
    expect(result.items.find(i=>i.itemRef==='1.1.1')?.parentId).toBe(minute.id)
    expect(result.importStatus).toBe('review')
  })
  it('preserves embedded grids and spans through editable Word output',async()=>{
    const meeting=parseDocxXml(fictionalMinutesXml)
    const block=meeting.items.find(i=>i.itemRef==='1.1')!.blocks.find(b=>b.type==='metric_table')!
    expect(block.type==='metric_table'&&block.grid?.[0][0].colSpan).toBe(2)
    expect(block.type==='metric_table'&&block.grid?.[1][0].rowSpan).toBe(2)
    const output=await Packer.toBuffer(createMeetingDocxDocument(meeting,defaultExportProfile))
    const xml=strFromU8(unzipSync(new Uint8Array(output))['word/document.xml'])
    expect(xml).toContain('w:gridSpan')
    expect(xml).toContain('w:vMerge')
    expect(xml).toContain('Alpha')
    expect(xml).toContain('Verify the evidence')
  })
  it('retains unmatched text and rejects malformed or entity-bearing XML',()=>{
    expect(parseDocxXml(wrap(p('Unstructured text'))).items[0].blocks).toContainEqual({type:'paragraph',text:'Unstructured text'})
    expect(()=>parseDocxXml('<broken')).toThrow('invalid XML')
    expect(()=>parseDocxXml('<!DOCTYPE x>'+wrap(''))).toThrow('entity')
  })
  it('reads actual zipped DOCX bytes and rejects other uploads',async()=>{
    const bytes=zipSync({'word/document.xml':strToU8(fictionalMinutesXml)})
    const file={name:'example.docx',size:bytes.length,arrayBuffer:async()=>bytes.buffer} as File
    expect((await importDocx(file)).items.length).toBeGreaterThan(2)
    await expect(importDocx({...file,name:'example.pdf'} as File)).rejects.toThrow('PDF')
    await expect(importDocx({...file,arrayBuffer:async()=>new Uint8Array([1,2,3]).buffer} as File)).rejects.toThrow('could not be read')
  })
  it('includes inserted text and excludes deleted content',()=>{
    const xml=wrap('<w:p><w:ins>'+p('Accepted content')+'</w:ins><w:del>'+p('Deleted content')+'</w:del></w:p>')
    const result=parseDocxXml(xml)
    expect(result.importEvidence?.paragraphs.join('')).toContain('Accepted content')
    expect(result.importEvidence?.paragraphs.join('')).not.toContain('Deleted content')
  })
})
