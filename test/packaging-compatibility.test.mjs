import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

test('Core digest sorts slash-separated relative paths',()=>{
  const root=mkdtempSync(join(tmpdir(),'core-order-'));
  try {
    mkdirSync(join(root,'a')); writeFileSync(join(root,'a','x'),'one'); writeFileSync(join(root,'a-z'),'two');
    const hash=createHash('sha256'); for(const [name,contents] of [['a-z','two'],['a/x','one']]) hash.update(name).update('\0').update(contents);
    const result=spawnSync(process.execPath,['scripts/test-compatibility.mjs','--core-artifact',root,'--print-digest','true'],{encoding:'utf8'});
    assert.equal(result.status,0,result.stderr); assert.equal(result.stdout.trim(),`sha256:${hash.digest('hex')}`);
  } finally { rmSync(root,{recursive:true,force:true}); }
});

test('package includes creative license and excludes unavailable scripts',()=>{
  const pkg=JSON.parse(readFileSync('package.json','utf8'));
  assert.ok(pkg.files.includes('packs/adlc-creative-team/LICENSE'));
  assert.ok(!pkg.files.includes('packs/adlc-creative-team/scripts/**'));
  assert.equal(pkg.engines.node,'>=21'); assert.equal(pkg.scripts['test:full-suite'],'npm test');
  assert.match(readFileSync('.gitignore','utf8'),/packs\/adlc-creative-team\/\.host-artifacts\//);
});
