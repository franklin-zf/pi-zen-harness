/**
 * Lead Orchestrator & 7-Phase SOP Deterministic State Machine.
 * Coordinates:
 *   Phase 1-2 (PRD & Occam Audit) -> Gate 1 (User Confirm) ->
 *   Phase 3 (Engineering Plan & Vertical Slices) -> Phase 4 (Slice Execution) ->
 *   Phase 5 (Independent 3-Axis QA) <-> Phase 6 (Bug Fix Loop & Bug Ledger) ->
 *   Phase 7 & Gate 2 (Cleanroom Audit & Final Deploy Acceptance)
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type { FindingRecord, GateCheckResult, SOPPhase, TaskPacket } from "./types.ts";
import {
  checkAcceptanceGate,
  checkCodeZenGate,
  checkPlanGate,
  checkPrdGate,
  computeWorkspaceTreeDigest,
  parseAcceptanceSnapshot,
  parseMarkdownTable,
  verifyPlanTestCommandsExecution,
} from "./zen-checker.ts";
import { checkUiDesignGate, validateContentHandoff } from "./design-bridge.ts";
import {
  initProjectMemory,
  loadSopCheckpoint,
  recordBugEntry,
  recordPatternEntry,
  saveSopCheckpoint,
  searchBugs,
  writeFileAtomic,
} from "./memory.ts";
import { type LLMCaller, runIsolatedSubagent } from "./subagent.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.resolve(__dirname, "..", "templates");

export interface OrchestratorCallbacks {
  onPhaseStart?: (phase: SOPPhase, description: string) => void;
  onGateReport?: (phase: SOPPhase | string, report: GateCheckResult) => void;
  confirmPrd?: (prdContent: string) => Promise<{ approved: boolean; feedback?: string }>;
  confirmDeploy?: (acceptanceContent: string, treeDigest: string) => Promise<boolean>;
}

/**
 * Scaffold `docs/prd.md`, `docs/plan.md`, `docs/acceptance.md`, `.pi-zen/memory/bug-ledger.md`,
 * and optionally `docs/content-handoff.json`.
 */
export function scaffoldProject(
  projectRoot: string,
  options: { uiEnabled?: boolean; overwrite?: boolean } = {}
): string[] {
  const root = path.resolve(projectRoot);
  const docsDir = path.join(root, "docs");
  fs.mkdirSync(docsDir, { recursive: true });

  const created: string[] = [];
  const files: Array<{ src: string; dest: string }> = [
    { src: "prd.md", dest: path.join(docsDir, "prd.md") },
    { src: "plan.md", dest: path.join(docsDir, "plan.md") },
    { src: "acceptance.md", dest: path.join(docsDir, "acceptance.md") },
  ];
  if (options.uiEnabled) {
    files.push({
      src: "content-handoff.json",
      dest: path.join(docsDir, "content-handoff.json"),
    });
  }

  for (const item of files) {
    if (options.overwrite || !fs.existsSync(item.dest)) {
      const tpl = fs.readFileSync(path.join(TEMPLATES_DIR, item.src), "utf-8");
      writeFileAtomic(item.dest, tpl);
      created.push(path.relative(root, item.dest));
    }
  }

  const ledgerPath = initProjectMemory(root);
  created.push(path.relative(root, ledgerPath));
  return created;
}

/**
 * Run all applicable deterministic gates for a project directory.
 */
export function runAllProjectGates(
  projectRoot: string,
  uiEnabled = false
): Record<string, GateCheckResult> {
  const root = path.resolve(projectRoot);
  const prdPath = path.join(root, "docs", "prd.md");
  const planPath = path.join(root, "docs", "plan.md");
  const accPath = path.join(root, "docs", "acceptance.md");
  const handoffPath = path.join(root, "docs", "content-handoff.json");

  const prdContent = fs.existsSync(prdPath) ? fs.readFileSync(prdPath, "utf-8") : "";
  const planContent = fs.existsSync(planPath) ? fs.readFileSync(planPath, "utf-8") : "";
  const accContent = fs.existsSync(accPath) ? fs.readFileSync(accPath, "utf-8") : "";

  const results: Record<string, GateCheckResult> = {
    prd: checkPrdGate(prdContent, uiEnabled),
    plan: checkPlanGate(planContent, prdContent),
    code: checkCodeZenGate(root),
    acceptance: checkAcceptanceGate(accContent, prdContent, planContent),
  };

  if (uiEnabled || fs.existsSync(handoffPath)) {
    const rawHandoff = fs.existsSync(handoffPath)
      ? fs.readFileSync(handoffPath, "utf-8")
      : "{}";
    results.handoff = validateContentHandoff(rawHandoff, prdContent);
    results.ui = checkUiDesignGate(root);
  }

  return results;
}

/**
 * Execute the full 7-Phase Pi-Zen Engineering SOP Pipeline.
 */
export async function runEngineeringSopPipeline(options: {
  userRequirement: string;
  projectRoot: string;
  uiEnabled?: boolean;
  callLLM: LLMCaller;
  callbacks?: OrchestratorCallbacks;
  maxQaIterations?: number;
  silent?: boolean;
}): Promise<{
  success: boolean;
  completedPhases: SOPPhase[];
  qaIterations: number;
  treeDigest: string;
  finalGateReports: Record<string, GateCheckResult>;
}> {
  const {
    userRequirement,
    projectRoot,
    uiEnabled = false,
    callLLM,
    callbacks = {},
    maxQaIterations = 3,
    silent = false,
  } = options;

  const root = path.resolve(projectRoot);
  scaffoldProject(root, { uiEnabled, overwrite: false });
  const existingCheckpoint = loadSopCheckpoint(root);
  const completedPhases: SOPPhase[] = existingCheckpoint ? [...existingCheckpoint.completedPhases] : [];

  const updateCheckpoint = (
    currentPhase: SOPPhase,
    qaIter: number,
    status: "in_progress" | "completed" | "halted" = "in_progress"
  ) => {
    saveSopCheckpoint(root, {
      userRequirement,
      uiEnabled,
      currentPhase,
      completedPhases: [...new Set(completedPhases)],
      qaIteration: qaIter,
      updatedAt: new Date().toISOString(),
      status,
    });
  };

  // Recall relevant historical bugs from `.pi-zen/memory/bug-ledger.md`
  const recalledBugs = searchBugs(root);
  const bugRecallContext =
    recalledBugs.length > 0
      ? recalledBugs
          .slice(-5)
          .map((b) => `- [${b.id}] 症状: ${b.symptom} | 根因: ${b.rootCause} | 配方: ${b.fixRecipe}`)
          .join("\n")
      : "暂无历史错题记录。";

  // ============================================================================
  // Phase 1 & 2: Evaluate Requirement & Generate PRD (+ Taste Contract if UI)
  // ============================================================================
  let prdConfirmed = false;
  let userFeedback = "";

  while (!prdConfirmed) {
    callbacks.onPhaseStart?.(
      "evaluate_and_prd",
      "Phase 1 & 2: 第一性原理需求评估、最小实体审计与产品 PRD 生成"
    );

    const prdPacket: TaskPacket = {
      goal: "基于第一性原理与奥卡姆剃刀评估用户需求，完成最小实体审计并输出 docs/prd.md",
      phase: "evaluate_and_prd",
      role: "product-kernel",
      requirementIds: ["REQ-001"],
      allowedPaths: uiEnabled ? ["docs/prd.md", "docs/content-handoff.json"] : ["docs/prd.md"],
      deliverables: uiEnabled ? ["docs/prd.md", "docs/content-handoff.json"] : ["docs/prd.md"],
      exitCriteria: [
        "包含一句话产品承诺与第一性原理拆解",
        "完成 Minimal-Entity Audit (drop_test / merge_test)",
        "明确 Non-Goals 与五态交互矩阵",
        ...(uiEnabled ? ["包含合法 Taste Contract JSON 与 docs/content-handoff.json"] : []),
      ],
      nonGoals: ["严禁在此阶段编写或修改任何业务源码"],
      bugRecallContext,
      uiEnabled,
    };

    await runIsolatedSubagent({
      packet: prdPacket,
      projectRoot: root,
      userPrompt: `原始用户需求：${userRequirement}${
        userFeedback ? `\n用户修订反馈：${userFeedback}` : ""
      }\n请使用 write_file 更新 docs/prd.md${
        uiEnabled ? " 及 docs/content-handoff.json" : ""
      }。`,
      callLLM,
      silent,
    });

    const prdContent = fs.readFileSync(path.join(root, "docs", "prd.md"), "utf-8");
    const prdGate = checkPrdGate(prdContent, uiEnabled);
    callbacks.onGateReport?.("evaluate_and_prd", prdGate);
    if (!prdGate.passed) {
      throw new Error(`Phase 1/2 PRD 门禁未通过:\n- ${prdGate.errors.join("\n- ")}`);
    }
    completedPhases.push("evaluate_and_prd");

    // Gate 1: User Confirmation of Product Features & Goals
    callbacks.onPhaseStart?.("user_confirm_prd", "Gate 1: 等待用户确认产品功能、目标与 UI 方向");
    if (callbacks.confirmPrd) {
      const decision = await callbacks.confirmPrd(prdContent);
      if (decision.approved) {
        prdConfirmed = true;
      } else {
        userFeedback = decision.feedback || "请进一步精简范围";
      }
    } else {
      prdConfirmed = true;
    }
  }
  completedPhases.push("user_confirm_prd");
  updateCheckpoint("user_confirm_prd", 0);

  // ============================================================================
  // Phase 3: Design Engineering Plan (Flat Arch, 7-Dim BR, Vertical Slices)
  // ============================================================================
  callbacks.onPhaseStart?.(
    "design_plan",
    "Phase 3: 设计两层扁平架构、7 维业务规则矩阵与垂直研发切片计划 (docs/plan.md)"
  );

  const prdContent = fs.readFileSync(path.join(root, "docs", "prd.md"), "utf-8");
  const reqRows = parseMarkdownTable(prdContent, "Requirements").rows;
  const reqIds = reqRows
    .map((r) => (r["ID"] || r["Requirement ID"] || "").trim())
    .filter(Boolean);

  const planPacket: TaskPacket = {
    goal: "普查代码库，制定两层扁平架构、Lean Schema、7 维 BR 防御矩阵与垂直切片计划 docs/plan.md",
    phase: "design_plan",
    role: "architect-kernel",
    requirementIds: reqIds,
    allowedPaths: uiEnabled ? ["docs/plan.md", "docs/content-handoff.json"] : ["docs/plan.md"],
    deliverables: ["docs/plan.md"],
    exitCriteria: [
      "两层扁平架构说明 (Complexity Justification & Flat Design)",
      "Lean Schema 零预留字段声明",
      "完整覆盖 BR-1 至 BR-7 七维业务规则",
      "所有 REQ-NNN 均映射到具体 SLC-NNN 垂直切片并声明 Allowed Paths 与 Highest Stable Seam",
    ],
    nonGoals: ["不到 3 个复用点严禁引入 Factory/Adapter/Strategy", "严禁在此阶段直接写业务实现代码"],
    bugRecallContext,
    uiEnabled,
  };

  await runIsolatedSubagent({
    packet: planPacket,
    projectRoot: root,
    userPrompt: `已确认的 PRD 内容如下：\n\n${prdContent}\n\n请编写 docs/plan.md。`,
    callLLM,
    silent,
  });

  const planContent = fs.readFileSync(path.join(root, "docs", "plan.md"), "utf-8");
  const planGate = checkPlanGate(planContent, prdContent);
  callbacks.onGateReport?.("design_plan", planGate);
  if (!planGate.passed) {
    throw new Error(`Phase 3 研发计划门禁未通过:\n- ${planGate.errors.join("\n- ")}`);
  }
  completedPhases.push("design_plan");
  updateCheckpoint("design_plan", 0);

  // ============================================================================
  // Phase 4: Execute Vertical Slices (Red-Green-Refactor TDD & Design v4.0)
  // ============================================================================
  callbacks.onPhaseStart?.(
    "execute_slices",
    "Phase 4: 按垂直切片逐个派生受限上下文执行红绿 TDD 实现"
  );

  const sliceRows = parseMarkdownTable(planContent, "Vertical Slices").rows;
  for (const slice of sliceRows) {
    const sliceId = (slice["Slice ID"] || "SLC-001").trim();
    const sliceReqs = ((slice["Included Requirements"] || "REQ-001").match(/REQ-\d{3}/g) || [
      "REQ-001",
    ]);
    const allowedPaths = (slice["Allowed Paths"] || "src, tests")
      .split(",")
      .map((p) => p.trim().replace(/`/g, ""))
      .filter(Boolean);
    const seam = slice["Highest Stable Seam"] || "Public Module Entry";

    const sliceRole = uiEnabled ? "ui-specialist" : "zen-implementer";
    const slicePacket: TaskPacket = {
      goal: `实现垂直切片 ${sliceId}（公共测试接缝: ${seam}），遵循代码之禅红绿 TDD 闭环`,
      phase: "execute_slices",
      role: sliceRole,
      requirementIds: sliceReqs,
      sliceId,
      allowedPaths,
      deliverables: allowedPaths,
      exitCriteria: [
        "在最高稳定公共接缝编写测试并全部通过",
        "无空 catch 块、无 ext_json 预留字段、无过度包装类",
        "严禁越界修改 allowedPaths 之外的文件",
      ],
      nonGoals: ["严禁修改 docs/prd.md 或 docs/acceptance.md"],
      bugRecallContext,
      uiEnabled,
    };

    await runIsolatedSubagent({
      packet: slicePacket,
      projectRoot: root,
      userPrompt: `请严格在允许路径 [${allowedPaths.join(
        ", "
      )}] 内实现切片 ${sliceId}（关联需求: ${sliceReqs.join(
        ", "
      )}），并运行验证命令: ${slice["Verification Command"] || "node --test"}`,
      callLLM,
      silent,
    });
  }
  completedPhases.push("execute_slices");
  updateCheckpoint("execute_slices", 0);

  // ============================================================================
  // Phase 5 & Phase 6: Independent Full QA <-> Bug Fix Iteration Loop
  // ============================================================================
  let qaPassed = false;
  let qaIteration = 0;

  while (!qaPassed && qaIteration < maxQaIterations) {
    qaIteration++;
    updateCheckpoint("full_test_qa", qaIteration);
    callbacks.onPhaseStart?.(
      "full_test_qa",
      `Phase 5: 独立 QA 全量测试与三轴审计 (第 ${qaIteration}/${maxQaIterations} 轮)`
    );

    const qaPacket: TaskPacket = {
      goal: `在独立上下文中对产品执行全量测试（规格与7维BR + 代码之禅 + UI审计），并更新 docs/acceptance.md`,
      phase: "full_test_qa",
      role: "independent-qa",
      requirementIds: reqIds,
      allowedPaths: ["docs/acceptance.md"],
      deliverables: ["docs/acceptance.md"],
      exitCriteria: [
        "执行真实测试命令验证所有 REQ-NNN 与 BR-1..BR-7",
        "运行代码之禅门禁 (run_zen_gate code)",
        "三权分立：Independent QA 身份与实现者完全隔离",
        "如发现缺陷，如实登记至 Findings 表并将 Decision 设为 FAIL",
      ],
      nonGoals: ["严禁 QA 直接动手修改业务源码"],
      uiEnabled,
    };

    await runIsolatedSubagent({
      packet: qaPacket,
      projectRoot: root,
      userPrompt: `当前为第 ${qaIteration} 轮独立全量验收。请核查实现代码、运行全量测试并更新 docs/acceptance.md。`,
      callLLM,
      silent,
    });

    const accContent = fs.readFileSync(path.join(root, "docs", "acceptance.md"), "utf-8");
    const accGate = checkAcceptanceGate(accContent, prdContent, planContent);
    const codeGate = checkCodeZenGate(root);
    const realTestGate = verifyPlanTestCommandsExecution(root, planContent);
    callbacks.onGateReport?.("full_test_qa", accGate);
    callbacks.onGateReport?.("code_zen_audit", codeGate);
    callbacks.onGateReport?.("real_test_execution", realTestGate);

    let uiGatesPassed = true;
    const uiGateErrors: string[] = [];
    if (uiEnabled) {
      const handoffPath = path.join(root, "docs", "content-handoff.json");
      const rawHandoff = fs.existsSync(handoffPath)
        ? fs.readFileSync(handoffPath, "utf-8")
        : "{}";
      const handoffGate = validateContentHandoff(rawHandoff, prdContent);
      const uiGate = checkUiDesignGate(root);
      callbacks.onGateReport?.("handoff_audit", handoffGate);
      callbacks.onGateReport?.("ui_design_audit", uiGate);
      if (!handoffGate.passed || !uiGate.passed) {
        uiGatesPassed = false;
        uiGateErrors.push(...handoffGate.errors, ...uiGate.errors);
      }
    }

    if (accGate.passed && codeGate.passed && realTestGate.passed && uiGatesPassed) {
      qaPassed = true;
      completedPhases.push("full_test_qa");
      updateCheckpoint("full_test_qa", qaIteration);
      break;
    }

    // Transition to Phase 6: Deterministic Bug Iteration & Fix
    const snapshot = parseAcceptanceSnapshot(accContent);
    const activeFindings: FindingRecord[] = [...snapshot.openBlockingOrMajor];

    // Synthesize findings from deterministic gate failures if QA didn't already list them
    const extraGateErrors = [
      ...codeGate.errors.map((e) => ({ type: "code" as const, msg: e })),
      ...realTestGate.errors.map((e) => ({ type: "test" as const, msg: e })),
      ...uiGateErrors.map((e) => ({ type: "ui" as const, msg: e })),
    ];
    extraGateErrors.forEach((item, idx) => {
      activeFindings.push({
        id: `GATE-${qaIteration}-${idx + 1}`,
        type: item.type,
        severity: "blocking",
        moduleId: "MOD-001",
        requirementId: reqIds[0] || "REQ-001",
        problem: item.msg,
        evidence: "Deterministic Hardware Gate Failure",
        owner: uiEnabled && item.type === "ui" ? "ui-specialist" : "zen-implementer",
        status: "open",
        foundBy: "deterministic-gate",
        iteration: qaIteration,
      });
    });

    if (activeFindings.length === 0 && !accGate.passed) {
      updateCheckpoint("full_test_qa", qaIteration, "halted");
      throw new Error(`独立验收未通过且无结构化 Finding 可供修复:\n- ${accGate.errors.join("\n- ")}`);
    }

    callbacks.onPhaseStart?.(
      "iterate_bug_fix",
      `Phase 6: 触发缺陷迭代修复闭环 (待修复阻断/主要缺陷: ${activeFindings.length} 项)`
    );

    const fixRole =
      uiEnabled && activeFindings.some((f) => f.type === "ui")
        ? "ui-specialist"
        : "zen-implementer";

    const fixPacket: TaskPacket = {
      goal: `定向修复独立 QA 与门禁发现的 ${activeFindings.length} 项缺陷并补充回归测试`,
      phase: "iterate_bug_fix",
      role: fixRole,
      requirementIds: activeFindings.map((f) => f.requirementId),
      allowedPaths: snapshot.allowedPaths,
      deliverables: snapshot.allowedPaths,
      exitCriteria: [
        "针对每一项 Finding 编写复现测试并修复通过",
        "修复后保持代码之禅与 UI Sloplint 100% 合规",
      ],
      nonGoals: ["严禁自行修改 docs/acceptance.md 将缺陷改为 closed（必须由下一轮 QA 独立复验关闭）"],
      bugRecallContext,
      uiEnabled,
    };

    const findingsSummary = activeFindings
      .map((f) => `- [${f.id} | ${f.severity}] (${f.requirementId}): ${f.problem} | 证据: ${f.evidence}`)
      .join("\n");

    await runIsolatedSubagent({
      packet: fixPacket,
      projectRoot: root,
      userPrompt: `独立 QA 与确定性门禁报告了以下必须修复的缺陷：\n${findingsSummary}\n请在允许路径 [${snapshot.allowedPaths.join(
        ", "
      )}] 内完成修复并运行回归测试。`,
      callLLM,
      silent,
    });

    // Record each fixed finding into `.pi-zen/memory/bug-ledger.md` (Experience Flywheel)
    for (const finding of activeFindings) {
      recordBugEntry(root, {
        tags: `${finding.type},${finding.moduleId}`,
        symptom: finding.problem,
        rootCause: `Detected in QA iteration ${qaIteration} (${finding.evidence})`,
        fixRecipe: `Targeted fix in ${snapshot.allowedPaths.join(",")} with regression test`,
        commitOrSlice: `iter-${qaIteration}`,
        status: "resolved",
      });
    }

    completedPhases.push("iterate_bug_fix");
    updateCheckpoint("iterate_bug_fix", qaIteration);
  }

  if (!qaPassed) {
    throw new Error(`达到最大 QA/Fix 迭代轮次 (${maxQaIterations}) 仍未通过全量验收，中止流水线并请求人工介入。`);
  }

  // ============================================================================
  // Phase 7 & Gate 2: Cleanroom Workspace Audit & Final Deploy Acceptance
  // ============================================================================
  callbacks.onPhaseStart?.(
    "deploy_acceptance",
    "Phase 7: 净室工作树摘要绑定与最终部署验收确认"
  );

  const accPath = path.join(root, "docs", "acceptance.md");
  const currentAcc = fs.readFileSync(accPath, "utf-8");
  const snapshot = parseAcceptanceSnapshot(currentAcc);
  const { digest, clutterFiles } = computeWorkspaceTreeDigest(root, snapshot.allowedPaths);

  if (clutterFiles.length > 0) {
    for (const clutter of clutterFiles) {
      fs.rmSync(path.join(root, clutter), { force: true });
    }
  }

  // Bind calculated SHA-256 Tree Digest into docs/acceptance.md
  const boundAcc = currentAcc.replace(
    /(- 工作树摘要 \[Tree Digest\]:\s*)(.+)/,
    `$1${digest}`
  );
  writeFileAtomic(accPath, boundAcc);

  const finalGates = runAllProjectGates(root, uiEnabled);
  if (callbacks.confirmDeploy) {
    const deployApproved = await callbacks.confirmDeploy(boundAcc, digest);
    if (!deployApproved) {
      return {
        success: false,
        completedPhases,
        qaIterations: qaIteration,
        treeDigest: digest,
        finalGateReports: finalGates,
      };
    }
  }

  completedPhases.push("deploy_acceptance");
  updateCheckpoint("deploy_acceptance", qaIteration, "completed");

  // Record verified architectural & public-seam TDD pattern into `.pi-zen/memory/pattern-catalog.md` (P2-1)
  const firstSlice = sliceRows[0];
  recordPatternEntry(root, {
    name: `Flat-2Layer-${reqIds[0] || "Core"}`,
    tags: `flat-arch,public-seam-tdd${uiEnabled ? ",design-v4" : ""}`,
    context: userRequirement.slice(0, 80),
    solution: "Two-Layer Flat Architecture (Entrypoint -> Core Domain) with Lean Schema & 7-Dim BR",
    seamExample: firstSlice?.["Highest Stable Seam"] || "Public Module Entry",
  });

  return {
    success: true,
    completedPhases,
    qaIterations: qaIteration,
    treeDigest: digest,
    finalGateReports: finalGates,
  };
}
