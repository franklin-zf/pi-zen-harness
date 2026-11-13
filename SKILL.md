---
name: pi-zen
description: >
  Pi-Zen 通用工程研发 Harness Skill（基于 Pi 极简底座、exp-skill 角色治理、“代码之禅”六大研发戒律与 Design Skill v4.0 视觉审美契约）。
  当用户提出工程研发需求、开发新产品/新功能、重构系统、编写 PRD 与技术方案、执行红绿 TDD 研发切片、进行三轴独立 QA 验收与 Bug 迭代闭环时激活。
  Triggers: "pi-zen", "代码之禅", "奥卡姆剃刀", "第一性原理研发", "研发SOP", "垂直切片", "三轴验收", "最小实体审计", "工程研发"
---

# Pi-Zen Engineering Harness Skill (`v2.1`)

> **第一性原理 × 奥卡姆剃刀 × 代码之禅 × 设计之禅 (`design` v4.0)**  
> 本技能不是纯提示词角色扮演，而是**挂载确定性硬件门禁脚本的工程研发状态机（Executable Harness-Skill）**。

---

## 1. 核心铁律与权威优先级 (Authority & Precedence)

当任何上下文、建议或模板发生冲突时，严格按以下优先级裁决（高优先级覆盖低优先级）：

1. **宿主安全边界与用户显式确认 (`Gate 1` & `Gate 2`)**
2. **项目权威契约三件套 (`3+1` Authoritative Contracts)**：
   - `docs/prd.md`：需求规格、第一性原理拆解、最小实体审计（`drop_test`/`merge_test`）、五态交互矩阵与 `Taste Contract`。
   - `docs/plan.md`：两层扁平架构、`Lean Schema`（零预留字段）、7 维业务规则矩阵（`BR-1..BR-7`）与垂直研发切片（`SLC-001..N`）。
   - `docs/acceptance.md`：三权分立签名、需求追溯矩阵、7 维 BR 实测证据、三轴审计结论与净室工作树摘要（`Tree Digest`）。
   - `docs/content-handoff.json`（当涉及 UI 时）：Design v4.0 跨角色内容交接协议（Schema 2.1，强制校验 `[Global]` / `[Asset]` / `[Plugin]` 作用域隔离）。
3. **确定性门禁 CLI 脚本 (`agent.ts`) 的硬判决结果（Exit Code `0` 为唯一放行标准）**
4. **按阶段渐进加载的能力内核 (`kernels/*.md`)**

---

## 2. 按需渐进读取规则 (Progressive Disclosure)

**严禁一次性将所有 `kernels/*.md` 读入主上下文！** 必须且只能在进入对应阶段时按需读取：

| 阶段 (Phase) | 必读能力内核文件 | 必读模板或协同技能 |
| :--- | :--- | :--- |
| **Phase 1 & 2: 需求评估与 PRD** | [kernels/ceo-soul.md](file:///Users/zhangfeng/Downloads/Personal-Code/GitHub/LLM/mini-pi-agent/kernels/ceo-soul.md)<br>[kernels/product-soul.md](file:///Users/zhangfeng/Downloads/Personal-Code/GitHub/LLM/mini-pi-agent/kernels/product-soul.md) | [templates/prd.md](file:///Users/zhangfeng/Downloads/Personal-Code/GitHub/LLM/mini-pi-agent/templates/prd.md)<br>若含 UI：激活 [design](file:///Users/zhangfeng/.gemini/config/skills/design/SKILL.md) 技能 |
| **Phase 3: 架构与切片计划** | [kernels/architect-soul.md](file:///Users/zhangfeng/Downloads/Personal-Code/GitHub/LLM/mini-pi-agent/kernels/architect-soul.md) | [templates/plan.md](file:///Users/zhangfeng/Downloads/Personal-Code/GitHub/LLM/mini-pi-agent/templates/plan.md) |
| **Phase 4: 垂直切片 TDD 实现** | [kernels/zen-coder.md](file:///Users/zhangfeng/Downloads/Personal-Code/GitHub/LLM/mini-pi-agent/kernels/zen-coder.md)<br>若含 UI：[kernels/ui-designer-soul.md](file:///Users/zhangfeng/Downloads/Personal-Code/GitHub/LLM/mini-pi-agent/kernels/ui-designer-soul.md) | 仅读取当前切片 `SLC-NNN` 关联的源码 |
| **Phase 5 & 6: 独立 QA 与修复** | [kernels/qa-auditor.md](file:///Users/zhangfeng/Downloads/Personal-Code/GitHub/LLM/mini-pi-agent/kernels/qa-auditor.md) | [templates/acceptance.md](file:///Users/zhangfeng/Downloads/Personal-Code/GitHub/LLM/mini-pi-agent/templates/acceptance.md) |

---

## 3. 端到端 7 阶段研发 SOP 执行协议（硬件脚本锁步）

设 `HARNESS_CLI="/opt/homebrew/bin/node /Users/zhangfeng/Downloads/Personal-Code/GitHub/LLM/mini-pi-agent/agent.ts"`，目标工程根目录为 `<TARGET_DIR>`。

### Step 0：脚手架初始化与历史错题召回
1. 运行脚手架初始化命令（若项目包含前端/UI 界面，必须加 `--ui`）：
   ```bash
   /opt/homebrew/bin/node /Users/zhangfeng/Downloads/Personal-Code/GitHub/LLM/mini-pi-agent/agent.ts init <TARGET_DIR> [--ui]
   ```
2. 读取 `<TARGET_DIR>/.pi-zen/memory/bug-ledger.md` 与 `<TARGET_DIR>/.pi-zen/memory/pattern-catalog.md`，提取历史高频错题作为前置约束。

---

### Phase 1 & Phase 2：第一性原理需求评估与产品 PRD 生成 (`evaluate_and_prd`)
1. 读取 [kernels/ceo-soul.md](file:///Users/zhangfeng/Downloads/Personal-Code/GitHub/LLM/mini-pi-agent/kernels/ceo-soul.md) 与 [kernels/product-soul.md](file:///Users/zhangfeng/Downloads/Personal-Code/GitHub/LLM/mini-pi-agent/kernels/product-soul.md)。
2. 对用户原始需求执行**第一性原理五步裁剪算法**与**最小实体审计 (`drop_test` / `merge_test`)**，更新 `<TARGET_DIR>/docs/prd.md`：
   - 必须包含一句话产品承诺、`Single Primary Flow`、`Zero-Config Preference`、`Surface Minimization` 与明确的 `Non-Goals`。
   - 必须填写完整的 `Minimal-Entity Audit` 表、`REQ-NNN` 需求表与**全链路五态交互矩阵**（空态/加载态/成功态/错误态/降级态）。
   - 若涉及 UI：必须定义五要素 `Taste Contract` JSON，并生成 `<TARGET_DIR>/docs/content-handoff.json`（标记 `[Global: Host-level]` / `[Asset: Data-level]` / `[Plugin: Private-level]`）。
3. **执行硬件门禁 1（未通过严禁进入下一阶段）**：
   ```bash
   /opt/homebrew/bin/node /Users/zhangfeng/Downloads/Personal-Code/GitHub/LLM/mini-pi-agent/agent.ts gate prd <TARGET_DIR>
   # 若包含 UI，同步校验 handoff 门禁：
   /opt/homebrew/bin/node /Users/zhangfeng/Downloads/Personal-Code/GitHub/LLM/mini-pi-agent/agent.ts gate handoff <TARGET_DIR>
   ```

---

### 🛑 Gate 1：用户确认产品功能、目标与 UI 方向 (`user_confirm_prd`)
- **硬性阻断规则**：在 `gate prd` 通过后，**严禁直接开始写代码或写架构计划！**
- 必须向用户展示 `<TARGET_DIR>/docs/prd.md` 的核心结论（一句话承诺、被剃除的非目标 `Non-Goals`、`REQ-NNN` 列表与 UI 审美方向），并调用宿主的 `ask_question` 工具（或显式提问）请求用户确认：
  - 若用户提出修改意见：返回 Phase 1/2 修订 `docs/prd.md` 并重跑 `gate prd`。
  - 若用户确认通过：将 `docs/prd.md` 顶部的 `Confirmation:` 设为 `confirmed`，进入 Phase 3。

---

### Phase 3：制定两层扁平架构与垂直切片计划 (`design_plan`)
1. 读取 [kernels/architect-soul.md](file:///Users/zhangfeng/Downloads/Personal-Code/GitHub/LLM/mini-pi-agent/kernels/architect-soul.md)，普查 `<TARGET_DIR>` 现有代码结构。
2. 编写 `<TARGET_DIR>/docs/plan.md`：
   - **两层扁平架构 (`Entrypoint/UI -> Core Domain`)**：不到 $\ge 3$ 个真实复用点严禁引入 `Factory` / `Adapter` / `Strategy` 包装类。
   - **`Lean Schema`（零预留字段）**：严禁定义 `ext_json`、`extra_data`、`reserved_*` 等投机字段。
   - **7 维业务规则矩阵 (`BR-1..BR-7`)**：逐项声明正常路径、非法输入、边界极值、权限隔离、幂等重试、并发原子、超时降级的实现位置与验证方式。
   - **垂直研发切片 (`SLC-001..N`)**：确保 PRD 中的每一个 `REQ-NNN` 都被覆盖，并为每个切片明确声明 `Allowed Paths`、`Highest Stable Seam`（最高稳定公共测试接缝）与 `Verification Command`。
3. **执行硬件门禁 2（未通过严禁进入 Phase 4）**：
   ```bash
   /opt/homebrew/bin/node /Users/zhangfeng/Downloads/Personal-Code/GitHub/LLM/mini-pi-agent/agent.ts gate plan <TARGET_DIR>
   ```

---

### Phase 4：按垂直切片执行公共接缝红绿 TDD (`execute_slices`)
针对 `docs/plan.md` 中的每一个垂直切片 `SLC-NNN`：
1. **物理上下文隔离（推荐调用宿主 `invoke_subagent`）**：
   - 将当前切片的任务包（`Slice ID`、`Included Requirements`、`Allowed Paths`、`Highest Stable Seam`、`Verification Command`）与 [kernels/zen-coder.md](file:///Users/zhangfeng/Downloads/Personal-Code/GitHub/LLM/mini-pi-agent/kernels/zen-coder.md)（含 UI 时附带 [kernels/ui-designer-soul.md](file:///Users/zhangfeng/Downloads/Personal-Code/GitHub/LLM/mini-pi-agent/kernels/ui-designer-soul.md)）派发给独立子 Agent 执行。
2. **红绿重构 TDD 与代码之禅六戒律**：
   - **RED**：先在 `Highest Stable Seam` 编写覆盖正常路径与 `BR-2..BR-7` 异常边界的失败测试。
   - **GREEN**：使用卫语句（Guard Clauses）早返回编写最简扁平实现，严禁空 `catch {}` 吞没异常，严禁越过 `Allowed Paths` 修改无关文件（严禁修改 `docs/prd.md` 或 `docs/acceptance.md`）。
   - **UI 五态与防 AI 塑料感（`--ui` 模式）**：严格遵守同心圆角光学公式 $R_{\text{inner}} = R_{\text{outer}} - \text{Padding}$、50+ 字符抗挤压布局（`min-width: 0`），严禁捏造未在 `content-handoff.json` 授权的指标。
3. **切片级代码之禅与 UI 门禁自检**：
   ```bash
   /opt/homebrew/bin/node /Users/zhangfeng/Downloads/Personal-Code/GitHub/LLM/mini-pi-agent/agent.ts gate code <TARGET_DIR>
   # 若包含 UI，同步执行 UI Sloplint 门禁：
   /opt/homebrew/bin/node /Users/zhangfeng/Downloads/Personal-Code/GitHub/LLM/mini-pi-agent/agent.ts gate ui <TARGET_DIR>
   ```

---

### Phase 5：独立 QA 全量三轴测试与验收报告签署 (`full_test_qa`)
1. **强制三权分立（必须调用宿主 `invoke_subagent` 派生独立 QA 子 Agent）**：
   - **严禁代码实现者在当前上下文直接自审自签 `docs/acceptance.md`！**
   - 必须通过 `invoke_subagent` 启动角色为 `Independent QA Auditor` 的独立子 Agent，使其读取 [kernels/qa-auditor.md](file:///Users/zhangfeng/Downloads/Personal-Code/GitHub/LLM/mini-pi-agent/kernels/qa-auditor.md)。
2. 独立 QA 子 Agent 在真实终端执行 `docs/plan.md` 中的全部测试命令，核验 **Axis A（规格与 `BR-1..7`）**、**Axis B（代码之禅 100/100）**、**Axis C（UI Sloplint 与五态交互）**，并如实更新 `<TARGET_DIR>/docs/acceptance.md`（只能修改 `docs/acceptance.md`，严禁 QA 直接改业务代码）。
3. **执行全量确定性门禁**：
   ```bash
   /opt/homebrew/bin/node /Users/zhangfeng/Downloads/Personal-Code/GitHub/LLM/mini-pi-agent/agent.ts check <TARGET_DIR> [--ui]
   ```

---

### Phase 6：Bug 迭代修复与错题本飞轮闭环 (`iterate_bug_fix`)
若 Phase 5 中 `check` 未通过，或 `docs/acceptance.md` 中存在未关闭的 `blocking` / `major` 缺陷：
1. 针对每一项缺陷编写复现回归测试并在 `Allowed Paths` 内完成定向修复（单缺陷最多尝试 3 次，总循环最多 5 轮）。
2. **强制沉淀错题本**：每修复一项缺陷，立即执行以下命令写入 `.pi-zen/memory/bug-ledger.md`：
   ```bash
   /opt/homebrew/bin/node /Users/zhangfeng/Downloads/Personal-Code/GitHub/LLM/mini-pi-agent/agent.ts record-bug <TARGET_DIR> "<标签>" "<缺陷症状>" "<根本原因>" "<修复配方与回归测试>"
   ```
3. 修复完成后，**重新回到 Phase 5** 由独立 QA 复验并关闭 Finding，直至 `check` 全绿。

---

### Phase 7 & 🛑 Gate 2：净室工作树摘要绑定与最终部署验收 (`deploy_acceptance`)
1. 执行净室杂物清理与 `SHA-256 Tree Digest` 硬件绑定：
   ```bash
   /opt/homebrew/bin/node /Users/zhangfeng/Downloads/Personal-Code/GitHub/LLM/mini-pi-agent/agent.ts bind-digest <TARGET_DIR>
   /opt/homebrew/bin/node /Users/zhangfeng/Downloads/Personal-Code/GitHub/LLM/mini-pi-agent/agent.ts check <TARGET_DIR> [--ui]
   ```
2. 向用户展示全绿门禁审计报告、测试覆盖结果与绑定的 `sha256:...` 工作树摘要，请求最终部署验收确认（**Gate 2**）。
