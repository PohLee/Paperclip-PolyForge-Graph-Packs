import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GraphEngine, runValidationDigest } from './core-import.mjs';
import { pack, createCreativeHostApi as createCreativeHostApiImpl, auditPalette, contrastRatio, buildBrandContextSnapshot, resolveBrandQuestion, inspectLogoSvg, validateCreativeArtifact } from '../index.mjs';

const createCreativeHostApi=options=>createCreativeHostApiImpl({...options,runValidationDigest});

const digest = value => createHash('sha256').update(value).digest('hex');
const stable = value => JSON.stringify(value,(key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(name=>[name,item[name]])):item);
const ref = (id,version='1') => ({id,version});
const actor = (role,id) => ({id,kind:role==='human-owner'?'human':'agent',roles:[role],executionId:id});
const brief = {id:'brief',version:'1',objective:'Explore an English brand mark',audience:'Product buyers'};

test('brand context answers only current decision-backed project facts',()=>{
  const snapshot=buildBrandContextSnapshot({projectId:'p1',decisionRefs:[ref('approval')],facts:[
    {projectId:'p1',field:'primaryColor',value:'#FF5B3D',version:'1',sequence:1,status:'approved',sourceRef:ref('old'),decisionRef:ref('approval'),supersededBy:ref('new')},
    {projectId:'p1',field:'primaryColor',value:'#171923',version:'2',sequence:2,status:'draft',sourceRef:ref('new')},
    {projectId:'p2',field:'brandName',value:'Other project',version:'1',sequence:1,status:'approved',sourceRef:ref('other'),decisionRef:ref('approval')}
  ]});
  assert.deepEqual(resolveBrandQuestion(snapshot,'primaryColor'),{disposition:'needs-source',field:'primaryColor'});
  assert.deepEqual(resolveBrandQuestion(snapshot,'brandName'),{disposition:'needs-source',field:'brandName'});
  assert.equal(validateCreativeArtifact('brand_context_snapshot',{id:'snapshot',version:'1',...snapshot}).valid,true);
  const approved=buildBrandContextSnapshot({projectId:'p1',decisionRefs:[ref('approval')],facts:[{projectId:'p1',field:'brandName',value:'Chosen',version:'1',status:'approved',sourceRef:ref('source'),decisionRef:ref('approval')}]});
  assert.equal(resolveBrandQuestion(approved,'brandName').value,'Chosen');
});

test('palette tool measures declared use pairs and SVG helper rejects active content',()=>{
  assert.equal(contrastRatio('#000000','#FFFFFF'),21);
  assert.equal(auditPalette({ink:'#777777',paper:'#FFFFFF'},[{foreground:'ink',background:'paper',purpose:'normal-text'}]).status,'gate');
  assert.equal(auditPalette({ink:'#000000',paper:'#FFFFFF'},[{foreground:'ink',background:'paper',purpose:'normal-text'}]).status,'pass');
  assert.equal(inspectLogoSvg('<svg viewBox="0 0 256 256"><path d="M0 0h1v1z"/></svg>').valid,true);
  assert.equal(inspectLogoSvg('<svg viewBox="0 0 256 256"><script>alert(1)</script></svg>').valid,false);
  assert.equal(inspectLogoSvg('<svg viewBox="0 0 256 256"><text>Brand</text></svg>').valid,false);
  assert.equal(inspectLogoSvg('<svg viewBox="0 0 256 256"><use href="file:///private/logo.svg"/></svg>').valid,false);
});

test('brand graph pins trusted project memory and rejects forged approved context',async()=>{
  const engine=new GraphEngine(); await engine.registerPack(pack);
  const base={engine,resolveActor:({claimedActor})=>claimedActor};
  const input={creative_brief:brief,projectId:'project-1'};
  await assert.rejects(createCreativeHostApi(base).startRun({packId:'creative-team',packVersion:pack.version,graphId:'brand-architecture-naming',mode:'manual',actor:actor('human-owner','owner'),input}),/trusted brand context loader/);
  const api=createCreativeHostApi({...base,loadBrandContext:async()=>({facts:[{projectId:'project-1',field:'brandName',value:'Approved',version:'1',status:'approved',sourceRef:ref('source'),decisionRef:ref('approval')}],decisionRefs:[ref('approval')]})});
  const run=await api.startRun({packId:'creative-team',packVersion:pack.version,graphId:'brand-architecture-naming',mode:'manual',actor:actor('human-owner','owner'),input});
  const payload={id:'context',version:'1',projectId:'project-1',fields:{brandName:{value:'Forged',status:'approved',sourceRef:ref('source'),decisionRef:ref('approval')}},unknowns:[]};
  await assert.rejects(api.submitNode({runId:run.id,nodeId:'pin-brand-context',actor:actor('brand-strategist','strategist'),artifacts:[{id:'context',version:'1',kind:'brand_context_snapshot'}],payloads:{brand_context_snapshot:payload}}),/trusted current project snapshot/);
});

test('logo graph checks actual SVG bytes, independent reviews and current evidence',async()=>{
  const root=await mkdtemp(join(tmpdir(),'brand-logo-host-'));
  try {
    const engine=new GraphEngine(); await engine.registerPack(pack);
    const baseline={id:'baseline',version:'1',strategyRef:ref('s'),identityRef:ref('i'),voiceRef:ref('v'),decisionRef:ref('d')};
    const baselineRow={id:'baseline',version:'1',kind:'brand_baseline',payload:baseline,digest:digest(stable(baseline))};
    const api=createCreativeHostApi({engine,artifactRootForRun:root,resolveActor:({claimedActor})=>claimedActor,
      loadBrandContext:async()=>({facts:[],decisionRefs:[]}),
      loadExternalArtifact:async({ref:target,kind})=>kind==='brand_baseline'&&target.id==='baseline'?baselineRow:null,
      resolveDecisionEvidence:async({run,requiredKinds})=>requiredKinds.map(kind=>({kind,payload:{kind},sourceRef:{...run.nodeStates['review-logo-concepts'].attempts.at(-1).artifacts[0]}}))});
    const run=await api.startRun({packId:'creative-team',packVersion:pack.version,graphId:'logo-concept-design',mode:'manual',actor:actor('human-owner','owner'),input:{creative_brief:brief,projectId:'project-1',brandBaselineRef:ref('baseline'),brandLanguage:'en'}});
    const submit=(nodeId,kind,payload,role,id)=>api.submitNode({runId:run.id,nodeId,actor:actor(role,id),artifacts:[{id:payload.id,version:payload.version,kind}],payloads:{[kind]:payload}});
    await submit('pin-logo-brief','logo_design_brief',{id:'logo-brief',version:'1',brandBaselineRef:ref('baseline'),name:'Chosen',scope:'new',uses:['app icon']},'brand-strategist','brief-author');
    await submit('explore-logo-ideas','logo_concept_plan',{id:'plan',version:'1',briefRef:ref('logo-brief'),concepts:['forward','signal','frame']},'art-director','plan-author');
    await mkdir(join(root,'logos'));
    const candidates=[];
    for(let i=0;i<3;i++) {
      const svg=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><path d="M${i} 0h100v100z"/></svg>`);
      const path=`logos/${i}.svg`; await writeFile(join(root,path),svg);
      candidates.push({id:`logo-${i}`,version:'1',idea:`Direction ${i}`,svg:{path,digest:digest(svg)}});
    }
    const set={id:'logo-set',version:'1',briefRef:ref('logo-brief'),candidates};
    await assert.rejects(submit('draw-logo-candidates','logo_candidate_set',{...set,candidates:[...candidates.slice(0,2),{...candidates[2],svg:{...candidates[2].svg,digest:'a'.repeat(64)}}]},'brand-identity-designer','logo-author'),/digest differs/);
    assert.equal((await engine.getRun(run.id)).nodeStates['draw-logo-candidates'].attempts.length,0);
    await submit('draw-logo-candidates','logo_candidate_set',set,'brand-identity-designer','logo-author');
    const audit={id:'file-audit',version:'1',candidateSetRef:ref('logo-set'),findings:[],disposition:'complete',reviewerExecutionId:'qa-exec'};
    await assert.rejects(submit('audit-logo-files','logo_file_audit',audit,'design-qa-accessibility','logo-author'),/Independent reviewer/);
    await submit('audit-logo-files','logo_file_audit',audit,'design-qa-accessibility','qa-exec');
    const review={id:'visual-review',version:'1',candidateSetRef:ref('logo-set'),fileAuditRef:ref('file-audit'),disposition:'accepted',findings:[],reviewerExecutionId:'creative-exec'};
    await submit('review-logo-concepts','logo_concept_review',review,'creative-director','creative-exec');
    await writeFile(join(root,candidates[0].svg.path),'<svg viewBox="0 0 256 256"><path d="M0 0h10v10z"/></svg>');
    await assert.rejects(api.decideNode({runId:run.id,nodeId:'logo-concept-disposition',actor:{id:'owner',kind:'human',roles:['human-owner','creative-director'],executionId:'owner'},outcome:'ready-for-selection',reason:'reviewed'}),/digest differs/);
  } finally { await rm(root,{recursive:true,force:true}); }
});

test('brand identity start rejects non-English input and unauthenticated logo selection',async()=>{
  const root=await mkdtemp(join(tmpdir(),'brand-identity-host-'));
  try {
    const engine=new GraphEngine(); await engine.registerPack(pack);
    const rows=new Map();
    const remember=(kind,payload,artifactRoot)=>{const row={id:payload.id,version:payload.version,kind,payload,digest:digest(stable(payload)),artifactRoot};rows.set(`${kind}:${row.id}`,row);return ref(row.id)};
    const baselineRef=remember('brand_baseline',{id:'base',version:'1',strategyRef:ref('s'),identityRef:ref('i'),voiceRef:ref('v'),decisionRef:ref('d')});
    await mkdir(join(root,'logos'));
    const candidates=[];
    for(let i=0;i<3;i++){const svg=Buffer.from(`<svg viewBox="0 0 256 256"><path d="M${i} 0h100v100z"/></svg>`);const path=`logos/${i}.svg`;await writeFile(join(root,path),svg);candidates.push({id:`c${i}`,version:'1',idea:`Idea ${i}`,svg:{path,digest:digest(svg)}})}
    const setRef=remember('logo_candidate_set',{id:'set',version:'1',briefRef:ref('b'),candidates},root);
    const selectionRef=remember('logo_concept_selection',{id:'choice',version:'1',candidateSetRef:setRef,candidateId:'c0',candidateVersion:'1',selectedBy:'designer'});
    const api=createCreativeHostApi({engine,artifactRootForRun:root,resolveActor:({claimedActor})=>claimedActor,loadExternalArtifact:async({ref:target,kind})=>rows.get(`${kind}:${target.id}`),getArtifactProvenance:async()=>[{kind:'agent',roles:['brand-identity-designer']} ],loadBrandContext:async()=>({facts:[],decisionRefs:[]})});
    const input={creative_brief:brief,projectId:'project-1',brandBaselineRef:baselineRef,logoCandidateSetRef:setRef,logoSelectionRef:selectionRef};
    await assert.rejects(api.startRun({packId:'creative-team',packVersion:pack.version,graphId:'brand-identity-kit',mode:'manual',actor:actor('human-owner','owner'),input:{...input,brandLanguage:'tr'}}),/English only/);
    await assert.rejects(api.startRun({packId:'creative-team',packVersion:pack.version,graphId:'brand-identity-kit',mode:'manual',actor:actor('human-owner','owner'),input}),/owner choice or verified delegation/);
    let checked=false;
    const delegated=createCreativeHostApi({engine,artifactRootForRun:root,resolveActor:({claimedActor})=>claimedActor,loadExternalArtifact:async({ref:target,kind})=>rows.get(`${kind}:${target.id}`),getArtifactProvenance:async()=>[{kind:'agent',roles:['head-of-design'],executionId:'design-head'}],loadBrandContext:async()=>({facts:[],decisionRefs:[]}),authorizeBrandSelection:async({selection,authors})=>{checked=true;return selection.id==='choice'&&authors[0].roles.includes('head-of-design')}});
    const run=await delegated.startRun({packId:'creative-team',packVersion:pack.version,graphId:'brand-identity-kit',mode:'manual',actor:actor('human-owner','owner'),input});
    assert.equal(checked,true);
    assert.equal(run.graph.id,'brand-identity-kit');
    const badSelection={...rows.get('logo_concept_selection:choice').payload,candidateId:'missing'};
    rows.set('logo_concept_selection:choice',{...rows.get('logo_concept_selection:choice'),payload:badSelection,digest:digest(stable(badSelection))});
    await assert.rejects(delegated.startRun({packId:'creative-team',packVersion:pack.version,graphId:'brand-identity-kit',mode:'manual',actor:actor('human-owner','owner'),input}),/exact candidate/);
    const recovery=await delegated.validateRun({run:await engine.getRun(run.id),decisions:await engine.listDecisions({runId:run.id})});
    assert.ok(recovery.issues.some(issue=>issue.code==='start-input-invalid'&&issue.message.includes('exact candidate')));
  } finally { await rm(root,{recursive:true,force:true}); }
});

test('brand guidelines context must preserve the exact pinned baseline digest',async()=>{
  const engine=new GraphEngine(); await engine.registerPack(pack);
  const baselineA={id:'baseline-a',version:'1',strategyRef:ref('strategy'),identityRef:ref('identity'),voiceRef:ref('voice'),decisionRef:ref('decision')};
  const baselineB={...baselineA,id:'baseline-b'};
  const row=payload=>({id:payload.id,version:payload.version,kind:'brand_baseline',payload,digest:digest(stable(payload))});
  const rowA=row(baselineA),rowB=row(baselineB),rows=new Map([[`brand_baseline:${rowA.id}@1`,rowA],[`brand_baseline:${rowB.id}@1`,rowB]]);
  const reference=item=>({id:item.id,version:item.version,kind:item.kind,digest:item.digest});
  const api=createCreativeHostApi({engine,resolveActor:({claimedActor})=>claimedActor,loadBrandContext:async()=>({facts:[],decisionRefs:[]}),loadExternalArtifact:async({ref:target,kind})=>rows.get(`${kind}:${target.id}@${target.version}`)});
  const input={creative_brief:brief,projectId:'brand-project',brandBaselineRef:reference(rowA)};
  const run=await api.startRun({packId:'creative-team',packVersion:pack.version,graphId:'brand-guidelines',mode:'manual',actor:actor('human-owner','owner'),input});
  const submit=brandBaselineRef=>api.submitNode({runId:run.id,nodeId:'pin-approved-brand',actor:actor('design-ops-producer','ops'),artifacts:[{id:'guidelines-context',version:'1',kind:'guidelines_context'}],payloads:{guidelines_context:{id:'guidelines-context',version:'1',brandBaselineRef,assetRefs:[ref('brand-asset')]}}});
  await assert.rejects(submit(reference(rowB)),/exact pinned baseline revision/);
  await submit(reference(rowA));
  assert.equal((await engine.getRun(run.id)).nodeStates['pin-approved-brand'].status,'completed');
});

test('brand asset adoption requires human owner and current reviewed asset bytes',async()=>{
  const root=await mkdtemp(join(tmpdir(),'brand-adoption-host-'));
  try {
    const engine=new GraphEngine(); await engine.registerPack(pack);
    const rows=new Map();
    const remember=(kind,payload,artifactRoot)=>{const row={id:payload.id,version:payload.version,kind,payload,digest:digest(stable(payload)),artifactRoot};rows.set(`${kind}:${row.id}@${row.version}`,row);return ref(row.id,row.version)};
    const strategyRef=remember('brand_strategy',{id:'strategy',version:'1',evidenceRef:ref('evidence'),audience:'Buyers',positioning:'Clear',promise:'Reliable',proof:'Sourced evidence'});
    const identityRef=remember('brand_identity_system',{id:'identity',version:'1',strategyRef,territoryRef:ref('territory'),rules:['clear space'],assetRefs:[ref('old-mark')]});
    const voiceRef=remember('brand_voice_system',{id:'voice',version:'1',strategyRef,voice:['direct'],messaging:['clear'],factBoundaries:['sourced']});
    const baselineRef=remember('brand_baseline',{id:'baseline',version:'1',strategyRef,identityRef,voiceRef,decisionRef:ref('initial-decision')});
    const contextRef=remember('identity_kit_context',{id:'kit-context',version:'1',brandBaselineRef:baselineRef,candidateSetRef:ref('logo-set'),selectionRef:ref('logo-selection')});
    await mkdir(join(root,'assets'));
    const original=Buffer.from('<svg viewBox="0 0 256 256"><path d="M0 0h100v100z"/></svg>');
    await writeFile(join(root,'assets','master.svg'),original);
    const kitRef=remember('brand_identity_kit',{id:'kit',version:'1',contextRef,optionsRef:ref('options'),checksRef:ref('checks'),language:'en',assetRefs:[{id:'master',version:'1',path:'assets/master.svg',digest:digest(original)}],tokens:['ink:#000']},root);
    const reviewRef=remember('brand_identity_kit_review',{id:'kit-review',version:'1',kitRef,checksRef:ref('checks'),disposition:'accepted',findings:[],reviewerExecutionId:'reviewer'});
    const api=createCreativeHostApi({engine,artifactRootForRun:root,resolveActor:({claimedActor})=>claimedActor,
      loadExternalArtifact:async({ref:target,kind})=>rows.get(`${kind}:${target.id}@${target.version}`),
      loadBrandContext:async()=>({facts:[],decisionRefs:[]}),
      resolveDecisionEvidence:async({requiredKinds})=>requiredKinds.map(kind=>({kind,payload:{kind},sourceRef:{...ref('approval-subject'),kind:'brand_approval_context'}}))});
    const run=await api.startRun({packId:'creative-team',packVersion:pack.version,graphId:'brand-asset-adoption',mode:'manual',actor:actor('human-owner','owner'),input:{creative_brief:brief,projectId:'project-1',brandBaselineRef:baselineRef,brandKitRef:kitRef,brandKitReviewRef:reviewRef}});
    const submit=(nodeId,kind,payload)=>api.submitNode({runId:run.id,nodeId,actor:actor('design-ops-producer','producer'),artifacts:[{id:payload.id,version:payload.version,kind}],payloads:{[kind]:payload}});
    await submit('pin-adoption-subject','brand_approval_context',{id:'approval-subject',version:'1',previousBaselineRef:baselineRef,kitRef,reviewRef,changeSummary:'Adopt the new mark'});
    await assert.rejects(api.decideNode({runId:run.id,nodeId:'adopt-brand-assets',actor:actor('head-of-design','designer'),outcome:'adopt',reason:'Looks good'}),/authenticated human owner/);
    await writeFile(join(root,'assets','master.svg'),'<svg viewBox="0 0 256 256"><path d="M0 0h10v10z"/></svg>');
    const owner={id:'owner',kind:'human',roles:['human-owner','head-of-design'],executionId:'owner'};
    await assert.rejects(api.decideNode({runId:run.id,nodeId:'adopt-brand-assets',actor:owner,outcome:'adopt',reason:'Approved'}),/asset bytes differ/);
    await writeFile(join(root,'assets','master.svg'),original);
    const decided=await api.decideNode({runId:run.id,nodeId:'adopt-brand-assets',actor:owner,outcome:'adopt',reason:'Approved reviewed kit'});
    const adopted={id:'baseline',version:'2',strategyRef,identityRef,voiceRef,previousBaselineRef:baselineRef,kitRef,reviewRef,decisionRef:ref(decided.decision.id,decided.decision.at)};
    await assert.rejects(submit('publish-adopted-baseline','brand_baseline',{...adopted,kitRef:ref('kit','0')}),/exact prior baseline, kit and review/);
    await writeFile(join(root,'assets','master.svg'),'<svg viewBox="0 0 256 256"><path d="M0 0h20v20z"/></svg>');
    await assert.rejects(submit('publish-adopted-baseline','brand_baseline',adopted),/asset bytes differ/);
    await writeFile(join(root,'assets','master.svg'),original);
    await submit('publish-adopted-baseline','brand_baseline',adopted);
    assert.equal((await engine.getRun(run.id)).nodeStates['publish-adopted-baseline'].status,'completed');
  } finally { await rm(root,{recursive:true,force:true}); }
});
