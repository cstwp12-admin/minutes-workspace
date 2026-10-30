// @vitest-environment node
import { createRequire } from 'node:module'
import { createWorker, OEM, PSM } from 'tesseract.js'
import { wordSpans, rasterRulings } from './ocrGeometry'
import { ruledTables } from './pdfGeometry'
import { reconstructPdf } from './pdfReconstruction'

test('recognizes a real fictional raster and retains its technical values through reconstruction',async()=>{
  const require=createRequire(import.meta.url),pdfRequire=createRequire(require.resolve('pdfjs-dist/package.json'))
  const {createCanvas}=pdfRequire('@napi-rs/canvas'),{JSDOM}=require('jsdom')
  globalThis.DOMParser=new JSDOM('').window.DOMParser
  const canvas=createCanvas(1600,1200),context=canvas.getContext('2d')
  context.fillStyle='white';context.fillRect(0,0,1600,1200);context.fillStyle='black';context.font='32px Arial'
  context.fillText('Coordination Meeting',80,80)
  context.fillText('1.1 Review technical evidence',80,150)
  context.fillText('1.1.1 Confirm test results',80,210)
  context.fillText('Action: Team to publish the plan.',80,270)
  context.lineWidth=2;context.strokeStyle='black'
  for(const y of [350,450,550]){context.beginPath();context.moveTo(80,y);context.lineTo(1480,y);context.stroke()}
  for(const x of [80,780,1480]){context.beginPath();context.moveTo(x,350);context.lineTo(x,550);context.stroke()}
  context.fillText('Metric',110,410);context.fillText('Value',810,410)
  context.fillText('Checks',110,510);context.fillText('12',810,510)
  const worker=await createWorker('eng',OEM.LSTM_ONLY,{langPath:require('@tesseract.js-data/eng').langPath,cacheMethod:'none'})
  try{
    await worker.setParameters({tessedit_pageseg_mode:PSM.AUTO,preserve_interword_spaces:'1'})
    const {data}=await worker.recognize(canvas.toBuffer('image/png'),{}, {blocks:true,text:true})
    expect(data.text).toContain('Review technical evidence')
    expect(data.text).toContain('12')
    const words=(data.blocks??[]).flatMap(block=>block.paragraphs.flatMap(paragraph=>paragraph.lines.flatMap(line=>line.words)))
    const spans=wordSpans(words,1),rulings=rasterRulings(context.getImageData(0,0,1600,1200).data,1600,1200,1)
    const tables=ruledTables(1,spans,rulings)
    expect(tables).toHaveLength(1)
    expect(tables[0].grid[1].map(cell=>cell.text)).toEqual(['Checks','12'])
    const meeting=reconstructPdf([{page:1,width:1600,height:1200,spans,origin:'ocr'}],tables,'fictional-scan.png',[])
    expect(meeting.importEvidence?.paragraphs.join('\n')).toContain('Review technical evidence')
    expect(meeting.items.some(item=>item.itemRef==='1.1.1')).toBe(true)
    expect(meeting.items.some(item=>item.blocks.some(block=>block.type==='metric_table'))).toBe(true)
    expect(meeting.importEvidence?.tables[0].grid[1][1].text).toBe('12')
  }finally{await worker.terminate()}
},120000)
