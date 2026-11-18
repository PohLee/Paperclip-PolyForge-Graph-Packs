const task = (id, role, supervisorRole, purpose, produces, extra = {}) => ({ id, type:'task', role, purpose, produces, decisionTraceRequired:true, review:{ supervisorRole, maxSelfReviews:5, decisionType:'review-disposition' }, ...extra });
const decision = (id, decisionType, outcomes, extra = {}) => ({ id, type:'decision', role:'cmo', decisionType, outcomes, ...extra });
const end = (id, output) => ({ id, type:'end', output });
const edge = (from,to,when) => when ? {from,to,when} : {from,to};
export const graphs = [
  {
    id:'acquisition-brief', version:'1.0.0', start:'draft-acquisition-brief',
    description:'Turn an explicitly supplied product and audience brief into a bounded acquisition proposal; supplied claims remain unverified and no campaign action is authorized.',
    workflowContract:{ version:1,
      inputSchema:{ type:'object', properties:{ product:{type:'string',minLength:1,maxLength:4000}, audience:{type:'string',minLength:1,maxLength:2000}, objective:{type:'string',minLength:1,maxLength:2000}, constraints:{type:'array',items:{type:'string',maxLength:1000},maxItems:30} }, required:['product','audience','objective'], additionalProperties:false },
      outputSchema:{ type:'object', properties:{ acquisitionPlan:{type:'object',properties:{proposal:{type:'string'},assumptions:{type:'array',items:{type:'string'}},authorization:{type:'string'}},required:['proposal','assumptions','authorization'],additionalProperties:false} }, required:['acquisitionPlan'], additionalProperties:false },
      outputMapping:{ acquisitionPlan:{source:'node',nodeId:'draft-acquisition-brief',path:['acquisition_plan']} } },
    nodes:[task('draft-acquisition-brief','growth-strategist','cmo','Draft a bounded acquisition proposal from the caller-supplied product, audience, objective and constraints. Label supplied assertions as unverified unless independently sourced in the artifact; state testable channel hypotheses, measures, budget boundary, owner, timing, stop conditions and open questions. Do not claim a release, baseline, approval, or observed result from this input, and do not publish, message or spend.',['acquisition_plan']),end('brief-recorded','acquisition_brief_recorded')],
    edges:[edge('draft-acquisition-brief','brief-recorded')]
  },
  {
    id:'acquisition-readiness-review', version:'1.0.0', start:'draft-acquisition-brief',
    description:'Compose a bounded acquisition proposal with a separate CMO risk assessment; reports unresolved authorization and evidence gaps without launching a campaign.',
    workflowContract:{ version:1,
      inputSchema:{ type:'object', properties:{ product:{type:'string',minLength:1,maxLength:4000}, audience:{type:'string',minLength:1,maxLength:2000}, objective:{type:'string',minLength:1,maxLength:2000}, constraints:{type:'array',items:{type:'string',maxLength:1000},maxItems:30} }, required:['product','audience','objective','constraints'], additionalProperties:false },
      outputSchema:{ type:'object', properties:{ acquisitionPlan:{type:'object',properties:{proposal:{type:'string'},assumptions:{type:'array',items:{type:'string'}},authorization:{type:'string'}},required:['proposal','assumptions','authorization'],additionalProperties:false}, riskAssessment:{type:'object',properties:{findings:{type:'array',items:{type:'string'}},disposition:{type:'string',enum:['bounded','human-authorization-required']}},required:['findings','disposition'],additionalProperties:false} }, required:['acquisitionPlan','riskAssessment'], additionalProperties:false },
      outputMapping:{ acquisitionPlan:{source:'node',nodeId:'draft-acquisition-brief',path:['acquisitionPlan']}, riskAssessment:{source:'node',nodeId:'assess-acquisition-risk',path:['risk_assessment']} } },
    nodes:[
      { id:'draft-acquisition-brief', type:'workflow', workflow:{packId:'marketing',packVersion:'0.0.5',graphId:'acquisition-brief',graphVersion:'1.0.0'},
        inputMapping:{product:{source:'input',path:['product']},audience:{source:'input',path:['audience']},objective:{source:'input',path:['objective']},constraints:{source:'input',path:['constraints']}} },
      task('assess-acquisition-risk','cmo','human-owner','Review the completed proposal for unsupported claims, scope, consent, spend authority, channel risks, and missing evidence. Record concrete findings and use human-authorization-required whenever public claims, spend, messaging, or unresolved material risk requires a human decision. This assessment is not campaign authorization.',['risk_assessment'],{review:{supervisorRole:'human-owner',maxSelfReviews:5,decisionType:'acquisition-readiness-owner-review'}}),
      end('readiness-recorded','acquisition_readiness_recorded')
    ],
    edges:[edge('draft-acquisition-brief','assess-acquisition-risk'),edge('assess-acquisition-risk','readiness-recorded')]
  },
  {
    id:'acquisition-plan', version:'0.0.1', start:'pin-release-handoff',
    description:'Plan acquisition from a verified ADLC release handoff; produce a proposal and no external campaign action.',
    compatibility:{ requiredCapabilities:{ 'verified-release-event':'>=1.0.0 <2.0.0' } }, requiredRunInputs:['handoffId'],
    handoffContract:{ id:'adlc.release-to-marketing', version:1, sourcePackId:'adlc', sourceGraphId:'release-observation', requiredOutcome:'release_recorded', evidenceReceiptKind:'release' },
    nodes:[
      task('pin-release-handoff','marketing-analyst','cmo','Verify the persisted handoff and authenticated release evidence receipt, source run, observed release outcome, deployed candidate, digest, product decision references, project identity, and target Pack/Graph versions. Reject a stale, unverified, or different-project event.',['release_handoff_record'],{requiredInputs:['handoffId','release_handoff','product_decision_refs']}),
      task('draft-acquisition-plan','growth-strategist','cmo','Define audience, positioning grounded in approved behavior, channel hypotheses, source-backed baseline, measures, owner, timing, budget boundary, and stop conditions. Record unknowns and alternatives.',['acquisition_plan']),
      task('assess-plan-risk','cmo','human-owner','Check approved scope, claims, consent, spend authority, channel risks, and unresolved P0/P1 findings. Record whether human authorization is needed for execution.',['risk_assessment']),
      decision('plan-disposition','acquisition-plan-disposition',['ready','rework','escalate'],{requiredInputs:['release_handoff_record','acquisition_plan','risk_assessment'],candidateNodes:['draft-acquisition-plan'],candidateKinds:['acquisition_plan'],reworkTarget:'draft-acquisition-plan',maxReworks:3}),
      end('plan-ready','acquisition_plan_ready'),end('plan-escalated','human_escalation')
    ],
    edges:[edge('pin-release-handoff','draft-acquisition-plan'),edge('draft-acquisition-plan','assess-plan-risk'),edge('assess-plan-risk','plan-disposition'),edge('plan-disposition','plan-ready','ready'),edge('plan-disposition','plan-escalated','escalate')]
  },
  {
    id:'outcome-review', version:'0.0.1', start:'pin-measurement',
    description:'Review a sourced acquisition observation window; missing, stale, or unauthenticated metrics remain unknown.',
    nodes:[
      task('pin-measurement','marketing-analyst','cmo','Pin plan version, metric definitions, source records, observation window, baseline, freshness and data gaps. The host authenticates source data.',['measurement_record'],{requiredInputs:['acquisition_plan_identity','observation_window']}),
      task('assess-outcome','marketing-analyst','cmo','Compare each sourced measure to its approved baseline. Separate observed result from attribution and uncertainty; mark absent or stale data unknown.',['outcome_assessment']),
      decision('outcome-disposition','marketing-outcome-disposition',['continue','adjust','unknown','escalate'],{requiredInputs:['measurement_record','outcome_assessment'],candidateNodes:['assess-outcome'],candidateKinds:['outcome_assessment'],outcomeCapabilities:{continue:'sourced-metrics',adjust:'sourced-metrics'}}),
      end('outcome-recorded','measured_outcome_recorded'),end('outcome-adjust','adjustment_proposed'),end('outcome-unknown','measurement_unknown'),end('outcome-escalated','human_escalation')
    ],
    edges:[edge('pin-measurement','assess-outcome'),edge('assess-outcome','outcome-disposition'),edge('outcome-disposition','outcome-recorded','continue'),edge('outcome-disposition','outcome-adjust','adjust'),edge('outcome-disposition','outcome-unknown','unknown'),edge('outcome-disposition','outcome-escalated','escalate')]
  }
];
