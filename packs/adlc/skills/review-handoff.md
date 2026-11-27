# Review and handoff

Use for important design, plan and code submissions.

1. Pin the artifact ID and version. Run a self review, record findings by severity, fixes and evidence. Use the node's configured self-review limit. Handoff when no P0/P1 remains or the node reaches that limit.
2. Submit the artifact and all rounds to the named supervisor, including unresolved P0/P1. Reaching the limit triggers handoff. The named supervisor still records the disposition.
   For a complex design, plan or code change, add a short guide to the handoff alongside the author self-review. Name the decision needed, pin the candidate artifact ID and version or commit, and order the parts by what the reviewer should inspect first. Link each part to the relevant diff, section or evidence. Cite independent findings and check results when available, and call out unresolved risks, checks still pending and the specific questions that need a decision.
3. As supervisor, start from the isolated review packet: pinned requirement and accepted architecture constraints, candidate identity and diff or artifact reference, and actual test results including failures and skips. Inspect the artifact directly using a different execution identity from the author. Write your initial findings and proposed disposition before opening the author's guide or self-review. Then compare them against the candidate and revise findings if the evidence warrants it.
4. Record each finding with its severity, exact candidate version, file or section, relevant excerpt or evidence link, the behavior that needs correction, and the check that would confirm it. When a revised candidate arrives, retain the original finding and location, check whether it still applies, and bind any closure proof to the revised version. Record acceptance or rework with reasons, remaining risks and required retests. Complete when the decision record is durable and the next graph state reflects it.

## Supervisor decision

Use the assigned supervisor work item or review packet for `review-disposition`. `requiredEvidence` lists the evidence kinds. Copy the entire `candidateRefs` array into `subjectRefs` on every required evidence item. Each reference is `{ artifactId, version }`, where `artifactId` comes from the artifact’s `id` and `version` is its exact current version. Use the latest artifacts from the review packet if your host omits `candidateRefs`.

The packet’s `selfReviewRef` identifies the latest recorded self-review round by `{ runId, nodeId, attempt, round }`. Copy it to the `self_review_history` item’s `selfReviewRef` when present. Cite the recorded round without claiming to have read the author’s findings. Summarize your actual review observations and cite the evidence you inspected.

Submit `outcome` (`accept` or `rework`), a concrete `reason`, and one evidence item per kind. A triage assessment with a `triage_report` and a `request_brief` includes both references in every item.

```json
{
  "outcome": "accept",
  "reason": "The triage report and request brief agree on the user problem and next step.",
  "evidence": [
    {
      "kind": "artifact_version",
      "summary": "Reviewed the current triage report and request brief.",
      "subjectRefs": [
        { "artifactId": "triage-report-42", "version": "v2" },
        { "artifactId": "request-brief-42", "version": "v1" }
      ]
    },
    {
      "kind": "review_findings",
      "summary": "Both artifacts identify the same affected user, observable behavior and routing recommendation. No open findings.",
      "subjectRefs": [
        { "artifactId": "triage-report-42", "version": "v2" },
        { "artifactId": "request-brief-42", "version": "v1" }
      ]
    },
    {
      "kind": "self_review_history",
      "summary": "The review packet identifies the latest recorded self-review round for this attempt.",
      "selfReviewRef": { "runId": "run-42", "nodeId": "assess-request", "attempt": 1, "round": 1 },
      "subjectRefs": [
        { "artifactId": "triage-report-42", "version": "v2" },
        { "artifactId": "request-brief-42", "version": "v1" }
      ]
    }
  ]
}
```

Use the assigned CPO, CTO + CAIO, Principal Engineer, or Product Manager supervisor role with an execution identity distinct from the producer’s. Manual mode also requires an authenticated human owner. Record the disposition against the current attempt.
