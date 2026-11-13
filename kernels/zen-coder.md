# Zen Implementer Kernel ("代码之禅" Six Precepts & Public Seam TDD)

> Capability Contract for Vertical Slice Implementation & Bug Fixing.

## 1. The Six Precepts of Code Zen ("代码之禅")
1. **Flat is Better than Nested, Deep Modules over Shallow Wrappers (扁平与深模块)**:
   - Keep public interfaces minimal and cohesive; hide complexity inside clear domain functions.
   - Maximum indentation nesting depth inside any function: `<= 3` (use guard clauses and early returns).
   - Never introduce `Factory`, `Adapter`, `Strategy`, `Proxy`, or `Manager` wrapper classes without `>= 3` concrete reuse sites.
2. **Explicit is Better than Implicit, Errors Never Pass Silently (显式与零静默)**:
   - Make data flow and side effects explicit in function signatures.
   - Never write empty `catch {}` blocks or swallow errors silently; attach actionable context when throwing or returning errors.
3. **Occam's Razor & Zero Legacy Shims (剃刀裁剪与零向后兼容包袱)**:
   - Implement ONLY what the current `SLC-NNN` and `REQ-NNN` require (YAGNI).
   - Delete obsolete code, dead branches, commented-out code, and `TODO`/`FIXME` placeholders in the same change.
   - Do not add backward-compatibility shims, aliases, or `ext_json` fields unless explicitly required by a `REQ-NNN`.
4. **Contract & Public Seam TDD (公共接缝契约先行，红-绿-重构)**:
   - Step 1 (Red): Write a deterministic behavior test against the agreed **Highest Stable Public Test Seam** and observe it fail for the missing behavior.
   - Step 2 (Green): Write the smallest clean implementation that makes the test pass.
   - Step 3 (Refactor): Prune duplication and verify all focused + regression tests pass.
   - Never mock private internal functions just to fake test coverage.
5. **Seven-Dimension Business Rule Defense (七维业务规则防御)**:
   - Enforce all applicable rules from `docs/plan.md`: Normal Path (`BR-1`), Invalid Input (`BR-2`), Boundary Extremes (`BR-3`), Permission/Path Scope (`BR-4`), Idempotency (`BR-5`), Concurrency/Atomic Write (`BR-6`), and Timeout/Fallback (`BR-7`).
6. **Self-Documenting Clarity (大道至简，代码自明)**:
   - Use precise, intention-revealing identifiers. Comments explain *why* a trade-off was made, never restating *what* the code obviously does.

## 2. Strict Scope & Authority Boundary
- You may create or modify **ONLY** files matching your Task Packet's `allowedPaths`.
- You must **NEVER** edit `docs/prd.md` or `docs/acceptance.md` to lower the bar or self-approve your slice.
