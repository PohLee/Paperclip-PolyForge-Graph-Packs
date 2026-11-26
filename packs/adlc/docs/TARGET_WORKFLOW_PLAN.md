# ADLC 目标工作流：可执行计划

来源：方案文档「ADLC 目标工作流方案」（rev 37，含 Astra 审查修订）。本计划把方案拆成可执行的工作包（WP），标明执行者、依赖、交付物和验收标准。

## 约定

- **执行者**：`agent` = 可由编码 agent 在仓库内完成；`human` = 只能由 owner 操作（账号、授权、付费、实测环境）；`agent+live` = 需要真实 Paperclip 实例。
- **仓库**：`Packs` = `Paperclip-PolyForge-Graph-Packs`；`Core` = 同级 `Paperclip-PolyForge-Graph`。
- **边界**：Backlog 存储和外部集成不进 Core 运行时；Pack 只声明角色、Graph、契约格式、证据格式和判定规则，不写具体模型、不枚举项目的环境 / mock / 执行平台。
- **版本**：Pack 文档改动升 Pack 版本；Graph schema 或行为改动升 Graph 版本，已有 run 保留旧 pin。改变既有 Graph 的输入或终态时发新版本，不原地修改。
- **验证**：`node --test`（需要同级 Core 源码）。每个 WP 都要有测试。

## 波次总览

| 波次 | 阶段 | 内容 | 可否现在执行 |
| --- | --- | --- | --- |
| W1 | P0 Pack 侧 | 契约校验器、契约目录规范与模板、配置与席位声明格式、文档、测试 | **可以，现在执行** |
| W0 | P0 人工 / 实测 | GitHub 组织与 App、MCP 挂载、运行时实测 | 需 owner |
| W2 | P1 | 产品链路 Graph、backlog skill、Creative 交接、最小契约合并动作、固定席位 | 等 W0 实测结果 |
| W3 | P2 | 技术链路 Graph、契约失效检查、动态席位与 fallback | 等 W2 |
| W4 | P3–P4 | 确定性风险规则、assisted / full-auto、G-T5 支线 | 等 W3 基线指标 |

---

## W1 · P0 Pack 侧（agent，Packs 仓库）

### WP1.1 契约校验器

在 `packs/adlc/product-method-contracts.mjs`（或同目录新文件，并从 `packs/adlc/index.mjs` 导出）新增纯函数校验器，风格与现有 `validateRequestBrief` 一致：校验失败抛 `Error`，成功返回原对象。

| 函数 | 校验对象 | 必须检查 |
| --- | --- | --- |
| `validateApprovalManifest` | G2 审批清单 | `id`、`version`；`deliverables[]` 每项有 `key`、`revisionId`、`digest`，key 唯一且至少包含 `prd` 和 `acceptance.feature`；`egmReportRef`；`unresolvedEscalations[]`；`assumptions[]`；`supersedes`（首版为 `null`，否则为非空字符串）；`approver` 不得在清单内自报（出现即报错，审批人只能来自 Host 运行记录） |
| `validateContractLock` | `contract.lock.json` | `contractId`（永久 ID）、`epic`、`backlogItemRef`、`approvalManifest {id, revisionId, digest}`、`supersedes`、`files[]`（`path`、`digest`、`section` ∈ `product` / `design` / `technical`），路径不越出所属 section 目录，path 唯一 |
| `validateContractIndexEntry` | `INDEX.json` 的一条 | `contractId`、`folder`（形如 `YYYY/MM/YYYY-MM-DD-<epic>-<ID>`，且年月与日期一致）、`status`（`active` / `superseded` / `withdrawn`）、`supersededBy`（仅 superseded 时必填） |
| `validateCompletionLedger` | 交付物完成台账 | `done[]`、`notDone[]`、`skipped[]`（每项带 `reason`）、`blocked[]`（每项带 `blockedBy`）、`unverified[]`（每项带 `reason`）；五组都必须出现，空组写 `[]`，不允许省略 |
| `validateReviewFindings` | 六维评审发现 | 每条 `dimension` ∈ `security` / `performance` / `logic` / `data-migration` / `tests` / `api-maintainability`；`severity` ∈ `P0`–`P3` 或 `nit`；`location`（`file:line`）、`trigger`、`verification`；P0 / P1 必须带 `reproduction`（可复现证据），否则校验失败；评审未运行时整体状态为 `not-run`，不得与“无发现”混同 |
| `validateVerificationManifest` | 验证证据清单 | `checkoutSha`；`expectedScenarios[]`（从已批准 BDD 枚举）；`dimensions[]`（项目声明的执行维度，可为空）；`results[]` 每条 `scenarioId`、维度组合、`result` ∈ `pass` / `fail` / `unverified`、`evidenceRefs[]`。另导出 `judgeVerificationManifest(manifest)`：预期集合中每个 scenario × 维度组合都必须有记录，缺记录、`not-run`、缺证据都判 `unverified`；返回 `{ status: 'pass' | 'fail' | 'unverified', gaps[] }` |
| `validateReturnRequest` | `clarification-request` / `spec-amendment-request` | `kind`、`question`、`evidence[]`、`options[]`、`impact`、`affectedTickets[]`、`owner`、`dueAt`、`resumeCondition`；`resolution` 若存在必须 ∈ `accepted` / `rejected` / `timed-out` / `superseded` |

### WP1.2 契约目录规范、写围栏与模板

- 新增 `packs/adlc/docs/CONTRACT_DIRECTORY.md`：目录结构（`<contracts_root>/INDEX.json`、`YYYY/MM/<首次发布日>-<epic>-<永久 ID>/`，含 `contract.lock.json`、`product/`、`design/`、`technical/`），不搬家、命名、版本、`supersedes` 并发规则、大文件、多 repo 规则。
- 新增路径围栏数据与函数：`contractPathFence`（角色 → 允许写入的 section），`checkContractPathFence({ role, changedFiles, contractsRoot })` 返回违规列表。规则：产品角色只写 `product/`；Creative 只写 `design/`；PE 只写 `technical/`；`contract.lock.json`、`INDEX.json`、CI 配置、CODEOWNERS 只能由合并 bot 写；开发角色不得写任何契约路径。
- 新增 `packs/adlc/templates/contracts/`：`INDEX.json`、`contract.lock.json` 示例、`CODEOWNERS.example`、空的 `product/`、`design/`、`technical/` 占位说明。示例必须能通过 WP1.1 校验器（测试覆盖）。
- 在文档中写明已知局限：免费组织私有仓库没有 protected branches / rulesets，路径围栏和 required checks 不由 GitHub 强制；合并 bot 自行检查，人或其他 token 仍可绕过。

### WP1.3 项目配置与席位声明格式

- 导出 `adlcProjectConfigSchema`（JSON Schema 对象，命名导出，不写入 Core 未支持的 `pack` 字段）：`contractsRoot`（默认 `docs/contracts`）、`backlog`（`provider: 'github-projects'`、`owner`、`projectNumber`、字段名映射：`agentPriority`、`humanPriority`、`sourceEventId`、`signalCount`、`distinctUsers`）、`approvers`（`g2`、`g3OutOfSystem`、`escalation`，单 owner 起步时可都指向同一身份）、`seats`（节点席位 → profile）、`profiles`（`harness`、`model`、`reasoning`、有序 `fallback[]`、`timeoutMs`、`budget`）、`automationMode` ∈ `manual` / `assisted` / `full-auto`、`neverAutoMerge`（默认开启的清单，可关闭）。
- 导出 `validateSeatDeclaration`：Pack 侧席位声明只允许 `name`、`distinctVendor`、`judgeVendorNotIn`、`minSeats`、`onUnavailable` ∈ `wait` / `block`、`waitDeadlineMs`；出现 `model` / `harness` 等具体值即报错（Pack 不写具体模型）。
- 导出 `resolveSeatOrder(layers)`：纯函数，按“单次 run 覆盖 → 项目节点席位 → 项目用途 profile → 公司 profile → Paperclip Agent 自身设置”合并，返回解析结果与来源层；未配置返回 `{ source: 'paperclip-agent' }`。只做解析，不调用 Paperclip。
- 导出 `checkSeatConstraints(assignments, declaration)`：校验厂商约束（`distinctVendor`、`judgeVendorNotIn`）和 `minSeats`；每次派发和 fallback 都应调用。

### WP1.4 文档与 README

- `packs/adlc/README.md`：新增一节简述新契约与校验器，链接 `CONTRACT_DIRECTORY.md` 和本计划；不改变现有 Graph 表。
- `packs/adlc/docs/EVIDENCE_CONTRACTS.md`：补充审批清单、验证证据清单、完成台账、六维评审发现、退回请求的字段和示例 JSON。
- 把本计划复制为 `packs/adlc/docs/TARGET_WORKFLOW_PLAN.md`。

### WP1.5 测试与发布

- 在 `test/` 新增测试，覆盖每个校验器的通过与失败用例，至少包括：审批清单缺 `acceptance.feature`、清单自报 approver、lock 文件路径越界、INDEX 年月与日期不符、台账省略空组、P1 发现缺复现证据、验证清单缺一个 scenario × 引擎组合判 `unverified`、席位声明写了具体模型、两个席位同厂商违反 `distinctVendor`、围栏拒绝开发角色写 `product/`、模板示例全部通过校验。
- 升 Pack 版本到 `adlc@0.3.13`，按仓库现有流程更新版本相关文件、构建产物与摘要（参考 `scripts/build-pack.mjs`、`test/runtime-digests.test.mjs`、`test/packaging-compatibility.test.mjs`）。不改任何既有 Graph 的版本或行为。
- 全量 `node --test` 通过。

### W1 验收

- 所有新增导出可从 `packs/adlc/index.mjs` 引入；现有测试和新增测试全部通过。
- 没有修改既有 Graph 定义、Core 仓库、Creative Pack、Marketing Pack。
- 交付完成台账：已完成 / 未完成 / 跳过（原因）/ 受阻（被什么阻塞）/ 未验证（原因）。

---

## W0 · P0 人工与实测（human / agent+live）

| WP | 执行者 | 内容 | 验收 |
| --- | --- | --- | --- |
| WP0.1 | human | 新建免费 GitHub 组织，移入 repo 与 Project（仓库保持私有，接受不强制执行的局限） | 组织 Project 可见，`projects_v2_item` webhook 可配置 |
| WP0.2 | human | 新建专用 GitHub App：Organization projects、Issues、Contents、Pull requests；安装到组织 | App token 能读写 Project 与开 PR |
| WP0.3 | human | 在 Paperclip 挂载 GitHub MCP `projects` toolset（现有 GitHub Connector 或自定义 MCP），确定凭证 | agent 能调用 `projects_get` / `projects_list` / `projects_write` |
| WP0.4 | agent+live | 实测：三个 adapter 是否读取任务级 `assigneeAdapterOverrides.adapterConfig` 的 model 与 effort，effort 字段名 | 每个 adapter 一份记录；不生效则改用“角色 × 模型组合建 Agent” |
| WP0.5 | agent+live | 实测：`config-schema` 是否列出可选模型；运行时能否回报实际 harness / 模型 | 记录结果，决定 `unverified` 记法 |
| WP0.6 | agent+live | 实测：`request_confirmation` 绑定 issue document revision 后，Core 是否消费结果、新 revision 是否使旧确认失效、能否核对解决人身份 | 记录结果；不满足时设计 Host 侧补偿 |
| WP0.7 | agent+live | 实测：Goldfish 隔离——带已知作者上下文的测试任务验证子任务是全新会话 | 记录结果 |

W0 的结果写回方案文档“待实测项”，作为 W2 设计输入。

---

## W2 · P1 产品链路（等 W0）

| WP | 仓库 | 内容 |
| --- | --- | --- |
| WP2.1 | Packs | `backlog-github-projects` skill：Item / Signal 模型、双优先级生效值、`Source Event ID` 去重、单写者串行入池、三种中间态对账、Issue 分流规则、未匹配 Signal 处理 |
| WP2.2 | Packs | G-P1：`request-triage` / `product-discovery` 新版本，加入 grill 决策树、72 小时 SLA（24h / 48h 提醒，产品方向类停 `needs-info`，其他带假设继续）、迟到答复归档 |
| WP2.3 | Packs | G-P2：基于 `competitive-watch` 的外部情报与重排；G1 覆盖任何入口产生的高成本 epic |
| WP2.4 | Packs | G-P3：`requirements-baseline` 新版本：小范围产品规格模板 / 大范围 arena、强制 EGM（小 2 轮 / 大 5 轮上限，四种处置）、G2 审批清单 gate；G2 决定同时满足原人工 CPO gate |
| WP2.5 | Packs (Creative) | 正式定义 Creative → ADLC 交接契约：G2 前交互活动（不依赖 baseline 和 BE 契约）、G3 视觉 manifest、超出 design system 交 owner |
| WP2.6 | Core | 最小契约合并 Host 动作：只合契约 PR；用 main 上的受信任校验；角色与审批人取自运行记录 |
| WP2.7 | Core | `request_confirmation` 与 Core 人工 gate 对接（按 WP0.6 结果） |
| WP2.8 | Core | 固定席位绑定（arena / EGM 用），按 WP0.4 结果实现 |

## W3 · P2 技术链路（等 W2）

| WP | 仓库 | 内容 |
| --- | --- | --- |
| WP3.1 | Packs | G-T1：`technical-design` 新版本（clarification-request 退回、SPEC-01..N、EGM implementation scope、G4 后技术契约单独 PR） |
| WP3.2 | Packs | G-T2：由技术契约合入触发；spike、拆 ticket、worktree + TDD、spec-amendment-request；保留 `implementation` 独立评审与 CTO 验收 |
| WP3.3 | Packs | G-T3：组合 `verification` + `code-delivery`；modernize、证据型评审循环（3 轮）、验证清单判定、风险评估、PR 引用契约须为当前有效版本 |
| WP3.4 | Packs | G-T4：bug 快线（triage 状态机、红测、无 BDD ID 时的 defect 验收 ID） |
| WP3.5 | Core | 契约失效检查：新版产品契约合入时暂停受影响工单、阻止旧 PR 合并；owner 紧急冻结 |
| WP3.6 | Core | 动态席位解析与 fallback（仅基础设施错误切换、每次重查厂商约束、等待截止时间） |

## W4 · P3–P4（等 W3 基线指标）

| WP | 内容 |
| --- | --- |
| WP4.1 | 确定性风险规则表；assisted 模式自动合并低风险 PR；G3 自动 gate |
| WP4.2 | G-T5a 架构改进、G-T5b retro + correct |
| WP4.3 | 评估一段时间后开放 full-auto |

每个波次开始前先给一项指标建立基线（gate 等待时间、rework 率、首次 CI 通过率、自动合并后的 revert 率），一次只加一个自动触发器。
