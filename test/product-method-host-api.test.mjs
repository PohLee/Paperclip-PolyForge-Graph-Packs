import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { pack, createAdlcHostApi } from '../packs/adlc/index.mjs';

const coreArtifact=process.env.PINNED_CORE_ARTIFACT;
const coreUrl=coreArtifact ? pathToFileURL(resolve(coreArtifact,'src/core/index.mjs')).href : new URL('../../Paperclip-PolyForge-Graph/src/core/index.mjs',import.meta.url).href;
const { GraphEngine }=await import(coreUrl);
const actor=({claimedActor})=>({id:claimedActor?.id??'host-owner',kind:claimedActor?.kind??'human',roles:claimedActor?.roles??['human-owner'],executionId:claimedActor?.executionId??'host-execution'});

test('trusted ADLC wrapper rejects an invalid product-method payload before an actual Core run changes',async()=>{
  const engine=new GraphEngine({availableCapabilities:{'company-control':'1.0.0','cross-pack-plans':'1.0.0','cross-pack-handoff':'1.0.0'}});
  await engine.registerPack(pack);
  const api=createAdlcHostApi({engine,resolveActor:actor});
  const run=await api.startRun({packId:pack.id,packVersion:pack.version,graphId:'request-triage',mode:'manual',actor:{id:'owner',kind:'human',roles:['human-owner'],executionId:'owner-ui'},input:{source_request:{id:'issue-1',version:'1'}}});
  const invalid={id:'brief',version:'1',literalAsk:'Ship it'};
  await assert.rejects(api.submitNode({runId:run.id,nodeId:'assess-request',actor:{id:'po',kind:'agent',roles:['product-owner'],executionId:'po-1'},artifacts:[{id:'triage',version:'1',kind:'triage_report'},{id:'brief',version:'1',kind:'request_brief'}],payloads:{request_brief:invalid}}),/sourceRef is required/);
  assert.equal((await engine.getRun(run.id)).nodeStates['assess-request'].status,'pending');
});

test('trusted ADLC wrapper exposes the declared investment-case contract without inventing a graph route',()=>{
  const api=createAdlcHostApi({engine:{},resolveActor:actor});
  assert.throws(()=>api.validateArtifact('investment_case',{id:'case',version:'1'}),/opportunity is required/);
  assert.throws(()=>api.validateArtifact('unknown_method',{}),/No ADLC product-method validator/);
});
