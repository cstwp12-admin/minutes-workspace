import { render,screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { OcrReview, updateOcrPage } from './OcrReview'
import { importProblems } from './importCorrections'
import { sampleMeeting } from './fixtures'

const scanned=()=>({...structuredClone(sampleMeeting),importEvidence:{tables:[],paragraphs:[],warnings:[],ocrPages:[{page:2,confidence:72,text:'Checks 1Z',reviewed:false},{page:3,confidence:96,text:'1.2 Follow up',reviewed:false}]}})
test('requires individual OCR review and retains raw recognition, tables and actions after transcript edits',()=>{
  const original=scanned(),reviewed=updateOcrPage(updateOcrPage(original,2,{reviewed:true}),3,{reviewed:true})
  expect(importProblems(reviewed).filter(issue=>issue.includes('OCR'))).toHaveLength(0)
  const corrected=updateOcrPage(reviewed,2,{correctedText:'Checks 12'})
  expect(corrected.importEvidence?.ocrPages?.[0]).toMatchObject({text:'Checks 1Z',correctedText:'Checks 12',reviewed:false})
  expect(corrected.importEvidence?.ocrPages?.[1].reviewed).toBe(true)
  expect(corrected.items).toEqual(original.items)
  expect(importProblems(corrected)).toContain('OCR page 2 must be checked against its preview before approval.')
  expect(original.importEvidence.ocrPages[0].text).toBe('Checks 1Z')
})
test('edits and saves a transcript before allowing the page acknowledgement',async()=>{
  const user=userEvent.setup()
  function Harness(){const [meeting,setMeeting]=useState(scanned());return <OcrReview meeting={meeting} onCommit={value=>setMeeting(value as ReturnType<typeof scanned>)}/>}
  render(<Harness/> )
  const text=screen.getByLabelText('Editable transcript for page 2'),ack=screen.getByRole('checkbox',{name:/I checked page 2/})
  await user.clear(text);await user.type(text,'Checks 12')
  expect(ack).toBeDisabled()
  await user.click(screen.getByRole('button',{name:'Save page 2 transcript'}))
  await user.click(ack);expect(ack).toBeChecked()
  expect(screen.getByText('Checks 1Z')).toBeInTheDocument()
})
