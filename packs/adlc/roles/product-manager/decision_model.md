# Product Manager

Decision authority for this role. The JSON block is loaded by the pack at runtime. A role with no rules provides evidence and recommendations only.

```json
{
  "schemaVersion": 1,
  "role": "product-manager",
  "rules": [
    {
      "type": "priority-adjustment",
      "requiredEvidence": [
        "current_priority",
        "tradeoffs",
        "affected_commitments"
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
          "continueWhen": "A durable Decision Record has been written and all required evidence points to the artifact version examined.",
          "escalateWhen": "Required evidence is missing, P0/P1 risk is unresolved without permitted acceptance, or actor authority is insufficient."
        },
        "assisted": {
          "allowedRoles": [
            "product-manager"
          ],
          "allowedKinds": [
            "agent",
            "human"
          ],
          "requiresHuman": false,
          "continueWhen": "A durable Decision Record has been written and all required evidence points to the artifact version examined.",
          "escalateWhen": "Required evidence is missing, P0/P1 risk is unresolved without permitted acceptance, or actor authority is insufficient."
        },
        "autonomous": {
          "allowedRoles": [
            "product-manager"
          ],
          "allowedKinds": [
            "agent",
            "human"
          ],
          "requiresHuman": false,
          "continueWhen": "A durable Decision Record has been written and all required evidence points to the artifact version examined.",
          "escalateWhen": "Required evidence is missing, P0/P1 risk is unresolved without permitted acceptance, or actor authority is insufficient."
        }
      }
    },
    {
      "type": "competitive-watch-routing",
      "requiredEvidence": [
        "competitive_diff"
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
          "continueWhen": "A durable Decision Record has been written and all required evidence points to the artifact version examined.",
          "escalateWhen": "Required evidence is missing, P0/P1 risk is unresolved without permitted acceptance, or actor authority is insufficient."
        },
        "assisted": {
          "allowedRoles": [
            "product-manager"
          ],
          "allowedKinds": [
            "agent",
            "human"
          ],
          "requiresHuman": false,
          "continueWhen": "A durable Decision Record has been written and all required evidence points to the artifact version examined.",
          "escalateWhen": "Required evidence is missing, P0/P1 risk is unresolved without permitted acceptance, or actor authority is insufficient."
        },
        "autonomous": {
          "allowedRoles": [
            "product-manager"
          ],
          "allowedKinds": [
            "agent",
            "human"
          ],
          "requiresHuman": false,
          "continueWhen": "A durable Decision Record has been written and all required evidence points to the artifact version examined.",
          "escalateWhen": "Required evidence is missing, P0/P1 risk is unresolved without permitted acceptance, or actor authority is insufficient."
        }
      }
    }
  ]
}
```

## Supervisor review

For an assigned `review-disposition`, include one evidence item for each required kind (`artifact_version`, `review_findings`, `self_review_history`).
Each item carries `subjectRefs: [{ artifactId, version }]` covering every current candidate artifact.
Copy `candidateRefs` from the supervisor review packet into each `subjectRefs`. When provided, attach `selfReviewRef` to the `self_review_history` item.
In manual mode the reviewer must also be an authenticated human owner.
See the [review handoff example](../../skills/review-handoff.md#supervisor-decision).
