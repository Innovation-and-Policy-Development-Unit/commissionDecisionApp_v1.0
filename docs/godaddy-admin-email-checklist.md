# GoDaddy admin checklist — SCDMS email (scdms.xyz)

Use this if you manage **GoDaddy DNS**, **Email & Office**, and the **sender mailbox** for SCDMS.

---

## Critical finding: server must send via GoDaddy SMTP

SCDMS on the VPS must **not** use `mailpit` (development only). Real mail uses GoDaddy **smtpout**.

### Step A — Mailbox (Email & Office)

1. GoDaddy → **Email & Office** → **scdms.xyz**.
2. Create or confirm mailbox: **`noreply@scdms.xyz`** (or the address you use as sender).
3. Set a strong password; you will enter it in Step B.

### Step B — Connect SCDMS to GoDaddy SMTP (on the VPS)

SSH to the server:

```bash
cp /opt/scdms/smtp.env.example /opt/scdms/smtp.env
nano /opt/scdms/smtp.env
```

Set:

```env
SMTP_HOST=smtpout.secureserver.net
SMTP_PORT=465
SMTP_SSL=true
SMTP_TLS=false
SMTP_USER=noreply@scdms.xyz
SMTP_PASSWORD=<mailbox password>
DEFAULT_FROM_EMAIL=SCDMS <noreply@scdms.xyz>
```

Apply and restart:

```bash
/opt/scdms/scripts/configure-smtp.sh
cd /opt/scdms/app && docker compose up -d backend celery-worker
```

Verify (must **not** show `mailpit`):

```bash
cd /opt/scdms/app
docker compose exec backend python manage.py shell -c \
  "from tracker.email_backend import resolve_smtp_config as r; c=r(); print(c['host'], c['port'], c['username'])"
```

Expected: `smtpout.secureserver.net 465 noreply@scdms.xyz`

Send test:

```bash
docker compose exec backend python manage.py send_smtp_test your@email.com
```

Or **Administration → System Config → Email → Send test email**.

**Alternative:** enter the same SMTP values in **Administration → System Config → Email** and save **SMTP password** there (overrides `.env` when password is set).

---

## Step C — DNS: SPF (currently missing on scdms.xyz)

GoDaddy → **Domain** → **scdms.xyz** → **DNS** → **Add record**:

| Type | Name | Value |
|------|------|--------|
| TXT | `@` | `v=spf1 include:secureserver.net -all` |

- Only **one** SPF TXT record per domain. If one exists, **edit** it to include `include:secureserver.net`, do not add a second SPF record.

Check (after a few minutes):

```bash
dig TXT scdms.xyz +short
```

---

## Step D — DKIM (Email & Office)

1. GoDaddy → **Email & Office** → **scdms.xyz** → **Authenticate** / **DKIM** (wording varies).
2. Turn **DKIM on** for the domain.
3. GoDaddy shows **CNAME** records — add them in DNS if not added automatically.
4. Wait until status shows **Verified**.

Without DKIM, mail to government inboxes often lands in **Junk**.

---

## Step E — DMARC (you already have one — tune it)

Current record (from DNS):

```text
v=DMARC1; p=quarantine; ...
```

**`p=quarantine`** sends failing mail to spam/junk. Until SPF **and** DKIM pass, SCDMS mail will look “bad”.

1. After SPF + DKIM are verified, keep `p=quarantine` or use `p=none` briefly while testing.
2. GoDaddy → DNS → TXT on name **`_dmarc`** — for testing only you may use:

```text
v=DMARC1; p=none; rua=mailto:noreply@scdms.xyz
```

3. Once inbox delivery is stable for a week, tighten to `p=quarantine` again.

---

## Step F — “From” must match the mailbox

| Setting | Value |
|---------|--------|
| Mailbox login | `noreply@scdms.xyz` |
| `SMTP_USER` | `noreply@scdms.xyz` |
| `DEFAULT_FROM_EMAIL` | `SCDMS <noreply@scdms.xyz>` |

Mismatch (e.g. sending as `@gmail.com` through GoDaddy) increases junk scoring.

---

## Step G — Website / firewall (separate from email)

Email link: **`https://scdms.xyz/auth/login`**

- TLS certificate: valid Let's Encrypt (no GoDaddy action needed for the app cert).
- Ministry **firewalls** are not fixed in GoDaddy — each ministry IT must allow **HTTPS to scdms.xyz:443** (IP **97.74.81.249**).
- Browser “not safe” on ministry PCs: often **their** web filter or SSL inspection, not GoDaddy DNS.

---

## Quick checklist

| # | Task | Done |
|---|------|------|
| 1 | Mailbox `noreply@scdms.xyz` exists | ☐ |
| 2 | `smtp.env` + `configure-smtp.sh` → `smtpout.secureserver.net` | ☐ |
| 3 | Test email arrives (not only in Mailpit) | ☐ |
| 4 | SPF TXT on `@` with `include:secureserver.net` | ☐ |
| 5 | DKIM enabled and verified | ☐ |
| 6 | DMARC relaxed (`p=none`) until SPF+DKIM pass | ☐ |
| 7 | New user email lands in Inbox (mark “Not junk” once) | ☐ |

---

## Related docs

- [deployment-smtp-godaddy.md](./deployment-smtp-godaddy.md) — SMTP ports and relay notes  
- [email-deliverability-and-network-access.md](./email-deliverability-and-network-access.md) — junk / browser / firewall for end users  
