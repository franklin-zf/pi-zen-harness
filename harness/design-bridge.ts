/**
 * Design Skill (v4.0) Bridge & Fail-Closed Content Handoff Validator.
 * Connects Pi-Zen Harness to `/Users/zhangfeng/.gemini/config/skills/design`
 * and enforces Schema 2.1 Scope & Ownership + Anti-AI-Slop gates.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import type { ContentHandoffContract, ContextScope, GateCheckResult } from "./types.ts";
import { parseMarkdownTable } from "./zen-checker.ts";

export const DESIGN_SKILL_ROOT = "/Users/zhangfeng/.gemini/config/skills/design";
export const DESIGN_CLI_PATH = path.join(DESIGN_SKILL_ROOT, "scripts", "design.mjs");
export const NODE_BIN = fs.existsSync("/opt/homebrew/bin/node")
  ? "/opt/homebrew/bin/node"
  : process.execPath;

const VALID_SCOPES = new Set<ContextScope>([
  "[Global: Host-level]",
  "[Asset: Data-level]",
  "[Plugin: Private-level]",
]);

/**
 * Validate `docs/content-handoff.json` (Schema 2.1) with Fail-Closed Scope Enforcement.
 */
export function validateContentHandoff(
  rawJson: string | ContentHandoffContract,
  prdContent?: string
): GateCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  let payload: ContentHandoffContract;
  if (typeof rawJson === "string") {
    try {
      payload = JSON.parse(rawJson) as ContentHandoffContract;
    } catch (err: any) {
      return {
        passed: false,
        phase: "content_handoff_2.1",
        score: 0,
        errors: [`content-handoff.json JSON 语法解析失败: ${err.message}`],
        warnings: [],
      };
    }
  } else {
    payload = rawJson;
  }

  if (payload.schema_version !== "2.1") {
    errors.push(
      `content-handoff.json: schema_version 必须为 '2.1'，当前为 '${(payload as any).schema_version}'`
    );
  }

  // 1. Validate Taste Contract
  const taste = payload.taste_contract;
  if (!taste || typeof taste !== "object") {
    errors.push("content-handoff.json: 缺少 'taste_contract' 对象");
  } else {
    const requiredKeys: Array<keyof typeof taste> = [
      "visual_thesis",
      "content_tension",
      "signature_move",
      "anti_reference",
      "restraint_rule",
    ];
    for (const k of requiredKeys) {
      if (typeof taste[k] !== "string" || taste[k].trim().length < 5) {
        errors.push(`content-handoff.json: taste_contract.${k} 不能为空或过短`);
      }
    }
  }

  // 2. Validate Surfaces & Fail-Closed Scope Rules
  if (!Array.isArray(payload.surfaces) || payload.surfaces.length === 0) {
    errors.push("content-handoff.json: 'surfaces' 数组不能为空");
  } else {
    const entryMap = new Map(
      (payload.entries || []).map((e) => [e.entry_id, e])
    );

    for (const surface of payload.surfaces) {
      const sid = surface.surface_id || "unknown_surface";
      const isHostSurface = surface.surface_category === "host_dashboard";

      // Hard Rule: Host Dashboard cannot allow [Plugin: Private-level]
      if (
        isHostSurface &&
        (surface.allowed_scopes || []).includes("[Plugin: Private-level]")
      ) {
        errors.push(
          `[FAIL-CLOSED BLOCK] Surface '${sid}' (category: host_dashboard) 的 allowed_scopes 严禁包含 '[Plugin: Private-level]'`
        );
      }

      for (const card of surface.cards || []) {
        if (!VALID_SCOPES.has(card.context_scope)) {
          errors.push(
            `Surface '${sid}' 卡片 '${card.card_id}' 包含非法 context_scope '${card.context_scope}'`
          );
          continue;
        }

        // Fail-Closed Trigger: Plugin-Private metric on Host Dashboard
        if (isHostSurface && card.context_scope === "[Plugin: Private-level]") {
          errors.push(
            `[FAIL-CLOSED BLOCK] Scope & Ownership Violation: Surface '${sid}' (category: host_dashboard) 包含卡片 '${card.card_id}' (metric: '${card.metric_key}')，其作用域为 '[Plugin: Private-level]'。宿主全局面板严禁消费单插件私有指标！`
          );
        }

        if (!(surface.allowed_scopes || []).includes(card.context_scope)) {
          errors.push(
            `Surface '${sid}' 卡片 '${card.card_id}' 的作用域 '${card.context_scope}' 不在该表面的 allowed_scopes 中`
          );
        }
      }

      for (const entryId of surface.entry_ids || []) {
        const entry = entryMap.get(entryId);
        if (!entry) {
          errors.push(`Surface '${sid}' 引用了不存在的 entry_id '${entryId}'`);
        } else if (entry.surface_id !== sid) {
          errors.push(
            `Discoverability 冲突: entry '${entryId}' 的 surface_id ('${entry.surface_id}') 与所属表面 '${sid}' 不一致`
          );
        }
      }
    }
  }

  // 3. Cross-check with PRD Requirements if provided
  if (prdContent) {
    const prdReqs = parseMarkdownTable(prdContent, "Requirements")
      .rows.map((r) => (r["ID"] || r["Requirement ID"] || "").trim())
      .filter((id) => /^REQ-\d{3}$/.test(id));
    const handoffReqs = new Set(payload.requirement_ids || []);
    for (const reqId of prdReqs) {
      if (!handoffReqs.has(reqId)) {
        warnings.push(`content-handoff.json 未绑定 PRD 需求 '${reqId}'`);
      }
    }
  }

  const score = Math.max(0, 100 - errors.length * 25 - warnings.length * 5);
  return {
    passed: errors.length === 0,
    phase: "content_handoff_2.1",
    score,
    errors,
    warnings,
    metrics: {
      surfacesCount: Array.isArray(payload.surfaces) ? payload.surfaces.length : 0,
      entriesCount: Array.isArray(payload.entries) ? payload.entries.length : 0,
    },
  };
}

/**
 * UI Sloplint & Web Interface Standards Gate (`web-interface-standards.md` + `design.mjs sloplint`).
 */
export function checkUiDesignGate(targetPath: string): GateCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const resolved = path.resolve(targetPath);

  if (!fs.existsSync(resolved)) {
    return {
      passed: false,
      phase: "ui_sloplint_gate",
      score: 0,
      errors: [`UI 检查路径不存在: ${resolved}`],
      warnings: [],
    };
  }

  // 1. Scan HTML/CSS/TSX files for Web Interface Standard violations & AI Slop patterns
  const uiFiles: string[] = [];
  function walkUi(curr: string) {
    const st = fs.lstatSync(curr);
    if (st.isSymbolicLink()) return;
    if (st.isFile()) {
      if ([".html", ".css", ".tsx", ".jsx", ".vue"].includes(path.extname(curr))) {
        uiFiles.push(curr);
      }
      return;
    }
    if (st.isDirectory()) {
      for (const item of fs.readdirSync(curr)) {
        if (item === "node_modules" || item === ".git" || item === "dist") continue;
        walkUi(path.join(curr, item));
      }
    }
  }
  walkUi(resolved);

  for (const file of uiFiles) {
    const rel = path.relative(resolved, file) || path.basename(file);
    const content = fs.readFileSync(file, "utf-8");

    // Check 1: Eyebrow stamp spam (`01 // `, `02 // `)
    const eyebrowMatches = content.match(/\b0[1-9]\s*\/\/\s*[A-Z]{3,}/g) || [];
    if (eyebrowMatches.length >= 2) {
      errors.push(
        `${rel}: [AI-Slop 拦截] 检测到重复的编号印章角标 (${eyebrowMatches.slice(0, 2).join(", ")})，违反 Design v4.0 Single-Truth Context 原则`
      );
    }

    // Check 2: Visual Fill placeholder metrics
    if (/lorem\s+ipsum|placeholder\s+metric|fake_metric/i.test(content)) {
      errors.push(`${rel}: [Anti-Visual-Fill 拦截] 检测到占位符假文本或凑数指标`);
    }

    // Check 3: Universal oversized rounding (> 24px on non-pill elements)
    const radii = [...content.matchAll(/border-radius\s*:\s*(\d+)px/g)].map((m) =>
      Number.parseInt(m[1], 10)
    );
    const excessiveRadii = radii.filter((r) => r > 24 && r < 999);
    if (excessiveRadii.length > 0) {
      warnings.push(
        `${rel}: 检测到过大的圆角值 (${excessiveRadii.join("px, ")}px)，请确认遵循角色圆角尺度与同心圆角公式 R_inner = R_outer - Padding`
      );
    }
  }

  // 2. Invoke local Design Skill CLI `design.mjs sloplint` if available and target has HTML
  let externalSloplintStatus = "skipped (no HTML or CLI)";
  if (uiFiles.some((f) => f.endsWith(".html")) && fs.existsSync(DESIGN_CLI_PATH)) {
    try {
      execFileSync(NODE_BIN, [DESIGN_CLI_PATH, "sloplint", resolved], {
        encoding: "utf-8",
        timeout: 15000,
        stdio: "pipe",
      });
      externalSloplintStatus = "PASS";
    } catch (err: any) {
      const stdout = String(err.stdout || err.stderr || err.message || "").trim();
      // If sloplint exits non-zero with blocking tier-1 findings, record warning/error
      if (/BLOCK|FAIL|Tier 1/i.test(stdout)) {
        errors.push(`design.mjs sloplint 报告审美违规: ${stdout.slice(0, 240)}`);
        externalSloplintStatus = "FAIL";
      } else {
        externalSloplintStatus = "WARN";
      }
    }
  }

  const score = Math.max(0, 100 - errors.length * 25 - warnings.length * 5);
  return {
    passed: errors.length === 0,
    phase: "ui_sloplint_gate",
    score,
    errors,
    warnings,
    metrics: {
      scannedUiFiles: uiFiles.length,
      designCliSloplint: externalSloplintStatus,
    },
  };
}

/**
 * Invoke Design Skill v4.0 `studio` or `seed` engine for visual divergence.
 */
export function runDesignDivergence(options: {
  mode: "studio" | "seed";
  outDir: string;
  brief: string;
  school?: "all" | "apple-hig" | "braun-leica" | "modernist-vector" | "dark-caustic";
}): { ok: boolean; output: string } {
  if (!fs.existsSync(DESIGN_CLI_PATH)) {
    return {
      ok: false,
      output: `Design Skill CLI 未安装于 ${DESIGN_CLI_PATH}`,
    };
  }
  const args = [DESIGN_CLI_PATH, options.mode, path.resolve(options.outDir), `--brief=${options.brief}`];
  if (options.mode === "studio" && options.school) {
    args.push(`--school=${options.school}`);
  }
  try {
    const out = execFileSync(NODE_BIN, args, {
      encoding: "utf-8",
      timeout: 30000,
    });
    return { ok: true, output: out.trim() };
  } catch (err: any) {
    return { ok: false, output: String(err.message || err) };
  }
}
