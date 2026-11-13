/**
 * Deterministic Gate Engine (Zen Checker):
 * Unifies Occam's Razor Audit, Code Zen Scanner, 7-Dimension BR Scanner,
 * Separation-of-Duties Acceptance Gate, and Workspace Tree Digest Audit.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { execSync } from "node:child_process";
import type { FindingRecord, GateCheckResult, LoopSnapshot } from "./types.ts";

const IGNORED_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  ".venv",
  "venv",
  "__pycache__",
  ".pi-zen",
]);

const CODE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".py", ".go", ".sql"]);

const SUSPICIOUS_PLACEHOLDERS = [
  "reserved for future",
  "for symmetry",
  "to be discussed",
  "ext_json",
  "extra_data",
  "reserved_field",
];

/**
 * Helper: Extract markdown table rows under a heading that contains `headingKeyword`.
 */
export function parseMarkdownTable(
  markdown: string,
  headingKeyword: string
): { headers: string[]; rows: Record<string, string>[] } {
  const lines = markdown.splitlines ? (markdown as any).splitlines() : markdown.split(/\r?\n/);
  let inSection = false;
  let headers: string[] = [];
  const rows: Record<string, string>[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("#")) {
      if (line.toLowerCase().includes(headingKeyword.toLowerCase())) {
        inSection = true;
        headers = [];
        continue;
      } else if (inSection && headers.length > 0) {
        break;
      }
    }
    if (!inSection) continue;

    if (line.startsWith("|") && line.endsWith("|")) {
      const cells = line
        .slice(1, -1)
        .split("|")
        .map((c: string) => c.trim());
      if (cells.every((c: string) => /^[-:]+$/.test(c))) {
        continue; // separator row
      }
      if (headers.length === 0) {
        headers = cells.map((h: string) => {
          const bracketMatch = h.match(/\[([^\]]+)\]/);
          return bracketMatch ? bracketMatch[1].trim() : h.trim();
        });
      } else {
        const rowObj: Record<string, string> = {};
        headers.forEach((h, idx) => {
          rowObj[h] = cells[idx] ?? "";
        });
        rows.push(rowObj);
      }
    }
  }
  return { headers, rows };
}

/**
 * Gate 1: Validate `docs/prd.md` (First-Principles, Occam Minimal-Entity Audit, 5-State Matrix, Taste Contract)
 */
export function checkPrdGate(prdContent: string, uiEnabled = false): GateCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const lower = prdContent.toLowerCase();

  if (!prdContent || prdContent.trim().length < 50) {
    return {
      passed: false,
      phase: "evaluate_and_prd",
      score: 0,
      errors: ["prd.md 内容为空或过短"],
      warnings: [],
    };
  }

  // 1. Check Confirmation & Core Sections
  if (!lower.includes("[product promise]") && !lower.includes("一句话产品承诺")) {
    errors.push("prd.md: 缺少 '## 一句话产品承诺 [Product Promise]' 章节");
  }
  if (!lower.includes("single primary flow:")) {
    errors.push("prd.md: 缺少产品奥卡姆剃刀 '- Single Primary Flow:' 声明");
  }
  if (!lower.includes("zero-config preference:")) {
    errors.push("prd.md: 缺少产品奥卡姆剃刀 '- Zero-Config Preference:' 声明");
  }
  if (!lower.includes("surface minimization:")) {
    errors.push("prd.md: 缺少产品奥卡姆剃刀 '- Surface Minimization:' 声明");
  }
  if (!lower.includes("[non-goals]") && !lower.includes("非目标")) {
    errors.push("prd.md: 缺少 '### 非目标 [Non-Goals]' 声明（必须明确故意不做什么）");
  }

  // 2. Check Minimal-Entity Audit table (drop_test / merge_test)
  const auditTable = parseMarkdownTable(prdContent, "Minimal-Entity Audit");
  if (auditTable.rows.length === 0) {
    errors.push("prd.md: 缺少 '## 最小实体审计 [Minimal-Entity Audit]' 表格或无审计记录");
  } else {
    for (const row of auditTable.rows) {
      const entity = row["Entity Introduced"] || row["引入实体"] || "";
      if (!entity || entity.toLowerCase() === "none") continue;
      const dropTest = row["drop_test"] || "";
      const mergeTest = row["merge_test"] || "";
      const decision = (row["Decision"] || "").toLowerCase();

      if (dropTest.length < 6) {
        errors.push(`prd.md: 实体 '${entity}' 的 drop_test 理由过短或为空`);
      }
      if (mergeTest.length < 6) {
        errors.push(`prd.md: 实体 '${entity}' 的 merge_test 理由过短或为空`);
      }
      if (SUSPICIOUS_PLACEHOLDERS.some((p) => dropTest.toLowerCase().includes(p))) {
        errors.push(`prd.md: 实体 '${entity}' 包含疑似过度设计的预留理由 (${dropTest})`);
      }
      if (!["approved", "pruned", "merged", "rejected"].includes(decision)) {
        errors.push(
          `prd.md: 实体 '${entity}' 的 Decision 必须为 approved | pruned | merged | rejected，当前为 '${decision}'`
        );
      }
    }
  }

  // 3. Check Requirements table (`REQ-NNN`)
  const reqTable = parseMarkdownTable(prdContent, "Requirements");
  const reqIds = reqTable.rows
    .map((r) => r["ID"] || r["Requirement ID"] || "")
    .filter((id) => /^REQ-\d{3}$/.test(id));
  if (reqIds.length === 0) {
    errors.push("prd.md: '## 需求规格 [Requirements]' 表中未找到合法的 REQ-NNN 需求编号");
  }

  // 4. Check Five-State Matrix
  const stateTable = parseMarkdownTable(prdContent, "Five-State Matrix");
  if (stateTable.rows.length === 0) {
    errors.push("prd.md: 缺少 '## 全链路五态交互矩阵 [Five-State Matrix]' 表格");
  }

  // 5. Check UI Taste Contract if UI is enabled
  if (uiEnabled) {
    const jsonMatch = prdContent.match(/```json\s*([\s\S]*?)```/);
    if (!jsonMatch) {
      errors.push("prd.md: UI 模式下必须在 '[Taste Contract]' 章节提供 JSON 格式的审美契约");
    } else {
      try {
        const taste = JSON.parse(jsonMatch[1]);
        const requiredKeys = [
          "visual_thesis",
          "content_tension",
          "signature_move",
          "anti_reference",
          "restraint_rule",
        ];
        for (const key of requiredKeys) {
          if (typeof taste[key] !== "string" || taste[key].trim().length < 5) {
            errors.push(`prd.md: Taste Contract 缺少有效字段 '${key}'`);
          }
        }
      } catch {
        errors.push("prd.md: Taste Contract JSON 解析失败");
      }
    }
  }

  const score = Math.max(0, 100 - errors.length * 20 - warnings.length * 5);
  return {
    passed: errors.length === 0,
    phase: "evaluate_and_prd",
    score,
    errors,
    warnings,
    metrics: { requirementCount: reqIds.length, auditedEntities: auditTable.rows.length },
  };
}

/**
 * Gate 2: Validate `docs/plan.md` (Flat 2-Layer Arch, Lean Schema, 7-Dim BR Matrix, Vertical Slices)
 */
export function checkPlanGate(planContent: string, prdContent?: string): GateCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const lower = planContent.toLowerCase();

  if (!lower.includes("complexity justification & flat design") && !lower.includes("扁平设计")) {
    errors.push("plan.md: 缺少 '### 复杂度说明与扁平设计 [Complexity Justification & Flat Design]'");
  }
  if (!lower.includes("lean schema") && !lower.includes("not applicable")) {
    errors.push("plan.md: 缺少 'Lean Schema'（零预留字段）声明");
  }
  if (/\b(?:ext_json|extra_data|reserved_\w+)\b/i.test(planContent)) {
    const nonNegated = planContent
      .split(/\r?\n/)
      .some(
        (line) =>
          /\b(?:ext_json|extra_data|reserved_\w+)\b/i.test(line) &&
          !/(?:严禁|禁止|forbid|never|zero|无)/i.test(line)
      );
    if (nonNegated) {
      errors.push("plan.md: 检测到违背奥卡姆剃刀的预留扩展字段 (ext_json / extra_data)");
    }
  }

  // Check 7-Dimension Business Rule Matrix
  const brTable = parseMarkdownTable(planContent, "Business Rule Matrix");
  const foundBrIds = new Set(brTable.rows.map((r) => (r["Rule ID"] || "").trim()));
  for (let i = 1; i <= 7; i++) {
    const brId = `BR-${i}`;
    if (!foundBrIds.has(brId)) {
      errors.push(`plan.md: 7 维业务规则矩阵缺少必填维度 '${brId}'`);
    }
  }

  // Check Vertical Slices (`SLC-NNN`)
  const sliceTable = parseMarkdownTable(planContent, "Vertical Slices");
  const sliceIds = sliceTable.rows
    .map((r) => (r["Slice ID"] || "").trim())
    .filter((id) => /^SLC-\d{3}$/.test(id));
  if (sliceIds.length === 0) {
    errors.push("plan.md: '## 垂直研发切片计划 [Vertical Slices]' 缺少合法的 SLC-NNN 切片定义");
  }

  for (const row of sliceTable.rows) {
    const slcId = row["Slice ID"] || "unknown";
    const allowed = row["Allowed Paths"] || "";
    const seam = row["Highest Stable Seam"] || "";
    if (!allowed.trim()) {
      errors.push(`plan.md: 切片 '${slcId}' 未声明 Allowed Paths（允许修改路径白名单）`);
    }
    if (!seam.trim()) {
      errors.push(`plan.md: 切片 '${slcId}' 未声明 Highest Stable Seam（最高稳定公共测试接缝）`);
    }
  }

  // Cross-check that every REQ-NNN in prd.md is covered by at least one slice
  if (prdContent) {
    const reqTable = parseMarkdownTable(prdContent, "Requirements");
    const prdReqs = reqTable.rows
      .map((r) => (r["ID"] || r["Requirement ID"] || "").trim())
      .filter((id) => /^REQ-\d{3}$/.test(id));
    const sliceCoveredReqs = new Set<string>();
    for (const row of sliceTable.rows) {
      const matches = (row["Included Requirements"] || "").match(/REQ-\d{3}/g) || [];
      matches.forEach((m) => sliceCoveredReqs.add(m));
    }
    for (const reqId of prdReqs) {
      if (!sliceCoveredReqs.has(reqId)) {
        errors.push(`plan.md: PRD 中的需求 '${reqId}' 未被任何垂直切片 (SLC-NNN) 覆盖`);
      }
    }
  }

  const score = Math.max(0, 100 - errors.length * 20 - warnings.length * 5);
  return {
    passed: errors.length === 0,
    phase: "design_plan",
    score,
    errors,
    warnings,
    metrics: { sliceCount: sliceIds.length, brDimensions: foundBrIds.size },
  };
}

/**
 * Code Zen & 7-Dimension Business Rule Static Scanner
 */
export function checkCodeZenGate(targetPath: string): GateCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const resolved = path.resolve(targetPath);

  if (!fs.existsSync(resolved)) {
    return {
      passed: false,
      phase: "code_zen_audit",
      score: 0,
      errors: [`目标路径不存在: ${resolved}`],
      warnings: [],
    };
  }

  const filesToScan: string[] = [];
  function collectFiles(current: string) {
    const stat = fs.lstatSync(current);
    if (stat.isSymbolicLink()) return;
    if (stat.isFile()) {
      if (CODE_EXTENSIONS.has(path.extname(current))) {
        filesToScan.push(current);
      }
      return;
    }
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(current)) {
        if (IGNORED_DIRS.has(entry)) continue;
        collectFiles(path.join(current, entry));
      }
    }
  }
  collectFiles(resolved);

  let silentCatchCount = 0;
  let speculativeFieldCount = 0;
  let patternWrapperCount = 0;
  let todoPlaceholderCount = 0;
  let deepNestingCount = 0;

  const brCounts: Record<string, number> = {
    "BR-1_BR-2_ErrorHandling": 0,
    "BR-3_BoundaryValidation": 0,
    "BR-4_ScopePermission": 0,
    "BR-5_Idempotency": 0,
    "BR-6_ConcurrencyAtomic": 0,
    "BR-7_TimeoutFallback": 0,
  };

  for (const file of filesToScan) {
    const rel = path.relative(resolved, file) || path.basename(file);
    // Do not flag the scanner's own regex definitions or test files testing the scanner
    const isCheckerSelf = rel.endsWith("zen-checker.ts") || rel.includes(".test.");
    const content = fs.readFileSync(file, "utf-8");
    const lines = content.split(/\r?\n/);

    // 1. Check Empty Catch Blocks (Explicit > Implicit)
    if (!isCheckerSelf && /catch\s*(?:\([^)]*\))?\s*\{\s*\}/m.test(content)) {
      silentCatchCount++;
      errors.push(`${rel}: 违反代码之禅 [显式与零静默] — 检测到空的 catch {} 块吞没异常`);
    }

    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx];
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("#") || trimmed.startsWith("*")) {
        // Check unresolved TODO/FIXME in comments of non-test production files
        if (!isCheckerSelf && /\b(?:TODO|FIXME)\b/.test(trimmed)) {
          todoPlaceholderCount++;
          warnings.push(`${rel}:${idx + 1}: 存在未清理的 TODO/FIXME 占位注释`);
        }
        continue;
      }

      if (!isCheckerSelf) {
        // 2. Speculative fields (Occam's Razor) — ignore negated rule statements
        if (
          /\b(?:ext_json|extra_data|reserved_field|custom_fields)\b/i.test(line) &&
          !/(?:严禁|禁止|无|forbid|never|zero)/i.test(line)
        ) {
          speculativeFieldCount++;
          errors.push(`${rel}:${idx + 1}: 违反奥卡姆剃刀 [Lean Schema] — 检测到预留字段 (ext_json/extra_data)`);
        }

        // 3. Pattern wrapper bloat
        const wrappers = line.match(/\bclass\s+\w*(?:Factory|Adapter|Strategy|Proxy|Facade)\b/g);
        if (wrappers) {
          patternWrapperCount += wrappers.length;
        }

        // 4. Indentation depth check (Flat > Nested)
        const leadingSpaces = line.match(/^(\s*)/)?.[1].length ?? 0;
        // > 24 spaces (6 levels of 4-space indent or 12 levels of 2-space indent)
        if (leadingSpaces > 24 && /^(?:if|for|while|switch)\b/.test(trimmed)) {
          deepNestingCount++;
          warnings.push(`${rel}:${idx + 1}: 缩进嵌套过深 (建议遵循 [扁平胜于嵌套] 使用 Guard Clause 早返回)`);
        }
      }

      // 5. 7-Dimension BR Pattern Evidence Counting
      if (/\b(?:try|catch|throw\s+new\s+Error|if\s*\(!| instanceof\s+Error)\b/.test(line)) {
        brCounts["BR-1_BR-2_ErrorHandling"]++;
      }
      if (/\b(?:length|size|min|max|limit|slice|trim|Array\.isArray)\b/.test(line)) {
        brCounts["BR-3_BoundaryValidation"]++;
      }
      if (/\b(?:allowedPaths|allowed_paths|allowed_scopes|checkPathAllowed|permission|auth)\b/i.test(line)) {
        brCounts["BR-4_ScopePermission"]++;
      }
      if (/\b(?:idempoten|dedup|Set\(|Map\(|unique)\b/i.test(line)) {
        brCounts["BR-5_Idempotency"]++;
      }
      if (/\b(?:renameSync|writeFileAtomic|lock|mutex|atomic|sha256)\b/i.test(line)) {
        brCounts["BR-6_ConcurrencyAtomic"]++;
      }
      if (/\b(?:timeout|maxSteps|AbortController|fallback)\b/i.test(line)) {
        brCounts["BR-7_TimeoutFallback"]++;
      }
    }
  }

  if (patternWrapperCount > 2) {
    errors.push(
      `违反代码之禅 [扁平胜于嵌套] — 检测到 ${patternWrapperCount} 个设计模式包装类 (Factory/Adapter/Strategy)，请确认是否满足 >=3 处复用点`
    );
  }

  const penalty =
    silentCatchCount * 25 +
    speculativeFieldCount * 25 +
    Math.max(0, patternWrapperCount - 2) * 15 +
    todoPlaceholderCount * 5 +
    deepNestingCount * 5;
  const score = Math.max(0, 100 - penalty);

  return {
    passed: errors.length === 0,
    phase: "code_zen_audit",
    score,
    errors,
    warnings,
    metrics: {
      scannedFiles: filesToScan.length,
      ...brCounts,
    },
  };
}

/**
 * Parse `docs/acceptance.md` into a deterministic `LoopSnapshot` for the Review/Fix Loop Controller.
 */
export function parseAcceptanceSnapshot(acceptanceContent: string): LoopSnapshot {
  const getField = (label: string, fallback = ""): string => {
    const regex = new RegExp(`(?:${label}|\\[${label}\\])\\s*:\\s*(.+)$`, "im");
    const m = acceptanceContent.match(regex);
    return m ? m[1].trim() : fallback;
  };

  const rawImpl = getField("Implementation contributors", "");
  const implementerIds = rawImpl
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const reviewerId = (getField("Independent Reviewer") || getField("Reviewer")).toLowerCase();
  const qaId = (getField("Independent QA") || getField("QA Auditor")).toLowerCase();
  const targetCommitOrDigest = getField("Target Commit SHA") || getField("Tree Digest");
  const allowedPaths = getField("Allowed Paths", "src, tests")
    .split(",")
    .map((s) => s.trim().replace(/`/g, ""))
    .filter(Boolean);
  const declaredState = getField("Loop State", "testing");
  const totalIteration = Number.parseInt(getField("Total Iteration", "1"), 10) || 1;
  const maxTotalIterations = Number.parseInt(getField("Max Total Iterations", "5"), 10) || 5;
  const maxAttemptsPerFinding = Number.parseInt(getField("Max Attempts Per Finding", "3"), 10) || 3;

  const findingsTable = parseMarkdownTable(acceptanceContent, "Findings");
  const allFindings: FindingRecord[] = [];
  for (const row of findingsTable.rows) {
    const id = (row["ID"] || row["编号"] || "").trim();
    if (!id || id.toLowerCase() === "none") continue;
    allFindings.push({
      id,
      type: ((row["Finding Type"] || "code").toLowerCase() as FindingRecord["type"]) || "code",
      severity: ((row["Severity"] || "major").toLowerCase() as FindingRecord["severity"]) || "major",
      moduleId: row["Module ID"] || "MOD-001",
      requirementId: row["Requirement ID"] || "REQ-001",
      problem: row["Problem"] || "",
      evidence: row["Evidence"] || "",
      owner: row["Owner"] || "zen-implementer",
      status: ((row["Status"] || "open").toLowerCase() as FindingRecord["status"]) || "open",
      foundBy: row["Found By"] || "independent-qa",
      iteration: Number.parseInt(row["Iteration"] || "1", 10) || 1,
    });
  }

  const openBlockingOrMajor = allFindings.filter(
    (f) =>
      (f.severity === "blocking" || f.severity === "major") &&
      f.status !== "closed"
  );

  return {
    declaredState,
    totalIteration,
    maxTotalIterations,
    maxAttemptsPerFinding,
    implementerIds,
    reviewerId,
    qaId,
    targetCommitOrDigest,
    allowedPaths,
    openBlockingOrMajor,
    allFindings,
  };
}

/**
 * Gate 3: Validate `docs/acceptance.md` (Separation of Duties, Traceability, 7-Dim BR, 3-Axis Audit, Zero Open Defects)
 */
export function checkAcceptanceGate(
  acceptanceContent: string,
  prdContent?: string,
  planContent?: string
): GateCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const snapshot = parseAcceptanceSnapshot(acceptanceContent);

  // 1. Separation of Duties (三权分立铁律)
  if (snapshot.implementerIds.length === 0) {
    errors.push("acceptance.md: 缺少 Implementation contributors 声明");
  }
  if (!snapshot.qaId || snapshot.qaId === "pending" || snapshot.qaId === "none") {
    errors.push("acceptance.md: 缺少有效的 Independent QA 身份标识");
  }
  if (snapshot.implementerIds.includes(snapshot.qaId)) {
    errors.push(
      `acceptance.md: 违反三权分立铁律 — Independent QA ('${snapshot.qaId}') 不能同时是代码实现者 (${snapshot.implementerIds.join(", ")})`
    );
  }
  if (snapshot.reviewerId && snapshot.implementerIds.includes(snapshot.reviewerId)) {
    errors.push(
      `acceptance.md: 违反三权分立铁律 — Independent Reviewer ('${snapshot.reviewerId}') 不能同时是代码实现者`
    );
  }

  // 2. Loop Budget Check
  if (snapshot.totalIteration > snapshot.maxTotalIterations) {
    errors.push(
      `acceptance.md: 总修复轮次 (${snapshot.totalIteration}) 已超出上限 (${snapshot.maxTotalIterations})，需人工介入决策`
    );
  }
  for (const f of snapshot.openBlockingOrMajor) {
    if (f.iteration > snapshot.maxAttemptsPerFinding) {
      errors.push(
        `acceptance.md: 缺陷 '${f.id}' 修复尝试次数 (${f.iteration}) 已超出单问题上限 (${snapshot.maxAttemptsPerFinding})`
      );
    }
  }

  // 3. Open Blocking / Major Findings Check
  if (snapshot.openBlockingOrMajor.length > 0) {
    for (const f of snapshot.openBlockingOrMajor) {
      errors.push(
        `acceptance.md: 存在未闭环的 [${f.severity.toUpperCase()}] 缺陷 ${f.id} (${f.problem}) — 状态: ${f.status}`
      );
    }
  }

  // 4. Requirement Traceability Check
  const traceTable = parseMarkdownTable(acceptanceContent, "Traceability Matrix");
  if (traceTable.rows.length === 0) {
    errors.push("acceptance.md: 缺少 '## 需求全链路追溯矩阵 [Traceability Matrix]' 记录");
  }
  const passedReqs = new Set<string>();
  for (const row of traceTable.rows) {
    const reqId = (row["Requirement ID"] || "").trim();
    const qaResult = (row["QA Result"] || "").trim().toUpperCase();
    const evidence = (row["Test Evidence"] || "").trim();
    if (qaResult !== "PASS") {
      errors.push(`acceptance.md: 需求 '${reqId}' 的 QA Result 未通过 (当前为 '${qaResult}')`);
    } else if (!evidence || evidence.toLowerCase() === "pending") {
      errors.push(`acceptance.md: 需求 '${reqId}' 标记为 PASS 但缺少有效的 Test Evidence`);
    } else {
      passedReqs.add(reqId);
    }
  }

  if (prdContent) {
    const prdReqs = parseMarkdownTable(prdContent, "Requirements")
      .rows.map((r) => (r["ID"] || r["Requirement ID"] || "").trim())
      .filter((id) => /^REQ-\d{3}$/.test(id));
    for (const reqId of prdReqs) {
      if (!passedReqs.has(reqId)) {
        errors.push(`acceptance.md: PRD 中的需求 '${reqId}' 在验收追溯矩阵中未达到 PASS`);
      }
    }
  }

  // 5. Business Rule Verification Check & P0-2 Cross-Contract Alignment (plan.md <-> acceptance.md)
  const brTable = parseMarkdownTable(acceptanceContent, "Business Rule Verification");
  const accBrMap = new Map<string, { mandatory: string; status: string }>();
  for (const row of brTable.rows) {
    const ruleId = (row["Rule ID"] || "").trim();
    const mandatory = (row["Mandatory"] || "").trim().toLowerCase();
    const status = (row["QA Status"] || "").trim().toUpperCase();
    accBrMap.set(ruleId, { mandatory, status });
    if (mandatory === "yes" && status !== "PASS") {
      errors.push(`acceptance.md: 强制业务规则维度 '${ruleId}' 未通过验证 (当前状态: '${status}')`);
    }
  }

  if (planContent) {
    const planBrTable = parseMarkdownTable(planContent, "Business Rule Matrix");
    for (const row of planBrTable.rows) {
      const ruleId = (row["Rule ID"] || "").trim();
      const applicable = (row["Applicable"] || "").trim().toLowerCase();
      if (applicable === "yes") {
        const accEntry = accBrMap.get(ruleId);
        if (!accEntry || accEntry.mandatory !== "yes") {
          errors.push(
            `[P0-2 Cross-Contract Violation] 业务规则 '${ruleId}' 在 plan.md 中为适用(Yes)，严禁在 acceptance.md 中将 Mandatory 降级为 No 或遗漏`
          );
        }
      }
    }
  }

  // 6. Final QA Decision Check
  if (!/Decision\s*:\s*PASS\b/i.test(acceptanceContent)) {
    errors.push("acceptance.md: 最终 QA Decision 尚未签署为 PASS");
  }

  const score = Math.max(0, 100 - errors.length * 20);
  return {
    passed: errors.length === 0,
    phase: "full_test_qa",
    score,
    errors,
    warnings,
    metrics: {
      passedRequirements: passedReqs.size,
      openCriticalFindings: snapshot.openBlockingOrMajor.length,
      totalIteration: snapshot.totalIteration,
    },
  };
}

/**
 * P0-1 Hardware Verification: Execute the real `Verification Command` declared in `plan.md`
 * to guarantee tests actually pass on disk (Exit Code 0) rather than trusting markdown text alone.
 */
export function verifyPlanTestCommandsExecution(
  projectRoot: string,
  planContent: string
): GateCheckResult {
  const root = path.resolve(projectRoot);
  const sliceTable = parseMarkdownTable(planContent, "Vertical Slices");
  const errors: string[] = [];
  const warnings: string[] = [];
  let executedCount = 0;

  const envPath = `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH || "/usr/bin:/bin"}`;

  for (const row of sliceTable.rows) {
    const sliceId = (row["Slice ID"] || "SLC-001").trim();
    const rawCmd = (row["Verification Command"] || "").replace(/`/g, "").trim();
    if (!rawCmd) continue;

    // Only execute safe test commands
    if (/\brm\s+-rf\b/.test(rawCmd)) {
      errors.push(`[P0-1 Safety Block] 切片 ${sliceId} 包含危险验证命令: ${rawCmd}`);
      continue;
    }

    try {
      execSync(rawCmd, {
        cwd: root,
        encoding: "utf-8",
        timeout: 20000,
        stdio: "pipe",
        env: { ...process.env, PATH: envPath },
      });
      executedCount++;
    } catch (err: any) {
      const stderr = String(err.stderr || err.stdout || err.message || "").trim().slice(0, 300);
      errors.push(`[P0-1 Real Test Execution Failed] 切片 ${sliceId} 验证命令 '${rawCmd}' 执行失败: ${stderr}`);
    }
  }

  return {
    passed: errors.length === 0,
    phase: "real_test_execution",
    score: errors.length === 0 ? 100 : 0,
    errors,
    warnings,
    metrics: { executedCommands: executedCount },
  };
}

/**
 * Compute deterministic SHA-256 Tree Digest over `allowedPaths` and audit workspace cleanliness.
 */
export function computeWorkspaceTreeDigest(
  projectRoot: string,
  allowedPaths: string[]
): { digest: string; fileCount: number; clutterFiles: string[] } {
  const root = path.resolve(projectRoot);
  const hash = crypto.createHash("sha256");
  const files: string[] = [];
  const clutterFiles: string[] = [];

  function walk(dir: string) {
    if (!fs.existsSync(dir)) return;
    const stat = fs.lstatSync(dir);
    if (stat.isSymbolicLink()) return;
    if (stat.isFile()) {
      files.push(dir);
      return;
    }
    for (const entry of fs.readdirSync(dir)) {
      if (entry === ".git" || entry === "node_modules" || entry === ".pi-zen") continue;
      const full = path.join(dir, entry);
      if (entry === ".DS_Store" || entry.endsWith(".tmp") || entry.endsWith(".bak")) {
        clutterFiles.push(path.relative(root, full));
        continue;
      }
      walk(full);
    }
  }

  for (const rel of allowedPaths) {
    walk(path.resolve(root, rel));
  }

  files.sort();
  for (const file of files) {
    const rel = path.relative(root, file).replace(/\\/g, "/");
    const content = fs.readFileSync(file);
    hash.update(`${rel}:${content.length}:`);
    hash.update(content);
    hash.update("\n");
  }

  return {
    digest: `sha256:${hash.digest("hex")}`,
    fileCount: files.length,
    clutterFiles,
  };
}
