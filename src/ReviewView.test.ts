import { completenessIssues } from './ReviewView'
import { sampleMeeting } from './fixtures'

test('flags incomplete actions and attendance during review',()=>{
  const meeting={...sampleMeeting,participants:[{id:'p1',name:'Alex',organization:'Demo',role:'Member',attendance:'expected' as const}],items:sampleMeeting.items.map((i,index)=>index===1?{...i,outcome:'discussed' as const,discussion:'',action:{id:'x',actionRef:'A-1',requiredAction:'Follow up',owner:'',deadline:'',status:'Open' as const}}:i)}
  const issues=completenessIssues(meeting)
  expect(issues.some(i=>i.includes('missing discussion'))).toBe(true)
  expect(issues.some(i=>i.includes('no owner'))).toBe(true)
  expect(issues).toContain('Attendance is not fully confirmed')
})
