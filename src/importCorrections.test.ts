import { describe,expect,it } from 'vitest'
import { parseDocxXml } from './docxImport'
import { fictionalMinutesXml } from './test/docxFixture'
import { importProblems,mapImportTable,mergeImportItem,moveImportItem,reparentImportItem,splitImportItem } from './importCorrections'

describe('import corrections',()=>{
  it('splits without losing technical content or duplicating actions and leaves evidence intact',()=>{
    const meeting=parseDocxXml(fictionalMinutesXml),original=JSON.stringify(meeting.importEvidence)
    const item=meeting.items.find(item=>item.itemRef==='1.1')!
    const result=splitImportItem(meeting,item.id,1,'1.1-part2')
    const split=result.items.find(item=>item.itemRef==='1.1-part2')!
    expect(split.blocks.some(block=>block.type==='metric_table')).toBe(true)
    expect(split.action).toBeUndefined()
    expect(result.items.find(entry=>entry.id===item.id)?.action).toEqual(item.action)
    expect(JSON.stringify(result.importEvidence)).toBe(original)
    expect(meeting.items.find(entry=>entry.id===item.id)?.blocks.length).toBeGreaterThan(1)
  })
  it('moves subtrees, updates descendant depths and rejects cycles',()=>{
    const meeting=parseDocxXml(fictionalMinutesXml),parent=meeting.items.find(item=>item.itemRef==='1.1')!,child=meeting.items.find(item=>item.itemRef==='1.1(a)')!
    const changed=reparentImportItem(meeting,parent.id)
    expect(changed.items.find(item=>item.id===parent.id)?.depth).toBe(0)
    expect(changed.items.find(item=>item.id===child.id)?.depth).toBe(1)
    expect(()=>reparentImportItem(meeting,parent.id,child.id)).toThrow('earlier')
    const sibling={...structuredClone(parent),id:'sibling',itemRef:'1.2',blocks:[],action:undefined}
    const moved=moveImportItem({...meeting,items:[...meeting.items,sibling]},sibling.id,-1)
    expect(moved.items.findIndex(item=>item.id==='sibling')).toBeLessThan(moved.items.findIndex(item=>item.id===parent.id))
    expect(importProblems(moved)).toEqual([])
  })
  it('refuses to discard a second action during merging',()=>{
    const meeting=parseDocxXml(fictionalMinutesXml),first=meeting.items.find(item=>item.itemRef==='1.1')!
    const second={...structuredClone(first),id:'second',itemRef:'1.2'}
    const draft={...meeting,items:[meeting.items[0],first,second]}
    expect(()=>mergeImportItem(draft,'second')).toThrow('Both items have actions')
    second.action=undefined
    const merged=mergeImportItem(draft,'second')
    expect(merged.items).toHaveLength(2)
    expect(merged.items[1].source.continuations).toHaveLength(1)
  })
  it('remaps unusual columns, retains continuation content and supports raw-row attachment',()=>{
    const meeting=parseDocxXml(fictionalMinutesXml),evidence=JSON.stringify(meeting.importEvidence)
    const mapped=mapImportTable(meeting,3,{reference:0,subject:1,owner:2,status:3,deadline:4,firstRow:2,lastRow:5},'replace')
    expect(mapped.items.find(item=>item.itemRef==='1.1')?.blocks.some(block=>block.type==='metric_table')).toBe(true)
    expect(mapped.items.find(item=>item.itemRef==='1.1.1')?.blocks.some(block=>block.type==='paragraph'&&block.text.includes('Continued discussion'))).toBe(true)
    expect(importProblems(mapped)).toEqual([])
    const attached=mapImportTable(meeting,1,{reference:0,subject:1,firstRow:1,lastRow:1},'continuation',meeting.items[1].id)
    expect(attached.items[1].blocks.at(-1)?.type).toBe('metric_table')
    expect(JSON.stringify(attached.importEvidence)).toBe(evidence)
    expect(()=>mapImportTable(meeting,3,{reference:0,subject:0,firstRow:1,lastRow:3},'append')).toThrow('different')
  })
})
