"""Decrypt a cloud backup (.enc) back into the zip that backup_db made.

    python manage.py decrypt_backup scdms_backup_20261119_020000.zip.enc restored.zip
    python manage.py decrypt_backup in.enc out.zip --key-file /path/to/key.txt

The key is BACKUP_ENCRYPTION_KEY from the environment, or the contents of --key-file.
Then restore `out.zip` from the Backup & Restore page as usual."""
from django.core.management.base import BaseCommand, CommandError

from tracker import backup_crypto


class Command(BaseCommand):
    help = "Decrypt an SCDMS encrypted backup (.enc) into a restorable zip."

    def add_arguments(self, parser):
        parser.add_argument("source")
        parser.add_argument("destination")
        parser.add_argument("--key-file", default="", help="File holding the key (default: BACKUP_ENCRYPTION_KEY).")

    def handle(self, *args, **opts):
        key = None
        if opts["key_file"]:
            with open(opts["key_file"]) as fh:
                key = fh.read().strip()
        try:
            with open(opts["source"], "rb") as src, open(opts["destination"], "wb") as dst:
                n = backup_crypto.decrypt_stream(src, dst, key)
        except (backup_crypto.BackupDecryptionError, backup_crypto.BackupEncryptionNotConfigured) as exc:
            raise CommandError(str(exc))
        self.stdout.write(self.style.SUCCESS(f"Decrypted {n} chunk(s) to {opts['destination']}."))
