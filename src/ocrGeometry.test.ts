import { ocrPageRange, rasterRulings, wordSpans } from './ocrGeometry'
import { ruledTables } from './pdfGeometry'

test('normalizes OCR word boxes to source coordinates without discarding confidence',()=>{
  expect(wordSpans([{text:'12.5',confidence:62,bbox:{x0:20,y0:40,x1:100,y1:60}}],2)).toEqual([{text:'12.5',confidence:62,x:10,y:30,width:40,height:10}])
  expect(()=>wordSpans([],0)).toThrow('scale')
})
test('reconstructs a scanned technical grid with a merged cell and assigned values',()=>{
  const width=400,height=400,data=new Uint8ClampedArray(width*height*4).fill(255)
  const dark=(x:number,y:number)=>{const i=(y*width+x)*4;data[i]=data[i+1]=data[i+2]=0}
  for(const y of [20,100,180])for(let x=20;x<=380;x++)dark(x,y)
  for(const x of [20,380])for(let y=20;y<=180;y++)dark(x,y)
  for(let y=100;y<=180;y++)dark(200,y)
  const spans=wordSpans([{text:'Merged header',confidence:91,bbox:{x0:40,y0:40,x1:180,y1:60}},{text:'Checks',confidence:95,bbox:{x0:40,y0:120,x1:110,y1:140}},{text:'12',confidence:72,bbox:{x0:220,y0:120,x1:250,y1:140}}],1)
  const tables=ruledTables(1,spans,rasterRulings(data,width,height,1))
  expect(tables).toHaveLength(1)
  expect(tables[0].grid[0][0]).toMatchObject({text:'Merged header',colSpan:2})
  expect(tables[0].grid[1].map(cell=>cell.text)).toEqual(['Checks','12'])
})
test('requires bounded, valid OCR page selections',()=>{
  expect(ocrPageRange(100,21,30)).toEqual({first:21,last:30})
  expect(()=>ocrPageRange(100)).toThrow('10 pages')
  for(const range of [[0,1],[2,1],[1,101],[1.5,2]])expect(()=>ocrPageRange(100,...range as [number,number])).toThrow('valid page range')
})
