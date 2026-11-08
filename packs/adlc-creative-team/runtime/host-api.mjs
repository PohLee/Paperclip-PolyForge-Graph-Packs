import { createHash } from 'node:crypto';
import { readFile, realpath, readdir } from 'node:fs/promises';
import path from 'node:path';
import { graphs, productDesignGraphs } from '../graphs/catalog.mjs';
import { brandGraphs } from '../graphs/brand-catalog.mjs';
import { inspectLogoSvg } from '../adapters/brand-tools/svg.mjs';
import { buildBrandContextSnapshot } from '../adapters/brand-tools/context.mjs';
import { renderGalleryHtml, validateConceptSet, validateSelection, validateStaticImage } from '../adapters/concept-gallery/index.mjs';
import { assertCreativeArtifact, validateCreativeArtifact } from '../contracts/validate.mjs';
import { createArtifactLineage } from './artifact-lineage.mjs';

const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const stableJson=value=>JSON.stringify(value,(key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(name=>[name,item[name]])):item);
const refId=ref=>ref?.id??ref?.artifactId;
const isRef=value=>value&&typeof value==='object'&&refId(value)&&value.version;
const sameRef=(left,right)=>isRef(left)&&isRef(right)&&refId(left)===refId(right)&&left.version===right.version;
const successOutcomes=new Set(['ready','complete','verified','accepted']);

const latestPayload=(run,nodeId,kind)=>createArtifactLineage(run).latest(nodeId,kind);
function records(run) {
  return run.graph.nodes.flatMap(node=>(run.nodeStates[node.id]?.attempts??[]).flatMap(attempt=>(attempt.artifacts??[]).map(item=>({item,attempt,node, payload:attempt.output?.creativeArtifacts?.[item.kind]}))));
}
const exactRecord=(run,ref)=>createArtifactLineage(run).exactRecord(ref);
function getGraph(packId,graphId) { return packId==='creative-team'?[...graphs,...productDesignGraphs,...brandGraphs].find(g=>g.id===graphId):undefined; }
function requestedCount(run) { return run.input.creative_brief?.requestedCount??run.input.requestedCount; }
function asRefs(candidates) { return candidates.map(c=>({id:c.id,version:c.version})); }

const graphIds=[...graphs,...productDesignGraphs,...brandGraphs].map(item=>item.id);
const decisionGraphIds=new Set([...graphs,...productDesignGraphs,...brandGraphs].filter(item=>item.nodes.some(node=>node.type==='decision')).map(item=>item.id));
const serviceRequirements=Object.fromEntries(graphIds.map(id=>[id,new Set()]));
const requireServices=(ids,...names)=>{ for(const id of ids) for(const name of names) serviceRequirements[id]?.add(name); };
requireServices([...decisionGraphIds],'resolveDecisionEvidence');
requireServices(['concept-sprint'],'artifactRootForRun','hasImageProvider','decodeImage');
requireServices(['concept-to-web-design'],'loadExternalArtifact','artifactRootForRun','decodeImage','getArtifactProvenance');
requireServices(['saas-feature-design'],'loadExternalArtifact');
requireServices(['design-system-evolution'],'loadExternalArtifact');
requireServices(['brand-campaign-assets'],'loadExternalArtifact');
requireServices(['logo-concept-design','brand-identity-kit','brand-asset-adoption','brand-guidelines','brand-packaging-brief','brand-rollout-plan','brand-architecture-naming'],'loadExternalArtifact','loadBrandContext');
requireServices(['brand-identity-kit','brand-asset-adoption','logo-concept-design'],'artifactRootForRun');
requireServices(['brand-identity-kit'],'getArtifactProvenance');
requireServices(['brand-asset-adoption'],'artifactRootForRun');
requireServices(['design-assurance'],'loadExternalArtifact','getArtifactProvenance');
requireServices(['ui-candidate-sprint','ui-prototype-experiment'],'loadExternalArtifact');
requireServices(['minor-ui-change','product-design-discovery'],'loadExternalArtifact');

/** Trusted adapter prerequisites; this map is source-owned, never read from Pack JSON. */
export const creativeRequiredServicesByGraph=Object.freeze(Object.fromEntries(
  Object.entries(serviceRequirements).map(([id,names])=>[id,Object.freeze([...names].sort())])
));

async function insideRoot(root, relative) {
  if(typeof relative!=='string'||!relative||path.isAbsolute(relative)||relative.includes('\\')||relative.split('/').includes('..')) throw new Error('Artifact paths must be safe relative paths');
  const realRoot=await realpath(root), candidate=path.resolve(realRoot,relative), rel=path.relative(realRoot,candidate);
  if(rel.startsWith('..')||path.isAbsolute(rel)) throw new Error('Artifact path escapes the run artifact directory');
  const realCandidate=await realpath(candidate), realRel=path.relative(realRoot,realCandidate);
  if(realRel.startsWith('..')||path.isAbsolute(realRel)) throw new Error('Artifact symlink escapes the run artifact directory');
  return {realRoot,realCandidate};
}

export function createCreativeHostApi({engine,artifactRootForRun,hasImageProvider,decodeImage,loadExternalArtifact,getArtifactProvenance,resolveDecisionEvidence,resolveActor,authorizeBrandSelection,loadBrandContext,runValidationDigest,services={}}={}) {
  if(!engine) throw new TypeError('engine is required');
  if(typeof runValidationDigest!=='function') throw new TypeError('Trusted runValidationDigest function is required');
  artifactRootForRun=services.artifactRootForRun??artifactRootForRun;
  hasImageProvider=services.hasImageProvider??hasImageProvider;
  decodeImage=services.decodeImage??decodeImage;
  loadExternalArtifact=services.loadExternalArtifact??loadExternalArtifact;
  getArtifactProvenance=services.getArtifactProvenance??getArtifactProvenance;
  resolveDecisionEvidence=services.resolveDecisionEvidence??resolveDecisionEvidence;
  resolveActor=services.resolveActor??resolveActor;
  authorizeBrandSelection=services.authorizeBrandSelection??authorizeBrandSelection;
  loadBrandContext=services.loadBrandContext??loadBrandContext;
  const snapshotDigest=run=>{
    const value=runValidationDigest(run);
    if(typeof value!=='string'||!value.trim()) throw new Error('Trusted runValidationDigest returned an invalid digest');
    return value;
  };
  const rootFor=async run=>{
    const root=typeof artifactRootForRun==='function'?await artifactRootForRun(run):artifactRootForRun;
    if(!root) throw new Error('Trusted artifact storage root is not configured for this run');
    return root;
  };
  async function verifyBrandSvg(run,candidate) {
    const {realCandidate}=await insideRoot(await rootFor(run),candidate.svg.path);
    const bytes=await readFile(realCandidate);
    if(digest(bytes)!==candidate.svg.digest) throw new Error('Logo SVG digest differs from the pinned candidate');
    const result=inspectLogoSvg(bytes);
    if(!result.valid) throw new Error(`Logo SVG structure failed: ${result.findings.join('; ')}`);
  }
  async function verifyBrandKitAssets(kit) {
    if(!kit.artifactRoot) throw new Error('Brand kit needs a trusted artifact root');
    for(const asset of kit.payload.assetRefs) {
      const {realCandidate}=await insideRoot(kit.artifactRoot,asset.path);
      if(digest(await readFile(realCandidate))!==asset.digest) throw new Error('Brand kit asset bytes differ from pinned digest');
    }
  }
  async function trustedActor(claimedActor,context) {
    if(typeof resolveActor!=='function') throw new Error('Trusted host actor resolver is required; caller-supplied actor fields are not accepted');
    const actor=await resolveActor({claimedActor,context});
    const validExecution=actor?.kind==='agent'?typeof actor.executionId==='string'&&Boolean(actor.executionId.trim()):actor?.kind==='human'&&(actor.executionId===null||(typeof actor.executionId==='string'&&Boolean(actor.executionId.trim())));
    const validSystem=actor?.kind==='system'&&context.operation==='submitNode'&&['join','end'].includes(context.node?.type)&&typeof actor.id==='string'&&Boolean(actor.id.trim())&&Array.isArray(actor.roles)&&actor.roles.length===0&&actor.executionId===null;
    if(!actor||typeof actor.id!=='string'||!actor.id.trim()||!['agent','human','system'].includes(actor.kind)||!Array.isArray(actor.roles)||(!validExecution&&!validSystem)) throw new Error('Host actor resolver returned an invalid authenticated actor');
    return actor;
  }
  async function externalRecord(ref,kind,context={}) {
    if(!isRef(ref)||!kind) throw new Error('External artifact references require explicit kind, id, and version');
    if(ref.kind&&ref.kind!==kind) throw new Error(`External reference kind ${ref.kind} does not match ${kind}`);
    if(typeof loadExternalArtifact!=='function') throw new Error(`Trusted artifact loader is not configured for ${kind}`);
    const row=await loadExternalArtifact({ref,kind,...context});
    if(!row||row.id!==refId(ref)||row.version!==ref.version||row.kind!==kind||!row.payload||typeof row.payload!=='object') throw new Error(`Host artifact store did not return the exact ${kind} artifact version`);
    assertCreativeArtifact(kind,row.payload);
    if(row.payload.id!==row.id||row.payload.version!==row.version) throw new Error(`Loaded ${kind} payload identity differs from its trusted record`);
    const observedDigest=digest(Buffer.from(stableJson(row.payload)));
    if(row.digest!==observedDigest||(ref.digest&&ref.digest!==observedDigest)) throw new Error(`Loaded ${kind} bytes do not match their immutable SHA-256 reference`);
    return row;
  }
  async function inputArtifact(input,field,kind,context={}) {
    const ref=input?.[field];
    if(!isRef(ref)) throw new Error(`${field} must be an exact id/version reference`);
    return externalRecord(ref,kind,{...context,input});
  }
  async function verifyExternalSetImages(record) {
    if(!record.artifactRoot) throw new Error('External concept set has no trusted artifact root');
    for(const candidate of record.payload.candidates) {
      const {realCandidate}=await insideRoot(record.artifactRoot,candidate.image.path);
      const observed=await validateStaticImage(realCandidate,{decodeImage});
      if(observed.digest!==candidate.image.digest||observed.mimeType!==candidate.image.mimeType||observed.width!==candidate.image.width||observed.height!==candidate.image.height) throw new Error(`External concept ${candidate.id} bytes do not match its metadata`);
    }
  }
  async function verifyRef(run,ref,kind,context={}) {
    if(!isRef(ref)) throw new Error(`${kind} link must be an exact id/version reference`);
    if(ref.kind&&ref.kind!==kind) throw new Error(`Reference kind ${ref.kind} does not match required ${kind}`);
    const local=exactRecord(run,ref);
    if(local) {
      if(local.item.kind!==kind) throw new Error(`Reference ${refId(ref)} is ${local.item.kind}, expected ${kind}`);
      return local.payload;
    }
    return (await externalRecord(ref,kind,{run,input:run.input,...context})).payload;
  }
  async function requireDecision(run,nodeId,outcome) {
    const rows=await engine.listDecisions({runId:run.id});
    const row=rows.filter(item=>item.nodeId===nodeId&&item.status==='decided').at(-1);
    if(!row||(outcome!==undefined&&row.outcome!==outcome)) throw new Error(`Package publication requires the current ${nodeId} decision${outcome===undefined?'':' to be '+outcome}`);
    return {id:row.id,version:row.at};
  }
  async function verifyImage(run,kind,candidate) {
    const root=await rootFor(run),{realCandidate}=await insideRoot(root,candidate.image.path);
      const observed=await validateStaticImage(realCandidate,{decodeImage});
    if(observed.digest!==candidate.image.digest||observed.mimeType!==candidate.image.mimeType||
      (candidate.image.width&&candidate.image.width!==observed.width)||(candidate.image.height&&candidate.image.height!==observed.height)) throw new Error(`Real image bytes do not match ${kind} metadata`);
    return observed;
  }
  async function verifiedSet(run) {
    const set=latestPayload(run,'freeze-concept-set','concept_set');
    const check=validateConceptSet(set);
    if(!check.valid) throw new Error(`Concept set invalid: ${check.errors.join('; ')}`);
    if(set.requestedCount!==requestedCount(run)) throw new Error('Concept set count differs from the frozen brief');
    const renderNodes=run.graph.nodes.filter(node=>/^render-\d\d$/.test(node.id)&&run.nodeStates[node.id]?.status==='completed');
    if(renderNodes.length!==set.requestedCount) throw new Error('Concept set does not match the exact number of completed render branches');
    const expected=new Set(renderNodes.map(node=>`concept_image_${node.id.slice(-2)}`));
    for(const candidate of set.candidates) {
      const pair=records(run).find(row=>expected.has(row.item.kind)&&row.item.id===candidate.id&&row.item.version===candidate.version);
      if(!pair) throw new Error(`Concept ${candidate.id}@${candidate.version} is not a current render artifact`);
      if(pair.payload?.image?.digest!==candidate.image.digest||pair.payload?.image?.path!==candidate.image.path) throw new Error(`Concept ${candidate.id} changed after its render artifact was frozen`);
      await verifyImage(run,pair.item.kind,candidate);
    }
    return set;
  }
  async function verifyGallery(run,payload,set) {
    const root=await rootFor(run),{realRoot,realCandidate}=await insideRoot(root,payload.path);
    if(path.basename(realCandidate).toLowerCase()!=='index.html') throw new Error('Gallery artifact must be the single index.html comparison page');
    const files=await readdir(path.dirname(realCandidate));
    if(files.filter(name=>name.toLowerCase().endsWith('.html')).length!==1) throw new Error('Gallery output must contain exactly one HTML page');
    const html=await readFile(realCandidate);
    if(digest(html)!==payload.digest) throw new Error('Gallery HTML digest does not match saved bytes');
    const source=html.toString('utf8');
    if(payload.runnablePrototype===true||/data-product-prototype\s*=\s*["']true/i.test(source)) throw new Error('Gallery must not be represented as runnable product prototypes');
    if(payload.setRef.id!==set.id||payload.setRef.version!==set.version) throw new Error('Gallery is not bound to the current concept set version');
    const expectedSet={...set,candidates:set.candidates.map(candidate=>{
      const extension=candidate.image.mimeType==='image/jpeg'?'.jpg':candidate.image.mimeType==='image/webp'?'.webp':'.png';
      const filename=`${candidate.id.replace(/[^a-zA-Z0-9_-]/g,'-')}${extension}`;
      const {filePath,...image}=candidate.image;
      return {...candidate,image:{...image,path:`images/${filename}`,verification:image.mimeType==='image/png'?'decoded':'decoded-by-host'}};
    })};
    const expectedHtml=renderGalleryHtml(expectedSet,payload.title??'Concept gallery');
    if(source!==expectedHtml) throw new Error('Gallery HTML differs from the trusted static comparison renderer output');
    for(const candidate of set.candidates) {
      const extension=candidate.image.mimeType==='image/jpeg'?'.jpg':candidate.image.mimeType==='image/webp'?'.webp':'.png';
      const filename=`${candidate.id.replace(/[^a-zA-Z0-9_-]/g,'-')}${extension}`;
      const {realCandidate:imagePath}=await insideRoot(path.dirname(realCandidate),`images/${filename}`);
      const observed=await validateStaticImage(imagePath,{decodeImage});
      if(observed.digest!==candidate.image.digest||observed.mimeType!==candidate.image.mimeType||observed.width!==candidate.image.width||observed.height!==candidate.image.height) throw new Error(`Gallery bundle image bytes differ from candidate ${candidate.id}`);
    }
    return {path:realCandidate,root:realRoot};
  }
  async function requireDecisionEvidence(run,nodeId,outcome,decisions) {
    const node=run.graph.nodes.find(item=>item.id===nodeId);
    if(!node||node.type!=='decision') throw new Error('Decision evidence requested for a non-decision node');
    const prior=decisions??await engine.listDecisions({runId:run.id});
    if(!Array.isArray(prior)) throw new Error('Decision snapshot must be an array');
    if(nodeId==='naming-disposition'&&outcome==='shortlist') {
      const candidates=latestPayload(run,'develop-name-candidates','brand_name_candidates');
      const screening=latestPayload(run,'screen-name-conflicts','brand_name_screening');
      const review=latestPayload(run,'review-naming','brand_naming_review');
      if(!candidates||!screening||!review||review.disposition!=='accepted'||!sameRef(screening.candidateRef,candidates)||!sameRef(review.candidateRef,candidates)||!sameRef(review.screeningRef,screening)||review.findings?.some(f=>!['resolved','accepted-exception'].includes(f.status))) throw new Error('Naming shortlist requires current screened candidates and accepted independent review');
    }
    if(nodeId==='logo-concept-disposition'&&outcome==='ready-for-selection') {
      const set=latestPayload(run,'draw-logo-candidates','logo_candidate_set');
      const audit=latestPayload(run,'audit-logo-files','logo_file_audit');
      const review=latestPayload(run,'review-logo-concepts','logo_concept_review');
      if(!set||!audit||!review||audit.disposition!=='complete'||review.disposition!=='accepted'||!sameRef(audit.candidateSetRef,set)||!sameRef(review.candidateSetRef,set)||!sameRef(review.fileAuditRef,audit)||[...audit.findings,...review.findings].some(f=>!['resolved','accepted-exception'].includes(f.status))) throw new Error('Logo selection requires current SVG audit and accepted visual review');
      for(const candidate of set.candidates) await verifyBrandSvg(run,candidate);
    }
    if(nodeId==='identity-kit-disposition'&&outcome==='ready-for-owner') {
      const kit=latestPayload(run,'assemble-brand-kit','brand_identity_kit');
      const checks=latestPayload(run,'measure-identity','brand_identity_checks');
      const review=latestPayload(run,'review-brand-kit','brand_identity_kit_review');
      if(!kit||!checks||!review||review.disposition!=='accepted'||!sameRef(kit.checksRef,checks)||!sameRef(review.kitRef,kit)||!sameRef(review.checksRef,checks)||[...checks.findings,...review.findings].some(f=>!['resolved','accepted-exception'].includes(f.status))) throw new Error('Identity kit requires current measurements and accepted independent review');
    }
    if(nodeId==='adopt-brand-assets'&&outcome==='adopt') {
      const subject=latestPayload(run,'pin-adoption-subject','brand_approval_context');
      if(!subject||!sameRef(subject.previousBaselineRef,run.input.brandBaselineRef)||!sameRef(subject.kitRef,run.input.brandKitRef)||!sameRef(subject.reviewRef,run.input.brandKitReviewRef)) throw new Error('Brand adoption must pin the current baseline, exact kit and accepted review');
      await verifyBrandKitAssets(await externalRecord(run.input.brandKitRef,'brand_identity_kit',{run,input:run.input}));
    }
    if(nodeId==='choose-count'&&outcome!==String(requestedCount(run))) throw new Error('The selected branch count must match the count frozen in the brief');
    if(nodeId==='brand-evidence-disposition'&&outcome==='sufficient') {
      const ledger=latestPayload(run,'brand-evidence','brand_evidence_ledger');
      if(!ledger||!Array.isArray(ledger.claims)) throw new Error('Positioning requires an evaluated evidence ledger; otherwise route to needs-evidence');
      const supported=ledger.claims.filter(claim=>['supported','verified'].includes(claim?.assessment??claim?.status));
      if(!supported.length) throw new Error('Sufficient evidence needs at least one explicitly supported claim; otherwise route to needs-evidence');
      for(const claim of ledger.claims) {
        if(!claim||typeof claim.text!=='string'||!claim.text.trim()||!['supported','verified','unsupported','disputed','hypothesis','assumption'].includes(claim.assessment??claim.status)) throw new Error('Every evidence-ledger claim needs text and an explicit evaluated status');
        if(['supported','verified'].includes(claim.assessment??claim.status)) {
          if(!Array.isArray(claim.sourceRefs)||!claim.sourceRefs.length) throw new Error('Every supported factual claim needs exact source references');
          for(const ref of claim.sourceRefs) await verifyRef(run,ref,ref.kind??'research_evidence');
        }
      }
    }
    if(nodeId==='set-status'&&outcome==='complete') {
      const review=latestPayload(run,'review-set','concept_set_review');
      if(review?.disposition!=='complete') throw new Error('Cannot complete a concept set without a complete review');
      if(review.candidateRefs?.length!==requestedCount(run)) throw new Error('Review does not reference every requested concept candidate');
      for(const ref of review.candidateRefs) if(!exactRecord(run,ref)) throw new Error('Concept review references a missing or stale candidate');
    }
    if(nodeId==='set-status'&&outcome==='incomplete') {
      const review=latestPayload(run,'review-set','concept_set_review');
      if(!review||review.disposition==='complete') throw new Error('Incomplete disposition needs a review documenting an actual gap');
    }
    if(nodeId==='minor-disposition'&&outcome==='accepted') {
      const evaluation=latestPayload(run,'independent-evaluation','minor_ui_evaluation');
      if(!evaluation||evaluation.disposition!=='complete'||evaluation.findings?.some(item=>!['resolved','accepted-exception'].includes(item.status))) throw new Error('Minor UI acceptance requires a complete independent evaluation without unresolved findings');
      createArtifactLineage(run).submission('independent-evaluation',{minor_ui_evaluation:evaluation});
    }
    if(nodeId==='promote-directions'&&['a','b','both'].includes(outcome)) {
      const directions={a:latestPayload(run,'wireframe-a','wireframe_a'),b:latestPayload(run,'wireframe-b','wireframe_b')};
      const reviewKinds={
        'design-norms-review':'direction_norms_review',
        'requirement-fit-review':'direction_fit_review',
        'blind-direction-evaluation':'blind_direction_evaluation'
      };
      const reviews=Object.entries(reviewKinds).map(([id,kind])=>latestPayload(run,id,kind));
      if(!directions.a||!directions.b||reviews.some(item=>!item||item.disposition!=='complete')) throw new Error('Product direction promotion requires both current wireframes and all three complete independent reviews');
      for(const review of reviews) if(review.directionRefs?.length!==2||!review.directionRefs.every(ref=>[directions.a,directions.b].some(direction=>sameRef(ref,direction)))||!directions.a||!directions.b||!review.directionRefs.some(ref=>sameRef(ref,directions.a))||!review.directionRefs.some(ref=>sameRef(ref,directions.b))) throw new Error('Product direction review must retain both exact current wireframe references');
    }
    if(nodeId==='candidate-disposition'&&outcome==='ready') {
      const shortlist=latestPayload(run,'shortlist-ui-candidates','ui_candidate_shortlist');
      if(!shortlist||!shortlist.candidateRefs?.length||shortlist.candidateRefs.length>2) throw new Error('UI candidate acceptance requires a non-empty shortlist of at most two candidates');
      createArtifactLineage(run).submission('shortlist-ui-candidates',{ui_candidate_shortlist:shortlist});
    }
    if(nodeId==='select-final-ui'&&outcome==='selected') {
      const route=run.nodeStates['prototype-route']?.outcome;
      const evidence=route==='direct'?latestPayload(run,'record-no-prototype','ui_no_prototype_record'):route==='prototype'?latestPayload(run,'compare-prototypes','ui_prototype_comparison'):null;
      if(!evidence) throw new Error('Final UI selection requires the route-specific direct rationale or completed prototype comparison');
      if(route==='prototype'&&evidence.findings?.some(item=>!['resolved','accepted-exception'].includes(item.status))) throw new Error('Final UI selection cannot rely on a prototype comparison with unresolved findings');
    }
    if(nodeId==='prototype-route'&&outcome==='prototype') {
      const finalists=latestPayload(run,'pin-ui-shortlist','pinned_ui_finalists');
      if(!finalists||finalists.candidateRefs?.length!==2||refId(finalists.candidateRefs[0])===refId(finalists.candidateRefs[1])&&finalists.candidateRefs[0]?.version===finalists.candidateRefs[1]?.version) throw new Error('Prototype route requires exactly two distinct pinned finalists');
    }
    const gates={
      'brand-disposition':{ready:['brand_review','brand-review','accepted']},
      'web-design-disposition':{ready:['web_design_review','fidelity-review','complete']},
      'saas-disposition':{ready:['saas_design_review','saas-independent-review','complete']},
      'system-disposition':{accepted:['design_system_review','impact-review','accepted']},
      'assurance-disposition':{verified:['design_review','disposition','verified']},
      'campaign-disposition':{ready:['campaign_review','campaign-review','accepted']},
    };
    const gate=gates[nodeId]?.[outcome];
    if(gate) {
      const report=latestPayload(run,gate[1],gate[0]);
      if(!report||report.disposition!==gate[2]) throw new Error(`${nodeId} ${outcome} requires matching review disposition evidence`);
      if(nodeId==='assurance-disposition'&&outcome==='verified') {
        const subject=latestPayload(run,'pin-review-subject','review_subject');
        const visual=latestPayload(run,'visual-review','visual_review_findings');
        const behavior=latestPayload(run,'behavior-review','behavior_review_findings');
        const equalRefs=(left,right)=>Array.isArray(left)&&Array.isArray(right)&&left.length===right.length&&left.every((ref,index)=>sameRef(ref,right[index])&&ref.digest===right[index].digest);
        if(!subject||!visual||!behavior||!equalRefs(report.subjectRefs,subject.subjectRefs)||!equalRefs(visual.subjectRefs,subject.subjectRefs)||!equalRefs(behavior.subjectRefs,subject.subjectRefs)) throw new Error('Verified design assurance must cite the exact pinned subjects from both current reviews');
        const combined=[...(visual.findings??[]),...(behavior.findings??[])];
        if(stableJson(report.findings??[])!==stableJson(combined)) throw new Error('Verified design assurance must preserve every finding and disposition from both current reviews');
        if(stableJson(report.subjectAuthorExecutionIds??[])!==stableJson(subject.subjectAuthorExecutionIds??[])) throw new Error('Verified design assurance must use trusted pinned subject author provenance');
        const attempt=run.nodeStates.disposition?.attempts?.at(-1);
        if(!attempt?.actor?.executionId||report.reviewerExecutionId!==attempt.actor.executionId) throw new Error('Verified design assurance reviewer identity must match the authenticated disposition actor');
      }
      if(report.findings?.some(f=>!['resolved','accepted-exception'].includes(f.status))) throw new Error(`${nodeId} cannot accept unresolved findings`);
      if(report.unverified===true) throw new Error(`${nodeId} cannot accept unverified evidence`);
      if(['web_design_review','saas_design_review','design_review'].includes(gate[0])) {
        const priorAuthors=report.subjectAuthorExecutionIds??[];
        if(!priorAuthors.length) throw new Error('Review report must identify trusted candidate author executions');
        if(priorAuthors.includes(report.reviewerExecutionId)) throw new Error('Review execution must differ from all candidate author executions');
      }
    }
    createArtifactLineage(run).decision(nodeId,outcome);
    const rule=run.pack.decisionRules.find(item=>item.type===node.decisionType&&item.mode===run.mode);
    if(!rule||!rule.requiredEvidence?.length) throw new Error(`No explicit evidence rule for ${node.decisionType}/${run.mode}`);
    if(typeof resolveDecisionEvidence!=='function') throw new Error('Trusted decision-evidence resolver is not configured');
    const evidence=await resolveDecisionEvidence({run,node,outcome,requiredKinds:rule.requiredEvidence,decisions:prior});
      if(!Array.isArray(evidence)||rule.requiredEvidence.some(kind=>!evidence.some(item=>item.kind===kind&&item.payload&&typeof item.payload==='object'))) throw new Error(`Trusted evidence is incomplete for ${node.decisionType}`);
    for(const item of evidence) {
      const refs=[...(item.subjectRefs??[]),...(item.sourceRef&&typeof item.sourceRef==='object'?[item.sourceRef]:[])];
      if(!refs.length) throw new Error(`Evidence ${item.kind} has no versioned source reference`);
    for(const ref of refs) if(!exactRecord(run,ref)) await externalRecord(ref,ref.kind??item.sourceKind??item.kind,{run,input:run.input,actor:{id:item.actorId}});
    }
    return evidence;
  }

  async function validateStartInput(run) {
    const input=run.input??{},graphId=run.graph?.id;
    if(input.creative_brief) assertCreativeArtifact('creative_brief',input.creative_brief);
    const surfaceRequired=['concept-sprint','concept-to-web-design','saas-feature-design','minor-ui-change','product-design-discovery','ui-candidate-sprint','ui-prototype-experiment'].includes(graphId);
    if(surfaceRequired&&!['persuade','operate','read','experience'].includes(input.creative_brief?.surfaceMode)) throw new Error(`${graphId} requires a concrete creative_brief.surfaceMode`);
    if(['brand-foundation','concept-sprint','concept-to-web-design','saas-feature-design','brand-campaign-assets','brand-architecture-naming','logo-concept-design','brand-identity-kit','brand-asset-adoption','brand-guidelines','brand-packaging-brief','brand-rollout-plan'].includes(graphId)&&!input.creative_brief) throw new Error(`${graphId} requires a validated creative_brief`);
    if(graphId==='concept-sprint') {
      const briefCount=input.creative_brief?.requestedCount,topCount=input.requestedCount;
      if(briefCount!=null&&topCount!=null&&briefCount!==topCount) throw new Error('requestedCount must match creative_brief.requestedCount');
      if(![3,4,5].includes(briefCount??topCount??3)) throw new Error('Concept sprint requires targetCount 3, 4, or 5');
      if(!input.imageProviderId||typeof hasImageProvider!=='function'||!await hasImageProvider(input.imageProviderId,{run})) throw new Error('Concept sprint needs an installed, authorized image provider');
      await rootFor(run);
    }
    if(graphId==='concept-to-web-design') {
      const set=await inputArtifact(input,'conceptSetRef','concept_set',{run}),selection=await inputArtifact(input,'conceptSelectionRef','concept_selection',{run});
      await verifyExternalSetImages(set);
      if(!validateSelection(selection.payload,set.payload).valid) throw new Error('Web design needs a current selection bound to the exact set, concept, version, and image digest');
      const authors=await getArtifactProvenance?.(input.conceptSelectionRef,{run});
      if(!Array.isArray(authors)||!authors.some(item=>item.kind==='human'&&item.roles?.includes('human-owner'))) throw new Error('Concept selection must be an authenticated human-owner preference record');
    }
    if(graphId==='saas-feature-design') {
      await inputArtifact(input,'designBaselineRef','design_baseline',{run});
      if(!Array.isArray(input.beContracts)||!input.beContracts.length||!input.beContracts.every(isRef)) throw new Error('SaaS design needs exact versioned BE contract references');
      for(const ref of input.beContracts) {
        if(ref.kind!=='be_contract'||!/^[a-f0-9]{64}$/.test(ref.digest??'')) throw new Error('Every pinned BE contract ref must include kind=be_contract and its exact SHA-256 digest');
        await externalRecord(ref,'be_contract',{run,input});
      }
    }
    if(graphId==='design-system-evolution') {
      if(input.designBaselineRef&&input.bootstrapRef) throw new Error('Choose an existing design baseline or an explicit bootstrap context, not both');
      if(input.designBaselineRef) await inputArtifact(input,'designBaselineRef','design_baseline',{run});
      else {
        if(!isRef(input.bootstrapRef)||!['brand_baseline','concept_selection'].includes(input.bootstrapRef.kind)) throw new Error('Design-system bootstrap needs a pinned brand_baseline or concept_selection reference');
        const bootstrap=await externalRecord(input.bootstrapRef,input.bootstrapRef.kind,{run,input});
        if(input.bootstrapRef.kind==='concept_selection') {
          const set=await inputArtifact(input,'conceptSetRef','concept_set',{run});
          await verifyExternalSetImages(set);
          if(!validateSelection(bootstrap.payload,set.payload).valid) throw new Error('Bootstrap concept selection must bind the exact current concept set');
          const authors=await getArtifactProvenance?.(input.bootstrapRef,{run});
          if(!Array.isArray(authors)||!authors.some(author=>author.kind==='human'&&author.roles?.includes('human-owner'))) throw new Error('Bootstrap concept selection must be authenticated human preference');
        }
      }
    }
    if(graphId==='brand-campaign-assets'||['logo-concept-design','brand-identity-kit','brand-asset-adoption','brand-guidelines','brand-packaging-brief','brand-rollout-plan'].includes(graphId)) await inputArtifact(input,'brandBaselineRef','brand_baseline',{run});
    if(['brand-architecture-naming','logo-concept-design','brand-identity-kit','brand-asset-adoption','brand-guidelines','brand-packaging-brief','brand-rollout-plan'].includes(graphId)) {
      if(input.brandLanguage!==undefined&&input.brandLanguage!=='en') throw new Error('Brand workflows currently support English only');
      if(typeof input.projectId!=='string'||!input.projectId.trim()) throw new Error('Brand workflow requires projectId');
      if(typeof loadBrandContext!=='function') throw new Error('Trusted brand context loader is not configured');
      const records=await loadBrandContext({projectId:input.projectId,graphId,actor:null,run});
      const current=buildBrandContextSnapshot({projectId:input.projectId,facts:records?.facts,decisionRefs:records?.decisionRefs});
      if(stableJson(current)!==stableJson(input.brand_context_snapshot)) throw new Error('Pinned brand context differs from the current trusted project snapshot');
    }
    if(graphId==='brand-identity-kit') {
      const set=await inputArtifact(input,'logoCandidateSetRef','logo_candidate_set',{run}),selection=await inputArtifact(input,'logoSelectionRef','logo_concept_selection',{run});
      if(!set.artifactRoot) throw new Error('Selected logo set needs a trusted artifact root');
      for(const candidate of set.payload.candidates) {
        const {realCandidate}=await insideRoot(set.artifactRoot,candidate.svg.path),bytes=await readFile(realCandidate);
        if(digest(bytes)!==candidate.svg.digest||!inspectLogoSvg(bytes).valid) throw new Error('Selected logo set SVG bytes do not match the accepted candidate');
      }
      const authors=await getArtifactProvenance?.(input.logoSelectionRef,{run});
      const owner=Array.isArray(authors)&&authors.some(item=>item.kind==='human'&&item.roles?.includes('human-owner'));
      const delegated=!owner&&typeof authorizeBrandSelection==='function'&&await authorizeBrandSelection({selection:selection.payload,authors,actor:null,input,run});
      if(!owner&&!delegated) throw new Error('Logo selection requires authenticated owner choice or verified delegation');
    }
    if(graphId==='brand-asset-adoption') {
      const kit=await inputArtifact(input,'brandKitRef','brand_identity_kit',{run}),review=await inputArtifact(input,'brandKitReviewRef','brand_identity_kit_review',{run});
      const context=await externalRecord(kit.payload.contextRef,'identity_kit_context',{run,input});
      if(!sameRef(context.payload.brandBaselineRef,input.brandBaselineRef)||!sameRef(review.payload.kitRef,kit)||review.payload.disposition!=='accepted'||review.payload.findings?.some(item=>!['resolved','accepted-exception'].includes(item.status))) throw new Error('Brand adoption requires a reviewed kit based on the current baseline');
      await verifyBrandKitAssets(kit);
    }
    if(graphId==='design-assurance') {
      if(!Array.isArray(input.reviewSubjectRefs)||!input.reviewSubjectRefs.length||!input.reviewSubjectRefs.every(isRef)) throw new Error('Design assurance needs exact reviewSubjectRefs before review begins');
      for(const ref of input.reviewSubjectRefs) {
        await externalRecord(ref,ref.kind??'design_artifact',{run,input});
        const provenance=await getArtifactProvenance?.(ref,{run});
        if(!Array.isArray(provenance)||!provenance.some(item=>typeof item.executionId==='string'&&item.executionId)) throw new Error('Design assurance subject has no trusted author provenance');
      }
    }
    if(graphId==='minor-ui-change'&&(!isRef(input.designBaselineRef)||!isRef(input.requirementsRef))) throw new Error('Minor UI change needs exact pinned designBaselineRef and requirementsRef');
    if(graphId==='product-design-discovery'&&!isRef(input.requirementsRef)) throw new Error('Product design discovery needs an exact pinned requirementsRef');
    if(graphId==='ui-candidate-sprint') await inputArtifact(input,'productDesignDirectionRef','product_design_direction',{run});
    if(graphId==='ui-prototype-experiment') await inputArtifact(input,'uiCandidateSetRef','ui_candidate_set',{run});
  }

  async function validateRun({run,decisions}={}) {
    const issues=[],validatedSubjectRefs=[];
    const addIssue=(code,path,message,action)=>issues.push({code,path,message,action});
    if(!run||run.packId!=='creative-team'||!run.graph||!run.nodeStates) {
      addIssue('creative-run-invalid','run','Snapshot is not a Creative run with graph state.','Load the exact persisted Creative run snapshot and retry.');
      return {valid:false,issues,validatedSubjectRefs};
    }
    if(!Array.isArray(decisions)) {
      addIssue('decision-snapshot-missing','decisions','Recovery validation requires the exact decision-record snapshot.','Load the run decision records and pass them unchanged to validateRun.');
      return {valid:false,issues,validatedSubjectRefs};
    }
    const lineage=createArtifactLineage(run),activeStatuses=new Set(['completed','awaiting_self_review','awaiting_supervisor_review']);
    const currentRefs=new Map();
    const collectRefs=(value,key='',pathName='')=>{
      if(Array.isArray(value)) { value.forEach((item,index)=>collectRefs(item,key,`${pathName}[${index}]`)); return; }
      if(!value||typeof value!=='object') return;
    if(/Refs?$/.test(key)&&isRef(value)) { currentRefs.set(`${value.kind??''}:${refId(value)}@${value.version}:${value.digest??''}`,{ref:value,path:pathName}); return; }
      for(const [childKey,child] of Object.entries(value)) collectRefs(child,childKey,pathName?`${pathName}.${childKey}`:childKey);
    };
    collectRefs(run.input,'input','input');
    try { await validateStartInput(run); }
    catch(error) { addIssue('start-input-invalid','input',String(error.message??error),'Restore the exact start inputs and trusted upstream records, or start a new run with valid pinned inputs.'); }
    if(Array.isArray(run.input?.beContracts)) for(const ref of run.input.beContracts) {
      if(!isRef(ref)||ref.kind!=='be_contract'||!/^[a-f0-9]{64}$/.test(ref.digest??'')) addIssue('be-contract-reference-invalid','input.beContracts','Every BE contract must retain exact kind, id, version, and SHA-256 digest.','Pin each BE contract to its exact immutable artifact record.');
      else currentRefs.set(`be_contract:${refId(ref)}@${ref.version}:${ref.digest}`,{ref,path:'input.beContracts'});
    }
    for(const node of run.graph.nodes) {
      const state=run.nodeStates[node.id],attempt=state?.attempts?.at(-1);
      if(!state||!activeStatuses.has(state.status)) continue;
      if(!attempt) {
        addIssue('current-attempt-missing',`nodeStates.${node.id}.attempts`,'Active node state has no current persisted attempt.','Restore the exact current attempt or restart this workflow; recovery cannot certify output from a missing attempt.');
        continue;
      }
      if(node.type==='task') {
        const payloads=attempt.output?.creativeArtifacts??{};
        if(stableJson(state.output?.creativeArtifacts??{})!==stableJson(payloads)) addIssue('node-output-mismatch',`nodeStates.${node.id}.output.creativeArtifacts`,'Operational node output differs from the current attempt payload; downstream routes may read the stale or altered state output.','Restore the node output from its current attempt or rerun the producing node.');
        const activeArtifacts=state.artifacts??[];
        for(const kind of node.produces??[]) {
          const artifact=[...activeArtifacts].reverse().find(item=>item.kind===kind);
          const payload=payloads[kind];
          const attemptArtifact=[...(attempt.artifacts??[])].reverse().find(item=>item.kind===kind);
          if(!artifact||!attemptArtifact||artifact.id!==attemptArtifact.id||artifact.version!==attemptArtifact.version||!payload||payload.id!==artifact.id||payload.version!==artifact.version) {
            addIssue('current-artifact-mismatch',`nodeStates.${node.id}.artifacts.${kind}`,'Current output is missing or does not match the active attempt artifact envelope.','Restore the exact current artifact payload or rerun the producing node.');
            continue;
          }
          try {
            assertCreativeArtifact(/^concept_image_\d\d$/.test(kind)?'concept_candidate':kind,payload);
            validatedSubjectRefs.push({id:artifact.id,version:artifact.version,kind});
          } catch(error) { addIssue('artifact-schema-invalid',`nodeStates.${node.id}.attempts.current.output.creativeArtifacts.${kind}`,String(error.message??error),'Repair the payload and submit a new artifact version.'); }
          collectRefs(payload,kind,`nodeStates.${node.id}.output.${kind}`);
        }
        try { lineage.submission(node.id,Object.fromEntries((node.produces??[]).filter(kind=>payloads[kind]).map(kind=>[kind,payloads[kind]]))); }
        catch(error) { addIssue('artifact-lineage-invalid',`nodeStates.${node.id}.output`,String(error.message??error),'Rerun the producer with references to the exact current upstream artifacts.'); }
        try {
          for(const kind of node.produces??[]) {
            const payload=payloads[kind]; if(!payload) continue;
            if(/^concept_image_\d\d$/.test(kind)) await verifyImage(run,kind,payload);
            if(kind==='concept_set') for(const candidate of payload.candidates??[]) await verifyImage(run,kind,candidate);
            if(kind==='concept_gallery') await verifyGallery(run,payload,latestPayload(run,'freeze-concept-set','concept_set'));
            if(kind==='logo_candidate_set') for(const candidate of payload.candidates??[]) await verifyBrandSvg(run,candidate);
            if(kind==='brand_identity_kit') for(const asset of payload.assetRefs??[]) {
              const {realCandidate}=await insideRoot(await rootFor(run),asset.path);
              if(digest(await readFile(realCandidate))!==asset.digest) throw new Error('Identity kit asset bytes differ from pinned digest');
            }
          }
        } catch(error) { addIssue('artifact-bytes-invalid',`nodeStates.${node.id}.artifacts`,String(error.message??error),'Restore trusted artifact bytes or resubmit from the configured artifact store.'); }
        if(node.id==='disposition') {
          const report=payloads.design_review,subject=latestPayload(run,'pin-review-subject','review_subject');
          const visual=latestPayload(run,'visual-review','visual_review_findings'),behavior=latestPayload(run,'behavior-review','behavior_review_findings');
          const equalRefs=(left,right)=>Array.isArray(left)&&Array.isArray(right)&&left.length===right.length&&left.every((ref,index)=>sameRef(ref,right[index])&&ref.digest===right[index].digest);
          const findings=[...(visual?.findings??[]),...(behavior?.findings??[])];
          if(!report||!subject||!visual||!behavior||!equalRefs(report.subjectRefs,subject.subjectRefs)||!equalRefs(visual.subjectRefs,subject.subjectRefs)||!equalRefs(behavior.subjectRefs,subject.subjectRefs)||stableJson(report.findings??[])!==stableJson(findings)||stableJson(report.subjectAuthorExecutionIds??[])!==stableJson(subject.subjectAuthorExecutionIds??[])||report.reviewerExecutionId!==attempt.actor?.executionId||!attempt.actor?.executionId||subject.subjectAuthorExecutionIds?.includes(attempt.actor.executionId)) addIssue('design-assurance-invalid',`nodeStates.${node.id}.output.design_review`,'Disposition does not preserve current frozen subjects, source findings, trusted authors, or independent reviewer identity.','Rerun source reviews against the frozen subjects; then submit a disposition preserving their findings.');
        }
        if(node.id==='pin-review-subject') {
          const subject=payloads.review_subject,authors=new Set();
          try {
            if(typeof getArtifactProvenance!=='function') throw new Error('Trusted artifact provenance resolver is not configured');
            for(const ref of subject?.subjectRefs??[]) {
              const local=exactRecord(run,ref);
              if(local) { if(local.attempt.actor?.executionId) authors.add(local.attempt.actor.executionId); }
              else {
                await externalRecord(ref,ref.kind??'design_artifact',{run,input:run.input});
                const provenance=await getArtifactProvenance(ref);
                if(!Array.isArray(provenance)||!provenance.some(item=>typeof item.executionId==='string'&&item.executionId)) throw new Error('External subject has no trusted author execution provenance');
                for(const item of provenance) if(item.executionId) authors.add(item.executionId);
              }
            }
            const actual=[...(subject?.subjectAuthorExecutionIds??[])].sort(),expected=[...authors].sort();
            if(!expected.length||stableJson(actual)!==stableJson(expected)) throw new Error('Pinned author identities differ from trusted provenance');
          } catch(error) { addIssue('design-assurance-provenance-invalid',`nodeStates.${node.id}.output.review_subject`,String(error.message??error),'Restore exact subject records/provenance and repin the frozen review subjects.'); }
        }
        if(node.id==='visual-review'||node.id==='behavior-review') {
          const kind=node.id==='visual-review'?'visual_review_findings':'behavior_review_findings';
          const review=payloads[kind],subject=latestPayload(run,'pin-review-subject','review_subject');
          const equalRefs=(left,right)=>Array.isArray(left)&&Array.isArray(right)&&left.length===right.length&&left.every((ref,index)=>sameRef(ref,right[index])&&ref.digest===right[index].digest);
          if(!review||!equalRefs(review.subjectRefs,subject?.subjectRefs)||!attempt.actor?.executionId||review.reviewerExecutionId!==attempt.actor.executionId||subject?.subjectAuthorExecutionIds?.includes(attempt.actor.executionId)) addIssue('design-assurance-review-invalid',`nodeStates.${node.id}.output.${kind}`,'Review does not cite the current frozen subjects or authenticated independent reviewer.','Rerun this source review with a trusted independent execution.');
        }
      }
      if(node.type==='decision'&&state.outcome!==undefined&&state.outcome!==null) {
        const decision=decisions.find(item=>item.id===attempt.decisionId&&item.runId===run.id&&item.nodeId===node.id&&item.status==='decided'&&item.outcome===state.outcome);
        if(!decision) { addIssue('decision-record-mismatch',`nodeStates.${node.id}.outcome`,'Current route has no matching persisted decision record.','Restore the current decision record or reapply the decision through the trusted wrapper.'); continue; }
        try {
          lineage.decision(node.id,state.outcome);
          const currentEvidence=await requireDecisionEvidence(run,node.id,state.outcome,decisions);
          if(stableJson(currentEvidence)!==stableJson(decision.evidence??[])) throw new Error('Persisted decision evidence no longer matches current trusted evidence');
          collectRefs(decision.evidence??[],'evidence',`decisions.${decision.id}.evidence`);
        } catch(error) { addIssue('decision-evidence-invalid',`decisions.${decision.id}.evidence`,String(error.message??error),'Restore trusted current evidence or rerun the decision with its required evidence.'); }
      }
    }
    for(const {ref,path:refPath} of currentRefs.values()) {
      const local=exactRecord(run,ref);
      if(local) {
        if(ref.kind&&ref.kind!==local.item.kind) addIssue('local-reference-kind-mismatch',refPath,'Reference kind differs from the exact local artifact record.','Update the reference kind to match the producing artifact.');
        if(ref.digest) {
          const observed=local.payload&&digest(Buffer.from(stableJson(local.payload)));
          if(!observed||ref.digest!==observed) addIssue('local-reference-digest-mismatch',refPath,'Reference digest does not match the canonical exact local artifact payload.','Update the reference to the current artifact digest or rerun its producer.');
        }
        continue;
      }
      if(!ref.kind) { addIssue('external-reference-kind-missing',refPath,'External artifact reference has no trusted artifact kind.','Pin an exact external artifact kind, id, version, and digest.'); continue; }
      try {
        const row=await externalRecord(ref,ref.kind,{run,input:run.input});
        if(row.kind==='concept_set') await verifyExternalSetImages(row);
        validatedSubjectRefs.push({id:row.id,version:row.version,kind:row.kind,digest:row.digest});
      } catch(error) { addIssue('external-reference-invalid',refPath,String(error.message??error),'Restore this exact external artifact and trusted provenance in the host artifact store.'); }
    }
    if(!validatedSubjectRefs.length) addIssue('no-current-artifact-evidence','run.nodeStates','No current Creative artifact evidence was available to attest from this snapshot.','Continue the existing workflow normally or start a new run; this snapshot cannot be certified without persisted output evidence.');
    return {valid:issues.length===0,issues,validatedSubjectRefs};
  }

  return Object.freeze({
    validateRun,
    async startRun(args) {
      const actor=await trustedActor(args.actor,{operation:'startRun',packId:args.packId,graphId:args.graphId});
      const graph=getGraph(args.packId,args.graphId);
      if(!graph) throw new Error(`Unknown creative graph: ${args.graphId}`);
      const input={...(args.input??{})};
      if(input.creative_brief) assertCreativeArtifact('creative_brief',input.creative_brief);
      const surfaceRequired=['concept-sprint','concept-to-web-design','saas-feature-design','minor-ui-change','product-design-discovery','ui-candidate-sprint','ui-prototype-experiment'].includes(args.graphId);
      if(surfaceRequired&&!['persuade','operate','read','experience'].includes(input.creative_brief?.surfaceMode)) throw new Error(`${args.graphId} requires a concrete creative_brief.surfaceMode`);
      if(['brand-foundation','concept-sprint','concept-to-web-design','saas-feature-design','brand-campaign-assets','brand-architecture-naming','logo-concept-design','brand-identity-kit','brand-asset-adoption','brand-guidelines','brand-packaging-brief','brand-rollout-plan'].includes(args.graphId)&&!input.creative_brief) throw new Error(`${args.graphId} requires a validated creative_brief`);
      if(['brand-foundation','brand-campaign-assets'].includes(args.graphId)&&input.creative_brief?.surfaceMode!=null&&!['persuade','operate','read','experience'].includes(input.creative_brief.surfaceMode)) throw new Error('surfaceMode must be a supported mode when supplied');
      if(args.graphId==='concept-sprint') {
        const briefCount=input.creative_brief?.requestedCount,topCount=input.requestedCount;
        if(briefCount!=null&&topCount!=null&&briefCount!==topCount) throw new Error('requestedCount must match creative_brief.requestedCount');
        const count=briefCount??topCount??3;
        if(![3,4,5].includes(count)) throw new Error('Concept sprint requires targetCount 3, 4, or 5');
        input.requestedCount=count;
        input.creative_brief={...input.creative_brief,requestedCount:count};
        if(!input.imageProviderId||typeof hasImageProvider!=='function'||!await hasImageProvider(input.imageProviderId)) throw new Error('Concept sprint needs an installed, authorized image provider');
        if(!artifactRootForRun) throw new Error('Trusted artifact storage root is not configured');
      }
      if(args.graphId==='concept-to-web-design') {
        const setRecord=await inputArtifact(input,'conceptSetRef','concept_set',{actor});
        const selectionRecord=await inputArtifact(input,'conceptSelectionRef','concept_selection',{actor});
        await verifyExternalSetImages(setRecord);
        if(!validateSelection(selectionRecord.payload,setRecord.payload).valid) throw new Error('Web design needs a current selection bound to the exact set, concept, version, and image digest');
        if(typeof getArtifactProvenance!=='function') throw new Error('Trusted selection provenance resolver is required');
        const selectionAuthors=await getArtifactProvenance(input.conceptSelectionRef);
        if(!Array.isArray(selectionAuthors)||!selectionAuthors.some(author=>author.kind==='human'&&author.roles?.includes('human-owner'))) throw new Error('Concept selection must be an authenticated human-owner preference record');
        input.concept_set=setRecord.payload;
        input.concept_selection=selectionRecord.payload;
      }
      if(args.graphId==='saas-feature-design') {
        const baseline=await inputArtifact(input,'designBaselineRef','design_baseline',{actor});
        input.design_baseline=baseline.payload;
        if(!Array.isArray(input.beContracts)||!input.beContracts.length||!input.beContracts.every(isRef)) throw new Error('SaaS design needs exact versioned BE contract references');
        for(const ref of input.beContracts) {
          if(ref.kind!=='be_contract'||!/^[a-f0-9]{64}$/.test(ref.digest??'')) throw new Error('Every pinned BE contract ref must include kind=be_contract and its exact SHA-256 digest');
          await externalRecord(ref,'be_contract',{actor,input});
        }
      }
      if(args.graphId==='design-system-evolution') {
        if(input.designBaselineRef&&input.bootstrapRef) throw new Error('Choose an existing design baseline or an explicit bootstrap context, not both');
        if(input.designBaselineRef) {
          const baseline=await inputArtifact(input,'designBaselineRef','design_baseline',{actor});
          input.design_baseline=baseline.payload;
        } else {
          if(!isRef(input.bootstrapRef)||!['brand_baseline','concept_selection'].includes(input.bootstrapRef.kind)) throw new Error('Design-system bootstrap needs a pinned brand_baseline or concept_selection reference');
          const bootstrap=await externalRecord(input.bootstrapRef,input.bootstrapRef.kind,{actor,input});
          input[input.bootstrapRef.kind]=bootstrap.payload;
          if(input.bootstrapRef.kind==='concept_selection') {
            const set=await inputArtifact(input,'conceptSetRef','concept_set',{actor});
            await verifyExternalSetImages(set);
            if(!validateSelection(bootstrap.payload,set.payload).valid) throw new Error('Bootstrap concept selection must bind the exact current concept set');
            const authors=await getArtifactProvenance?.(input.bootstrapRef);
            if(!Array.isArray(authors)||!authors.some(author=>author.kind==='human'&&author.roles?.includes('human-owner'))) throw new Error('Bootstrap concept selection must be authenticated human preference');
            input.concept_set=set.payload;
          }
        }
      }
      // Strategy-only intake may have no surface. The first evidence decision routes unsupported claims to needs-evidence.
      if(args.graphId==='brand-campaign-assets') {
        const baseline=await inputArtifact(input,'brandBaselineRef','brand_baseline',{actor});
        input.brand_baseline=baseline.payload;
      }
      if(['logo-concept-design','brand-identity-kit','brand-asset-adoption','brand-guidelines','brand-packaging-brief','brand-rollout-plan'].includes(args.graphId)) {
        const baseline=await inputArtifact(input,'brandBaselineRef','brand_baseline',{actor});
        input.brand_baseline=baseline.payload;
      }
      if(['logo-concept-design','brand-identity-kit','brand-asset-adoption','brand-guidelines','brand-packaging-brief','brand-rollout-plan','brand-architecture-naming'].includes(args.graphId)) {
        const language=input.brandLanguage??'en';
        if(language!=='en') throw new Error('Brand workflows currently support English only');
        input.brandLanguage='en';
        if(typeof input.projectId!=='string'||!input.projectId.trim()||typeof loadBrandContext!=='function') throw new Error('Brand workflow requires projectId and a trusted brand context loader');
        const records=await loadBrandContext({projectId:input.projectId,graphId:args.graphId,actor});
        input.brand_context_snapshot=buildBrandContextSnapshot({projectId:input.projectId,facts:records?.facts,decisionRefs:records?.decisionRefs});
      }
      if(args.graphId==='brand-identity-kit') {
        const set=await inputArtifact(input,'logoCandidateSetRef','logo_candidate_set',{actor});
        const selection=await inputArtifact(input,'logoSelectionRef','logo_concept_selection',{actor});
        if(!set.artifactRoot) throw new Error('Selected logo set needs a trusted artifact root');
        for(const candidate of set.payload.candidates) {
          const {realCandidate}=await insideRoot(set.artifactRoot,candidate.svg.path);
          const bytes=await readFile(realCandidate);
          if(digest(bytes)!==candidate.svg.digest||!inspectLogoSvg(bytes).valid) throw new Error('Selected logo set SVG bytes do not match the accepted candidate');
        }
        const candidate=set.payload.candidates?.find(c=>c.id===selection.payload.candidateId&&c.version===selection.payload.candidateVersion);
        if(!candidate||!sameRef(selection.payload.candidateSetRef,set)) throw new Error('Logo selection must bind one exact candidate in the pinned set');
        const authors=await getArtifactProvenance?.(input.logoSelectionRef);
        const owner=Array.isArray(authors)&&authors.some(item=>item.kind==='human'&&item.roles?.includes('human-owner'));
        const delegated=!owner&&typeof authorizeBrandSelection==='function'&&await authorizeBrandSelection({selection:selection.payload,authors,actor,input});
        if(!owner&&!delegated) throw new Error('Logo selection requires authenticated owner choice or verified delegation');
        input.logo_candidate_set=set.payload; input.logo_concept_selection=selection.payload;
      }
      if(args.graphId==='brand-asset-adoption') {
        const kit=await inputArtifact(input,'brandKitRef','brand_identity_kit',{actor});
        const review=await inputArtifact(input,'brandKitReviewRef','brand_identity_kit_review',{actor});
        const context=await externalRecord(kit.payload.contextRef,'identity_kit_context',{actor,input});
        if(!sameRef(context.payload.brandBaselineRef,input.brandBaselineRef)||!sameRef(review.payload.kitRef,kit)||review.payload.disposition!=='accepted'||review.payload.findings?.some(f=>!['resolved','accepted-exception'].includes(f.status))) throw new Error('Brand adoption requires a reviewed kit based on the current baseline');
        await verifyBrandKitAssets(kit);
        input.brand_identity_kit=kit.payload; input.brand_identity_kit_review=review.payload;
      }
      if(args.graphId==='design-assurance') {
        if(!Array.isArray(input.reviewSubjectRefs)||!input.reviewSubjectRefs.length||!input.reviewSubjectRefs.every(isRef)) throw new Error('Design assurance needs exact reviewSubjectRefs before review begins');
        for(const ref of input.reviewSubjectRefs) await externalRecord(ref,ref.kind??'design_artifact',{actor,input});
      }
      if(args.graphId==='minor-ui-change') {
        if(!isRef(input.designBaselineRef)||!isRef(input.requirementsRef)) throw new Error('Minor UI change needs exact pinned designBaselineRef and requirementsRef');
      }
      if(args.graphId==='product-design-discovery'&&!isRef(input.requirementsRef)) throw new Error('Product design discovery needs an exact pinned requirementsRef');
      if(args.graphId==='ui-candidate-sprint') {
        const direction=await inputArtifact(input,'productDesignDirectionRef','product_design_direction',{actor});
        input.product_design_direction=direction.payload;
      }
      if(args.graphId==='ui-prototype-experiment') {
        const set=await inputArtifact(input,'uiCandidateSetRef','ui_candidate_set',{actor});
        input.ui_candidate_set=set.payload;
      }
      return engine.startRun({...args,input,actor});
    },

    async submitNode({runId,nodeId,actor,output={},artifacts=[],payloads={},...rest}) {
      const run=await engine.getRun(runId); if(!run||run.packId!=='creative-team') throw new Error('Creative run not found');
      const node=run.graph.nodes.find(n=>n.id===nodeId); if(!node||!['task','join','end'].includes(node.type)) throw new Error('Creative work node not found');
      actor=await trustedActor(actor,{operation:'submitNode',run,nodeId,node});
      const expectedRunDigest=snapshotDigest(run);
      if(!(await engine.getReadyNodes(runId)).some(n=>n.id===nodeId)) throw new Error('Creative task is not ready');
      if(node.independentOf?.length&&!actor.executionId) throw new Error('Independent review requires a trusted execution identity');
      if(node.type==='join'||node.type==='end') {
        if(artifacts.length||Object.keys(payloads).length) throw new Error('Automatic join/end nodes do not accept artifact payloads');
        return engine.submitNode({runId,nodeId,actor,output,...rest,expectedRunDigest});
      }
      const requiredKinds=node.produces??[];
      if(requiredKinds.length!==artifacts.length||requiredKinds.some(kind=>!artifacts.some(a=>a.kind===kind))) throw new Error(`Task ${nodeId} must submit every declared output artifact`);
      const enrichedPayloads={...payloads};
      for(const artifact of artifacts) {
        const payload=enrichedPayloads[artifact.kind];
        if(!payload) throw new Error(`Payload required for ${artifact.kind}`);
        if(payload.id!==artifact.id||payload.version!==artifact.version) throw new Error(`Artifact envelope identity differs from ${artifact.kind} payload`);
        assertCreativeArtifact(/^concept_image_\d\d$/.test(artifact.kind)?'concept_candidate':artifact.kind,payload);
        if(/^concept_image_\d\d$/.test(artifact.kind)) await verifyImage(run,artifact.kind,payload);
        if(artifact.kind==='concept_set') {
          for(const candidate of payload.candidates) await verifyImage(run,'concept_set',candidate);
        }
        if(artifact.kind==='concept_gallery') {
          const set=latestPayload(run,'freeze-concept-set','concept_set');
          if(!set) throw new Error('Gallery cannot be assembled without the reviewed concept set');
          await verifyGallery(run,payload,set);
        }
        if(artifact.kind==='logo_candidate_set') for(const candidate of payload.candidates) await verifyBrandSvg(run,candidate);
        if(artifact.kind==='brand_context_snapshot'&&(payload.projectId!==run.input.projectId||stableJson(payload.fields)!==stableJson(run.input.brand_context_snapshot?.fields))) throw new Error('Brand context must match the trusted current project snapshot');
        if(artifact.kind==='brand_identity_kit') for(const asset of payload.assetRefs) {
          const {realCandidate}=await insideRoot(await rootFor(run),asset.path);
          if(digest(await readFile(realCandidate))!==asset.digest) throw new Error('Identity kit asset bytes differ from pinned digest');
        }
        const linkKinds={
          brand_architecture_map:{contextRef:'brand_context_snapshot'},
          brand_name_candidates:{architectureRef:'brand_architecture_map'},
          brand_name_screening:{candidateRef:'brand_name_candidates'},
          brand_naming_review:{candidateRef:'brand_name_candidates',screeningRef:'brand_name_screening'},
          logo_design_brief:{brandBaselineRef:'brand_baseline'},
          logo_concept_plan:{briefRef:'logo_design_brief'},
          logo_candidate_set:{briefRef:'logo_design_brief'},
          logo_file_audit:{candidateSetRef:'logo_candidate_set'},
          logo_concept_review:{candidateSetRef:'logo_candidate_set',fileAuditRef:'logo_file_audit'},
          identity_kit_context:{brandBaselineRef:'brand_baseline',candidateSetRef:'logo_candidate_set',selectionRef:'logo_concept_selection'},
          brand_identity_options:{contextRef:'identity_kit_context'},
          brand_identity_checks:{optionsRef:'brand_identity_options'},
          brand_identity_kit:{contextRef:'identity_kit_context',optionsRef:'brand_identity_options',checksRef:'brand_identity_checks'},
          brand_identity_kit_review:{kitRef:'brand_identity_kit',checksRef:'brand_identity_checks'},
          brand_approval_context:{previousBaselineRef:'brand_baseline',kitRef:'brand_identity_kit',reviewRef:'brand_identity_kit_review'},
          guidelines_context:{brandBaselineRef:'brand_baseline'}, brand_guidelines_draft:{contextRef:'guidelines_context'},brand_guidelines_review:{draftRef:'brand_guidelines_draft'},
          packaging_context:{brandBaselineRef:'brand_baseline'},packaging_design_brief:{contextRef:'packaging_context'},packaging_brief_review:{briefRef:'packaging_design_brief'},
          brand_rollout_context:{brandBaselineRef:'brand_baseline'},brand_rollout_plan:{contextRef:'brand_rollout_context'},brand_measurement_plan:{contextRef:'brand_rollout_context'},brand_rollout_review:{rolloutRef:'brand_rollout_plan',measurementRef:'brand_measurement_plan'},
          brand_baseline:{strategyRef:'brand_strategy',identityRef:'brand_identity_system',voiceRef:'brand_voice_system'},
          web_design_package:{conceptRef:'concept_candidate',pageMapRef:'page_section_map',desktopRef:'desktop_web_design',mobileRef:'mobile_web_design',reviewRef:'web_design_review'},
          saas_design_package:{handoffRef:'creative_design_handoff',baselineRef:'design_baseline',apiContractRefs:'be_contract',stateMatrixRef:'saas_state_permission_matrix',reviewRef:'saas_design_review'},
          design_baseline:{tokensRef:'design_system_inventory',componentsRef:'design_system_change_proposal',patternsRef:'design_system_validation',migrationRef:'design_system_review'},
          campaign_asset_package:{conceptRef:'campaign_concept'},
          campaign_final_package:{brandBaselineRef:'brand_baseline',conceptRef:'campaign_concept',assetPackageRef:'campaign_asset_package',reviewRef:'campaign_review'},
          minor_ui_candidate:{contextRef:'ui_change_context'},
          minor_ui_evaluation:{candidateRef:'minor_ui_candidate',contextRef:'ui_change_context'},
          minor_ui_design_package:{candidateRef:'minor_ui_candidate',evaluationRef:'minor_ui_evaluation'},
          wireframe_a:{researchRef:'product_design_research'},
          wireframe_b:{researchRef:'product_design_research'},
          product_design_direction:{researchRef:'product_design_research'},
          pinned_ui_design_context:{productDirectionRef:'product_design_direction'},
          ui_candidate_set:{reviewRef:'ui_candidate_shortlist'},
          ui_design_selection:{candidateSetRef:'ui_candidate_set'},
        }[artifact.kind]??{};
        if(artifact.kind==='brand_baseline'&&run.graph.id==='brand-asset-adoption') {
          linkKinds.previousBaselineRef='brand_baseline'; linkKinds.kitRef='brand_identity_kit'; linkKinds.reviewRef='brand_identity_kit_review';
          const previous=run.input.brand_baseline;
          if(!sameRef(payload.previousBaselineRef,run.input.brandBaselineRef)||!sameRef(payload.kitRef,run.input.brandKitRef)||!sameRef(payload.reviewRef,run.input.brandKitReviewRef)||!sameRef(payload.strategyRef,previous.strategyRef)||!sameRef(payload.identityRef,previous.identityRef)||!sameRef(payload.voiceRef,previous.voiceRef)) throw new Error('Adopted baseline must preserve strategy and pin the exact prior baseline, kit and review');
          await verifyBrandKitAssets(await externalRecord(run.input.brandKitRef,'brand_identity_kit',{run,input:run.input,actor}));
        }
        if(/^ui_candidate_[ab]\d$/.test(artifact.kind)) linkKinds.directionRef='pinned_ui_design_context';
        if(/^frozen_ui_candidate_[ab]\d$/.test(artifact.kind)) linkKinds.candidateRef=`ui_candidate_${artifact.kind.slice('frozen_ui_candidate_'.length)}`;
        if(/^ui_candidate_review_[ab]\d$/.test(artifact.kind)) {
          const suffix=artifact.kind.slice('ui_candidate_review_'.length);
          linkKinds.candidateRefs=`frozen_ui_candidate_${suffix}`;
          linkKinds.directionRef='pinned_ui_design_context';
        }
        for(const [field,kind] of Object.entries(linkKinds)) {
          const value=payload[field];
          for(const ref of Array.isArray(value)?value:[value]) await verifyRef(run,ref,kind,{actor});
        }
        if(['brand_baseline','design_baseline','campaign_final_package','minor_ui_design_package','product_design_direction','ui_candidate_set','ui_design_selection'].includes(artifact.kind)) {
          const decisionByKind={
            brand_baseline:run.graph.id==='brand-asset-adoption'?{decisionNode:'adopt-brand-assets',outcome:'adopt'}:{decisionNode:'brand-disposition',outcome:'ready'}, design_baseline:{decisionNode:'system-disposition',outcome:'accepted'},
            campaign_final_package:{decisionNode:'campaign-disposition',outcome:'ready'}, minor_ui_design_package:{decisionNode:'minor-disposition',outcome:'accepted'},
            product_design_direction:{decisionNode:'promote-directions'}, ui_candidate_set:{decisionNode:'candidate-disposition',outcome:'ready'},
            ui_design_selection:{decisionNode:'select-final-ui',outcome:'selected'},
          };
          const {decisionNode,outcome}=decisionByKind[artifact.kind];
          const expected=await requireDecision(run,decisionNode,outcome),actual=payload.decisionRef;
          if(!isRef(actual)||refId(actual)!==expected.id||actual.version!==expected.version) throw new Error(`${artifact.kind} must reference the exact accepted decision record`);
        }
      }
      if(nodeId==='review-set') {
        const review=payloads.concept_set_review;
        if(!review||!['complete','incomplete','blocked'].includes(review.disposition)) throw new Error('Concept review needs an explicit disposition');
        const renderRows=run.graph.nodes.filter(n=>/^render-\d\d$/.test(n.id)&&run.nodeStates[n.id]?.status==='completed').map(n=>({node:n,payload:latestPayload(run,n.id,`concept_image_${n.id.slice(-2)}`)}));
        const refs=review.candidateRefs??[];
        if(review.disposition==='complete'&&renderRows.length!==requestedCount(run)) throw new Error('Review cannot mark an incomplete render set complete');
        if(refs.length!==renderRows.length) throw new Error('Review must account for every completed render candidate');
        for(const row of renderRows) {
          if(!row.payload) throw new Error(`Render node ${row.node.id} is missing its saved candidate payload`);
          const ref=refs.find(item=>refId(item)===row.payload.id&&item.version===row.payload.version);
          if(!ref) throw new Error(`Review omits candidate ${row.payload.id}@${row.payload.version}`);
          if(review.disposition==='complete') await verifyImage(run,row.node.id,row.payload);
        }
      }
      if(nodeId==='freeze-concept-set') {
        const review=latestPayload(run,'review-set','concept_set_review'),set=payloads.concept_set;
        if(review?.disposition!=='complete') throw new Error('A canonical concept set can only be frozen after a complete review');
        if(!set||set.requestedCount!==requestedCount(run)||set.candidates.length!==requestedCount(run)) throw new Error('Frozen concept set must match the requested cardinality');
        const refs=asRefs(set.candidates).map(item=>`${item.id}@${item.version}`).sort();
        if(refs.join('|')!==review.candidateRefs.map(item=>`${refId(item)}@${item.version}`).sort().join('|')) throw new Error('Frozen concept set differs from reviewed candidate versions');
        await Promise.all(set.candidates.map(candidate=>verifyImage(run,'concept_set',candidate)));
      }
      if(nodeId==='pin-review-subject') {
        const subject=enrichedPayloads.review_subject;
        if(!subject?.subjectRefs?.length) throw new Error('Design assurance needs exact review subject references');
        if(typeof getArtifactProvenance!=='function') throw new Error('Trusted artifact provenance resolver is required for external design subjects');
        const authors=new Set();
        for(const ref of subject.subjectRefs) {
          const local=exactRecord(run,ref);
          if(local) {
            const executionId=local.attempt.actor?.executionId;
            if(executionId) authors.add(executionId);
          } else {
            await externalRecord(ref,ref.kind,{run,input:run.input,actor});
            const provenance=await getArtifactProvenance(ref);
            if(!Array.isArray(provenance)||!provenance.some(row=>typeof row.executionId==='string')) throw new Error('External review subject has no trusted author execution provenance');
            for(const row of provenance) if(row.executionId) authors.add(row.executionId);
          }
        }
        if(!authors.size) throw new Error('Review subject author provenance is empty');
        enrichedPayloads.review_subject={...subject,subjectAuthorExecutionIds:[...authors]};
      }
      if(node.independentOf?.length) {
        const authorIds=[...new Set(node.independentOf.flatMap(refNode=>[
          ...(run.nodeStates[refNode]?.attempts??[]).map(attempt=>attempt.actor?.executionId).filter(Boolean),
          ...(latestPayload(run,refNode,'review_subject')?.subjectAuthorExecutionIds??[]),
        ]))];
        for(const id of authorIds) if(id===actor.executionId) throw new Error('Independent reviewer execution must differ from candidate authors');
        for(const artifact of artifacts) if(enrichedPayloads[artifact.kind]?.subjectAuthorExecutionIds) enrichedPayloads[artifact.kind]={...enrichedPayloads[artifact.kind],subjectAuthorExecutionIds:authorIds};
        for(const artifact of artifacts) if(enrichedPayloads[artifact.kind]?.reviewerExecutionId) {
          if(enrichedPayloads[artifact.kind].reviewerExecutionId!==actor.executionId) throw new Error('Reviewer identity must come from the trusted Core actor context');
          enrichedPayloads[artifact.kind]={...enrichedPayloads[artifact.kind],reviewerExecutionId:actor.executionId};
        }
      }
      if(nodeId==='visual-review'||nodeId==='behavior-review') {
        const reviewPayload=enrichedPayloads[node.produces?.[0]];
        if(!reviewPayload?.subjectRefs?.length) throw new Error('Design assurance review needs exact subject references');
        const subject=latestPayload(run,'pin-review-subject','review_subject');
        if(!subject?.subjectAuthorExecutionIds?.length) throw new Error('Design assurance review needs trusted subject author provenance');
        const authorIds=subject.subjectAuthorExecutionIds;
        if(authorIds.includes(actor.executionId)) throw new Error('Reviewer execution must differ from external candidate authors');
        enrichedPayloads[node.produces[0]]={...reviewPayload,subjectAuthorExecutionIds:authorIds,reviewerExecutionId:actor.executionId};
      }
      if(nodeId==='disposition') {
        const report=enrichedPayloads.design_review;
        const subject=latestPayload(run,'pin-review-subject','review_subject');
        const visual=latestPayload(run,'visual-review','visual_review_findings');
        const behavior=latestPayload(run,'behavior-review','behavior_review_findings');
        const equalRefs=(left,right)=>Array.isArray(left)&&Array.isArray(right)&&left.length===right.length&&left.every((ref,index)=>sameRef(ref,right[index])&&ref.digest===right[index].digest);
        if(!report||!subject||!visual||!behavior||!equalRefs(report.subjectRefs,subject.subjectRefs)||!equalRefs(visual.subjectRefs,subject.subjectRefs)||!equalRefs(behavior.subjectRefs,subject.subjectRefs)) throw new Error('Design assurance disposition must cite the exact pinned subjects from both current reviews');
        const findings=[...(visual.findings??[]),...(behavior.findings??[])];
        if(stableJson(report.findings??[])!==stableJson(findings)) throw new Error('Design assurance disposition must preserve every finding and disposition from both current reviews');
        if(!actor.executionId||subject.subjectAuthorExecutionIds?.includes(actor.executionId)) throw new Error('Design assurance disposition actor must be independent from pinned subject authors');
        enrichedPayloads.design_review={...report,subjectAuthorExecutionIds:subject.subjectAuthorExecutionIds,reviewerExecutionId:actor.executionId};
      }
      createArtifactLineage(run).submission(nodeId,enrichedPayloads);
      const enriched={...output,creativeArtifacts:enrichedPayloads};
      return engine.submitNode({runId,nodeId,actor,output:enriched,artifacts,...rest,expectedRunDigest});
    },

    async decideNode({runId,nodeId,actor,outcome,...rest}) {
      const run=await engine.getRun(runId); if(!run||run.packId!=='creative-team') throw new Error('Creative run not found');
      actor=await trustedActor(actor,{operation:'decideNode',run,nodeId,outcome});
      const node=run.graph.nodes.find(n=>n.id===nodeId); if(!node||node.type!=='decision') throw new Error('Creative decision node not found');
      if(!(await engine.getReadyNodes(runId)).some(n=>n.id===nodeId)) throw new Error('Creative decision is not ready');
      if(nodeId==='adopt-brand-assets'&&(actor.kind!=='human'||!actor.roles.includes('human-owner'))) throw new Error('Formal brand asset adoption requires an authenticated human owner');
      const evidence=await requireDecisionEvidence(run,nodeId,outcome);
      const expectedRunDigest=snapshotDigest(run);
      return engine.decideNode({runId,nodeId,actor,outcome,...rest,evidence,expectedRunDigest});
    },
    async resolveHumanGate({runId,nodeId,actor,outcome,...rest}) {
      const run=await engine.getRun(runId); if(!run||run.packId!=='creative-team') throw new Error('Creative run not found');
      actor=await trustedActor(actor,{operation:'resolveHumanGate',run,nodeId,outcome});
      const node=run.graph.nodes.find(n=>n.id===nodeId); if(!node||node.type!=='decision') throw new Error('Creative decision node not found');
      if(run.status!=='paused'||run.pendingHuman?.kind!=='decision'||run.pendingHuman.nodeId!==nodeId) throw new Error('Creative decision is not waiting for a human');
      if(actor.kind!=='human'||!actor.roles.includes('human-owner')) throw new Error('Human owner decision required');
      if(nodeId==='adopt-brand-assets'&&(actor.kind!=='human'||!actor.roles.includes('human-owner'))) throw new Error('Formal brand asset adoption requires an authenticated human owner');
      const decisions=await engine.listDecisions({runId});
      const evidence=await requireDecisionEvidence(run,nodeId,outcome,decisions);
      const expectedRunDigest=snapshotDigest(run);
      return engine.resolveHumanGate({runId,nodeId,actor,outcome,...rest,evidence,expectedRunDigest});
    },
    async recordSelfReview({runId,nodeId,actor,findings=[],fixes=[],artifactVersion,revisedArtifact=null,revisedPayload,revisedOutput:callerRevisedOutput,evidence=[],...rest}) {
      if(callerRevisedOutput!==undefined) throw new Error('revisedOutput is host-owned; submit revisedPayload with its artifact envelope');
      const run=await engine.getRun(runId); if(!run||run.packId!=='creative-team') throw new Error('Creative run not found');
      actor=await trustedActor(actor,{operation:'recordSelfReview',run,nodeId});
      const nodeState=run.nodeStates[nodeId],attempt=nodeState?.attempts?.at(-1);
      if(!attempt||attempt.actor?.id!==actor.id||attempt.actor?.executionId!==actor.executionId) throw new Error('Self review must use the authenticated producing actor and execution');
      let revisedOutput;
      if(revisedArtifact) {
        if(typeof revisedArtifact.kind!=='string'||typeof revisedArtifact.id!=='string'||typeof revisedArtifact.version!=='string') throw new Error('Creative revised artifact needs kind, id, and version');
        const current=[...(nodeState.artifacts??[])].reverse().find(item=>item.kind===revisedArtifact.kind);
        if(!current||revisedArtifact.id!==current.id||revisedArtifact.version===current.version) throw new Error('Revised artifact must preserve current identity and use a new version');
        if(!revisedPayload||revisedPayload.id!==revisedArtifact.id||revisedPayload.version!==revisedArtifact.version) throw new Error(`Revised artifact envelope identity differs from ${revisedArtifact.kind} payload`);
        assertCreativeArtifact(/^concept_image_\d\d$/.test(revisedArtifact.kind)?'concept_candidate':revisedArtifact.kind,revisedPayload);
        if(/^concept_image_\d\d$/.test(revisedArtifact.kind)) await verifyImage(run,revisedArtifact.kind,revisedPayload);
        if(revisedArtifact.kind==='logo_candidate_set') for(const candidate of revisedPayload.candidates) await verifyBrandSvg(run,candidate);
        if(revisedArtifact.kind==='brand_identity_kit') for(const asset of revisedPayload.assetRefs) {
          const {realCandidate}=await insideRoot(await rootFor(run),asset.path);
          if(digest(await readFile(realCandidate))!==asset.digest) throw new Error('Identity kit asset bytes differ from pinned digest');
        }
        createArtifactLineage(run).submission(nodeId,{[revisedArtifact.kind]:revisedPayload});
        revisedOutput={...attempt.output,creativeArtifacts:{...(attempt.output?.creativeArtifacts??{}),[revisedArtifact.kind]:revisedPayload}};
      } else if(revisedPayload!==undefined) throw new Error('revisedPayload requires a revisedArtifact envelope');
      const expectedRunDigest=snapshotDigest(run);
      return engine.recordSelfReview({runId,nodeId,actor,findings,fixes,artifactVersion,revisedArtifact,revisedOutput,evidence,...rest,expectedRunDigest});
    },
  });
}
