import { createBlankMeeting, duplicateMeeting } from './meetingRepository'
import { sampleMeeting } from './fixtures'

test('creates a new meeting as a draft agenda with starter hierarchy',()=>{
  const meeting=createBlankMeeting()
  expect(meeting.lifecycle).toBe('draft_agenda')
  expect(meeting.items[1].parentId).toBe(meeting.items[0].id)
  expect(meeting.title).toBe('Untitled meeting')
})

test('duplicates a meeting without reusing record or agenda identifiers',()=>{
  const copy=duplicateMeeting(sampleMeeting)
  expect(copy.id).not.toBe(sampleMeeting.id)
  expect(copy.items.map(i=>i.id)).not.toEqual(sampleMeeting.items.map(i=>i.id))
  expect(copy.lifecycle).toBe('draft_agenda')
  expect(copy.archivedAt).toBeUndefined()
})
