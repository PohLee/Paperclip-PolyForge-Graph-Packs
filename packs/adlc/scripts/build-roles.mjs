import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { roleCatalog, roleResponsibilities, decisionTypes } from '../roles/catalog.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const modes = ['manual', 'assisted', 'autonomous'];
const alwaysHuman = new Set(['product-scope-change', 'product-decision-replacement', 'discovery-disposition', 'experiment-disposition', 'requirements-acceptance', 'release-process-start', 'release-process-outcome']);
const assistedHuman = new Set(['architecture-acceptance', 'code-delivery-disposition', 'verification-acceptance', 'implementation-acceptance']);

for (const role of roleCatalog) {
  const dir = resolve(root, 'roles', role.id);
  mkdirSync(dir, { recursive: true });
  const header = `# ${role.name}\n\n`;
  writeFileSync(resolve(dir, 'soul.md'), header + role.soul + '\n');
  const manager = `\`${role.reportsToRole}\``;
  writeFileSync(resolve(dir, 'role.md'), header + role.role + `\n\n## Organization\n\nReports to ${manager}. This is the Paperclip manager relationship.\n\n## Artifact review\n\nDefault review escalation role: \`${role.supervisor}\`. Follow the assigned Graph node's reviewer for each artifact. Independent review uses an execution identity distinct from the author. An actual agent may hold multiple roles.\n`);
  writeFileSync(resolve(dir, 'goal.md'), header + role.goal + '\n');
  const responsibilities = roleResponsibilities[role.id];
  if (!Array.isArray(responsibilities) || responsibilities.length === 0) throw new Error(`Missing responsibilities: ${role.id}`);
  const duties = responsibilities.map(item => `- ${item}`).join('\n');
  writeFileSync(resolve(dir, 'instruction.md'), header + `## Work\n\n${role.method}\n\n## Entry point\n\nFor an ordinary Paperclip issue, select the applicable entry. Discovery gathers sourced intent, assumptions, constraints, and open decisions before product approval. Feature or defect execution identifies the affected feature, active product decision, versioned requirement, and applicable Graph; ask the CPO for a decision before changing unapproved behavior. Release preparation needs an accepted fixed candidate, and release observation needs a host-supplied execution event plus linked plan and authorization. Production monitoring needs a versioned monitoring plan and sourced observation window. Start a Graph only when the host binds your role, required inputs, and permissions. For an assigned Graph child issue, follow its pinned run, node, attempt, and reviewer; submit only that node's versioned outputs.\n\n## Responsibilities\n\n${duties}\n\n## Capability check\n\nBefore a step that needs an external skill, tool, account, or delegated runtime, verify the host has actually bound that capability and permission. If unavailable, use the bundled method where applicable, record the unavailable capability and unverified work, and escalate when completion criteria cannot be met. A named external skill is a conditional requirement, not proof of installation.\n\n## Coordination\n\nUse the organizational reporting line in [role.md](role.md) for management. Send artifact reviews to the reviewer specified by the active Graph node.\n\n## Handoff\n\nName exact input and output artifact versions. Cite active product decisions and history for affected features. Record every explicit decision with the actor identity, role, mode, rule version, evidence, rationale and outcome before relying on it. Keep superseded decisions and stale reports linked in history. Follow [decision_model.md](decision_model.md) for authority.\n`);
  appendFileSync(resolve(dir, 'instruction.md'), '\n## Company scope\n\nRead the CEO goal and pinned OKR plan before acting. A request outside this role is rejected with a recorded reason and routed to the company CEO for reassignment. CEO plan edits apply only to NEW tasks; the current attempt retains its pinned goal and plan. The company binds one CEO across all Packs. The host binds the shared project identity so ADLC and Marketing work may refer to the same project. Preserve every product decision and its supersession history. Independent review uses a fresh Sub-Agent task session with a distinct execution identity. For bounded research or analysis that needs the current task context, open a same-Agent Shadow-Agent snapshot; its parent summary is advisory and Core-selected decisions provide authority. Compare contradictions and report them to the parent. Read the bundled `temporary-agent-snapshot` skill when delegating. Both temporary executions close after the task, retain audit and hold no organizational position.\n');
  const rules = role.rules.map(type => {
    const { evidence } = decisionTypes[type];
    return {
      type,
      requiredEvidence: evidence,
      modes: Object.fromEntries(modes.map(mode => {
        const requiresHuman = mode === 'manual' || alwaysHuman.has(type) || (mode === 'assisted' && assistedHuman.has(type));
        return [mode, {
          allowedRoles: requiresHuman ? ['human-owner'] : type === 'review-disposition' ? ['cpo', 'cto-caio', 'principal-engineer', 'product-manager'] : [role.id],
          allowedKinds: requiresHuman ? ['human'] : ['agent', 'human'],
          requiresHuman,
          continueWhen: 'A durable Decision Record has been written and all required evidence points to the artifact version examined.',
          escalateWhen: 'Required evidence is missing, P0/P1 risk is unresolved without permitted acceptance, or actor authority is insufficient.'
        }];
      }))
    };
  });
  const model = { schemaVersion: 1, role: role.id, rules };
  writeFileSync(resolve(dir, 'decision_model.md'), header + 'Decision authority for this role. The JSON block is loaded by the pack at runtime. A role with no rules provides evidence and recommendations only.\n\n```json\n' + JSON.stringify(model, null, 2) + '\n```\n');
}
