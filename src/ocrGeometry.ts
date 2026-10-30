import type { PdfTextSpan } from './model'
import type { Ruling } from './pdfGeometry'

export interface RecognizedWord {text:string;confidence:number;bbox:{x0:number;y0:number;x1:number;y1:number}}
export function wordSpans(words:RecognizedWord[],scale:number):PdfTextSpan[]{
  if(!Number.isFinite(scale)||scale<=0)throw new Error('Invalid OCR render scale.')
  return words.filter(word=>word.text.trim()&&Object.values(word.bbox).every(Number.isFinite)).map(word=>({text:word.text,x:word.bbox.x0/scale,y:word.bbox.y1/scale,width:(word.bbox.x1-word.bbox.x0)/scale,height:(word.bbox.y1-word.bbox.y0)/scale,confidence:word.confidence}))
}
// Long dark pixel runs recover borders embedded in scanned pages. Short text strokes
// are excluded; the existing geometry parser clusters adjacent border pixels.
export function rasterRulings(data:Uint8ClampedArray,width:number,height:number,scale:number):Ruling[]{
  if(width*height>6_000_000||data.length!==width*height*4||scale<=0)throw new Error('Invalid or oversized OCR raster.')
  const result:Ruling[]=[]
  const dark=(x:number,y:number)=>{const i=(y*width+x)*4;return data[i+3]>128&&data[i]<170&&data[i+1]<170&&data[i+2]<170}
  const scan=(horizontal:boolean)=>{
    const length=horizontal?width:height,count=horizontal?height:width,minimum=horizontal?Math.max(80,width*.12):Math.max(60,height*.045)
    for(let fixed=0;fixed<count;fixed+=2){let start=-1,last=-1
      const flush=()=>{if(start>=0&&last-start>=minimum)result.push(horizontal?{x1:start/scale,y1:fixed/scale,x2:last/scale,y2:fixed/scale}:{x1:fixed/scale,y1:start/scale,x2:fixed/scale,y2:last/scale});start=-1;last=-1}
      for(let position=0;position<length;position++){if(dark(horizontal?position:fixed,horizontal?fixed:position)){if(start<0)start=position;last=position}else if(position-last>2)flush()}
      flush()
      if(result.length>5000)throw new Error('Too many borders in this scan. Use a cleaner image or smaller page range.')
    }
  }
  scan(true);scan(false);return result
}

export function ocrPageRange(total:number,first=1,last=total){
  if(!Number.isInteger(first)||!Number.isInteger(last)||first<1||last<first||last>total)throw new Error(`Choose a valid page range between 1 and ${total}.`)
  if(last-first+1>10)throw new Error('OCR is limited to 10 pages per import. Choose a smaller page range.')
  return {first,last}
}
