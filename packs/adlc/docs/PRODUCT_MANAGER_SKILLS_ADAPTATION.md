# Product Manager Skills adaptation

Method inspiration: [deanpeters/Product-Manager-Skills](https://github.com/deanpeters/Product-Manager-Skills/tree/cfcb697) at `cfcb697` (reviewed in the linked analysis chat). This pack independently implements a small set of product decisions and learning practices. It does not vendor upstream skill text or workflows. The upstream repository is licensed CC BY-NC-SA 4.0; do not import its content without a separate license review.

| Upstream method area | ADLC skill | Role and workflow |
| --- | --- | --- |
| Incoming request advisor | `incoming-request-advisor` | PO/PM; `request-triage` produces a RequestBrief before work breakdown. |
| Autonomous investigation | `autonomous-investigation` | Internal/external analysts, PM, PO, CPO; `product-discovery` maintains classified evidence with sources and conflict. |
| Epic hypothesis and PoL probe | `epic-hypothesis-probe` | PM designs, external analyst observes, CPO decides in optional `product-experiment`. |
| PRD development and user stories | `requirements-handoff` | PO/PM; `requirements-baseline` publishes the accepted handoff for implementation and verification. |
| Competitive intelligence watch | `competitive-intel-watch` | External analyst compares snapshots; PM routes `competitive-watch` result, CPO reviews material changes. |
| Feature investment advisor | `feature-investment-advisor` | PM recommends full-cost choices, CPO owns product scope and build/defer/stop decisions. |

The pack-owned checks in `product-method-contracts.mjs` validate document structure and reject common false claims. The serialized pack lists artifact and decision-route validators; the host imports them from the ADLC module and calls them before submission or routing. The host authenticates sources, experiment execution, Decision IDs and current baseline selection. Core 0.8.5 does not execute these pack-owned validators, so a registered Graph alone cannot certify their contents. Core continues to enforce role decisions, task attempts, source references where its contracts apply, and pinned artifact identities.

## Handoff examples

`RequestBrief` keeps `literalAsk` separate from `underlyingProblem` and marks `problemStatus`. `needs-info` preserves the exact unknown, while a ready triage report can reference the brief identity. A reported deadline is a constraint to investigate, not a product approval.

An evidence ledger claim records `classification: fact|inference|assumption`, `evidenceState: supported|contradicted|mixed|unverified`, dated `supports` and `conflicts`, and `affects` references. If no user was interviewed, the ledger cannot claim interview-based validation. Shared syndication does not produce independent corroboration.

An experiment starts with `state: planned` and predeclared support/refute criteria. Execution adds `executedAt`; evidence collection adds `observationRef`; the assessment adds `observedResult` and a recommendation. If access is unavailable, retain the planned state and route to `continue-validate` without an execution claim. `technical-feasibility` evidence may support feasibility only. The CPO's decision is separate from evidence state.

A requirements handoff has an accepted intent identity, acceptance Decision ID, scope, non-goals, dependencies, outcome metric, stable requirements and criteria. Runs pin its version. A revision provides a change request and impact analysis and never silently rewrites a running baseline. A Story is a vertical, independently verifiable user outcome; implementation tickets may split by technology beneath it.

A competitive watch compares previous and current snapshot identities. Zero changes requires `materialChange: false`. Material changes produce `decision_review_required`; the watch does not mutate the roadmap or a frozen requirement. The investment case includes maintenance, external dependencies, agent/model operation, support, opportunity and revenue/retention effects. Where estimates are weak, the recommendation stays qualitative or uses ranges.
