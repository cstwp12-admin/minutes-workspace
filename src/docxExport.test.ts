import { Packer } from 'docx'
import { describe, expect, it } from 'vitest'
import { createMeetingDocxDocument } from './docxExport'
import { defaultExportProfile } from './ExportView'
import { sampleMeeting } from './fixtures'

describe('editable Word export',()=>{
  it('creates a valid Office Open XML package',async()=>{
    const bytes=await Packer.toBuffer(createMeetingDocxDocument(sampleMeeting,defaultExportProfile))
    expect(bytes.byteLength).toBeGreaterThan(5000)
    expect(Array.from(bytes.slice(0,2))).toEqual([0x50,0x4b])
  })
})
