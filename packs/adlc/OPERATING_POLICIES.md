# ADLC operating policies

## Entry, readiness, and feedback

Select an entry path by the work's evidence and uncertainty. An unclear idea enters product discovery before requirements definition; an approved small change can enter implementation directly. Discovery may advance, request more evidence, or stop without building. A defect enters systematic debugging before any implementation edit. Keep intent, spec, stable requirement IDs, plan, code/test candidate, independent review, fixed-candidate reports, and acceptance decision linked by exact versions. The readiness report must list missing product, UX, security, or architecture decisions as PASS, CONCERNS, or FAIL; the CTO + CAIO gate proceeds only when blocking gaps are resolved. A failed fix returns to classification and root-cause investigation rather than layering another patch over an untested premise.

After acceptance, the release process pins the candidate, plan, preflight and communication, then a named human records an operational start or hold. `ready_for_host_execution` is a handoff, not a deployment result or full release certification. The host enforces production access and returns a verified execution event; only then can release observation record smoke checks and completion, a recovery request, or an incident handoff. A recovery request remains pending until a later host event confirms the resulting state.

Production monitoring evaluates one host-supplied, sourced observation window against a versioned plan and user-facing baseline. Healthy requires current evidence; missing or stale telemetry routes to `health_unverified`. A regression or missed success signal enters defect investigation or the next discovery with the incident evidence. The host remains responsible for telemetry, scheduling, paging and authorized production actions.

## Review and escalation

For an important artifact, the author checks a specific artifact version and records each self review round: findings with severity, fixes, remaining issues and supporting evidence. Stop self review when no P0/P1 remains or after round five. Submit the full history and any remaining P0/P1 to the Graph-designated review supervisor (`node.review.supervisorRole`). The fifth round is a handoff boundary, not acceptance. That reviewer independently inspects the artifact, records acceptance or bounded rework, and gives explicit treatment to known risks. A new submission retains earlier attempts in the audit trail. Each role's `roles/<role-id>/role.md` states its separate organizational reporting line.

The Design Lead's independent evaluator is the Product Manager; the CPO makes the selection. The Principal Engineer reviews Lead Engineer code with a distinct actor and execution identity. Any agent may fill multiple roles outside an independent review boundary. The host checks actual identity rather than a role label.

Before dispatching verification QA, the host runs the declared legacy `shadow` review against the frozen candidate as a fresh Sub-Agent. It uses the same bound QA Agent in a separate execution, may only review one task in one concurrent session, and expires within 15 minutes. The host accepts normal QA dispatch only after an accepted and closed Sub-Agent result for that exact candidate. Any other result pauses the parent run for recovery, with no independent supervisor bypass. The subsequent QA artifact still goes to its distinct supervisor. This gate makes no claim that use of a paid model improves quality.

For research or analysis that needs the parent task context, a Shadow-Agent begins in a new session of the same organizational Agent with a frozen snapshot. The parent supplies a compact advisory account; Core selects Decision Records, full relevant product history and active approvals from durable state. The snapshot digest, source and capture time identify the startup boundary. If the account contradicts Core records, report the conflict to the parent and use the ordinary decision path for new authority. Independent review remains a fresh Sub-Agent task. Follow the bundled `temporary-agent-snapshot` skill for the command and limits.

## CPO and CTO + CAIO conflict

Adapted from PolyLens [Collision Engine](https://github.com/PohLee/PolyLens/blob/92ed5fadd31177f67166e855a6e7e56a8a79c767/engines/collision.md) and [Synthesis Engine](https://github.com/PohLee/PolyLens/blob/92ed5fadd31177f67166e855a6e7e56a8a79c767/engines/synthesis.md):

1. Save both original positions, evidence, assumptions, non-negotiables and GO/MODIFY/BLOCK verdicts. Compare scope, timeline, resources, risk and success criteria even when verdict labels match.
2. Deduplicate underlying conflicts and classify each as priority, scope, risk, resource or fundamental.
3. Test a phased plan for priority disputes; seek the smallest scope covering compatible non-negotiables for scope disputes; compare impact, likelihood, reversibility and mitigation for risk; inspect commitment and evidence for resource disputes. Use a focused challenge and response when needed.
4. Obtain a revised position from each side. Record resolved and remaining issues. When a material conflict remains, save the options and tradeoffs, pause affected progress and ask the authenticated human owner. The human decision is recorded before work resumes, in every automation mode.

In protocol v2, the CPO and CTO + CAIO each record their position from their own current task attempt. `open-conflict` cites both signed Decision IDs, a sourced negotiation round with both responses, and explicit unresolved human options. Each option specifies continue, an upstream rework target, or stop. A continued gate cites the human resolution; rework starts a new target attempt. Retry or rework requires fresh positions for affected attempts.

## Product memory and versioned evidence

For new requests, create a RequestBrief separating the literal ask, underlying problem, affected user, desired outcome, hard constraints, explicit exclusions and unknowns before splitting implementation work. Classify investigation claims as fact, inference or assumption; keep source dates, contrary evidence and evidence state separate from decision state. A source's product claim is not verified behavior. Where a material Epic hypothesis remains untested, run a narrow probe before the CPO commits to build. A planned probe never counts as executed or validated evidence.

An accepted requirements handoff pins intent, decision, scope, non-goals, dependencies, stable IDs, criterion proof and outcome metric. A later change request and impact analysis create a new baseline version without changing a running attempt. Competitive watch compares two dated snapshots; a sourced no-material-change result is valid. A material difference requests CPO review rather than changing the roadmap or accepted scope. Investment advice includes operation, maintenance, support and opportunity costs with data-quality limits. The host calls pack-owned product-method validators before artifact submission and checks underlying sources and approvals; Core does not invoke those validators.

Before a fix or feature edit, read relevant active product decisions, change history and known constraints. A missing retrieval result is an unknown, not proof that no constraint exists. If the intended edit changes approved behavior, create a proposed product decision replacement and obtain its required authority before implementation. Link replacement to the old decision; preserve both and their reasons.

Each handoff names the exact requirement, design and candidate versions. QA, security and regression reports name the candidate they checked. When that candidate changes, mark affected reports stale and reverify; keep historical reports for traceability. Every human and agent decision is an append-only record of actor, role, mode, rule, evidence, outcome, reason, risks and affected artifacts. A failed decision write leaves the gate waiting.

## Scope of this version

The pack publishes fourteen graphs, including a requirements baseline and optional product experiment and competitive watch workflows alongside discovery, implementation, verification, release, monitoring, architecture and design assurance. Pipeline selection, full release certification, deployment execution, monitoring ingestion and scheduling require host integrations and separately approved operating rules.

## Structured evidence contracts

Core validates the contracts in `docs/EVIDENCE_CONTRACTS.md`. Verification covers every approved input criterion exactly once and ties proof to the fixed candidate. Failed criteria block acceptance; unverified criteria require an authenticated human exception with reason, risk and exact matrix version. The host verifies that the input criterion list covers the approved requirement and that cited observations are authentic.

Contracted output and artifact versions stay immutable per attempt. Their first self review hands off to the supervisor, including unresolved findings, so correction uses explicit rework and a fresh version. This exception to repeated self review prevents changing an artifact without updating its structured output.

Implementation selects backend, frontend, fullstack or parallel after planning; all active branches join into one integrated candidate for independent review. Architecture context names an accepted baseline and decision or a reviewed non-applicability rationale. Invariants retain stable IDs across revisions, and acceptance does not imply implementation completion.

Optional code delivery records required checks, review, approvals and merge observations on the exact PR head. The host verifies current repository state and eligibility. A ready/merged code-delivery decision does not authorize a production action.
