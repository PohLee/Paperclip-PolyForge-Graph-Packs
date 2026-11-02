# Request triage

Use for a new issue, external PR, or feedback item before routing it to discovery or implementation. Preserve the source request identity. A prior `needs-info` result resumes as a new triage run with the previous report and the reporter's update linked in the input.

1. Read the full request and follow-up history. Search existing behavior by domain concept, duplicate requests, and recorded product rejections. Record where each check looked and its source. Complete when duplicate and prior-decision checks have sourced results.
2. Verify the reported claim against the current candidate or product. Reproduce a bug on the matching surface before marking it ready. Record confirmed, unverified, or not-applicable with a source; an unverified bug needs specific questions or investigation rather than a ready brief.
3. Publish a versioned `request_brief` that passes `validateRequestBrief`, then the `triage_report` output in `pack.policyDocuments.evidenceContracts`. For `ready`, link the brief with problem, acceptance boundary, evidence, owner and next Graph route. For `needs-info`, preserve established facts and precise questions. For `closed`, record why, linking an existing implementation or prior product decision when applicable.
4. The Product Owner records the matching disposition. Complete when the report and decision agree and the next owner can follow the exact source, brief, or unanswered questions. The host owns issue tracker labels, comments, and detecting reporter replies.
