import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { packCatalog } from '../index.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs,part,index,all) => part.startsWith('--') ? [...pairs,[part.slice(2),all[index+1]]] : pairs, []));
const root = resolve(args['core-artifact'] ?? '');
const expected = args['core-digest'], version = args['core-version'];
if (!args['core-artifact']) throw new Error('Pass --core-artifact');
function files(dir) { return readdirSync(dir,{withFileTypes:true}).flatMap(entry => entry.isDirectory() ? files(resolve(dir,entry.name)) : [resolve(dir,entry.name)]); }
const hash = createHash('sha256');
for (const file of files(root).sort()) { hash.update(relative(root,file).split(sep).join('/')); hash.update('\0'); hash.update(readFileSync(file)); }
const actual = `sha256:${hash.digest('hex')}`;
if (args['print-digest'] === 'true') { process.stdout.write(`${actual}\n`); process.exit(0); }
if (!/^sha256:[a-f0-9]{64}$/.test(expected ?? '') || !version) throw new Error('Pass --core-digest sha256:<hex> and --core-version');
if (actual !== expected) throw new Error(`Core artifact digest mismatch: expected ${expected}, got ${actual}`);
const core = await import(pathToFileURL(resolve(root,'src/core/index.mjs')).href);
if (core.CORE_RUNTIME?.version !== version) throw new Error(`Core runtime version ${core.CORE_RUNTIME?.version ?? 'missing'} differs from pinned ${version}`);
const result = { core:{version,digest:actual}, packs:Object.values(packCatalog).map(pack => ({id:pack.id,version:pack.version,digest:pack.release.digest})), at:new Date().toISOString(), passed:false };
try {
  const engine = new core.GraphEngine();
  for (const pack of Object.values(packCatalog)) await engine.registerPack(pack);
  if (args['full-suite'] === 'true') {
    const suite = spawnSync(process.execPath,['--test','test/*.test.mjs','packs/adlc-creative-team/tests/*.test.mjs','packs/adlc-creative-team/tests/skills/*.test.mjs','packs/adlc-creative-team/tests/source/*.test.mjs'],{
      cwd:resolve('.'), env:{...process.env,PINNED_CORE_ARTIFACT:root}, encoding:'utf8', maxBuffer:4*1024*1024
    });
    const output = `${suite.stdout ?? ''}${suite.stderr ?? ''}`;
    process.stdout.write(output.split(/\r?\n/).slice(-14).join('\n')+'\n');
    result.fullSuite = { passed:suite.status===0, tests:Number(output.match(/ℹ tests (\d+)/)?.[1] ?? 0),
      failures:Number(output.match(/ℹ fail (\d+)/)?.[1] ?? -1) };
    if (!result.fullSuite.passed) throw new Error('Pinned Core full Packs suite failed');
  }
  result.passed = true;
} finally {
  const dir = resolve('dist','compat-reports'); mkdirSync(dir,{recursive:true});
  const file = resolve(dir,`core-${version}-${actual.slice(7,19)}.json`);
  writeFileSync(file,JSON.stringify(result,null,2)+'\n');
  process.stdout.write(`${file}: ${result.passed ? 'PASS' : 'FAIL'}\n`);
}
