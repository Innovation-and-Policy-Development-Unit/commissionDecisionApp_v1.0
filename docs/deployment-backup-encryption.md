# Encrypted cloud backups

Every backup that is copied to a cloud account (Google Drive or MEGA) is encrypted on the
SCDMS server first, so the cloud account only ever holds ciphertext. Backups kept on the
server's own disk are not encrypted by SCDMS.

The uploaded file is named `scdms_backup_<timestamp>.zip.enc`.

## One-time setup

1. Generate a key on the server:
   ```bash
   docker compose exec backend python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
   ```
2. Put it in the server's `.env` as `BACKUP_ENCRYPTION_KEY=...`, then restart the backend and worker.
3. **Keep a second copy of the key somewhere that is not the server** (for example a password
   manager that two administrators can open). If the server is lost and the key with it, the
   cloud backups cannot be read by anyone.

If the key is missing, **nothing is uploaded** and the Backup & Restore page shows why. SCDMS
never falls back to sending a plain backup.

## Restoring from a cloud backup

1. Download the `.zip.enc` file from the cloud account.
2. Decrypt it on a machine that has the SCDMS code and the key:
   ```bash
   python manage.py decrypt_backup scdms_backup_20261119_020000.zip.enc restored.zip --key-file key.txt
   ```
   (or leave out `--key-file` to use `BACKUP_ENCRYPTION_KEY` from the environment).
3. Restore `restored.zip` from **Backup & Restore** as usual.

Decryption fails, with a message, if the key is wrong or the file has been changed, cut short or
reordered.

## Notes

- The key is separate from `BACKUP_CLOUD_ENCRYPTION_KEY`, which protects the stored cloud logins.
  Changing one does not affect the other.
- Rotating the key: new backups use the new key, but older `.enc` files need the old key, so keep
  every key that has ever been used until its backups have expired.
- Deleting a backup in SCDMS removes both the plain and the `.enc` copies from the connected cloud account.
