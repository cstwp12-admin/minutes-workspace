import { describe, expect, it } from 'vitest'
import { sampleMeeting } from './fixtures'
import { exportActionsCsv } from './ExportView'

describe('official export utilities', () => {
  it('exports linked actions with their minute references', () => {
    const csv = exportActionsCsv(sampleMeeting)
    const action = sampleMeeting.items.find(item => item.action)!
    expect(csv).toContain('"Minute reference"')
    expect(csv).toContain(`"${action.itemRef}"`)
    expect(csv).toContain(`"${action.action!.actionRef}"`)
  })

  it('escapes quotation marks in action text', () => {
    const meeting = structuredClone(sampleMeeting)
    const item = meeting.items.find(entry => entry.action)!
    item.action!.requiredAction = 'Confirm "approved" drawing'
    expect(exportActionsCsv(meeting)).toContain('"Confirm ""approved"" drawing"')
  })
})
