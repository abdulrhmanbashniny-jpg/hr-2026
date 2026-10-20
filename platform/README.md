# متابعة · Mutabaa

منصة SaaS متعددة المستأجرين لمتابعة الامتثال الحكومي للمنشآت السعودية. تغطي المقيمين (مقيم)، والتأمينات الاجتماعية (GOSI)، والأسطول (تم)، وبطاقات التشغيل والسائقين (لوجستي)، ومستندات الشركة العامة. تُرسل التنبيهات داخل المنصة وعبر التليجرام والواتساب والبريد.

A multi-tenant SaaS for Saudi companies' government compliance: residents (Muqeem), GOSI, fleet (Tamm), TGA operating and driver cards (Logisti), and the company's own licences. Alerts go out in-app and over Telegram, WhatsApp and e-mail. The interface is Arabic-first and right-to-left, with full English, and has light and dark themes.

---

## What it does

| Area | Highlights |
| --- | --- |
| **Five government templates** | Upload the Excel exactly as exported. The parser finds the header row, normalises Arabic headers (hamza, ta marbuta, extra spaces), drops GOSI's blank merged columns and filler rows, ignores Tamm's duplicate «وضع المركبة», converts Tamm's **Hijri** dates (Umm al-Qura), maps `-` to empty, and keeps decimal driver-card numbers such as `33.00434160` intact. The template is detected automatically, and a file uploaded to the wrong template is rejected with the template it actually is. |
| **Zero file retention** | The upload is read into memory, parsed, wiped (`buffer.fill(0)`) and discarded. Nothing is written to disk or object storage. Each import records the time the original file was discarded. |
| **Smart upsert** | Rows are matched on each template's unique key. Newer expiry dates are applied and clear the old alerts. Rows with older dates are **refused** and reported, so an old export never overwrites a renewal entered by hand. Rows that mix newer and older dates apply only the newer ones. When half of the known rows are older, the whole file is flagged as stale. Records that disappeared from the latest file are flagged for archiving with a reason (sponsorship transfer, final exit, vehicle sold…). Every record can also be **added by hand** (one at a time, Hijri or Gregorian dates, duplicate keys refused), **edited in full**, **archived** with a reason (e.g. a sold vehicle; restorable) or **deleted** permanently. |
| **Rules engine** | 25 rules. They cover expiry buckets (expired, ≤30, 31–60, 61–90 days), passport-blocks-iqama-renewal, employees abroad near expiry ("exited and did not return" risk), age 60+, Saudi wage below 4,000 (Nitaqat), probation ending (90/180 days), registration, inspection, insurance and restriction status, vehicles without a user or with too many, and operating cards required only for medium/heavy transport (light pickups exempt, with a per-vehicle override). Heavy-truck drivers need a driver card and forklift drivers don't; the lists are editable. Cross-checks catch Muqeem↔GOSI gaps both ways, occupation mismatches, and vehicles held by someone abroad or with an expired iqama. |
| **360° profiles** | One screen per person (Muqeem + GOSI + vehicles in their custody + driver card + alerts) and one per vehicle (Tamm + operating card + driver presence and iqama). |
| **Analytics** | Validity matrices, nationality, occupation and gender breakdowns, Saudization, payroll and the non-contributory gap, the monthly GOSI bill (1445H new-system rates apply to eligible Saudis), end-of-service provision (Labour Law Art. 84), fleet readiness and age. |
| **Fee forecast** | Expected government payments for 30/60/90 days from real expiry dates, **per platform** (Muqeem, GOSI, Tamm, operating cards, driver cards, company documents), each with its own total, overdue count, breakdown (iqama fee + work permit, employer + employee share…) and itemised lines. GOSI is one bill per month due on the 15th, with a per-employee contribution table. Missing first issuances count as due now. Average fees are editable per company. |
| **Document hub** | Commercial registration, licences, certificates and so on. Each has an authority (addable), Hijri or Gregorian dates, per-document reminder days, a responsible person, a file or link, and a renewal status. Select documents and send them by e-mail, Telegram or WhatsApp, as attachments or as a **secure link valid for 1 hour to 30 days, or permanent** (revocable). The recipient's page shows a live countdown. Save sets as **bundles** (for example a tender bundle). |
| **Notifications** | A daily job notifies once per crossed threshold (60/30/7/4 days by default, editable), reminds weekly after expiry, and sends findings without a date once. Channels: in-app bell, Telegram (with **Renewed** / **Snooze 3 days** buttons), WhatsApp, and e-mail digest. Contacts can opt into a weekly e-mail report. |
| **Telegram bot** | Each company connects **its own bot** (token from @BotFather) under **Settings → Notification channels**; it gets its own webhook and secret and answers with that company's data only. The company chooses what the bot may do (summary, alerts, documents, Renewed/Snooze buttons) and can add a group chat for a daily digest. `/start <code>` links a responsible person (or paste their chat ID from `/chatid`), `/summary` gives the compliance summary, `/alerts` the top open alerts, `/docs` lists documents, and typing a document's name sends the file. A shared platform bot is optional. |
| **WhatsApp** | Hybrid mode creates ready `wa.me` links. Automatic mode uses the Meta WhatsApp Cloud API (with an approved template for business-initiated messages) or a webhook to a local provider. |
| **E-mail** | Each company can use its own SMTP; otherwise the platform mail server is used, configured and tested from **/admin/system** (or `SMTP_*` variables). Passwords are encrypted at rest. |
| **SaaS** | A 7-day trial at sign-up. Plans are monthly or yearly. Promo codes can be percent, fixed amount or trial extension, with validity windows, usage limits and plan restrictions. Payment goes through Moyasar checkout, or a manual bank-transfer request approved by the super admin. An expired subscription makes the workspace read-only. |
| **RBAC & audit** | Roles are owner, general manager, HR/government relations, fleet officer and viewer. Every upload, update, archive, share, payment and bot action is written to the activity log. |
| **Platform console** | `/admin` is a full control panel for the platform team. **Overview:** MRR/ARR, paid subscriptions, trials and trial-to-paid conversion, new companies and revenue collected, charts of revenue per month and sign-ups per week, the status mix, MRR by plan, trials ending soon (one-click extend), payments awaiting approval, platform data volume and live activity. **Companies:** a searchable, filterable, exportable table, and a page per company with usage, users (add, change role, remove; the last owner is protected), subscription editor (plan, cycle, status, trial and period dates), payment history, activity, internal notes, direct messages, suspend, edit and permanent delete. **Support mode:** enter a customer's workspace as yourself with owner rights; a banner marks it and every action is logged under your name. **Users:** every account with its companies, sessions and activity; edit profile, create a password-reset link, set a temporary password, end sessions, disable or enable, grant or remove platform-admin, delete (sole owners and the last admin are protected). **Communications:** announcements to all companies, trials, active, expired, chosen plans or chosen companies, as a workspace banner (dismissible, optional end date), an in-app notification and/or e-mail, with a history and delivery counts. **Platform team:** add the people who run the platform as owner, admin, support or finance; each role sees only its pages and actions, only owners manage the team, and team accounts are protected from other roles. Plus plans, promo codes, payments, a platform-wide activity log, system status and the platform mail server. |
| **Design** | Design system v2, *Liquid Glass*: translucent layered materials with backdrop blur and a specular rim over an ambient light backdrop, system typography (SF on Apple devices, Inter and IBM Plex Sans Arabic elsewhere), capsule controls, continuous corners and spring motion. Light and dark themes; it falls back to opaque surfaces for reduced transparency and respects reduced motion. Charts follow the validated dataviz palette, with hover tooltips and screen-reader tables. |

## Stack

- **Next.js 16** (App Router, Server Actions, Route Handlers, `proxy.ts`), **React 19.2**, TypeScript
- **PostgreSQL** with **Drizzle ORM** (migrations in `drizzle/`)
- **Tailwind CSS 4** for layout, plus the **Mutabaa design system v2 — Liquid Glass** (`design-system/tokens.json` → `src/styles/tokens.css`, components in `src/styles/components.css`)
- ExcelJS (in-memory parsing), jose (session JWT), bcryptjs, Zod, nodemailer, AWS SDK S3 client, lucide-react
- Vitest for tests

```
platform/
├─ design-system/tokens.json      design tokens (source of truth for colours, type, spacing, radii)
├─ drizzle/                       SQL migrations
├─ samples/                       synthetic exports in the exact government layouts (initial + a later export)
├─ scripts/                       build-tokens, generate-samples, daily job
├─ src/
│  ├─ app/                        routes: landing, auth, /app (tenant workspace), /admin, /s (share links), /api
│  ├─ components/                 UI (ui/, records/, documents/, settings/, admin/…)
│  ├─ db/                         schema, client, migrate, seed engine
│  └─ lib/
│     ├─ imports/                 template definitions, parser, diff (smart upsert), apply
│     ├─ rules/                   rules engine, classifiers, alert sync
│     ├─ analytics/               residents, GOSI/EOS, fleet readiness, fee forecast
│     ├─ notifications/           dispatcher, Telegram, bot, WhatsApp, e-mail
│     ├─ documents/               share links and delivery
│     ├─ billing/                 pricing, promo validation, Moyasar, activation
│     ├─ auth/                    sessions, guards, RBAC
│     ├─ dates/                   Umm al-Qura conversion, expiry buckets
│     └─ i18n/                    Arabic and English dictionaries
└─ tests/                         Vitest suites
```

## Getting started

Requirements: Node.js 20.12+ and PostgreSQL 14+. The CLI scripts read `.env` themselves.

```bash
cd platform
cp .env.example .env            # fill AUTH_SECRET, APP_ENCRYPTION_KEY, DATABASE_URL
npm install
npm run db:migrate              # create tables
npm run db:seed                 # plans, promo codes, authorities, super admin, demo company
npm run dev                     # http://localhost:3000
```

The seed prints the super-admin credentials (set `SEED_ADMIN_PASSWORD` to choose them). It also creates a demo company, **مصنع الأفق للصناعات**, with five users sharing the password `SEED_DEMO_PASSWORD` (default `Demo@2026pass`). There is one per role: `owner@`, `gm@`, `hr@`, `fleet@` and `viewer@demo.mutabaa.local`. Its data is relative to today, so every matrix and alert is populated. The seed also adds 14 sample subscriber companies (slugs `sample-*`) at every subscription stage with a year of payments, so the platform console's revenue and conversion views have data; delete them from **/admin/tenants** when you go live. It includes expired iqamas, passports that block renewal, employees abroad, heavy drivers without cards, vehicles without operating cards, invalid insurance, and documents about to expire with sample PDFs. Run `npm run db:seed -- --reset` to rebuild it.

To try the importer, run `npm run samples`. It writes `samples/initial/*.xlsx` and `samples/next-export/*.xlsx` (renewals, a leaver, a joiner, one row older than stored). Upload the next export to see updates, refused stale rows and missing-record detection.

### Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest (parser on generated workbooks, Hijri conversion, smart upsert, rules, pricing, GOSI/EOS, notification thresholds) |
| `npm run db:generate` | Generate a migration after editing `src/db/schema.ts` |
| `npm run db:migrate` / `db:seed` / `db:setup` | Apply migrations / seed / both |
| `npm run tokens` | Rebuild `src/styles/tokens.css` from `design-system/tokens.json` |
| `npm run samples` | Write the synthetic government exports |
| `npm run job:daily` | Run the daily job once (self-hosted cron) |

## Deployment

**Vercel + Supabase (or any managed PostgreSQL):**

1. Create the database, and use its **pooler** connection string (Supabase: *Connect → Transaction pooler*, port 6543), because Vercel functions reach the internet over IPv4 only.
2. Import the repository into Vercel with the root directory set to `platform`. Vercel runs the `vercel-build` script, which applies migrations on every deploy, seeds when `SEED_ON_BUILD=true`, then builds.
3. Set the variables: `DATABASE_URL`, `DATABASE_SSL=true`, `DATABASE_SSL_REJECT_UNAUTHORIZED=false` (Supabase), `DATABASE_POOL_MAX=5`, `AUTH_SECRET`, `APP_ENCRYPTION_KEY`, `CRON_SECRET`, `SEED_ADMIN_PASSWORD`, and `STORAGE_DRIVER=database` (or `s3`, since serverless disks are ephemeral). `APP_URL` defaults to the project's production URL.
4. `vercel.json` pins functions to Frankfurt (`fra1`, next to Supabase `eu-central-1`) and schedules `/api/cron/daily` at 05:00 UTC (08:00 Riyadh); Vercel sends `CRON_SECRET` with it.

Vercel caps request bodies at 4.5 MB, so attachments default to 4 MB there (`DOCUMENT_MAX_MB`). Government exports are far smaller.

**Self-hosted (Node/Docker/VM):** `npm run build && npm start`, plus a system cron entry such as `0 5 * * * cd /srv/mutabaa/platform && npm run job:daily`.

**Telegram:** each company creates a bot with @BotFather and pastes its token under **Settings → Notification channels**; the platform registers the webhook itself. Each responsible person links their account from **Settings → Responsible people** using their personal `/start` link. Optionally, a shared platform bot can serve companies without their own: set `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME` and `TELEGRAM_WEBHOOK_SECRET`, then **/admin/system → Register bot webhook**.

**E-mail:** set the platform mail server under **/admin/system** (for Gmail: `smtp.gmail.com`, port 465, secure, and an app password) and send a test message. Without it, password resets, team invitations and announcements are not e-mailed.

**WhatsApp:** each company chooses a mode under **Settings → Notification channels**. *Hybrid* needs no setup. *Cloud API* needs a phone-number ID, an access token and preferably an approved template, because Meta delivers business-initiated messages outside the 24-hour window only as templates. *Webhook* POSTs `{to, message, document_url}` to your provider.

**Payments:** with `MOYASAR_SECRET_KEY` set, **Pay now** creates a Moyasar invoice. The return URL and webhook re-fetch the invoice with the secret key before activating, so the request body is never trusted. Without a key, companies request bank-transfer activation and the super admin confirms it under **/admin/payments**.

## Security & privacy

- **Tenant isolation:** every tenant table carries `tenant_id`, and every query and mutation is scoped to the signed-in session's company.
- **Sessions and passwords:** sessions are random IDs in the database, referenced by an HS256-signed httpOnly cookie, and revocable. Passwords use bcrypt (cost 12). Failed sign-ins are throttled per IP and e-mail.
- **Secrets at rest:** tenant secrets (SMTP password, WhatsApp token or header) are encrypted with AES-256-GCM.
- **Share links:** random 256-bit tokens, stored as SHA-256 hashes, with expiry, revocation and an access counter. Downloads are `no-store` and `noindex`.
- **Webhooks:** the cron and Telegram webhooks use constant-time secret comparison. Payment callbacks verify with Moyasar server to server.
- **Uploads:** government files are never persisted. Document attachments are type- and size-checked and stored under random keys.

## Notes and limits

- GOSI rates and government fees are company settings with defaults. Review them when GOSI publishes its annual step under the 1445H Social Insurance Law, or when a fee changes.
- Operating-card exemption for light transport is keyword-based (model or body type) and can be overridden per vehicle. Driver-card occupations are a configurable list.
- Hijri conversion uses the ICU Umm al-Qura calendar (1300–1600 AH) and is verified against the Hijri column of Muqeem exports.
- Only `.xlsx` is accepted (the government platforms export xlsx); legacy `.xls` must be re-saved.
