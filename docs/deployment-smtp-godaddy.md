# SMTP on GoDaddy VPS (scdms.xyz)

SCDMS sends password resets and notification email via SMTP. On this server, **port 25** (`relay-hosting.secureserver.net`) is **not reachable from Docker**, so use **authenticated** GoDaddy outbound SMTP instead.

## 1. Create a mailbox

In GoDaddy:

1. **Email & Office** (or **Professional Email**) → add **noreply@scdms.xyz** (or another address on `scdms.xyz`).
2. Set a strong mailbox password (save it for step 2).

## 2. Configure the app

On the server:

```bash
cp /opt/scdms/smtp.env.example /opt/scdms/smtp.env
nano /opt/scdms/smtp.env   # set SMTP_USER and SMTP_PASSWORD
/opt/scdms/scripts/configure-smtp.sh
```

## 3. SPF (recommended)

In GoDaddy DNS for **scdms.xyz**, add or merge an **SPF** TXT record:

```text
v=spf1 include:secureserver.net -all
```

Only one SPF record per domain. If you already have SPF, merge includes instead of adding a second record.

## 4. Test

```bash
cd /opt/scdms/app
docker compose exec backend python manage.py send_smtp_test your@email.com
```

Or in the app: **Admin → System Config → Email → Send test**.

## Settings reference

| Setting | Value |
|---------|--------|
| Host | `smtpout.secureserver.net` |
| Port | `465` (SSL) or `587` (TLS: `SMTP_SSL=false`, `SMTP_TLS=true`) |
| User | Full email address, e.g. `noreply@scdms.xyz` |
| Password | Mailbox password |
| From | Must match your domain, e.g. `SCDMS <noreply@scdms.xyz>` |

## Hosting panel “SMTP relays”

The **0 / 5000 relays** counter is for GoDaddy’s **unauthenticated** relay (`relay-hosting.secureserver.net:25`). This Docker stack uses **smtpout** with login instead; relay usage may stay at 0.

## Admin UI override

You can store SMTP password only in **Admin → System Config** (not in `.env`). If Admin has a saved password, it takes precedence over `.env`.
