import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const coreArtifact = process.env.PINNED_CORE_ARTIFACT;
const coreUrl = coreArtifact ? pathToFileURL(resolve(coreArtifact,'src/core/index.mjs')).href : new URL('../../Paperclip-PolyForge-Graph/src/core/index.mjs',import.meta.url).href;
const { GraphEngine, CORE_RUNTIME } = await import(coreUrl);
import defaultPack, { pack, packs, packCatalog, adlcPack, marketingPack, creativeTeamPack } from '../index.mjs';

test('collection exports independent Pack releases and keeps ADLC default', async () => {
  assert.equal(pack, defaultPack);
  assert.equal(pack, adlcPack);
  assert.deepEqual(Object.keys(packCatalog), ['adlc','marketing','creative-team']);
  assert.equal(packCatalog['creative-team'], creativeTeamPack);
  assert.deepEqual(packs.map(item => `${item.id}@${item.version}`), ['adlc@0.3.2','marketing@0.0.4','creative-team@0.3.2']);
  const engine = new GraphEngine();
  for (const item of packs) {
    assert.deepEqual(item.compatibility.contracts, CORE_RUNTIME.contracts);
    const { release, ...payload } = item;
    assert.equal(release.digest, `sha256:${createHash('sha256').update(JSON.stringify(payload)).digest('hex')}`);
    await engine.registerPack(item);
  }
  for (const item of [adlcPack, marketingPack]) {
    assert.equal(item.compatibility.coreRange, '>=0.8.5 <0.9.0');
    assert.equal(item.compatibility.optionalCapabilities['temporary-agent-snapshot'], '>=1.0.0 <2.0.0');
    assert.match(item.skills['temporary-agent-snapshot'].content, /"operation": "open-temporary-agent"/);
    assert.match(item.skills['temporary-agent-snapshot'].content, /"mode": "snapshot"/);
    for (const role of Object.values(item.roles)) {
      assert.ok(role.skills.includes('temporary-agent-snapshot'));
      assert.match(`${role.documents.role}\n${role.documents.instruction}`, /bundled `temporary-agent-snapshot` skill/);
    }
  }
});

test('legacy shadow declaration requires a fresh Sub-Agent review for ADLC verification QA', () => {
  const verification = adlcPack.graphs.find(graph => graph.id === 'verification');
  assert.equal(verification.version, '0.1.6');
  assert.deepEqual(verification.compatibility.requiredCapabilities,
    { 'shadow-review-execution': '>=1.0.0 <2.0.0' });
  assert.deepEqual(verification.nodes.find(node => node.id === 'qa').shadow,
    { trigger:'before-dispatch', reviewer:'same-agent', required:true });
  assert.ok(verification.nodes.filter(node => node.shadow).every(node => node.id === 'qa'));
  assert.ok(adlcPack.graphs.filter(graph => graph.id !== 'verification')
    .every(graph => !graph.compatibility?.requiredCapabilities?.['shadow-review-execution'] &&
      graph.nodes.every(node => !node.shadow)));
  assert.ok(marketingPack.graphs.every(graph => !graph.compatibility?.requiredCapabilities?.['shadow-review-execution'] &&
    graph.nodes.every(node => !node.shadow)));
  assert.equal(adlcPack.policies.shadowVerification.action, 'review');
  assert.equal(adlcPack.policies.shadowVerification.maxTasks, 1);
  assert.equal(adlcPack.policies.shadowVerification.maxConcurrent, 1);
  assert.equal(adlcPack.policies.shadowVerification.maxDurationSeconds, 900);
});

test('Pack roles reference one company CEO and every Graph role has a document', () => {
  assert.equal(adlcPack.roles.cpo.reportsToRole,'ceo');
  assert.equal(adlcPack.roles['cto-caio'].reportsToRole,'ceo');
  assert.equal(marketingPack.roles.cmo.reportsToRole,'ceo');
  assert.ok(!adlcPack.roles.ceo && !marketingPack.roles.ceo);
  for (const item of packs) {
    for (const graph of item.graphs) for (const node of graph.nodes) {
      if (node.role) assert.ok(item.roles[node.role], `${item.id}/${graph.id}/${node.id}`);
      if (node.review && item !== creativeTeamPack) {
        assert.equal(node.review.maxSelfReviews,5);
        assert.notEqual(node.role,node.review.supervisorRole);
      }
    }
    for (const role of Object.values(item.roles)) {
      for (const name of ['soul','role','goal','instruction','decision_model']) assert.ok(role.documents[name]?.length > 30);
      if (item !== creativeTeamPack) {
        assert.match(role.documents.instruction,/outside this role.*CEO/s);
        assert.match(role.documents.instruction,/NEW tasks/);
      }
    }
  }
});

test('Marketing handoff and measurement boundaries are explicit', () => {
  const source = adlcPack.handoffContracts.find(item => item.contract === 'adlc.release-to-marketing');
  const target = marketingPack.incomingHandoffs.find(item => item.contract === source.contract);
  assert.equal(source.version,1);
  assert.equal(source.sourceGraphId,'release-observation');
  assert.equal(source.requiredStatus,'release_recorded');
  assert.equal(source.eventArtifactKind,'release_execution_record');
  assert.equal(source.evidenceReceiptKind,'release');
  assert.equal(target.targetGraphId,source.targetGraphId);
  assert.equal(target.evidenceReceiptKind,'release');
  const plan = marketingPack.graphs.find(item => item.id === 'acquisition-plan');
  const review = marketingPack.graphs.find(item => item.id === 'outcome-review');
  assert.equal(plan.handoffContract.version,source.version);
  assert.equal(plan.handoffContract.evidenceReceiptKind,'release');
  assert.ok(plan.requiredRunInputs.includes('handoffId'));
  assert.ok(plan.nodes.some(node => node.id === 'pin-release-handoff' && node.requiredInputs.includes('release_handoff')));
  assert.ok(review.nodes.some(node => node.id === 'outcome-unknown' && node.output === 'measurement_unknown'));
  assert.equal(marketingPack.policies.metrics.missingOrStale,'unknown');
  assert.equal(marketingPack.policies.execution.handoffIsLaunch,false);
});

test('Marketing outcome review records unknown when metric capability is absent', async () => {
  const engine = new GraphEngine();
  await engine.registerPack(marketingPack);
  const owner = { kind:'human', id:'owner', roles:['human-owner','cmo'] };
  const analyst = { kind:'agent', id:'analyst', roles:['marketing-analyst'], executionId:'analyst-execution' };
  const run = await engine.startRun({ packId:'marketing',packVersion:marketingPack.version,graphId:'outcome-review',actor:owner,mode:'manual',
    input:{projectId:'project-1',acquisition_plan_identity:{id:'plan-1',version:'v1'},observation_window:{start:'2026-10-28T00:00:00Z',end:'2026-10-29T00:00:00Z'}} });
  for (const [id,kind] of [['pin-measurement','measurement_record'],['assess-outcome','outcome_assessment']]) {
    const trace = await engine.recordWorkDecision({runId:run.id,nodeId:id,actor:analyst,category:'process',question:'Which measurement source is available?',
      options:[{id:'unknown',label:'Record missing source'}],outcome:'unknown',reason:'No authenticated metric source was supplied',ruleRef:`node:${id}`,
      evidence:[{kind:'plan',summary:'Pinned acquisition plan',sourceRef:{kind:'run_input',key:'acquisition_plan_identity'}}]});
    const artifact = {kind,id:`${kind}-1`,version:'v1',digest:`sha256:${'b'.repeat(64)}`};
    await engine.submitNode({runId:run.id,nodeId:id,actor:analyst,artifacts:[artifact],decisionIds:[trace.id],output:{sourceStatus:'unknown'}});
    await engine.recordSelfReview({runId:run.id,nodeId:id,actor:analyst,artifactVersion:'v1',findings:[]});
    await engine.reviewWork({runId:run.id,nodeId:id,actor:owner,outcome:'accept',reason:'Unknown is stated explicitly',
      evidence:['artifact_version','review_findings','self_review_history'].map(kind => ({kind,subjectRefs:[{artifactId:artifact.id,version:'v1'}]}))});
  }
  const evidence = ['measurement_record','outcome_assessment','metric_source_status'].map(kind =>
    ({kind,subjectRefs:[{artifactId:'outcome_assessment-1',version:'v1'}]}));
  await assert.rejects(engine.decideNode({runId:run.id,nodeId:'outcome-disposition',actor:owner,outcome:'continue',reason:'Unsupported measured claim',evidence}),/sourced-metrics/);
  await engine.decideNode({runId:run.id,nodeId:'outcome-disposition',actor:owner,outcome:'unknown',reason:'Metrics lack an authenticated source',evidence});
  await engine.submitNode({runId:run.id,nodeId:'outcome-unknown',actor:{kind:'system',id:'runner',roles:[]}});
  assert.equal((await engine.getRun(run.id)).nodeStates['outcome-unknown'].status,'completed');
});
