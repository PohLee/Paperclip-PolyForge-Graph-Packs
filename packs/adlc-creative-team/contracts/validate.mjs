import { validateConceptSet } from '../adapters/concept-gallery/index.mjs';
import { validateInterviewArtifact } from '../adapters/interview/index.mjs';

const text = value => typeof value === 'string' && value.trim().length > 0;
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const list = value => Array.isArray(value) && value.length > 0;
const ref = value => object(value) && text(value.id ?? value.artifactId) && text(value.version);
const required = {
  context_inventory:['summary','sources'], clarification_record:['questions','knownAnswers'], creative_brief:['objective','audience'],
  product_design_research:['id','version','briefRef','sources','needs','constraints','unknowns'],
  wireframe_direction:['id','version','researchRef','thesis','artifactRef'],
  direction_review:['id','version','directionRefs','criteria','disposition','findings','reviewerExecutionId','subjectAuthorExecutionIds'],
  product_design_direction:['id','version','researchRef','selectedDirectionRefs','reviewRefs','decisionRef'],
  ui_change_context:['id','version','briefRef','designBaselineRef','requirementsRef'],
  minor_ui_candidate:['id','version','contextRef','states','source'],
  minor_ui_evaluation:['id','version','candidateRef','contextRef','reviewerExecutionId','disposition','findings'],
  minor_ui_design_package:['id','version','candidateRef','evaluationRef','decisionRef','changes'],
  pinned_ui_design_context:['id','version','briefRef','productDirectionRef'],
  ui_candidate:['id','version','directionRef','thesis','surface','states','source'],
  frozen_ui_candidate:['id','version','candidateRef','digest'],
  ui_candidate_review:['id','version','candidateRefs','directionRef','reviewerExecutionId','subjectAuthorExecutionIds','disposition','findings'],
  ui_candidate_shortlist:['id','version','candidateRefs','reviewRefs','criteria','rejectionReasons'],
  ui_candidate_set:['id','version','directionRef','candidateRefs','reviewRef','decisionRef'],
  pinned_ui_finalists:['id','version','candidateSetRef','candidateRefs','criteria'],
  ui_prototype:['id','version','candidateRef','prototypeRef','evaluationTasks'],
  ui_prototype_comparison:['id','version','candidateRefs','prototypeRefs','criteria','findings','reviewerExecutionId'],
  ui_no_prototype_record:['id','version','candidateRefs','criteria','reason'],
  ui_design_selection:['id','version','selectedCandidateRef','candidateSetRef','selectionEvidenceRef','decisionRef'],
  concept_sprint_brief:['id','version','briefRef','requestedCount','explorationMode','comparisonCriteria'], concept_plan:['id','version','hypotheses'],
  concept_candidate:['id','version','title','thesis','description','choices','fit','tradeoff','image','provider'],
  concept_selection:['id','version','kind','type','disposition','setId','setVersion','candidateId','candidateVersion','imageDigest','selectedBy','createdAt'],
  concept_set_review:['id','version','disposition','candidateRefs','findings'], concept_gallery:['id','version','path','digest','setRef','candidateRefs'],
  direction_contract:['id','version','conceptRef','invariants'], page_section_map:['id','version','conceptRef','pages'],
  desktop_web_design:['id','version','conceptRef','pageRef','sections','source'], mobile_web_design:['id','version','conceptRef','pageRef','sections','source'],
  web_design_review:['id','version','conceptRef','pageMapRef','desktopRef','mobileRef','disposition','findings','reviewerExecutionId','subjectAuthorExecutionIds'],
  web_design_package:['id','version','conceptRef','pageMapRef','desktopRef','mobileRef','reviewRef'],
  pinned_design_context:['id','version','designBaselineRef','requirementRef'], saas_state_permission_matrix:['id','version','states','permissions','unknowns','contractRefs'],
  be_contract_review:['id','version','contractRefs','unknowns','ownerRefs'], saas_feature_design:['id','version','baselineRef','stateMatrixRef','pages'],
  creative_design_handoff:['id','version','requirementRef','designBaselineRef','designSpecRef','acceptanceCriteria'],
  saas_design_review:['id','version','handoffRef','disposition','findings','reviewerExecutionId','subjectAuthorExecutionIds'],
  saas_design_package:['id','version','handoffRef','baselineRef','apiContractRefs','stateMatrixRef','reviewRef'],
  design_system_inventory:['id','version','baselineRef','tokens','components','consumers'],
  design_system_change_proposal:['id','version','expectedBaselineRef','changes','migrationImpact'],
  design_system_validation:['id','version','proposalRef','representativePages','findings'],
  design_system_review:['id','version','proposalRef','validationRef','disposition','findings'],
  design_baseline:['id','version','tokensRef','componentsRef','patternsRef','decisionRef','migrationRef'],
  review_subject:['id','version','subjectRefs','subjectAuthorExecutionIds','scope'],
  visual_review_findings:['id','version','subjectRefs','reviewerExecutionId','subjectAuthorExecutionIds','findings'],
  behavior_review_findings:['id','version','subjectRefs','reviewerExecutionId','subjectAuthorExecutionIds','findings'],
  design_review:['id','version','subjectRefs','reviewerExecutionId','subjectAuthorExecutionIds','scope','disposition','findings'],
  brand_evidence_ledger:['id','version','sources','claims','unknowns'], brand_strategy:['id','version','evidenceRef','audience','positioning','promise','proof'],
  brand_context_snapshot:['id','version','projectId','fields','unknowns'],
  brand_architecture_map:['id','version','contextRef','model','relationships','tradeoffs'],
  brand_name_candidates:['id','version','architectureRef','territories','candidates'],
  brand_name_screening:['id','version','candidateRef','checks','sources'],
  brand_naming_review:['id','version','candidateRef','screeningRef','disposition','findings','reviewerExecutionId'],
  logo_design_brief:['id','version','brandBaselineRef','name','scope','uses'],
  logo_concept_plan:['id','version','briefRef','concepts'],
  logo_candidate_set:['id','version','briefRef','candidates'],
  logo_concept_selection:['id','version','candidateSetRef','candidateId','candidateVersion','selectedBy'],
  logo_file_audit:['id','version','candidateSetRef','findings','disposition','reviewerExecutionId'],
  logo_concept_review:['id','version','candidateSetRef','fileAuditRef','disposition','findings','reviewerExecutionId'],
  identity_kit_context:['id','version','brandBaselineRef','candidateSetRef','selectionRef'],
  brand_identity_options:['id','version','contextRef','options'],
  brand_identity_checks:['id','version','optionsRef','language','measurements','findings','reviewerExecutionId'],
  brand_identity_kit:['id','version','contextRef','optionsRef','checksRef','language','assetRefs','tokens'],
  brand_identity_kit_review:['id','version','kitRef','checksRef','disposition','findings','reviewerExecutionId'],
  brand_approval_context:['id','version','previousBaselineRef','kitRef','reviewRef','changeSummary'],
  guidelines_context:['id','version','brandBaselineRef','assetRefs'],
  brand_guidelines_draft:['id','version','contextRef','sections','assetRefs'],
  brand_guidelines_review:['id','version','draftRef','disposition','findings','reviewerExecutionId'],
  packaging_context:['id','version','brandBaselineRef','productRefs','unknowns'],
  packaging_design_brief:['id','version','contextRef','structure','hierarchy','materials','sku'],
  packaging_brief_review:['id','version','briefRef','disposition','findings','reviewerExecutionId'],
  brand_rollout_context:['id','version','brandBaselineRef','channels','launchType'],
  brand_rollout_plan:['id','version','contextRef','phases','dependencies'],
  brand_measurement_plan:['id','version','contextRef','metrics','sources'],
  brand_rollout_review:['id','version','rolloutRef','measurementRef','disposition','findings','reviewerExecutionId'],
  brand_territories:['id','version','strategyRef','territories'], brand_identity_system:['id','version','strategyRef','territoryRef','rules','assetRefs'],
  brand_voice_system:['id','version','strategyRef','voice','messaging','factBoundaries'], brand_review:['id','version','strategyRef','identityRef','voiceRef','disposition','findings'],
  brand_baseline:['id','version','strategyRef','identityRef','voiceRef','decisionRef'], campaign_brief:['id','version','brandBaselineRef','channels','claims'],
  campaign_concept:['id','version','briefRef','brandBaselineRef','thesis','claims'], campaign_asset_package:['id','version','conceptRef','assets','sourceRefs'],
  campaign_review:['id','version','assetPackageRef','disposition','findings'],
  campaign_final_package:['id','version','brandBaselineRef','conceptRef','assetPackageRef','reviewRef','decisionRef'],
  be_contract:['id','version','digest','content'], research_evidence:['id','version','sources','claims'],
};

export function validateCreativeArtifact(kind, payload) {
  if (!text(kind)) return { valid:false,errors:['kind must be a non-empty string'] };
  if (!object(payload)) return { valid:false,errors:['payload must be an object'] };
  if (kind === 'concept_set') return validateConceptSet(payload);
  if (kind === 'interview_responses') return validateInterviewArtifact(payload);
  if (/^concept_image_\d\d$/.test(kind)) kind='concept_candidate';
  if (/^wireframe_[ab]$/.test(kind)) kind='wireframe_direction';
  if (['direction_norms_review','direction_fit_review','blind_direction_evaluation'].includes(kind)) kind='direction_review';
  if (/^frozen_ui_candidate_[ab]\d$/.test(kind)) kind='frozen_ui_candidate';
  if (/^ui_candidate_[ab]\d$/.test(kind)) kind='ui_candidate';
  if (/^ui_candidate_review_[ab]\d$/.test(kind)) kind='ui_candidate_review';
  if (/^ui_prototype_[ab]$/.test(kind)) kind='ui_prototype';
  const keys = required[kind];
  if (!keys) return { valid:false,errors:[`unknown creative artifact kind: ${kind}`] };
  const errors=[];
  if(kind==='be_contract'&&!/^[a-f0-9]{64}$/.test(payload.digest??'')) errors.push('BE contract digest must be SHA-256');
  if(kind==='concept_selection'&&payload.reason!==undefined&&typeof payload.reason!=='string') errors.push('reason must be a string when supplied');
  if(kind==='creative_brief' && payload.surfaceMode!==undefined && payload.surfaceMode!==null && !['persuade','operate','read','experience'].includes(payload.surfaceMode)) errors.push('surfaceMode is invalid');
  for (const key of keys) {
    const value=payload[key];
    if (['image','provider'].includes(key)) {
      if (!object(value)) errors.push(`${key} must be an object`);
      else if (key==='image' && (!text(value.path) || !text(value.digest) || !['image/png','image/jpeg','image/webp'].includes(value.mimeType) || value.path.startsWith('/') || value.path.includes('\\') || value.path.split('/').includes('..'))) errors.push('image must include a safe relative path, digest, and supported raster MIME type');
      continue;
    }
    if (key.endsWith('Ref') || key.endsWith('Refs') || key === 'subjectRefs' || key === 'candidateRefs') {
      if (key.endsWith('Refs') || key === 'subjectRefs' || key === 'candidateRefs') {
        if (!list(value) || value.some(item=>!ref(item))) errors.push(`${key} must contain versioned artifact references`);
      } else if (!ref(value)) errors.push(`${key} must be a versioned artifact reference`);
    } else if (['sources','claims','unknowns','questions','knownAnswers','comparisonCriteria','hypotheses','findings','invariants','pages','sections','states','permissions','ownerRefs','tokens','components','consumers','changes','representativePages','territories','rules','assetRefs','voice','messaging','factBoundaries','acceptanceCriteria','assets','channels','choices','needs','constraints','criteria','scores','rejectionReasons','evaluationTasks','baselineDelta','relationships','tradeoffs','candidates','checks','uses','concepts','options','measurements','sections','productRefs','structure','hierarchy','materials','sku','phases','dependencies','metrics'].includes(key)) {
      const mayBeEmpty=['claims','unknowns','knownAnswers','findings','questions','tokens','components','consumers','constraints','rejectionReasons','baselineDelta','tradeoffs','checks','productRefs','sku','dependencies'].includes(key);
      if (!Array.isArray(value)||(!mayBeEmpty&&!value.length)) errors.push(`${key} must be an ${mayBeEmpty?'array':'non-empty array'}`);
    } else if (key==='fields') {
      if (!object(value)) errors.push('fields must be a source-qualified object');
    } else if (['kind','type','disposition','setId','candidateId','candidateVersion','imageDigest','selectedBy','createdAt'].includes(key)) {
      if (!text(value)) errors.push(`${key} must be a non-empty string`);
      if (kind==='concept_selection'&&key==='kind'&&value!=='concept_selection') errors.push('kind must be concept_selection');
      if (kind==='concept_selection'&&key==='type'&&value!=='select') errors.push('type must be select');
      if (kind==='concept_selection'&&key==='disposition'&&value!=='preference') errors.push('selection records preference only');
    } else if (['requestedCount'].includes(key)) {
      if (![3,4,5].includes(value)) errors.push(`${key} must be 3, 4, or 5`);
    } else if (['disposition'].includes(key)) {
      if (!text(value)) errors.push(`${key} must be a non-empty disposition`);
    } else if (['reviewerExecutionId'].includes(key)) {
      if (!text(value)) errors.push(`${key} must be a non-empty trusted execution identity`);
    } else if (['subjectAuthorExecutionIds'].includes(key)) {
      if (!Array.isArray(value) || value.some(item=>!text(item))) errors.push(`${key} must be an array of trusted author execution identities`);
    } else if (['surfaceMode'].includes(key)) {
      if (!['persuade','operate','read','experience'].includes(value)) errors.push('surfaceMode is invalid');
    } else if (['explorationMode'].includes(key)) {
      if (!['brand-territory','product-structure','surface-composition'].includes(value)) errors.push('explorationMode is invalid');
    } else if (['content'].includes(key)) {
      if (!object(value)) errors.push('content must be an object containing the contract material');
    } else if (['description','title','objective','audience','summary','scope','source','positioning','promise','proof','thesis','migrationImpact','surface','reason','outcome','projectId','model','name','launchType','changeSummary'].includes(key)) {
      if (!text(value)) errors.push(`${key} must be a non-empty string`);
    } else if (!text(value)) errors.push(`${key} must be a non-empty string`);
  }
  if (payload.requestedCount && payload.candidates && payload.candidates.length !== payload.requestedCount) errors.push('candidate count must exactly equal requestedCount');
  if (kind==='brand_context_snapshot') for (const [field,item] of Object.entries(payload.fields??{})) if(!object(item)||!['approved','unconfirmed'].includes(item.status)||!ref(item.sourceRef)||(item.status==='approved'&&!ref(item.decisionRef))) errors.push(`brand context field ${field} lacks source/status/approval`);
  if (kind==='logo_design_brief'&&!['new','refresh','keep'].includes(payload.scope)) errors.push('logo scope must be new, refresh, or keep');
  if (['brand_identity_checks','brand_identity_kit'].includes(kind)&&payload.language!=='en') errors.push('brand identity production is currently English only');
  if (kind==='brand_name_screening') for(const check of Array.isArray(payload.checks)?payload.checks:[]) if(!object(check)||!['verified','conflict','unknown'].includes(check.status)||!text(check.subject)||!text(check.channel)||!text(check.checkedAt)||!ref(check.sourceRef)) errors.push('naming checks need status, subject, channel, date and source');
  if (kind==='logo_candidate_set') {
    const candidates=Array.isArray(payload.candidates)?payload.candidates:[];
    if(candidates.length!==3||new Set(candidates.map(c=>c?.id)).size!==3) errors.push('logo concept set needs three distinct candidates');
    for(const c of candidates) if(!text(c?.id)||!text(c?.version)||!text(c?.idea)||!text(c?.svg?.path)||!(/^[a-f0-9]{64}$/).test(c?.svg?.digest??'')||c.svg.path.startsWith('/')||c.svg.path.includes('\\')||c.svg.path.split('/').includes('..')) errors.push('logo candidates need safe relative SVG paths, digests and distinct ideas');
  }
  if (kind==='brand_identity_kit') for(const asset of Array.isArray(payload.assetRefs)?payload.assetRefs:[]) if(!ref(asset)||!text(asset.path)||!/^[a-f0-9]{64}$/.test(asset.digest??'')||asset.path.startsWith('/')||asset.path.includes('\\')||asset.path.split('/').includes('..')) errors.push('identity kit assets need exact refs, safe paths and SHA-256 digests');
  if (payload.disposition && ['complete','verified','accepted','ready'].includes(payload.disposition) && Array.isArray(payload.findings) && payload.findings.some(f=>!['resolved','accepted-exception'].includes(f.status))) errors.push('successful disposition cannot contain unresolved findings');
  if (payload.disposition && ['complete','verified','accepted','ready'].includes(payload.disposition) && payload.unverified === true) errors.push('successful disposition cannot mark evidence unverified');
  return { valid:errors.length===0,errors };
}

export function assertCreativeArtifact(kind,payload) {
  const result=validateCreativeArtifact(kind,payload);
  if (!result.valid) throw new Error(`Invalid ${kind} artifact: ${result.errors.join('; ')}`);
  return payload;
}
