# Fluent UI v9 (Fluent 2) in SCDMS

The app keeps the **liner-admin** layout (sidebar, header, Tailwind pages) and uses **Microsoft Fluent UI v9** for interactive primitives.

## Stack

| Layer | Technology |
|-------|------------|
| Shell / layout | Tailwind + liner template |
| Components | `@fluentui/react-components` |
| Icons (Fluent) | `@fluentui/react-icons` |
| Icons (legacy) | `lucide-react` on older pages |

## Provider

`FluentThemeProvider` in `main.jsx` (inside `ThemeProvider`):

- **Light** → Fluent light theme  
- **Dim / Dark** → Fluent dark theme  
- **Color preset** → `src/fluent/brandPresets.js`

## Shared wrappers (`components/shared`)

| Component | Fluent primitive | Use for |
|-----------|------------------|---------|
| `BaseButton` | `Button` | Actions, icon buttons |
| `BaseInput` | `Field` + `Input` | Text, number, date |
| `BasePasswordInput` | `Field` + `Input` + show/hide | Passwords |
| `BaseTextarea` | `Field` + `Textarea` | Long text |
| `BaseSelect` | `Field` + `Select` | Dropdowns (`options` string[] or `{value,label}[]`) |
| `BaseCheckbox` | `Checkbox` | Booleans |
| `BaseSwitch` | `Switch` | Toggles |
| `BaseBadge` | `Badge` | Status chips |
| `BaseMessageBar` | `MessageBar` | Errors / success inline |
| `BaseSpinner` | `Spinner` | Loading |
| `BaseCard` | `Card` | Grouped content |
| `Modal` | `Dialog` | Modals |

Import:

```jsx
import {
  BaseButton,
  BaseInput,
  BaseSelect,
  BaseMessageBar,
  Modal,
} from '../../components/shared'
```

## Raw Fluent (`src/fluent/components.js`)

For components without a Base wrapper yet:

```jsx
import { TabList, Tab, Table, TableBody, TableRow, TableCell } from '../../fluent/components'
```

## Already migrated screens

| Area | Fluent usage |
|------|----------------|
| Login (sign-in) | `BaseInput`, `BasePasswordInput`, `BaseButton`, `BaseMessageBar` |
| Language switcher | `Menu` / `MenuList` / `MenuItem` |
| Confirm dialogs | `Modal` + `BaseButton` |
| Dynamic form renderer | All field types via Base* / `RadioGroup` |

## Migration checklist for other pages

1. Replace `<input className="input">` → `BaseInput` or `BaseSelect`  
2. Replace `<textarea className="input">` → `BaseTextarea`  
3. Replace error `<div className="bg-red-50">` → `BaseMessageBar intent="error"`  
4. Replace local `Modal` copies → shared `Modal`  
5. Replace `.btn-primary` on primary actions → `BaseButton variant="primary"`  

## Coexistence

- Tailwind **primary** (`--p-*`) and Fluent **brand** ramps both follow the color preset.  
- Layout (sidebar, cards, tables) may stay Tailwind until migrated.  
- Fluent portals render above the shell automatically.

## References

- [Fluent UI React v9](https://react.fluentui.dev/)
