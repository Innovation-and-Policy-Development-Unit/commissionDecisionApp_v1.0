# Google Drive cloud backup push

Backups (`scdms_backup_<timestamp>.zip`, containing `data.json` plus every
file under `MEDIA_ROOT`) can push automatically to an admin's Google
account — both the manual "Run Backup Now" button and any scheduled backup
trigger it, if a connection is active. Nothing is required to keep using
local-only backups; this is entirely opt-in from the Backup & Restore admin
page.

## One-time setup: Google Cloud OAuth Client

Someone with access to a Google Cloud project (a personal or organizational
one both work) needs to do this once, before any admin can connect an
account:

1. In the [Google Cloud Console](https://console.cloud.google.com) →
   create or select a project → **APIs & Services → Library** → enable the
   **Google Drive API**.
2. **APIs & Services → OAuth consent screen** — set User type to
   "External" (or "Internal" if the project lives in a Google Workspace
   org that owns psc.gov.vu), fill in the app name (e.g. "SCDMS Backup")
   and support email. While the app is in "Testing" publishing status,
   only test users you explicitly add can connect — add the admin
   account(s) that will use this feature, or click "Publish App" to allow
   any Google account.
3. **APIs & Services → Credentials → Create Credentials → OAuth client
   ID**. Application type: **Web application**. Add an authorized redirect
   URI:
   `https://scdms.psc.gov.vu/api/backup/cloud/callback/`
   (swap the domain if it's ever hosted elsewhere).
4. Note the **Client ID** and **Client secret** shown after creation.

   The connection uses the `drive.file` scope — Google's most restrictive
   file-access scope, which only grants access to files this app itself
   creates. It can never see or touch anything else in the connected
   account's Drive. This scope doesn't require Google's sensitive-scope
   verification review.

## Environment variables

Add to `.env`:

```env
GOOGLE_CLIENT_ID=<Client ID from step 4>
GOOGLE_CLIENT_SECRET=<Client secret from step 4>
GOOGLE_REDIRECT_URI=https://scdms.psc.gov.vu/api/backup/cloud/callback/
BACKUP_CLOUD_ENCRYPTION_KEY=<generate once, see below>
```

Generate the encryption key once (encrypts the OAuth refresh token at rest
— a standing credential to the connected admin's real Google account, not a
static API key, so it gets real encryption rather than the plaintext
`SystemSetting` pattern used for other secrets):

```bash
docker compose exec backend python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

**Never rotate `BACKUP_CLOUD_ENCRYPTION_KEY` without first disconnecting
and reconnecting the Google account** — the stored tokens become
unreadable if the key changes, and the connection will need to be redone
anyway (it'll show as "needs reconnect" in the admin UI).

## Using it

From **Administration → Backup & Restore**, the "Cloud Backup" card:
connect, and every backup from then on pushes automatically to a "SCDMS
Backups" folder created in the connected account's Drive; disconnect any
time. When the connected admin leaves, the next admin just clicks "Connect
Google Drive" themselves and signs in with their own account — no code
change, no re-running this setup (the Google Cloud OAuth Client above is
shared infrastructure, done once regardless of who's currently connected).
