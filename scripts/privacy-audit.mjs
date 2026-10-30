import { readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join, relative } from 'node:path'

const root = new URL('..', import.meta.url).pathname.replace(/^\/(.:)/, '$1')
const scanRoots = ['src', 'docs', 'supabase', '.github', 'README.md', 'index.html', 'package.json']
const textExtensions = new Set(['.ts','.tsx','.css','.md','.html','.json','.yml','.yaml','.sql'])
const forbidden = [
  /WP12/i, /Pan Borneo/i, /Sarang/i, /Temuno/i, /QAQC/i,
  /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/i,
]
const forbiddenFiles = [/\.docx$/i,/\.pdf$/i,/\.env$/i,/\.(?:png|jpe?g|gif|webp)$/i]

function filesAt(path){
  if(!statSync(path).isDirectory()) return [path]
  return readdirSync(path).flatMap(name => filesAt(join(path,name)))
}

const findings = []
for(const entry of scanRoots){
  for(const file of filesAt(join(root,entry))){
    const name = relative(root,file).replaceAll('\\','/')
    if(forbiddenFiles.some(rule=>rule.test(name))) findings.push(`${name}: private asset type`)
    if(!textExtensions.has(extname(file))) continue
    const content = readFileSync(file,'utf8')
    forbidden.forEach(rule => { if(rule.test(content)) findings.push(`${name}: matched ${rule}`) })
  }
}
if(findings.length){ console.error(`Privacy audit failed:\n${findings.join('\n')}`); process.exit(1) }
console.log('Privacy audit passed: no known private identifiers, secrets, documents or image assets found.')
