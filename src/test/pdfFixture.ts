const text=(x:number,y:number,value:string)=>`BT /F1 10 Tf ${x} ${y} Td (${value.replace(/[()\\]/g,'\\$&')}) Tj ET\n`
const grid=(xs:number[],ys:number[])=>xs.map(x=>`${x} ${ys[0]} m ${x} ${ys.at(-1)} l S\n`).join('')+ys.map(y=>`${xs[0]} ${y} m ${xs.at(-1)} ${y} l S\n`).join('')

export function makePdf(pages:string[]):Uint8Array{
  const objects:string[]=['<< /Type /Catalog /Pages 2 0 R >>','', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>']
  const kids:string[]=[]
  pages.forEach(content=>{
    const pageIndex=objects.length+1,streamIndex=pageIndex+1
    kids.push(`${pageIndex} 0 R`)
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 3 0 R >> >> /Contents ${streamIndex} 0 R >>`)
    objects.push(`<< /Length ${content.length} >>\nstream\n${content}endstream`)
  })
  objects[1]=`<< /Type /Pages /Count ${pages.length} /Kids [${kids.join(' ')}] >>`
  let output='%PDF-1.4\n';const offsets=[0]
  objects.forEach((object,index)=>{offsets.push(output.length);output+=`${index+1} 0 obj\n${object}\nendobj\n`})
  const xref=output.length
  output+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(offset=>String(offset).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return new TextEncoder().encode(output)
}

export const fictionalPdf=()=>makePdf([
  text(40,770,'Coordination Meeting No. 4')+text(40,750,'Date: 2026-10-30')+text(40,735,'Chair: Team lead')+
  grid([40,80,400,480,560],[700,670,630,470])+
  text(45,680,'NO.')+text(90,680,'SUBJECT')+text(410,680,'ACTION')+text(490,680,'STATUS')+
  text(45,650,'1.0')+text(90,650,'DELIVERY')+
  text(45,610,'1.1')+text(90,610,'Review technical evidence')+text(410,610,'Team')+text(490,610,'Open')+
  text(90,590,'Action: Publish the plan')+text(90,575,'Due: 2026-11-05')+
  grid([100,220,340],[550,525,500])+text(110,533,'Metric')+text(230,533,'Value')+text(110,510,'Checks')+text(230,510,'12'),
  text(40,770,'Coordination Meeting No. 4')+
  grid([40,80,400,480,560],[700,670,630,580])+
  text(45,680,'NO.')+text(90,680,'SUBJECT')+text(410,680,'ACTION')+text(490,680,'STATUS')+
  text(90,650,'Additional discussion on evidence')+
  text(45,610,'1.2')+text(90,610,'Close the issue')+text(410,610,'Quality team')+text(490,610,'Closed'),
  text(40,770,'Action register')+
  grid([40,80,140,290,470,560],[700,670,630])+
  text(45,680,'No.')+text(85,680,'Item Ref.')+text(150,680,'Subject')+text(300,680,'Required Action')+text(480,680,'Deadline')+
  text(45,650,'1')+text(85,650,'1.2')+text(150,650,'Closeout')+text(300,650,'Provide closeout evidence')+text(480,650,'2026-11-07')
])
