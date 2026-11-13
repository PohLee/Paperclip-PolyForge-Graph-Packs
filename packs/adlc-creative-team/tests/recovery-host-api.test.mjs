import test from 'node:test';
import assert from 'node:assert/strict';
import { GraphEngine, runValidationDigest } from './core-import.mjs';
import { pack, createCreativeHostApi, creativeRequiredServicesByGraph } from '../index.mjs';

const actor={id:'host-worker',kind:'agent',roles:['design-ops-producer'],executionId:'host-worker-exec'};
const createApi=options=>createCreativeHostApi({runValidationDigest,...options});

test('Creative recovery validates the exact current artifact snapshot read-only',async()=>{
  const engine=new GraphEngine(); await engine.registerPack(pack);
  const api=createApi({engine,resolveActor:({claimedActor})=>claimedActor});
  const run=await api.startRun({packId:'creative-team',packVersion:pack.version,graphId:'creative-intake',mode:'manual',actor:{id:'owner',kind:'human',roles:['human-owner'],executionId:null},input:{}});
  const payload={id:'inventory',version:'1',summary:'Existing project context',sources:['Operator-provided project notes']};
  await api.submitNode({runId:run.id,nodeId:'read-context',actor,artifacts:[{id:payload.id,version:payload.version,kind:'context_inventory'}],payloads:{context_inventory:payload}});
  const snapshot=await engine.getRun(run.id),decisions=await engine.listDecisions({runId:run.id});
  const valid=await api.validateRun({run:snapshot,decisions});
  assert.equal(valid.valid,true);
  assert.deepEqual(valid.validatedSubjectRefs,[{id:'inventory',version:'1',kind:'context_inventory'}]);
  const staleNodeOutput=structuredClone(snapshot);
  staleNodeOutput.nodeStates['read-context'].output.creativeArtifacts.context_inventory.summary='Different operational payload';
  const staleNodeOutputResult=await api.validateRun({run:staleNodeOutput,decisions});
  assert.ok(staleNodeOutputResult.issues.some(issue=>issue.code==='node-output-mismatch'));
  const missingAttempt=structuredClone(snapshot);
  missingAttempt.nodeStates['read-context'].attempts=[];
  const missingAttemptResult=await api.validateRun({run:missingAttempt,decisions});
  assert.ok(missingAttemptResult.issues.some(issue=>issue.code==='current-attempt-missing'));
  const foreignRunDecision=structuredClone(snapshot);
  foreignRunDecision.graph.nodes.push({id:'foreign-route',type:'decision'});
  foreignRunDecision.nodeStates['foreign-route']={status:'completed',outcome:'approved',attempts:[{decisionId:'decision-1'}]};
  const foreignRunDecisionResult=await api.validateRun({run:foreignRunDecision,decisions:[{id:'decision-1',runId:'another-run',nodeId:'foreign-route',status:'decided',outcome:'approved'}]});
  assert.ok(foreignRunDecisionResult.issues.some(issue=>issue.code==='decision-record-mismatch'));
  const invalidSnapshot=structuredClone(snapshot);
  invalidSnapshot.nodeStates['read-context'].attempts.at(-1).output.creativeArtifacts.context_inventory.summary='';
  const invalid=await api.validateRun({run:invalidSnapshot,decisions});
  assert.equal(invalid.valid,false);
  assert.ok(invalid.issues.some(issue=>issue.code==='artifact-schema-invalid'));
  assert.equal((await engine.getRun(run.id)).nodeStates['read-context'].attempts.at(-1).output.creativeArtifacts.context_inventory.summary,'Existing project context');
  const badReference=structuredClone(snapshot);
  badReference.input.localArtifactRef={id:'inventory',version:'1',kind:'forged_kind',digest:'0'.repeat(64)};
  const badReferenceResult=await api.validateRun({run:badReference,decisions});
  assert.ok(badReferenceResult.issues.some(issue=>issue.code==='local-reference-kind-mismatch'));
  assert.ok(badReferenceResult.issues.some(issue=>issue.code==='local-reference-digest-mismatch'));
  const missingDecisions=await api.validateRun({run:snapshot});
  assert.equal(missingDecisions.valid,false);
  assert.ok(missingDecisions.issues.some(issue=>issue.code==='decision-snapshot-missing'));
});

test('Creative graph service requirements are source-owned and fail closed without fictitious image generation',()=>{
  assert.ok(creativeRequiredServicesByGraph['concept-sprint'].includes('hasImageProvider'));
  assert.ok(creativeRequiredServicesByGraph['concept-sprint'].includes('decodeImage'));
  assert.equal(creativeRequiredServicesByGraph['concept-sprint'].includes('generateImages'),false);
});

test('Creative recovery rejects legacy design-system runs missing baseline or bootstrap input',async()=>{
  const engine=new GraphEngine(); await engine.registerPack(pack);
  const api=createApi({engine,resolveActor:({claimedActor})=>claimedActor});
  const run=await engine.startRun({packId:'creative-team',packVersion:pack.version,graphId:'design-system-evolution',mode:'manual',actor:{id:'owner',kind:'human',roles:['human-owner'],executionId:null},input:{design_baseline:{id:'baseline',version:'1'},brand_baseline:{id:'bootstrap',version:'1'},designBaselineRef:{id:'baseline',version:'1',kind:'design_baseline'},bootstrapRef:{id:'bootstrap',version:'1',kind:'brand_baseline'}}});
  const snapshot=await engine.getRun(run.id),decisions=await engine.listDecisions({runId:run.id});
  const result=await api.validateRun({run:snapshot,decisions});
  assert.equal(result.valid,false);
  assert.ok(result.issues.some(issue=>issue.code==='start-input-invalid'&&issue.message.includes('Choose an existing design baseline or an explicit bootstrap context')));
});


test('submission rejects a payload without an artifact envelope',async()=>{
  const engine=new GraphEngine(); await engine.registerPack(pack);
  const api=createApi({engine,resolveActor:({claimedActor})=>claimedActor});
  const run=await api.startRun({packId:'creative-team',packVersion:pack.version,graphId:'creative-intake',mode:'manual',actor:{id:'owner',kind:'human',roles:['human-owner'],executionId:null},input:{}});
  const payload={id:'inventory',version:'1',summary:'Context',sources:['Notes']};
  await assert.rejects(api.submitNode({runId:run.id,nodeId:'read-context',actor,artifacts:[{id:'inventory',version:'1',kind:'context_inventory'}],payloads:{context_inventory:payload,extra:{}}}),/no matching artifact/);
});
