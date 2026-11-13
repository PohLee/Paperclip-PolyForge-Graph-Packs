import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { packs, installedPacks, installedReleasePaths, latestPacks, packCatalog } from '../catalog.mjs';
import { packs as sourcePacks } from '../index.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

test('opt-in catalog keeps installed releases and latest source versions unique', () => {
  const keys = packs.map(pack => `${pack.id}@${pack.version}`);
  assert.equal(new Set(keys).size, keys.length);
  assert.deepEqual(latestPacks, sourcePacks);
  for (const source of sourcePacks) {
    assert.ok(keys.includes(`${source.id}@${source.version}`));
    assert.equal(packCatalog[source.id], source);
  }
  for (const [id, version] of installedReleasePaths) {
    const path = resolve(root, 'dist', id, version, 'pack.json');
    assert.equal(installedPacks.some(pack => pack.id === id && pack.version === version), existsSync(path));
  }
});

// Tags are the durable release record; source candidates need an entry once tagged.
test('tagged Pack releases are in the installed release allowlist', t => {
  let tags;
  try {
    tags = execFileSync('git', ['tag', '--list'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().split(/\r?\n/).filter(Boolean);
  } catch { t.skip('Git tags unavailable'); return; }
  if (!tags.length) { t.skip('No Git tags available'); return; }
  const allowed = new Set(installedReleasePaths.map(([id, version]) => `${id}/v${version}`));
  const packTags = tags.filter(tag => /^[a-z0-9-]+\/v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(tag));
  if (!packTags.length) { t.skip('No Pack release tags available'); return; }
  for (const tag of packTags) assert.ok(allowed.has(tag), `${tag} is missing from installedReleasePaths`);
  for (const pack of sourcePacks) {
    const tag = `${pack.id}/v${pack.version}`;
    if (tags.includes(tag)) assert.ok(allowed.has(tag), `Tagged source ${tag} is missing from installedReleasePaths`);
  }
});
