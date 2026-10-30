import { describe,expect,it } from 'vitest'
import { wordNumberingLabels } from './wordNumbering'
import { parseDocxXml,importDocx } from './docxImport'
import { zipSync,strToU8 } from 'fflate'
import { wrap,p } from './test/docxFixture'

const ns='http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const numbering=`<w:numbering xmlns:w="${ns}"><w:abstractNum w:abstractNumId="9"><w:lvl w:ilvl="0"><w:start w:val="3"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/></w:lvl><w:lvl w:ilvl="1"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1.%2."/></w:lvl><w:lvl w:ilvl="2"><w:start w:val="1"/><w:numFmt w:val="lowerLetter"/><w:lvlText w:val="%3)"/></w:lvl></w:abstractNum><w:num w:numId="99"><w:abstractNumId w:val="9"/><w:lvlOverride w:ilvl="2"><w:startOverride w:val="2"/></w:lvlOverride></w:num></w:numbering>`
const styles=`<w:styles xmlns:w="${ns}"><w:style w:styleId="Base"><w:pPr><w:numPr><w:numId w:val="99"/><w:ilvl w:val="0"/></w:numPr></w:pPr></w:style><w:style w:styleId="Agenda"><w:basedOn w:val="Base"/></w:style></w:styles>`
const numbered=(level:number,text:string)=>`<w:p><w:pPr><w:numPr><w:numId w:val="99"/><w:ilvl w:val="${level}"/></w:numPr></w:pPr><w:r><w:t>${text}</w:t></w:r></w:p>`
const heading='<w:p><w:pPr><w:pStyle w:val="Agenda"/></w:pPr><w:r><w:t>Delivery</w:t></w:r></w:p>'
const document=wrap(p('Example Meeting')+heading+numbered(1,'First minute')+numbered(2,'First response')+numbered(2,'Second response')+numbered(1,'Second minute')+numbered(2,'Restarted response'))

describe('Word automatic numbering',()=>{
  it('restores inherited styles, multiple levels, overrides and restarts without nesting sibling subactions',()=>{
    const meeting=parseDocxXml(document,'example.docx',numbering,styles)
    expect(meeting.items.map(item=>item.itemRef)).toEqual(['3','3.1','3.1(b)','3.1(c)','3.2','3.2(b)'])
    expect(meeting.items[0].type).toBe('section')
    expect(meeting.items[2].parentId).toBe(meeting.items[1].id)
    expect(meeting.items[3].parentId).toBe(meeting.items[1].id)
    expect(meeting.items[5].parentId).toBe(meeting.items[4].id)
  })
  it('loads numbering and styles from an actual archive',async()=>{
    const bytes=zipSync({'word/document.xml':strToU8(document),'word/numbering.xml':strToU8(numbering),'word/styles.xml':strToU8(styles)})
    const file={name:'example.docx',size:bytes.length,arrayBuffer:async()=>bytes.buffer} as File
    const meeting=await importDocx(file)
    expect(meeting.items.some(item=>item.itemRef==='3.2(b)')).toBe(true)
  })
  it('formats Roman labels and reports missing definitions instead of inventing references',()=>{
    const body=new DOMParser().parseFromString(wrap(numbered(0,'One')+numbered(0,'Two')),'application/xml').getElementsByTagNameNS(ns,'body')[0]
    const roman=numbering.replace('w:val="decimal"','w:val="upperRoman"')
    expect([...wordNumberingLabels(body,roman).labels.values()].map(label=>label.text)).toEqual(['III.','IV.'])
    expect(wordNumberingLabels(body).warnings.join(' ')).toContain('could not be resolved')
    expect(()=>wordNumberingLabels(body,'<!DOCTYPE x>')).toThrow('entities')
  })
  it('keeps repeated inferred list labels unique and explicitly flagged for review',()=>{
    const meeting=parseDocxXml(wrap(p('1.1 Technical review')+p('i) First list')+p('i) Restarted list')))
    expect(meeting.items.map(item=>item.itemRef)).toEqual(['1.1','1.1(i)','1.1(i)-2'])
    expect(meeting.importEvidence?.warnings.some(note=>note.includes('temporary unique suffix'))).toBe(true)
  })
})
