import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { GraphEngine } from './core-import.mjs';
import { pack, createCreativeHostApi } from '../index.mjs';

const stableJson=value=>JSON.stringify(value,(key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(name=>[name,item[name]])):item);
const sha=value=>createHash('sha256').update(stableJson(value)).digest('hex');
const ref=(id,version='1',kind)=>({id,version,...(kind?{kind}:{})});
const capabilities={'design-rendering':'1.0.0','prototype-build':'1.0.0','user-research':'1.0.0'};
const actor=role=>({id:role,kind:'agent',roles:[role],executionId:`exec-${role}`});
const owner=role=>({id:`owner-${role}`,kind:'human',roles:['human-owner',role],executionId:`owner-${role}`});
const brief={id:'brief',version:'1',objective:'Test a bounded interface change',audience:'Operators',surfaceMode:'operate'};

function external(kind,payload) { return {id:payload.id,version:payload.version,kind,payload,digest:sha(payload)}; }
async function fixture(externals=[]) {
  const rows=new Map(externals.map(row=>[`${row.kind}:${row.id}@${row.version}`,row]));
  const engine=new GraphEngine({availableCapabilities:capabilities}); await engine.registerPack(pack);
  const api=createCreativeHostApi({engine,resolveActor:({claimedActor})=>claimedActor,
    loadExternalArtifact:async({ref,kind})=>rows.get(`${kind}:${ref.id}@${ref.version}`),
    resolveDecisionEvidence:async({run,requiredKinds})=>{
      const row=run.graph.nodes.flatMap(node=>(run.nodeStates[node.id]?.attempts??[]).flatMap(attempt=>(attempt.artifacts??[]).map(item=>({item,attempt})))).at(-1);
      if(!row) return [];
      return requiredKinds.map(kind=>({kind,payload:{kind},sourceRef:{id:row.item.id,version:row.item.version,kind:row.item.kind}}));
    }});
  return {engine,api,rows};
}
async function submit(api,run,node,payload) {
  const kind=node.produces[0];
  return api.submitNode({runId:run.id,nodeId:node.id,actor:actor(node.role),artifacts:[{id:payload.id,version:payload.version,kind}],payloads:{[kind]:payload}});
}
async function complete(run,engine,api,payloadFor,outcomeFor) {
  for(let turn=0;turn<80;turn++) {
    const state=await engine.getRun(run.id); if(state.status!=='running') return state;
    const ready=await engine.getReadyNodes(run.id); assert.ok(ready.length,`no ready node at ${turn}`);
    for(const node of ready) {
      if(node.type==='task') await submit(api,run,node,await payloadFor(node,await engine.getRun(run.id)));
      else if(node.type==='decision') await api.decideNode({runId:run.id,nodeId:node.id,actor:owner(node.role),outcome:outcomeFor(node),reason:'Pinned test evidence supports this route.'});
      else await api.submitNode({runId:run.id,nodeId:node.id,actor:owner('human-owner')});
    }
  }
  throw new Error('workflow did not terminate');
}

test('G09 completes through the wrapper and rejects a stale evaluation lineage',async()=>{
  const {engine,api}=await fixture();
  const run=await api.startRun({packId:pack.id,packVersion:pack.version,graphId:'minor-ui-change',mode:'manual',actor:owner('design-director'),input:{creative_brief:brief,designBaselineRef:ref('baseline'),requirementsRef:ref('requirements')}});
  const payloadFor=async(node,state)=>{
    const decision=(await engine.listDecisions({runId:run.id})).find(item=>item.nodeId==='minor-disposition');
    const rows={
      'pin-current-design':{id:'context',version:'1',briefRef:brief,designBaselineRef:ref('baseline'),requirementsRef:ref('requirements')},
      'make-minor-change':{id:'candidate',version:'1',contextRef:ref('context'),states:['loaded','empty'],source:'accepted baseline'},
      'independent-evaluation':{id:'evaluation',version:'1',candidateRef:ref('candidate'),contextRef:ref('context'),reviewerExecutionId:'exec-design-qa-accessibility',disposition:'complete',findings:[]},
      'publish-minor-change':{id:'package',version:'1',candidateRef:ref('candidate'),evaluationRef:ref('evaluation'),decisionRef:ref(decision?.id,decision?.at),changes:[{id:'one'}]},
    }; return rows[node.id];
  };
  const state=await complete(run,engine,api,payloadFor,node=>node.id==='minor-disposition'?'accepted':'');
  assert.equal(state.status,'completed');
  const bad=await api.startRun({packId:pack.id,packVersion:pack.version,graphId:'minor-ui-change',mode:'manual',actor:owner('design-director'),input:{creative_brief:brief,designBaselineRef:ref('baseline'),requirementsRef:ref('requirements')}});
  const node=(await engine.getReadyNodes(bad.id))[0];
  await assert.rejects(submit(api,bad,node,{id:'context',version:'1',briefRef:brief,designBaselineRef:ref('wrong'),requirementsRef:ref('requirements')}),/exact baseline/);
  assert.equal((await engine.getRun(bad.id)).nodeStates['pin-current-design'].status,'pending');
  const stale=await api.startRun({packId:pack.id,packVersion:pack.version,graphId:'minor-ui-change',mode:'manual',actor:owner('design-director'),input:{creative_brief:brief,designBaselineRef:ref('baseline'),requirementsRef:ref('requirements')}});
  for(const expected of ['pin-current-design','make-minor-change','independent-evaluation']) {
    const next=(await engine.getReadyNodes(stale.id)).find(node=>node.id===expected); await submit(api,stale,next,await payloadFor(next));
  }
  await api.decideNode({runId:stale.id,nodeId:'minor-disposition',actor:owner('design-director'),outcome:'accepted',reason:'The current evaluation is complete.'});
  const publish=(await engine.getReadyNodes(stale.id))[0],decision=(await engine.listDecisions({runId:stale.id})).find(item=>item.nodeId==='minor-disposition');
  await assert.rejects(submit(api,stale,publish,{id:'package',version:'1',candidateRef:ref('candidate'),evaluationRef:ref('old-evaluation'),decisionRef:ref(decision.id,decision.at),changes:[{id:'one'}]}),/exact minor_ui_evaluation artifact version/);
  assert.equal((await engine.getRun(stale.id)).nodeStates['publish-minor-change'].status,'pending');
});

test('G10 completes through the wrapper and rejects a stale research link',async()=>{
  const {engine,api}=await fixture();
  const run=await api.startRun({packId:pack.id,packVersion:pack.version,graphId:'product-design-discovery',mode:'manual',actor:owner('design-director'),input:{creative_brief:brief,requirementsRef:ref('requirements')}});
  const payloadFor=async(node)=>{
    const decision=(await engine.listDecisions({runId:run.id})).find(item=>item.nodeId==='promote-directions');
    const directions=[ref('wire-a'),ref('wire-b')],reviews=[ref('norms'),ref('fit'),ref('blind')];
    if(node.id==='research-user-needs') return {id:'research',version:'1',briefRef:brief,sources:['source'],needs:['need'],constraints:[],unknowns:[]};
    if(node.id==='wireframe-a'||node.id==='wireframe-b') return {id:node.id==='wireframe-a'?'wire-a':'wire-b',version:'1',researchRef:ref('research'),thesis:node.id,artifactRef:ref('research')};
    if(['design-norms-review','requirement-fit-review','blind-direction-evaluation'].includes(node.id)) return {id:node.id==='design-norms-review'?'norms':node.id==='requirement-fit-review'?'fit':'blind',version:'1',directionRefs:directions,criteria:['fit'],disposition:'complete',findings:[],reviewerExecutionId:`exec-${node.role}`,subjectAuthorExecutionIds:['exec-product-designer']};
    return {id:'direction',version:'1',researchRef:ref('research'),selectedDirectionRefs:directions,reviewRefs:reviews,decisionRef:ref(decision?.id,decision?.at)};
  };
  assert.equal((await complete(run,engine,api,payloadFor,node=>node.id==='promote-directions'?'both':'')).status,'completed');
  const bad=await api.startRun({packId:pack.id,packVersion:pack.version,graphId:'product-design-discovery',mode:'manual',actor:owner('design-director'),input:{creative_brief:brief,requirementsRef:ref('requirements')}});
  const research=(await engine.getReadyNodes(bad.id))[0]; await submit(api,bad,research,{id:'research',version:'1',briefRef:brief,sources:['source'],needs:['need'],constraints:[],unknowns:[]});
  const wire=(await engine.getReadyNodes(bad.id)).find(node=>node.id==='wireframe-a');
  await assert.rejects(submit(api,bad,wire,{id:'wire-a',version:'1',researchRef:ref('old'),thesis:'wrong',artifactRef:ref('research')}),/exact product_design_research artifact version/);
  const stale=await api.startRun({packId:pack.id,packVersion:pack.version,graphId:'product-design-discovery',mode:'manual',actor:owner('design-director'),input:{creative_brief:brief,requirementsRef:ref('requirements')}});
  const researchNode=(await engine.getReadyNodes(stale.id))[0]; await submit(api,stale,researchNode,await payloadFor(researchNode));
  for(const node of await engine.getReadyNodes(stale.id)) await submit(api,stale,node,await payloadFor(node));
  const wireJoin=(await engine.getReadyNodes(stale.id))[0]; await api.submitNode({runId:stale.id,nodeId:wireJoin.id,actor:owner('human-owner')});
  for(const node of await engine.getReadyNodes(stale.id)) await submit(api,stale,node,await payloadFor(node));
  const reviewJoin=(await engine.getReadyNodes(stale.id))[0]; await api.submitNode({runId:stale.id,nodeId:reviewJoin.id,actor:owner('human-owner')});
  await api.decideNode({runId:stale.id,nodeId:'promote-directions',actor:owner('design-director'),outcome:'both',reason:'All current reviews are complete.'});
  const freeze=(await engine.getReadyNodes(stale.id))[0];
  const decision=(await engine.listDecisions({runId:stale.id})).find(item=>item.nodeId==='promote-directions');
  await assert.rejects(submit(api,stale,freeze,{id:'direction',version:'1',researchRef:ref('research'),selectedDirectionRefs:[ref('wire-a'),ref('wire-b')],reviewRefs:[ref('norms'),ref('fit'),ref('old')],decisionRef:ref(decision.id,decision.at)}),/all three exact current direction review versions/);
  assert.equal((await engine.getRun(stale.id)).nodeStates['freeze-product-direction'].status,'pending');
});

test('G11 completes through the wrapper and rejects a stale frozen candidate reference',async()=>{
  const direction={id:'direction-input',version:'1',researchRef:ref('research'),selectedDirectionRefs:[ref('wire-a')],reviewRefs:[ref('review')],decisionRef:ref('decision')};
  const row=external('product_design_direction',direction),{engine,api}=await fixture([row]);
  const directionRef={id:row.id,version:row.version,kind:row.kind,digest:row.digest};
  const run=await api.startRun({packId:pack.id,packVersion:pack.version,graphId:'ui-candidate-sprint',mode:'manual',actor:owner('design-director'),input:{creative_brief:brief,productDesignDirectionRef:directionRef}});
  const payloadFor=async(node)=>{
    const suffix=node.id.slice(-2),decision=(await engine.listDecisions({runId:run.id})).find(item=>item.nodeId==='candidate-disposition');
    if(node.id==='pin-product-direction') return {id:'context',version:'1',briefRef:brief,productDirectionRef:directionRef};
    if(/^design-/.test(node.id)) return {id:`candidate-${suffix}`,version:'1',directionRef:ref('context'),thesis:suffix,surface:'screen',states:['loaded'],source:'direction'};
    if(/^freeze-[ab]\d$/.test(node.id)) return {id:`frozen-${suffix}`,version:'1',candidateRef:ref(`candidate-${suffix}`),digest:'a'.repeat(64)};
    if(/^qc-/.test(node.id)) return {id:`review-${suffix}`,version:'1',candidateRefs:[ref(`frozen-${suffix}`)],directionRef:ref('context'),reviewerExecutionId:'exec-design-qa-accessibility',subjectAuthorExecutionIds:['exec-product-designer'],disposition:'complete',findings:[]};
    if(node.id==='shortlist-ui-candidates') return {id:'shortlist',version:'1',candidateRefs:[ref('frozen-a1'),ref('frozen-a2')],reviewRefs:[ref('review-a1'),ref('review-a2')],criteria:['fit'],rejectionReasons:[]};
    return {id:'set',version:'1',directionRef:directionRef,candidateRefs:[ref('frozen-a1'),ref('frozen-a2')],reviewRef:ref('shortlist'),decisionRef:ref(decision?.id,decision?.at)};
  };
  assert.equal((await complete(run,engine,api,payloadFor,node=>node.id==='select-candidate-directions'?'both':node.id==='candidate-disposition'?'ready':'')).status,'completed');
  const bad=await api.startRun({packId:pack.id,packVersion:pack.version,graphId:'ui-candidate-sprint',mode:'manual',actor:owner('design-director'),input:{creative_brief:brief,productDesignDirectionRef:directionRef}});
  const context=(await engine.getReadyNodes(bad.id))[0]; await submit(api,bad,context,{id:'context',version:'1',briefRef:brief,productDirectionRef:directionRef});
  await api.decideNode({runId:bad.id,nodeId:'select-candidate-directions',actor:owner('design-director'),outcome:'a',reason:'test'});
  const design=(await engine.getReadyNodes(bad.id)).find(node=>node.id==='design-a1'); await submit(api,bad,design,{id:'candidate-a1',version:'1',directionRef:ref('context'),thesis:'a1',surface:'screen',states:['loaded'],source:'direction'});
  const freeze=(await engine.getReadyNodes(bad.id)).find(node=>node.id==='freeze-a1'); await assert.rejects(submit(api,bad,freeze,{id:'frozen-a1',version:'1',candidateRef:ref('old'),digest:'a'.repeat(64)}),/exact ui_candidate_a1 artifact version/);
});

test('G12 completes through the wrapper and rejects prototype routing without two distinct finalists',async()=>{
  const set={id:'set-input',version:'1',directionRef:ref('direction'),candidateRefs:[ref('frozen-a1'),ref('frozen-a2')],reviewRef:ref('shortlist'),decisionRef:ref('decision')};
  const row=external('ui_candidate_set',set),{engine,api}=await fixture([row]);
  const setRef={id:row.id,version:row.version,kind:row.kind,digest:row.digest};
  const run=await api.startRun({packId:pack.id,packVersion:pack.version,graphId:'ui-prototype-experiment',mode:'manual',actor:owner('design-director'),input:{creative_brief:brief,uiCandidateSetRef:setRef}});
  const payloadFor=async(node)=>{
    const decision=(await engine.listDecisions({runId:run.id})).find(item=>item.nodeId==='select-final-ui');
    if(node.id==='pin-ui-shortlist') return {id:'finalists',version:'1',candidateSetRef:setRef,candidateRefs:set.candidateRefs,criteria:['fit']};
    if(node.id==='prototype-a'||node.id==='prototype-b') return {id:node.id,version:'1',candidateRef:set.candidateRefs[node.id==='prototype-a'?0:1],prototypeRef:ref(node.id),evaluationTasks:['task']};
    if(node.id==='compare-prototypes') return {id:'comparison',version:'1',candidateRefs:set.candidateRefs,prototypeRefs:[ref('prototype-a'),ref('prototype-b')],criteria:['fit'],findings:[],reviewerExecutionId:'exec-design-researcher'};
    return {id:'selection',version:'1',selectedCandidateRef:set.candidateRefs[0],candidateSetRef:setRef,selectionEvidenceRef:ref('comparison'),decisionRef:ref(decision?.id,decision?.at)};
  };
  assert.equal((await complete(run,engine,api,payloadFor,node=>node.id==='prototype-route'?'prototype':node.id==='select-final-ui'?'selected':'')).status,'completed');
  const one={...set,id:'one-set',candidateRefs:[ref('frozen-a1')]},oneRow=external('ui_candidate_set',one),badFixture=await fixture([oneRow]);
  const oneRef={id:oneRow.id,version:oneRow.version,kind:oneRow.kind,digest:oneRow.digest};
  const bad=await badFixture.api.startRun({packId:pack.id,packVersion:pack.version,graphId:'ui-prototype-experiment',mode:'manual',actor:owner('design-director'),input:{creative_brief:brief,uiCandidateSetRef:oneRef}});
  const pin=(await badFixture.engine.getReadyNodes(bad.id))[0]; await submit(badFixture.api,bad,pin,{id:'finalists',version:'1',candidateSetRef:oneRef,candidateRefs:one.candidateRefs,criteria:['fit']});
  await assert.rejects(badFixture.api.decideNode({runId:bad.id,nodeId:'prototype-route',actor:owner('design-director'),outcome:'prototype',reason:'insufficient finalists'}),/exactly two distinct/);
  assert.equal((await badFixture.engine.getRun(bad.id)).nodeStates['prototype-route'].status,'pending');
});
