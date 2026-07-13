# TeleSales Command Center — Next.js + Supabase + Vercel

Bigganbaksho EdTech telesales-er COO dashboard.
**Google Sheet = source of truth → Supabase-e mirror (proti 15 min) → Next.js dashboard (Vercel).**

## Architecture

```
Google Sheets (agents likhe) ──/api/sync (Vercel cron 15min)──▶ Supabase (leads, orders)
                                                                      │
                                                          Next.js dashboard (Vercel) ◀ read (anon key)
```

## Local run

```bash
npm install
cp .env.example .env.local   # value gulo boshaও
npm run dev                  # http://localhost:3000
```

## Setup steps

1. **Supabase**: notun project → SQL Editor-e `supabase/schema.sql` run koro (leads + orders table)।
2. **Env vars** (Vercel + local): `.env.example` dekho —
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY` (secret), `LEAD_SHEET_ID`, `ORDER_SHEET_ID`, `CRON_SECRET`.
3. **First data load**: deploy-er por ekbar khulo
   `https://<app>.vercel.app/api/sync?secret=<CRON_SECRET>` → Supabase bhorti hobe.
4. Vercel cron (vercel.json) er por proti 15 min-e apnaa apni sync hobe.

## Deploy (Vercel)

1. Code GitHub repo-te push.
2. Vercel → New Project → repo import → 6-ta env var boshaও → Deploy.
3. `/api/sync?secret=...` ekbar hit → dashboard-e data ashbe.

## Notes

- Amount BDT (৳). Dashboard read-only, anon key + RLS (public select) diye.
- Sync full-refresh (delete+insert) — Google Sheet-i single source, tai agent-der workflow bhange na.
- Conversion = orders (Sheet 2) ÷ FB leads (Sheet 1), filter onujayi.
