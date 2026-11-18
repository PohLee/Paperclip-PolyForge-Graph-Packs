# Chief Marketing Officer

The JSON decision matrix is the runtime authority source. Out-of-scope decisions go to the CEO for routing or to the human owner when mandatory.

```json
{
  "schemaVersion": 1,
  "role": "cmo",
  "rules": [
    {
      "type": "acquisition-plan-disposition",
      "requiredEvidence": [
        "release_handoff",
        "acquisition_plan",
        "product_decision_refs",
        "risk_assessment"
      ],
      "modes": {
        "manual": {
          "allowedRoles": [
            "human-owner"
          ],
          "allowedKinds": [
            "human"
          ],
          "requiresHuman": true,
          "continueWhen": "Write a durable decision on pinned evidence within approved scope.",
          "escalateWhen": "Evidence is missing, P0/P1 is unresolved, authority is outside scope, or human approval is mandatory."
        },
        "assisted": {
          "allowedRoles": [
            "human-owner"
          ],
          "allowedKinds": [
            "human"
          ],
          "requiresHuman": true,
          "continueWhen": "Write a durable decision on pinned evidence within approved scope.",
          "escalateWhen": "Evidence is missing, P0/P1 is unresolved, authority is outside scope, or human approval is mandatory."
        },
        "autonomous": {
          "allowedRoles": [
            "cmo"
          ],
          "allowedKinds": [
            "agent",
            "human"
          ],
          "requiresHuman": false,
          "continueWhen": "Write a durable decision on pinned evidence within approved scope.",
          "escalateWhen": "Evidence is missing, P0/P1 is unresolved, authority is outside scope, or human approval is mandatory."
        }
      }
    },
    {
      "type": "marketing-outcome-disposition",
      "requiredEvidence": [
        "measurement_record",
        "outcome_assessment",
        "metric_source_status"
      ],
      "modes": {
        "manual": {
          "allowedRoles": [
            "human-owner"
          ],
          "allowedKinds": [
            "human"
          ],
          "requiresHuman": true,
          "continueWhen": "Write a durable decision on pinned evidence within approved scope.",
          "escalateWhen": "Evidence is missing, P0/P1 is unresolved, authority is outside scope, or human approval is mandatory."
        },
        "assisted": {
          "allowedRoles": [
            "human-owner"
          ],
          "allowedKinds": [
            "human"
          ],
          "requiresHuman": true,
          "continueWhen": "Write a durable decision on pinned evidence within approved scope.",
          "escalateWhen": "Evidence is missing, P0/P1 is unresolved, authority is outside scope, or human approval is mandatory."
        },
        "autonomous": {
          "allowedRoles": [
            "cmo"
          ],
          "allowedKinds": [
            "agent",
            "human"
          ],
          "requiresHuman": false,
          "continueWhen": "Write a durable decision on pinned evidence within approved scope.",
          "escalateWhen": "Evidence is missing, P0/P1 is unresolved, authority is outside scope, or human approval is mandatory."
        }
      }
    },
    {
      "type": "review-disposition",
      "requiredEvidence": [
        "artifact_version",
        "review_findings",
        "self_review_history"
      ],
      "modes": {
        "manual": {
          "allowedRoles": [
            "human-owner"
          ],
          "allowedKinds": [
            "human"
          ],
          "requiresHuman": true,
          "continueWhen": "Write a durable decision on pinned evidence within approved scope.",
          "escalateWhen": "Evidence is missing, P0/P1 is unresolved, authority is outside scope, or human approval is mandatory."
        },
        "assisted": {
          "allowedRoles": [
            "human-owner"
          ],
          "allowedKinds": [
            "human"
          ],
          "requiresHuman": true,
          "continueWhen": "Write a durable decision on pinned evidence within approved scope.",
          "escalateWhen": "Evidence is missing, P0/P1 is unresolved, authority is outside scope, or human approval is mandatory."
        },
        "autonomous": {
          "allowedRoles": [
            "cmo",
            "human-owner"
          ],
          "allowedKinds": [
            "agent",
            "human"
          ],
          "requiresHuman": false,
          "continueWhen": "Write a durable decision on pinned evidence within approved scope.",
          "escalateWhen": "Evidence is missing, P0/P1 is unresolved, authority is outside scope, or human approval is mandatory."
        }
      }
    },
    {
      "type": "acquisition-readiness-owner-review",
      "requiredEvidence": [
        "artifact_version",
        "review_findings",
        "self_review_history"
      ],
      "modes": {
        "manual": {
          "allowedRoles": [
            "human-owner"
          ],
          "allowedKinds": [
            "human"
          ],
          "requiresHuman": true,
          "continueWhen": "Write a durable decision on pinned evidence within approved scope.",
          "escalateWhen": "Evidence is missing, P0/P1 is unresolved, authority is outside scope, or human approval is mandatory."
        },
        "assisted": {
          "allowedRoles": [
            "human-owner"
          ],
          "allowedKinds": [
            "human"
          ],
          "requiresHuman": true,
          "continueWhen": "Write a durable decision on pinned evidence within approved scope.",
          "escalateWhen": "Evidence is missing, P0/P1 is unresolved, authority is outside scope, or human approval is mandatory."
        },
        "autonomous": {
          "allowedRoles": [
            "human-owner"
          ],
          "allowedKinds": [
            "human"
          ],
          "requiresHuman": true,
          "continueWhen": "Write a durable decision on pinned evidence within approved scope.",
          "escalateWhen": "Evidence is missing, P0/P1 is unresolved, authority is outside scope, or human approval is mandatory."
        }
      }
    }
  ]
}
```
