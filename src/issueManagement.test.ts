import { describe,expect,it } from 'vitest'
import { sampleMeeting } from './fixtures'
import { compareWithIssue, completenessIssues, createAmendment, exportBaseName, finalizeMeeting } from './issueManagement'
import { duplicateMeeting } from './meetingRepository'
import type { MeetingDocument } from './model'

const readyMeeting=():MeetingDocument=>({...structuredClone(sampleMeeting),lifecycle:'under_review',preparedBy:'Secretary',checkedBy:'Reviewer',approvedBy:'Chair',reviewComments:[]})

describe('official issue lifecycle',()=>{
  it('blocks unresolved comments and missing approval details',()=>{
    const meeting=readyMeeting()
    meeting.approvedBy=''
    meeting.reviewComments=[{id:'comment',minuteItemId:'m31',text:'Please check',resolved:false,createdAt:'2026-10-29'}]
    expect(completenessIssues(meeting)).toContain('Approved by is required')
    expect(completenessIssues(meeting)).toContain('1 unresolved review comment')
    expect(()=>finalizeMeeting(meeting)).toThrow('readiness')
  })
  it('preserves final content through two amendment cycles without recursive history',()=>{
    const first=finalizeMeeting(readyMeeting())
    const amendment=createAmendment(first)
    amendment.items[0].title='Revised opening'
    expect(first.finalIssues![0].record.items[0].title).not.toBe('Revised opening')
    expect(amendment.checkedBy).toBe('')
    expect(amendment.approvedBy).toBe('')
    expect(amendment.revision).toBe(2)
    expect(compareWithIssue(amendment,amendment.finalIssues![0])).toContain('1.0: title changed')
    const second=finalizeMeeting({...amendment,lifecycle:'under_review',checkedBy:'Reviewer',approvedBy:'Chair'})
    expect(second.finalIssues?.map(issue=>issue.revision)).toEqual([1,2])
    expect(second.finalIssues![1].record).not.toHaveProperty('finalIssues')
    expect(createAmendment(second).revision).toBe(3)
    const copy=duplicateMeeting(second)
    expect(copy.finalIssues).toEqual([])
    expect(copy.revision).toBe(1)
  })
  it('captures legacy finalized meetings before amendment',()=>{
    const legacy={...readyMeeting(),lifecycle:'finalized' as const}
    expect(createAmendment(legacy).finalIssues![0].record.lifecycle).toBe('finalized')
  })
  it('builds portable filenames with reference, revision and issue status',()=>{
    const meeting={...readyMeeting(),revision:2,exportProfile:{organizationName:'',projectName:'',documentTitle:'Minutes',primaryColor:'#173b2f',distribution:'',documentReference:'Team / MOM: 04'}}
    expect(exportBaseName(meeting)).toBe('Team---MOM--04-R2-draft')
  })
})
