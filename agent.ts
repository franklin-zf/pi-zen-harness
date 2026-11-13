/**
 * Pi-Zen Engineering Harness Agent (v2.0)
 * Evolved from Mini-Pi Agent with:
 * - 1+3+N Capability Kernels (exp-skill architecture)
 * - "代码之禅" Six Precepts & 7-Dimension Business Rules
 * - Design Skill (v4.0) UI/UX Taste Contract, Content Handoff 2.1 & Sloplint
 * - 7-Phase Deterministic SOP State Machine with Human Confirmation Gates
 */

import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import * as fs from "node:fs";
import * as path from "node:path";
import { executeTool, toolDefinitions } from "./tools.ts";
import {
  runAllProjectGates,
  runEngineeringSopPipeline,
  scaffoldProject,
} from "./harness/orchestrator.ts";
import { readBugLedger, readPatternCatalog, recordBugEntry, writeFileAtomic } from "./harness/memory.ts";
import { computeWorkspaceTreeDigest, parseAcceptanceSnapshot } from "./harness/zen-checker.ts";
import type { RoleName } from "./harness/types.ts";

const API_KEY = process.env.OPENAI_API_KEY || process.env.DEEPSEEK_API_KEY || "";
const BASE_URL = (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
const MODEL = process.env.MODEL_NAME || "gpt-4o-mini";

const SYSTEM_PROMPT = `你是 Pi-Zen 通用工程研发 Harness Agent 主控中枢 (Lead Orchestrator)。
你遵循三大核心原则：
1. 【第一性原理】：剥离表象，直击输入、状态变换与输出本质，识别控制性瓶颈。
2. 【奥卡姆剃刀】：如无必要，勿增实体（强制执行 drop_test / merge_test 与零预留字段 Lean Schema）。
3. 【代码之禅与设计之禅】：扁平胜于嵌套（默认两层架构）、显式优于隐式（零静默异常）、公共接缝红绿 TDD、7 维业务规则防御，以及 Design Skill v4.0 审美契约与反 AI 塑料感门禁。

你可使用以下原子工具：
- read_file: 读取本地文件
- write_file: 原子写入本地文件（受路径白名单守卫）
- edit_file: 精确替换文件片段（受路径白名单守卫）
- run_bash: 执行终端命令
- run_zen_gate: 执行确定性质量门禁 (prd | plan | code | handoff | ui | acceptance)
- run_design_skill: 调用 Design Skill v4.0 视觉引擎 (studio | seed | sloplint | validate_handoff)`;

/**
 * Native fetch LLM Gateway (Zero external runtime dependencies).
 */
export async function callLLM(messages: any[], _role?: RoleName) {
  if (!API_KEY && !BASE_URL.includes("localhost") && !BASE_URL.includes("127.0.0.1")) {
    throw new Error("请先设置 OPENAI_API_KEY 或 DEEPSEEK_API_KEY 环境变量！");
  }

  const response = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      tools: toolDefinitions,
      tool_choice: "auto",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM 请求失败 [${response.status}]: ${errorText}`);
  }

  const data = await response.json();
  return data.choices[0].message;
}

/**
 * Standard Pi ReAct Loop for interactive quick tasks.
 */
export async function runAgentLoop(messages: any[], maxSteps = 10) {
  let step = 0;

  while (step < maxSteps) {
    step++;
    console.log(`\n⏳ [Step ${step}] 正在思考...`);

    const assistantMsg = await callLLM(messages);
    messages.push(assistantMsg);

    if (assistantMsg.content) {
      console.log(`🤖 [Pi-Zen]:\n${assistantMsg.content}`);
    }

    const toolCalls = assistantMsg.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      console.log(`\n✅ 任务完成！`);
      return assistantMsg.content;
    }

    for (const call of toolCalls) {
      const toolName = call.function.name;
      let args: Record<string, any> = {};
      try {
        args = JSON.parse(call.function.arguments || "{}");
      } catch {
        console.error(`解析工具参数失败: ${call.function.arguments}`);
      }

      console.log(`\n🛠️  [Action 调用工具]: ${toolName}`);
      console.log(`   参数: ${JSON.stringify(args)}`);

      const result = await executeTool(toolName, args);
      const preview = result.length > 300 ? `${result.slice(0, 300)} ...(略)` : result;
      console.log(`👀 [Observation 工具返回]:\n   ${preview.replace(/\n/g, "\n   ")}`);

      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: result,
      });
    }
  }

  console.log(`\n⚠️ 达到最大步数限制 (${maxSteps})，终止循环以保护 Token。`);
}

/**
 * Print deterministic gate check reports cleanly.
 */
export function printGateSummary(reports: Record<string, any>) {
  console.log("\n==================================================");
  console.log("🛡️  Pi-Zen 确定性门禁审计报告 (Deterministic Gates)");
  console.log("==================================================");
  for (const [name, rep] of Object.entries(reports)) {
    const badge = rep.passed ? "✅ PASS" : "❌ FAIL";
    console.log(`${badge} | [${name.toUpperCase().padEnd(10)}] 得分: ${rep.score}/100`);
    if (rep.errors?.length > 0) {
      for (const err of rep.errors) {
        console.log(`   ❌ 错误: ${err}`);
      }
    }
    if (rep.warnings?.length > 0) {
      for (const warn of rep.warnings) {
        console.log(`   ⚠️ 提示: ${warn}`);
      }
    }
  }
  console.log("==================================================\n");
}

/**
 * CLI Entrypoint supporting `init`, `check`, `sop`, and interactive REPL.
 */
async function main() {
  const argv = process.argv.slice(2);
  const subcommand = argv[0];
  const uiFlag = argv.includes("--ui");
  const cleanArgs = argv.filter((a) => a !== "--ui");

  if (subcommand === "init") {
    const targetDir = path.resolve(cleanArgs[1] || process.cwd());
    const created = scaffoldProject(targetDir, { uiEnabled: uiFlag });
    console.log(`✅ 已初始化 Pi-Zen 工程骨架 (${targetDir}):`);
    created.forEach((f) => console.log(`   - ${f}`));
    return;
  }

  if (subcommand === "check") {
    const targetDir = path.resolve(cleanArgs[1] || process.cwd());
    const reports = runAllProjectGates(targetDir, uiFlag);
    printGateSummary(reports);
    const allPassed = Object.values(reports).every((r) => r.passed);
    process.exitCode = allPassed ? 0 : 1;
    return;
  }

  if (subcommand === "gate") {
    const gateName = cleanArgs[1] || "code";
    const targetDir = path.resolve(cleanArgs[2] || process.cwd());
    const raw = await executeTool("run_zen_gate", { gate: gateName, targetPath: targetDir }, { projectRoot: targetDir });
    const report = JSON.parse(raw);
    printGateSummary({ [gateName]: report });
    process.exitCode = report.passed ? 0 : 1;
    return;
  }

  if (subcommand === "record-bug") {
    const targetDir = path.resolve(cleanArgs[1] || process.cwd());
    const entry = recordBugEntry(targetDir, {
      tags: cleanArgs[2] || "general",
      symptom: cleanArgs[3] || "Unspecified symptom",
      rootCause: cleanArgs[4] || "Unspecified root cause",
      fixRecipe: cleanArgs[5] || "Targeted regression fix",
    });
    console.log(`✅ 已幂等写入错题本 (.pi-zen/memory/bug-ledger.md): [${entry.id}] ${entry.symptom}`);
    return;
  }

  if (subcommand === "bind-digest") {
    const targetDir = path.resolve(cleanArgs[1] || process.cwd());
    const accPath = path.join(targetDir, "docs", "acceptance.md");
    const accContent = fs.readFileSync(accPath, "utf-8");
    const snap = parseAcceptanceSnapshot(accContent);
    const { digest, clutterFiles } = computeWorkspaceTreeDigest(targetDir, snap.allowedPaths);
    for (const c of clutterFiles) {
      fs.rmSync(path.join(targetDir, c), { force: true });
    }
    const updated = accContent.replace(/(- 工作树摘要 \[Tree Digest\]:\s*)(.+)/, `$1${digest}`);
    writeFileAtomic(accPath, updated);
    console.log(`✅ 已清理 ${clutterFiles.length} 个杂物文件并绑定净室工作树摘要: ${digest}`);
    return;
  }

  const rl = readline.createInterface({ input, output });

  const runInteractiveSop = async (reqText: string, targetDir: string, isUi: boolean) => {
    await runEngineeringSopPipeline({
      userRequirement: reqText,
      projectRoot: targetDir,
      uiEnabled: isUi,
      callLLM,
      callbacks: {
        onPhaseStart: (phase, desc) => {
          console.log(`\n🚀 [${phase}] ${desc}`);
        },
        onGateReport: (phase, report) => {
          printGateSummary({ [phase]: report });
        },
        confirmPrd: async (prdContent) => {
          console.log("\n📄 === 需求分析报告与产品 PRD 预览 (docs/prd.md) ===");
          console.log(prdContent.slice(0, 1200) + (prdContent.length > 1200 ? "\n...(详见 docs/prd.md)" : ""));
          const ans = (
            await rl.question("\n🛑 [Gate 1 确认断点] 是否确认上述产品功能、目标与 UI 方向？(y/修订意见) > ")
          ).trim();
          if (ans.toLowerCase() === "y" || ans.toLowerCase() === "yes" || ans === "") {
            return { approved: true };
          }
          return { approved: false, feedback: ans };
        },
        confirmDeploy: async (_accContent, digest) => {
          const ans = (
            await rl.question(
              `\n🛑 [Gate 2 部署验收断点] 全量测试与三轴审计已 PASS (Tree Digest: ${digest.slice(
                0,
                24
              )}...)。是否确认最终部署验收？(y/n) > `
            )
          ).trim();
          return ans.toLowerCase() === "y" || ans.toLowerCase() === "yes" || ans === "";
        },
      },
    });
  };

  try {
    if (subcommand === "sop" && cleanArgs[1]) {
      const reqText = cleanArgs[1];
      const targetDir = path.resolve(cleanArgs[2] || process.cwd());
      await runInteractiveSop(reqText, targetDir, uiFlag);
      return;
    }

    console.log("=========================================================");
    console.log("🚀 Pi-Zen Engineering Harness Agent (v2.0)");
    console.log(`   模型: ${MODEL} | 接口: ${BASE_URL}`);
    console.log("   内置命令: /sop <需求> | /init | /check | /bugs | exit");
    console.log("=========================================================");

    const messages: any[] = [{ role: "system", content: SYSTEM_PROMPT }];

    while (true) {
      const prompt = await rl.question("\n👤 用户 > ");
      const trimmed = prompt.trim();
      if (!trimmed) continue;
      if (trimmed === "exit" || trimmed === "quit") {
        console.log("👋 再见！");
        break;
      }

      if (trimmed === "/init") {
        const files = scaffoldProject(process.cwd(), { uiEnabled: true });
        console.log(`✅ 已初始化权威文档与错题本: ${files.join(", ")}`);
        continue;
      }

      if (trimmed === "/check") {
        printGateSummary(runAllProjectGates(process.cwd(), uiFlag));
        continue;
      }

      if (trimmed === "/bugs") {
        const bugs = readBugLedger(process.cwd());
        console.log(`📒 当前错题本共 ${bugs.length} 条记录:`, JSON.stringify(bugs, null, 2));
        continue;
      }

      if (trimmed === "/patterns") {
        const patterns = readPatternCatalog(process.cwd());
        console.log(`🏛️  当前架构范式库共 ${patterns.length} 条记录:`, JSON.stringify(patterns, null, 2));
        continue;
      }

      if (trimmed.startsWith("/sop ")) {
        const reqText = trimmed.slice(5).trim();
        await runInteractiveSop(reqText, process.cwd(), uiFlag);
        continue;
      }

      messages.push({ role: "user", content: trimmed });
      try {
        await runAgentLoop(messages);
      } catch (err: any) {
        console.error(`❌ 执行异常: ${err.message}`);
      }
    }
  } finally {
    rl.close();
  }
}

if (process.argv[1]?.endsWith("agent.ts")) {
  main().catch(console.error);
}
