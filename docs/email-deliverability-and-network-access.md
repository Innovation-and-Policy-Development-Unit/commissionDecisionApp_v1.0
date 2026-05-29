# New-user email, spam folder, browser warnings, and firewall blocks

**GoDaddy / sender admin:** use the step-by-step checklist in [godaddy-admin-email-checklist.md](./godaddy-admin-email-checklist.md).

SCDMS sends welcome emails when an administrator creates a user. Three separate issues often appear together:

| Symptom | Typical cause | Who fixes it |
|--------|----------------|--------------|
| Email in **Junk / Spam** | Missing SPF/DKIM, new domain reputation, password in body | DNS + mailbox admin |
| Browser says site is **not safe** | New domain, corporate SSL inspection, Safe Browsing | IT + time/reputation |
| **Firewall blocks** scdms.xyz | URL filtering / uncategorised domain | Ministry IT |

The application link in email is always **`https://scdms.xyz/auth/login`** (TLS certificate from Let's Encrypt).

---

## 1. Reduce junk folder (email authentication)

### SPF (required)

In GoDaddy DNS for **scdms.xyz**, ensure one SPF TXT record includes GoDaddy outbound mail:

```text
v=spf1 include:secureserver.net -all
```

See [deployment-smtp-godaddy.md](./deployment-smtp-godaddy.md).

### From address

Send from an address on your domain, e.g. `SCDMS <noreply@scdms.xyz>`, matching the SMTP mailbox. Set in `.env`:

```env
DEFAULT_FROM_EMAIL=SCDMS <noreply@scdms.xyz>
FRONTEND_URL=https://scdms.xyz
```

### DKIM (strongly recommended)

In GoDaddy **Email & Office** → domain **scdms.xyz** → enable **DKIM** and add the CNAME records GoDaddy provides. Without DKIM, many government mail gateways score mail as suspicious.

### DMARC (recommended after SPF + DKIM)

Example TXT on `_dmarc.scdms.xyz`:

```text
v=DMARC1; p=none; rua=mailto:admin@scdms.xyz
```

Move to `p=quarantine` once mail flows reliably.

### User guidance

Ask staff to **mark the first SCDMS message as “Not junk”** and add `noreply@scdms.xyz` to safe senders.

---

## 2. Browser “not safe” when clicking the link

The site uses a valid **Let's Encrypt** certificate for `scdms.xyz`. Warnings usually mean:

- **Corporate proxy / SSL inspection** — IT must trust the inspection root CA on PCs, or bypass `scdms.xyz`.
- **New domain reputation** — Safe Browsing may lag; improves after legitimate use.
- **Mixed content** — SCDMS is configured for HTTPS only; use `https://` not `http://`.

**Workaround for users:** open a browser manually and go to:

```text
https://scdms.xyz/auth/login
```

Type the address; do not use a shortened or rewritten link from an email scanner.

---

## 3. Firewall / web filter blocks scdms.xyz

Ministry networks often block **uncategorised** domains. IT must allow:

| Item | Value |
|------|--------|
| Hostname | `scdms.xyz` |
| Protocol | HTTPS |
| Port | **443** |
| Server IP (A record) | **97.74.81.249** |
| Category request | Government / business application (OPSC) |

Provide IT this summary:

> SCDMS is the Office of the Public Service Commission submission and commission decision system. Users need outbound HTTPS to `scdms.xyz` on port 443. Email originates from `noreply@scdms.xyz` via GoDaddy SMTP.

Optional: request categorisation in your vendor (Fortinet, Zscaler, etc.) as **Government** or **Business**.

---

## 4. Verify from the server

```bash
# TLS certificate
echo | openssl s_client -connect scdms.xyz:443 -servername scdms.xyz 2>/dev/null | openssl x509 -noout -subject -dates

# App responds
curl -I https://scdms.xyz/auth/login

# Test email
cd /opt/scdms/app
docker compose exec backend python manage.py send_smtp_test user@your-ministry.gov.vu
```

In Django shell, confirm link base URL:

```bash
docker compose exec backend python manage.py shell -c \
  "from tracker.email_templates import get_frontend_base_url; print(get_frontend_base_url())"
```

Must print `https://scdms.xyz`.

---

## 5. After code updates

Run migrations (refreshes the welcome email template) and rebuild:

```bash
cd /opt/scdms/app
docker compose build backend web && docker compose up -d
docker compose exec backend python manage.py migrate
```

Reload Caddy if the host `Caddyfile` was updated (HSTS headers).
