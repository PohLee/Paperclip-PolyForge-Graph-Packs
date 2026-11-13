import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectLogoSvg } from '../adapters/brand-tools/svg.mjs';

test('logo SVG allows static shapes and rejects active content bypasses', () => {
  assert.equal(inspectLogoSvg('<svg viewBox="0 0 1 1"><defs><linearGradient id="g"/></defs><path fill="url(#g)" d="M0 0"/></svg>').valid,true);
  for (const svg of [
    '<svg xmlns="http://www.w3.org/2000/svg" xmlns:s="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><s:script>alert(1)</s:script></svg>',
    '<svg viewBox="0 0 1 1"><s:image/></svg>',
    '<svg viewBox="0 0 1 1"><s:foreignObject/></svg>',
    String.raw`<svg viewBox="0 0 1 1"><path style="fill:\75rl(http://x/a#p)"/></svg>`,
    '<svg viewBox="0 0 1 1"><a><set attributeName="href" to="javascript:alert(1)"/></a></svg>',
    '<svg viewBox="0 0 1 1"><animate attributeName="href"/></svg>',
    '<svg viewBox="0 0 1 1"><path fill="url(http://x)"/></svg>',
    '<svg viewBox="0 0 1 1"><![CDATA[hello]]></svg>',
    '<svg viewBox="0 0 1 1"><?bad x?></svg>'
  ]) assert.equal(inspectLogoSvg(svg).valid,false,svg);
});
