# منصة معلمي الدهانات · Paint Masters

منصة يديرها مصنع دهانات سعودي لتسويق معلمي الدهان وتسويق منتجات المصنع: بطاقة عضوية ذكية تحمل صورة المعلم واسمه ورقم عضويته وفئته ورمز QR يفتح ملفه، وثلاثة أعمال يعرضها كل معلم بالصور أو الفيديو، وآراء عملاء موثقة، ونقاط على كل فاتورة شراء من منتجات المصنع تُستبدل بقسائم وقود وأدوات وخصومات وتحويلات نقدية. يتحقق العميل من المعلم برقم عضويته في ثوانٍ، وتدير الإدارة الأعضاء والفواتير والحوافز والمنتجات والاحتيال من لوحة واحدة.

A platform run by a Saudi paint factory that markets its painters and its products: an ID-style membership card with the painter's photo, name, member number, tier and a QR that opens their profile; three showcase works (photo or video) per painter; moderated client reviews; and points on every purchase of the factory's paints, redeemable for fuel vouchers, tools, dealer discounts and cash. Clients verify a craftsman by member number in seconds; staff run invoices, incentives and fraud control from one console. Arabic-first (RTL) with full English, light and dark themes, installable as a PWA.

The full design — data schema, API contracts, anti-fraud, PDPL, milestones — is in **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

---

## What it does

| Area | Highlights |
| --- | --- |
| **Design** | Built to the client's own design system (Stitch: navy and amber, IBM Plex Sans Arabic + Space Grotesk, the roller logo). |
| **Identity & card** | Sign-up card on the home page (name, mobile, role, city, district, colleague's code) confirmed by a one-time code. The craftsman adds, changes or removes the **card photo** (square crop in the browser); staff can remove an unsuitable photo, with the reason audited. The card can be **downloaded as a PNG**. A 6-digit member number with a **Damm check digit**, so a mistyped number is caught in the browser and a referral can never be credited to the wrong person. A 3D parallax card (pointer and gyroscope) with a contextual QR (profile link for clients, invite link for colleagues), Google Wallet pass, vCard, **write-to-NFC** from Chrome on Android, and an offline copy of the card. |
| **Public profile** `/c/{code}` | Tier, verification badges, trades, availability, an explainable 0–100 **trust score**, a **live verification seal** (ticking Riyadh clock, so a screenshot can't pass as live), portfolio with **before/after sliders**, colours used, and a **paint estimator** that sends the client's litres and buckets to the craftsman on WhatsApp. Phone numbers never appear in page HTML; WhatsApp and call go through a tracked redirect that counts the lead. Edge-cached and tagged for instant invalidation. |
| **Universal search** | Type a member number in the search bar — or anywhere on a public page — and the profile opens. Validation is local first. |
| **Portfolio** | **Three works per craftsman**, each one photo or video plus an optional "before" photo for the slider, tagged with the factory products used. Photos are re-encoded in the browser (WebP, 4K max, 720 px thumbnail, ~1 KB blur placeholder); videos get a poster frame. Uploads go **directly to S3/R2 with presigned PUTs bound to type, size and SHA-256**; magic bytes are checked again on the server. Staff can mark projects as field-verified. |
| **Invoices** | Scan with the camera (live QR detection with BarcodeDetector, jsQR fallback) or pick a photo. The server decodes the **ZATCA QR (TLV)**, verifies **Phase 2 ECDSA signatures** against the dealer's known device keys, has **Claude read the photo** as a second witness, scores risk with explainable reasons, rejects duplicates platform-wide, and auto-approves only clean, signed invoices whose photo confirms the total and date. The rest goes to the review queue. |
| **Points & rewards** | Append-only ledger with idempotency keys and `balance_after`; wallets locked per posting; `CHECK (balance >= 0)`. Tier multipliers, city/region campaigns (highest multiplier wins, bonuses add up), two-level referral commissions paid on real purchases, referral bonus on activation. Rewards store with a progress bar to the next reward, stock, tier locks, cash-out to a wallet number, voucher codes encrypted at rest. |
| **Referrals** | Invite link and QR, WhatsApp share, network view (level 1 and level 2), earnings. Referral risk (same device, same network, bursts, consecutive SIMs) holds suspicious referrals for review. |
| **Console** `/admin` | KPIs (including **points liability in SAR**), daily trends, density map of the Kingdom, invoice review queue with **one-click batch approval** and a detail drawer, craftsman 360° (tier, verification, adjustments, suspend, devices), verification queue, **fraud monitor** (accounts sharing a device or network, open flags, held referrals), **incentive configurator with a live points preview**, rewards and fulfilment, partner dealers, Excel/CSV exports, and points economics. Roles: reviewer, admin, super admin. Every action is audit-logged. |
| **Factory & reviews** | The factory's product catalogue (console-managed, with photos, coverage and pack sizes) on the home page and on each work; factory identity in the footer. Client reviews from the public profile, published after moderation, marked when the client contacted the craftsman through the platform. |
| **Engagement** | In-app notifications and **Web Push** (VAPID) for approvals, commissions, referral events, rewards and tier changes. PWA manifest and service worker. |

## Stack

Next.js 16 (App Router, route handlers, server actions, `proxy.ts`, `after()`), React 19, TypeScript, PostgreSQL with Drizzle ORM, Tailwind CSS 4 with custom tokens, `motion` (spring 300/25), TanStack Query v5, Lucide icons (stroke 1.75), IBM Plex Sans Arabic + IBM Plex Mono via `next/font`, Zod, jose, `@anthropic-ai/sdk`, AWS S3 client (works with Cloudflare R2), web-push, qrcode, jsQR, ExcelJS, Vitest.

```
craft/
├─ docs/ARCHITECTURE.md        blueprint: schema, API contracts, anti-fraud, PDPL, milestones
├─ drizzle/                    SQL migrations
├─ public/                     icons, OG image, service worker
├─ scripts/                    asset and map builders, demo invoice generator, seed media
├─ src/
│  ├─ app/                     public site, /c/[code], /login, /join, /app (craftsman), /admin (console), /api/v1
│  ├─ components/              ui/, card/, profile/, app/, admin/, public/
│  ├─ db/                      schema, client, migrate, seed
│  └─ lib/                     codes (Damm), zatca (QR + signatures), incentives, fraud, invoices (pipeline, AI),
│                              points (ledger), rewards, referrals, craftsmen, storage, uploads, auth, i18n, geo
└─ tests/                      Vitest suites for the domain core
```

## Run it locally

Requirements: Node.js 22 and PostgreSQL 14+.

```bash
cd craft
cp .env.example .env        # set DATABASE_URL, AUTH_SECRET and APP_ENCRYPTION_KEY (32+ characters each)
npm install
npm run db:setup            # migrations + demo seed
npm run dev                 # http://localhost:3000
```

Sign in with a phone number and password. The demo accounts have no password yet, so sign them in with an SMS code: with `SMS_DRIVER=console` it is printed in the server log and, outside production, shown on the sign-in screen (choose **Sign in with an SMS code instead**). Set a password afterwards from the key icon next to **Sign out**.

| Demo account | Phone |
| --- | --- |
| Super admin | `0500000001` (or `SEED_ADMIN_PHONE`) |
| Reviewer | `0500000002` |
| Craftsman (tier A, Riyadh, member **839218**) | `0500000010` |

The seed creates 34 craftsmen across the Kingdom, a referral tree, illustrated portfolios, ~75 invoices approved through the real pipeline (so ledgers, commissions and campaigns are consistent), leads, reward requests, a referral ring for the fraud console and pending verification documents. All brands and dealers are fictional. Rebuild it with `npm run db:seed -- --reset`.

**Try the invoice pipeline end to end:** `npx tsx scripts/demo-invoice.ts 1897.50 --svg qr.svg` issues a Phase 2 signed QR from a seeded dealer. Open `qr.svg` on a screen and scan it from **Scan invoice** on your phone — the signature is verified and, when `ANTHROPIC_API_KEY` is set and the photo confirms the total and date, it is auto-approved and paid (with the Riyadh campaign, a tier A craftsman earns 4,125 points for 1,897.50 SAR); without an AI key it waits in the console's review queue. Scanning it again is rejected as a duplicate.

### Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` · `npm test` | TypeScript · Vitest (57 tests: codes, phone/ID/VAT, ZATCA TLV and secp256k1 signatures, incentives, fraud scoring, trust score, estimator, sniffing) |
| `npm run db:generate` · `db:migrate` · `db:seed` · `db:setup` | Drizzle migrations and the demo seed |
| `LAUNCH_ADMIN_PHONE=05… npm run db:launch -- --confirm` | Go live: empty all demo and user data (reference data and settings stay), create the owner's super-admin account with a one-time password. Runs once per database; the demo seed refuses a launched database. |
| `npm run vapid` | Print a VAPID key pair for Web Push |
| `npm run demo:invoice -- 1897.50 --svg qr.svg` | Issue a signed demo ZATCA QR from a seeded dealer |
| `npm run assets` | Re-render icons, OG image and seed scenes (needs Playwright) |
| `npm run map` | Rebuild the Kingdom outline from Natural Earth |

## Deploy

**Vercel + managed PostgreSQL (Supabase, Neon, RDS) + Cloudflare R2:**

1. Import the repository with the root directory set to `craft`. `vercel-build` applies migrations on every deploy and seeds the demo when `SEED_ON_BUILD=true` (never on a launched database). To go live, turn `SEED_ON_BUILD` off and run `db:launch` once against the production database.
2. Set `DATABASE_URL` (a pooled connection string), `DATABASE_SSL=true`, `AUTH_SECRET`, `APP_ENCRYPTION_KEY`, `CRON_SECRET`, and `STORAGE_DRIVER=s3` with the `S3_*` variables (R2: `S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com`, `S3_REGION=auto`; allow `PUT` from your domain in the bucket's CORS). Optionally `MEDIA_PUBLIC_BASE_URL` for a CDN in front of public media.
3. Sign-in works with phone and password and needs no provider; staff issue one-time passwords for forgotten ones from the craftsman's page in the console. SMS codes are an optional second way in: `SMS_DRIVER=unifonic` (`UNIFONIC_APP_SID`, `UNIFONIC_SENDER_ID`) or `twilio`. Keep `ALLOW_DEV_OTP` unset in production; with it, the code is shown on screen to whoever types a number.
4. Invoice reading: `ANTHROPIC_API_KEY` (model in `INVOICE_AI_MODEL`). Without it, the QR path and human review still work.
5. Web Push: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`. Google Wallet: `GOOGLE_WALLET_ISSUER_ID`, `GOOGLE_WALLET_SA_EMAIL`, `GOOGLE_WALLET_SA_PRIVATE_KEY`.
6. `vercel.json` pins functions to `fra1` and runs `/api/cron/sweep` daily.

`STORAGE_DRIVER=database` keeps files in PostgreSQL — fine for a demo, not for production volumes. Serverless disks are ephemeral, so `local` is for development only.

## Security & data protection

Phone and password (scrypt, per-number and per-network guess limits, the same answer for unknown numbers and wrong passwords, one-time passwords from staff that must be replaced at the next sign-in) and optional SMS codes with HMAC-stored codes, attempt limits and per-number/per-IP rate limits in the database; revocable server-side sessions behind an httpOnly signed cookie; role and ownership checks in every service; same-origin checks on cookie-authenticated mutations; per-request CSP nonce with `strict-dynamic`; IP addresses stored only as keyed hashes; national IDs and voucher codes encrypted with AES-256-GCM; invoice and identity images private (owner and staff, audit-logged); spreadsheet exports neutralise formula injection; row-level security enabled on every table. Craftsmen can download all their data and request deletion (PDPL). Details in [docs/ARCHITECTURE.md §5](docs/ARCHITECTURE.md).

## Not in this milestone

Apple Wallet passes (need a Pass Type ID certificate), Nafath identity verification, a live check of freelance licences, dealer and brand portals, HLS video, and points expiry. They are designed and scheduled in [docs/ARCHITECTURE.md §8](docs/ARCHITECTURE.md).
