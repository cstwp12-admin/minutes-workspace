import type { ExportProfile } from './model'
import { getProfileTemplate, orderedSections, type ExportTemplate } from './exportTemplates'
export interface PersonalTemplate {id:string;name:string;profile:ExportProfile}
const key='minutes-workspace.personal-templates.v1'
const labelFields=['name','description','documentTitle','category','sectionTitle','subjectHeading','ownerHeading','statusHeading','decisionLabel','actionLabel'] as const
export function validateTemplateProfile(value:unknown):ExportProfile{
  if(!value||typeof value!=='object')throw new Error('Invalid template settings.')
  const p=value as ExportProfile,t=p.templateSnapshot
  if(!t||labelFields.some(field=>typeof t[field]!=='string'||t[field].length>300)||!t.name.trim()||!t.documentTitle.trim()||!/^#[0-9a-f]{6}$/i.test(p.primaryColor))throw new Error('Template needs a name, title, valid labels and a six-digit accent colour.')
  for(const field of ['organizationName','projectName','distribution','documentTitle'] as const)if(typeof p[field]!=='string'||p[field].length>10000)throw new Error('Invalid template identity settings.')
  if(p.logoDataUrl&&(!/^data:image\/(png|jpeg|svg\+xml);base64,[a-z0-9+/=\s]+$/i.test(p.logoDataUrl)||p.logoDataUrl.length>1_400_000))throw new Error('Invalid or oversized template logo.')
  const snapshot:ExportTemplate={id:String(t.id??'personal').slice(0,100),accent:p.primaryColor,showAttendance:!!t.showAttendance,showDistribution:!!t.showDistribution,showApprovals:t.showApprovals!==false,referenceHeading:typeof t.referenceHeading==='string'?t.referenceHeading.slice(0,300):'No.',sectionOrder:orderedSections(t),...Object.fromEntries(labelFields.map(field=>[field,t[field]]))} as ExportTemplate
  return {templateId:p.templateId,templateSnapshot:snapshot,organizationName:p.organizationName,projectName:p.projectName,distribution:p.distribution,documentTitle:p.documentTitle,primaryColor:p.primaryColor,logoDataUrl:p.logoDataUrl,includeActionSummary:!!p.includeActionSummary,includeDecisionSummary:!!p.includeDecisionSummary}
}
export function personalTemplate(name:string,profile:ExportProfile,includeIdentity=false):PersonalTemplate{
  const clean=name.trim();if(!clean||clean.length>100)throw new Error('Enter a template name of 1–100 characters.')
  const snapshot={...structuredClone(getProfileTemplate(profile)),name:clean}
  return {id:crypto.randomUUID(),name:clean,profile:validateTemplateProfile({...profile,templateSnapshot:snapshot,organizationName:includeIdentity?profile.organizationName:'',projectName:'',distribution:includeIdentity?profile.distribution:'',logoDataUrl:includeIdentity?profile.logoDataUrl:undefined})}
}
export function readPersonalTemplates():PersonalTemplate[]{
  const raw=localStorage.getItem(key);return raw?parsePersonalTemplates(raw):[]
}
export function parsePersonalTemplates(raw:string):PersonalTemplate[]{
  if(raw.length>8_000_000)throw new Error('Template backup exceeds 8 MB.')
  const data=JSON.parse(raw),records=Array.isArray(data)?data:data.schemaVersion===1?data.templates:null
  if(!Array.isArray(records)||records.length>20)throw new Error('Choose a template backup with up to 20 templates.')
  return records.map(record=>{
    if(typeof record.id!=='string'||typeof record.name!=='string'||!record.name.trim()||record.name.length>100)throw new Error('Invalid personal template record.')
    return {id:record.id.slice(0,100),name:record.name,profile:validateTemplateProfile(record.profile)}
  })
}
export function writePersonalTemplates(records:PersonalTemplate[]){
  const data=JSON.stringify({schemaVersion:1,templates:records});parsePersonalTemplates(data);localStorage.setItem(key,data)
}
// Apply a copy. A later library edit cannot change an existing or finalized issue.
export function applyPersonalTemplate(current:ExportProfile,saved:PersonalTemplate):ExportProfile{
  const profile=structuredClone(saved.profile)
  return {...profile,documentReference:current.documentReference,projectName:current.projectName,organizationName:profile.organizationName||current.organizationName,logoDataUrl:profile.logoDataUrl??current.logoDataUrl,distribution:profile.distribution||current.distribution}
}
