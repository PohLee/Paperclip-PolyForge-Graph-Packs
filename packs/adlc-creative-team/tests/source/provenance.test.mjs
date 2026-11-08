import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access, mkdtemp, cp, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { pack } from '../../index.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..','..');

test('four optional method references retain provenance and license notices only',async()=>{
 const references=JSON.parse(await readFile(join(root,'sources/references.json'),'utf8'));
 assert.deepEqual(pack.methodReferences,references);
 assert.equal(references.schemaVersion,1);
 assert.equal(references.purpose,'optional-method-attribution');
 assert.equal(references.runtimeRequired,false);
 assert.deepEqual(references.sources.map(x=>x.id),['designer-skills','taste-skill','impeccable','hallmark']);
 for(const source of references.sources){
  assert.match(source.commit,/^[a-f0-9]{40}$/);
  assert.match(source.repository,/^https:\/\/github\.com\/[^/]+\/[^/]+$/);
  assert.ok(['MIT','Apache-2.0'].includes(source.license));
  for(const field of ['destination','treeSha256','path']) assert.equal(source[field],undefined);
  assert.match(source.licenseFile,/^sources\/licenses\/[^/]+$/);
  assert.ok((await readFile(join(root,source.licenseFile),'utf8')).length>900);
  if(source.noticeFile) assert.match(await readFile(join(root,source.noticeFile),'utf8'),/platform-design-skills/);
 }
});

test('serialized roles carry complete local methods without upstream runtime resolution',async()=>{
 assert.equal(pack.sourceSnapshot,undefined);
 const serialized=JSON.parse(JSON.stringify(pack));
 assert.equal(Object.keys(serialized.skills).length,26);
 for(const role of Object.values(serialized.roles)) for(const id of role.skills){
  const skill=serialized.skills[id];
  assert.ok(skill?.content.length>200,`${role.id}/${id} lacks embedded instructions`);
  assert.equal(skill.digest,createHash('sha256').update(skill.content).digest('hex'));
  assert.doesNotMatch(skill.content,/resolve-source|materialize-sources|sources\/upstream|On-demand source methods/);
 }
 for(const path of ['sources/upstream','sources/upstream.lock.json','sources/integrity.mjs',
   'scripts/resolve-source.mjs','scripts/materialize-sources.mjs']){
  await assert.rejects(access(join(root,path)),{code:'ENOENT'});
 }
});

test('isolated package imports with filesystem reads confined to shipped files and no network/process permissions',async()=>{
 const temp=await mkdtemp(join(tmpdir(),'creative-offline-'));
 try{
  const manifest=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
  for(const entry of manifest.files){
   assert.doesNotMatch(entry,/upstream|resolve-source|materialize-sources/);
   const relative=entry.replace(/\/\*\*$/,'');
   await cp(join(root,relative),join(temp,relative),{recursive:true});
  }
  const script=`
    import assert from 'node:assert/strict';
    import { writeFileSync, readFileSync } from 'node:fs';
    import { spawnSync } from 'node:child_process';
    const {pack,loadPack,createCreativeHostApi}=await import(${JSON.stringify(pathToFileURL(join(temp,'index.mjs')).href)});
    assert.equal(pack,loadPack());
    assert.equal(pack.version,'0.3.1');
    assert.equal(pack.graphs.length,19);
    assert.equal(Object.keys(pack.skills).length,26);
    assert.equal(typeof createCreativeHostApi,'function');
    assert.equal(pack.methodReferences.runtimeRequired,false);
    assert.equal(process.permission.has('child'),false);
    assert.equal(process.permission.has('fs.write'),false);
    assert.throws(()=>readFileSync(${JSON.stringify(join(root,'index.mjs'))}),{code:'ERR_ACCESS_DENIED'});
    assert.throws(()=>writeFileSync(${JSON.stringify(join(temp,'unexpected'))},''),{code:'ERR_ACCESS_DENIED'});
    assert.throws(()=>spawnSync(process.execPath,['--version']),{code:'ERR_ACCESS_DENIED'});
    // Node versions with network permissions must also remain offline.
    if(process.allowedNodeEnvironmentFlags.has('--allow-net')) assert.equal(process.permission.has('net'),false);
    console.log('offline pack import passed');
  `;
  const result=spawnSync(process.execPath,['--permission',`--allow-fs-read=${temp}`,'--input-type=module','--eval',script],
    {cwd:temp,encoding:'utf8',timeout:30000,env:{...process.env,NODE_OPTIONS:''}});
  assert.equal(result.status,0,result.stderr||result.error?.message);
  assert.match(result.stdout,/offline pack import passed/);
 }finally{await rm(temp,{recursive:true,force:true});}
});
