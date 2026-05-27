# Email with Resend

SCDMS can send notification and template emails through [Resend](https://resend.com) instead of SMTP.

## Setup

1. Create an API key at [resend.com/api-keys](https://resend.com/api-keys).
2. Add to `.env` (never commit the real key):

```bash
RESEND_API_KEY=re_your_key_here
DEFAULT_FROM_EMAIL=onboarding@resend.dev
```

For testing, Resend allows `onboarding@resend.dev` as the sender. For production, [verify your domain](https://resend.com/docs/dashboard/domains/introduction) and set:

```bash
DEFAULT_FROM_EMAIL=PSC Tracker <noreply@yourdomain.gov.vu>
```

3. Install dependencies and restart the API:

```bash
pip install -r backend/requirements.txt
docker compose build backend && docker compose up -d backend worker beat
```

When `RESEND_API_KEY` is set, `EMAIL_BACKEND` defaults to `tracker.resend_backend.ResendEmailBackend`. All existing `send_mail` / notification dispatch paths use Resend automatically.

To keep using SMTP instead, omit `RESEND_API_KEY` or set:

```bash
EMAIL_BACKEND=tracker.email_backend.DynamicEmailBackend
```

## Test

**Admin UI:** System Config → send test email (uses Resend when configured).

**CLI:**

```bash
cd backend
export RESEND_API_KEY=re_your_key_here
export DEFAULT_FROM_EMAIL=onboarding@resend.dev
python manage.py send_resend_test you@example.com
```

**Python (same as Resend docs):**

```python
import os
import resend

resend.api_key = os.environ["RESEND_API_KEY"]

resend.Emails.send({
    "from": os.environ.get("DEFAULT_FROM_EMAIL", "onboarding@resend.dev"),
    "to": ["you@example.com"],
    "subject": "Hello World",
    "html": "<p>Congrats on sending your <strong>first email</strong>!</p>",
})
```

## Render / Docker

Add `RESEND_API_KEY` and `DEFAULT_FROM_EMAIL` to the API service environment on Render (or in `docker-compose` / `.env` for the `backend`, `worker`, and `beat` services so scheduled email dispatch uses Resend).

## Security

Store the API key only in environment variables or your secrets manager. If a key was shared in chat or committed by mistake, revoke it in the Resend dashboard and create a new one.
