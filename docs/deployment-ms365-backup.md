# Microsoft 365 (OneDrive) cloud backup push

Backups (`scdms_backup_<timestamp>.zip`, containing `data.json` plus every
file under `MEDIA_ROOT`) can push automatically to an admin's Microsoft 365
OneDrive — both the manual "Run Backup Now" button and any scheduled backup
trigger it, if a connection is active. Nothing is required to keep using
local-only backups; this is entirely opt-in from the Backup & Restore admin
page.

## One-time setup: Azure AD App Registration

Someone with Azure AD admin rights in the psc.gov.vu Microsoft 365 tenant
needs to do this once, before any admin can connect an account:

1. In the [Azure Portal](https://portal.azure.com) → **Azure Active
   Directory → App registrations → New registration**.
2. Name it something recognizable (e.g. "SCDMS Backup"). Supported account
   types: "Accounts in this organizational directory only" is sufficient.
3. Add a **Web** platform redirect URI:
   `https://scdms.psc.gov.vu/api/backup/cloud/callback/microsoft/`
   (swap the domain if it's ever hosted elsewhere).
4. Note the **Application (client) ID** shown on the app's Overview page.
5. **Certificates & secrets → New client secret** — note the *value*
   immediately; it's only shown once.
6. **API permissions → Add a permission → Microsoft Graph → Delegated
   permissions**, add:
   - `Files.ReadWrite.AppFolder` — restricts SCDMS to its own isolated
     folder in the connected account's OneDrive; it can never see or touch
     anything else in that Drive.
   - `offline_access` — required to get a refresh token, so the connection
     survives past the ~1 hour access-token lifetime without the admin
     re-authenticating.

   Neither of these needs admin consent — they're user-consentable, granted
   individually by whichever admin clicks "Connect Microsoft 365."

## Environment variables

Add to `.env`:

```env
MS365_CLIENT_ID=<Application (client) ID from step 4>
MS365_CLIENT_SECRET=<client secret value from step 5>
MS365_REDIRECT_URI=https://scdms.psc.gov.vu/api/backup/cloud/callback/microsoft/
BACKUP_CLOUD_ENCRYPTION_KEY=<generate once, see below>
```

Generate the encryption key once (encrypts the OAuth refresh token at rest
— a standing credential to the connected admin's real M365 account, not a
static API key, so it gets real encryption rather than the plaintext
`SystemSetting` pattern used for other secrets):

```bash
docker compose exec backend python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

**Never rotate `BACKUP_CLOUD_ENCRYPTION_KEY` without first disconnecting
and reconnecting the Microsoft 365 account** — the stored tokens become
unreadable if the key changes, and the connection will need to be redone
anyway (it'll show as "needs reconnect" in the admin UI).

## Using it

From **Administration → Backup & Restore**, the "Cloud Backup" card:
connect, and every backup from then on pushes automatically; disconnect
any time. When the connected admin leaves, the next admin just clicks
"Connect Microsoft 365" themselves and signs in with their own account —
no code change, no re-running this setup (the Azure App Registration above
is shared infrastructure, done once regardless of who's currently
connected).
