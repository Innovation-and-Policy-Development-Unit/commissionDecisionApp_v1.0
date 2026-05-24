# Fluent UI v9 (Fluent 2) in SCDMS

The app keeps the **liner-admin** layout (sidebar, header, Tailwind pages) and uses **Microsoft Fluent UI v9** for interactive primitives.

## Stack

| Layer | Technology |
|-------|------------|
| Shell / layout | Tailwind + liner template |
| Components | `@fluentui/react-components` |
| Icons (Fluent) | `@fluentui/react-icons` |
| Icons (legacy) | `lucide-react` on older pages |

## Typography

The app uses **Fluent UI v9 typography tokens only** (no Inter, Georgia, or other web fonts).

- `initFluentTypography()` runs before first paint (`main.jsx`) so `:root` has Fluent `fontFamily*` / `fontSize*` before CSS loads.
- `FluentThemeProvider` re-syncs tokens on theme / color-preset change via `syncTypographyToDocument.js`.
- Tailwind `font-sans`, `font-mono`, and `text-sm` / `text-lg` map to `var(--fontFamilyBase)`, `var(--fontFamilyMonospace)`, and Fluent `fontSize*` steps.
- Legacy `text-[10px]`-style utilities are remapped to the nearest Fluent step in `index.css`.
- Default UI font: **Segoe UI** stack (Fluent standard on Windows; system fallbacks elsewhere).

## Provider

`FluentThemeProvider` in `main.jsx` (inside `ThemeProvider`):

- **Light** → Fluent light theme  
- **Dim / Dark** → Fluent dark theme  
- **Color preset** → `src/fluent/brandPresets.js`

## Base component layer (`components/shared`)

Unified wrappers around Fluent primitives. **Prefer these over raw HTML** for forms, dialogs, and tables.

| Component | Fluent primitive | Use for |
|-----------|------------------|---------|
| `BaseButton` | `Button` | Actions (press/hover motion built-in) |
| `BaseInput` | `Field` + `Input` | Text, number, date, search |
| `BasePasswordInput` | `Field` + `Input` | Passwords |
| `BaseTextarea` | `Field` + `Textarea` | Long text |
| `BaseSelect` | `Field` + `Select` | Dropdowns |
| `BaseCheckbox` | `Checkbox` | Booleans |
| `BaseRadioGroup` | `Field` + `RadioGroup` | Choice lists |
| `BaseSwitch` | `Switch` | Toggles |
| `BaseFieldSection` | `Divider` + `Label` | Form section headers |
| `BaseReadonlyField` | `Field` + `Text` | View-only form values |
| `BaseFieldSkeleton` | `Skeleton` | Async / AI field loading |
| `AiTextSkeleton` | `Skeleton` | Inline AI text (agenda blurbs) |
| `BaseBadge` | `Badge` | Status chips |
| `BaseMessageBar` | `MessageBar` | Inline alerts |
| `BaseSpinner` | `Spinner` | Loading |
| `BaseCard` | `Card` | Grouped content |
| `Modal` | `Dialog` | Modals (focus trap + restore) |
| `DynamicFormRenderer` | All of the above | PSC dynamic forms |
| `DataTable` | `Table` + Base* | Sortable lists |

Import:

```jsx
import {
  BaseButton,
  BaseInput,
  DynamicFormRenderer,
  Modal,
} from '../../components/shared'
```

## Dynamic forms

`DynamicFormRenderer` drives every PSC form built in the admin Form Builder and shown on submission detail.

```jsx
<DynamicFormRenderer
  fields={fields}
  values={values}
  onChange={setValues}
  readOnly={false}
  loadingFieldKeys={['summary']}  // Fluent skeleton per key
  errors={{ title: 'Required' }}
/>
```

Field types: `text`, `textarea`, `number`, `date`, `datetime`, `select`, `radio`, `checkbox`, `section_header`.

## Data tables

`DataTable` uses Fluent `Table` with **sticky headers** and `BaseInput` search. For 500+ rows, plan **virtualization** via `@fluentui-contrib/react-data-grid-react-window` (not bundled yet).

## Motion & AI feedback

- **Skeletons**: `BaseFieldSkeleton` / `AiTextSkeleton` instead of CSS pulse bars for AI fields.
- **Buttons**: Fluent press/hover feedback on `BaseButton`.

## Accessibility (built-in)

| Feature | Where |
|---------|--------|
| Focus trap + restore | `Modal` (`Dialog`) |
| Field labels + hints + errors | `BaseInput`, `BaseSelect`, … |
| `aria-live` on AI skeletons | `AiTextSkeleton`, `AiProcessingIndicator` |
| Table semantics | `DataTable` |

## Raw Fluent (`src/fluent/components.js`)

For components without a Base wrapper yet (`Toolbar`, `TabList`, `Combobox`, …):

```jsx
import { Toolbar, ToolbarButton } from '../../fluent/components'
```

## Roadmap (recommended next)

1. **Submission command bar** — `Toolbar` on submission detail for stage transitions (Approve / Return / Defer).
2. **Virtualized submission log** — DataGrid contrib when row counts exceed ~200.
3. **Migrate remaining local modals** — Admin panel, Form Builder preview shell.
4. **FormElements demo page** — showcase Base* instead of raw HTML (template only).

## Already migrated screens

| Area | Fluent usage |
|------|----------------|
| Login | BaseInput, BasePasswordInput, BaseButton, BaseMessageBar |
| Language switcher | Menu |
| Confirm dialogs | Modal + BaseButton |
| Dynamic forms | DynamicFormRenderer (full Base layer) |
| Feedback admin table | DataTable (Fluent Table) |
| Secretariat modals | Shared Modal |
| Submission workflow sidebar | BaseSelect, BaseTextarea, BaseButton |
| Agenda AI blurbs | AiTextSkeleton |

## Coexistence

- Tailwind **primary** (`--p-*`) and Fluent **brand** ramps follow the color preset.  
- Layout (sidebar, cards) may stay Tailwind until migrated.  
- Fluent portals render above the shell automatically.

## References

- [Fluent UI React v9](https://react.fluentui.dev/)
