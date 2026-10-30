import type { ExportProfile } from './model'
export const documentSections=['attendance','minutes','actions','decisions','approvals','distribution'] as const
export type DocumentSection=typeof documentSections[number]
export const sectionNames:Record<DocumentSection,string>={attendance:'Attendance',minutes:'Minutes',actions:'Action summary',decisions:'Decision summary',approvals:'Approval block',distribution:'Distribution'}
export interface ExportTemplate {
  id: string; name: string; description: string; documentTitle: string; accent: string; category: string
  sectionTitle: string; subjectHeading: string; ownerHeading: string; statusHeading: string
  decisionLabel: string; actionLabel: string; showAttendance: boolean; showDistribution: boolean
  referenceHeading?:string;showApprovals?:boolean;sectionOrder?:DocumentSection[]
}

export const exportTemplates: ExportTemplate[] = [
  { id:'standard', name:'Standard minutes', description:'Balanced format for recurring individual or team meetings.', documentTitle:'Minutes of Meeting', accent:'#173b2f', category:'General', sectionTitle:'Meeting minutes', subjectHeading:'Subject / discussion / decision', ownerHeading:'Action by', statusHeading:'Status', decisionLabel:'Decision', actionLabel:'Action', showAttendance:true, showDistribution:true },
  { id:'progress', name:'Project progress', description:'Delivery updates, milestones, owners and follow-up actions.', documentTitle:'Project Progress Meeting Minutes', accent:'#155e75', category:'Delivery', sectionTitle:'Progress updates and actions', subjectHeading:'Workstream / progress / next step', ownerHeading:'Owner', statusHeading:'Progress', decisionLabel:'Agreement', actionLabel:'Next action', showAttendance:true, showDistribution:true },
  { id:'technical', name:'Technical & quality', description:'Technical reviews, QA/QC evidence and embedded data tables.', documentTitle:'Technical and Quality Meeting Minutes', accent:'#334155', category:'Technical', sectionTitle:'Technical review record', subjectHeading:'Technical item / evidence / disposition', ownerHeading:'Responsible', statusHeading:'Disposition', decisionLabel:'Technical disposition', actionLabel:'Required response', showAttendance:true, showDistribution:true },
  { id:'safety', name:'Safety & risk', description:'Safety observations, risks, controls and accountable persons.', documentTitle:'Safety and Risk Meeting Minutes', accent:'#9a3412', category:'Risk', sectionTitle:'Safety, risk and control record', subjectHeading:'Observation / risk / control', ownerHeading:'Responsible', statusHeading:'Risk status', decisionLabel:'Control decision', actionLabel:'Corrective action', showAttendance:true, showDistribution:true },
  { id:'executive', name:'Executive decisions', description:'Concise governance record centred on decisions and ownership.', documentTitle:'Executive Decision Record', accent:'#4c1d95', category:'Governance', sectionTitle:'Decisions and commitments', subjectHeading:'Matter / decision / commitment', ownerHeading:'Executive owner', statusHeading:'State', decisionLabel:'Decision', actionLabel:'Commitment', showAttendance:false, showDistribution:true },
  { id:'workshop', name:'Workshop & planning', description:'Working sessions, options, outcomes and agreed next steps.', documentTitle:'Workshop Record and Action Plan', accent:'#0f766e', category:'Planning', sectionTitle:'Workshop outcomes', subjectHeading:'Topic / discussion / outcome', ownerHeading:'Lead', statusHeading:'Outcome', decisionLabel:'Agreed outcome', actionLabel:'Next step', showAttendance:true, showDistribution:false },
  { id:'sprint', name:'Sprint review', description:'Iteration outcomes, demonstrations, blockers and backlog actions.', documentTitle:'Sprint Review Minutes', accent:'#1d4ed8', category:'Agile', sectionTitle:'Sprint review and backlog actions', subjectHeading:'Item / review / backlog outcome', ownerHeading:'Owner', statusHeading:'State', decisionLabel:'Product decision', actionLabel:'Backlog action', showAttendance:false, showDistribution:false },
  { id:'stakeholder', name:'Client & stakeholder', description:'External-facing record of updates, decisions and commitments.', documentTitle:'Stakeholder Meeting Minutes', accent:'#7c2d12', category:'External', sectionTitle:'Stakeholder record', subjectHeading:'Subject / response / agreement', ownerHeading:'Responsible party', statusHeading:'Status', decisionLabel:'Agreement', actionLabel:'Commitment', showAttendance:true, showDistribution:true }
]

export const getExportTemplate = (id?: string) => exportTemplates.find(template=>template.id===id) ?? exportTemplates[0]
export const getProfileTemplate=(profile:ExportProfile):ExportTemplate=>profile.templateSnapshot??getExportTemplate(profile.templateId)
export const orderedSections=(template:ExportTemplate):DocumentSection[]=>[...new Set([...(template.sectionOrder??[]).filter(key=>documentSections.includes(key)),...documentSections])]
