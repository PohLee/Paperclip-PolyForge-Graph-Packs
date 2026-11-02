# Product definition

Use when creating or revising frontend or backend PRDs, Epics, Stories, or acceptance criteria.

The verification handoff carries `acceptance_criteria: [{id, description, requirementIds}]` from the approved spec. Preserve criterion IDs, review completeness against the requirement, and state what observable evidence can satisfy each criterion. See `pack.policyDocuments.evidenceContracts` for the runtime matrix contract.

1. Run requirements discovery when user outcome, constraints, or acceptance are uncertain. Read the approved feature decision and versioned intent. Capture protected behavior and open questions.
2. In the spec and PRD, state why, capabilities, constraints, non-goals, and success signal. Specify frontend interactions and backend contracts where applicable, including states, errors, data rules, accessibility, and measurable acceptance criteria. Give each capability and criterion a stable ID.
3. Break the PRD into prioritized Epics and vertical Stories that each express independently verifiable user value. Frontend and backend tasks may support a Story but do not replace its outcome. Use `epic-hypothesis-probe` for material untested assumptions and `ticket-planning` for implementation blockers. Challenge whether an engineer could implement without inventing an unrecorded decision. Record PASS, CONCERNS, or FAIL and resolve blocking gaps.
4. Run `requirements-baseline` and publish a handoff validated by `validateRequirementsHandoff`. Complete when each Story traces to a criterion, each criterion to a requirement and accepted intent, and each criterion can be verified on a fixed artifact version. Pin the version for CTO + CAIO; a revision requires a change request and impact analysis.
