/**
 * Isolated Subagent Spawner & Context-Minimized ReAct Loop.
 * Enforces physical context separation between CEO/Product, Architect, Implementer, and QA.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { executeTool, verifyPathPermission } from "../tools.ts";
import { writeFileAtomic } from "./memory.ts";
import type { RoleName, TaskPacket } from "./types.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KERNELS_DIR = path.resolve(__dirname, "..", "kernels");

const ROLE_KERNEL_FILES: Record<RoleName, string[]> = {
  "lead-orchestrator": ["ceo-soul.md"],
  "ceo-kernel": ["ceo-soul.md"],
  "product-kernel": ["ceo-soul.md", "product-soul.md"],
  "architect-kernel": ["architect-soul.md"],
  "ui-specialist": ["ui-designer-soul.md", "zen-coder.md"],
  "zen-implementer": ["zen-coder.md"],
  "independent-qa": ["qa-auditor.md"],
};

const SNAPSHOT_IGNORED_DIRS = new Set([".git", "node_modules", ".pi-zen", "dist", "build"]);

/**
 * Capture an in-memory snapshot of workspace files for P0-3 Post-Command Scope Rollback Guard.
 */
export function captureWorkspaceSnapshot(projectRoot: string): Map<string, Buffer> {
  const root = path.resolve(projectRoot);
  const snapshot = new Map<string, Buffer>();

  function walk(dir: string) {
    if (!fs.existsSync(dir)) return;
    const st = fs.lstatSync(dir, { throwIfNoEntry: false });
    if (!st || st.isSymbolicLink()) return;
    if (st.isFile()) {
      const rel = path.relative(root, dir).replace(/\\/g, "/");
      snapshot.set(rel, fs.readFileSync(dir));
      return;
    }
    if (st.isDirectory()) {
      for (const entry of fs.readdirSync(dir)) {
        if (SNAPSHOT_IGNORED_DIRS.has(entry)) continue;
        walk(path.join(dir, entry));
      }
    }
  }

  walk(root);
  return snapshot;
}

/**
 * Compare current workspace against `preSnapshot` and automatically rollback any file
 * created, modified, or deleted outside `allowedPaths` / role permissions (P0-3).
 */
export function enforceWorkspaceScopeAfterTool(
  projectRoot: string,
  preSnapshot: Map<string, Buffer>,
  allowedPaths: string[],
  role: RoleName
): string[] {
  const root = path.resolve(projectRoot);
  const postSnapshot = captureWorkspaceSnapshot(root);
  const rolledBack: string[] = [];

  // 1. Check created or modified files
  for (const [rel, postBuf] of postSnapshot.entries()) {
    const preBuf = preSnapshot.get(rel);
    const isChanged = !preBuf || !preBuf.equals(postBuf);
    if (!isChanged) continue;

    const perm = verifyPathPermission(path.join(root, rel), {
      projectRoot: root,
      allowedPaths,
      role,
    });
    if (!perm.allowed) {
      rolledBack.push(rel);
      const targetFull = path.join(root, rel);
      if (!preBuf) {
        fs.rmSync(targetFull, { force: true });
      } else {
        writeFileAtomic(targetFull, preBuf.toString("utf-8"));
      }
    }
  }

  // 2. Check deleted files
  for (const [rel, preBuf] of preSnapshot.entries()) {
    if (!postSnapshot.has(rel)) {
      const perm = verifyPathPermission(path.join(root, rel), {
        projectRoot: root,
        allowedPaths,
        role,
      });
      if (!perm.allowed) {
        rolledBack.push(rel);
        writeFileAtomic(path.join(root, rel), preBuf.toString("utf-8"));
      }
    }
  }

  return rolledBack;
}

export type LLMCaller = (messages: any[], role: RoleName) => Promise<any>;

/**
 * Load only the specific capability kernel(s) needed for `role` (Progressive Disclosure).
 */
export function loadRoleKernelPrompt(role: RoleName): string {
  const files = ROLE_KERNEL_FILES[role] || ["zen-coder.md"];
  const sections: string[] = [];
  for (const f of files) {
    const full = path.join(KERNELS_DIR, f);
    if (fs.existsSync(full)) {
      sections.push(fs.readFileSync(full, "utf-8").trim());
    }
  }
  return sections.join("\n\n---\n\n");
}

/**
 * Build the sub-1k-token Pi base system prompt + selected role kernel + bounded Task Packet.
 */
export function buildSubagentSystemPrompt(packet: TaskPacket): string {
  const kernelText = loadRoleKernelPrompt(packet.role);
  return `你是 Pi-Zen 工程研发系统的独立子专家 [${packet.role}]。
你运行在物理隔离的独立上下文中，严格遵循【奥卡姆剃刀原则（如无必要，勿增实体）】、【第一性原理】与【代码之禅】。

=== 当前有界任务包 (Bounded Task Packet) ===
- 阶段 (Phase): ${packet.phase}
- 目标 (Goal): ${packet.goal}
- 关联需求 (Requirements): ${packet.requirementIds.join(", ") || "待定义"}
- 切片编号 (Slice ID): ${packet.sliceId || "N/A"}
- 允许修改路径白名单 (Allowed Paths): ${packet.allowedPaths.join(", ")}
- 权威交付物 (Deliverables): ${packet.deliverables.join(", ")}
- 退出门禁 (Exit Criteria): ${packet.exitCriteria.join(" | ")}
- 明确非目标 (Non-Goals): ${packet.nonGoals.join(" | ") || "禁止一切过度工程与无关修改"}
${packet.bugRecallContext ? `\n=== 历史错题本前置警示 (Bug Ledger Recall) ===\n${packet.bugRecallContext}\n` : ""}
=== 角色能力内核契约 (Capability Kernel) ===
${kernelText}`;
}

/**
 * Execute an isolated subagent session with hardware-enforced `allowedPaths` and step limit.
 */
export async function runIsolatedSubagent(options: {
  packet: TaskPacket;
  projectRoot: string;
  userPrompt: string;
  callLLM: LLMCaller;
  maxSteps?: number;
  silent?: boolean;
}): Promise<{
  role: RoleName;
  finalContent: string;
  stepsUsed: number;
  changedFiles: string[];
}> {
  const { packet, projectRoot, userPrompt, callLLM, maxSteps = 12, silent = false } = options;
  const systemPrompt = buildSubagentSystemPrompt(packet);

  // Fresh isolated message array — parent chat history is never leaked here
  const messages: any[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  const changedFiles = new Set<string>();
  let step = 0;

  while (step < maxSteps) {
    step++;
    if (!silent) {
      console.log(`  ⏳ [${packet.role} | Step ${step}/${maxSteps}] 独立上下文思考中...`);
    }

    const assistantMsg = await callLLM(messages, packet.role);
    messages.push(assistantMsg);

    if (assistantMsg.content && !silent) {
      console.log(`  🤖 [${packet.role}]: ${assistantMsg.content.slice(0, 240)}`);
    }

    const toolCalls = assistantMsg.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      return {
        role: packet.role,
        finalContent: assistantMsg.content || "",
        stepsUsed: step,
        changedFiles: [...changedFiles],
      };
    }

    for (const call of toolCalls) {
      const toolName = call.function.name;
      let args: Record<string, any> = {};
      try {
        args = JSON.parse(call.function.arguments || "{}");
      } catch {
        args = {};
      }

      if (!silent) {
        console.log(`  🛠️  [${packet.role} 调用工具]: ${toolName}(${JSON.stringify(args)})`);
      }

      const preSnap = toolName === "run_bash" ? captureWorkspaceSnapshot(projectRoot) : null;

      let result = await executeTool(toolName, args, {
        projectRoot,
        allowedPaths: packet.allowedPaths,
        role: packet.role,
      });

      if (preSnap) {
        const rolledBack = enforceWorkspaceScopeAfterTool(
          projectRoot,
          preSnap,
          packet.allowedPaths,
          packet.role
        );
        if (rolledBack.length > 0) {
          result += `\n[Scope Escape Rollback BR-4] 拦截并自动回滚了越界修改的非授权文件: ${rolledBack.join(", ")}`;
        }
      }

      if (
        (toolName === "write_file" || toolName === "edit_file") &&
        result.startsWith("成功") &&
        args.filePath
      ) {
        changedFiles.add(String(args.filePath));
      }

      if (!silent) {
        const preview = result.length > 200 ? `${result.slice(0, 200)} ...(略)` : result;
        console.log(`  👀 [Observation]: ${preview.replace(/\n/g, " ")}`);
      }

      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: result,
      });
    }
  }

  return {
    role: packet.role,
    finalContent: `达到子专家最大步数限制 (${maxSteps})`,
    stepsUsed: step,
    changedFiles: [...changedFiles],
  };
}
