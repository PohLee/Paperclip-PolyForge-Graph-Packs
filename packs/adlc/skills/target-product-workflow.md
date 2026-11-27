# Product workflow

Grill one answerable dependency layer per round. Answer factual questions from cited evidence. Send unsourced questions to humans and leave technical details as open PE questions. Batch suggested answers with at most five human questions per item across all rounds. Track item, question version, sent time and reminder receipts. Paperclip routines deliver one reminder at 24h and 48h while unresolved. At 72h route unresolved product direction to needs-info. Carry other unanswered questions into PRD Assumptions with their suggested answers. Archive late answers against the original item and question version. If they change a commitment, open a revision for G2 and preserve the version under review. Record agreed terms in GLOSSARY.md and decisions in a product ADR.

Route research through autonomous-investigation when evidence is insufficient. Confirmed requests can enter directly. Preserve feedback verbatim and check the approved behavior. A violation is a bug candidate. A usability complaint is a Signal. Apply G1 human confirmation to new high-cost epics from every entry before writing. In manual mode also obtain human confirmation for research and feedback conclusions. In assisted and full-auto modes CPO handles those conclusions when no human escalation is required.

Small-scope spec template applies if at most one module changes, with no new entity, migration or UI component, and the change is reversible. Use sections for problem, users, outcome and metric, scope, non-goals, requirements, state and interaction, Assumptions, and stable BDD scenario IDs. For large scope, have two vendor-distinct candidates draft independently, then a third-vendor judge compare them against a 3-6 item rubric. PM owns the final draft.

EGM uses feature scope. PM authors with Project Memory. Goldfish reviews in a fresh context from a different vendor and reads only PRD, BDD, interactions, glossary, related decisions and backlog report.

| Dimension | Small | Large |
| --- | --- | --- |
| Naive reader checks goals, scope and non-goals | Required | Required |
| BDD observability, automation and criteria coverage | Required | Required |
| Product value, YAGNI, OKR and prior decisions | | Required |
| UX empty, error, loading, permission and undo states | | Required |
| Compliance jurisdiction, effective date and official source | If relevant | If relevant |

Every finding receives CONTEST with evidence in the reading packet, ESCALATE for evidence outside it, PROPOSE FIX, or DECLINE with rationale. No successful reviewer attempt means not-run. Small needs one clean round within two rounds. Large needs two consecutive clean rounds within five. Clean requires all applicable reviewers to have run and zero unresolved Blocker or Major findings. Report the cap or oscillation to the human.

Pin prd, acceptance.feature and applicable interaction-design issue document revisions in the approval manifest after CPO pre-review. Confirm each assumption and unresolved escalation in the human G2 decision. Any change to listed revisions invalidates the manifest. After G2 hand the exact manifest and Decision Record to the contract merge host. Only a merge event authorizes downstream work.

Write G2 contract deliverables, file names and paths in English.

Set `contract.type` and `contract.slug` in the G2 approval manifest using the [contract directory rules](../docs/CONTRACT_DIRECTORY.md).
