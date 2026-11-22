# Product discovery

Use when a source request names a solution before the user problem or need is established.

1. Frame the problem and the decision discovery must inform. Name likely users, the current journey, assumptions, research questions, constraints, existing alternatives, and a provisional success baseline. Complete when the plan says what evidence could change the decision.
2. Gather direct user observations where access is available, including people with accessibility or support needs relevant to the product. Combine these with dated internal usage/support evidence and external alternatives. Label samples, source versions, contrary evidence, and missing access. Complete when each material claim can be traced to a source and uncertainty is visible.
3. Synthesize the user need and its cost or impact. Compare feasible choices, including changing a process, learning more, or building nothing. Produce a versioned intent with why, affected users, constraints, non-goals, success signal, and open decisions. Complete when the options and evidence permit a reasoned advance, more-research, or stop decision.
4. Obtain the CPO disposition and retain rejected options. An advance hands the accepted intent to requirements definition; it does not itself assert that a PRD, design, or implementation is approved. Complete when the next owner can cite the exact intent and decision versions.

Scale the sample and method to the decision's uncertainty and impact. An unavailable research channel is recorded as a gap, never described as user evidence.

## Reviewed delivery milestones

- The Product Manager reviews `internal_evidence` for sourced findings or a concrete investigation result, such as a dated search of named sources that rules out a suspected prior decision. Record what was checked, what was observed, and what the result changes.
- The Product Manager reviews `user_research_record` and `external_evidence` together. If access was limited, describe the channel tried, when, the observable result, what remains unknown, and the impact on the decision. A material investigation result can support the milestone while user validation remains open.
- During synthesis, put the exact current Product Manager-accepted `internal_evidence` and `external_evidence` artifact IDs and versions in `output.discovery_brief.researchRefs`. Use one `{ kind, id, version }` object per report. Read the companion `user_research_record` alongside the external report and trace material conclusions and open assumptions to their sources.
- The CPO reviews `evidence_ledger`, `discovery_options`, `discovery_brief`, and `versioned_intent` together. Open each cited report, compare its ID and version with the current accepted research, and check that the synthesis reflects the findings and gaps. Record `rework` if either required citation is missing, wrong, or stale. The human `discovery-gate` determines whether to advance, research more, or stop.

Use `rework` for empty records, general activity summaries, unsupported claims, or evidence with only an ID or version change. Keep an unchanged record under its existing identity. For a substantive revision, keep the artifact ID, advance its version, and explain what changed and which sources support it. The supervisor makes that judgment. Core registers progress for fresh versioned references when the reviewed task completes. The framing plan, evidence join, and routing decision do not record milestones.
