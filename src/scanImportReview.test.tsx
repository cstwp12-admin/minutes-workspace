import { render,screen,waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ImportReview } from './ImportReview'
import { sampleMeeting } from './fixtures'
import { importImage } from './imageImport'

vi.mock('./imageImport',()=>({importImage:vi.fn()}))
vi.mock('./ImageSourcePreview',()=>({ImageSourcePreview:()=> <div>Original scan preview</div>}))
const scanMeeting=()=>({...structuredClone(sampleMeeting),sourceFormat:'IMAGE' as const,importStatus:'review' as const,importEvidence:{tables:[],paragraphs:['1.1 Check evidence'],warnings:['Check scan values'],ocrPages:[{page:1,confidence:74,text:'Checks 1Z',reviewed:false}]}})

test('stages an image, corrects recognition and blocks creation until page and overall review',async()=>{
  vi.mocked(importImage).mockResolvedValueOnce(scanMeeting())
  const user=userEvent.setup(),approve=vi.fn();render(<ImportReview onApprove={approve}/>)
  await user.upload(screen.getByLabelText('Choose DOCX, PDF or scan image'),new File(['fake'],'fictional.png',{type:'image/png'}))
  const text=await screen.findByLabelText('Editable transcript for page 1')
  const approveButton=screen.getByRole('button',{name:'Approve import & create meeting'})
  await user.click(screen.getByRole('checkbox',{name:'I reviewed the metadata, item hierarchy, technical tables and inferred actions.'}))
  expect(approveButton).toBeDisabled();expect(approve).not.toHaveBeenCalled()
  await user.clear(text);await user.type(text,'Checks 12')
  await user.click(screen.getByRole('button',{name:'Save page 1 transcript'}))
  await user.click(screen.getByRole('checkbox',{name:/I checked page 1/}))
  expect(approveButton).toBeDisabled()
  await user.click(screen.getByRole('checkbox',{name:'I reviewed the metadata, item hierarchy, technical tables and inferred actions.'}))
  await user.click(approveButton)
  await waitFor(()=>expect(approve).toHaveBeenCalledTimes(1))
  const meeting=approve.mock.calls[0][0]
  expect(meeting).toMatchObject({sourceFormat:'IMAGE',importStatus:'approved'})
  expect(meeting.importEvidence.ocrPages[0]).toMatchObject({text:'Checks 1Z',correctedText:'Checks 12',reviewed:true})
  expect(meeting.items).toEqual(sampleMeeting.items)
})

test('cancels recognition without creating a meeting and allows retry',async()=>{
  let received:AbortSignal|undefined
  vi.mocked(importImage).mockImplementationOnce((_file,_report,signal)=>new Promise((_,reject)=>{received=signal;signal?.addEventListener('abort',()=>reject(new DOMException('Cancelled','AbortError')))}))
  const user=userEvent.setup(),approve=vi.fn();render(<ImportReview onApprove={approve}/>)
  await user.upload(screen.getByLabelText('Choose DOCX, PDF or scan image'),new File(['fake'],'fictional.png',{type:'image/png'}))
  await waitFor(()=>expect(received).toBeDefined())
  await user.click(screen.getByRole('button',{name:'Cancel import'}))
  expect(received?.aborted).toBe(true)
  expect(screen.getByLabelText('Choose DOCX, PDF or scan image')).toBeEnabled()
  expect(screen.getByRole('alert')).toHaveTextContent('Import cancelled')
  expect(approve).not.toHaveBeenCalled()
})
