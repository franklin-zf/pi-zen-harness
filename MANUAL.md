# Pi-Zen Engineering Harness (`mini-pi-agent` v2.1) 完整操作手册

> **核心定位**：基于开源 **Pi Harness (`@mariozechner/pi-coding-agent`)** 极简可扩展底座，融合 **[exp-skill](https://github.com/franklin-zf/exp-skill)** 角色治理、**“代码之禅”** 六大研发戒律与 **[Design Skill (v4.0)](file:///Users/zhangfeng/.gemini/config/skills/design/SKILL.md)** 视觉审美系统的通用工程研发 Harness Agent。
> **两大总纲**：**奥卡姆剃刀原则（如无必要，勿增实体）** + **第一性原理（直击输入、状态变换与输出本质）**。

---

## 目录

1. [项目目录与核心模块全景](#1-项目目录与核心模块全景)
2. [环境要求与大模型配置](#2-环境要求与大模型配置)
3. [四种运行模式全解](#3-四种运行模式全解)
4. [7 阶段端到端研发 SOP 实战指南](#4-7-阶段端到端研发-sop-实战指南)
5. [6 大确定性门禁评分规则与排错字典](#5-6-大确定性门禁评分规则与排错字典)
6. [6 大原子工具与硬件安全守卫速查](#6-6-大原子工具与硬件安全守卫速查)
7. [双记忆飞轮与断点续跑机制](#7-双记忆飞轮与断点续跑机制)

---

## 1. 项目目录与核心模块全景

```text
mini-pi-agent/
├── agent.ts                        # 主入口：支持 CLI (init/check/sop) 与交互式 REPL 终端
├── tools.ts                        # 6 大原子工具定义、路径白名单守卫 (verifyPathPermission) 与超时控制
├── mock-test.ts                    # 零 API 依赖的全流程 7 阶段 SOP 端到端闭环沙盘演练脚本
├── package.json                    # 项目配置（零第三方运行时依赖）
├── README.md                       # 快速概览
├── MANUAL.md                       # 本完整操作手册
├── .pi/
│   └── extensions/
│       └── pi-zen.ts               # 官方开源 @mariozechner/pi-coding-agent (pi CLI) 原生扩展插件
├── harness/                        # Harness 核心引擎层
│   ├── types.ts                    # 7 阶段状态机、TaskPacket、ContentHandoff 2.1、记忆与检查点类型定义
│   ├── orchestrator.ts             # Lead Orchestrator 7 阶段确定性状态机与脚手架引擎
│   ├── subagent.ts                 # 物理隔离的子专家派发器 + run_bash 越界写自动回滚守卫
│   ├── zen-checker.ts              # 确定性门禁引擎（PRD/Plan/Code Zen/Acceptance/真实测试执行/Tree Digest）
│   ├── design-bridge.ts            # Design Skill v4.0 桥接器（Content Handoff 2.1 校验 + UI Sloplint）
│   └── memory.ts                   # 原子防符号链接写入 + 错题本 (bug-ledger.md) + 范式库 (pattern-catalog.md) + 状态快照 (state.json)
├── kernels/                        # 按角色渐进披露的能力内核契约 (<50 行/文件，零上下文污染)
│   ├── ceo-soul.md                 # 第一性原理五步裁剪算法 + 最小实体审计 (drop_test / merge_test)
│   ├── product-soul.md             # 一句话产品承诺 + 零配置偏好 + 全链路五态交互矩阵 + Taste Contract
│   ├── architect-soul.md           # 两层扁平架构 + Lean Schema 零预留字段 + 7 维业务规则矩阵 + 垂直切片
│   ├── ui-designer-soul.md         # Design v4.0 四大流派 + 同心圆角光学公式 + 50+ 字符抗挤压防御布局
│   ├── zen-coder.md                # 代码之禅六大戒律 + 公共测试接缝红绿 TDD 铁律
│   └── qa-auditor.md               # 三权分立铁律 + 三轴独立验收 + 缺陷闭环预算控制
├── templates/                      # 3+1 权威契约文档标准模板
│   ├── prd.md                      # 权威契约 1/3：需求分析报告与产品 PRD
│   ├── plan.md                     # 权威契约 2/3：工程架构与垂直切片研发计划
│   ├── acceptance.md               # 权威契约 3/3：全量测试、三轴审计与部署验收报告（默认 PENDING 拒绝态）
│   └── content-handoff.json        # 权威契约 +1：Design v4.0 跨角色内容交接协议 (Schema 2.1)
└── tests/
    └── harness.test.ts             # 10 项全维度单元测试套件（覆盖 BR-1..BR-7、P0-1..P2-1 与 Pi 扩展）
```

---

## 2. 环境要求与大模型配置

### 2.1 运行环境要求
- **Node.js**：建议使用 `v22.6+` 或 `v25+`（支持原生直接执行 `.ts` 文件与内置 `node --test`，无需编译构建步骤）。
- 在当前 macOS 环境中，Node.js 位于 `/opt/homebrew/bin/node`（`v25.2.1`）。
- **可选（仅当需要生成 Design v4.0 审美种子或 Studio 矩阵时）**：`python3`（用于调用 `/Users/zhangfeng/.gemini/config/skills/design/scripts/design_Lock.py`）。

### 2.2 大模型环境变量配置
系统底层使用 Node.js 原生 `fetch` 调用兼容 OpenAI Chat Completions 规范的接口，支持 **DeepSeek、OpenAI、Claude 代理、通义千问、本地 Ollama / vLLM** 等任意模型：

```bash
# 方案 A：使用 DeepSeek
export OPENAI_API_KEY="sk-xxxxxxxxxxxxxxxx"
export OPENAI_BASE_URL="https://api.deepseek.com/v1"
export MODEL_NAME="deepseek-chat"

# 方案 B：使用 OpenAI
export OPENAI_API_KEY="sk-xxxxxxxxxxxxxxxx"
export OPENAI_BASE_URL="https://api.openai.com/v1"
export MODEL_NAME="gpt-4o"

# 方案 C：使用本地 Ollama（无需 API Key）
export OPENAI_BASE_URL="http://127.0.0.1:11434/v1"
export MODEL_NAME="qwen2.5-coder:32b"
```

---

## 3. 四种运行模式全解

首先进入项目目录：
```bash
cd /Users/zhangfeng/Downloads/Personal-Code/GitHub/LLM/mini-pi-agent
```

### 模式一：CLI 单次命令模式（脚手架 / 门禁审计 / 一键 SOP）

| 场景 | 命令格式 | 说明 |
| :--- | :--- | :--- |
| **初始化项目契约脚手架** | `/opt/homebrew/bin/node agent.ts init <目标项目路径> [--ui]` | 在目标项目下自动生成 `docs/prd.md`、`docs/plan.md`、`docs/acceptance.md`、`.pi-zen/memory/bug-ledger.md`、`.pi-zen/memory/pattern-catalog.md`。加 `--ui` 时额外生成 `docs/content-handoff.json`。 |
| **执行全量确定性门禁审计** | `/opt/homebrew/bin/node agent.ts check <目标项目路径> [--ui]` | 对目标项目执行 `PRD`、`Plan`、`Code Zen`、`Acceptance`（以及 `--ui` 下的 `Handoff` 与 `UI Sloplint`）门禁打分，全部通过返回退出码 `0`，任一失败返回 `1`（可直接挂入 CI/CD）。 |
| **一键启动 7 阶段研发 SOP** | `/opt/homebrew/bin/node agent.ts sop "<需求描述>" [目标项目路径] [--ui]` | 启动完整 7 阶段研发流水线，在 **Gate 1（确认 PRD）** 和 **Gate 2（确认部署）** 自动暂停并提示人工确认。 |

### 模式二：交互式 REPL 终端模式

启动命令：
```bash
# 后端/CLI 工程模式
/opt/homebrew/bin/node agent.ts

# 带前端/UI 产品的全栈模式（激活 Design Skill v4.0 门禁）
/opt/homebrew/bin/node agent.ts --ui
```

进入 `👤 用户 >` 提示符后，支持以下**内置斜杠指令**与**自由对话**：
- `/init`：在当前工作目录初始化 `3+1` 权威契约文档与 `.pi-zen/memory/` 双记忆库。
- `/sop <需求描述>`：立即以当前目录为工作区，启动 7 阶段全流程工程研发 SOP 状态机。
- `/check`：立即对当前工作目录运行全套确定性质量门禁并打印得分报告。
- `/bugs`：查看 `.pi-zen/memory/bug-ledger.md` 中沉淀的历史 Bug 根因与修复配方。
- `/patterns`：查看 `.pi-zen/memory/pattern-catalog.md` 中沉淀的高分架构与公共接缝范式。
- **直接输入自然语言指令**（例如：`帮我检查 src/ 目录的代码之禅合规度并修复空 catch 块`）：启动极简 ReAct 循环自动调用 6 大原子工具完成任务。
- `exit` 或 `quit`：退出终端。

### 模式三：官方开源 `pi` CLI (`@mariozechner/pi-coding-agent`) 插件模式

如果你安装了开源 Pi CLI (`npm install -g @mariozechner/pi-coding-agent`)，可以直接将本系统作为原生 Extension 挂载到任何工程仓库：

```bash
# 在 mini-pi-agent 目录内直接运行 pi（会自动发现 .pi/extensions/pi-zen.ts）：
pi

# 在电脑上的任意其他工程目录运行 pi 并挂载 Pi-Zen 扩展：
cd /path/to/any-project
pi -e /Users/zhangfeng/Downloads/Personal-Code/GitHub/LLM/mini-pi-agent/.pi/extensions/pi-zen.ts
```

在官方 `pi` TUI 界面中即可使用：
- `/zen-init [--ui]`：初始化 `docs/` 权威契约与 `.pi-zen/memory/` 记忆库。
- `/zen-check [--ui]`：运行全套确定性门禁并在通知栏显示得分。
- `/zen-role <角色名> <允许路径逗号分隔>`：例如 `/zen-role zen-implementer src,tests`，立即在 `pi` 的 `tool_call` 钩子层开启硬件级路径白名单与三权分立拦截。
- `/zen-memory`：查看当前项目的错题本与架构范式库统计。
- 同时大模型在 `pi` 中会自动获得 `run_zen_gate` 和 `run_design_skill` 两个工具。

### 模式四：作为 TypeScript SDK 在代码中编程调用

你可以在自动化脚本或自定义评测流水线中直接导入 `orchestrator.ts`：

```typescript
import { runEngineeringSopPipeline, runAllProjectGates } from "./harness/orchestrator.ts";
import { callLLM } from "./agent.ts";

const result = await runEngineeringSopPipeline({
  userRequirement: "实现一个高并发幂等订单状态机模块",
  projectRoot: "/path/to/target-project",
  uiEnabled: false,
  callLLM,
  maxQaIterations: 3,
  callbacks: {
    onPhaseStart: (phase, desc) => console.log(`[Phase] ${phase}: ${desc}`),
    onGateReport: (phase, report) => console.log(`[Gate] ${phase}: score=${report.score}`),
    confirmPrd: async (prdContent) => ({ approved: true }), // 或自定义审批逻辑
    confirmDeploy: async (accContent, treeDigest) => true,
  },
});
```

---

## 4. 7 阶段端到端研发 SOP 实战指南

当你执行 `/sop <需求描述>` 或 `node agent.ts sop "<需求描述>"` 时，系统将严格按以下 **7 个阶段 + 2 个人工确认门禁** 推进：

### Phase 1 & Phase 2：需求评估、最小实体审计与产品 PRD 生成 (`evaluate_and_prd`)
1. **自动召回错题本**：主控自动检索 `.pi-zen/memory/bug-ledger.md`，将历史高频缺陷注入子专家上下文，防止重蹈覆辙。
2. **物理隔离派发 `product-kernel`（融合 `ceo-soul.md` + `product-soul.md`）**：
   - 执行**第一性原理五步裁剪算法**：质疑假设 $\rightarrow$ 删除实体（对每个候选实体执行 `drop_test` 删除测试与 `merge_test` 合并测试）$\rightarrow$ 简化闭环 $\rightarrow$ 识别唯一控制性瓶颈 $\rightarrow$ 最后自动化。
   - 声明**产品奥卡姆剃刀四要素**：一句话产品承诺、`Single Primary Flow`、`Zero-Config Preference`、`Surface Minimization` 以及明确的 `Non-Goals`（故意不做什么）。
   - 定义**全链路五态交互矩阵**（空态、加载态、成功态、错误态、降级态）。
   - 若开启 `--ui`，同步生成 `Taste Contract` 五要素审美契约与 `docs/content-handoff.json`（标记 `[Global: Host-level]` / `[Asset: Data-level]` / `[Plugin: Private-level]` 作用域）。
3. **硬件门禁校验**：自动运行 [`checkPrdGate`](file:///Users/zhangfeng/Downloads/Personal-Code/GitHub/LLM/mini-pi-agent/harness/zen-checker.ts#L87-L198)，不达标立即报错拦截。

### 🛑 Gate 1：用户确认产品功能、目标与 UI 方向 (`user_confirm_prd`)
- 终端展示生成的 `docs/prd.md` 核心内容并提示：
  `🛑 [Gate 1 确认断点] 是否确认上述产品功能、目标与 UI 方向？(y/修订意见) >`
- **操作方式**：
  - 输入 `y` 或直接回车：锁定需求契约，进入 Phase 3。
  - 输入具体的修订意见（如：`砍掉历史趋势图表，只保留实时 P95 卡片`）：系统将携带你的反馈重新回到 Phase 1/2 迭代修订 `docs/prd.md`，直到你确认通过。

### Phase 3：工程架构与垂直切片研发计划 (`design_plan`)
- 派发独立子专家 `architect-kernel`（加载 `architect-soul.md`）：
  - **两层扁平架构**：默认强制采用 `Entrypoint/UI -> Core Domain` 两层结构，不到 $\ge 3$ 个真实复用点严禁引入 `Factory`/`Adapter`/`Strategy` 包装类。
  - **Lean Schema 零预留字段**：严禁在数据模型或接口中定义 `ext_json`、`extra_data`、`reserved_*` 等投机性字段。
  - **7 维业务规则矩阵 (`BR-1..BR-7`)**：逐一明确正常路径、非法输入、边界极值、权限隔离、幂等重试、并发原子性与依赖超时降级的落点与测试计划。
  - **垂直研发切片 (`SLC-001..N`)**：将所有 `REQ-NNN` 拆解为端到端可独立验证的垂直切片，每个切片明确声明 `Allowed Paths`（允许修改路径白名单）、`Highest Stable Seam`（最高稳定公共测试接缝）与 `Verification Command`（真实测试命令）。
- 自动运行 [`checkPlanGate`](file:///Users/zhangfeng/Downloads/Personal-Code/GitHub/LLM/mini-pi-agent/harness/zen-checker.ts#L203-L285)，确保 PRD 中的每一个 `REQ-NNN` 100% 被垂直切片覆盖。

### Phase 4：按垂直切片执行红绿 TDD 与 UI 构建 (`execute_slices`)
- 主控遍历 `docs/plan.md` 中的每一个垂直切片 `SLC-NNN`，为每个切片派生一个**全新、只带该切片上下文与 `Allowed Paths` 锁**的子专家（`zen-implementer` 或 `ui-specialist`）：
  1. **RED（先行编写失败测试）**：在 `Highest Stable Seam` 编写覆盖正常路径与 `BR-2..BR-7` 异常边界的自动化测试。
  2. **GREEN（最简扁平实现）**：编写无嵌套地狱、无空 `catch {}` 的实现代码使测试变绿。
  3. **UI 五态与光学精工（`--ui` 模式）**：严格按 `docs/content-handoff.json` 渲染真实指标，执行同心圆角公式 $R_{\text{inner}} = R_{\text{outer}} - \text{Padding}$ 与 50+ 字符抗挤压布局（`min-width: 0`）。
  4. **硬件越界防护**：子专家若试图修改 `docs/prd.md`、`docs/acceptance.md` 或白名单之外的文件（无论通过 `write_file` 还是 `run_bash` 重定向），均被硬件拦截或瞬间回滚。

### Phase 5：独立 QA 全量三轴测试与硬件验真 (`full_test_qa`)
- 派发与实现者完全隔离的 `independent-qa` 子专家（仅允许写入 `docs/acceptance.md`），叠加系统级确定性门禁，执行**四重验真**：
  1. **真实测试命令硬件执行 ([`verifyPlanTestCommandsExecution`](file:///Users/zhangfeng/Downloads/Personal-Code/GitHub/LLM/mini-pi-agent/harness/zen-checker.ts#L636-L678))**：主控在真实终端执行 `plan.md` 中每个切片的 `Verification Command`，校验退出码必须为 `0`。
  2. **Axis A — 规格与 7 维 BR 跨契约核验 ([`checkAcceptanceGate`](file:///Users/zhangfeng/Downloads/Personal-Code/GitHub/LLM/mini-pi-agent/harness/zen-checker.ts#L509-L630))**：核验三权分立签名（QA 严禁等于 Implementer）、所有 `REQ-NNN` 测试证据链，以及 `plan.md` 与 `acceptance.md` 之间 `BR-1..BR-7` 强制属性的零降级对齐。
  3. **Axis B — 代码之禅静态扫描 ([`checkCodeZenGate`](file:///Users/zhangfeng/Downloads/Personal-Code/GitHub/LLM/mini-pi-agent/harness/zen-checker.ts#L290-L436))**：扫描全仓代码，拦截空 `catch {}`、预留字段 `ext_json`、过度包装类与深层缩进。
  4. **Axis C — Design v4.0 作用域与 Sloplint 审计 (`--ui` 模式)**：运行 [`validateContentHandoff`](file:///Users/zhangfeng/Downloads/Personal-Code/GitHub/LLM/mini-pi-agent/harness/design-bridge.ts#L22-L120)（拦截私有指标泄漏到宿主大盘）与 [`checkUiDesignGate`](file:///Users/zhangfeng/Downloads/Personal-Code/GitHub/LLM/mini-pi-agent/harness/design-bridge.ts#L125-L214)（拦截 `01 // LABEL` 印章泛滥、`lorem ipsum` 假文案与 `backdrop-filter` 过载）。

### Phase 6：Bug 迭代修复与错题本沉淀闭环 (`iterate_bug_fix`)
- 若 Phase 5 中任一门禁未通过或 `docs/acceptance.md` 的 `Findings` 表中存在未关闭的 `blocking` / `major` 缺陷：
  1. 状态机自动转入 `iterate_bug_fix`，汇总所有结构化 Finding 与门禁报错。
  2. 派生窄域修复子专家，针对每一项缺陷编写复现回归测试并定向修复代码（**严禁实现者自己把 `acceptance.md` 里的缺陷改成 `closed`**）。
  3. 修复完成后，系统自动将本次缺陷的 `Symptom`、`Root Cause` 与 `Fix Recipe` 幂等写入 `.pi-zen/memory/bug-ledger.md` 错题本。
  4. 自动重新进入下一轮 Phase 5，由独立 QA 复验通过后方可签署 `Decision: PASS`。

### Phase 7 & 🛑 Gate 2：净室审计与最终部署验收 (`deploy_acceptance`)
1. **净室清理与 `SHA-256` 工作树摘要绑定**：自动清理 `.DS_Store`、`*.tmp`、`*.bak` 等杂物，计算 `Allowed Paths` 下所有交付物源码与测试的确定性 `sha256:...` 摘要并写入 `docs/acceptance.md` 的 `Tree Digest` 字段。
2. **架构范式入库**：将本次通过三轴验收的两层扁平架构与公共测试接缝自动记入 `.pi-zen/memory/pattern-catalog.md`。
3. **Gate 2 人工部署确认**：终端打印最终门禁全绿报告与 `Tree Digest`，确认后完成全部交付。

---

## 5. 6 大确定性门禁评分规则与排错字典

当运行 `node agent.ts check` 出现 `❌ FAIL` 时，可对照下表快速定位修复：

| 门禁名称 | 检查目标文件 | 常见报错信息 | 修复方法 |
| :--- | :--- | :--- | :--- |
| **`PRD`** | `docs/prd.md` | `缺少产品奥卡姆剃刀 '- Single Primary Flow:' 声明` | 在 `## 产品奥卡姆剃刀与取舍` 下补齐 `- Single Primary Flow:`、`- Zero-Config Preference:`、`- Surface Minimization:`。 |
| **`PRD`** | `docs/prd.md` | `实体 'XXX' 包含疑似过度设计的预留理由` | 检查 `Minimal-Entity Audit` 表，删除任何以 `reserved for future` / `for symmetry` 为理由的冗余实体，或将其 `Decision` 改为 `pruned`。 |
| **`PLAN`** | `docs/plan.md` | `PRD 中的需求 'REQ-002' 未被任何垂直切片覆盖` | 在 `docs/plan.md` 的 `Vertical Slices` 表中将 `REQ-002` 加入对应 `SLC-NNN` 的 `Included Requirements` 列。 |
| **`CODE`** | 业务源码 (`*.ts` 等) | `违反代码之禅 [显式与零静默] — 检测到空的 catch {} 块` | 在 `catch (err)` 中显式向上抛出带上下文的错误，或返回显式降级结果，严禁静默吞没异常。 |
| **`CODE`** | 业务源码 (`*.ts` 等) | `违反奥卡姆剃刀 [Lean Schema] — 检测到预留字段 (ext_json)` | 从接口/Schema 中删除 `ext_json`、`extra_data`、`reserved_field`、`custom_fields` 等未使用的预留字段。 |
| **`HANDOFF`** | `docs/content-handoff.json` | `[FAIL-CLOSED BLOCK] 宿主大盘严禁消费插件私有指标` | 将 `host_dashboard` 表面下 `context_scope: "[Plugin: Private-level]"` 的卡片移入插件详情抽屉表面，或修正其真实作用域。 |
| **`UI`** | 前端源码 (`*.html`/`*.tsx`/`*.css`) | `[AI-Slop 拦截] 检测到 N 处 '01 // LABEL' 机械编号角标` | 删除超过 1 处的机械序号角标，清理 `lorem ipsum` / `TODO` 占位文案，确保同屏 `backdrop-filter` 不超过 2 处。 |
| **`ACCEPTANCE`** | `docs/acceptance.md` | `违反三权分立铁律 — Independent QA 不能同时是代码实现者` | 确保 `Independent QA` 字段填写的身份标识不在 `Implementation contributors` 列表中。 |
| **`ACCEPTANCE`** | `docs/acceptance.md` | `[P0-2 Cross-Contract Violation] 业务规则 'BR-X' 在 plan.md 中为适用(Yes)` | 严禁在 `acceptance.md` 中把 `plan.md` 要求强制验证的 `BR-X` 降级为 `Mandatory: No`，必须补充真实测试证据并通过验证。 |

---

## 6. 6 大原子工具与硬件安全守卫速查

Agent 运行时仅暴露以下 6 个正交原子工具（定义于 [tools.ts](file:///Users/zhangfeng/Downloads/Personal-Code/GitHub/LLM/mini-pi-agent/tools.ts)）：

1. **`read_file`**：读取文件内容，支持 `startLine` / `endLine` 按行切片读取以节省上下文 Token。
2. **`write_file`**：底层调用 [`writeFileAtomic`](file:///Users/zhangfeng/Downloads/Personal-Code/GitHub/LLM/mini-pi-agent/harness/memory.ts#L31-L44)（临时文件写入 + `renameSync` 原子替换），自动拦截符号链接逃逸（`BR-4`/`BR-6`）与非白名单路径写入。
3. **`edit_file`**：精确替换目标文本片段，遵循代码之禅最小修改原则，同样受 `verifyPathPermission` 路径白名单与三权分立保护。
4. **`run_bash`**：内置 `30s` 超时保护、危险命令拦截（拦截 `rm -rf /`、`git push --force`）以及子专家执行前后的**工作区快照比对与越界写自动回滚（[`enforceWorkspaceScopeAfterTool`](file:///Users/zhangfeng/Downloads/Personal-Code/GitHub/LLM/mini-pi-agent/harness/subagent.ts#L59-L108)）**。
5. **`run_zen_gate`**：一键执行 `prd` | `plan` | `code` | `handoff` | `ui` | `acceptance` 六大确定性门禁并返回结构化 JSON 诊断。
6. **`run_design_skill`**：直接桥接 [Design Skill v4.0](file:///Users/zhangfeng/.gemini/config/skills/design/SKILL.md)，支持：
   - `action: "studio"`：生成 4 大流派 × 3 大光学/结构引擎发散矩阵。
   - `action: "seed"`：获取确定性审美种子（色板、字体配对、网格与动效曲线）。
   - `action: "sloplint"`：对 UI 目录执行反 AI 塑料感与抗挤压扫描。
   - `action: "validate_handoff"`：校验 `docs/content-handoff.json` 作用域安全。

---

## 7. 双记忆飞轮与断点续跑机制

系统在目标项目根目录下自动维护 `.pi-zen/` 状态目录：

1. **工程错题本 (`.pi-zen/memory/bug-ledger.md`)**：
   - 每当 Phase 5/6 捕获并修复真实缺陷后，自动按 `ID | Status | Tags | Symptom | Root Cause | Fix Recipe | Commit/Slice | Updated At` 格式幂等写入（相同症状与根因自动去重，见 [`recordBugEntry`](file:///Users/zhangfeng/Downloads/Personal-Code/GitHub/LLM/mini-pi-agent/harness/memory.ts#L107-L163)）。
   - 下次在该项目启动新需求或新切片时，自动检索相关错题并注入子专家 System Prompt 的 `=== 历史错题本前置警示 ===` 区块。
2. **架构与接缝范式库 (`.pi-zen/memory/pattern-catalog.md`)**：
   - 每次完成 Phase 7 部署验收后，自动沉淀通过三轴审计的两层扁平架构与公共测试接缝范式（[`recordPatternEntry`](file:///Users/zhangfeng/Downloads/Personal-Code/GitHub/LLM/mini-pi-agent/harness/memory.ts#L224-L263)）。
3. **SOP 阶段检查点 (`.pi-zen/state.json`)**：
   - 状态机每完成一个阶段自动原子更新 `.pi-zen/state.json`（记录 `currentPhase`、`completedPhases`、`qaIteration` 与 `status`），支持长周期研发任务的中断审计与状态恢复。
