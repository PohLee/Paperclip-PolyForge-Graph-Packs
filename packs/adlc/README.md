# Paperclip PolyForge Graph — ADLC Pack

Versioned Agentic Development Life Cycle domain pack for the separate [PolyForge Graph core](../../../Paperclip-PolyForge-Graph). Import `pack` from `index.mjs`, register it with `GraphEngine.registerPack(pack)`, and bind its role IDs to real Paperclip agents or authenticated human operations in the host. The pack contains no agent UUIDs or installed-tool claims.

Current pack source version: `adlc@0.2.5`, targeting pinned Core `>=0.8.5 <0.9.0`. Discovery is `0.1.1`, verification is `0.1.5`, implementation is `0.1.5`, and other graphs are `0.1.0`. UI and interaction design workflows now belong to the Creative Team Pack; the immutable `adlc/v0.2.4` tag remains available as its historical release. Every artifact-producing task requires an attempt-bound work Decision Record. See [evidence contracts and input examples](docs/EVIDENCE_CONTRACTS.md), [method/agent mapping](docs/FACTORY_BLUEPRINT_ADAPTATION.md), [MCode adaptation](docs/MCODE_STACK_ADAPTATION.md), [Matt/pstack adaptation](docs/MATT_PSTACK_ADAPTATION.md), and [Elephant Goldfish research](docs/ELEPHANT_GOLDFISH_RESEARCH.md).

## Included workflows

| Graph | Result | Main route |
| --- | --- | --- |
| `request-triage@0.1.0` | `request_ready`, `request_needs_info`, or `request_closed` | check source issue, external PR, or feedback; preserve a ready brief, information gap, or closure reason; follow-up links prior needs-info report and reporter update |
| `product-discovery@0.1.1` | `accepted_intent` or `no_build_decision` | optional ready triage handoff; frame the problem, gather internal and user/external evidence, synthesize options, human CPO disposition: advance, more research, or stop |
| `implementation@0.1.5` | `implementation_acceptance` | architecture context and optional accepted technical design context; feature/defect classification and readiness; acyclic ticket plan; select backend/frontend/fullstack/parallel; ALL join of active branches; integrated per-ticket proof; independent review; CTO gate with bounded rework |
| `verification@0.1.5` | `acceptance_decision` | pin one candidate and criterion list; required same-Agent Sub-Agent review before normal QA dispatch; QA, security and regression reports on the candidate; criterion proof matrix; CPO acceptance or human exception for unverified gaps |
| `release-process@0.1.0` | `ready_for_host_execution` or `release_held` | pin the verified candidate; plan, preflight and coordinate; a named human records operational start or hold |
| `release-observation@0.1.0` | `release_recorded`, `recovery_pending`, or `incident_handoff` | start only from a host-supplied execution event and linked plan/authorization; run smoke and health checks; human outcome decision |
| `production-monitoring@0.1.0` | `healthy_observation`, `watch_scheduled`, `incident_handoff`, or `health_unverified` | evaluate one sourced observation window against a versioned monitoring plan and route the evidence |
| `system-architecture@0.1.0` | `architecture_acceptance` | optional baseline with diagram, stable invariant IDs, enforcement/proof and separate implementation status; CTO acceptance/rework |
| `code-delivery@0.1.0` | `code_delivery_ready`, `code_merge_observed`, `code_delivery_held` | optional final PR-head checks, review, approvals and merge event; no merge or production action |
| `technical-design@0.1.0` | `accepted_technical_design` | optional complex-feature design, fresh-session comprehension report, four-axis audit, per-finding disposition and CTO gate |
| `design-drift@0.1.0` | `design_code_reconciled` or `design_code_drift_held` | optional accepted-design versus pinned-code comparison with sourced drift rows |

Design and implementation use bounded `reworkTarget` resets that keep prior attempts and decisions. Verification `rework_required` is a distinct terminal status that hands work back for a changed candidate and new verification run. Old reports remain attached to the version they actually assessed. Human escalation pauses a run.

Verification QA requires host capability `shadow-review-execution@>=1.0.0 <2.0.0` on that Graph only. After `freeze-candidate`, the host starts a fresh Sub-Agent task session bound to the same QA Agent to review the exact frozen candidate before dispatching normal QA. Its scope is one review task, one concurrent session, and at most 15 minutes. Only an accepted and closed result permits QA dispatch. A rejected, failed, expired, or otherwise non-accepted result pauses the parent run for recovery without a supervisor bypass. The ordinary QA artifact still receives its independent CTO + CAIO review. This is a provenance and workflow gate, not a claim that a paid model improves review quality. Other ADLC and Marketing Graphs do not require this review. The legacy `shadow` Graph field and `shadow-review-execution` capability name remain for pinned Graph compatibility; their execution is a fresh Sub-Agent session, not a session fork.

For bounded research or analysis that benefits from current task context, an enabled parent Agent can open a same-Agent Shadow-Agent with `context.mode: "snapshot"` when the host reports `temporary-agent-snapshot:1.0.0`. Core freezes the parent summary and relevant authority records at launch. The summary is advisory; active approvals come from Core-selected Decision Records. The bundled `temporary-agent-snapshot` skill gives the `company-command` request, provenance rules and host limits. This is separate from the verification review above.

## Runtime contract

```js
import { pack } from './index.mjs';
await engine.registerPack(pack);
await engine.startRun({ packId: pack.id, packVersion: pack.version,
  graphId: 'implementation', mode: 'assisted', input, actor });
```

The host supplies trusted actor identity, role bindings, execution identity, available capabilities, and versioned artifacts. The `roles` map contains five Markdown documents per role and SHA-256 digests. `decisionRules` are parsed from role decision models. Twenty-eight bundled skills are carried in `pack.skills`; each role lists the skills it uses. The host provides them to the runtime and resolves real capabilities. Supervisor review uses a distinct execution identity. Normal human gates need `human-owner` plus the gate's domain role; resolving an escalated human gate requires authenticated `human-owner` authority.

Discovery starts from a sourced request without an approved product decision. An `advance` decision accepts the versioned intent for requirements definition; before the existing design or implementation graphs start, the host must record the approved product decision and pass exact requirement and design identities. The release process graph stops at `ready_for_host_execution`. The host then performs the release with its actual procedure and starts release observation only after supplying the execution event, plan identity, authorization decision and candidate identity. The pack does not select a pipeline, execute production changes, or provide full release certification. Before production monitoring starts, the host supplies a versioned monitoring plan with service owner, signal definitions, sources, thresholds, freshness and action owner. The graph evaluates one supplied window; telemetry ingestion, scheduling, paging and recovery execution remain host capabilities.

## Method alignment

| Reference | Applied in this pack |
| --- | --- |
| [Anthropic AI-native SDLC playbook](https://claude.com/resources/articles/the-ai-native-sdlc-playbook) | `lifecycle-orchestration` carries sourced intent → accepted spec → plan → candidate/tests → review → verification → decision, with versioned handoffs and feedback into the next change. |
| [BMad Method](https://www.bmadcode.com/method) | `requirements-discovery` and `product-definition` scale planning to uncertainty, give requirements stable IDs, and check readiness for missing decisions before implementation. |
| [Superpowers systematic debugging](https://github.com/obra/superpowers/tree/main/skills/systematic-debugging) | `systematic-debugging` and the defect route require investigation, comparison, one tested hypothesis, a red reproduction, and focused verification. |
| [Matt Pocock skills](https://github.com/mattpocock/skills) | Requirements discovery, request triage, and ticket planning use clarification, durable briefs, independently verifiable slices and blocking edges. |
| [pstack](https://github.com/cursor/plugins/tree/main/pstack) | `development-loop`, application verification and correction guardrails use tight feedback, real user-path proof and negative controls for repeated errors. |
| [GOV.UK discovery guidance](https://www.gov.uk/service-manual/agile-delivery/how-the-discovery-phase-works) | `product-discovery` investigates the user problem and permits a reasoned no-build decision. |
| [Google SRE release engineering](https://sre.google/sre-book/release-engineering/) and [DORA deployment guidance](https://dora.dev/capabilities/deployment-automation/) | `release-process` separates preparation from execution; `release-observation` requires an external execution event and records the observed result. |
| [Google SRE monitoring guidance](https://sre.google/sre-book/monitoring-distributed-systems/) | `production-monitoring` tracks user-facing symptoms, explicit windows and data gaps before routing incidents. |
| [Google Elephant Goldfish Model](https://github.com/google/elephant-goldfish-model/tree/f0ba151b252c9abf1318d9fe857a43265d06de89) | `technical-design-review` and `design-drift` add risk-scoped design, fresh-context comprehension, multi-axis findings and code drift reconciliation without adopting the full upstream loop. |

These are adaptations of the named methods, not bundled copies or claims that their external plugins are installed. The [best-practice research note](docs/ADLC_BEST_PRACTICES.md) lists the first-party sources, artifacts, and pack/host boundary in detail.

`roles[*].reportsToRole` defines the Paperclip organization, separate from `supervisorRole` for artifact review escalation. CPO and CTO + CAIO report to the single company CEO, who reports to the Board. Internal Product Analyst, External Product Analyst, Product Manager, and Product Owner report to CPO. Product and interface design responsibilities belong to the Creative Team Pack. Principal Engineer, Lead Engineer, QA Engineer, and Security Engineer report to CTO + CAIO. A Graph node's `review.supervisorRole` selects its actual artifact reviewer and can differ from the organizational manager.

Every artifact-producing task records a sourced work choice in the current attempt and submits its ID in `decisionIds`. The core checks actor, execution, attempt, and active product decision references. CPO/CTO conflict protocol v2 requires independent positions and a documented negotiation before human resolution. Named external design, developer-subagent, and security methods are conditional on actual host installation and permission.

Every required evidence item is identified by `kind`. Gate evidence must also reference the exact current candidate artifacts with `subjectRefs`. The host records a decision before following its route. It should link product decisions, history and artifact versions to each change. See [operating policies](OPERATING_POLICIES.md) and the core contract for method details.

## Maintenance

Edit `roles/catalog.mjs` or `scripts/build-roles.mjs`, then run `node packs/adlc/scripts/build-roles.mjs` to refresh the agent Markdown. Review the generated `decision_model.md` blocks: they are the runtime source of decision authority. Increment the Pack version when its documents change, and a Graph version when its schema or behavior changes. Existing runs retain the previous pinned release.

Validate with `node --test`. The tests use the sibling core source and require both repositories side by side.

Licensing for this separate pack has not yet been selected.
