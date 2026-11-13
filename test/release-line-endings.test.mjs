import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { pack as adlc } from '../packs/adlc/index.mjs';
import { pack as marketing } from '../packs/marketing/index.mjs';
import { pack as creative } from '../packs/adlc-creative-team/index.mjs';

test('pack payload digests match LF release values', () => {
  for (const [pack, expected] of [[adlc,'80df9a1ad15f38f8169e642a856afc11ff1ffb6d09a4d710be49a7391893738b'],[marketing,'5262d230f4d71337bd8fb88c77fa27154ac7a8b5207f890ac63579c67a9e8153'],[creative,'df7036767e209ea87d4bc985f179ea25f6083607702a609028de2826de5782a5']]) {
    const { release, ...payload } = pack;
    assert.equal(createHash('sha256').update(JSON.stringify(payload)).digest('hex'), expected);
  }
});
