# MEGA cloud backup push

Backups (`scdms_backup_<timestamp>.zip`: `data.json` plus every file under
`MEDIA_ROOT`) can be copied automatically to a MEGA account, from both the
"Run Backup Now" button and the scheduled backup. It sits beside the Google
Drive option (see `deployment-google-drive-backup.md`); both can be connected.
Nothing is required to keep using local-only backups.

## One-time setup

1. Create a **dedicated MEGA account** for backups (do not use a personal one).
   Leave two-factor authentication **off**: the `megatools` client cannot do the
   second step. Use a long random password.
2. `.env` needs `BACKUP_CLOUD_ENCRYPTION_KEY` (the same key the Google Drive
   option uses). Generate it once:
   ```bash
   docker compose exec backend python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
   ```
   Do not change it afterwards without disconnecting and reconnecting MEGA, or the
   stored password becomes unreadable.
3. Deploy an image that contains `megatools` (added to `backend/Dockerfile`).

## Using it

**Administration, Backup & Restore, "Cloud Backup — MEGA":** enter the account's
email and password and press Connect. The server logs in once to check them, then
stores the password **encrypted**; it is never shown again. Every backup after
that is copied to a "SCDMS Backups" folder in the account. Disconnect any time;
files already in MEGA stay there.

- If MEGA later rejects the password, the card shows "needs reconnect": disconnect
  and connect again.
- A network failure is retried with backoff, and a catch-up runs daily at noon for
  anything still unsynced.
- The retention window (Backup settings, default 30 days) is mirrored in MEGA, but
  only files named `scdms_backup_YYYYMMDD_HHMMSS.zip` or `.json` are ever deleted.
- Deleting a backup in SCDMS also deletes its MEGA copy.

## How it works and its limits

- Upload and delete use the `megatools` command line. The password is given to it in
  a private (0600) temporary config file that is deleted straight after, never on
  the command line.
- The upload runs in the backend and Celery worker containers, so both need the new
  image.
- MEGA end-to-end encrypts what is stored. Whoever holds the MEGA account's password
  can read the backups, so guard it like a database password.
- Restoring is manual: download the zip from MEGA and use the existing restore.
