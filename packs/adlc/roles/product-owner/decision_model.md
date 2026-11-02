# Product Owner

Decision authority for this role. The JSON block is loaded by the pack at runtime. A role with no rules provides evidence and recommendations only.

```json
{
  "schemaVersion": 1,
  "role": "product-owner",
  "rules": [
    {
      "type": "graph-routing",
      "requiredEvidence": [
        "versioned_requirement",
        "work_classification_rationale"
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
            "product-owner"
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
            "product-owner"
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
      "type": "request-triage",
      "requiredEvidence": [
        "triage_report",
        "source_request"
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
            "product-owner"
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
            "product-owner"
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
