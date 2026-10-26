# DeskOS — Production Deployment & Operator Runbook

This guide contains the exact operational steps to deploy and manage DeskOS across Supabase, Meta WhatsApp Cloud API, FastAPI backend, and Next.js frontend.

---

## 1. Supabase PostgreSQL & Auth Setup

### Step 1.1: Project Creation
1. Log in to [Supabase Dashboard](https://supabase.com/dashboard) and select your project (e.g. `nypoegvzfuahemjysmmp`).
2. Navigate to **Project Settings** -> **API**:
   - Copy the **Project URL** (e.g., `https://nypoegvzfuahemjysmmp.supabase.co`).
   - Copy the `anon` public key.
   - Copy the `service_role` secret key (**DO NOT expose this key to frontend or client-side code**).
3. Navigate to **Project Settings** -> **API** -> **JWT Settings**:
   - Copy the **JWT Secret** (used by backend `auth.py` to verify auth tokens).

### Step 1.2: Execute Canonical Migrations
Because DeskOS uses PostgreSQL GiST exclusion constraints (`btree_gist`), migrations must be executed via the Supabase SQL Editor:
1. Open **Supabase Dashboard** -> **SQL Editor** -> **New query**.
2. Open [`supabase_migrations/001_canonical_schema.sql`](../supabase_migrations/001_canonical_schema.sql), copy the entire SQL script, paste it into the editor, and click **Run**.
   - *This creates*: `businesses`, `business_memberships`, `staff_resources`, `services`, `faqs`, `customers`, `conversations`, `chat_messages`, `appointments`, `message_jobs`, `analytics_events`, with GiST overlap exclusion constraints and RLS policies.
3. Open [`supabase_migrations/002_backward_compatibility_views.sql`](../supabase_migrations/002_backward_compatibility_views.sql), copy the entire SQL script, paste it into the editor, and click **Run**.
   - *This creates*: `universal_businesses`, `universal_bookings`, and legacy views ensuring seamless backward compatibility with existing dashboard queries.

---

## 2. Meta WhatsApp Cloud API Setup

### Step 2.1: Meta Developer Portal
1. Navigate to [developers.facebook.com](https://developers.facebook.com) and log in.
2. Select your Business App (or create one under **Type: Business**).
3. Under **Add products to your app**, add **WhatsApp**.
4. In WhatsApp **API Setup**:
   - Copy your **Phone number ID** (e.g., `1357841077412201`).
   - Add your test phone number to the allowed recipient list if in development.
   - Generate a System User Access Token with `whatsapp_business_messaging` and `whatsapp_business_management` permissions for production use.
5. In **App Settings** -> **Basic**:
   - Copy your **App Secret** (`META_APP_SECRET`).

### Step 2.2: Webhook Registration
1. In WhatsApp **Configuration** -> **Webhook**:
   - Click **Edit**.
   - **Callback URL**: `https://api.yourdomain.com/webhook/whatsapp` (or your ngrok URL for local dev).
   - **Verify Token**: Set a secure token matching `META_VERIFY_TOKEN` in your `.env` (e.g. `Venkat10@10`).
   - Click **Verify and Save**.
2. Under **Webhook fields**, click **Manage** and subscribe to:
   - `messages` (inbound WhatsApp text and audio notes)
   - `message_status` (delivery receipts)

---

## 3. Backend Deployment (FastAPI)

### Suitable Options:
- **Render / Railway / Fly.io / VPS (Ubuntu + systemd)**

### Environment Variables:
Set the following on your backend server:
```bash
PORT=8000
DEV_MODE="false"
ALLOWED_ORIGINS="https://app.yourdomain.com,https://your-vercel-domain.vercel.app"
GROQ_API_KEY="gsk_..."
GROQ_CHAT_MODEL="llama-3.3-70b-versatile"
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
SUPABASE_JWT_SECRET="your-jwt-secret"
META_ACCESS_TOKEN="EAAN..."
META_PHONE_NUMBER_ID="1357..."
META_APP_SECRET="..."
META_VERIFY_TOKEN="..."
```

### Production Start Command:
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

### Background Notification Worker:
DeskOS automatically runs the background notification worker inside `app.main:lifespan` to process 24h/2h reminders and booking confirmation jobs.
Alternatively, you can trigger `/api/jobs/process` via a cron job every minute:
```bash
* * * * * curl -X POST https://api.yourdomain.com/api/jobs/process
```

---

## 4. Frontend Deployment (Next.js)

### Deploy to Vercel:
1. Connect your GitHub repository to [Vercel](https://vercel.com).
2. Set the Root Directory to `frontend`.
3. Add Environment Variable:
   - `NEXT_PUBLIC_API_URL`: `https://api.yourdomain.com`
4. Click **Deploy**.

---

## 5. Rollback & Disaster Recovery Runbook

### Rollback Strategy:
If a migration needs to be rolled back:
```sql
DROP VIEW IF EXISTS public.universal_bookings;
DROP VIEW IF EXISTS public.universal_businesses;
DROP VIEW IF EXISTS public.legacy_bookings;
DROP VIEW IF EXISTS public.legacy_business_configs;
```
To drop canonical tables if restoring from backup:
```sql
DROP TABLE IF EXISTS public.analytics_events CASCADE;
DROP TABLE IF EXISTS public.message_jobs CASCADE;
DROP TABLE IF EXISTS public.appointments CASCADE;
DROP TABLE IF EXISTS public.chat_messages CASCADE;
DROP TABLE IF EXISTS public.conversations CASCADE;
DROP TABLE IF EXISTS public.customers CASCADE;
DROP TABLE IF EXISTS public.faqs CASCADE;
DROP TABLE IF EXISTS public.services CASCADE;
DROP TABLE IF EXISTS public.staff_resources CASCADE;
DROP TABLE IF EXISTS public.business_memberships CASCADE;
DROP TABLE IF EXISTS public.businesses CASCADE;
```

### Local Database Backup & Restore:
The persistent local SQLite database is stored at `backend/data/deskos.db`.
- **Backup**:
  ```bash
  sqlite3 backend/data/deskos.db ".backup 'backend/data/deskos_backup_$(date +%Y%m%d).db'"
  ```
- **Restore**:
  ```bash
  cp backend/data/deskos_backup_XXXX.db backend/data/deskos.db
  ```
