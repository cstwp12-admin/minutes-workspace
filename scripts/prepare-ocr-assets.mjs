import { createRequire } from 'node:module'
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const require=createRequire(import.meta.url)
const root=fileURLToPath(new URL('..',import.meta.url)),target=join(root,'public','ocr')
mkdirSync(target,{recursive:true})
const engine=dirname(require.resolve('tesseract.js/package.json')),core=dirname(require.resolve('tesseract.js-core/package.json')),english=require('@tesseract.js-data/eng')
copyFileSync(join(engine,'dist','worker.min.js'),join(target,'worker.min.js'))
for(const name of readdirSync(core))if(/^tesseract-core.*\.wasm(?:\.js)?$/.test(name)||name==='LICENSE')copyFileSync(join(core,name),join(target,name))
copyFileSync(join(english.langPath,'eng.traineddata.gz'),join(target,'eng.traineddata.gz'))
console.log('Prepared local OCR worker, WASM cores and English recognition data.')
