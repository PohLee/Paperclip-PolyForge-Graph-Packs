# Evidence contracts — ADLC 0.3.0

## Product discovery and decision artifacts

The ADLC Pack supplies `product-method-contracts.mjs` for RequestBrief, evidence ledger, experiment record, requirements handoff, competitive diff and investment case. The host calls the matching validator before submitting its artifact. These are Pack-level structure checks; Core 0.8.5 does not invoke them and a passing check cannot authenticate an interview, observation, acceptance decision or approved baseline. The host verifies those external facts and retains exact artifact versions. See [Product Manager Skills adaptation](PRODUCT_MANAGER_SKILLS_ADAPTATION.md) for field intent and workflow routing.

Requires pinned Core 0.8.5+. The core validates its supported submitted coverage and identity contracts. The host authenticates actors, executes checks and verifies external sources. Schema validity cannot establish that a command ran or a remote PR is still current. Fetch this full pinned policy document when dispatch context is truncated.

## Technical design and comprehension

Use the optional `technical-design` Graph for complex or high-impact features. Start with `feature`, an active approved `product_decision_refs` set, and `versioned_requirement: {id, version}`. The Principal Engineer submits one `technical_design` artifact and structured output:

```json
{"requirementRefs":[{"artifactId":"REQ-1","version":"v1"}],"problem":"Concurrent writes diverge","scope":"Order API","approach":"Single writer","rollback":"Restore old route","alternatives":[{"name":"Dual writer","reason":"Race risk"}],"boundaries":[{"path":"src/order.mjs","responsibility":"Own writes"}],"failureModes":[{"scenario":"Store unavailable","handling":"Retry safely"}],"verification":[{"claim":"Single writer","check":"ACL test"}],"contextIndex":[{"path":"src/order.mjs","purpose":"Inspect write boundary"}]}
```

The context index is a targeted navigation aid. The host then starts a fresh, isolated comprehension session and gives it the restricted review packet plus indexed sources. The Lead Engineer submits one `design_comprehension` artifact with exact `designRefs`, a paraphrase, host-authenticated `sessionRef`, every indexed path in `readPaths`, and `gaps` with stable IDs and summaries. QA submits one `design_audit` artifact bound to the same design version. `axes` contains exactly one `zoom-out-reuse`, `comprehension`, `failure-modes`, and `implementation-feasibility` row, each with `verdict: pass|concern|block` and `evidenceRef`. `findings` contain unique ID, axis, severity (`P0`–`P3`), summary and evidence reference.

The CTO gate accepts only when the comprehension has no gaps and no audit axis is blocked. Every finding requires `design_finding_disposition` decision evidence with `findingId`, `status: resolved|accepted-risk`, `reason`, and `subjectRefs` for the exact current design and audit artifacts. Resolved needs `proofRef`; accepted risk requires an authenticated human owner. Normal and escalated gate paths enforce the same contract. Rework starts at the draft and preserves prior attempts. A different execution ID is enforced by the Graph; actual fresh session isolation and source reads must be authenticated by the host.

For complex/high-impact implementation, pass `technical_design_context: {design:{artifactId,version},decisionId}`. Core checks a recorded accepted `technical-design` gate, exact design version, feature, and pinned requirement. This input is optional for ordinary or defect work. The host decides applicability and the current approved design; Core does not infer risk from prose.

## Design and code drift

Start the optional `design-drift` Graph with the same feature and requirement, accepted `technical_design_context`, and full `code_sha`. Submit one `design_drift_report` artifact with exact `designRefs`, the pinned `codeSha`, and rows containing unique `id`, `designClaim`, `codeRef`, `observed`, `evidenceRef`, and `status: matched|doc-stale|code-diverged|unverified`. The CTO may choose `ready` only when all rows match. Otherwise hold, reconcile code or documentation through its normal change path, then rerun against a new pinned revision or accepted design version. The host authenticates checkout SHA and observations; the report does not change code or certify a release.

## Request triage

`request-triage` starts from `source_request: {id, version}`. A follow-up after `needs-info` also supplies `previous_triage: {id, version}` and `reporter_update: {id, version}`. Core requires the previous report and decision to have ended in `needs-info` for the same request ID. The host verifies that the update came from the reporter or another trusted source.

`assess-request` submits one `triage_report` artifact and output:

```json
{"requestRefs":[{"artifactId":"ISSUE-1","version":"v1"}],"category":"bug","surface":"issue","disposition":"ready","duplicateCheck":{"result":"none","sourceRef":"artifact://search/1"},"priorDecisionCheck":{"result":"none","sourceRef":"artifact://decisions/1"},"claimCheck":{"result":"confirmed","sourceRef":"artifact://repro/1"},"brief":{"problem":"Saving fails","acceptanceBoundary":"A saved draft is visible after reload","evidenceRef":"artifact://repro/1","owner":"product-owner","nextGraph":"implementation"}}
```

Category is `bug` or `enhancement`; surface is `issue`, `external-pr`, or `feedback`. Duplicate result is `none`, `duplicate`, or `already-implemented`; prior decision is `none` or `rejected`. Claim result is `confirmed`, `unverified`, or `not-applicable`. A ready bug needs confirmed reproduction; duplicates and rejected requests cannot be ready. `needs-info` requires a nonempty `questions` list; `closed` requires `reason`. The disposition decision must match the report. Tracker labels, reporter notifications and source authenticity remain host responsibilities.

The optional `triage_handoff: {id, version}` input to `product-discovery` or `implementation` must name an actual `ready` triage report whose brief selects that Graph. Direct requests without triage keep their existing entry path. The host carries the brief and source material into the next run; Core checks the recorded route, not the truth of external sources.

## Ticket plan and integrated completion

The `implementation-plan` task submits one `implementation_plan` artifact and output containing an acyclic ticket graph:

```json
{"tickets":[{"id":"T-1","deliverable":"A draft can be saved","owner":"lead-engineer","verification":"Run save and reload journey","blockers":[]},{"id":"T-2","deliverable":"A draft can be edited","owner":"lead-engineer","verification":"Run edit journey","blockers":["T-1"]}]}
```

Core checks unique ticket IDs, known blockers, no self-blockers and no cycles. `readyWorkTickets(plan, completedIds)` returns the ready frontier. The host or tracker records completed IDs and verifies that each completed ticket really met its criterion. At `integrate-candidate`, submit the integrated `implementation_candidate`, one `integration_test_report` artifact, and output:

```json
{"candidateRefs":[{"artifactId":"CODE-1","version":"v1"}],"tickets":[{"id":"T-1","result":"complete","evidenceRef":"artifact://checks/save","observed":"Save and reload passed"},{"id":"T-2","result":"complete","evidenceRef":"artifact://checks/edit","observed":"Edit passed"}]}
```

Every planned ticket appears exactly once with observed proof; the candidate references must match the submitted candidate. Core validates shape and coverage. The host checks actual evidence, tracker status, and whether each ticket is a meaningful independently verifiable slice.

## Project-local application verification

When a real application surface needs repeatable QA, the host supplies `project_verification` to the verification Graph. It is optional so library-only or static checks can use the existing acceptance matrix. The profile points to a project-local recipe and one completed proof run:

```json
{"identity":{"id":"VERIFY-APP","version":"v1"},"surface":"web app","launchRef":"artifact://verify/launch","doctorRef":"artifact://verify/doctor","driveRef":"artifact://verify/drive","evidenceRef":"artifact://verify/evidence","cleanupRef":"artifact://verify/cleanup","features":[{"id":"save-draft","path":"Open editor and save","proof":"Draft persists after reload"}],"proofRun":{"featureId":"save-draft","evidenceRef":"artifact://verify/proof-1","cleanupPreservedEvidence":true}}
```

Core checks the profile structure, feature IDs, proof-run mapping, and evidence-retention flag. The host executes and authenticates Launch, Doctor, Drive, Evidence and Cleanup; a declared proof run is not proof by itself. QA binds actual candidate-specific observations to acceptance matrix rows. An unavailable or stale profile leaves affected checks unverified.

## Correction guardrail graduation

An `intervention_improvement` may become `graduated` only when its proposal references at least two distinct recorded interventions. The graduation evidence needs an `enforcement_proof` with `level` (`architecture`, `type`, `lint`, `check`, or `test`), `mechanism`, and `sourceRef`; a `negative_control` with `command`, `observedFailure`, and `sourceRef`; plus the outcome signal. Core validates these fields and the human-owner actor. The host must confirm the negative control replays a real past mistake, the guard actually failed on it, and the corrected path passes. Reopen or retire remains a separate recorded human decision.

## Verification

Supply `implementation_candidate`, requirement, product decisions and `acceptance_criteria`:

```json
[{"id":"AC-1","description":"An authorized user can save a draft","requirementIds":["REQ-1"]}]
```

After QA/security/regression, `acceptance-matrix` submits a versioned `acceptance_matrix` artifact and this `output`:

```json
{"candidateRefs":[{"artifactId":"CODE-1","version":"v1"}],"criteria":[{"id":"AC-1","result":"pass","evidence":[{"kind":"command","ref":"artifact://checks/run-1/manifest.json","observed":"Draft persistence test passed"}]}]}
```

Cover every input criterion exactly once. Result is pass/fail/unverified; proof kind is command/browser/manual/report. Pass/fail require proof. Fail/unverified require a `gap`. Candidate references exactly match the run input, including composite candidates. Fail blocks acceptance. Only an authenticated human-owner can accept unverified, with one additional evidence item per gap:

```json
{"kind":"acceptance_exception","criterionId":"AC-1","reason":"Staging unavailable; explicitly defer this check","risk":"Persistence remains unverified","subjectRefs":[{"artifactId":"MATRIX-1","version":"v1"}]}
```

All other required gate evidence must still reference both frozen identity and matrix artifacts. Normal and escalated gates enforce the same rule. An exception cannot waive fail. Contracted outputs/artifacts are immutable per attempt: record findings, reach supervisor review, request rework and resubmit output with a new artifact version. Prior attempts remain auditable.

## Architecture and implementation shape

Optional `system-architecture` starts with `system_id` and `architecture_brief`. Submit kind `architecture_baseline` with:

```json
{"systemId":"orders","summary":"Order API owns persistence","diagram":"client -> order API -> orders store","implementationStatus":"proposed","invariants":[{"id":"INV-001","rule":"Only order API writes the orders store","enforcement":"Scoped credentials","proof":"Access-control integration check","status":"active"}]}
```

CTO acceptance is separate from proposed/partial/implemented status. Every invariant has a stable INV-ID, rule, enforcement, proof and active/retired status. For revision supply `previous_architecture` using the context below; preserve old IDs and provide `changeReason` on rule changes or retirement.

New implementation runs require `architecture_context`:

```json
{"disposition":"baseline","systemId":"orders","baseline":{"artifactId":"ARCH-1","version":"v1"},"decisionId":"recorded-architecture-gate-decision-id"}
```

The core checks the actual accepted attempt, system and artifact version. The host selects the currently applicable baseline; no global latest-baseline registry or automatic supersession is provided. Alternatively use `{"disposition":"not-applicable","rationale":"Documentation-only correction without runtime or interface impact"}` and obtain CTO readiness review. Plans and independent reviews cite affected invariant IDs and proof.

After planning, Principal Engineer selects backend/frontend/fullstack/parallel. Fullstack executes one coupled slice; parallel activates both branches. ALL waits only for active branches. Integration produces one `implementation_candidate` and test report before independent review; verification pins that identity.

## Optional code delivery

`code-delivery` observes PR integration without performing merges or production actions. Alongside `implementation_candidate`, start with:

```json
{"delivery_target":{"repository":"owner/repo","prUrl":"https://github.com/owner/repo/pull/123","headSha":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"},"required_checks":["test"],"required_approvals":1}
```

Submit kind `delivery_report` and:

```json
{"candidateRefs":[{"artifactId":"CODE-1","version":"v1"}],"prUrl":"https://github.com/owner/repo/pull/123","headSha":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","state":"open","checks":[{"name":"test","sourceRef":"https://github.com/owner/repo/actions/runs/123","headSha":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","result":"pass"}],"approvals":[{"actorId":"reviewer-1","sourceRef":"https://github.com/owner/repo/pull/123#pullrequestreview-1","headSha":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}],"review":{"sourceRef":"artifact://review/1","headSha":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","verdict":"approve"},"unresolvedFindings":0,"mergeable":true}
```

Ready requires every configured check passing, independent approving review, distinct approvals meeting the policy count, zero unresolved findings and mergeability. Missing/pending/failing checks permit hold. The host verifies review independence, reviewer eligibility, required-check policy and source authenticity. A new head requires a new run. Merged requires `state: "merged"` plus `mergeEvent: {sourceRef, headSha, mergeSha}`; this records an observed merge, without claiming the merge commit was tested. Release preparation, human authorization and host execution remain separate; pipeline remains unselected.

## Check execution

Core supplies optional `src/host/check-runner.mjs` and CLI `scripts/check-runner.mjs` (built as `dist/check-runner.js`). Host-owned configuration defines command/agent checks, setup, feedback, timeouts and attempt bounds; see Core's host runner guide. Publish logs/manifests as immutable source artifacts and map actual observations to criterion proof. Retry/stop, missing tools or telemetry cannot become pass. After worker changes, pin the final candidate and perform final verification. The runner does not submit Graph decisions automatically.
