import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { roleCatalog, roleSkills } from '../../roles/catalog.mjs';
import { graphs } from '../../graphs/catalog.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..','..');
import { skillCatalog } from '../../skills/catalog.mjs';
test('all proposal roles have five role docs and valid reporting parents',async()=>{
 assert.equal(roleCatalog.length,14); const ids=new Set(roleCatalog.map(r=>r.id));
 for(const r of roleCatalog){assert.ok(r.name&&r.supervisor);assert.ok(r.reportsToRole===null||ids.has(r.reportsToRole));for(const f of ['soul','role','goal','instruction','decision_model']) assert.ok((await readFile(join(root,'roles',r.id,`${f}.md`),'utf8')).length>30);}
});
test('skill discovery points to complete graph methods and mode routing',async()=>{
 assert.ok(Object.keys(skillCatalog).length>=10);
 for(const [id,s] of Object.entries(skillCatalog)){const md=await readFile(join(root,'skills',`${id}.md`),'utf8');assert.match(md,/^---\nname:/);assert.ok(md.includes(s.description));}
 const router=await readFile(join(root,'skills','visual-direction-adapter.md'),'utf8');
 for(const term of ['explorationMode','surfaceMode','brand-territory','product-structure','surface-composition','approved project brand']) assert.ok(router.includes(term));
 const sprint=await readFile(join(root,'skills','concept-sprint.md'),'utf8');assert.match(sprint,/3–5 distinct static concept images/);assert.match(sprint,/one HTML gallery/);
});
test('every role skill resolves to discovery metadata',()=>{ for(const ids of Object.values(roleSkills)) for(const id of ids) assert.ok(skillCatalog[id]); });
test('optional attribution resolves to metadata, never source checkout paths',async()=>{
 const references=JSON.parse(await readFile(join(root,'sources','references.json'),'utf8'));
 const sources=new Set(references.sources.map(source=>source.id));
 for(const skill of Object.values(skillCatalog)) {
  assert.equal(skill.upstreamSources,undefined);
  for(const id of skill.optionalReferenceIds??[]) assert.ok(sources.has(id),`unknown source ${id}`);
 }
 assert.deepEqual(skillCatalog['hallmark-design-review'].optionalReferenceIds,['hallmark']);
 for(const role of ['design-director','product-designer','design-engineer','design-qa-accessibility','art-director']) {
  assert.ok(roleSkills[role].includes('hallmark-design-review'));
 }
});
test('every graph decision is explicit and manual decisions are human-owned',async()=>{
 for(const node of graphs.flatMap(graph=>graph.nodes).filter(node=>node.type==='decision')){
  const modelText=await readFile(join(root,'roles',node.role,'decision_model.md'),'utf8');
  const json=JSON.parse(modelText.match(/```json\s*([\s\S]*?)\s*```/)[1]);
  const rule=json.rules.find(item=>item.type===node.decisionType); assert.ok(rule,`${node.decisionType} missing for ${node.role}`);
  for(const mode of ['manual','assisted','autonomous']) assert.ok(rule.modes[mode],`${node.decisionType} missing ${mode}`);
  assert.ok(rule.modes.manual.allowedRoles.includes(node.role));
  assert.ok(rule.modes.manual.allowedRoles.includes('human-owner'));
  assert.deepEqual(rule.modes.manual.allowedKinds,['human']);
  assert.equal(rule.modes.manual.requiresHuman,true);
 }
 const modelText=await readFile(join(root,'roles','head-of-design','decision_model.md'),'utf8');
 const model=JSON.parse(modelText.match(/```json\s*([\s\S]*?)\s*```/)[1]);
 const selection=model.rules.find(item=>item.type==='concept-selection');
 for(const policy of Object.values(selection.modes)){assert.ok(policy.allowedRoles.includes('head-of-design'));assert.ok(policy.allowedRoles.includes('human-owner'));assert.deepEqual(policy.allowedKinds,['human']);assert.equal(policy.requiresHuman,true);}
});
