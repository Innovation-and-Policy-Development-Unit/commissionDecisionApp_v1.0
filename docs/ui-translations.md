# UI translations (admin)

Administrators can edit dashboard strings in **English**, **French**, and **Bislama** without deploying new frontend code.

## Setup (once per environment)

1. Run migrations: `python manage.py migrate`
2. Import keys from locale JSON: `python manage.py sync_ui_translations`
3. Ensure **Manage UI Translations** permission is assigned (PSC Admin has it by default after `seed_tracker`)

## How it works

| Layer | Source |
|-------|--------|
| Baseline | `frontend/src/i18n/locales/en.json`, `fr.json`, `bi.json` |
| Overrides | `UiTranslation` rows in PostgreSQL |
| Runtime | SPA calls `GET /api/ui-translations/bundles/` and merges into i18next |

## Admin UI

**Administration → UI translations** (`/admin/ui-translations`)

- Edit keys in a table (variable | EN | FR | BI)
- Filter by section (namespace = first part of key, e.g. `nav`, `secretariat`)
- **Save changes** applies to the live app immediately
- **Import from codebase JSON** re-syncs from files (skips rows marked customized)

## Permissions

- Permission code: `manage_ui_translations`
- Grant via **Roles & Permissions** to any role that should edit labels
- `/me/` exposes `can_manage_translations` for the frontend menu

## Making new UI text translatable

In React:

```jsx
const { t } = useTranslation()
return <h1>{t('my_section.page_title')}</h1>
```

Add the key to locale JSON (or use **Add key** in admin), then run `sync_ui_translations` if needed.

Avoid hard-coded user-visible strings in new pages; use `t('…')` so they appear in the translation admin.

## API

| Endpoint | Access |
|----------|--------|
| `GET /api/ui-translations/bundles/` | Public (login page included) |
| `GET/POST/PATCH /api/ui-translations/` | `manage_ui_translations` |
| `POST /api/ui-translations/sync-from-files/` | `manage_ui_translations` |
| `POST /api/ui-translations/bulk-update/` | `manage_ui_translations` |
