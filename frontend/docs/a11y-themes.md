# Accessibility — themes & shared components

## WCAG AA contrast (4.5:1)

### Dim mode
- Body text: slate-100 on slate-800 (`#f1f5f9` on `#1e293b`)
- Muted text: slate-300 (`#cbd5e1`) instead of slate-400
- Nav links and table text bumped for cards at `#253347`

### Orange color preset
- Brand `--p-500` darkened to `#ea580c` for white button labels
- Link text on light UI uses `--p-fg` (orange-900)
- On dark/dim surfaces uses `--p-fg-on-dark` (orange-300)

Verify with browser DevTools → Accessibility → Contrast, or [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/).

## Shared components

| Component | Use for |
|-----------|---------|
| `BaseButton` | All buttons — focus ring, `aria-busy`, touch targets |
| `BaseInput` | Form fields — `label`/`htmlFor`, `aria-invalid`, hints |
| `AiProcessingIndicator` | Async AI (Celery/Claude) — `role="status"`, pulse animation |

```jsx
import { BaseButton, BaseInput, AiProcessingIndicator } from '../components/shared'
```

`LanguageSwitcher` is refactored to use `BaseButton` as the reference implementation.

## AI processing UI

`AiProcessingIndicator` respects `prefers-reduced-motion` (animation disabled).

Used on: quality score, executive brief, package validation, document OCR, meeting briefing pack.
