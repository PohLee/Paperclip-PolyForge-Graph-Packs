# Design Director

Decision authority for this role. The JSON block is loaded by the pack at runtime. A role without rules provides evidence and recommendations only.

```json
{
  "schemaVersion": 1,
  "role": "design-director",
  "rules": [
    {
      "type": "product-design-acceptance",
      "requiredEvidence": [
        "brief_version",
        "design_spec",
        "review_evidence"
      ],
      "modes": {
        "manual": {
          "allowedRoles": [
            "human-owner",
            "design-director"
          ],
          "allowedKinds": [
            "human"
          ],
          "requiresHuman": true,
          "continueWhen": "A durable Decision Record cites the exact artifact versions and required evidence.",
          "escalateWhen": "Evidence is missing, the decision exceeds this role's authority, or a material risk has no authorized disposition."
        },
        "assisted": {
          "allowedRoles": [
            "design-director"
          ],
          "allowedKinds": [
            "agent",
            "human"
          ],
          "requiresHuman": false,
          "continueWhen": "A durable Decision Record cites the exact artifact versions and required evidence.",
          "escalateWhen": "Evidence is missing, the decision exceeds this role's authority, or a material risk has no authorized disposition."
        },
        "autonomous": {
          "allowedRoles": [
            "design-director"
          ],
          "allowedKinds": [
            "agent",
            "human"
          ],
          "requiresHuman": false,
          "continueWhen": "A durable Decision Record cites the exact artifact versions and required evidence.",
          "escalateWhen": "Evidence is missing, the decision exceeds this role's authority, or a material risk has no authorized disposition."
        }
      }
    },
    {
      "type": "compatible-design-change",
      "requiredEvidence": [
        "current_baseline",
        "proposed_delta",
        "impact_analysis"
      ],
      "modes": {
        "manual": {
          "allowedRoles": [
            "human-owner",
            "design-director"
          ],
          "allowedKinds": [
            "human"
          ],
          "requiresHuman": true,
          "continueWhen": "A durable Decision Record cites the exact artifact versions and required evidence.",
          "escalateWhen": "Evidence is missing, the decision exceeds this role's authority, or a material risk has no authorized disposition."
        },
        "assisted": {
          "allowedRoles": [
            "design-director"
          ],
          "allowedKinds": [
            "agent",
            "human"
          ],
          "requiresHuman": false,
          "continueWhen": "A durable Decision Record cites the exact artifact versions and required evidence.",
          "escalateWhen": "Evidence is missing, the decision exceeds this role's authority, or a material risk has no authorized disposition."
        },
        "autonomous": {
          "allowedRoles": [
            "design-director"
          ],
          "allowedKinds": [
            "agent",
            "human"
          ],
          "requiresHuman": false,
          "continueWhen": "A durable Decision Record cites the exact artifact versions and required evidence.",
          "escalateWhen": "Evidence is missing, the decision exceeds this role's authority, or a material risk has no authorized disposition."
        }
      }
    },
    {
      "type": "design-assurance-disposition",
      "requiredEvidence": [
        "fixed_subject_version",
        "review_scope",
        "independent_design_review",
        "detector_or_browser_evidence",
        "finding_dispositions"
      ],
      "modes": {
        "manual": {
          "allowedRoles": [
            "human-owner",
            "design-director"
          ],
          "allowedKinds": [
            "human"
          ],
          "requiresHuman": true,
          "continueWhen": "Write a durable Decision Record that cites the exact evidence and artifact versions for this disposition.",
          "escalateWhen": "Required evidence is missing, the subject version changed, or findings cannot be resolved within this role's authority."
        },
        "assisted": {
          "allowedRoles": [
            "design-director"
          ],
          "allowedKinds": [
            "agent",
            "human"
          ],
          "requiresHuman": false,
          "continueWhen": "Write a durable Decision Record that cites the exact evidence and artifact versions for this disposition.",
          "escalateWhen": "Required evidence is missing, the subject version changed, or findings cannot be resolved within this role's authority."
        },
        "autonomous": {
          "allowedRoles": [
            "design-director"
          ],
          "allowedKinds": [
            "agent",
            "human"
          ],
          "requiresHuman": false,
          "continueWhen": "Write a durable Decision Record that cites the exact evidence and artifact versions for this disposition.",
          "escalateWhen": "Required evidence is missing, the subject version changed, or findings cannot be resolved within this role's authority."
        }
      }
    },
    {
      "type": "web-design-disposition",
      "requiredEvidence": [
        "selected_concept_version",
        "design_baseline_version",
        "page_section_inventory",
        "desktop_and_mobile_candidate_versions",
        "fidelity_review",
        "content_state_review"
      ],
      "modes": {
        "manual": {
          "allowedRoles": [
            "human-owner",
            "design-director"
          ],
          "allowedKinds": [
            "human"
          ],
          "requiresHuman": true,
          "continueWhen": "Write a durable Decision Record for the exact candidate and baseline versions, citing every required review artifact.",
          "escalateWhen": "Required evidence is missing, the baseline or subject version changed, or findings exceed this role's authority."
        },
        "assisted": {
          "allowedRoles": [
            "design-director"
          ],
          "allowedKinds": [
            "agent",
            "human"
          ],
          "requiresHuman": false,
          "continueWhen": "Write a durable Decision Record for the exact candidate and baseline versions, citing every required review artifact.",
          "escalateWhen": "Required evidence is missing, the baseline or subject version changed, or findings exceed this role's authority."
        },
        "autonomous": {
          "allowedRoles": [
            "design-director"
          ],
          "allowedKinds": [
            "agent",
            "human"
          ],
          "requiresHuman": false,
          "continueWhen": "Write a durable Decision Record for the exact candidate and baseline versions, citing every required review artifact.",
          "escalateWhen": "Required evidence is missing, the baseline or subject version changed, or findings exceed this role's authority."
        }
      }
    },
    {
      "type": "saas-design-disposition",
      "requiredEvidence": [
        "creative_brief_version",
        "design_baseline_version",
        "screen_state_permission_matrix",
        "be_contract_review",
        "saas_design_version",
        "handoff_review"
      ],
      "modes": {
        "manual": {
          "allowedRoles": [
            "human-owner",
            "design-director"
          ],
          "allowedKinds": [
            "human"
          ],
          "requiresHuman": true,
          "continueWhen": "Write a durable Decision Record for the exact candidate and baseline versions, citing every required review artifact.",
          "escalateWhen": "Required evidence is missing, the baseline or subject version changed, or findings exceed this role's authority."
        },
        "assisted": {
          "allowedRoles": [
            "design-director"
          ],
          "allowedKinds": [
            "agent",
            "human"
          ],
          "requiresHuman": false,
          "continueWhen": "Write a durable Decision Record for the exact candidate and baseline versions, citing every required review artifact.",
          "escalateWhen": "Required evidence is missing, the baseline or subject version changed, or findings exceed this role's authority."
        },
        "autonomous": {
          "allowedRoles": [
            "design-director"
          ],
          "allowedKinds": [
            "agent",
            "human"
          ],
          "requiresHuman": false,
          "continueWhen": "Write a durable Decision Record for the exact candidate and baseline versions, citing every required review artifact.",
          "escalateWhen": "Required evidence is missing, the baseline or subject version changed, or findings exceed this role's authority."
        }
      }
    },
    {
      "type": "design-system-disposition",
      "requiredEvidence": [
        "expected_baseline_version",
        "proposed_design_system_version",
        "representative_validation",
        "accessibility_review",
        "migration_impact",
        "affected_consumers"
      ],
      "modes": {
        "manual": {
          "allowedRoles": [
            "human-owner",
            "design-director"
          ],
          "allowedKinds": [
            "human"
          ],
          "requiresHuman": true,
          "continueWhen": "Write a durable Decision Record for the exact candidate and baseline versions, citing every required review artifact.",
          "escalateWhen": "Required evidence is missing, the baseline or subject version changed, or findings exceed this role's authority."
        },
        "assisted": {
          "allowedRoles": [
            "design-director"
          ],
          "allowedKinds": [
            "agent",
            "human"
          ],
          "requiresHuman": false,
          "continueWhen": "Write a durable Decision Record for the exact candidate and baseline versions, citing every required review artifact.",
          "escalateWhen": "Required evidence is missing, the baseline or subject version changed, or findings exceed this role's authority."
        },
        "autonomous": {
          "allowedRoles": [
            "design-director"
          ],
          "allowedKinds": [
            "agent",
            "human"
          ],
          "requiresHuman": false,
          "continueWhen": "Write a durable Decision Record for the exact candidate and baseline versions, citing every required review artifact.",
          "escalateWhen": "Required evidence is missing, the baseline or subject version changed, or findings exceed this role's authority."
        }
      }
    },
    {
      "type": "minor-ui-design-disposition",
      "requiredEvidence": [
        "brief_version",
        "design_baseline_version",
        "minor_ui_candidate",
        "minor_ui_evaluation"
      ],
      "modes": {
        "manual": {
          "allowedRoles": [
            "human-owner",
            "design-director"
          ],
          "allowedKinds": [
            "human"
          ],
          "requiresHuman": true,
          "continueWhen": "A durable Decision Record cites the exact design, requirement, baseline, and review versions needed for this disposition.",
          "escalateWhen": "Evidence is missing or stale, independent review is unavailable, or the choice exceeds Design Director authority."
        },
        "assisted": {
          "allowedRoles": [
            "design-director"
          ],
          "allowedKinds": [
            "agent",
            "human"
          ],
          "requiresHuman": false,
          "continueWhen": "A durable Decision Record cites the exact design, requirement, baseline, and review versions needed for this disposition.",
          "escalateWhen": "Evidence is missing or stale, independent review is unavailable, or the choice exceeds Design Director authority."
        },
        "autonomous": {
          "allowedRoles": [
            "design-director"
          ],
          "allowedKinds": [
            "agent",
            "human"
          ],
          "requiresHuman": false,
          "continueWhen": "A durable Decision Record cites the exact design, requirement, baseline, and review versions needed for this disposition.",
          "escalateWhen": "Evidence is missing or stale, independent review is unavailable, or the choice exceeds Design Director authority."
        }
      }
    },
    {
      "type": "product-design-direction-disposition",
      "requiredEvidence": [
        "product_design_research",
        "wireframe_a",
        "wireframe_b",
        "direction_norms_review",
        "direction_fit_review",
        "blind_direction_evaluation"
      ],
      "modes": {
        "manual": {
          "allowedRoles": [
            "human-owner",
            "design-director"
          ],
          "allowedKinds": [
            "human"
          ],
          "requiresHuman": true,
          "continueWhen": "A durable Decision Record cites the exact design, requirement, baseline, and review versions needed for this disposition.",
          "escalateWhen": "Evidence is missing or stale, independent review is unavailable, or the choice exceeds Design Director authority."
        },
        "assisted": {
          "allowedRoles": [
            "design-director"
          ],
          "allowedKinds": [
            "agent",
            "human"
          ],
          "requiresHuman": false,
          "continueWhen": "A durable Decision Record cites the exact design, requirement, baseline, and review versions needed for this disposition.",
          "escalateWhen": "Evidence is missing or stale, independent review is unavailable, or the choice exceeds Design Director authority."
        },
        "autonomous": {
          "allowedRoles": [
            "design-director"
          ],
          "allowedKinds": [
            "agent",
            "human"
          ],
          "requiresHuman": false,
          "continueWhen": "A durable Decision Record cites the exact design, requirement, baseline, and review versions needed for this disposition.",
          "escalateWhen": "Evidence is missing or stale, independent review is unavailable, or the choice exceeds Design Director authority."
        }
      }
    },
    {
      "type": "ui-candidate-direction-selection",
      "requiredEvidence": [
        "product_design_direction",
        "candidate_direction_rationale",
        "comparison_criteria"
      ],
      "modes": {
        "manual": {
          "allowedRoles": [
            "human-owner",
            "design-director"
          ],
          "allowedKinds": [
            "human"
          ],
          "requiresHuman": true,
          "continueWhen": "A durable Decision Record cites the exact design, requirement, baseline, and review versions needed for this disposition.",
          "escalateWhen": "Evidence is missing or stale, independent review is unavailable, or the choice exceeds Design Director authority."
        },
        "assisted": {
          "allowedRoles": [
            "design-director"
          ],
          "allowedKinds": [
            "agent",
            "human"
          ],
          "requiresHuman": false,
          "continueWhen": "A durable Decision Record cites the exact design, requirement, baseline, and review versions needed for this disposition.",
          "escalateWhen": "Evidence is missing or stale, independent review is unavailable, or the choice exceeds Design Director authority."
        },
        "autonomous": {
          "allowedRoles": [
            "design-director"
          ],
          "allowedKinds": [
            "agent",
            "human"
          ],
          "requiresHuman": false,
          "continueWhen": "A durable Decision Record cites the exact design, requirement, baseline, and review versions needed for this disposition.",
          "escalateWhen": "Evidence is missing or stale, independent review is unavailable, or the choice exceeds Design Director authority."
        }
      }
    },
    {
      "type": "ui-candidate-set-disposition",
      "requiredEvidence": [
        "ui_candidate_shortlist",
        "candidate_review_refs",
        "selection_rationale"
      ],
      "modes": {
        "manual": {
          "allowedRoles": [
            "human-owner",
            "design-director"
          ],
          "allowedKinds": [
            "human"
          ],
          "requiresHuman": true,
          "continueWhen": "A durable Decision Record cites the exact design, requirement, baseline, and review versions needed for this disposition.",
          "escalateWhen": "Evidence is missing or stale, independent review is unavailable, or the choice exceeds Design Director authority."
        },
        "assisted": {
          "allowedRoles": [
            "design-director"
          ],
          "allowedKinds": [
            "agent",
            "human"
          ],
          "requiresHuman": false,
          "continueWhen": "A durable Decision Record cites the exact design, requirement, baseline, and review versions needed for this disposition.",
          "escalateWhen": "Evidence is missing or stale, independent review is unavailable, or the choice exceeds Design Director authority."
        },
        "autonomous": {
          "allowedRoles": [
            "design-director"
          ],
          "allowedKinds": [
            "agent",
            "human"
          ],
          "requiresHuman": false,
          "continueWhen": "A durable Decision Record cites the exact design, requirement, baseline, and review versions needed for this disposition.",
          "escalateWhen": "Evidence is missing or stale, independent review is unavailable, or the choice exceeds Design Director authority."
        }
      }
    },
    {
      "type": "ui-prototype-route",
      "requiredEvidence": [
        "ui_candidate_set",
        "finalist_candidate_refs",
        "comparison_criteria"
      ],
      "modes": {
        "manual": {
          "allowedRoles": [
            "human-owner",
            "design-director"
          ],
          "allowedKinds": [
            "human"
          ],
          "requiresHuman": true,
          "continueWhen": "A durable Decision Record cites the exact design, requirement, baseline, and review versions needed for this disposition.",
          "escalateWhen": "Evidence is missing or stale, independent review is unavailable, or the choice exceeds Design Director authority."
        },
        "assisted": {
          "allowedRoles": [
            "design-director"
          ],
          "allowedKinds": [
            "agent",
            "human"
          ],
          "requiresHuman": false,
          "continueWhen": "A durable Decision Record cites the exact design, requirement, baseline, and review versions needed for this disposition.",
          "escalateWhen": "Evidence is missing or stale, independent review is unavailable, or the choice exceeds Design Director authority."
        },
        "autonomous": {
          "allowedRoles": [
            "design-director"
          ],
          "allowedKinds": [
            "agent",
            "human"
          ],
          "requiresHuman": false,
          "continueWhen": "A durable Decision Record cites the exact design, requirement, baseline, and review versions needed for this disposition.",
          "escalateWhen": "Evidence is missing or stale, independent review is unavailable, or the choice exceeds Design Director authority."
        }
      }
    },
    {
      "type": "ui-design-selection-disposition",
      "requiredEvidence": [
        "ui_candidate_set",
        "selected_candidate_version",
        "selection_evidence",
        "design_decision_rationale"
      ],
      "modes": {
        "manual": {
          "allowedRoles": [
            "human-owner",
            "design-director"
          ],
          "allowedKinds": [
            "human"
          ],
          "requiresHuman": true,
          "continueWhen": "A durable Decision Record cites the exact design, requirement, baseline, and review versions needed for this disposition.",
          "escalateWhen": "Evidence is missing or stale, independent review is unavailable, or the choice exceeds Design Director authority."
        },
        "assisted": {
          "allowedRoles": [
            "design-director"
          ],
          "allowedKinds": [
            "agent",
            "human"
          ],
          "requiresHuman": false,
          "continueWhen": "A durable Decision Record cites the exact design, requirement, baseline, and review versions needed for this disposition.",
          "escalateWhen": "Evidence is missing or stale, independent review is unavailable, or the choice exceeds Design Director authority."
        },
        "autonomous": {
          "allowedRoles": [
            "design-director"
          ],
          "allowedKinds": [
            "agent",
            "human"
          ],
          "requiresHuman": false,
          "continueWhen": "A durable Decision Record cites the exact design, requirement, baseline, and review versions needed for this disposition.",
          "escalateWhen": "Evidence is missing or stale, independent review is unavailable, or the choice exceeds Design Director authority."
        }
      }
    }
  ]
}
```
