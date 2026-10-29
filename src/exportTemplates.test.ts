import { describe,expect,it } from 'vitest'
import { exportTemplates,getExportTemplate } from './exportTemplates'

describe('document templates',()=>{
  it('offers project-neutral templates with unique identities',()=>{
    expect(exportTemplates).toHaveLength(8)
    expect(new Set(exportTemplates.map(template=>template.id)).size).toBe(exportTemplates.length)
    expect(exportTemplates.every(template=>template.name&&template.documentTitle&&template.accent)).toBe(true)
  })
  it('falls back safely to the standard template',()=>expect(getExportTemplate('missing').id).toBe('standard'))
})
