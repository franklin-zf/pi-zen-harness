/**
 * Bounded Project Memory & Bug Ledger Engine.
 * Enforces symlink rejection (BR-4), idempotent recording (BR-5), and atomic file replacement (BR-6).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type { BugLedgerEntry, PatternCatalogEntry, SopCheckpointState } from "./types.ts";

const MEMORY_REL_DIR = path.join(".pi-zen", "memory");
const BUG_LEDGER_FILE = "bug-ledger.md";
const PATTERN_CATALOG_FILE = "pattern-catalog.md";
const STATE_CHECKPOINT_REL_PATH = path.join(".pi-zen", "state.json");

const INITIAL_BUG_LEDGER = `# 工程研发错题本 (Bug Ledger)

> 自动沉淀每次 QA/Fix 循环中的真实缺陷根因与修复配方。新需求与切片启动前自动检索召回。

| ID | Status | Tags | Symptom | Root Cause | Fix Recipe | Commit/Slice | Updated At |
| --- | --- | --- | --- | --- | --- | --- | --- |
`;

const INITIAL_PATTERN_CATALOG = `# 工程架构与代码之禅范式库 (Pattern Catalog)

> 自动沉淀通过三轴验收的高质量两层扁平架构与公共测试接缝范式。

| ID | Name | Tags | Context | Solution | Seam Example | Updated At |
| --- | --- | --- | --- | --- | --- | --- |
`;

/**
 * Atomic, symlink-safe file writer (BR-4 & BR-6).
 */
export function writeFileAtomic(targetPath: string, content: string): void {
  const resolved = path.resolve(targetPath);
  const dir = path.dirname(resolved);
  fs.mkdirSync(dir, { recursive: true });

  const st = fs.lstatSync(resolved, { throwIfNoEntry: false });
  if (st && st.isSymbolicLink()) {
    throw new Error(`[Security Block BR-4] 拒绝向符号链接写入: ${resolved}`);
  }

  const tmpPath = `${resolved}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmpPath, content, { encoding: "utf-8", flag: "wx" });
  fs.renameSync(tmpPath, resolved);
}

/**
 * Initialize `.pi-zen/memory/bug-ledger.md` idempotently (BR-5).
 */
export function initProjectMemory(projectRoot: string): string {
  const root = path.resolve(projectRoot);
  const rootStat = fs.lstatSync(root, { throwIfNoEntry: false });
  if (rootStat && rootStat.isSymbolicLink()) {
    throw new Error(`[Security Block BR-4] 项目根目录不能是符号链接: ${root}`);
  }
  const ledgerPath = path.join(root, MEMORY_REL_DIR, BUG_LEDGER_FILE);
  const ledgerStat = fs.lstatSync(ledgerPath, { throwIfNoEntry: false });
  if (ledgerStat && ledgerStat.isSymbolicLink()) {
    throw new Error(`[Security Block BR-4] 拒绝向符号链接写入: ${ledgerPath}`);
  }
  if (!ledgerStat) {
    writeFileAtomic(ledgerPath, INITIAL_BUG_LEDGER);
  }
  const patternPath = path.join(root, MEMORY_REL_DIR, PATTERN_CATALOG_FILE);
  const patternStat = fs.lstatSync(patternPath, { throwIfNoEntry: false });
  if (patternStat && patternStat.isSymbolicLink()) {
    throw new Error(`[Security Block BR-4] 拒绝向符号链接写入: ${patternPath}`);
  }
  if (!patternStat) {
    writeFileAtomic(patternPath, INITIAL_PATTERN_CATALOG);
  }
  return ledgerPath;
}

/**
 * Parse all entries from `.pi-zen/memory/bug-ledger.md`.
 */
export function readBugLedger(projectRoot: string): BugLedgerEntry[] {
  const ledgerPath = path.join(path.resolve(projectRoot), MEMORY_REL_DIR, BUG_LEDGER_FILE);
  const st = fs.lstatSync(ledgerPath, { throwIfNoEntry: false });
  if (!st) return [];
  if (st.isSymbolicLink()) {
    throw new Error(`[Security Block BR-4] 拒绝读取符号链接记忆文件: ${ledgerPath}`);
  }

  const lines = fs.readFileSync(ledgerPath, "utf-8").split(/\r?\n/);
  const entries: BugLedgerEntry[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) continue;
    const cells = trimmed
      .slice(1, -1)
      .split("|")
      .map((c) => c.trim());
    if (cells.length < 8) continue;
    if (cells[0] === "ID" || /^[-:]+$/.test(cells[0])) continue;

    entries.push({
      id: cells[0],
      status: (cells[1] as BugLedgerEntry["status"]) || "resolved",
      tags: cells[2],
      symptom: cells[3],
      rootCause: cells[4],
      fixRecipe: cells[5],
      commitOrSlice: cells[6],
      updatedAt: cells[7],
    });
  }
  return entries;
}

/**
 * Record a resolved bug into `.pi-zen/memory/bug-ledger.md` idempotently (BR-5 & BR-6).
 */
export function recordBugEntry(
  projectRoot: string,
  input: {
    tags: string;
    symptom: string;
    rootCause: string;
    fixRecipe: string;
    commitOrSlice?: string;
    status?: "open" | "resolved" | "mitigated";
  }
): BugLedgerEntry {
  const sanitize = (s: string) => s.replace(/\|/g, "/").replace(/\r?\n/g, " ").trim();
  const symptom = sanitize(input.symptom);
  const rootCause = sanitize(input.rootCause);
  const fixRecipe = sanitize(input.fixRecipe);
  const tags = sanitize(input.tags || "general");
  const commitOrSlice = sanitize(input.commitOrSlice || "SLC-001");
  const status = input.status || "resolved";

  if (!symptom || !rootCause || !fixRecipe) {
    throw new Error("[BR-2 Invalid Input] 记录错题必须提供非空的 symptom、rootCause 与 fixRecipe");
  }

  const ledgerPath = initProjectMemory(projectRoot);
  const existing = readBugLedger(projectRoot);

  // Idempotency check (BR-5): if identical symptom + rootCause already exists, return it without duplicate append
  const duplicate = existing.find(
    (e) =>
      e.symptom.toLowerCase() === symptom.toLowerCase() &&
      e.rootCause.toLowerCase() === rootCause.toLowerCase()
  );
  if (duplicate) {
    return duplicate;
  }

  const nextNum = existing.length + 1;
  const id = `BUG-${String(nextNum).padStart(3, "0")}`;
  const updatedAt = new Date().toISOString().slice(0, 10);

  const newEntry: BugLedgerEntry = {
    id,
    status,
    tags,
    symptom,
    rootCause,
    fixRecipe,
    commitOrSlice,
    updatedAt,
  };

  const currentContent = fs.readFileSync(ledgerPath, "utf-8").trimEnd();
  const newRow = `| ${newEntry.id} | ${newEntry.status} | ${newEntry.tags} | ${newEntry.symptom} | ${newEntry.rootCause} | ${newEntry.fixRecipe} | ${newEntry.commitOrSlice} | ${newEntry.updatedAt} |\n`;
  writeFileAtomic(ledgerPath, `${currentContent}\n${newRow}`);

  return newEntry;
}

/**
 * Search historical bugs by keyword or tag to prevent recurring mistakes.
 */
export function searchBugs(projectRoot: string, query?: string): BugLedgerEntry[] {
  const entries = readBugLedger(projectRoot);
  if (!query || !query.trim()) return entries;
  const q = query.trim().toLowerCase();
  return entries.filter(
    (e) =>
      e.tags.toLowerCase().includes(q) ||
      e.symptom.toLowerCase().includes(q) ||
      e.rootCause.toLowerCase().includes(q) ||
      e.fixRecipe.toLowerCase().includes(q)
  );
}

/**
 * Read all entries from `.pi-zen/memory/pattern-catalog.md` (P2-1).
 */
export function readPatternCatalog(projectRoot: string): PatternCatalogEntry[] {
  const patternPath = path.join(path.resolve(projectRoot), MEMORY_REL_DIR, PATTERN_CATALOG_FILE);
  const st = fs.lstatSync(patternPath, { throwIfNoEntry: false });
  if (!st) return [];
  if (st.isSymbolicLink()) {
    throw new Error(`[Security Block BR-4] 拒绝读取符号链接记忆文件: ${patternPath}`);
  }

  const lines = fs.readFileSync(patternPath, "utf-8").split(/\r?\n/);
  const entries: PatternCatalogEntry[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) continue;
    const cells = trimmed
      .slice(1, -1)
      .split("|")
      .map((c) => c.trim());
    if (cells.length < 7) continue;
    if (cells[0] === "ID" || /^[-:]+$/.test(cells[0])) continue;

    entries.push({
      id: cells[0],
      name: cells[1],
      tags: cells[2],
      context: cells[3],
      solution: cells[4],
      seamExample: cells[5],
      updatedAt: cells[6],
    });
  }
  return entries;
}

/**
 * Record an approved architectural or TDD pattern into `.pi-zen/memory/pattern-catalog.md` idempotently.
 */
export function recordPatternEntry(
  projectRoot: string,
  input: {
    name: string;
    tags: string;
    context: string;
    solution: string;
    seamExample: string;
  }
): PatternCatalogEntry {
  const sanitize = (s: string) => s.replace(/\|/g, "/").replace(/\r?\n/g, " ").trim();
  const name = sanitize(input.name);
  const tags = sanitize(input.tags || "architecture");
  const context = sanitize(input.context);
  const solution = sanitize(input.solution);
  const seamExample = sanitize(input.seamExample);

  initProjectMemory(projectRoot);
  const patternPath = path.join(path.resolve(projectRoot), MEMORY_REL_DIR, PATTERN_CATALOG_FILE);
  const existing = readPatternCatalog(projectRoot);

  const duplicate = existing.find((e) => e.name.toLowerCase() === name.toLowerCase());
  if (duplicate) return duplicate;

  const id = `PAT-${String(existing.length + 1).padStart(3, "0")}`;
  const updatedAt = new Date().toISOString().slice(0, 10);
  const entry: PatternCatalogEntry = {
    id,
    name,
    tags,
    context,
    solution,
    seamExample,
    updatedAt,
  };

  const currentContent = fs.readFileSync(patternPath, "utf-8").trimEnd();
  const newRow = `| ${entry.id} | ${entry.name} | ${entry.tags} | ${entry.context} | ${entry.solution} | ${entry.seamExample} | ${entry.updatedAt} |\n`;
  writeFileAtomic(patternPath, `${currentContent}\n${newRow}`);
  return entry;
}

/**
 * Save SOP pipeline checkpoint to `.pi-zen/state.json` for resumable execution (P2-1).
 */
export function saveSopCheckpoint(projectRoot: string, state: SopCheckpointState): void {
  const statePath = path.join(path.resolve(projectRoot), STATE_CHECKPOINT_REL_PATH);
  writeFileAtomic(statePath, JSON.stringify(state, null, 2));
}

/**
 * Load SOP pipeline checkpoint from `.pi-zen/state.json` if present.
 */
export function loadSopCheckpoint(projectRoot: string): SopCheckpointState | null {
  const statePath = path.join(path.resolve(projectRoot), STATE_CHECKPOINT_REL_PATH);
  const st = fs.lstatSync(statePath, { throwIfNoEntry: false });
  if (!st || st.isSymbolicLink()) return null;
  try {
    return JSON.parse(fs.readFileSync(statePath, "utf-8")) as SopCheckpointState;
  } catch {
    return null;
  }
}
