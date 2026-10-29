export type Status = 'Open' | 'Ongoing' | 'Overdue' | 'Closed' | 'Info' | '-'
export type MeetingLifecycle = 'draft_agenda' | 'in_progress' | 'draft_minutes' | 'under_review' | 'finalized'
export type Block =
  | { type: 'paragraph'; text: string }
  | { type: 'metric_table'; title: string; columns: string[]; rows: string[][]; grid?: SourceCell[][] }

export interface SourceCell { column: number; text: string; colSpan: number; rowSpan: number; blocks: Block[] }
export interface ImportEvidence { tables: { index:number; grid:SourceCell[][] }[]; paragraphs:string[]; warnings:string[] }

export interface SourceAnchor { page?: number; table: number; row: number; confidence: number; excerpt: string }
export interface Participant { id: string; name: string; organization: string; role: string; attendance: 'expected'|'confirmed'|'apology' }
export interface ReviewComment { id: string; minuteItemId: string; text: string; resolved: boolean; createdAt: string }
export interface AuditEvent { id: string; action: string; at: string }
export interface ExportProfile {
  documentReference?: string
  includeActionSummary?: boolean
  includeDecisionSummary?: boolean
  templateId?: string
  organizationName: string
  projectName: string
  documentTitle: string
  primaryColor: string
  distribution: string
  logoDataUrl?: string
}
export interface FinalIssue { revision: number; issuedAt: string; record: Omit<MeetingDocument, 'finalIssues'> }
export interface ActionItem { id: string; actionRef: string; requiredAction: string; owner: string; deadline: string; status: Status }
export interface MinuteItem {
  id: string; parentId?: string; itemRef: string; depth: number; type: 'section' | 'minute';
  title: string; blocks: Block[]; owner: string; status: Status; action?: ActionItem; source: SourceAnchor; discussion?: string; decision?: string; outcome?: 'pending'|'discussed'|'deferred'|'skipped'; allocatedMinutes?: number
}
export interface MeetingDocument { id: string; title: string; meetingType: string; meetingNumber: string; date: string; venue: string; chair: string; sourceFile: string; sourceFormat: 'DOCX'|'PDF'; importStatus: 'review'|'approved'; lifecycle: MeetingLifecycle; updatedAt: string; archivedAt?: string; participants?: Participant[]; reviewComments?: ReviewComment[]; auditEvents?: AuditEvent[]; revision?: number; preparedBy?: string; checkedBy?: string; approvedBy?: string; exportProfile?: ExportProfile; finalIssues?: FinalIssue[]; importEvidence?: ImportEvidence; items: MinuteItem[] }

export const childrenOf = (items: MinuteItem[], id?: string) => items.filter(i => i.parentId === id)
export const openActionCount = (items: MinuteItem[]) => items.filter(i => i.action && !['Closed','Info','-'].includes(i.action.status)).length
export const exportSnapshot = (meeting: MeetingDocument) => JSON.stringify({schemaVersion:1, exportedAt:new Date().toISOString(), meeting}, null, 2)
