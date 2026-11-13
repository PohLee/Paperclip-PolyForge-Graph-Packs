import test from 'node:test';
import assert from 'node:assert/strict';
import { createCreativeHostApi } from '../runtime/host-api.mjs';

test('self-review validates revised artifact references before recording',async()=>{
  const actor={id:'worker',kind:'agent',roles:['brand-strategist'],executionId:'execution'};
  const artifact={id:'map',version:'1',kind:'brand_architecture_map'};
  const run={id:'run',packId:'creative-team',input:{},graph:{id:'brand-architecture-naming',nodes:[{id:'work',type:'task'}]},nodeStates:{work:{artifacts:[artifact],attempts:[{actor,artifacts:[artifact],output:{creativeArtifacts:{}}}]}}};
  let recorded=false;
  const api=createCreativeHostApi({engine:{getRun:async()=>run,recordSelfReview:async()=>{recorded=true}},runValidationDigest:()=> 'digest',resolveActor:({claimedActor})=>claimedActor});
  await assert.rejects(api.recordSelfReview({runId:'run',nodeId:'work',actor,revisedArtifact:{...artifact,version:'2'},revisedPayload:{id:'map',version:'2',contextRef:{id:'missing',version:'1'},model:'model',relationships:['parent'],tradeoffs:[]}}),/Trusted artifact loader/);
  assert.equal(recorded,false);
});

test('self-review rejects a published artifact with a mismatched decision',async()=>{
  const actor={id:'worker',kind:'agent',roles:['brand-strategist'],executionId:'execution'};
  const artifact={id:'baseline',version:'1',kind:'brand_baseline'};
  const references=[['strategy','brand_strategy'],['identity','brand_identity_system'],['voice','brand_voice_system']];
  const nodes=references.map(([id])=>({id,type:'task'}));
  const nodeStates=Object.fromEntries(references.map(([id,kind])=>[id,{attempts:[{artifacts:[{id,version:'1',kind}],output:{creativeArtifacts:{[kind]:{id,version:'1'}}}}]}]));
  const run={id:'run',packId:'creative-team',input:{},graph:{id:'brand-foundation',nodes:[...nodes,{id:'work',type:'task'}]},nodeStates:{...nodeStates,work:{artifacts:[artifact],attempts:[{actor,artifacts:[artifact],output:{creativeArtifacts:{}}}]}}};
  const api=createCreativeHostApi({engine:{getRun:async()=>run,listDecisions:async()=>[{nodeId:'brand-disposition',status:'decided',outcome:'ready',id:'accepted',at:'1'}]},runValidationDigest:()=> 'digest',resolveActor:({claimedActor})=>claimedActor});
  const revisedPayload={id:'baseline',version:'2',strategyRef:{id:'strategy',version:'1'},identityRef:{id:'identity',version:'1'},voiceRef:{id:'voice',version:'1'},decisionRef:{id:'forged',version:'1'}};
  await assert.rejects(api.recordSelfReview({runId:'run',nodeId:'work',actor,revisedArtifact:{...artifact,version:'2'},revisedPayload}),/exact accepted decision/);
});

test('self-review rejects a forged independent reviewer execution',async()=>{
  const actor={id:'reviewer',kind:'agent',roles:['design-qa-accessibility'],executionId:'trusted'};
  const artifact={id:'review',version:'1',kind:'direction_norms_review'};
  const node={id:'review',type:'task',independentOf:['author']};
  const run={id:'run',packId:'creative-team',input:{},graph:{id:'test',nodes:[node,{id:'author',type:'task'}]},nodeStates:{author:{attempts:[{actor:{executionId:'author'}}]},review:{artifacts:[artifact],attempts:[{actor,artifacts:[artifact],output:{creativeArtifacts:{}}}]}}};
  const api=createCreativeHostApi({engine:{getRun:async()=>run},runValidationDigest:()=> 'digest',resolveActor:({claimedActor})=>claimedActor});
  const revisedPayload={id:'review',version:'2',directionRefs:[{id:'direction',version:'1'}],criteria:['quality'],disposition:'accepted',findings:[],reviewerExecutionId:'forged',subjectAuthorExecutionIds:['forged']};
  await assert.rejects(api.recordSelfReview({runId:'run',nodeId:'review',actor,revisedArtifact:{...artifact,version:'2'},revisedPayload}),/Reviewer identity must come from the trusted/);
});
