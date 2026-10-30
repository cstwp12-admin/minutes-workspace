import { render,screen,within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { Packer } from 'docx'
import { unzipSync,strFromU8 } from 'fflate'
import { sampleMeeting } from './fixtures'
import { defaultExportProfile,ExportView } from './ExportView'
import { getExportTemplate,orderedSections, type DocumentSection } from './exportTemplates'
import { applyPersonalTemplate,parsePersonalTemplates,personalTemplate,readPersonalTemplates,writePersonalTemplates } from './personalTemplates'
import { createMeetingDocxDocument } from './docxExport'
import type { MeetingDocument } from './model'

beforeEach(()=>localStorage.clear())
const profile=()=>({...defaultExportProfile,documentReference:'MEETING-4',projectName:'Private project',organizationName:'Fictional team',distribution:'Team lead',templateSnapshot:{...getExportTemplate(),subjectHeading:'Topic and outcome',referenceHeading:'Item',sectionTitle:'Review record',sectionOrder:['actions','minutes','attendance','decisions','approvals','distribution'] as DocumentSection[]}})

test('saves reusable layouts without meeting identity and applies isolated copies',()=>{
  const source=profile(),saved=personalTemplate('My review',source)
  expect(saved.profile).toMatchObject({organizationName:'',projectName:'',distribution:''})
  expect(saved.profile.documentReference).toBeUndefined()
  expect(personalTemplate('Team format',source,true).profile.organizationName).toBe('Fictional team')
  writePersonalTemplates([saved]);const restored=readPersonalTemplates()[0]
  const applied=applyPersonalTemplate(source,restored)
  expect(applied.projectName).toBe('Private project');expect(applied.documentReference).toBe('MEETING-4')
  restored.profile.templateSnapshot!.subjectHeading='Later library edit'
  expect(applied.templateSnapshot!.subjectHeading).toBe('Topic and outcome')
  expect(()=>parsePersonalTemplates('{"schemaVersion":1,"templates":[{}]}')).toThrow()
  expect(()=>parsePersonalTemplates('x'.repeat(8_000_001))).toThrow('8 MB')
  expect(()=>writePersonalTemplates(Array.from({length:21},()=>saved))).toThrow('20 templates')
  expect(readPersonalTemplates()).toHaveLength(1)
  expect(orderedSections({...getExportTemplate(),sectionOrder:['minutes','minutes']})).toHaveLength(6)
})

test('Word output honors custom headings, section order and visibility while retaining technical tables',async()=>{
  const p=profile();p.includeActionSummary=true;p.templateSnapshot.showApprovals=false
  const bytes=await Packer.toBuffer(createMeetingDocxDocument(sampleMeeting,p))
  const xml=strFromU8(unzipSync(bytes)['word/document.xml'])
  expect(xml).toContain('Topic and outcome');expect(xml).toContain('Review record')
  expect(xml.indexOf('Action summary')).toBeLessThan(xml.indexOf('Review record'))
  expect(xml).not.toContain('Issue and approval')
  expect(xml.match(/<w:tbl>/g)!.length).toBeGreaterThan(3)
})

test('customizes, saves and reuses a personal template with matching preview order',async()=>{
  const user=userEvent.setup()
  function Harness(){const [meeting,setMeeting]=useState<MeetingDocument>({...structuredClone(sampleMeeting),exportProfile:defaultExportProfile});return <ExportView meeting={meeting} onChange={setMeeting} notify={()=>{}}/>}
  render(<Harness/>);await user.click(screen.getByText('Customize layout & personal templates'))
  const label=screen.getByLabelText('Discussion column');await user.clear(label);await user.type(label,'Topic and outcome')
  await user.click(screen.getByLabelText('Action summary'))
  await user.click(screen.getByRole('button',{name:'Move Action summary up'}));await user.click(screen.getByRole('button',{name:'Move Action summary up'}))
  const preview=screen.getByRole('region',{name:'Official minutes preview'})
  expect(within(preview).getAllByRole('heading',{level:2})[0]).toHaveTextContent('Action summary')
  expect(within(preview).getByRole('columnheader',{name:'Topic and outcome'})).toBeInTheDocument()
  await user.type(screen.getByLabelText('New template name'),'Personal review')
  await user.click(screen.getByRole('button',{name:'Save as personal template'}))
  expect(readPersonalTemplates()).toHaveLength(1)
  await user.click(screen.getByRole('button',{name:/Standard minutes/}))
  await user.selectOptions(screen.getByLabelText('Saved personal template'),readPersonalTemplates()[0].id)
  await user.click(screen.getByRole('button',{name:'Apply saved template'}))
  expect(screen.getByLabelText('Discussion column')).toHaveValue('Topic and outcome')
})

test('saved final issues lock template editing',async()=>{
  const user=userEvent.setup();render(<ExportView meeting={{...sampleMeeting,lifecycle:'finalized'}} onChange={vi.fn()} notify={()=>{}}/>)
  await user.click(screen.getByText('Customize layout & personal templates'))
  expect(screen.getByLabelText('Discussion column')).toBeDisabled()
  expect(screen.getByRole('button',{name:'Save as personal template'})).toBeDisabled()
})

test('storage failure shows an error without claiming a saved template',async()=>{
  const user=userEvent.setup(),notify=vi.fn()
  render(<ExportView meeting={sampleMeeting} onChange={vi.fn()} notify={notify}/>)
  await user.click(screen.getByText('Customize layout & personal templates'))
  await user.type(screen.getByLabelText('New template name'),'Recovery test')
  const fail=vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw new DOMException('Browser storage is full.','QuotaExceededError')})
  await user.click(screen.getByRole('button',{name:'Save as personal template'}))
  expect(screen.getByRole('alert')).toHaveTextContent(/storage.*full/i)
  expect(notify).not.toHaveBeenCalled();fail.mockRestore()
})
