/**
 * End-to-End 7-Phase SOP Simulation (Pi-Zen Engineering Harness v2.0).
 * Demonstrates:
 *  1. Phase 1 & 2: First-principles evaluation, Minimal-Entity Audit, PRD & Design Taste Contract
 *  2. Gate 1: User Confirmation of Product Features, Goals & UI Direction
 *  3. Phase 3: Flat 2-Layer Engineering Plan, 7-Dim BR Matrix & Vertical Slices
 *  4. Phase 4: Vertical Slice Execution (Red-Green TDD + Design v4.0 UI)
 *  5. Phase 5 (Round 1): Independent QA detects a Major bug (BR-3 boundary defect)
 *  6. Phase 6: Loop Controller dispatches narrow fix packet -> Implementer fixes & logs to Bug Ledger
 *  7. Phase 5 (Round 2) & Phase 7: Independent QA verifies PASS -> Tree Digest bound -> Final Deploy Acceptance
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { runEngineeringSopPipeline } from "./harness/orchestrator.ts";
import { readBugLedger } from "./harness/memory.ts";
import { printGateSummary } from "./agent.ts";
import type { RoleName } from "./harness/types.ts";

async function runFullSopSimulation() {
  console.log("==================================================================");
  console.log("🧪 Pi-Zen Engineering Harness — 全流程 7 阶段 SOP 端到端闭环演练");
  console.log("==================================================================");

  const demoWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), "pi-zen-e2e-"));
  let qaRound = 0;

  try {
    // Deterministic Mock LLM driving each isolated subagent role through tool calls
    const mockLLM = async (messages: any[], role: RoleName) => {
      const lastMsg = messages[messages.length - 1];
      // If the last message is a tool result, complete the subagent turn
      if (lastMsg.role === "tool") {
        return {
          role: "assistant",
          content: `[${role}] 已完成当前有界任务包全部操作并通过自检。`,
        };
      }

      if (role === "product-kernel") {
        return {
          role: "assistant",
          content: "完成第一性原理拆解、最小实体审计与 Design v4.0 Taste Contract 定义。",
          tool_calls: [
            {
              id: "call_prd_1",
              function: {
                name: "write_file",
                arguments: JSON.stringify({
                  filePath: "docs/prd.md",
                  content: `# 需求分析报告与产品需求规格说明书 (PRD)

Confirmation: confirmed

## 一句话产品承诺 [Product Promise]
为研发工程师提供零配置、单视图的接口延迟与错误率健康度实时评估面板。

## 第一性原理问题拆解 [First-Principles Decomposition]
- **本质输入**: 原始请求耗时样本数组与错误计数。
- **核心状态流转**: 纯函数计算 P95 延迟与错误率阈值判定。
- **控制性瓶颈**: 边界输入（空数组、负数、超长标签）下的确定性安全处理。

## 产品奥卡姆剃刀与取舍 [Product Occam's Razor & Trade-offs]
- Single Primary Flow: 输入观测样本 -> 即时输出 P95 状态与健康卡片。
- Zero-Config Preference: 默认内置 P95 < 200ms 与错误率 < 1% 黄金 SLA，零配置开关。
- Surface Minimization: 单一主工作台视图呈現 3 项核心指标，不设多级弹窗或管理后台。

### 非目标 [Non-Goals]
- 故意不引入分布式追踪存储、多租户 RBAC 后台或自定义告警规则引擎（如无必要，勿增实体）。

## 最小实体审计 [Minimal-Entity Audit]
| 引入实体 [Entity Introduced] | 模块编号 [Module ID] | 范围 [Scope] | 所属表面 [Owning Boundary] | 删除测试 [drop_test] | 合并测试 [merge_test] | 决策 [Decision] |
| --- | --- | --- | --- | --- | --- | --- |
| HealthReport | MOD-001 | [Global: Host-level] | Primary View | 删除后无法输出健康度评估结果，主流程阻断 | 已将延迟与错误率合并为单一值对象，无冗余拆分 | approved |

## 需求规格 [Requirements]
| 需求编号 [ID] | 模块编号 [Module ID] | 优先级 [Priority] | 交互模式 [Interaction Mode] | 需求描述 [Requirement] | 可观察验收标准 [Observable Acceptance] | 验证级别 [Verification Level] |
| --- | --- | --- | --- | --- | --- | --- |
| REQ-001 | MOD-001 | P0 | ui | 计算请求样本 P95 与健康状态并渲染 3 列状态面板 | 输入样本返回准确 P95 且长文本不溢出 | real_canary |

## 全链路五态交互矩阵 [Five-State Matrix]
| 表面 [Surface / View] | 空态 [Empty State] | 加载态 [Loading State] | 成功态 [Populated State] | 错误态 [Error / Validation State] | 降级态 [Offline / Fallback State] |
| --- | --- | --- | --- | --- | --- |
| Primary Workspace | 展示等待样本接入引导 | 骨架占位零跳变 | 展示 3 列真实指标 Bento 面板 | 非法负数样本显式报错提示 | 采样超时展示最近一次缓存快照 |

## UI 审美契约 [Taste Contract]
\`\`\`json
{
  "visual_thesis": "以精密仪器级的克制排版直接呈现 P95 延迟、错误率与健康结论三项核心事实",
  "content_tension": "大幅健康度主状态指示器与紧凑单宽数值指标的尺度对比",
  "signature_move": "遵循同心圆角光学公式 (R_inner = R_outer - Padding) 的 3 列非对称 Bento 布局",
  "anti_reference": "严禁为凑 4 宫格捏造假指标、严禁 01 // LABEL 印章角标与廉价霓虹发光",
  "restraint_rule": "仅渲染 content-handoff.json 授权的 Global 与 Asset 级真实指标"
}
\`\`\`
`,
                }),
              },
            },
          ],
        };
      }

      if (role === "architect-kernel") {
        return {
          role: "assistant",
          content: "完成两层扁平架构、Lean Schema 与 7 维 BR 切片计划。",
          tool_calls: [
            {
              id: "call_plan_1",
              function: {
                name: "write_file",
                arguments: JSON.stringify({
                  filePath: "docs/plan.md",
                  content: `# 工程架构与垂直切片研发计划 (Engineering Plan)

## 当前仓库与依赖发现 [Current Repository Findings]
- 使用 Node.js 原生 TypeScript 与原生 CSS，零第三方依赖。

## 架构设计 [Architecture]
### 复杂度说明与扁平设计 [Complexity Justification & Flat Design]
- 采用两层扁平架构：UI 视图入口 -> \`src/health.ts\` 纯领域函数，零 Factory/Adapter 包装类。

## 数据模型与精简 Schema [Database Design]
- **Lean Schema**：仅包含 \`p95Ms\`、\`errorRate\`、\`status\` 三个字段，严禁 \`ext_json\`。

## 七维业务规则防御矩阵 [Business Rule Matrix]
| 规则编号 [Rule ID] | 适用模块 [Applicable Modules] | 维度 [Dimension] | 场景与防御设计 [Description & Scenarios] | 是否适用 [Applicable] | 验证策略与测试接缝 [Verification Strategy & Test Reference] |
| --- | --- | --- | --- | --- | --- |
| BR-1 | MOD-001 | Normal Path | 正常耗时样本计算 P95 | Yes | \`evaluateHealth([10, 50, 120])\` |
| BR-2 | MOD-001 | Invalid Input | 拒绝负数耗时输入并显式抛出错误 | Yes | 负数耗时异常测试 |
| BR-3 | MOD-001 | Boundary Cases | 空数组、单元素与 50+ 字符服务名边界处理 | Yes | 空数组与超长名称边界测试 |
| BR-4 | MOD-001 | Permission Boundary | 严格限制 allowedPaths 与 Handoff 作用域 | Yes | 作用域门禁检查 |
| BR-5 | MOD-001 | Idempotency & Retry | 纯函数相同输入恒定返回一致结果 | Yes | 幂等性断言 |
| BR-6 | MOD-001 | Concurrency | 无共享可变全局状态，原子文件写入 | Yes | 并发安全检查 |
| BR-7 | MOD-001 | Dependency Failure | 采样缺失时安全返回 empty 状态 | Yes | 降级状态测试 |

## 垂直研发切片计划 [Vertical Slices]
| 切片编号 [Slice ID] | 模块编号 [Module ID] | 包含需求 [Included Requirements] | 允许修改路径 [Allowed Paths] | 最高稳定公共测试接缝 [Highest Stable Seam] | 验证命令与预期输出 [Verification Command] | 退出条件 [Exit Criteria] |
| --- | --- | --- | --- | --- | --- | --- |
| SLC-001 | MOD-001 | REQ-001 | \`src\`, \`tests\` | \`evaluateHealth()\` & \`src/dashboard.html\` | \`node --test\` | 红绿 TDD 通过 |
`,
                }),
              },
            },
          ],
        };
      }

      if (role === "ui-specialist") {
        // Phase 4: Implement initial slice (intentionally leaving a minor boundary bug for QA Round 1 to catch!)
        return {
          role: "assistant",
          content: "完成 SLC-001 领域逻辑与 Design v4.0 防御性 UI 面板实现。",
          tool_calls: [
            {
              id: "call_slice_code",
              function: {
                name: "write_file",
                arguments: JSON.stringify({
                  filePath: "src/health.ts",
                  content: `export interface HealthReport {
  serviceName: string;
  p95Ms: number;
  status: "healthy" | "degraded" | "empty";
}

export function evaluateHealth(serviceName: string, latenciesMs: number[]): HealthReport {
  if (!serviceName || !serviceName.trim()) {
    throw new Error("[BR-2] serviceName 不能为空");
  }
  if (latenciesMs.length === 0) {
    return { serviceName: serviceName.trim(), p95Ms: 0, status: "empty" };
  }
  const sorted = [...latenciesMs].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
  const p95Ms = sorted[idx];
  return {
    serviceName: serviceName.trim(),
    p95Ms,
    status: p95Ms <= 200 ? "healthy" : "degraded",
  };
}
`,
                }),
              },
            },
            {
              id: "call_slice_ui",
              function: {
                name: "write_file",
                arguments: JSON.stringify({
                  filePath: "src/dashboard.html",
                  content: `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>Service Health Telemetry</title>
  <style>
    /* 8pt spacing scale & Optical Concentric Radius: R_outer(16px) - Padding(8px) = R_inner(8px) */
    .workspace { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; padding: 24px; }
    .card-outer { border-radius: 16px; padding: 8px; background: #111318; color: #f3f4f6; min-width: 0; }
    .card-inner { border-radius: 8px; padding: 16px; overflow-wrap: break-word; min-width: 0; }
  </style>
</head>
<body>
  <header><h1>Service Health Monitor</h1></header>
  <main class="workspace">
    <section class="card-outer"><div class="card-inner"><h2>Task Execution Status</h2><p>Healthy</p></div></section>
    <section class="card-outer"><div class="card-inner"><h2>Verified Requirements</h2><p>1 / 1</p></div></section>
    <section class="card-outer"><div class="card-inner"><h2>P95 Latency</h2><p>42 ms</p></div></section>
  </main>
</body>
</html>
`,
                }),
              },
            },
          ],
        };
      }

      if (role === "independent-qa") {
        qaRound++;
        if (qaRound === 1) {
          // Round 1: Independent QA discovers that negative latency values (BR-2) are not rejected!
          return {
            role: "assistant",
            content: "第 1 轮独立 QA 审计发现 Major 缺陷：负数延迟样本未被拦截 (违反 BR-2)。",
            tool_calls: [
              {
                id: "call_qa_fail",
                function: {
                  name: "write_file",
                  arguments: JSON.stringify({
                    filePath: "docs/acceptance.md",
                    content: `# 全量测试、三轴审计与部署验收报告 (Acceptance Report)

## 摘要与三权分立绑定 [Summary]
- 实现贡献者 [Implementation contributors]: ui-specialist, zen-implementer
- 独立审查者 [Independent Reviewer]: architect-reviewer
- 独立 QA [Independent QA]: independent-qa
- 目标提交 SHA [Target Commit SHA]: HEAD
- 工作树摘要 [Tree Digest]: pending
- 摘要范围 [Allowed Paths]: src, tests, docs
- Loop 状态 [Loop State]: failed_qa
- 总循环轮次 [Total Iteration]: 1
- 最大总循环轮次 [Max Total Iterations]: 5
- 单问题最大修复次数 [Max Attempts Per Finding]: 3

## 需求全链路追溯矩阵 [Traceability Matrix]
| 需求编号 [Requirement ID] | 模块编号 [Module ID] | 切片编号 [Slice ID] | 方案决策 [Solution Decision] | 实现位置 [Implementation] | 验证级别 [Verification Level] | 测试证据 [Test Evidence] | QA 结果 [QA Result] |
| --- | --- | --- | --- | --- | --- | --- | --- |
| REQ-001 | MOD-001 | SLC-001 | 扁平纯函数与3列面板 | \`src/health.ts\` | real_canary | \`negative input test failed\` | FAIL |

## 七维业务规则验证 [Business Rule Verification]
| 规则编号 [Rule ID] | 模块编号 [Module ID] | 维度 [Dimension] | 强制 [Mandatory] | 测试证据/日志 [Test Evidence / Log Path] | QA 状态 [QA Status] |
| --- | --- | --- | --- | --- | --- |
| BR-1 | MOD-001 | Normal Path | Yes | \`tests/health.test.ts:PASS\` | PASS |
| BR-2 | MOD-001 | Invalid Input | Yes | \`tests/health.test.ts:FAIL\` | FAIL |
| BR-3 | MOD-001 | Boundary Cases | Yes | \`tests/health.test.ts:PASS\` | PASS |
| BR-4 | MOD-001 | Permission Boundary | Yes | \`scope-guard:PASS\` | PASS |
| BR-5 | MOD-001 | Idempotency & Retry | Yes | \`idempotent:PASS\` | PASS |
| BR-6 | MOD-001 | Concurrency | Yes | \`atomic-write:PASS\` | PASS |
| BR-7 | MOD-001 | Dependency Failure | Yes | \`empty-fallback:PASS\` | PASS |

## 问题清单与 Bug 迭代闭环 [Findings]
| 编号 [ID] | 类型 [Finding Type] | 严重度 [Severity] | 模块编号 [Module ID] | 需求编号 [Requirement ID] | 问题描述 [Problem] | 证据 [Evidence] | 负责人 [Owner] | 状态 [Status] | 发现者 [Found By] | 轮次 [Iteration] |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FND-001 | functional | major | MOD-001 | REQ-001 | evaluateHealth 未校验负数延迟样本 (BR-2) | 输入 [-10, 50] 未抛出异常 | zen-implementer | open | independent-qa | 1 |

## 最终部署与验收决策 [QA Decision]
Decision: FAIL
Reviewer: architect-reviewer
QA Auditor: independent-qa
`,
                  }),
                },
              },
            ],
          };
        }

        // Round 2: After Phase 6 fix, Independent QA verifies the fix and signs PASS!
        return {
          role: "assistant",
          content: "第 2 轮独立 QA 复验通过：FND-001 已修复并具备回归测试保护，三轴审计全绿，签署 PASS。",
          tool_calls: [
            {
              id: "call_qa_pass",
              function: {
                name: "write_file",
                arguments: JSON.stringify({
                  filePath: "docs/acceptance.md",
                  content: `# 全量测试、三轴审计与部署验收报告 (Acceptance Report)

## 摘要与三权分立绑定 [Summary]
- 实现贡献者 [Implementation contributors]: ui-specialist, zen-implementer
- 独立审查者 [Independent Reviewer]: architect-reviewer
- 独立 QA [Independent QA]: independent-qa
- 目标提交 SHA [Target Commit SHA]: HEAD
- 工作树摘要 [Tree Digest]: pending
- 摘要范围 [Allowed Paths]: src, tests, docs
- Loop 状态 [Loop State]: passed
- 总循环轮次 [Total Iteration]: 2
- 最大总循环轮次 [Max Total Iterations]: 5
- 单问题最大修复次数 [Max Attempts Per Finding]: 3

## 需求全链路追溯矩阵 [Traceability Matrix]
| 需求编号 [Requirement ID] | 模块编号 [Module ID] | 切片编号 [Slice ID] | 方案决策 [Solution Decision] | 实现位置 [Implementation] | 验证级别 [Verification Level] | 测试证据 [Test Evidence] | QA 结果 [QA Result] |
| --- | --- | --- | --- | --- | --- | --- | --- |
| REQ-001 | MOD-001 | SLC-001 | 扁平纯函数与3列面板 | \`src/health.ts\` | real_canary | \`node --test (7/7 BR PASS)\` | PASS |

## 七维业务规则验证 [Business Rule Verification]
| 规则编号 [Rule ID] | 模块编号 [Module ID] | 维度 [Dimension] | 强制 [Mandatory] | 测试证据/日志 [Test Evidence / Log Path] | QA 状态 [QA Status] |
| --- | --- | --- | --- | --- | --- |
| BR-1 | MOD-001 | Normal Path | Yes | \`tests/health.test.ts:PASS\` | PASS |
| BR-2 | MOD-001 | Invalid Input | Yes | \`tests/health.test.ts:PASS\` | PASS |
| BR-3 | MOD-001 | Boundary Cases | Yes | \`tests/health.test.ts:PASS\` | PASS |
| BR-4 | MOD-001 | Permission Boundary | Yes | \`scope-guard:PASS\` | PASS |
| BR-5 | MOD-001 | Idempotency & Retry | Yes | \`idempotent:PASS\` | PASS |
| BR-6 | MOD-001 | Concurrency | Yes | \`atomic-write:PASS\` | PASS |
| BR-7 | MOD-001 | Dependency Failure | Yes | \`empty-fallback:PASS\` | PASS |

## 问题清单与 Bug 迭代闭环 [Findings]
| 编号 [ID] | 类型 [Finding Type] | 严重度 [Severity] | 模块编号 [Module ID] | 需求编号 [Requirement ID] | 问题描述 [Problem] | 证据 [Evidence] | 负责人 [Owner] | 状态 [Status] | 发现者 [Found By] | 轮次 [Iteration] |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FND-001 | functional | major | MOD-001 | REQ-001 | evaluateHealth 未校验负数延迟样本 (BR-2) | 已补充负数拦截与测试 | zen-implementer | closed | independent-qa | 1 |

## 最终部署与验收决策 [QA Decision]
Decision: PASS
Reviewer: architect-reviewer
QA Auditor: independent-qa
`,
                }),
              },
            },
          ],
        };
      }

      if (role === "zen-implementer") {
        // Phase 6: Bug Fixer patches `src/health.ts` to reject negative latencies
        return {
          role: "assistant",
          content: "已完成 FND-001 定向修复：为 evaluateHealth 补充负数耗时校验与单元测试。",
          tool_calls: [
            {
              id: "call_fix_code",
              function: {
                name: "write_file",
                arguments: JSON.stringify({
                  filePath: "src/health.ts",
                  content: `export interface HealthReport {
  serviceName: string;
  p95Ms: number;
  status: "healthy" | "degraded" | "empty";
}

export function evaluateHealth(serviceName: string, latenciesMs: number[]): HealthReport {
  if (!serviceName || !serviceName.trim()) {
    throw new Error("[BR-2] serviceName 不能为空");
  }
  if (latenciesMs.some((n) => typeof n !== "number" || Number.isNaN(n) || n < 0)) {
    throw new Error("[BR-2] latenciesMs 不能包含负数或 NaN");
  }
  if (latenciesMs.length === 0) {
    return { serviceName: serviceName.trim(), p95Ms: 0, status: "empty" };
  }
  const sorted = [...latenciesMs].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
  const p95Ms = sorted[idx];
  return {
    serviceName: serviceName.trim(),
    p95Ms,
    status: p95Ms <= 200 ? "healthy" : "degraded",
  };
}
`,
                }),
              },
            },
          ],
        };
      }

      return { role: "assistant", content: "Done" };
    };

    const result = await runEngineeringSopPipeline({
      userRequirement: "构建一个实时计算接口 P95 延迟与健康状态的轻量监控面板",
      projectRoot: demoWorkspace,
      uiEnabled: true,
      callLLM: mockLLM,
      callbacks: {
        onPhaseStart: (phase, desc) => {
          console.log(`\n▶️  [${phase}] ${desc}`);
        },
        confirmPrd: async () => {
          console.log("   👤 [Gate 1 用户确认]: 已审阅 PRD、最小实体审计与 Taste Contract，确认通过！");
          return { approved: true };
        },
        confirmDeploy: async (_acc, digest) => {
          console.log(`   👤 [Gate 2 部署确认]: 已核验工作树摘要 (${digest.slice(0, 28)}...)，批准部署验收！`);
          return true;
        },
      },
    });

    printGateSummary(result.finalGateReports);

    const bugs = readBugLedger(demoWorkspace);
    console.log(`📒 错题本 (.pi-zen/memory/bug-ledger.md) 自动沉淀记录 (${bugs.length} 条):`);
    for (const b of bugs) {
      console.log(`   - [${b.id}] 症状: ${b.symptom} | 修复配方: ${b.fixRecipe}`);
    }

    console.log("\n==================================================================");
    console.log(
      `✅ 全流程 SOP 演练成功！完成阶段: ${result.completedPhases.join(" -> ")} (共经历 ${result.qaIterations} 轮 QA 迭代)`
    );
    console.log("==================================================================");
  } finally {
    fs.rmSync(demoWorkspace, { recursive: true, force: true });
  }
}

runFullSopSimulation().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
