# Paperclip PolyForge Graph — ADLC Pack

Versioned Agentic Development Life Cycle domain pack for the separate [PolyForge Graph core](../../../Paperclip-PolyForge-Graph). Import `pack` from `index.mjs`, register it with `GraphEngine.registerPack(pack)`, and bind its role IDs to real Paperclip agents or authenticated human operations in the host. The pack contains no agent UUIDs or installed-tool claims.

The current source is `adlc@0.3.19` and targets Core `>=0.8.5 <0.9.0` with `workflow-composition@^1.0.0`. UI and interaction design workflows belong to the Creative Team Pack. Every artifact-producing task requires an attempt-bound work Decision Record. Implementation and verification pin `versioned_requirement` and `acceptance_criteria` as their delivery contract; verification also pins a versioned `verification_plan`. See [evidence contracts and input examples](docs/EVIDENCE_CONTRACTS.md), [Product Manager Skills adaptation](docs/PRODUCT_MANAGER_SKILLS_ADAPTATION.md), [method/agent mapping](docs/FACTORY_BLUEPRINT_ADAPTATION.md), [MCode adaptation](docs/MCODE_STACK_ADAPTATION.md), [Matt/pstack adaptation](docs/MATT_PSTACK_ADAPTATION.md), and [Elephant Goldfish research](docs/ELEPHANT_GOLDFISH_RESEARCH.md).

Version 0.3.17 adds the v2 contract directory helpers and validators, defaults `contractsRoot` to `knowledge/contracts`, and accepts an optional `contract: { type, slug }` in the G2 approval manifest. See the [contract directory rules](docs/CONTRACT_DIRECTORY.md).

Version 0.3.12 changes no Graph route or review. It lists every Graph in a company dashboard view, documents targeted node retry, and corrects the delivery clock and Graph inventory statements in the [operating policies](OPERATING_POLICIES.md). Excluding human waits from the delivery clock is Core behavior and needs a Core build with that fix. `small-change@0.2.1` now declares `pilot_scope` as an admission-only input, which Core drops when it routes to the standard flow.

Version 0.3.11 pins QA, security and regression report attempts to the current candidate in `verification@0.1.7`. QA, security and regression publish fresh report versions with immutable, versioned check receipt references for the pinned candidate. The acceptance matrix cites all three accepted report versions and copies each proof observation from its exact report attempt. Gate acceptance revalidates those bindings. The host authenticates the underlying check execution and verifies what was observed. This Graph requires Core `verification-report-lineage@^1.0.0`. Previously pinned `verification@0.1.6` runs follow their original evidence contract. See the [verification evidence contract](docs/EVIDENCE_CONTRACTS.md#verification).

Version 0.3.11 also publishes `implementation@0.1.7`, which carries the threat-model readiness check first shipped in 0.3.5. Earlier releases kept the `0.1.6` label for that changed text, so cite the pack version with any `implementation@0.1.6` reference. The small-change submission check now also accepts a new file at an exact admitted path.

`architecture-review-composed@1.0.2` pins its child to ADLC 0.3.19. Version 1.0.1 in ADLC 0.3.19 retains its child pin to ADLC 0.3.18. Use `architecture-review-composed@1.0.2` because current Core cannot start `architecture-review-composed@1.0.1`, which remains registered for history and pins a child release with no trusted adapter.

Version 0.3.10 requires the discovery brief to cite the exact ID and version of both Product Manager-accepted research reports in `product-discovery@0.2.2`. The CPO sends synthesis back for rework if either citation is missing, wrong, or stale. This Graph requires the Core `review-source-refs@^1.0.0` capability. See the [discovery citation contract](docs/EVIDENCE_CONTRACTS.md#product-discovery-and-decision-artifacts).

Version 0.3.9 records three reviewed delivery milestones in `product-discovery@0.2.1`. The Product Manager reviews the internal findings and the external research pair, and the CPO reviews the full synthesis. The [product discovery skill](skills/product-discovery.md#reviewed-delivery-milestones) defines evidence quality, access-gap handling, and when to issue a new artifact version.

Version 0.3.8 records delivery progress when a supervisor accepts the triage assessment, the published requirements handoff, or an architecture baseline from either entry graph. Requirements publication follows the human product gate. Architecture has a separate acceptance decision after the artifact review. The [review handoff skill](skills/review-handoff.md) gives the exact `review-disposition` evidence for the CPO, CTO + CAIO, Principal Engineer and Product Manager.

Version 0.3.7 routes `small-change@0.2.1` to the independent Principal Engineer Agent pinned at admission and retains the human final acceptance gate.

Version 0.3.6 adds host-verified admission, committed diff review and an auditable handoff to standard implementation for the isolated `small-change@0.2.0` pilot.

Version 0.3.5 adds risk-triggered threat modeling and an isolated `small-change@0.1.0` pilot. The pilot needs an explicitly provisioned host capability and retains independent review and a final acceptance gate.

Version 0.3.4 adds repository preflight to readiness, traces cross-layer acceptance criteria through ticket plans, and plans parallel work around expected writes and integrated proof. Review handoffs add a candidate guide and findings that identify the original version, location and retest. The [engineering delivery](skills/engineering-delivery.md), [ticket planning](skills/ticket-planning.md) and [review handoff](skills/review-handoff.md) skills carry the guidance.

## Included workflows

| Graph | Result | Main route |
| --- | --- | --- |
| `request-triage@0.2.1` | `request_ready`, `request_needs_info`, or `request_closed` | separate literal ask from problem in a RequestBrief; check source issue, external PR, or feedback; preserve brief or gap |
| `product-discovery@0.2.2` | `accepted_intent` or `no_build_decision` | classify sourced evidence and conflicts, identify risky hypotheses, synthesize options, human CPO disposition |
| `implementation@0.1.7` | `implementation_acceptance` | versioned requirement and acceptance criteria; feature/defect classification and readiness; acyclic ticket plan; integrated candidate and per-ticket proof; root-cause fix/reverify count; independent review; CTO gate with bounded rework |
| `small-change@0.2.1` | `implementation_acceptance`, or a handoff to `implementation` | isolated pilot needing `adlc-small-change-pilot`; human-owner start in manual mode with an admitted scope; independent review of the committed diff; human final gate with one rework; ineligible work goes to the standard flow |
| `verification@0.1.7` | `acceptance_decision` | pin one candidate and criterion list; required same-Agent Sub-Agent review before normal QA dispatch; QA, security and bounded full regression reports; criterion proofs from exact accepted report attempts; CPO acceptance or human exception for unverified gaps |
| `release-process@0.1.0` | `ready_for_host_execution` or `release_held` | pin the verified candidate; plan, preflight and coordinate; a named human records operational start or hold |
| `release-observation@0.1.0` | `release_recorded`, `recovery_pending`, or `incident_handoff` | start only from a host-supplied execution event and linked plan/authorization; run smoke and health checks; human outcome decision |
| `production-monitoring@0.1.0` | `healthy_observation`, `watch_scheduled`, `incident_handoff`, or `health_unverified` | evaluate one sourced observation window against a versioned monitoring plan and route the evidence |
| `requirements-baseline@0.1.1` | `accepted_requirements_baseline` or `requirements_held` | challenge draft scope and traceability; human CPO gate; publish an immutable accepted handoff |
| `product-experiment@0.1.0` | `build_recommended`, `validation_required`, `pivot_required`, or `no_build_decision` | plan, execute and assess one falsifiable probe; CPO records the human disposition |
| `competitive-watch@0.1.0` | `no_material_change` or `decision_review_required` | compare two sourced snapshots; PM routes material changes for CPO review without changing scope |
| `system-architecture@0.1.1` | `architecture_acceptance` | optional baseline with diagram, stable invariant IDs, enforcement/proof and separate implementation status; CTO acceptance/rework |
| `code-delivery@0.1.0` | `code_delivery_ready`, `code_merge_observed`, `code_delivery_held` | optional final PR-head checks, review, approvals and merge event; no merge or production action |
| `technical-design@0.1.0` | `accepted_technical_design` | optional complex-feature design, fresh-session comprehension report, four-axis audit, per-finding disposition and CTO gate |
| `design-drift@0.1.0` | `design_code_reconciled` or `design_code_drift_held` | optional accepted-design versus pinned-code comparison with sourced drift rows |
| `system-architecture-workflow@1.0.1` | validated `architectureBaseline` projection after graph completion | callable equivalent architecture baseline with explicit `workflowInput` schema and existing CTO acceptance gate |
| `code-delivery-workflow@1.0.0` | validated `deliveryReport` projection after graph completion | callable final PR-head evidence workflow with explicit `workflowInput` schema and existing CTO decision gate |
| `architecture-review-composed@1.0.2` | accepted `architectureBaseline` from its exact contracted child workflow | parent orchestration of `system-architecture-workflow@1.0.1`; human gate, adapter binding and evidence checks are retained |

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

The contracted entry graphs use the Core workflow runtime or the authenticated `workflow-run` tool. Business values go under `workflowInput`; host-owned identity, issue, project, execution, product decisions and evidence remain in the trusted envelope. Example inputs:

```js
// system-architecture-workflow@1.0.1
{ workflowInput: { system_id: 'billing-api', architecture_brief: 'Split invoice writes from payment capture; preserve idempotency.' } }

// architecture-review-composed@1.0.2 (same business input; child receives only this mapped object)
{ workflowInput: { system_id: 'billing-api', architecture_brief: 'Split invoice writes from payment capture; preserve idempotency.' } }

// code-delivery-workflow@1.0.0
{ workflowInput: {
  implementation_candidate: { artifacts: [{ artifactId: 'billing-candidate', version: 'v1' }] },
  delivery_target: { repository: 'acme/billing', prUrl: 'https://github.com/acme/billing/pull/42', headSha: '0123456789abcdef0123456789abcdef01234567' },
  required_checks: ['unit-tests', 'security-scan'],
  required_approvals: 1
} }
```

The projected output is the completed task's submitted artifact payload. Core validates that it is an object and exposes it only after accepted completion. The projection itself is not a trusted evidence receipt, acceptance decision or proof that external checks occurred; the existing adapters and decision/evidence gates still govern those claims.

`architecture-review-composed` exercises Core's trusted child-start adapter binding. It maps `system_id` and `architecture_brief` from the parent `workflowInput` into the exact child `workflowInput`; the child starts as the original root actor and Core adds no business input fields. The Host still must install and pin this Pack's exact digest, authorize the parent graph start, enforce the child's exact identity and `graphStartRoles`, and bind the child to the same ADLC adapter before dispatch. Core atomic child linking, human approval, actor/execution provenance, evidence validation and product-decision checks remain in force. Do not expose raw child start to Agents.

The host supplies trusted actor identity, role bindings, execution identity, available capabilities, and versioned artifacts. The `roles` map contains five Markdown documents per role and SHA-256 digests. `decisionRules` are parsed from role decision models. Bundled skills are carried in `pack.skills`; each role lists the skills it uses. The host provides them to the runtime and resolves real capabilities. Supervisor review uses a distinct execution identity. Normal human gates need `human-owner` plus the gate's domain role; resolving an escalated human gate requires authenticated `human-owner` authority. The host must invoke `product-method-contracts.mjs` for product-method artifacts; Core does not call those pack-owned checks.

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
| [Product Manager Skills](https://github.com/deanpeters/Product-Manager-Skills/tree/cfcb697) | Six independently written skills add request framing, evidence classification, hypothesis probes, requirements handoff, competitive watch and full-cost investment advice. See the [adaptation and license note](docs/PRODUCT_MANAGER_SKILLS_ADAPTATION.md). |

These are adaptations of the named methods, not bundled copies or claims that their external plugins are installed. The [best-practice research note](docs/ADLC_BEST_PRACTICES.md) lists the first-party sources, artifacts, and pack/host boundary in detail.

`roles[*].reportsToRole` defines the Paperclip organization, separate from `supervisorRole` for artifact review escalation. CPO and CTO + CAIO report to the single company CEO, who reports to the Board. Internal Product Analyst, External Product Analyst, Product Manager, and Product Owner report to CPO. Product and interface design responsibilities belong to the Creative Team Pack. Principal Engineer, Lead Engineer, QA Engineer, and Security Engineer report to CTO + CAIO. A Graph node's `review.supervisorRole` selects its actual artifact reviewer and can differ from the organizational manager.

Every artifact-producing task records a sourced work choice in the current attempt and submits its ID in `decisionIds`. The core checks actor, execution, attempt, and active product decision references. CPO/CTO conflict protocol v2 requires independent positions and a documented negotiation before human resolution. Named external design, developer-subagent, and security methods are conditional on actual host installation and permission.

Every required evidence item is identified by `kind`. Gate evidence must also reference the exact current candidate artifacts with `subjectRefs`. A `review-disposition` submission includes `artifact_version`, `review_findings`, and `self_review_history`, each covering every current candidate via `{ artifactId, version }`. See the [review handoff example](skills/review-handoff.md#supervisor-decision). The host records a decision before following its route. It should link product decisions, history and artifact versions to each change. See [operating policies](OPERATING_POLICIES.md) and the core contract for method details.

## Target workflow contracts

ADLC 0.3.13 exports validators for approval manifests, contract locks and index entries, completion ledgers, review findings, verification manifests and return requests. The Host can also judge verification coverage, check contract write paths and validate seat assignments.

The project schema describes the contracts root, backlog provider and field mappings, approver IDs, node-seat profile names, project profiles and automation mode. Set `neverAutoMerge` entries to false to disable individual rules. The Host treats omitted rules as enabled. Profile fallback is an ordered list of concrete profile settings, and the Host calls `checkSeatConstraints` before dispatch and on each fallback.

`resolveSeatOrder` accepts resolved settings under `runOverride`, `projectNodeSeat`, `projectProfile`, `companyProfile` and `paperclipAgent`, in descending precedence. It merges fields shallowly and reports the highest contributing layer in `source`. Seat constraints take assignments of `{ name, vendor }`. For a judge declaration, `judgeVendorNotIn` lists the other seat names whose vendors must differ from the declared judge seat.

See the [contract directory and templates](docs/CONTRACT_DIRECTORY.md), [evidence examples](docs/EVIDENCE_CONTRACTS.md#target-workflow-evidence) and [target workflow plan](docs/TARGET_WORKFLOW_PLAN.md).

## Maintenance

Edit `roles/catalog.mjs` or `scripts/build-roles.mjs`, then run `node packs/adlc/scripts/build-roles.mjs` to refresh the agent Markdown. Review the generated `decision_model.md` blocks: they are the runtime source of decision authority. Increment the Pack version when its documents change, and a Graph version when its schema or behavior changes. Existing runs retain the previous pinned release.

Validate with `node --test`. The tests use the sibling core source and require both repositories side by side.

Pack-owned code is licensed under LGPL-2.1-only. Referenced third-party methods retain their own licenses; this pack does not copy or relicense them.

## Target product workflow

Pin request-triage@0.2.2 and product-discovery@0.2.3 for G-P1, external-intel-rerank@0.1.0 for G-P2, and requirements-baseline@0.1.2 for G-P3. Earlier versions remain available. The host delivers routine triggers, reminders and answer events. Configure one backlog writer for the chosen provider.

- **GitHub Projects** uses a generic remote MCP connection at `https://api.githubcopilot.com/mcp/` with the `X-MCP-Toolsets: projects,issues` header and a classic PAT with `project` and `repo` scopes. The built-in Paperclip GitHub connector sends `default,actions`, which does not expose Projects. Organization-owned and user-owned Projects work. Name the custom field **Item Type** because GitHub Projects reserves **Type**. See [backlog-github-projects](skills/backlog-github-projects.md).
- **Jira** uses the Paperclip Jira connector. Set `backlog.provider` to `jira`. Storage is selected per datum through configured custom fields or native fallback. On team-managed projects, attach the configured custom fields to the configured issue type. See [backlog-jira](skills/backlog-jira.md).

G2 approves the exact manifest as the existing human requirements-acceptance decision. The publication request carries that decision to the contract merge host. The [target workflow skill](skills/target-product-workflow.md) defines scope selection, Grill, the arena and EGM. Fixed seat binding and request_confirmation remain pending live tests. The deployment provides independent reviewer executions and verifies vendor provenance for the declared seats.

## Target technical workflow

Pin `technical-design@0.1.3` for G-T1, `implementation@0.1.8` for G-T2, `verification@0.1.8` and `code-delivery@0.1.1` for G-T3, and `bug-fast-lane@0.1.0` for G-T4. Each takes `contract_pins` as a list of `{ contractId, section, commit }` records. Start G-T2 from the recorded technical `contract.merged` event with its exact `contract_merge_receipt`. Bind the configured CTO to the `cto` role for G4 and retain the existing `cto-caio` implementation role.

G-T3 verification takes `pr_head` with `repository`, `pullNumber` and `headSha`, and `verification_scope` with approved `expectedScenarios` and execution `dimensions`. The host calls the project verification entry for that SHA. The human exception records the owner's disposition of unverified gaps and returns for verification. G5 requires a human owner and a passing manifest. Start a fresh verification run whenever the head changes.

Use the ADLC host API for the W3 Graph versions. Its `inspectImplementationPull` service supplies the fresh `headSha`, `upToDate`, `checksPassed`, `currentPins`, `prPins`, `changedFiles`, `majorDependencyBump` and `neverAutoMerge` from trusted project and PR sources. For product, design and technical contract publications, Core verifies the publication and reports a commit status. A human or GitHub auto-merge merges the PR. For G5, the host resolves the immutable manifest revision, invokes the Core implementation merge action and passes the G5 request to code delivery to prove the observed merge. The W3 seat declarations describe vendor constraints for implementation EGM and advisory council. The host resolves seats and fallback profiles.

### W4 approval modes and improvement workflows

Pin `verification@0.1.9` for conditional G5 approval. The default mode is `manual`. In `assisted`, an independent CTO/CAIO can approve a low-risk PR after review and verification pass. A project must set `allowFullAuto: true` to use `full-auto`, which permits the same approver at higher risk when all evidence is complete. Protected risk categories route to the owner. The trusted PR snapshot supplies the changed paths, dependency changes and author identity. The project can add CI paths and risk rules through `ciPaths` and `riskRules`. Establish the baseline with the four exported `metricDefinitions` before enabling automation.

Start `architecture-improvement@0.1.0` manually to produce tech-debt Items. The CTO ranks candidates with roughly 20% capacity and authorizes the selected Item with affected invariant IDs and regression standards. Pass the current authorization and its run and decision IDs to `technical-design@0.1.4`.

Start `retro-correct@0.1.0` manually with run logs, Decision Records, review findings, reverts, bugs and the intervention ledger. The host resolves two distinct model identities for the independent attribution passes and inspects the exact correction PR head. Ordinary corrections follow the architecture, types, lint, tests, then docs and agent rules order. Each new check cites a historical error and failure evidence. PRs enter G-T3. Reports containing changes to Graphs, roles or model routing are referred to the human owner.
An owner-accepted verification exception ends the verification run with
`verification_exception_accepted`. The bot still requires verified evidence to
merge a PR. The owner merges an unverified PR outside the bot.
