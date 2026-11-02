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
