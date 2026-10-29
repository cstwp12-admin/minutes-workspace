import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { sampleMeeting } from './fixtures'

test('navigates a realistic meeting vertical slice and updates status', async()=>{
  const user=userEvent.setup()
  render(<App/>)
  expect(screen.getByRole('heading',{name:/Release readiness/})).toBeInTheDocument()
  await user.click(screen.getByRole('button',{name:/Training rollout/}))
  expect(screen.getByRole('heading',{name:'Training rollout'})).toBeInTheDocument()
  await user.selectOptions(screen.getByLabelText('Status'),'Closed')
  expect(screen.getAllByText('Closed').length).toBeGreaterThan(0)
})

test('shows linked action register', async()=>{
  const user=userEvent.setup()
  render(<App/>)
  await user.click(screen.getByRole('button',{name:/Actions/}))
  expect(screen.getByRole('heading',{name:'Action register'})).toBeInTheDocument()
  expect(screen.getByText('ACT-31')).toBeInTheDocument()
})

test('protects final content outside the review screen',async()=>{
  const user=userEvent.setup()
  render(<App initialMeeting={{...structuredClone(sampleMeeting),lifecycle:'finalized'}}/>)
  await user.selectOptions(screen.getByLabelText('Status'),'Closed')
  expect(screen.getByLabelText('Status')).toHaveValue('Overdue')
  expect(screen.getByText(/Final issue R1 is read-only/)).toBeInTheDocument()
})
