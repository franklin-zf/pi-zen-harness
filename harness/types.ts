/**
 * Core Domain Types & Contracts for Pi-Zen Engineering Harness.
 * Adheres to Occam's Razor: only fields required by current SOP gates exist.
 */

export type SOPPhase =
  | "evaluate_and_prd"     // Phase 1 & 2: First-principles evaluation + PRD & Taste Contract
  | "user_confirm_prd"     // Gate 1: User confirms product features, goals, and UI direction
  | "design_plan"          // Phase 3: Flat architecture, 7-Dim BR matrix, vertical slices & UI handoff
  | "execute_slices"       // Phase 4: Vertical slice Red-Green-Refactor TDD & UI L0 5-state build
  | "full_test_qa"         // Phase 5: Independent 3-axis QA (Spec/BR + Code Zen + UI Sloplint/Render)
  | "iterate_bug_fix"      // Phase 6: Deterministic Review/Fix loop & bug-ledger recording
  | "deploy_acceptance";   // Phase 7 & Gate 2: Cleanroom workspace audit & final user deploy acceptance

export type RoleName =
  | "lead-orchestrator"
  | "ceo-kernel"
  | "product-kernel"
  | "architect-kernel"
  | "ui-specialist"
  | "zen-implementer"
  | "independent-qa";

export type ContextScope =
  | "[Global: Host-level]"
  | "[Asset: Data-level]"
  | "[Plugin: Private-level]";

export interface TaskPacket {
  goal: string;
  phase: SOPPhase;
  role: RoleName;
  requirementIds: string[];
  sliceId?: string;
  allowedPaths: string[];
  deliverables: string[];
  exitCriteria: string[];
  nonGoals: string[];
  bugRecallContext?: string;
  uiEnabled?: boolean;
}

export interface FindingRecord {
  id: string;
  type: "product" | "design" | "code" | "functional";
  severity: "blocking" | "major" | "minor";
  moduleId: string;
  requirementId: string;
  problem: string;
  evidence: string;
  owner: string;
  status: "open" | "fixing" | "fixed_pending_verify" | "closed";
  foundBy: string;
  iteration: number;
}

export interface GateCheckResult {
  passed: boolean;
  phase: SOPPhase | string;
  score: number;
  errors: string[];
  warnings: string[];
  metrics?: Record<string, number | string>;
}

export interface TasteContract {
  visual_thesis: string;
  content_tension: string;
  signature_move: string;
  anti_reference: string;
  restraint_rule: string;
}

export interface HandoffCard {
  card_id: string;
  label: string;
  context_scope: ContextScope;
  metric_key: string;
  value_type: string;
}

export interface HandoffSurface {
  surface_id: string;
  surface_category: "host_dashboard" | "client_view" | "asset_workspace" | "plugin_detail_view";
  discovery_surface: "role_home" | "primary_nav" | "contextual";
  plugin_id?: string;
  allowed_scopes: ContextScope[];
  entry_ids: string[];
  cards: HandoffCard[];
}

export interface HandoffEntry {
  entry_id: string;
  role_id: string;
  requirement_id: string;
  module_id: string;
  surface_id: string;
  target: {
    type: "route" | "action";
    key: string;
  };
  priority: "primary" | "secondary";
  release_stage: "available" | "staged";
}

export interface ContentHandoffContract {
  $schema: string;
  schema_version: "2.1";
  handoff_stage: "solution" | "engineering";
  project_id: string;
  module_ids: string[];
  slice_ids: string[];
  requirement_ids: string[];
  taste_contract: TasteContract;
  roles: Array<{ role_id: string; role_name: string }>;
  surfaces: HandoffSurface[];
  entries: HandoffEntry[];
}

export interface BugLedgerEntry {
  id: string;
  status: "open" | "resolved" | "mitigated";
  tags: string;
  symptom: string;
  rootCause: string;
  fixRecipe: string;
  commitOrSlice: string;
  updatedAt: string;
}

export interface PatternCatalogEntry {
  id: string;
  status: "active" | "deprecated";
  name: string;
  problemContext: string;
  solutionArchitecture: string;
  codeRef: string;
  updatedAt: string;
}

export interface SopCheckpointState {
  userRequirement: string;
  uiEnabled: boolean;
  completedPhases: SOPPhase[];
  qaIterations: number;
  updatedAt: string;
}

export interface LoopSnapshot {
  declaredState: string;
  totalIteration: number;
  maxTotalIterations: number;
  maxAttemptsPerFinding: number;
  implementerIds: string[];
  reviewerId: string;
  qaId: string;
  targetCommitOrDigest: string;
  allowedPaths: string[];
  openBlockingOrMajor: FindingRecord[];
  allFindings: FindingRecord[];
}
