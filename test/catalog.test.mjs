import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { packs, installedPacks, latestPacks, packCatalog } from '../catalog.mjs';
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
  for (const [id, version] of [['adlc', '0.2.0'], ['adlc', '0.2.1'], ['adlc', '0.2.3'], ['adlc', '0.2.4'], ['adlc', '0.2.5'], ['marketing', '0.0.1'], ['marketing', '0.0.3'], ['creative-team', '0.1.0'], ['creative-team', '0.2.0']]) {
    const path = resolve(root, 'dist', id, version, 'pack.json');
    assert.equal(installedPacks.some(pack => pack.id === id && pack.version === version), existsSync(path));
  }
});
