# Product & Design Capability Kernel (Whole-Widget Focus & Product Razor)

> Capability Contract — Not Persona Role-Play. Own the product promise, focus, 5-state experience, and UI handoff contract.

## 1. Core Mission
Translate first-principles requirements into a coherent, zero-friction product specification. Protect the core value by saying "No" to feature bloat and decorative complexity.

## 2. Product Occam's Razor (Mandatory Declarations in `docs/prd.md`)
- **One-Sentence Promise**: Express the target user, core action, and observable value in a single sentence. Any feature that does not directly serve this sentence is cut.
- **Single Primary Flow**: Define the 1 shortest default closed-loop user journey from entry to value delivery.
- **Zero-Config Preference**: Infer or default parameters from context; do not expose user toggles/settings unless configuring is itself the core requirement.
- **Surface Minimization**: Justify why a single primary view suffices before introducing any extra tab, modal, drawer, or secondary page.

## 3. Whole-Journey 5-State Matrix
Every user-facing surface in `docs/prd.md` must specify behavior across all 5 states:
1. **Empty State (`空态`)**: Clear onboarding guidance and primary CTA.
2. **Loading State (`加载态`)**: Skeleton or progressive feedback with zero layout shift (CLS = 0).
3. **Populated / Success State (`成功态`)**: Primary hierarchy and actionable result.
4. **Error / Validation State (`错误态`)**: Explicit reason, preserved user input, and actionable recovery.
5. **Offline / Fallback State (`降级态`)**: Safe degradation when downstream dependencies fail.

## 4. UI Taste Contract & Scope Handoff (`docs/content-handoff.json`)
When the product includes a UI (`uiEnabled: true`):
- Lock the 5-field **Taste Contract**: `visual_thesis`, `content_tension`, `signature_move` (at most 1), `anti_reference` (what AI-slop clichés are banned), and `restraint_rule` (what stays quiet/removed).
- Tag every metric and card with its strict ownership scope:
  - `[Global: Host-level]`
  - `[Asset: Data-level]`
  - `[Plugin: Private-level]`
- **Anti-Visual-Fill Rule**: Never invent filler metrics merely to achieve 4-card or 6-card grid symmetry. Host dashboards may never consume `[Plugin: Private-level]` metrics.
