# Bulk Marketing Email — Backend Spec

**Owner:** Backend  
**Provider:** Resend  
**Goal:** Send a marketing email to N users (hundreds → tens of thousands) reliably, with unsubscribe support, retries, and audit logging.

---

## 1. Resend API — What to Use

### Single send (`POST /emails`)
- 1 email per request
- Rate limit: **2 req/sec** (default account)
- Use only for transactional / one-off sends.

### Batch send (`POST /emails/batch`) ← **use this**
- Up to **100 emails per request**, each fully independent (different `to`, `subject`, `html`, etc.)
- Same 2 req/sec rate limit → effectively **~200 emails/sec**
- Returns `{ data: [{id}, {id}, ...] }` — one ID per email, in order
- **Limitations:** no `attachments`, no `scheduled_at`, no `tags` per item (check current docs)
- Supports `Idempotency-Key` header → safe to retry

**Docs:** https://resend.com/docs/api-reference/emails/send-batch-emails

---

## 2. Architecture

```
┌──────────────┐    ┌─────────────┐    ┌──────────────┐    ┌──────────┐
│  Recipients  │ →  │  Chunker    │ →  │  Sender      │ →  │  Resend  │
│  (DB query)  │    │  (100/grp)  │    │  (worker)    │    │  /batch  │
└──────────────┘    └─────────────┘    └──────────────┘    └──────────┘
                                              ↓
                                       ┌──────────────┐
                                       │  send_log    │  ← audit
                                       │  (Postgres)  │
                                       └──────────────┘
```

Run as a **one-off script** or a **background job** (Celery/RQ/cron). Do NOT run inside a request handler.

---

## 3. Database Schema

```sql
-- Marketing opt-in + unsubscribe tracking
CREATE TABLE marketing_subscribers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  user_id       UUID,                          -- nullable, link to auth.users if exists
  opted_in      BOOLEAN NOT NULL DEFAULT true,
  unsub_token   TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  unsubscribed_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Hard suppressions (bounces, complaints, manual blocks)
CREATE TABLE email_suppressions (
  email      TEXT PRIMARY KEY,
  reason     TEXT NOT NULL,                    -- 'bounce' | 'complaint' | 'manual'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Per-send audit log
CREATE TABLE marketing_send_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign     TEXT NOT NULL,                  -- e.g. 'product-photoshoot-launch-2026-04'
  email        TEXT NOT NULL,
  resend_id    TEXT,                           -- nullable until success
  status       TEXT NOT NULL,                  -- 'pending' | 'sent' | 'failed' | 'skipped'
  error        TEXT,
  attempt      INT NOT NULL DEFAULT 1,
  sent_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign, email)                     -- prevents double-send per campaign
);
```

---

## 4. Send Pipeline — Step by Step

### Step 1: Build the recipient list
```sql
SELECT s.email, s.unsub_token, u.display_name
FROM marketing_subscribers s
LEFT JOIN auth.users u ON u.id = s.user_id
WHERE s.opted_in = true
  AND s.unsubscribed_at IS NULL
  AND s.email NOT IN (SELECT email FROM email_suppressions)
  AND s.email NOT IN (
    SELECT email FROM marketing_send_log
    WHERE campaign = :campaign AND status = 'sent'
  );
```
Last clause makes the job **resumable** — re-running skips already-sent emails.

### Step 2: Pre-insert `pending` rows
For each recipient, insert into `marketing_send_log` with `status='pending'`. Use `ON CONFLICT DO NOTHING` on `(campaign, email)`.

### Step 3: Chunk into batches of 100
```python
def chunks(lst, n=100):
    for i in range(0, len(lst), n):
        yield lst[i:i+n]
```

### Step 4: Render HTML per recipient
- Load template from `scripts/marketing-email/email.html`
- Replace placeholders: `{{name}}`, `{{unsub_url}}`
- `unsub_url = f"https://formanova.ai/unsubscribe?token={unsub_token}"`

### Step 5: Build batch payload
```python
batch = [
  {
    "from": "FormaNova <hello@formanova.ai>",
    "to": [r["email"]],
    "subject": "New: Create stunning product shots of your jewelry now",
    "html": rendered_html_for_r,
    "headers": {
      "List-Unsubscribe": f"<{unsub_url}>, <mailto:unsubscribe@formanova.ai>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
    "reply_to": "hello@formanova.ai",
  }
  for r in chunk
]
```

### Step 6: POST with idempotency
```python
resp = requests.post(
  "https://api.resend.com/emails/batch",
  headers={
    "Authorization": f"Bearer {RESEND_API_KEY}",
    "Content-Type": "application/json",
    "Idempotency-Key": f"{campaign}-chunk-{chunk_index}",
  },
  json=batch,
  timeout=30,
)
```

### Step 7: Handle response
- **200 OK** → parse `data[]`, update each `marketing_send_log` row to `sent` with `resend_id`.
- **429 Too Many Requests** → read `Retry-After` header, sleep, retry the same chunk.
- **5xx** → exponential backoff (1s → 2s → 4s → 8s), max 5 attempts. After max, mark chunk rows as `failed`.
- **4xx (other)** → log full body, mark as `failed`. Do **not** retry.

### Step 8: Throttle between requests
```python
time.sleep(0.6)   # stay under 2 req/sec
```

### Step 9: Final report
After all chunks: print/log totals — sent, failed, skipped.

---

## 5. Unsubscribe Endpoint

`GET /unsubscribe?token=<token>`

```python
@app.get("/unsubscribe")
def unsubscribe(token: str):
    sub = db.query(MarketingSubscriber).filter_by(unsub_token=token).first()
    if not sub:
        return HTML("Invalid link"), 404
    sub.opted_in = False
    sub.unsubscribed_at = datetime.utcnow()
    db.commit()
    return HTML("You've been unsubscribed. Sorry to see you go.")
```

`POST /unsubscribe` (for `List-Unsubscribe-Post` one-click) — same logic, returns 200.

**This endpoint MUST be public (no auth) and respond < 1s.**

---

## 6. Resend Webhooks (highly recommended)

Set up a webhook at `POST /webhooks/resend` to capture:
- `email.bounced` → insert into `email_suppressions` with `reason='bounce'`
- `email.complained` → insert with `reason='complaint'` (spam reports)
- `email.delivered` → optional, update `marketing_send_log`

Verify the webhook signature using the secret from Resend dashboard.

---

## 7. Environment & Secrets

```
RESEND_API_KEY=re_...
MARKETING_FROM="FormaNova <hello@formanova.ai>"
UNSUB_BASE_URL=https://formanova.ai/unsubscribe
```

Store in your secrets manager — never commit.

---

## 8. Pre-flight Checklist Before First Send

- [ ] Domain `formanova.ai` verified in Resend (SPF, DKIM, DMARC all green)
- [ ] `marketing_subscribers` populated with correct opt-in status
- [ ] `email_suppressions` seeded with any known bounces/complaints
- [ ] Unsubscribe endpoint live and tested (click a real link)
- [ ] Webhook endpoint live and tested
- [ ] Send a test campaign to a small internal list (5–10 emails) FIRST
- [ ] Inspect rendered email in Gmail, Outlook, Apple Mail, mobile
- [ ] Confirm `List-Unsubscribe` shows in Gmail header

---

## 9. Compliance Notes

- **CAN-SPAM (US):** physical mailing address in footer, working unsubscribe, honor within 10 business days.
- **GDPR (EU):** only send to users who explicitly opted in. Document consent timestamp + source.
- **CASL (Canada):** explicit consent required.
- Never email purchased lists.

---

## 10. Reference Implementation

The current single-send script lives at:
- `scripts/marketing-email/send.py` — single recipient, no DB
- `scripts/marketing-email/email.html` — the template

The bulk version (`send_bulk.py`) should follow this spec.
