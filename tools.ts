/**
 * Pi-Zen Atomic Tools & Hardware-Level Scope Guard (BR-4 / BR-6 / BR-7).
 * Provides the minimal toolset: read_file, write_file, edit_file, run_bash, run_zen_gate.
 */

import * as fs from "node:fs/promises";
import * as fsSync from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";
import type { RoleName } from "./harness/types.ts";
import { writeFileAtomic } from "./harness/memory.ts";
import {
  checkAcceptanceGate,
  checkCodeZenGate,
  checkPlanGate,
  checkPrdGate,
} from "./harness/zen-checker.ts";
import {
  checkUiDesignGate,
  runDesignDivergence,
  validateContentHandoff,
} from "./harness/design-bridge.ts";

export interface ToolExecutionContext {
  projectRoot?: string;
  allowedPaths?: string[];
  role?: RoleName;
}

export const toolDefinitions = [
  {
    type: "function",
    function: {
      name: "read_file",
      description: "读取指定路径的文件内容（支持可选起止行号）",
      parameters: {
        type: "object",
        properties: {
          filePath: { type: "string", description: "文件的相对或绝对路径" },
          startLine: { type: "number", description: "起始行号（从1开始，可选）" },
          endLine: { type: "number", description: "结束行号（可选）" },
        },
        required: ["filePath"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "向指定路径原子写入文件内容（受当前角色 allowedPaths 路径白名单约束）",
      parameters: {
        type: "object",
        properties: {
          filePath: { type: "string", description: "文件路径" },
          content: { type: "string", description: "写入的完整文本内容" },
        },
        required: ["filePath", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "edit_file",
      description: "精确替换文件中的目标文本片段（遵循代码之禅最小修改原则，受 allowedPaths 约束）",
      parameters: {
        type: "object",
        properties: {
          filePath: { type: "string", description: "文件路径" },
          target: { type: "string", description: "待替换的原始精确文本片段" },
          replacement: { type: "string", description: "替换后的新文本片段" },
        },
        required: ["filePath", "target", "replacement"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_bash",
      description: "在本地终端执行安全 shell 命令并返回 stdout 与 stderr（内置超时保护）",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string", description: "待执行的 shell 命令字符串" },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_zen_gate",
      description: "运行确定性质量门禁检查（prd | plan | code | handoff | ui | acceptance）",
      parameters: {
        type: "object",
        properties: {
          gate: {
            type: "string",
            enum: ["prd", "plan", "code", "handoff", "ui", "acceptance"],
            description: "要执行的确定性门禁类型",
          },
          targetPath: {
            type: "string",
            description: "被检查的文件或项目目录路径（默认当前项目根目录）",
          },
        },
        required: ["gate"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_design_skill",
      description:
        "调用 Design Skill (v4.0) 视觉审美引擎（studio: 4流派x3引擎发散矩阵 | seed: 确定性审美种子 | sloplint: 反AI塑料感扫描 | validate_handoff: Content Handoff 2.1 校验）",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["studio", "seed", "sloplint", "validate_handoff"],
            description: "要执行的 Design Skill 动作",
          },
          targetPath: {
            type: "string",
            description: "目标文件或目录路径（sloplint / validate_handoff 使用）",
          },
          brief: {
            type: "string",
            description: "产品视觉命题或设计摘要（studio / seed 使用）",
          },
          school: {
            type: "string",
            description: "可选流派偏好：modernist | braun | glass | caustic",
          },
        },
        required: ["action"],
      },
    },
  },
];

/**
 * Verify whether `fullPath` is permitted under `context.allowedPaths` and Separation-of-Duties rules (BR-4).
 */
export function verifyPathPermission(
  fullPath: string,
  context?: ToolExecutionContext
): { allowed: boolean; reason?: string } {
  const root = path.resolve(context?.projectRoot || process.cwd());
  const resolvedTarget = path.resolve(fullPath);
  const rel = path.relative(root, resolvedTarget).replace(/\\/g, "/");

  // Block escaping projectRoot unless explicitly allowed
  if (rel.startsWith("..") && !context?.allowedPaths?.some((p) => resolvedTarget.startsWith(path.resolve(root, p)))) {
    return {
      allowed: false,
      reason: `[Scope Guard Block BR-4] 禁止越过项目根目录修改外部文件: ${rel}`,
    };
  }

  // Separation of Duties hard locks
  if (context?.role === "zen-implementer") {
    if (rel === "docs/prd.md" || rel === "docs/acceptance.md") {
      return {
        allowed: false,
        reason: `[Separation of Duties Block BR-4] 实现专家 (zen-implementer) 严禁修改权威需求或验收报告 (${rel})`,
      };
    }
  }
  if (context?.role === "independent-qa") {
    if (!rel.startsWith("docs/acceptance.md") && !rel.startsWith(".pi-zen/")) {
      return {
        allowed: false,
        reason: `[Separation of Duties Block BR-4] 独立 QA (independent-qa) 只能签署 docs/acceptance.md，严禁直接修改业务源码 (${rel})`,
      };
    }
  }

  if (context?.allowedPaths && context.allowedPaths.length > 0) {
    const matched = context.allowedPaths.some((allowedItem) => {
      const cleanAllowed = allowedItem.trim().replace(/\/+$/, "");
      if (!cleanAllowed || cleanAllowed === ".") return true;
      return rel === cleanAllowed || rel.startsWith(`${cleanAllowed}/`);
    });
    if (!matched) {
      return {
        allowed: false,
        reason: `[Scope Guard Block BR-4] 路径 '${rel}' 不在当前任务包允许路径白名单 [${context.allowedPaths.join(", ")}] 内`,
      };
    }
  }

  return { allowed: true };
}

/**
 * Execute a tool with deterministic error handling, path sandboxing, and timeout boundaries.
 */
export async function executeTool(
  name: string,
  args: Record<string, any>,
  context?: ToolExecutionContext
): Promise<string> {
  const baseDir = path.resolve(context?.projectRoot || process.cwd());

  try {
    switch (name) {
      case "read_file": {
        if (!args.filePath || typeof args.filePath !== "string") {
          return "[BR-2 Error] read_file 必须提供有效的 filePath 字符串";
        }
        const fullPath = path.resolve(baseDir, args.filePath);
        const data = await fs.readFile(fullPath, "utf-8");
        if (typeof args.startLine === "number" || typeof args.endLine === "number") {
          const lines = data.split(/\r?\n/);
          const start = Math.max(1, args.startLine || 1);
          const end = Math.min(lines.length, args.endLine || lines.length);
          return lines.slice(start - 1, end).join("\n");
        }
        return data;
      }

      case "write_file": {
        if (!args.filePath || typeof args.content !== "string") {
          return "[BR-2 Error] write_file 必须提供有效的 filePath 和 content";
        }
        const fullPath = path.resolve(baseDir, args.filePath);
        const perm = verifyPathPermission(fullPath, context);
        if (!perm.allowed) {
          return perm.reason!;
        }
        writeFileAtomic(fullPath, args.content);
        return `成功写入文件: ${args.filePath} (大小: ${Buffer.byteLength(args.content)} 字节)`;
      }

      case "edit_file": {
        if (
          !args.filePath ||
          typeof args.target !== "string" ||
          typeof args.replacement !== "string"
        ) {
          return "[BR-2 Error] edit_file 必须提供 filePath, target, replacement";
        }
        const fullPath = path.resolve(baseDir, args.filePath);
        const perm = verifyPathPermission(fullPath, context);
        if (!perm.allowed) {
          return perm.reason!;
        }
        const existing = await fs.readFile(fullPath, "utf-8");
        if (!existing.includes(args.target)) {
          return `错误：在 ${args.filePath} 中未找到完全匹配的 target 文本片段`;
        }
        const updated = existing.replace(args.target, args.replacement);
        writeFileAtomic(fullPath, updated);
        return `成功更新文件: ${args.filePath}`;
      }

      case "run_bash": {
        const cmd = String(args.command || "").trim();
        if (!cmd) {
          return "[BR-2 Error] run_bash 命令不能为空";
        }
        if (/\brm\s+-rf\s+\/(?:\s|$)|git\s+push\s+--force\b/.test(cmd)) {
          return "[Safety Block BR-4] 拦截高危破坏性终端命令";
        }
        const envPath = `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH || "/usr/bin:/bin"}`;
        const stdout = execSync(cmd, {
          cwd: baseDir,
          encoding: "utf-8",
          timeout: 30000,
          maxBuffer: 1024 * 1024,
          env: { ...process.env, PATH: envPath },
        });
        return stdout || "(命令执行成功，无输出)";
      }

      case "run_zen_gate": {
        const gate = String(args.gate || "");
        const target = path.resolve(baseDir, args.targetPath || ".");
        if (gate === "prd") {
          const prdFile = fsSync.statSync(target).isDirectory()
            ? path.join(target, "docs", "prd.md")
            : target;
          const content = await fs.readFile(prdFile, "utf-8");
          return JSON.stringify(checkPrdGate(content), null, 2);
        }
        if (gate === "plan") {
          const planFile = fsSync.statSync(target).isDirectory()
            ? path.join(target, "docs", "plan.md")
            : target;
          const prdFile = path.join(baseDir, "docs", "prd.md");
          const planContent = await fs.readFile(planFile, "utf-8");
          const prdContent = fsSync.existsSync(prdFile)
            ? await fs.readFile(prdFile, "utf-8")
            : undefined;
          return JSON.stringify(checkPlanGate(planContent, prdContent), null, 2);
        }
        if (gate === "code") {
          return JSON.stringify(checkCodeZenGate(target), null, 2);
        }
        if (gate === "handoff") {
          const handoffFile = fsSync.statSync(target).isDirectory()
            ? path.join(target, "docs", "content-handoff.json")
            : target;
          const raw = await fs.readFile(handoffFile, "utf-8");
          return JSON.stringify(validateContentHandoff(raw), null, 2);
        }
        if (gate === "ui") {
          return JSON.stringify(checkUiDesignGate(target), null, 2);
        }
        if (gate === "acceptance") {
          const accFile = fsSync.statSync(target).isDirectory()
            ? path.join(target, "docs", "acceptance.md")
            : target;
          const prdFile = path.join(baseDir, "docs", "prd.md");
          const planFile = path.join(baseDir, "docs", "plan.md");
          const accContent = await fs.readFile(accFile, "utf-8");
          const prdContent = fsSync.existsSync(prdFile)
            ? await fs.readFile(prdFile, "utf-8")
            : undefined;
          const planContent = fsSync.existsSync(planFile)
            ? await fs.readFile(planFile, "utf-8")
            : undefined;
          return JSON.stringify(checkAcceptanceGate(accContent, prdContent, planContent), null, 2);
        }
        return `未知门禁类型: ${gate}`;
      }

      case "run_design_skill": {
        const action = String(args.action || "sloplint");
        const target = path.resolve(baseDir, args.targetPath || ".");
        if (action === "studio" || action === "seed") {
          return runDesignDivergence(
            action,
            String(args.brief || "Pi-Zen Engineering Product Surface"),
            args.school ? String(args.school) : undefined
          );
        }
        if (action === "sloplint") {
          return JSON.stringify(checkUiDesignGate(target), null, 2);
        }
        if (action === "validate_handoff") {
          const handoffFile = fsSync.statSync(target).isDirectory()
            ? path.join(target, "docs", "content-handoff.json")
            : target;
          const raw = await fs.readFile(handoffFile, "utf-8");
          return JSON.stringify(validateContentHandoff(raw), null, 2);
        }
        return `未知 Design Skill 动作: ${action}`;
      }

      default:
        return `错误：未找到工具 '${name}'`;
    }
  } catch (err: any) {
    return `执行工具 '${name}' 失败: ${err.message || String(err)}`;
  }
}
