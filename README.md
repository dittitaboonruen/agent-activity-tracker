Agent Activity Tracker — Manager Dashboard
A production-ready Next.js dashboard for the Jotform "Agent Activity Tracker" form.
Deploy it once, share one URL, and managers get a live, filterable view of agent
performance — no Jotform account, no Claude account, no login required.
Architecture
```
Jotform  →  Next.js server API route (/api/jotform)  →  Dashboard (client)  →  Manager
```
The Jotform API key stays on the server only. It is read from the
`JOTFORM_API_KEY` environment variable inside `app/api/jotform/route.ts` /
`lib/jotform.ts`, both of which run exclusively on the server (the `server-only`
import in `lib/jotform.ts` makes this a build-time guarantee — the app will fail
to build if that file is ever imported into client code).
The browser only ever talks to your own `/api/jotform` route, which returns
normalized submission data — never the API key, never a direct Jotform URL.
Clicking "รีเฟรชข้อมูล" (Refresh Data) calls `/api/jotform` again, which
fetches fresh submissions directly from Jotform server-side, recalculates every
KPI/chart, and preserves whatever filters are currently selected.
What's included
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
Design & calculations preserved
This app is a direct port of the existing dashboard artifact — nothing was
redesigned:
Same black / gold / cream visual system, same fonts (Fraunces + Inter), same
KPI cards, same donut charts, same bar charts, same table, same PEP Insight logic.
Same filters: วันนี้ / กำหนดเอง (date), ชื่อตัวแทน (agent), ช่องทางที่ใช้ติดต่อ
(contact channel).
Same Asia/Bangkok (UTC+7) timezone logic: Jotform's `created_at` (UTC) is
converted to its Asia/Bangkok calendar date before every date comparison —
see `lib/date-utils.ts` and `lib/jotform.ts`.
Same calculations for KPIs, closing status, activity breakdown, My Money Map,
contact channel / lead source distribution, agent comparison, and PEP Insight —
ported into `lib/dashboard-calculations.ts` as pure functions.
Environment variables
Copy `.env.example` to `.env.local` for local development:
```bash
cp .env.example .env.local
```
Variable	Required	Description
`JOTFORM_API_KEY`	Yes	Server-side only. Get it from Jotform: Account Settings → API → Create New Key. Never prefix with `NEXT_PUBLIC_` — that would expose it to the browser.
`JOTFORM_FORM_ID`	Yes	The numeric form ID for "Agent Activity Tracker" (visible in the form's edit URL). Defaults shown in `.env.example` point to the connected form used during development.
Note on timestamps: `lib/jotform.ts` assumes Jotform's `created_at` is returned
in UTC and converts it to Asia/Bangkok. If your Jotform account's timezone setting
is already Asia/Bangkok, open `lib/jotform.ts` and set `CREATED_AT_IS_UTC = false`
so timestamps aren't shifted twice.
Security
This project has been audited and hardened for production deployment. Summary:
Secrets
`JOTFORM_API_KEY` is read only in `lib/jotform.ts` (guarded by the `server-only`
import — the build fails if this file is ever imported from client code) and used
only inside `app/api/jotform/route.ts`. It is never returned in any API response,
never logged, and never included in any error message sent to the browser.
No secret is hardcoded anywhere in the codebase — grep for `JOTFORM_API_KEY` and
you'll only find `process.env.JOTFORM_API_KEY` reads and comments.
`.env`, `.env.local`, and `.env*.local` are all gitignored. Only `.env.example`
(placeholder values) is committed.
Nothing uses the `NEXT_PUBLIC_` prefix for secrets — confirmed by repo-wide search.
Error handling
`lib/jotform.ts` never lets upstream response bodies, the constructed Jotform URL
(which contains the API key), or stack traces leave the function. Full detail is
logged server-side with `console.error` (visible in your hosting provider's function
logs only); callers only ever receive one of a small set of pre-written, generic
messages via the `JotformConfigError` / `JotformUpstreamError` types.
`app/api/jotform/route.ts` maps those typed errors to sanitized JSON responses and
a safe HTTP status — the client (and therefore the browser DevTools network tab)
never sees anything more specific than "The upstream data provider returned an
error," regardless of what actually happened upstream.
HTTP security headers (set in `next.config.mjs`, applied to every route)
`Content-Security-Policy` — restricts scripts/styles/fonts/connections to same-origin
plus the Google Fonts origins the design already depends on; `frame-ancestors 'none'`
blocks this app from being embedded in an iframe on any origin.
`X-Frame-Options: DENY` — legacy clickjacking protection alongside `frame-ancestors`.
`X-Content-Type-Options: nosniff` — stops MIME-sniffing attacks.
`Referrer-Policy: strict-origin-when-cross-origin` — limits what's leaked in the
`Referer` header on outbound navigation.
`Permissions-Policy` — disables camera/microphone/geolocation/USB/payment APIs this
app never uses.
`Strict-Transport-Security` — forces HTTPS on every future visit.
`X-Powered-By` is disabled (`poweredByHeader: false`) to avoid advertising the
framework/version.
`/api/jotform` route protections
GET only. `POST`, `PUT`, `PATCH`, `DELETE`, and `OPTIONS` are explicitly
implemented to return `405 Method Not Allowed` with a generic body, in addition to
Next.js's own default 405 behavior.
Rejects unexpected query parameters. The route accepts none; any query string
returns `400 Bad Request` instead of being silently ignored.
Rate limiting. A per-IP in-memory limiter (`lib/rate-limit.ts`) allows 30
requests/minute per client and returns `429 Too Many Requests` with a `Retry-After`
header beyond that. This is a best-effort, single-instance protection — it resets on
cold starts and isn't shared across concurrently scaled serverless instances. For
stronger guarantees at scale, pair it with Vercel's Firewall / rate-limiting rules
(configurable in the Vercel dashboard, no code required) or a shared store like
Upstash Redis / Vercel KV.
`Cache-Control: no-store` on every response — submissions are never cached at
the edge or in the browser, so Refresh Data always reflects a real re-fetch.
Client-side filter validation (`lib/validation.ts`)
Custom date range values are validated as real `YYYY-MM-DD` dates before entering
component state.
Agent/contact-channel selections are clamped to `"all"` or a value the server
actually returned — anything else is dropped. This defends against DOM tampering
and future changes that might wire filters to URL query parameters; it doesn't
change any current filter behavior since the `<select>`/`<input type="date">`
controls only ever produce valid values today.
Dependencies
`next` upgraded `14.2.5 → 14.2.35` — the latest patched release in the 14.x line,
addressing several disclosed CVEs including a middleware authorization bypass
(CVE-2025-29927), a dev-server source exposure issue, an image-optimization content
injection issue, and a Server Components denial-of-service issue. Note: Next.js
14.x no longer receives patches as of the framework's July 2026 security release
(only 15.5.x Maintenance LTS and 16.2.x Active LTS do going forward). 14.2.35 is the
most current secure release on this major version and requires no code changes, but
a planned migration to 15.x or 16.x — with proper testing — is recommended as a
follow-up beyond this security-patch pass, since the UX/behavior guarantee for this
task ruled out a major-version jump that couldn't be verified by a real build here.
`recharts` loosened to `^2.15.0` (from a pinned `2.12.7`) to allow picking up the
latest 2.x patch releases automatically. No CVEs are currently known against
`recharts` at any version; this is a routine currency update, and the 2.x line was
kept deliberately (rather than jumping to recharts 3.x) since 3.x has breaking API
changes that couldn't be verified against this dashboard's charts without a real
build/browser test.
Local development
```bash
npm install
cp .env.example .env.local   # then fill in your real JOTFORM_API_KEY / JOTFORM_FORM_ID
npm run dev
```
Open http://localhost:3000.
Deploying to Vercel
Push this project to a GitHub (or GitLab/Bitbucket) repository.
Go to vercel.com/new and import that repository.
In the project's Environment Variables settings, add:
`JOTFORM_API_KEY` = your real Jotform API key
`JOTFORM_FORM_ID` = your form ID
(Do this for the Production, Preview, and Development environments as needed.)
Click Deploy. Vercel will build and give you a URL like
`https://your-project.vercel.app`.
Share that single URL with managers. They open it in a browser — no login,
no Jotform account, no Claude account needed. The dashboard fetches live data
through your server API route automatically on load, and any time they click
รีเฟรชข้อมูล.
Vercel CLI alternative
```bash
npm install -g vercel
vercel login
vercel            # deploy a preview
vercel --prod     # deploy to production
```
You'll be prompted to add the two environment variables during setup if they
aren't already configured in the Vercel project.
Field mapping
`lib/jotform.ts` maps Jotform's raw answers to dashboard fields by matching each
question's localized question text against keywords (e.g. "ชื่อลูกค้า",
"ชื่อตัวแทน", "กิจกรรมหลัก") rather than hardcoded question IDs. This means the
mapping keeps working even if questions are reordered inside the Jotform form
builder. If you rename a question's text substantially, update the corresponding
keyword in `FIELD_KEYWORDS` in `lib/jotform.ts`.
No mock data
Every number on this dashboard comes from a real Jotform submission fetched at
request time through `/api/jotform`. There is no seeded, sample, or placeholder
data anywhere in this project.
