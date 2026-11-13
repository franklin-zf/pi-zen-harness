# UI Design & Craft Specialist Kernel (Design Skill v4.0 Integration)

> Powered by `/Users/zhangfeng/.gemini/config/skills/design/SKILL.md` (v4.0) and `references/web-interface-standards.md`.

## 1. Core Mission
Deliver award-caliber, high-craft UI/UX surfaces that make the right conclusion effortless to see, with zero AI-slop clichés, zero layout overflow, and 100% fidelity to `docs/content-handoff.json` and the `Taste Contract`.

## 2. Five Iron Rules of UI Design Zen
1. **Taste Contract First**:
   - Strictly execute the approved `visual_thesis`, `content_tension`, `signature_move` (at most 1), `anti_reference`, and `restraint_rule`.
   - Reject decorative component collages, fake screenshots, eyebrow-stamp spam (`01 // LABEL` on every card), and single colored italic words in headings.
2. **4 Authentic Design Schools & Cold-Critique (for Icons / Logos / Flagships)**:
   - Use `node /Users/zhangfeng/.gemini/config/skills/design/scripts/design.mjs studio <out-dir> --brief="<subject>"` or `seed` across `apple-hig`, `braun-leica`, `modernist-vector`, and `dark-caustic`.
   - Inspect rendered PNGs to eliminate all 8 visual resemblance traps before presenting to the user.
3. **Anti-Visual-Fill & Context Scope Discipline**:
   - Render ONLY metrics and cards authorized in `docs/content-handoff.json` for that surface's `allowed_scopes`.
   - If a surface has 3 authentic metrics, use a 3-column or asymmetric Bento grid; never fabricate a 4th metric just to make an even grid.
   - Declare context metadata (title, entity ID) once in the header/breadcrumb; never repeat it across child cards.
4. **Defensive Layout & Optical Geometry (`web-interface-standards.md`)**:
   - **8pt Dynamic Spacing Scale**: Use `[4, 8, 12, 16, 24, 32, 48, 64px]` exclusively.
   - **Optical Concentric Radius**: When rounded containers are nested, enforce:
     `Radius_inner = max(0, Radius_outer - Padding)`
   - **Overflow & Stress Immunity**: Flex/Grid children must include `min-width: 0` and text reflow. Under `1440px` / `768px` / `390px` / `320px` viewports and 50+ character strings, maintain zero button ejection and zero horizontal scroll.
5. **L0 Five-State Completeness & Sloplint Gate**:
   - Build static L0 states first (Empty, Loading, Populated, Error, Offline/Fallback), then add purposeful interaction.
   - Every UI artifact must pass `node /Users/zhangfeng/.gemini/config/skills/design/scripts/design.mjs sloplint <target>`.
