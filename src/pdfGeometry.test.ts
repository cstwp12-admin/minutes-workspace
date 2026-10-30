import {describe,expect,it} from 'vitest'
import {ruledTables,textLines,type Ruling} from './pdfGeometry'
import {reconstructPdf} from './pdfReconstruction'

describe('PDF geometry reconstruction',()=>{
  it('keeps reading order and preserves horizontal and vertical cell merges',()=>{
    const lines:Ruling[]=[
      {x1:0,y1:0,x2:100,y2:0},{x1:0,y1:20,x2:100,y2:20},{x1:50,y1:40,x2:100,y2:40},{x1:0,y1:60,x2:100,y2:60},
      {x1:0,y1:0,x2:0,y2:60},{x1:100,y1:0,x2:100,y2:60},{x1:50,y1:20,x2:50,y2:60}
    ]
    const spans=[{text:'Heading',x:5,y:12,width:30,height:8},{text:'Merged value',x:5,y:32,width:30,height:8}]
    const table=ruledTables(1,spans,lines)[0]
    expect(table.grid[0][0].colSpan).toBe(2)
    expect(table.grid[1][0].rowSpan).toBe(2)
    expect(textLines([...spans].reverse())[0].text).toBe('Heading')
  })
  it('retains searchable unruled text with a source page and review warning',()=>{
    const result=reconstructPdf([{page:1,width:600,height:800,spans:[{text:'1.1 Review the delivery plan',x:40,y:100,width:200,height:10}]}],[],'example.pdf')
    expect(result.sourceFormat).toBe('PDF')
    expect(result.items[0].source.page).toBe(1)
    expect(result.importEvidence?.warnings.some(note=>note.includes('No ruled tables'))).toBe(true)
  })
})
