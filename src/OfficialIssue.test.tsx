import { render,screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { sampleMeeting } from './fixtures'
import { ReviewView } from './ReviewView'
import { ExportView } from './ExportView'
import type { MeetingDocument } from './model'

test('finalize, amend and export an unchanged saved issue',async()=>{
  const user=userEvent.setup()
  function Harness(){
    const [meeting,setMeeting]=useState<MeetingDocument>({...structuredClone(sampleMeeting),lifecycle:'under_review',preparedBy:'Secretary',checkedBy:'Reviewer',approvedBy:'Chair'})
    const [view,setView]=useState('review')
    return <><button onClick={()=>setView('export')}>Open output</button>{view==='review'?<ReviewView meeting={meeting} onChange={setMeeting}/>:<ExportView meeting={meeting} onChange={setMeeting} notify={()=>{}}/>}</>
  }
  render(<Harness/>)
  await user.click(screen.getByRole('button',{name:'Approve & finalize'}))
  expect(screen.getByText('No content changes from this saved issue.')).toBeInTheDocument()
  await user.click(screen.getByRole('button',{name:'Create amendment'}))
  expect(screen.getByLabelText('Approved by')).toHaveValue('')
  await user.click(screen.getByRole('button',{name:'Open output'}))
  await user.click(screen.getByLabelText('Action summary'))
  expect(screen.getByRole('heading',{name:'Action summary'})).toBeInTheDocument()
  await user.selectOptions(screen.getByLabelText('Export version'),'1')
  expect(screen.getByLabelText('Document title')).toBeDisabled()
  expect(screen.queryByRole('heading',{name:'Action summary'})).not.toBeInTheDocument()
  expect(screen.getByText('A4 preview · Final issue')).toBeInTheDocument()
})
