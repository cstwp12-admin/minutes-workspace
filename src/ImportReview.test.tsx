import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { strToU8,zipSync } from 'fflate'
import { ImportReview } from './ImportReview'
import { fictionalMinutesXml } from './test/docxFixture'

test('imports, corrects and approves a new record only after acknowledgement',async()=>{
  const user=userEvent.setup(), approve=vi.fn()
  render(<ImportReview onApprove={approve}/>)
  const bytes=zipSync({'word/document.xml':strToU8(fictionalMinutesXml)})
  const file=new File([bytes],'fictional.docx',{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'})
  Object.defineProperty(file,'arrayBuffer',{value:async()=>bytes.buffer})
  await user.upload(screen.getByLabelText('Choose DOCX, PDF or scan image'),file)
  const title=await screen.findByLabelText('Meeting title')
  const button=screen.getByRole('button',{name:'Approve import & create meeting'})
  expect(button).toBeDisabled()
  await user.clear(title);await user.type(title,'Corrected meeting title')
  await user.click(screen.getByRole('checkbox',{name:'I reviewed the metadata, item hierarchy, technical tables and inferred actions.'}))
  await user.click(button)
  await waitFor(()=>expect(approve).toHaveBeenCalledTimes(1))
  expect(approve.mock.calls[0][0]).toMatchObject({title:'Corrected meeting title',importStatus:'approved',sourceFormat:'DOCX'})
  expect(approve.mock.calls[0][0].importEvidence.tables).toHaveLength(3)
})

test('splits an imported item and undoes the correction with its technical table intact',async()=>{
  const user=userEvent.setup()
  render(<ImportReview onApprove={()=>{}}/>)
  const bytes=zipSync({'word/document.xml':strToU8(fictionalMinutesXml)})
  const file=new File([bytes],'fictional.docx',{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'})
  Object.defineProperty(file,'arrayBuffer',{value:async()=>bytes.buffer})
  await user.upload(screen.getByLabelText('Choose DOCX, PDF or scan image'),file)
  await user.click(await screen.findByRole('button',{name:/Check delivery metrics/}))
  await user.click(screen.getByText('Correct item boundaries and order'))
  await user.click(screen.getByRole('button',{name:'Split item'}))
  expect(screen.getByRole('button',{name:/^1\.1-part2/})).toBeInTheDocument()
  await user.click(screen.getByRole('button',{name:'Undo correction'}))
  expect(screen.queryByRole('button',{name:/^1\.1-part2/})).not.toBeInTheDocument()
  const itemReview=screen.getByRole('heading',{name:'Review item 1.1'}).closest('section')!
  expect(within(itemReview).getByRole('table',{name:'Embedded technical table'})).toBeInTheDocument()
})
