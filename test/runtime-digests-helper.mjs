import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pack as adlc } from '../packs/adlc/index.mjs';
import { pack as creative } from '../packs/adlc-creative-team/index.mjs';
const walk=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(`${dir}/${entry.name}`):entry.name.endsWith('.mjs')?[`${dir}/${entry.name}`]:[]);
const sets={ [`${adlc.id}@${adlc.version}`]:['packs/adlc/runtime/host-api.mjs','packs/adlc/product-method-contracts.mjs'], [`${creative.id}@${creative.version}`]:[...walk('packs/adlc-creative-team/runtime'),'packs/adlc-creative-team/contracts/validate.mjs',...walk('packs/adlc-creative-team/adapters')] };
export const runtimeDigests=()=>Object.fromEntries(Object.entries(sets).map(([key,files])=>[key,Object.fromEntries(files.sort().map(file=>[file,createHash('sha256').update(readFileSync(file)).digest('hex')]))]));
// Merge so digests of earlier released versions stay recorded and remain checkable against their tags.
if(process.argv.includes('--write')) {
  const path='test/fixtures/runtime-digests.json';
  writeFileSync(path,JSON.stringify({...JSON.parse(readFileSync(path,'utf8')),...runtimeDigests()},null,2)+'\n');
}
