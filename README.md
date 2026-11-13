# Pi-Zen Engineering Harness (`mini-pi-agent` v2.1)

基于开源 **Pi Harness (`pi-mono` / `@mariozechner/pi-coding-agent`)** 极简可扩展架构、**[franklin-zf/exp-skill](https://github.com/franklin-zf/exp-skill)** 多角色决策治理、**“代码之禅”** 六大研发戒律以及 **[Design Skill (v4.0)](file:///Users/zhangfeng/.gemini/config/skills/design/SKILL.md)** 构建的通用工程研发 Harness Agent 系统。

---

## 1. 与开源 Pi Harness (`pi-mono`) 的关系

开源项目 **Pi (`@mariozechner/pi-coding-agent`)** 的核心哲学是：**极简底座（4 个原子工具 + <1000 Token 系统提示词）+ 确定性 TypeScript Extension 扩展机制（`.pi/extensions/*.ts`）**。

本项目采用 **“双模同构（Dual-Mode Architecture）”** 设计，既保留了零外部依赖的独立运行能力，又 100% 兼容官方 `@mariozechner/pi-coding-agent` 插件生态：

1. **模式 A — 零依赖独立运行时 (`agent.ts` Standalone Runtime)**：
   - 无需安装庞大的第三方依赖，直接使用 Node.js (`v22.6+` / `v25+`) 原生运行 `agent.ts`。
   - 内置完整的 Pi 原子工具集（`read_file`, `write_file`, `edit_file`, `run_bash`, `run_zen_gate`, `run_design_skill`）、物理隔离的子专家派发器（`subagent.ts`）与 7 阶段确定性状态机（`orchestrator.ts`）。
2. **模式 B — 官方 `pi` CLI 原生扩展插件 (`.pi/extensions/pi-zen.ts`)**：
   - 遵循 `@mariozechner/pi-coding-agent` 的 `ExtensionFactory` 规范，自动向 `pi` 注册：
     - **拦截钩子 (`pi.on("tool_call")`)**：在硬件层执行 `verifyPathPermission` 路径白名单与三权分立拦截。
     - **自定义工具 (`pi.registerTool`)**：向 `pi` 注入 `run_zen_gate` 与 `run_design_skill`。
     - **斜杠命令 (`pi.registerCommand`)**：在 `pi` 终端提供 `/zen-init`、`/zen-check`、`/zen-role`、`/zen-memory`。

---

## 2. 核心原则与全量风控闭环

1. **第一性原理 (First Principles)**：剥离表象，还原系统的本质输入、状态变换与输出，识别唯一控制性瓶颈。
2. **奥卡姆剃刀 (Occam's Razor)**：如无必要，勿增实体。强制执行最小实体审计（`drop_test` / `merge_test`）、零配置偏好、两层扁平架构（`Entrypoint -> Core Domain`）与零预留字段（`Lean Schema`）。
3. **代码之禅 × 设计之禅**：
   - **代码之禅**：扁平胜于嵌套、显式优于隐式（零静默 `catch {}`）、公共测试接缝红绿 TDD、7 维业务规则矩阵（`BR-1..BR-7`）。
   - **设计之禅 (`design` v4.0)**：`Taste Contract` 五要素锁定、`content-handoff.json`（Schema 2.1）作用域防泄漏、同心圆角公式（$R_{\text{inner}} = R_{\text{outer}} - \text{Padding}$）、50+ 字符抗挤压防御布局与 `sloplint` 反 AI 塑料感门禁。
4. **硬件级安全与防伪造闭环**：
   - **默认拒绝 (`Fail-Closed`)**：`templates/acceptance.md` 初始状态全部为 `PENDING`，未执行真实测试命令（`verifyPlanTestCommandsExecution` Exit Code `0`）绝不放行。
   - **跨契约防降级锁**：自动交叉核验 `plan.md` 与 `acceptance.md`，严禁篡改或降级 `BR-1..BR-7` 强制属性。
   - **终端越界写自动回滚 (`Bash Scope Rollback`)**：子专家执行 `run_bash` 前后自动快照比对，任何越过 `allowedPaths` 的修改会被立即自动回滚。

---

## 3. 如何使用（完整操作指南）

### 方式一：一键运行内置自检与全链路沙盘演练（无需 API Key）

```bash
# 1. 运行 10 项全维度单元测试（覆盖 BR-1..BR-7、P0-1..P2-1 与 Pi 插件适配器）
/opt/homebrew/bin/node --test tests/harness.test.ts

# 2. 运行端到端 7 阶段 SOP 闭环演练（含 PRD -> 计划 -> TDD 切片 -> 独立 QA 发现 Bug -> 迭代修复 -> 错题本沉淀 -> 部署验收）
/opt/homebrew/bin/node mock-test.ts
```

### 方式二：对任意工程项目执行初始化与确定性门禁审计

```bash
# 1. 为目标项目初始化 3+1 权威契约文档 (docs/prd.md, plan.md, acceptance.md, content-handoff.json) 与双记忆库 (.pi-zen/memory/)
/opt/homebrew/bin/node agent.ts init /path/to/your-project --ui

# 2. 对目标项目运行 6 大确定性门禁审计 (PRD + Plan + Code Zen + Handoff + UI Sloplint + Acceptance)
/opt/homebrew/bin/node agent.ts check /path/to/your-project --ui
```

### 方式三：连接真实大模型启动 7 阶段全自动研发 SOP

设置任意兼容 OpenAI 接口的环境变量（支持 OpenAI / DeepSeek / Claude Proxy / Ollama）：

```bash
export OPENAI_API_KEY="sk-..."
export OPENAI_BASE_URL="https://api.deepseek.com/v1" # 或 https://api.openai.com/v1
export MODEL_NAME="deepseek-chat"                    # 或 gpt-4o / claude-3-7-sonnet

# 直接对目标目录启动 7 阶段 SOP 流水线（包含 Gate 1 产品确认与 Gate 2 部署确认交互断点）：
/opt/homebrew/bin/node agent.ts sop "你的产品或工程研发需求描述" /path/to/your-project --ui

# 或者进入交互式 REPL 模式（支持 /sop <需求> | /init | /check | /bugs | /patterns）：
/opt/homebrew/bin/node agent.ts --ui
```

### 方式四：作为官方 `@mariozechner/pi-coding-agent` (`pi` CLI) 插件使用

如果你安装了开源 Pi CLI (`npm install -g @mariozechner/pi-coding-agent`)：

```bash
# 在 mini-pi-agent 目录下直接启动 pi（自动发现 .pi/extensions/pi-zen.ts）：
pi

# 或在任何其他项目目录下挂载 Pi-Zen 扩展启动 pi：
pi -e /Users/zhangfeng/Downloads/Personal-Code/GitHub/LLM/mini-pi-agent/.pi/extensions/pi-zen.ts
```

进入 `pi` 后即可直接使用：
- `/zen-init --ui`：初始化 3+1 权威文档与双记忆库
- `/zen-check --ui`：运行全部确定性门禁
- `/zen-role zen-implementer src,tests`：切换当前角色并激活硬件级路径白名单守卫
- `/zen-memory`：查看错题本 (`bug-ledger.md`) 与架构范式库 (`pattern-catalog.md`)
