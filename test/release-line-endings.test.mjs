import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { pack as adlc } from '../packs/adlc/index.mjs';
import { pack as marketing } from '../packs/marketing/index.mjs';
import { pack as creative } from '../packs/adlc-creative-team/index.mjs';
import { installedPacks, installedReleasePaths } from '../catalog.mjs';

test('pack payload digests match LF release values', () => {
  for (const [pack, expected] of [[adlc,'5e934adcb60b2008856dd2010b7ba175e1a1c84e76de43b2733a56217341fbcf'],[marketing,'b04b6bc0e46b2f7480a0d62c21a5ed98b33a63f88f48cc8ef3ccf2421e2c2568'],[creative,'ab34022754b3e93632047c16ce5966eb1c13c189430d99b5cdf27813cb80b6b5']]) {
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
