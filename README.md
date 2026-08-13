# Agent Activity Tracker — Manager Dashboard

A production-ready Next.js dashboard for the Jotform **"Agent Activity Tracker"** form.
Deploy it once, share one URL, and managers get a live, filterable view of agent
performance — no Jotform account, no Claude account, no login required.

## Architecture

```
Jotform  →  Next.js server API route (/api/jotform)  →  Dashboard (client)  →  Manager
```

- The Jotform **API key stays on the server only**. It is read from the
  `JOTFORM_API_KEY` environment variable inside `app/api/jotform/route.ts` /
  `lib/jotform.ts`, both of which run exclusively on the server (the `server-only`
  import in `lib/jotform.ts` makes this a build-time guarantee — the app will fail
  to build if that file is ever imported into client code).
- The browser only ever talks to your own `/api/jotform` route, which returns
  normalized submission data — never the API key, never a direct Jotform URL.
- Clicking **"รีเฟรชข้อมูล" (Refresh Data)** calls `/api/jotform` again, which
  fetches fresh submissions directly from Jotform server-side, recalculates every
  KPI/chart, and preserves whatever filters are currently selected.

## What's included

```
app/
  layout.tsx          Root layout (Thai locale, dark background, metadata)
  page.tsx             Renders the Dashboard client component
  globals.css          The full black/gold/cream design system (ported 1:1 from the original artifact)
  api/jotform/route.ts Server-side API route — the only place the Jotform API key is used
components/
  Dashboard.tsx        Main orchestrator: fetches data, holds filter state, renders all sections
  FilterBar.tsx         Date (วันนี้ / กำหนดเอง), Agent, Contact Channel filters
  ClosingStatusCard.tsx Closing status donut chart
  ActivityBreakdownCard.tsx  Activity type bar chart
  MoneyMapCard.tsx      My Money Map donut chart
  ChannelCard.tsx       Contact channel bar chart
  SourceCard.tsx        Lead source bar chart
  AgentTable.tsx        Agent comparison table
  PepInsightCard.tsx    PEP Insight panel for the selected agent
  ui.tsx                Shared atoms: Card, KpiCard, SectionLabel, CenterDonutLabel
lib/
  jotform.ts            Server-only Jotform API client + field normalization
  dashboard-calculations.ts  All KPI/chart/table/PEP math (pure functions, unit-testable)
  date-utils.ts          Asia/Bangkok timezone-aware date helpers
types/
  index.ts               Shared TypeScript types
```

## Design & calculations preserved

This app is a direct port of the existing dashboard artifact — nothing was
redesigned:

- Same black / gold / cream visual system, same fonts (Fraunces + Inter), same
  KPI cards, same donut charts, same bar charts, same table, same PEP Insight logic.
- Same filters: **วันนี้ / กำหนดเอง** (date), **ชื่อตัวแทน** (agent), **ช่องทางที่ใช้ติดต่อ**
  (contact channel).
- Same Asia/Bangkok (UTC+7) timezone logic: Jotform's `created_at` (UTC) is
  converted to its Asia/Bangkok calendar date before every date comparison —
  see `lib/date-utils.ts` and `lib/jotform.ts`.
- Same calculations for KPIs, closing status, activity breakdown, My Money Map,
  contact channel / lead source distribution, agent comparison, and PEP Insight —
  ported into `lib/dashboard-calculations.ts` as pure functions.

## Environment variables

Copy `.env.example` to `.env.local` for local development:

```bash
cp .env.example .env.local
```

| Variable | Required | Description |
|---|---|---|
| `JOTFORM_API_KEY` | Yes | Server-side only. Get it from Jotform: **Account Settings → API → Create New Key**. Never prefix with `NEXT_PUBLIC_` — that would expose it to the browser. |
| `JOTFORM_FORM_ID` | Yes | The numeric form ID for "Agent Activity Tracker" (visible in the form's edit URL). Defaults shown in `.env.example` point to the connected form used during development. |

**Note on timestamps:** `lib/jotform.ts` assumes Jotform's `created_at` is returned
in UTC and converts it to Asia/Bangkok. If your Jotform account's timezone setting
is already Asia/Bangkok, open `lib/jotform.ts` and set `CREATED_AT_IS_UTC = false`
so timestamps aren't shifted twice.

## Local development

```bash
npm install
cp .env.example .env.local   # then fill in your real JOTFORM_API_KEY / JOTFORM_FORM_ID
npm run dev
```

Open http://localhost:3000.

## Deploying to Vercel

1. Push this project to a GitHub (or GitLab/Bitbucket) repository.
2. Go to [vercel.com/new](https://vercel.com/new) and import that repository.
3. In the project's **Environment Variables** settings, add:
   - `JOTFORM_API_KEY` = your real Jotform API key
   - `JOTFORM_FORM_ID` = your form ID
   (Do this for the Production, Preview, and Development environments as needed.)
4. Click **Deploy**. Vercel will build and give you a URL like
   `https://your-project.vercel.app`.
5. Share that single URL with managers. They open it in a browser — no login,
   no Jotform account, no Claude account needed. The dashboard fetches live data
   through your server API route automatically on load, and any time they click
   **รีเฟรชข้อมูล**.

### Vercel CLI alternative

```bash
npm install -g vercel
vercel login
vercel            # deploy a preview
vercel --prod     # deploy to production
```

You'll be prompted to add the two environment variables during setup if they
aren't already configured in the Vercel project.

## Security notes

- `JOTFORM_API_KEY` is never sent to the browser. It's read only inside
  `lib/jotform.ts`, which is marked `server-only` and is only ever imported by
  `app/api/jotform/route.ts` (a server-side route handler).
- The API route sets `Cache-Control: no-store` and Next's `dynamic = "force-dynamic"`
  so submissions are always fetched fresh — never a stale cached response.
- If `JOTFORM_API_KEY` or `JOTFORM_FORM_ID` are missing, the API route returns a
  clear error (visible in the dashboard's error banner) instead of crashing silently.

## Field mapping

`lib/jotform.ts` maps Jotform's raw answers to dashboard fields by matching each
question's **localized question text** against keywords (e.g. "ชื่อลูกค้า",
"ชื่อตัวแทน", "กิจกรรมหลัก") rather than hardcoded question IDs. This means the
mapping keeps working even if questions are reordered inside the Jotform form
builder. If you rename a question's text substantially, update the corresponding
keyword in `FIELD_KEYWORDS` in `lib/jotform.ts`.

## No mock data

Every number on this dashboard comes from a real Jotform submission fetched at
request time through `/api/jotform`. There is no seeded, sample, or placeholder
data anywhere in this project.
