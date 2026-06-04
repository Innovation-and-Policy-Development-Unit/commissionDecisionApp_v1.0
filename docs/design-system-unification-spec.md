# Design-System Unification (A1) — Implementation Spec

> **Status:** Proposed (awaiting build approval).
> **Track:** Enterprise UX/UI — foundational (other UX work depends on it).
> **Driver:** Production readiness — one consistent, accessible, themeable UI.
> **One-line goal:** Standardize the frontend on the **existing in-house `Base*`
> component library** (Tailwind + self-owned tokens) and **remove the `@fluentui`
> dependency**, eliminating the current two-component-system split.

---

## 1. Why

The frontend runs **two parallel component systems**:

- **Fluent UI** (`@fluentui/react-components`) — used in **43 files**, styled with
  `makeStyles`/`tokens`.
- **In-house Tailwind library** (`components/shared/Base*`) + Tailwind utility classes —
  used across **94 page files**, styled with Tailwind + component classes in `index.css`.

Result: inconsistent spacing, typography, focus rings, dark-mode behavior, and two
mental models for every contributor. For an enterprise rollout across ministries this is
a correctness, accessibility, and maintainability liability — and it bloats the bundle
(Fluent is large).

**The good news:** this is *finishing* a migration, not starting one. A canonical library
already exists and the design tokens are already mostly self-owned (see §3).

---

## 2. Current state (verified)

| Layer | Reality |
|---|---|
| **Canonical components** | `components/shared/Base*`: `BaseButton`, `BaseCard`, `BaseInput`, `BaseSelect`, `BaseTextarea`, `BaseCheckbox`, `BaseRadioGroup`, `BaseSwitch`, `BaseBadge`, `BaseMessageBar`, `BasePasswordInput`, `BaseSpinner`, `BaseFieldSection`, `BaseReadonlyField`, plus `DataTable`, `Modal`, `Badge`, `Avatar`, `PageHeader`. |
| **Color tokens** | **Self-owned** in `index.css` — `--p-50…--p-900` per color preset, light + dark, switched via `[data-theme]` and `.dark`. Tailwind reads them (`rgb(var(--p-500))`). ✅ No Fluent dependency. |
| **Typography tokens** | **Injected from Fluent at runtime** by `fluent/syncTypographyToDocument.js` (`--fontFamilyBase`, `--fontSizeBase*`, `--fontWeight*`, `--lineHeight*`). Tailwind's `fontSize/fontWeight/fontFamily` map to these vars. ⚠️ **This is the one true coupling to break.** |
| **Theming runtime** | `context/ThemeContext.jsx` — light/dark, `colorPreset` (`data-theme`), RTL, sidebar/layout prefs. Keep. |
| **Fluent token bridge** | `fluent/FluentThemeProvider.jsx`, `themes.js`, `brandPresets.js`, `initFluentTypography.js`, `components.js` — exist solely to feed Fluent + sync typography. To be retired. |
| **Accessible primitives** | `@headlessui/react` already a dependency (used in 2 files) — available for Menu/Popover/Dialog/Combobox/Tabs primitives. |

---

## 3. Target architecture

**Single component layer = `components/ui/`** (promoted/renamed from `Base*`), built on
**Tailwind + Headless UI** primitives, driven by **self-owned CSS-variable tokens**. Fluent
is removed entirely.

```
Design tokens (index.css :root)         ← single source of truth
  ├─ color:        --p-* (already native) + semantic tokens (surface, text, border, danger…)
  ├─ typography:   --font-* (move OFF Fluent → define natively)        ← key change
  ├─ spacing/radius/shadow/z-index/motion (already in tailwind.config / index.css)
        │
        ▼
Tailwind config (consumes the vars — already wired)
        │
        ▼
components/ui/  (Button, Card, Input, Select, Tabs, Dialog, Tooltip, Popover, Menu,
                Table, Toast, Badge, Switch, Checkbox, Radio, DatePicker, Combobox…)
        │  built with Tailwind classes + Headless UI for a11y behavior
        ▼
Pages & feature components  (import ONLY from components/ui)
```

**Decision:** consolidate onto the **Tailwind/Base\*** side (the 94-file majority), not
Fluent. Rationale: smaller migration surface, lighter bundle, tokens already native,
Headless UI already present for accessibility, no large 3rd-party UI dependency to track.

---

## 4. Token system (formalize + decouple from Fluent)

1. **Typography → native.** Define in `index.css :root` (and dark overrides if needed):
   `--font-family-base`, `--font-family-monospace`, `--font-size-100…1000`,
   `--line-height-*`, `--font-weight-regular/medium/semibold/bold`. Point
   `tailwind.config.js` at these. Delete the runtime Fluent typography sync.
2. **Semantic color tokens.** Add intent tokens layered over `--p-*`:
   `--color-surface`, `--color-surface-2`, `--color-text`, `--color-text-muted`,
   `--color-border`, `--color-success/warning/danger/info`. Components reference semantic
   tokens, not raw palette — enables re-theming without touching components.
3. **Keep** existing spacing, radius, shadow (`shadow-card*`), z-index scale, motion
   (`animate-*`), `colorPreset` presets, dark mode (`.dark`), and RTL.
4. **Density (new, optional):** a `data-density="comfortable|compact"` root attribute that
   scales control padding via tokens — common enterprise need for dense data screens.

Outcome: **zero** design value sourced from Fluent; the whole system is one CSS-var
contract owned in-repo.

---

## 5. Component library — inventory & gaps

**Already covered by `Base*` (rename/move to `components/ui`, stable public API):**
Button, Card, Input, Textarea, Select, Checkbox, RadioGroup, Switch, Badge, MessageBar
(Alert), PasswordInput, Spinner, FieldSection, ReadonlyField, Modal (Dialog), Avatar,
PageHeader, DataTable.

**Gaps to add** (Fluent currently provides these in the 43 files — build on Headless UI):
`Tabs`/`TabList`, `Menu`/`Dropdown`, `Popover`, `Tooltip`, `Combobox`/`Autocomplete`,
`DatePicker`, `Toast` (confirm current `toast` util coverage), `Accordion`, `Breadcrumb`,
`Pagination` (if not in DataTable). Each: keyboard + ARIA built in, token-styled, dark +
RTL aware.

A lightweight **component catalog page** (internal route, dev-only) renders every `ui`
component in all states — the contributor reference and visual-regression surface.
(Storybook optional; a single route avoids new tooling.)

---

## 6. Fluent → `components/ui` mapping

| Fluent (`@fluentui/react-components`) | Replacement |
|---|---|
| `Button` | `ui/Button` |
| `Input` | `ui/Input` |
| `Card`, `CardHeader` | `ui/Card` (+ header slot) |
| `Text` | semantic HTML + Tailwind type classes |
| `Spinner` | `ui/Spinner` |
| `makeStyles` / `tokens` / `shorthands` | Tailwind classes + token vars (delete `makeStyles`) |
| `TabList`/`Tab` | `ui/Tabs` (Headless UI) |
| `Menu*`, `Popover*`, `Tooltip` | `ui/Menu`, `ui/Popover`, `ui/Tooltip` (Headless UI) |
| `@fluentui/react-icons` | `lucide-react` (already the primary icon set) |

---

## 7. Migration strategy

1. **Freeze Fluent (guardrail first).** Add ESLint `no-restricted-imports` banning
   `@fluentui/react-components` and `@fluentui/react-icons` in new code (warn → error once
   migration completes). Prevents the split from growing while we close it.
2. **Decouple tokens** (§4.1) — make typography native; verify nothing visually shifts.
3. **Fill component gaps** (§5) so every Fluent usage has a `ui` equivalent.
4. **Migrate the 43 files by domain**, smallest blast radius first:
   - Generate the exact list: `grep -rl '@fluentui/react-components' src`.
   - Order: reports (SmartReports) → admin → shared → feature pages.
   - Per file: replace components per §6, convert `makeStyles` → Tailwind, swap icons,
     remove Fluent imports. Visual check against the catalog.
5. **Remove Fluent.** Delete `fluent/` bridge files (`FluentThemeProvider`, `themes`,
   `brandPresets`, `initFluentTypography`, `syncTypographyToDocument`, `components.js`),
   drop `@fluentui/*` from `package.json`, unwrap the provider in `main.jsx`/`App.jsx`.
   Flip the ESLint rule to `error`.
6. **Verify** bundle-size delta and run the app across key flows + dark mode + RTL + each
   color preset.

No big-bang: the app stays shippable at every step (both systems coexist until step 5).

---

## 8. Accessibility (baked into `ui`)

Each `ui` component ships with: correct roles/ARIA, visible focus ring (token-driven),
full keyboard support (via Headless UI where interactive), `aria-live` for async/toasts,
contrast meeting **WCAG 2.1 AA** in light + dark, and `prefers-reduced-motion` respect.
This converts accessibility from per-page effort into a property of the library — and is a
prerequisite for the standalone A4 (WCAG audit) track.

---

## 9. File-by-file

**New / changed (foundation)**
- `frontend/src/index.css` — native typography tokens + semantic color tokens (+ density attr)
- `frontend/tailwind.config.js` — point font scales at native vars; add semantic colors
- `frontend/src/components/ui/` — promoted `Base*` + new primitives (Tabs, Menu, Popover, Tooltip, Combobox, DatePicker, Accordion, Breadcrumb)
- `frontend/src/components/ui/_catalog/` + a dev-only route — component reference
- `frontend/.eslintrc.*` — `no-restricted-imports` for `@fluentui/*` (ties into the CI/lint track)

**Edited (migration)**
- The 43 files importing `@fluentui/react-components` (enumerated at build time)
- `frontend/src/main.jsx` / `App.jsx` — remove `FluentThemeProvider`
- `frontend/package.json` — remove `@fluentui/react-components`, `@fluentui/react-icons`

**Deleted (after migration)**
- `frontend/src/fluent/*`

---

## 10. Phasing

1. **P1 — Foundation:** guardrail lint rule, native typography tokens, semantic tokens,
   component-gap build-out, catalog route. *(App unchanged visually; no page migrated yet.)*
2. **P2 — Migrate Fluent pages** by domain (reports → admin → shared → features).
3. **P3 — Remove Fluent** dependency + bridge; flip lint to error; bundle-size verification.
4. **P4 — Polish:** density mode, finalize dark/RTL parity, hand off catalog as the
   contributor standard.

---

## 11. Risks

| Risk | Mitigation |
|---|---|
| Visual regressions during migration | Component catalog as reference; migrate per-domain; both systems coexist until the end; screenshot key pages before/after. |
| Typography shift when decoupling from Fluent | Copy current computed Fluent type values into the native tokens verbatim; diff before/after. |
| Accessibility regressions vs Fluent's built-ins | Build `ui` primitives on Headless UI (accessible by design); a11y checks in the catalog. |
| Scope creep (redesign vs unify) | This track is **consolidation, not restyling** — keep visuals equivalent; redesign is a separate decision. |
| New Fluent usage sneaks in mid-migration | ESLint guardrail added in P1 (warn), enforced in P3 (error). |
| Bundle/CSS regressions | Measure bundle before/after; removing Fluent should net-reduce size. |

---

## 12. Dependencies on / from other tracks

- **Enables:** A2 notification center, A3 data grid/saved views, A5 dashboards, A6 process
  map, B-series feature UIs — all should be built in `components/ui` from day one.
- **Pairs with:** the CI/lint track (the `no-restricted-imports` guardrail belongs in CI).
- **Unblocks:** A4 WCAG audit (accessibility centralized in the library).
```
