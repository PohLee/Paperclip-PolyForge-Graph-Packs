import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { runtimeDigests } from './runtime-digests-helper.mjs';

const fixture = JSON.parse(readFileSync('test/fixtures/runtime-digests.json','utf8'));
const git = args => { try { return execFileSync('git',args,{stdio:['ignore','pipe','ignore']}); } catch { return null; } };

test('versioned runtime files match their recorded digests',()=>{
  for(const [key,files] of Object.entries(runtimeDigests())) {
    assert.deepEqual(files,fixture[key],`${key} runtime files changed; bump the Pack version, then run node test/runtime-digests-helper.mjs --write`);
  }
});

// A fixture can be regenerated without a version bump; a released tag cannot be rewritten.
test('recorded runtime digests of tagged versions match the tagged files',t=>{
  for(const [key,files] of Object.entries(fixture)) {
    const [id,version]=key.split('@'), tag=`${id}/v${version}`;
    if(!git(['rev-parse','--verify','--quiet',`refs/tags/${tag}`])) { t.diagnostic(`${tag} is not tagged; skipped`); continue; }
    for(const [file,expected] of Object.entries(files)) {
      const bytes=git(['show',`${tag}:${file}`]);
      assert.ok(bytes,`${file} is missing from ${tag}`);
      assert.equal(createHash('sha256').update(bytes).digest('hex'),expected,`${file} differs from ${tag}; bump ${id}`);
    }
  }
});
