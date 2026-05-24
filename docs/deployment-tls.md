# Production TLS / HTTPS

The default `docker compose up` stack serves **HTTP only** on port 80 (via the `web` Nginx container). For production you **must** terminate TLS before traffic reaches users.

Choose one approach:

## Option A — External reverse proxy (recommended)

Run **Caddy**, **Nginx**, or a cloud load balancer in front of Docker. The proxy handles Let's Encrypt and forwards to the app.

| Proxy | TLS | Upstream |
|-------|-----|----------|
| Caddy | Automatic HTTPS | `http://127.0.0.1:8080` (or `WEB_PORT`) |
| Nginx on host | Certbot on host | `http://127.0.0.1:8080` |
| AWS ALB / Azure App Gateway | Managed certs | Target group → `web:80` |

**Example Caddyfile** (host install, app on `localhost:8080`):

```caddy
scdms.psc.gov.vu {
    reverse_proxy localhost:8080
}
```

Set in `.env`:

```env
DJANGO_ALLOWED_HOSTS=scdms.psc.gov.vu
CORS_ALLOWED_ORIGINS=https://scdms.psc.gov.vu
SECURE_SSL_REDIRECT=true
SESSION_COOKIE_SECURE=true
CSRF_COOKIE_SECURE=true
```

The proxy must send `X-Forwarded-Proto: https` (Caddy and Nginx do this by default). Django uses this for secure cookies and redirects.

## Option B — Certbot sidecar (Docker Compose overlay)

Use the production overlay when the public hostname points at this server:

```bash
# 1. Set domain and email in .env
DOMAIN=scdms.psc.gov.vu
CERTBOT_EMAIL=admin@psc.gov.vu

# 2. First certificate (interactive, once)
docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  -d "$DOMAIN" \
  --email "$CERTBOT_EMAIL" \
  --agree-tos --no-eff-email

# 3. Start stack with TLS
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Files:

- `docker-compose.prod.yml` — Certbot renewal sidecar + TLS volume mounts on `web`
- `frontend/nginx-docker-ssl.conf` — Nginx listens on 443 with certificates under `/etc/letsencrypt`

Renewal runs automatically in the `certbot` service (every 12 hours, renew when due).

## What we do **not** do in dev

- Do not expose PostgreSQL or Redis ports publicly.
- Do not commit `.env`, certificates, or `email_*.txt` drafts.
- Local development stays on `http://localhost:8080` without TLS.

## Verify HTTPS

```bash
curl -I https://your-domain/
```

Confirm `Strict-Transport-Security` after enabling TLS in Nginx (`nginx-docker-ssl.conf` uncomments the HSTS header).
