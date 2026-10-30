const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const direct=(element:Element|undefined,name:string)=>element?Array.from(element.children).find(child=>child.namespaceURI===W&&child.localName===name):undefined
const all=(element:Element|Document,name:string)=>Array.from(element.getElementsByTagNameNS(W,name))
const value=(element:Element|undefined,name='val')=>element?.getAttributeNS(W,name)??''
interface Level {start:number;format:string;text:string;restart?:number}
export interface NumberLabel {text:string;level:number;format:string}

function xmlDocument(xml:string,limit:number):Document{
  if(xml.length>limit||/<!DOCTYPE|<!ENTITY/i.test(xml))throw new Error('Word numbering or styles exceed the supported size or contain unsupported entities.')
  const document=new DOMParser().parseFromString(xml,'application/xml')
  if(document.getElementsByTagName('parsererror').length)throw new Error('The Word numbering or styles XML is invalid.')
  return document
}
const levelDefinition=(element:Element):Level=>({start:Number(value(direct(element,'start'))||1),format:value(direct(element,'numFmt'))||'decimal',text:value(direct(element,'lvlText'))||'%1.',restart:direct(element,'lvlRestart')?Number(value(direct(element,'lvlRestart'))):undefined})
const letters=(n:number):string=>n>0?(n>26?letters(Math.floor((n-1)/26)):'')+String.fromCharCode(97+(n-1)%26):String(n)
const roman=(n:number):string=>{
  if(n<1||n>3999)return String(n)
  let result=''
  for(const [number,label] of [[1000,'m'],[900,'cm'],[500,'d'],[400,'cd'],[100,'c'],[90,'xc'],[50,'l'],[40,'xl'],[10,'x'],[9,'ix'],[5,'v'],[4,'iv'],[1,'i']] as [number,string][])while(n>=number){result+=label;n-=number}
  return result
}
const formatted=(n:number,format:string)=>format==='lowerLetter'?letters(n):format==='upperLetter'?letters(n).toUpperCase():format==='lowerRoman'?roman(n):format==='upperRoman'?roman(n).toUpperCase():format==='decimalZero'?String(n).padStart(2,'0'):String(n)

export function wordNumberingLabels(body:Element,numberingXml?:string,stylesXml?:string):{labels:Map<Element,NumberLabel>;warnings:string[]}{
  const labels=new Map<Element,NumberLabel>(),warnings=new Set<string>()
  const styles=new Map<string,Element>()
  if(stylesXml)for(const style of all(xmlDocument(stylesXml,2_000_000),'style'))styles.set(value(style,'styleId'),style)
  const definitions=new Map<string,Map<number,Level>>(),instances=new Map<string,Map<number,Level>>()
  if(numberingXml){
    const numbering=xmlDocument(numberingXml,1_000_000)
    for(const abstract of all(numbering,'abstractNum')){
      const levels=new Map<number,Level>()
      for(const level of all(abstract,'lvl'))levels.set(Number(value(level,'ilvl')),levelDefinition(level))
      definitions.set(value(abstract,'abstractNumId'),levels)
    }
    for(const num of all(numbering,'num')){
      const levels=new Map(definitions.get(value(direct(num,'abstractNumId'))))
      for(const override of all(num,'lvlOverride')){
        const index=Number(value(override,'ilvl')),definition=direct(override,'lvl')
        if(definition)levels.set(index,levelDefinition(definition))
        const start=direct(override,'startOverride'),level=levels.get(index)
        if(start&&level)levels.set(index,{...level,start:Number(value(start))})
      }
      instances.set(value(num,'numId'),levels)
    }
  }
  const counters=new Map<string,Map<number,number>>()
  for(const paragraph of all(body,'p')){
    let deleted=false
    for(let ancestor=paragraph.parentElement;ancestor;ancestor=ancestor.parentElement)if(ancestor.namespaceURI===W&&['del','moveFrom'].includes(ancestor.localName))deleted=true
    if(deleted)continue
    const props=direct(paragraph,'pPr'),styleId=value(direct(props,'pStyle'))
    const styleChain:Element[]=[],visited=new Set<string>()
    let id=styleId
    while(id&&styles.has(id)&&!visited.has(id)&&styleChain.length<24){visited.add(id);const style=styles.get(id)!;styleChain.unshift(style);id=value(direct(style,'basedOn'))}
    let numId='',level=0
    const sets=[...styleChain.map(style=>direct(direct(style,'pPr'),'numPr')),direct(props,'numPr')].filter(Boolean)
    for(const numbering of sets){if(direct(numbering,'numId'))numId=value(direct(numbering,'numId'));if(direct(numbering,'ilvl'))level=Number(value(direct(numbering,'ilvl')))}
    if(!numId||numId==='0')continue
    const levels=instances.get(numId),definition=levels?.get(level)
    if(!definition||level<0||level>8||!Number.isFinite(definition.start)||definition.text.length>1000){warnings.add('Some automatic list numbering could not be resolved; verify references against Word.');continue}
    if(definition.format==='bullet'||definition.format==='none'){warnings.add('Bulleted or unnumbered lists are retained as content; verify whether any lines should be agenda items.');continue}
    if(!['decimal','decimalZero','lowerLetter','upperLetter','lowerRoman','upperRoman'].includes(definition.format)){warnings.add(`Unsupported Word numbering format ${definition.format}; references require manual review.`);continue}
    const counts=counters.get(numId)??new Map<number,number>()
    counts.set(level,counts.has(level)?counts.get(level)!+1:definition.start)
    for(const [deeper,rule] of levels!)if(deeper>level&&rule.restart!==0&&level<=(rule.restart??deeper)-1)counts.delete(deeper)
    counters.set(numId,counts)
    const label=definition.text.replace(/%([1-9])/g,(_,n:string)=>{
      const index=Number(n)-1,rule=levels!.get(index)
      return formatted(counts.get(index)??rule?.start??1,rule?.format??'decimal')
    })
    labels.set(paragraph,{text:label,level,format:definition.format})
  }
  if(labels.size)warnings.add('Automatic Word list labels were restored from numbering definitions and paragraph styles. Verify restarts and item boundaries.')
  return {labels,warnings:[...warnings]}
}
