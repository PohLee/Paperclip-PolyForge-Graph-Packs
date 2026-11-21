import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { pack as adlc } from '../packs/adlc/index.mjs';
import { pack as marketing } from '../packs/marketing/index.mjs';
import { pack as creative } from '../packs/adlc-creative-team/index.mjs';

test('pack payload digests match LF release values', () => {
  for (const [pack, expected] of [[adlc,'f8cd929ad445e070db88fc0c9102d0f3c7781c8fa31e71f0880d31d8d56f883b'],[marketing,'b04b6bc0e46b2f7480a0d62c21a5ed98b33a63f88f48cc8ef3ccf2421e2c2568'],[creative,'7ce4dd7905dae654868c29744808393770e1d53b5f2d3f7af33f61c5f300c2dd']]) {
    const { release, ...payload } = pack;
    assert.equal(createHash('sha256').update(JSON.stringify(payload)).digest('hex'), expected);
  }
});
