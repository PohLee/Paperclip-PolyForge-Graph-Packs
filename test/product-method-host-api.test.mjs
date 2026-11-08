import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { pack, createAdlcHostApi } from '../packs/adlc/index.mjs';

const coreArtifact=process.env.PINNED_CORE_ARTIFACT;
const coreUrl=coreArtifact ? pathToFileURL(resolve(coreArtifact,'src/core/index.mjs')).href : new URL('../../Paperclip-PolyForge-Graph/src/core/index.mjs',import.meta.url).href;
const { GraphEngine,runValidationDigest }=await import(coreUrl);
const actor=({claimedActor})=>({id:claimedActor?.id??'host-owner',kind:claimedActor?.kind??'human',roles:claimedActor?.roles??['human-owner'],executionId:claimedActor?.executionId??'host-execution'});
let methodRunNumber=0;
const taskActor=node=>({id:node.role,kind:'agent',roles:[node.role],executionId:`execution-${node.id}`});
const owner=node=>({id:`owner-${node.role}`,kind:'human',roles:['human-owner',node.role],executionId:`owner-${node.id}`});

async function finishTask({engine,api,run,node,payloads={}}) {
  const artifacts=(node.produces??[]).map(kind=>({id:payloads[kind]?.id??`${node.id}-${kind}`,version:payloads[kind]?.version??'1',kind}));
  const worker=taskActor(node);
  const workDecision=node.decisionTraceRequired ? await engine.recordWorkDecision({
    runId:run.id,nodeId:node.id,actor:worker,category:'process',question:`Which procedure applies to ${node.id}?`,
    options:[{id:'pinned-node',label:'Follow the pinned node'}],outcome:'pinned-node',reason:'The Graph defines this fixture step.',
    ruleRef:`node:${node.id}`,behaviorImpact:'none',
    evidence:[{kind:'requirement',summary:'Versioned fixture requirement',sourceRef:{kind:'run_input',key:'versioned_requirement'}}]
  }) : null;
  await api.submitNode({runId:run.id,nodeId:node.id,actor:worker,artifacts,payloads,output:{result:node.id},decisionIds:workDecision?[workDecision.id]:[]});
  if(node.review) {
    await engine.recordSelfReview({runId:run.id,nodeId:node.id,actor:worker,artifactVersion:'1',findings:[]});
    const rule=pack.decisionRules.find(item=>item.type===node.review.decisionType&&item.mode==='autonomous');
    await engine.reviewWork({runId:run.id,nodeId:node.id,
      actor:{id:`reviewer-${node.id}`,kind:'agent',roles:[node.review.supervisorRole],executionId:`review-${node.id}`},
      outcome:'accept',reason:'Independent review accepted the fixture artifact.',
      evidence:rule.requiredEvidence.map(kind=>({kind,subjectRefs:artifacts.map(item=>({artifactId:item.id,version:item.version}))}))});
  }
}

async function startMethodRun(engine,api,graphId,input) {
  const starter={id:'owner',kind:'human',roles:['human-owner'],executionId:'owner-start'};
  const feature=`host-${graphId}-${++methodRunNumber}`;
  const baseline=await engine.recordProductDecision({feature,actor:starter,status:'approved',outcome:'Fixture baseline',reason:'Start product-method fixture',evidence:[{kind:'requirement',id:'REQ-1'}]});
  return api.startRun({packId:pack.id,packVersion:pack.version,graphId,mode:'autonomous',actor:starter,
    input:{feature,versioned_requirement:{id:'REQ-1',version:'1'},product_decision_refs:[baseline.id],...input}});
}

test('trusted ADLC wrapper rejects an invalid product-method payload before an actual Core run changes',async()=>{
  const engine=new GraphEngine({availableCapabilities:{'company-control':'1.0.0','cross-pack-plans':'1.0.0','cross-pack-handoff':'1.0.0'}});
  await engine.registerPack(pack);
  const api=createAdlcHostApi({engine,resolveActor:actor,runValidationDigest});
  const run=await api.startRun({packId:pack.id,packVersion:pack.version,graphId:'request-triage',mode:'manual',actor:{id:'owner',kind:'human',roles:['human-owner'],executionId:'owner-ui'},input:{source_request:{id:'issue-1',version:'1'}}});
  const invalid={id:'brief',version:'1',literalAsk:'Ship it'};
  await assert.rejects(api.submitNode({runId:run.id,nodeId:'assess-request',actor:{id:'po',kind:'agent',roles:['product-owner'],executionId:'po-1'},artifacts:[{id:'triage',version:'1',kind:'triage_report'},{id:'brief',version:'1',kind:'request_brief'}],payloads:{request_brief:invalid}}),/sourceRef is required/);
  assert.equal((await engine.getRun(run.id)).nodeStates['assess-request'].status,'pending');
});

test('trusted ADLC wrapper exposes the declared investment-case contract without inventing a graph route',()=>{
  const api=createAdlcHostApi({engine:{},resolveActor:actor,runValidationDigest});
  assert.throws(()=>api.validateArtifact('investment_case',{id:'case',version:'1'}),/opportunity is required/);
  assert.throws(()=>api.validateArtifact('unknown_method',{}),/No ADLC product-method validator/);
});

test('trusted ADLC wrapper rejects an invalid experiment route before Core changes, then completes its valid route',async()=>{
  const engine=new GraphEngine(); await engine.registerPack(pack);
  const api=createAdlcHostApi({engine,resolveActor:actor,runValidationDigest});
  async function readyForGate(record) {
    const run=await startMethodRun(engine,api,'product-experiment',{accepted_intent:{id:'intent',version:'1'}});
    const ledger={id:'ledger',version:'1',claims:[]};
    for(;;) {
      const ready=await engine.getReadyNodes(run.id); const node=ready[0];
      if(node.type==='decision') return run;
      await finishTask({engine,api,run,node,payloads:node.id==='assess-probe'?{experiment_record:record,evidence_ledger:ledger}:{}});
    }
  }
  const technical={id:'technical-experiment',version:'1',hypothesis:'Operators will use the shortcut',targetUser:'Operators',riskyAssumption:'The shortcut is discoverable',probe:'Technical proof of concept',supportCriterion:'The probe works',refuteCriterion:'The probe fails',evidenceType:'technical-feasibility',decisionOwner:'cpo',state:'supported',executedAt:'2026-11-02T00:00:00Z',observationRef:'observation-1',observedResult:'The proof of concept works',recommendedNext:'build'};
  const invalidRun=await readyForGate(technical);
  const invalidEvidence=[{kind:'experiment_record',subjectRefs:[{artifactId:technical.id,version:technical.version}]},{kind:'evidence_ledger',subjectRefs:[{artifactId:technical.id,version:technical.version}]}];
  await assert.rejects(api.decideNode({runId:invalidRun.id,nodeId:'experiment-gate',actor:owner({role:'cpo'}),outcome:'build',reason:'Technical feasibility is not user-value evidence',evidence:invalidEvidence}),/supported user-value evidence/);
  assert.equal((await engine.getRun(invalidRun.id)).nodeStates['experiment-gate'].status,'pending');
  const record={id:'experiment',version:'1',hypothesis:'Operators will use the shortcut',targetUser:'Operators',riskyAssumption:'The shortcut is discoverable',probe:'Observed usability session',supportCriterion:'Most participants complete the task',refuteCriterion:'Participants cannot find the shortcut',evidenceType:'direct-user',decisionOwner:'cpo',state:'supported',executedAt:'2026-11-02T00:00:00Z',observationRef:'observation-1',observedResult:'Participants completed the task',recommendedNext:'build'};
  const run=await readyForGate(record);
  const ledger={id:'ledger',version:'1',claims:[]};
  await api.decideNode({runId:run.id,nodeId:'experiment-gate',actor:owner({role:'cpo'}),outcome:'build',reason:'Validated direct-user evidence supports the route',productDecisionRefs:run.input.product_decision_refs,evidence:[{kind:'experiment_record',subjectRefs:[{artifactId:record.id,version:record.version}]},{kind:'evidence_ledger',subjectRefs:[{artifactId:record.id,version:record.version}]}]});
  const end=(await engine.getReadyNodes(run.id))[0]; await api.submitNode({runId:run.id,nodeId:end.id,actor:owner({role:'cpo'})});
  assert.equal((await engine.getRun(run.id)).nodeStates['experiment-build'].status,'completed');
});

test('trusted ADLC wrapper rejects a mismatched competitive-watch route before Core changes, then completes its valid route',async()=>{
  const engine=new GraphEngine(); await engine.registerPack(pack);
  const api=createAdlcHostApi({engine,resolveActor:actor,runValidationDigest});
  const run=await startMethodRun(engine,api,'competitive-watch',{previous_snapshot:{id:'previous',version:'1'},watch_question:'What changed?'});
  const diff={id:'diff',version:'1',previousSnapshot:{id:'previous',version:'1'},currentSnapshot:{id:'current',version:'1'},changes:[],materialChange:false};
  for(;;) {
    const ready=await engine.getReadyNodes(run.id); const node=ready[0];
    if(node.type==='decision') break;
    await finishTask({engine,api,run,node,payloads:node.id==='compare-snapshots'?{competitive_diff:diff}:{}});
  }
  await assert.rejects(api.decideNode({runId:run.id,nodeId:'watch-route',actor:owner({role:'product-manager'}),outcome:'review-required',reason:'Does not match the validated diff',evidence:[{kind:'competitive_diff'}]}),/must match/);
  assert.equal((await engine.getRun(run.id)).nodeStates['watch-route'].status,'pending');
  await api.decideNode({runId:run.id,nodeId:'watch-route',actor:owner({role:'product-manager'}),outcome:'no-material-change',reason:'Validated diff has no material change',productDecisionRefs:run.input.product_decision_refs,evidence:[{kind:'competitive_diff',subjectRefs:[{artifactId:diff.id,version:diff.version}]}]});
  const end=(await engine.getReadyNodes(run.id))[0]; await api.submitNode({runId:run.id,nodeId:end.id,actor:owner({role:'product-manager'})});
  assert.equal((await engine.getRun(run.id)).nodeStates['watch-unchanged'].status,'completed');
});


test('native human gate uses the ADLC route validator and accepts null execution IDs',async()=>{
  const engine=new GraphEngine(); await engine.registerPack(pack);
  const resolveNativeActor=({claimedActor})=>claimedActor?.kind==='human'
    ?{id:'owner',kind:'human',roles:['human-owner','cpo'],executionId:null}
    :actor({claimedActor});
  const api=createAdlcHostApi({engine,resolveActor:resolveNativeActor,runValidationDigest});
  const technical={id:'technical',version:'1',hypothesis:'Users will benefit',targetUser:'Operators',riskyAssumption:'The feature is discoverable',probe:'Technical proof of concept',supportCriterion:'The probe works',refuteCriterion:'The probe fails',evidenceType:'technical-feasibility',decisionOwner:'cpo',state:'supported',executedAt:'2026-11-02T00:00:00Z',observationRef:'observation-1',observedResult:'The proof works',recommendedNext:'build'};
  const run=await startMethodRun(engine,api,'product-experiment',{accepted_intent:{id:'intent',version:'1'}});
  const ledger={id:'ledger',version:'1',claims:[]};
  for(;;) {
    const node=(await engine.getReadyNodes(run.id))[0];
    if(node.type==='decision') break;
    await finishTask({engine,api,run,node,payloads:node.id==='assess-probe'?{experiment_record:technical,evidence_ledger:ledger}:{}});
  }
  await api.decideNode({runId:run.id,nodeId:'experiment-gate',actor:owner({role:'cpo'}),outcome:'human',reason:'Native human review'});
  await assert.rejects(api.resolveHumanGate({runId:run.id,nodeId:'experiment-gate',actor:owner({role:'cpo'}),outcome:'build',reason:'Technical evidence is not user evidence',evidence:[{kind:'experiment_record',subjectRefs:[{artifactId:technical.id,version:technical.version}]}]}),/supported user-value evidence/);
  assert.equal((await engine.getRun(run.id)).status,'paused');
});

test('ADLC self review atomically validates and stores revised product-method payload',async()=>{
  const engine=new GraphEngine(); await engine.registerPack(pack);
  const api=createAdlcHostApi({engine,resolveActor:actor,runValidationDigest});
  const run=await startMethodRun(engine,api,'product-experiment',{accepted_intent:{id:'intent',version:'1'}});
  let node;
  while((node=(await engine.getReadyNodes(run.id))[0]).id!=='assess-probe') await finishTask({engine,api,run,node});
  const record={id:'experiment',version:'1',hypothesis:'Operators will use the shortcut',targetUser:'Operators',riskyAssumption:'The shortcut is discoverable',probe:'Technical proof of concept',supportCriterion:'The probe works',refuteCriterion:'The probe fails',evidenceType:'technical-feasibility',decisionOwner:'cpo',state:'supported',executedAt:'2026-11-02T00:00:00Z',observationRef:'observation-1',observedResult:'The proof of concept works',recommendedNext:'build'};
  const ledger={id:'ledger',version:'1',claims:[]}, worker=taskActor(node);
  const artifacts=[{id:record.id,version:record.version,kind:'experiment_record'},{id:ledger.id,version:ledger.version,kind:'evidence_ledger'}];
  const workDecision=await engine.recordWorkDecision({runId:run.id,nodeId:node.id,actor:worker,category:'process',
    question:`Which procedure applies to ${node.id}?`,options:[{id:'pinned-node',label:'Follow the pinned node'}],
    outcome:'pinned-node',reason:'The Graph defines this fixture step.',ruleRef:`node:${node.id}`,behaviorImpact:'none',
    evidence:[{kind:'requirement',summary:'Versioned fixture requirement',sourceRef:{kind:'run_input',key:'versioned_requirement'}}]});
  await api.submitNode({runId:run.id,nodeId:node.id,actor:worker,artifacts,payloads:{experiment_record:record,evidence_ledger:ledger},decisionIds:[workDecision.id]});
  await api.recordSelfReview({runId:run.id,nodeId:node.id,actor:worker,artifactVersion:'1',findings:[{severity:'P1',status:'open'}]});
  const revised={...record,version:'2',evidenceType:'direct-user',observationRef:'user-session-1',observedResult:'Participants completed the task'};
  await assert.rejects(api.recordSelfReview({runId:run.id,nodeId:node.id,actor:worker,artifactVersion:'2',findings:[],revisedArtifact:{kind:'experiment_record',id:'experiment',version:'2'},revisedPayload:{...revised,version:'3'}}),/identity differs/);
  await assert.rejects(api.recordSelfReview({runId:run.id,nodeId:node.id,actor:worker,artifactVersion:'2',findings:[],revisedArtifact:{kind:'experiment_record',id:'invented',version:'2'},revisedPayload:{...revised,id:'invented'}}),/preserve current identity/);
  await assert.rejects(api.recordSelfReview({runId:run.id,nodeId:node.id,actor:worker,artifactVersion:'2',findings:[],revisedArtifact:{kind:'experiment_record',id:'experiment',version:'2'},revisedPayload:revised,revisedOutput:{adlcProductMethods:{experiment_record:{...revised,evidenceType:'technical-feasibility'}}}}),/revisedOutput is host-owned/);
  await api.recordSelfReview({runId:run.id,nodeId:node.id,actor:worker,artifactVersion:'2',findings:[],revisedArtifact:{kind:'experiment_record',id:'experiment',version:'2'},revisedPayload:revised});
  const updated=await engine.getRun(run.id), attempt=updated.nodeStates['assess-probe'].attempts.at(-1);
  assert.equal(attempt.output.adlcProductMethods.experiment_record.version,'2');
  assert.equal(updated.nodeStates['assess-probe'].artifacts.find(item=>item.kind==='experiment_record').version,'2');
});

test('ADLC recovery validation checks current payloads and route decisions without requiring absent outputs',async()=>{
  const engine=new GraphEngine(); await engine.registerPack(pack);
  const api=createAdlcHostApi({engine,resolveActor:actor,runValidationDigest});
  const record={id:'recovery-experiment',version:'1',hypothesis:'Operators will use the shortcut',targetUser:'Operators',riskyAssumption:'The shortcut is discoverable',probe:'Observed usability session',supportCriterion:'Most participants complete the task',refuteCriterion:'Participants cannot find the shortcut',evidenceType:'direct-user',decisionOwner:'cpo',state:'supported',executedAt:'2026-11-02T00:00:00Z',observationRef:'observation-1',observedResult:'Participants completed the task',recommendedNext:'build'};
  const ledger={id:'recovery-ledger',version:'1',claims:[]};
  const run=await startMethodRun(engine,api,'product-experiment',{accepted_intent:{id:'intent',version:'1'}});
  for(;;) {
    const node=(await engine.getReadyNodes(run.id))[0];
    if(node.type==='decision') break;
    await finishTask({engine,api,run,node,payloads:node.id==='assess-probe'?{experiment_record:record,evidence_ledger:ledger}:{}});
  }
  const beforeDecision=await engine.getRun(run.id);
  assert.deepEqual((await api.validateRun({run:beforeDecision,decisions:await engine.listDecisions({runId:run.id})})).issues,[]);
  await api.decideNode({runId:run.id,nodeId:'experiment-gate',actor:owner({role:'cpo'}),outcome:'build',reason:'Validated user evidence',productDecisionRefs:run.input.product_decision_refs,
    evidence:['experiment_record','evidence_ledger'].map(kind=>({kind,subjectRefs:[{artifactId:record.id,version:'1'},{artifactId:ledger.id,version:'1'}]}))});
  const snapshot=await engine.getRun(run.id), decisions=await engine.listDecisions({runId:run.id});
  assert.equal((await api.validateRun({run:snapshot,decisions})).valid,true);
  const badPayload=structuredClone(snapshot);
  badPayload.nodeStates['assess-probe'].attempts.at(-1).output.adlcProductMethods.experiment_record.state='invalid-state';
  badPayload.nodeStates['assess-probe'].output.adlcProductMethods.experiment_record.state='invalid-state';
  assert.ok((await api.validateRun({run:badPayload,decisions})).issues.some(item=>item.code==='artifact-schema-invalid'));
  const mismatched=structuredClone(snapshot);
  mismatched.nodeStates['assess-probe'].output.adlcProductMethods.experiment_record.state='invalid-state';
  assert.ok((await api.validateRun({run:mismatched,decisions})).issues.some(item=>item.code==='current-artifact-mismatch'));
  const missingAttempt=structuredClone(snapshot); missingAttempt.nodeStates['assess-probe'].attempts=[];
  assert.ok((await api.validateRun({run:missingAttempt,decisions})).issues.some(item=>item.code==='current-artifact-mismatch'));
  const wrongDecisionRun=decisions.map(item=>item.id===snapshot.nodeStates['experiment-gate'].attempts.at(-1).decisionId?{...item,runId:'other-run'}:item);
  assert.ok((await api.validateRun({run:snapshot,decisions:wrongDecisionRun})).issues.some(item=>item.code==='decision-record-mismatch'));
  assert.deepEqual(await engine.getRun(run.id),snapshot,'validation must not mutate persisted run state');
  const pristine=await startMethodRun(engine,api,'product-experiment',{accepted_intent:{id:'intent',version:'1'}});
  const pristineResult=await api.validateRun({run:await engine.getRun(pristine.id),decisions:[]});
  assert.equal(pristineResult.valid,true);
  assert.deepEqual(pristineResult.issues,[]);
});
