/**
 * Official Open-Source Pi Coding Agent (`@mariozechner/pi-coding-agent`) Extension Adapter.
 *
 * Mounts the Pi-Zen Engineering Harness (7-Phase SOP, Occam/Code-Zen Gates,
 * Design v4.0 Bridge, and Hardware Path/Role Guards) directly into the `pi` CLI.
 *
 * Usage with official `@mariozechner/pi-coding-agent`:
 *   1. Auto-discovered from `.pi/extensions/pi-zen.ts` when running `pi` in this repo
 *   2. Or loaded explicitly for any project: `pi -e /path/to/mini-pi-agent/.pi/extensions/pi-zen.ts`
 */

import * as path from "node:path";
import { executeTool, verifyPathPermission } from "../../tools.ts";
import {
  runAllProjectGates,
  scaffoldProject,
} from "../../harness/orchestrator.ts";
import { readBugLedger, readPatternCatalog } from "../../harness/memory.ts";
import type { RoleName } from "../../harness/types.ts";

export interface PiExtensionAPI {
  registerTool?: (toolDef: any) => void;
  registerCommand?: (
    name: string,
    config: { description: string; handler: (args: string, ctx?: any) => Promise<any> | any }
  ) => void;
  on?: (event: string, handler: (event: any, ctx?: any) => Promise<any> | any) => void;
}

/**
 * Default export conforming to `@mariozechner/pi-coding-agent` ExtensionFactory.
 */
export default function piZenExtension(pi: PiExtensionAPI): void {
  let activeRole: RoleName = "lead-orchestrator";
  let activeAllowedPaths: string[] = [];

  // 1. Hook into Pi's `tool_call` lifecycle to enforce Separation of Duties & Allowed Paths (BR-4)
  pi.on?.("tool_call", async (event: any, ctx?: any) => {
    const toolName = String(event?.toolName || "");
    const input = event?.input || {};
    const cwd = ctx?.cwd || process.cwd();

    if (toolName === "write" || toolName === "edit" || toolName === "write_file" || toolName === "edit_file") {
      const targetPath = input.path || input.filePath;
      if (targetPath && activeAllowedPaths.length > 0) {
        const perm = verifyPathPermission(path.resolve(cwd, String(targetPath)), {
          projectRoot: cwd,
          allowedPaths: activeAllowedPaths,
          role: activeRole,
        });
        if (!perm.allowed) {
          return { block: true, reason: perm.reason };
        }
      }
    }
    return undefined;
  });

  // 2. Register `run_zen_gate` inside Pi Coding Agent
  pi.registerTool?.({
    name: "run_zen_gate",
    label: "Pi-Zen Gate",
    description:
      "Execute Pi-Zen deterministic quality gate (prd | plan | code | handoff | ui | acceptance)",
    parameters: {
      type: "object",
      properties: {
        gate: {
          type: "string",
          enum: ["prd", "plan", "code", "handoff", "ui", "acceptance"],
        },
        targetPath: { type: "string" },
      },
      required: ["gate"],
    },
    async execute(_toolCallId: string, params: Record<string, any>, _signal?: AbortSignal, _onUpdate?: any, ctx?: any) {
      const cwd = ctx?.cwd || process.cwd();
      const text = await executeTool("run_zen_gate", params, { projectRoot: cwd });
      return { content: [{ type: "text", text }], details: {} };
    },
  });

  // 3. Register `run_design_skill` inside Pi Coding Agent
  pi.registerTool?.({
    name: "run_design_skill",
    label: "Pi-Zen Design Skill v4.0",
    description:
      "Invoke Design Skill v4.0 engine (studio | seed | sloplint | validate_handoff)",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["studio", "seed", "sloplint", "validate_handoff"],
        },
        targetPath: { type: "string" },
        brief: { type: "string" },
        school: { type: "string" },
      },
      required: ["action"],
    },
    async execute(_toolCallId: string, params: Record<string, any>, _signal?: AbortSignal, _onUpdate?: any, ctx?: any) {
      const cwd = ctx?.cwd || process.cwd();
      const text = await executeTool("run_design_skill", params, { projectRoot: cwd });
      return { content: [{ type: "text", text }], details: {} };
    },
  });

  // 4. Register `/zen-init`, `/zen-check`, `/zen-role`, and `/zen-memory` slash commands in Pi TUI
  pi.registerCommand?.("zen-init", {
    description: "Initialize Pi-Zen 3+1 authoritative contracts and project memory (use --ui for UI handoff)",
    handler: async (args: string, ctx?: any) => {
      const cwd = ctx?.cwd || process.cwd();
      const uiEnabled = args.includes("--ui");
      const created = scaffoldProject(cwd, { uiEnabled });
      const msg = `Pi-Zen contracts initialized: ${created.join(", ")}`;
      ctx?.ui?.notify?.(msg, "info");
      return msg;
    },
  });

  pi.registerCommand?.("zen-check", {
    description: "Run all Pi-Zen deterministic quality gates (PRD, Plan, Code Zen, UI, Acceptance)",
    handler: async (args: string, ctx?: any) => {
      const cwd = ctx?.cwd || process.cwd();
      const uiEnabled = args.includes("--ui");
      const reports = runAllProjectGates(cwd, uiEnabled);
      const summary = Object.entries(reports)
        .map(([k, r]) => `${r.passed ? "PASS" : "FAIL"} [${k}]: ${r.score}/100`)
        .join(" | ");
      ctx?.ui?.notify?.(summary, "info");
      return reports;
    },
  });

  pi.registerCommand?.("zen-role", {
    description: "Switch active Pi-Zen role & allowedPaths guard (e.g., /zen-role zen-implementer src,tests)",
    handler: async (args: string, ctx?: any) => {
      const parts = args.trim().split(/\s+/);
      if (parts[0]) {
        activeRole = parts[0] as RoleName;
      }
      activeAllowedPaths = parts[1]
        ? parts[1].split(",").map((s) => s.trim()).filter(Boolean)
        : [];
      const msg = `Active Pi-Zen Role: ${activeRole} | AllowedPaths: [${activeAllowedPaths.join(", ") || "*"}]`;
      ctx?.ui?.notify?.(msg, "info");
      return msg;
    },
  });

  pi.registerCommand?.("zen-memory", {
    description: "Inspect Pi-Zen Bug Ledger & Pattern Catalog",
    handler: async (_args: string, ctx?: any) => {
      const cwd = ctx?.cwd || process.cwd();
      const bugs = readBugLedger(cwd);
      const patterns = readPatternCatalog(cwd);
      const msg = `Bug Ledger: ${bugs.length} entries | Pattern Catalog: ${patterns.length} entries`;
      ctx?.ui?.notify?.(msg, "info");
      return { bugs, patterns };
    },
  });
}
