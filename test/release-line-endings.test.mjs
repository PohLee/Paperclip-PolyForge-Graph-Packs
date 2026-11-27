import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { pack as adlc } from '../packs/adlc/index.mjs';
import { pack as marketing } from '../packs/marketing/index.mjs';
import { pack as creative } from '../packs/adlc-creative-team/index.mjs';
import { installedPacks, installedReleasePaths } from '../catalog.mjs';

test('pack payload digests match LF release values', () => {
  for (const [pack, expected] of [[adlc,'ff23b3a3cec2bff4242cbcc7098bcead223d8f4e97e0e8c33f8dcebbf8423ea8'],[marketing,'b04b6bc0e46b2f7480a0d62c21a5ed98b33a63f88f48cc8ef3ccf2421e2c2568'],[creative,'40b91a244cd3355cf1b3c4c620ba791107c6d9fe9a5b4167171fb38815085b14']]) {
    const { release, ...payload } = pack;
    assert.equal(createHash('sha256').update(JSON.stringify(payload)).digest('hex'), expected);
  }
});

test('the catalog keeps the previous discovery release immutable alongside the citation contract', () => {
  assert.deepEqual(installedReleasePaths.filter(([id, version]) => id === 'adlc' && ['0.3.9', '0.3.10'].includes(version)),
    [['adlc', '0.3.9'], ['adlc', '0.3.10']]);
  const discovery = adlc.graphs.find(graph => graph.id === 'product-discovery');
  assert.equal(discovery.version, '0.2.2');
  assert.equal(discovery.compatibility.requiredCapabilities['review-source-refs'], '^1.0.0');
  assert.equal(discovery.nodes.find(node => node.id === 'synthesize-discovery').review.requiredSourceRefs.reportKind, 'discovery_brief');
});

const historicalDiscovery = installedPacks.find(item => item.id === 'adlc' && item.version === '0.3.9');
test('the installed adlc@0.3.9 release keeps discovery without the citation contract', {
  skip: historicalDiscovery ? false : 'dist/adlc/0.3.9 is not installed; build it to check the historical release'
}, () => {
  assert.equal(historicalDiscovery.release.digest, 'sha256:ae427d571c77112541a03f728223a1fae0178108490b71f5e7e02dab00bd7630');
  const discovery = historicalDiscovery.graphs.find(graph => graph.id === 'product-discovery');
  assert.equal(discovery.version, '0.2.1');
  assert.equal(discovery.nodes.find(node => node.id === 'synthesize-discovery').review.requiredSourceRefs, undefined);
});
