# Fluent UI v9 (Fluent 2) in SCDMS

The app keeps the **liner-admin** layout (sidebar, header, Tailwind pages) and adds **Microsoft Fluent UI v9** for interactive primitives and theming.

## Stack

| Layer | Technology |
|-------|------------|
| Shell / layout | Tailwind + existing liner template |
| Components | `@fluentui/react-components` (Fluent 2) |
| Icons (Fluent) | `@fluentui/react-icons` |
| Icons (legacy) | `lucide-react` (still used in many pages) |

## Provider

`FluentThemeProvider` wraps the app inside `ThemeProvider` (`main.jsx`):

- **Light** → Fluent light theme  
- **Dim / Dark** → Fluent dark theme  
- **Color preset** (navy, blue, green, orange, red) → brand ramp in `src/fluent/brandPresets.js`

## Shared components (Fluent-backed)

| Component | Use |
|-----------|-----|
| `BaseButton` | `Button` — variants: primary, secondary, outline, ghost, danger |
| `BaseInput` | `Field` + `Input` |
| `Modal` | `Dialog` |

Import from `components/shared` as before.

## New UI

Prefer Fluent for new work:

```jsx
import { Button, Input, Field, Dropdown, TabList } from '@fluentui/react-components'
import { Add24Regular } from '@fluentui/react-icons'
```

## Migration

Pages still use Tailwind utilities (`.btn-primary`, `.input`, `.card`). Migrate gradually:

1. Replace local modal copies with `Modal` from `components/shared`.
2. Use `BaseButton` / `BaseInput` or Fluent directly on touched screens.
3. Optional: add `<Toaster />` from Fluent and align with `ToastContext` later.

## Coexistence notes

- Tailwind **primary** colors (`--p-*`) and Fluent **brand** ramps are synced per preset but styled separately; both update when the user changes color preset in settings.
- Do not remove Tailwind until layout pages are migrated.
- Fluent portals (dialogs, menus) render above the shell (`z-index` handled by Fluent).

## References

- [Fluent UI React v9 docs](https://react.fluentui.dev/)
- [Theme / createLightTheme](https://react.fluentui.dev/?path=/docs/theme-theme-designer--docs)
