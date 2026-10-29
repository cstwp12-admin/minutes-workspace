import { sampleMeeting } from './fixtures'
import type { MeetingDocument } from './model'

const DB_NAME = 'minutes-workspace'
const STORE = 'meetings'
const VERSION = 1

function openDatabase(): Promise<IDBDatabase>{
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB_NAME,VERSION)
    request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE,{keyPath:'id'})}
    request.onsuccess=()=>resolve(request.result)
    request.onerror=()=>reject(request.error)
  })
}

function transaction<T>(mode:IDBTransactionMode,run:(store:IDBObjectStore,resolve:(value:T)=>void,reject:(reason?:unknown)=>void)=>void){
  return openDatabase().then(db=>new Promise<T>((resolve,reject)=>{
    const tx=db.transaction(STORE,mode)
    run(tx.objectStore(STORE),resolve,reject)
    tx.oncomplete=()=>db.close()
    tx.onerror=()=>reject(tx.error)
  }))
}

export async function listMeetings():Promise<MeetingDocument[]>{
  const items=await transaction<MeetingDocument[]>('readonly',(store,resolve,reject)=>{const req=store.getAll();req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})
  if(items.length)return items.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))
  await saveMeeting(sampleMeeting)
  return [sampleMeeting]
}

export function saveMeeting(meeting:MeetingDocument){
  return transaction<void>('readwrite',(store,resolve,reject)=>{const req=store.put(meeting);req.onsuccess=()=>resolve();req.onerror=()=>reject(req.error)})
}

export function saveMeetings(meetings:MeetingDocument[]){return Promise.all(meetings.map(saveMeeting))}

const uid=()=>crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
export function createBlankMeeting():MeetingDocument{
  const now=new Date().toISOString()
  const openingId=uid()
  return {id:uid(),title:'Untitled meeting',meetingType:'Team meeting',meetingNumber:'01',date:now.slice(0,10),venue:'',chair:'',sourceFile:'',sourceFormat:'PDF',importStatus:'approved',lifecycle:'draft_agenda',updatedAt:now,items:[{id:openingId,itemRef:'1.0',depth:0,type:'section',title:'Opening',blocks:[],owner:'',status:'-',source:{table:0,row:0,confidence:1,excerpt:'Created in Minutes Workspace'}},{id:uid(),parentId:openingId,itemRef:'1.1',depth:1,type:'minute',title:'Welcome and objectives',blocks:[{type:'paragraph',text:'Add the purpose and expected outcomes for this meeting.'}],owner:'',status:'Open',source:{table:0,row:0,confidence:1,excerpt:'Created in Minutes Workspace'}}]}
}

export function duplicateMeeting(source:MeetingDocument):MeetingDocument{
  const now=new Date().toISOString(), map=new Map<string,string>()
  source.items.forEach(i=>map.set(i.id,uid()))
  return {...structuredClone(source),id:uid(),title:`${source.title} (copy)`,meetingNumber:`${source.meetingNumber}-copy`,lifecycle:'draft_agenda',revision:1,finalIssues:[],reviewComments:[],auditEvents:[],checkedBy:'',approvedBy:'',updatedAt:now,archivedAt:undefined,items:source.items.map(i=>({...structuredClone(i),id:map.get(i.id)!,parentId:i.parentId?map.get(i.parentId):undefined,action:i.action?{...structuredClone(i.action),id:uid(),status:i.action.status==='Closed'?'Closed':'Open'}:undefined}))}
}
