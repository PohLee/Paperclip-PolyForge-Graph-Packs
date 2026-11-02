const task = (id, role, purpose, produces, extra = {}) => ({ id, type:'task', role, purpose, produces:[produces], ...extra });
const decision = (id, role, decisionType, outcomes) => ({ id, type:'decision', role, decisionType, outcomes });
const end = (id, output) => ({ id, type:'end', output });
const edge = (from, to, when) => when ? { from, to, when } : { from, to };
const graph = (id, nodes, edges) => ({ id, version:'0.1.0', start:nodes[0].id, nodes, edges });

export const brandGraphs = [
  graph('brand-architecture-naming', [
    task('pin-brand-context','brand-strategist','Resolve approved project facts, source status, architecture scope, and explicit unknowns.','brand_context_snapshot'),
    task('map-brand-family','brand-strategist','Choose a branded house, house of brands, endorsed, or hybrid relationship with its tradeoffs.','brand_architecture_map'),
    task('develop-name-candidates','brand-strategist','Generate and filter metaphor-led names against locale, pronunciation, existing family and naming brief.','brand_name_candidates'),
    task('screen-name-conflicts','design-researcher','Record real prior-art, target-market trademark, domain and handle checks; unavailable checks stay unknown.','brand_name_screening'),
    task('review-naming','creative-director','Review the exact current candidate and screening versions; recommend a shortlist without claiming legal clearance or adoption.','brand_naming_review',{independentOf:['develop-name-candidates']}),
    decision('naming-disposition','creative-director','brand-stage-disposition',['shortlist','needs-research','rework']),
    end('naming-shortlist','naming_shortlist_ready'),end('naming-research-needed','naming_needs_research'),end('naming-rework','naming_rework_required')
  ], [edge('pin-brand-context','map-brand-family'),edge('map-brand-family','develop-name-candidates'),edge('develop-name-candidates','screen-name-conflicts'),edge('screen-name-conflicts','review-naming'),edge('review-naming','naming-disposition'),edge('naming-disposition','naming-shortlist','shortlist'),edge('naming-disposition','naming-research-needed','needs-research'),edge('naming-disposition','naming-rework','rework')]),

  graph('logo-concept-design', [
    task('pin-logo-brief','brand-strategist','Pin the accepted brand baseline, exact name, use cases, competitors, keep/refresh/new scope and approval owner.','logo_design_brief'),
    task('explore-logo-ideas','art-director','Screen a broad one-sentence longlist and choose three meaningfully distinct concepts.','logo_concept_plan'),
    task('draw-logo-candidates','brand-identity-designer','Build three editable SVG candidates and render actual small-size, one-colour and reversed previews.','logo_candidate_set'),
    task('audit-logo-files','design-qa-accessibility','Run SVG and size checks, inspect rendered artwork, and distinguish blocking file defects from aesthetic judgement.','logo_file_audit',{independentOf:['draw-logo-candidates']}),
    task('review-logo-concepts','creative-director','Review rendered candidates against brand fit and competitor distinction, preserving exact file versions and actionable revision notes.','logo_concept_review',{independentOf:['draw-logo-candidates']}),
    decision('logo-concept-disposition','creative-director','brand-stage-disposition',['ready-for-selection','rework','blocked']),
    end('logo-concepts-ready','logo_concepts_ready'),end('logo-rework','logo_rework_required'),end('logo-blocked','logo_capability_blocked')
  ], [edge('pin-logo-brief','explore-logo-ideas'),edge('explore-logo-ideas','draw-logo-candidates'),edge('draw-logo-candidates','audit-logo-files'),edge('audit-logo-files','review-logo-concepts'),edge('review-logo-concepts','logo-concept-disposition'),edge('logo-concept-disposition','logo-concepts-ready','ready-for-selection'),edge('logo-concept-disposition','logo-rework','rework'),edge('logo-concept-disposition','logo-blocked','blocked')]),

  graph('brand-identity-kit', [
    task('pin-selected-logo','design-ops-producer','Pin an authenticated selection of one exact reviewed logo candidate and the accepted brand baseline.','identity_kit_context'),
    task('compose-identity','brand-identity-designer','Build coherent logo, type and palette directions around one mechanism; preserve every keep constraint.','brand_identity_options'),
    task('measure-identity','design-qa-accessibility','Record actual palette contrast, English glyph and font rights, small-size logo renders, and production format checks.','brand_identity_checks',{independentOf:['compose-identity']}),
    task('assemble-brand-kit','brand-identity-designer','Export exact SVG masters, variants, color roles and developer tokens; label unsupported print values unknown.','brand_identity_kit'),
    task('review-brand-kit','creative-director','Review the actual rendered kit, exact checks, approved brand facts and open production issues.','brand_identity_kit_review',{independentOf:['assemble-brand-kit']}),
    decision('identity-kit-disposition','creative-director','brand-stage-disposition',['ready-for-owner','rework','blocked']),
    end('kit-ready','identity_kit_ready_for_owner'),end('kit-rework','identity_kit_rework_required'),end('kit-blocked','identity_kit_capability_blocked')
  ], [edge('pin-selected-logo','compose-identity'),edge('compose-identity','measure-identity'),edge('measure-identity','assemble-brand-kit'),edge('assemble-brand-kit','review-brand-kit'),edge('review-brand-kit','identity-kit-disposition'),edge('identity-kit-disposition','kit-ready','ready-for-owner'),edge('identity-kit-disposition','kit-rework','rework'),edge('identity-kit-disposition','kit-blocked','blocked')]),

  graph('brand-asset-adoption', [
    task('pin-adoption-subject','design-ops-producer','Pin current accepted baseline, exact reviewed identity kit, actual assets, and owner approval scope.','brand_approval_context'),
    decision('adopt-brand-assets','head-of-design','brand-asset-adoption',['adopt','changes-requested','decline']),
    task('publish-adopted-baseline','design-ops-producer','Publish a new exact brand baseline with the kit, review, prior baseline and owner decision.','brand_baseline'),
    end('brand-assets-adopted','brand_assets_adopted'),end('brand-assets-change','brand_assets_changes_requested'),end('brand-assets-declined','brand_assets_declined')
  ], [edge('pin-adoption-subject','adopt-brand-assets'),edge('adopt-brand-assets','publish-adopted-baseline','adopt'),edge('publish-adopted-baseline','brand-assets-adopted'),edge('adopt-brand-assets','brand-assets-change','changes-requested'),edge('adopt-brand-assets','brand-assets-declined','decline')]),

  graph('brand-guidelines', [
    task('pin-approved-brand','design-ops-producer','Pin the accepted baseline and approved asset versions; separate draft kit files from adopted assets.','guidelines_context'),
    task('write-brand-guidelines','brand-voice-content','Document visual, voice, messaging, asset usage, examples and rights from the pinned baseline.','brand_guidelines_draft'),
    task('review-brand-guidelines','creative-director','Compare the draft with accepted decisions and actual assets; report omissions and contradictions.','brand_guidelines_review',{independentOf:['write-brand-guidelines']}),
    end('guidelines-reviewed','brand_guidelines_candidate')
  ], [edge('pin-approved-brand','write-brand-guidelines'),edge('write-brand-guidelines','review-brand-guidelines'),edge('review-brand-guidelines','guidelines-reviewed')]),

  graph('brand-packaging-brief', [
    task('pin-packaging-scope','design-ops-producer','Pin brand baseline, product facts, channels, supplier constraints and regulatory unknowns.','packaging_context'),
    task('draft-packaging-brief','brand-identity-designer','Specify structure, hierarchy, SKU system, materials and unboxing intent without inventing dielines or print values.','packaging_design_brief'),
    task('review-packaging-brief','creative-director','Review brand fit, claims, rights, supplier dependencies and unresolved production questions.','packaging_brief_review',{independentOf:['draft-packaging-brief']}),
    end('packaging-brief-reviewed','packaging_brief_candidate')
  ], [edge('pin-packaging-scope','draft-packaging-brief'),edge('draft-packaging-brief','review-packaging-brief'),edge('review-packaging-brief','packaging-brief-reviewed')]),

  graph('brand-rollout-plan', [
    task('pin-rollout-scope','design-ops-producer','Pin adopted brand baseline, target audience, launch type, channels and host release ownership.','brand_rollout_context'),
    task('plan-brand-rollout','brand-strategist','Plan internal rollout, asset readiness, channel sequence, customer communication and rollback dependencies.','brand_rollout_plan'),
    task('plan-brand-measurement','design-researcher','Define sourced baseline, leading and lagging indicators, collection method, cadence and attribution limits.','brand_measurement_plan'),
    {id:'rollout-plans-ready',type:'join',mode:'all'},
    task('review-rollout','creative-director','Review the plan and open dependencies; preparation alone does not publish or certify release.','brand_rollout_review',{independentOf:['plan-brand-rollout','plan-brand-measurement']}),
    end('rollout-plan-reviewed','brand_rollout_plan_candidate')
  ], [edge('pin-rollout-scope','plan-brand-rollout'),edge('pin-rollout-scope','plan-brand-measurement'),edge('plan-brand-rollout','rollout-plans-ready'),edge('plan-brand-measurement','rollout-plans-ready'),edge('rollout-plans-ready','review-rollout'),edge('review-rollout','rollout-plan-reviewed')])
];
