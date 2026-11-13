/**
 * Full Automated Test Suite for Pi-Zen Engineering Harness (v2.0).
 * Covers all 7 Business Rule dimensions (BR-1 .. BR-7), Occam's Razor Gates,
 * Code Zen Scanner, Design Skill Content Handoff 2.1 Fail-Closed Scope Gate,
 * Separation of Duties, and End-to-End 7-Phase SOP State Machine.
 */

import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import {
  checkAcceptanceGate,
  checkCodeZenGate,
  checkPlanGate,
  checkPrdGate,
  verifyPlanTestCommandsExecution,
} from "../harness/zen-checker.ts";
import { checkUiDesignGate, validateContentHandoff } from "../harness/design-bridge.ts";
import {
  initProjectMemory,
  loadSopCheckpoint,
  readBugLedger,
  readPatternCatalog,
  recordBugEntry,
  recordPatternEntry,
  saveSopCheckpoint,
  searchBugs,
} from "../harness/memory.ts";
import { executeTool, verifyPathPermission } from "../tools.ts";
import { loadRoleKernelPrompt, runIsolatedSubagent } from "../harness/subagent.ts";
import { runAllProjectGates, scaffoldProject } from "../harness/orchestrator.ts";
import piZenExtension from "../.pi/extensions/pi-zen.ts";

describe("Pi-Zen Engineering Harness — 7-Dimension BR & Gate Verification", () => {
  it("BR-1 & P0-1 (Fail-Closed Template): Scaffolds templates with PENDING acceptance and passes only after QA signs PASS", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-zen-br1-"));
    try {
      const files = scaffoldProject(tmpDir, { uiEnabled: true, overwrite: true });
      assert.ok(files.includes("docs/prd.md"));
      assert.ok(files.includes("docs/plan.md"));
      assert.ok(files.includes("docs/acceptance.md"));
      assert.ok(files.includes("docs/content-handoff.json"));

      const reports = runAllProjectGates(tmpDir, true);
      assert.equal(reports.prd.passed, true, `PRD errors: ${reports.prd.errors.join("; ")}`);
      assert.equal(reports.plan.passed, true, `Plan errors: ${reports.plan.errors.join("; ")}`);
      assert.equal(reports.handoff.passed, true, `Handoff errors: ${reports.handoff.errors.join("; ")}`);
      // P0-1: Initial acceptance.md must FAIL-CLOSED (Decision: PENDING) until QA actually signs PASS
      assert.equal(
        reports.acceptance.passed,
        false,
        "Unverified template acceptance.md must fail closed (PENDING)"
      );

      // Once QA signs PASS with evidence, acceptance gate passes
      const accPath = path.join(tmpDir, "docs", "acceptance.md");
      const signedAcc = fs
        .readFileSync(accPath, "utf-8")
        .replace(/PENDING/g, "PASS")
        .replace(/\| pending \|/g, "| tests/core.test.ts |");
      fs.writeFileSync(accPath, signedAcc, "utf-8");

      const signedReports = runAllProjectGates(tmpDir, true);
      assert.equal(
        signedReports.acceptance.passed,
        true,
        `Signed acceptance errors: ${signedReports.acceptance.errors.join("; ")}`
      );
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("BR-2 (Invalid Input) & Occam's Razor: Blocks PRDs with speculative fields or missing drop_test", () => {
    const badPrd = `# PRD
## 一句话产品承诺 [Product Promise]
Test

## 最小实体审计 [Minimal-Entity Audit]
| 引入实体 [Entity Introduced] | 模块编号 [Module ID] | 范围 [Scope] | 所属表面 [Owning Boundary] | 删除测试 [drop_test] | 合并测试 [merge_test] | 决策 [Decision] |
| --- | --- | --- | --- | --- | --- | --- |
| ExtraConfig | MOD-001 | [Global: Host-level] | View | reserved for future | tbd | maybe |
`;
    const res = checkPrdGate(badPrd, true);
    assert.equal(res.passed, false);
    assert.ok(res.errors.some((e) => e.includes("Single Primary Flow")));
    assert.ok(res.errors.some((e) => e.includes("预留理由")));
    assert.ok(res.errors.some((e) => e.includes("Taste Contract")));
  });

  it("BR-3 (Boundary & Code Zen): Blocks empty catch blocks and ext_json speculative fields in source code", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-zen-br3-"));
    try {
      const badCodePath = path.join(tmpDir, "bad_service.ts");
      fs.writeFileSync(
        badCodePath,
        `export interface BadSchema {
  id: string;
  ext_json: string;
}
export function riskyOp() {
  try {
    JSON.parse("{");
  } catch (e) {}
}
`,
        "utf-8"
      );

      const report = checkCodeZenGate(tmpDir);
      assert.equal(report.passed, false);
      assert.ok(report.errors.some((e) => e.includes("空的 catch {} 块")));
      assert.ok(report.errors.some((e) => e.includes("ext_json")));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("BR-4 (Permission & Separation of Duties): Enforces allowedPaths and blocks implementer/QA cross-boundary edits", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-zen-br4-"));
    try {
      scaffoldProject(tmpDir, { uiEnabled: false });

      // 1. Implementer trying to edit docs/acceptance.md must be blocked
      const implAttempt = verifyPathPermission(
        path.join(tmpDir, "docs", "acceptance.md"),
        { projectRoot: tmpDir, allowedPaths: ["src", "docs"], role: "zen-implementer" }
      );
      assert.equal(implAttempt.allowed, false);
      assert.ok(implAttempt.reason?.includes("Separation of Duties"));

      // 2. Independent QA trying to edit src/index.ts must be blocked
      const qaAttempt = verifyPathPermission(
        path.join(tmpDir, "src", "index.ts"),
        { projectRoot: tmpDir, allowedPaths: ["docs/acceptance.md"], role: "independent-qa" }
      );
      assert.equal(qaAttempt.allowed, false);
      assert.ok(qaAttempt.reason?.includes("Separation of Duties"));

      // 3. Acceptance gate blocks self-approval when QA identity == Implementer identity
      const selfApprovedAcc = fs
        .readFileSync(path.join(tmpDir, "docs", "acceptance.md"), "utf-8")
        .replace("[Independent QA]: independent-qa", "[Independent QA]: zen-implementer");
      const accGate = checkAcceptanceGate(selfApprovedAcc);
      assert.equal(accGate.passed, false);
      assert.ok(accGate.errors.some((e) => e.includes("三权分立")));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("BR-4 & Design Skill Protocol: Fail-Closed blocks [Plugin: Private-level] metric leaking onto host_dashboard", () => {
    const leakyHandoff = {
      $schema: "https://exp-skill.local/schemas/content-handoff-2.1.json",
      schema_version: "2.1" as const,
      handoff_stage: "solution" as const,
      project_id: "test_proj",
      module_ids: ["MOD-001"],
      slice_ids: ["SLC-001"],
      requirement_ids: ["REQ-001"],
      taste_contract: {
        visual_thesis: "Clear primary status hierarchy",
        content_tension: "Primary metric vs secondary logs",
        signature_move: "Concentric radius cards",
        anti_reference: "No 4-card wall or eyebrow stamp spam",
        restraint_rule: "Only authentic scope-verified metrics",
      },
      roles: [{ role_id: "ROL-001", role_name: "Admin" }],
      surfaces: [
        {
          surface_id: "main_host_dash",
          surface_category: "host_dashboard" as const,
          discovery_surface: "role_home" as const,
          allowed_scopes: ["[Global: Host-level]"] as any,
          entry_ids: [],
          cards: [
            {
              card_id: "leaked_card",
              label: "Plugin Recall",
              context_scope: "[Plugin: Private-level]" as const,
              metric_key: "plugin_recall",
              value_type: "percentage",
            },
          ],
        },
      ],
      entries: [],
    };

    const res = validateContentHandoff(leakyHandoff);
    assert.equal(res.passed, false);
    assert.ok(res.errors.some((e) => e.includes("[FAIL-CLOSED BLOCK]")));
  });

  it("BR-5 (Idempotency) & BR-6 (Atomic Symlink-Safe Memory): Deduplicates bug entries and blocks symlink writes", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-zen-br56-"));
    try {
      initProjectMemory(tmpDir);
      const first = recordBugEntry(tmpDir, {
        tags: "BR-2,validation",
        symptom: "Negative latency accepted",
        rootCause: "Missing < 0 guard",
        fixRecipe: "Add negative number check",
      });
      const second = recordBugEntry(tmpDir, {
        tags: "BR-2,validation",
        symptom: "Negative latency accepted",
        rootCause: "Missing < 0 guard",
        fixRecipe: "Add negative number check",
      });

      assert.equal(first.id, "BUG-001");
      assert.equal(second.id, "BUG-001", "Idempotent call must return existing BUG-001 without duplicating");
      assert.equal(readBugLedger(tmpDir).length, 1);
      assert.equal(searchBugs(tmpDir, "Negative").length, 1);

      // Symlink escape test (BR-4 / BR-6)
      const ledgerPath = path.join(tmpDir, ".pi-zen", "memory", "bug-ledger.md");
      const outsideTarget = path.join(os.tmpdir(), `outside-${Date.now()}.txt`);
      fs.rmSync(ledgerPath);
      fs.symlinkSync(outsideTarget, ledgerPath);

      assert.throws(() => {
        recordBugEntry(tmpDir, {
          tags: "sec",
          symptom: "Symlink test",
          rootCause: "Symlink",
          fixRecipe: "Reject symlink",
        });
      }, /拒绝向符号链接写入/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("BR-7 & Design UI Gate: Detects AI-Slop eyebrow stamp spam in HTML surfaces", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-zen-br7-"));
    try {
      const sloppyHtml = path.join(tmpDir, "sloppy.html");
      fs.writeFileSync(
        sloppyHtml,
        `<div><span>01 // METRIC ONE</span><span>02 // METRIC TWO</span><p>lorem ipsum</p></div>`,
        "utf-8"
      );
      const uiGate = checkUiDesignGate(tmpDir);
      assert.equal(uiGate.passed, false);
      assert.ok(uiGate.errors.some((e) => e.includes("AI-Slop 拦截")));
      assert.ok(uiGate.errors.some((e) => e.includes("Anti-Visual-Fill 拦截")));

      // Also verify edit_file tool works deterministically
      const editRes = await executeTool(
        "edit_file",
        {
          filePath: "sloppy.html",
          target: "01 // METRIC ONE",
          replacement: "Authentic Metric",
        },
        { projectRoot: tmpDir, allowedPaths: ["sloppy.html"] }
      );
      assert.ok(editRes.includes("成功更新文件"));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("P0-2 (Cross-Contract BR Alignment) & P0-1 (Hardware Test Command Execution): Blocks BR downgrade and failed test commands", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-zen-p02-"));
    try {
      scaffoldProject(tmpDir, { uiEnabled: false, overwrite: true });
      const prdContent = fs.readFileSync(path.join(tmpDir, "docs", "prd.md"), "utf-8");
      const planContent = fs.readFileSync(path.join(tmpDir, "docs", "plan.md"), "utf-8");
      // Downgrade BR-4 from Mandatory: Yes to No in acceptance.md while plan.md has Applicable: Yes
      const downgradedAcc = fs
        .readFileSync(path.join(tmpDir, "docs", "acceptance.md"), "utf-8")
        .replace(/PENDING/g, "PASS")
        .replace(/\| pending \|/g, "| tests/core.test.ts |")
        .replace("| BR-4 | MOD-001 | Permission Boundary | Yes |", "| BR-4 | MOD-001 | Permission Boundary | No |");

      const gate = checkAcceptanceGate(downgradedAcc, prdContent, planContent);
      assert.equal(gate.passed, false);
      assert.ok(gate.errors.some((e) => e.includes("[P0-2 Cross-Contract Violation]")));

      // Verify P0-1 hardware test execution catches missing/failing test files
      const realTestRes = verifyPlanTestCommandsExecution(tmpDir, planContent);
      assert.equal(realTestRes.passed, false);
      assert.ok(realTestRes.errors.some((e) => e.includes("[P0-1 Real Test Execution Failed]")));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("P0-3 (Bash Scope Escape Rollback): Automatically rolls back unauthorized file writes made via run_bash", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-zen-p03-"));
    try {
      scaffoldProject(tmpDir, { uiEnabled: false, overwrite: true });
      const accPath = path.join(tmpDir, "docs", "acceptance.md");
      const originalAcc = fs.readFileSync(accPath, "utf-8");

      let step = 0;
      await runIsolatedSubagent({
        packet: {
          goal: "Attempt unauthorized bash write to docs/acceptance.md",
          phase: "execute_slices",
          role: "zen-implementer",
          requirementIds: ["REQ-001"],
          sliceId: "SLC-001",
          allowedPaths: ["src"],
          deliverables: ["src/index.ts"],
          exitCriteria: [],
          nonGoals: [],
        },
        projectRoot: tmpDir,
        userPrompt: "Try to tamper with docs/acceptance.md via bash",
        silent: true,
        callLLM: async () => {
          step++;
          if (step === 1) {
            return {
              role: "assistant",
              content: "",
              tool_calls: [
                {
                  id: "bash_tamper_1",
                  type: "function",
                  function: {
                    name: "run_bash",
                    arguments: JSON.stringify({
                      command: "echo 'TAMPERED BY BASH' > docs/acceptance.md",
                    }),
                  },
                },
              ],
            };
          }
          return { role: "assistant", content: "Done" };
        },
      });

      const afterAcc = fs.readFileSync(accPath, "utf-8");
      assert.equal(
        afterAcc,
        originalAcc,
        "Unauthorized bash modification to docs/acceptance.md must be automatically rolled back"
      );
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("P1-1, P1-2, P2-1 & Pi Extension Adapter: Verifies run_design_skill, CEO+Product Kernel, Pattern Catalog, Checkpoint & .pi/extensions/pi-zen.ts", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-zen-p12-"));
    try {
      // P1-1: run_design_skill tool
      const studioOut = await executeTool(
        "run_design_skill",
        { action: "studio", brief: "Industrial Telemetry Console", school: "braun" },
        { projectRoot: tmpDir }
      );
      assert.ok(studioOut.length > 20);

      // P1-2: product-kernel loads both ceo-soul.md and product-soul.md
      const productPrompt = loadRoleKernelPrompt("product-kernel");
      assert.ok(productPrompt.includes("CEO Capability Kernel"));
      assert.ok(productPrompt.includes("Product & Design Capability Kernel"));

      // P2-1: Pattern Catalog & SOP Checkpoint State
      const pat = recordPatternEntry(tmpDir, {
        name: "Flat-2Layer-Core",
        tags: "flat-arch,tdd",
        context: "Core service",
        solution: "Entrypoint -> Core",
        seamExample: "src/index.ts",
      });
      assert.equal(pat.id, "PAT-001");
      assert.equal(readPatternCatalog(tmpDir).length, 1);

      saveSopCheckpoint(tmpDir, {
        userRequirement: "Build demo",
        uiEnabled: false,
        currentPhase: "design_plan",
        completedPhases: ["evaluate_and_prd", "user_confirm_prd"],
        qaIteration: 0,
        updatedAt: new Date().toISOString(),
        status: "in_progress",
      });
      const loaded = loadSopCheckpoint(tmpDir);
      assert.equal(loaded?.currentPhase, "design_plan");

      // Official Pi Extension Adapter (.pi/extensions/pi-zen.ts)
      const registeredTools: string[] = [];
      const registeredCommands: string[] = [];
      piZenExtension({
        registerTool: (t) => registeredTools.push(t.name),
        registerCommand: (name) => registeredCommands.push(name),
        on: () => {},
      });
      assert.ok(registeredTools.includes("run_zen_gate"));
      assert.ok(registeredTools.includes("run_design_skill"));
      assert.ok(registeredCommands.includes("zen-init"));
      assert.ok(registeredCommands.includes("zen-check"));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
