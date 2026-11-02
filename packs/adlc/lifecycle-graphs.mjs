const task = (id, role, supervisorRole, purpose, produces, extra = {}) => ({
  id, type: 'task', role, purpose, produces, decisionTraceRequired: true,
  review: { supervisorRole, maxSelfReviews: 5, decisionType: 'review-disposition' }, ...extra
});
const decision = (id, role, decisionType, outcomes, extra = {}) =>
  ({ id, type: 'decision', role, decisionType, outcomes, ...extra });
const join = id => ({ id, type: 'join', mode: 'all' });
const end = (id, output) => ({ id, type: 'end', output });
const edge = (from, to, when) => when === undefined ? { from, to } : { from, to, when };

export const lifecycleGraphs = [
  {
    id: 'request-triage', version: '0.2.0', start: 'assess-request', inputContracts: ['source-request'],
    description: 'Check an issue, external PR or feedback claim before routing it to discovery or implementation; preserve the brief or information gap.',
    nodes: [
      task('assess-request', 'product-owner', 'cpo',
        'Separate the literal ask from the underlying problem, user, must-haves, constraints, exclusions and unknowns in a validated RequestBrief. Check duplicates, already implemented behavior, prior rejection, and the reported claim. For a bug, reproduce before declaring it ready. Reported urgency grants no authority. Record a durable brief, precise questions or closure reason.',
        ['triage_report', 'request_brief'], { requiredInputs: ['source_request'], outputContract: 'triage-report' }),
      decision('triage-disposition', 'product-owner', 'request-triage', ['ready', 'needs-info', 'closed'], {
        requiredInputs: ['triage_report'], candidateNodes: ['assess-request'], candidateKinds: ['triage_report'],
        decisionContract: { type: 'triage-routing', sourceNode: 'assess-request' }
      }),
      end('triage-ready', 'request_ready'), end('triage-needs-info', 'request_needs_info'),
      end('triage-closed', 'request_closed')
    ],
    edges: [
      edge('assess-request', 'triage-disposition'), edge('triage-disposition', 'triage-ready', 'ready'),
      edge('triage-disposition', 'triage-needs-info', 'needs-info'), edge('triage-disposition', 'triage-closed', 'closed')
    ]
  },
  {
    id: 'product-discovery', version: '0.2.0', start: 'frame-discovery', inputContracts: ['triage-handoff-optional'],
    description: 'Investigate the problem and user need before a build commitment; retain an explicit advance, research-more, or no-build disposition.',
    nodes: [
      task('frame-discovery', 'product-owner', 'cpo',
        'Reframe the source request as a problem; identify user groups, research questions, assumptions, constraints, success baseline, and stop criteria.',
        ['discovery_plan'], { requiredInputs: ['source_request'] }),
      task('internal-research', 'internal-product-analyst', 'product-manager',
        'Gather dated usage, support, prior decision, operational and technical constraint evidence. Classify claims as fact, inference or assumption; record supporting and conflicting sources in the evidence ledger.',
        ['internal_evidence']),
      task('external-research', 'external-product-analyst', 'product-manager',
        'Gather direct user evidence where access exists, current journey and barriers, contrary signals, and external alternatives. State sample, source independence, freshness and access limits; no interview means no customer-validation claim.',
        ['user_research_record', 'external_evidence']),
      join('evidence-ready'),
      task('synthesize-discovery', 'product-manager', 'cpo',
        'Validate the evidence ledger, compare user needs, alternatives, constraints, baseline and options including no build. Identify risky Epic hypotheses and whether a narrow probe is needed before build; draft versioned intent with open decisions.',
        ['evidence_ledger', 'discovery_options', 'discovery_brief', 'versioned_intent']),
      decision('discovery-gate', 'cpo', 'discovery-disposition', ['advance', 'more-research', 'stop'], {
        requiredInputs: ['discovery_brief', 'versioned_intent'], candidateNodes: ['synthesize-discovery'],
        candidateKinds: ['versioned_intent'], reworkTarget: 'frame-discovery', reworkOutcome: 'more-research', maxReworks: 3
      }),
      end('discovery-advance', 'accepted_intent'), end('discovery-stop', 'no_build_decision')
    ],
    edges: [
      edge('frame-discovery', 'internal-research'), edge('frame-discovery', 'external-research'),
      edge('internal-research', 'evidence-ready'), edge('external-research', 'evidence-ready'),
      edge('evidence-ready', 'synthesize-discovery'), edge('synthesize-discovery', 'discovery-gate'),
      edge('discovery-gate', 'discovery-advance', 'advance'), edge('discovery-gate', 'discovery-stop', 'stop')
    ]
  },
  {
    id: 'release-process', version: '0.1.0', start: 'plan-release',
    description: 'Plan and coordinate a release, then record a named operational start authorization. The host performs the release separately; this graph does not deploy or certify it.',
    nodes: [
      task('plan-release', 'principal-engineer', 'cto-caio',
        'Pin the verified candidate and target, list changes and dependencies, sequence the rollout, name owners, checks, stop conditions, and a recovery path.',
        ['release_plan'], { requiredInputs: ['implementation_candidate', 'verification_decision', 'product_decision_refs'] }),
      task('preflight-release', 'principal-engineer', 'cto-caio',
        'Confirm target access, candidate identity, required configuration, data-change sequencing, observability, and recovery readiness; record unknowns.',
        ['preflight_report']),
      task('coordinate-release', 'product-owner', 'cpo',
        'Record affected users, timing, communication owner, support notice, and a change summary tied to the candidate.',
        ['communication_plan']),
      join('release-ready'),
      decision('release-start', 'cto-caio', 'release-process-start', ['start', 'hold'], {
        requiredInputs: ['release_plan', 'preflight_report', 'communication_plan']
      }),
      end('release-await-execution', 'ready_for_host_execution'), end('release-held', 'release_held')
    ],
    edges: [
      edge('plan-release', 'preflight-release'), edge('plan-release', 'coordinate-release'),
      edge('preflight-release', 'release-ready'), edge('coordinate-release', 'release-ready'),
      edge('release-ready', 'release-start'), edge('release-start', 'release-held', 'hold'),
      edge('release-start', 'release-await-execution', 'start')
    ]
  },
  {
    id: 'release-observation', version: '0.1.0', start: 'record-release-execution',
    description: 'Start only after the host supplies an actual execution event; check the deployed result and record completion, recovery, or investigation.',
    nodes: [
      task('record-release-execution', 'lead-engineer', 'principal-engineer',
        'Record the host-supplied execution event, operator, target, time, candidate, deviations and resulting deployed identity. Compare it with the authorized plan. The release_execution_record artifact carries its content digest and exact sourceRefs to run inputs release_execution_event, implementation_candidate, and release_authorization_decision.',
        ['release_execution_record'], { requiredInputs: ['release_execution_event', 'release_plan_identity', 'release_authorization_decision', 'implementation_candidate'] }),
      task('post-release-observation', 'qa-engineer', 'cto-caio',
        'Run target smoke checks and compare user-facing health signals with the pre-release baseline over the stated observation window.',
        ['post_release_report']),
      decision('release-outcome', 'cto-caio', 'release-process-outcome', ['complete', 'recover', 'investigate'], {
        requiredInputs: ['release_execution_record', 'post_release_report'],
        candidateNodes: ['record-release-execution'], candidateKinds: ['release_execution_record']
      }),
      task('request-recovery', 'lead-engineer', 'principal-engineer',
        'Hand the host an authorized recovery request with target known-good state, owner, stop condition and observation check. Record actual recovery only from a later host event.',
        ['recovery_request']),
      task('release-incident-handoff', 'qa-engineer', 'cto-caio',
        'Record the observed symptom, affected users, time window, candidate identity, initial evidence and investigation owner.',
        ['incident_brief']),
      end('release-complete', 'release_recorded'), end('release-recovery', 'recovery_pending'),
      end('release-investigation', 'incident_handoff')
    ],
    edges: [
      edge('record-release-execution', 'post-release-observation'), edge('post-release-observation', 'release-outcome'),
      edge('release-outcome', 'release-complete', 'complete'),
      edge('release-outcome', 'request-recovery', 'recover'), edge('request-recovery', 'release-recovery'),
      edge('release-outcome', 'release-incident-handoff', 'investigate'), edge('release-incident-handoff', 'release-investigation')
    ]
  },
  {
    id: 'production-monitoring', version: '0.1.0', start: 'pin-observation',
    description: 'Evaluate one host-supplied production observation window and route healthy, watch, or investigate; scheduling and telemetry collection remain host responsibilities.',
    nodes: [
      task('pin-observation', 'qa-engineer', 'cto-caio',
        'Pin service, environment, observation window, source and freshness of each signal, and the current deployed candidate when known.',
        ['observation_record'], { requiredInputs: ['service_identity', 'monitoring_plan_identity', 'observation_window', 'signal_snapshot'] }),
      task('assess-health', 'qa-engineer', 'cto-caio',
        'Compare user-facing SLIs or baseline with observed errors, latency, traffic and saturation as applicable; mark missing and stale telemetry.',
        ['health_assessment']),
      decision('monitoring-disposition', 'cto-caio', 'monitoring-triage', ['healthy', 'watch', 'investigate', 'insufficient-data'], {
        requiredInputs: ['observation_record', 'health_assessment'], candidateNodes: ['assess-health'],
        candidateKinds: ['health_assessment']
      }),
      task('record-watch', 'qa-engineer', 'cto-caio',
        'Record the specific signal, threshold, owner and next observation time for a non-urgent but material trend.',
        ['watch_record']),
      task('record-incident', 'qa-engineer', 'cto-caio',
        'Record user impact, first failing signal, time window, deployed candidate, diagnostic links and incident owner; hand off to defect investigation.',
        ['incident_brief']),
      task('record-data-gap', 'qa-engineer', 'cto-caio',
        'Record missing or stale telemetry, the health claims it prevents, an owner, and the next evidence collection action.',
        ['data_gap_record']),
      end('monitoring-healthy', 'healthy_observation'),
      end('monitoring-watch', 'watch_scheduled'),
      end('monitoring-investigation', 'incident_handoff'),
      end('monitoring-unknown', 'health_unverified')
    ],
    edges: [
      edge('pin-observation', 'assess-health'), edge('assess-health', 'monitoring-disposition'),
      edge('monitoring-disposition', 'monitoring-healthy', 'healthy'),
      edge('monitoring-disposition', 'record-watch', 'watch'), edge('record-watch', 'monitoring-watch'),
      edge('monitoring-disposition', 'record-incident', 'investigate'), edge('record-incident', 'monitoring-investigation'),
      edge('monitoring-disposition', 'record-data-gap', 'insufficient-data'), edge('record-data-gap', 'monitoring-unknown')
    ]
  },
  {
    id: 'requirements-baseline', version: '0.1.0', start: 'draft-requirements',
    description: 'Turn accepted intent into a pinned, traceable requirements baseline after a human product decision.',
    nodes: [
      task('draft-requirements', 'product-owner', 'cpo',
        'Draft scope, non-goals, dependencies, outcome metric, stable requirement and criterion IDs, vertical user-value Stories, and proof expectations from the accepted intent.',
        ['requirements_draft'], { requiredInputs: ['accepted_intent'] }),
      task('challenge-requirements', 'product-manager', 'cpo',
        'Check missing decisions, traceability and whether an engineer would invent behavior. Report PASS, CONCERNS or FAIL and exact gaps.',
        ['readiness_report']),
      decision('requirements-gate', 'cpo', 'requirements-acceptance', ['accept', 'rework', 'hold'], {
        requiredInputs: ['requirements_draft', 'readiness_report'], candidateNodes: ['draft-requirements'], candidateKinds: ['requirements_draft'],
        reworkTarget: 'draft-requirements', reworkOutcome: 'rework', maxReworks: 3
      }),
      task('publish-baseline', 'product-owner', 'cpo',
        'Publish a validated accepted requirements handoff with the exact gate Decision ID, immutable version and full problem-to-outcome trace. A revision needs a change request and impact analysis.',
        ['requirements_handoff']),
      end('requirements-accepted', 'accepted_requirements_baseline'), end('requirements-held', 'requirements_held')
    ],
    edges: [edge('draft-requirements', 'challenge-requirements'), edge('challenge-requirements', 'requirements-gate'),
      edge('requirements-gate', 'publish-baseline', 'accept'), edge('publish-baseline', 'requirements-accepted'),
      edge('requirements-gate', 'requirements-held', 'hold')]
  },
  {
    id: 'product-experiment', version: '0.1.0', start: 'plan-probe',
    description: 'Test one risky product hypothesis with a predeclared, bounded probe before a build commitment.',
    nodes: [
      task('plan-probe', 'product-manager', 'cpo',
        'State the target user, falsifiable hypothesis, risky assumption, cheapest relevant probe and predeclared support/refute criteria. Publish a validated planned experiment record.',
        ['experiment_plan'], { requiredInputs: ['accepted_intent'] }),
      task('execute-probe', 'external-product-analyst', 'product-manager',
        'Attempt the probe only with available access and consent. Record actual execution time, sample, observation source and evidence type. If access is unavailable, record the gap without claiming execution. A plan or technical PoC does not prove demand.',
        ['experiment_observation']),
      task('assess-probe', 'product-manager', 'cpo',
        'Validate the experiment record. Separate planned, executed, evidence-collected, support, refutation and inconclusive states; recommend build, continue validation, pivot or stop without changing scope. Validate the gate route against this record.',
        ['experiment_record', 'evidence_ledger']),
      decision('experiment-gate', 'cpo', 'experiment-disposition', ['build', 'continue-validate', 'pivot', 'stop'], {
        requiredInputs: ['experiment_record', 'evidence_ledger'], candidateNodes: ['assess-probe'], candidateKinds: ['experiment_record']
      }),
      end('experiment-build', 'build_recommended'), end('experiment-validate', 'validation_required'),
      end('experiment-pivot', 'pivot_required'), end('experiment-stop', 'no_build_decision')
    ],
    edges: [
      edge('plan-probe', 'execute-probe'), edge('execute-probe', 'assess-probe'), edge('assess-probe', 'experiment-gate'),
      edge('experiment-gate', 'experiment-build', 'build'), edge('experiment-gate', 'experiment-validate', 'continue-validate'),
      edge('experiment-gate', 'experiment-pivot', 'pivot'), edge('experiment-gate', 'experiment-stop', 'stop')
    ]
  },
  {
    id: 'competitive-watch', version: '0.1.0', start: 'collect-snapshot',
    description: 'Compare sourced competitor snapshots and route only material changes for product decision review.',
    nodes: [
      task('collect-snapshot', 'external-product-analyst', 'product-manager',
        'Collect a dated current snapshot with primary sources, coverage limits and contrary evidence; retain previous snapshot identity.',
        ['competitive_snapshot'], { requiredInputs: ['previous_snapshot', 'watch_question'] }),
      task('compare-snapshots', 'external-product-analyst', 'product-manager',
        'Validate a sourced diff against the prior snapshot. Name changed claims and affected hypotheses, decisions or requirements, or explicitly report no material change.',
        ['competitive_diff']),
      decision('watch-route', 'product-manager', 'competitive-watch-routing', ['no-material-change', 'review-required'], {
        requiredInputs: ['competitive_diff'], candidateNodes: ['compare-snapshots'], candidateKinds: ['competitive_diff']
      }),
      end('watch-unchanged', 'no_material_change'), end('watch-review', 'decision_review_required')
    ],
    edges: [edge('collect-snapshot', 'compare-snapshots'), edge('compare-snapshots', 'watch-route'),
      edge('watch-route', 'watch-unchanged', 'no-material-change'), edge('watch-route', 'watch-review', 'review-required')]
  }
];
