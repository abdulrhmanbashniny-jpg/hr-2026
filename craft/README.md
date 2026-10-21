# حِرفة · Hirfa

منصة سعودية تمنح فني الدهان هوية مهنية موثقة: بطاقة عضوية ذكية برمز QR وشريحة NFC، ومعرض أعمال موثق بصور قبل وبعد، ونقاطاً على كل فاتورة شراء من الموردين المعتمدين تُستبدل بقسائم وقود وأدوات وخصومات وتحويلات نقدية. يتحقق العميل من الفني برقم عضويته في ثوانٍ، وتدير الإدارة الفواتير والحوافز والاحتيال من لوحة قيادة واحدة.

A Saudi platform that gives every painter a verified professional identity: a smart membership card (QR and NFC), a verified before/after portfolio, and points on every paint purchase from partner dealers, redeemable for fuel vouchers, tools, dealer discounts and cash. Clients verify a craftsman by member number in seconds; staff run invoices, incentives and fraud control from one console. Arabic-first (RTL) with full English, light and dark themes, installable as a PWA.

The full design — data schema, API contracts, anti-fraud, PDPL, milestones — is in **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

---

## What it does

| Area | Highlights |
| --- | --- |
| **Identity & card** | Phone OTP sign-up. A 6-digit member number with a **Damm check digit**, so a mistyped number is caught in the browser and a referral can never be credited to the wrong person. A 3D parallax card (pointer and gyroscope) with a contextual QR (profile link for clients, invite link for colleagues), Google Wallet pass, vCard, **write-to-NFC** from Chrome on Android, and an offline copy of the card. |
| **Public profile** `/c/{code}` | Tier, verification badges, trades, availability, an explainable 0–100 **trust score**, a **live verification seal** (ticking Riyadh clock, so a screenshot can't pass as live), portfolio with **before/after sliders**, colours used, and a **paint estimator** that sends the client's litres and buckets to the craftsman on WhatsApp. Phone numbers never appear in page HTML; WhatsApp and call go through a tracked redirect that counts the lead. Edge-cached and tagged for instant invalidation. |
| **Universal search** | Type a member number in the search bar — or anywhere on a public page — and the profile opens. Validation is local first. |
| **Portfolio** | Up to 5 photos or videos per project. Photos are re-encoded in the browser (WebP, 4K max, 720 px thumbnail, ~1 KB blur placeholder); videos get a poster frame. Uploads go **directly to S3/R2 with presigned PUTs bound to type, size and SHA-256**; magic bytes are checked again on the server. Staff can mark projects as field-verified. |
| **Invoices** | Scan with the camera (live QR detection with BarcodeDetector, jsQR fallback) or pick a photo. The server decodes the **ZATCA QR (TLV)**, verifies **Phase 2 ECDSA signatures** against the dealer's known device keys, has **Claude read the photo** as a second witness, scores risk with explainable reasons, rejects duplicates platform-wide, and auto-approves only clean, signed invoices. The rest goes to the review queue. |
| **Points & rewards** | Append-only ledger with idempotency keys and `balance_after`; wallets locked per posting; `CHECK (balance >= 0)`. Tier multipliers, city/region campaigns (highest multiplier wins, bonuses add up), two-level referral commissions paid on real purchases, referral bonus on activation. Rewards store with a progress bar to the next reward, stock, tier locks, cash-out to a wallet number, voucher codes encrypted at rest. |
| **Referrals** | Invite link and QR, WhatsApp share, network view (level 1 and level 2), earnings. Referral risk (same device, same network, bursts, consecutive SIMs) holds suspicious referrals for review. |
| **Console** `/admin` | KPIs (including **points liability in SAR**), daily trends, density map of the Kingdom, invoice review queue with **one-click batch approval** and a detail drawer, craftsman 360° (tier, verification, adjustments, suspend, devices), verification queue, **fraud monitor** (accounts sharing a device or network, open flags, held referrals), **incentive configurator with a live points preview**, rewards and fulfilment, partner dealers, Excel/CSV exports, and points economics. Roles: reviewer, admin, super admin. Every action is audit-logged. |
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

Requirements: Node.js 20.12+ and PostgreSQL 14+.

```bash
cd craft
cp .env.example .env        # set DATABASE_URL, AUTH_SECRET and APP_ENCRYPTION_KEY (32+ characters each)
npm install
npm run db:setup            # migrations + demo seed
npm run dev                 # http://localhost:3000
```

Sign in with a phone number. With `SMS_DRIVER=console` the code is printed in the server log and, outside production, shown on the sign-in screen.

| Demo account | Phone |
| --- | --- |
| Super admin | `0500000001` (or `SEED_ADMIN_PHONE`) |
| Reviewer | `0500000002` |
| Craftsman (tier A, Riyadh, member **839218**) | `0500000010` |

The seed creates 34 craftsmen across the Kingdom, a referral tree, illustrated portfolios, ~75 invoices approved through the real pipeline (so ledgers, commissions and campaigns are consistent), leads, reward requests, a referral ring for the fraud console and pending verification documents. All brands and dealers are fictional. Rebuild it with `npm run db:seed -- --reset`.

**Try the invoice pipeline end to end:** `npx tsx scripts/demo-invoice.ts 1897.50 --svg qr.svg` issues a Phase 2 signed QR from a seeded dealer. Open `qr.svg` on a screen and scan it from **Scan invoice** on your phone — it is verified, auto-approved and paid (with the Riyadh campaign, a tier A craftsman earns 4,125 points for 1,897.50 SAR). Scanning it again is rejected as a duplicate.

### Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` · `npm test` | TypeScript · Vitest (57 tests: codes, phone/ID/VAT, ZATCA TLV and secp256k1 signatures, incentives, fraud scoring, trust score, estimator, sniffing) |
| `npm run db:generate` · `db:migrate` · `db:seed` · `db:setup` | Drizzle migrations and the demo seed |
| `npm run vapid` | Print a VAPID key pair for Web Push |
| `npm run demo:invoice -- 1897.50 --svg qr.svg` | Issue a signed demo ZATCA QR from a seeded dealer |
| `npm run assets` | Re-render icons, OG image and seed scenes (needs Playwright) |
| `npm run map` | Rebuild the Kingdom outline from Natural Earth |

## Deploy

**Vercel + managed PostgreSQL (Supabase, Neon, RDS) + Cloudflare R2:**

1. Import the repository with the root directory set to `craft`. `vercel-build` applies migrations on every deploy and seeds when `SEED_ON_BUILD=true`.
2. Set `DATABASE_URL` (a pooled connection string), `DATABASE_SSL=true`, `AUTH_SECRET`, `APP_ENCRYPTION_KEY`, `CRON_SECRET`, and `STORAGE_DRIVER=s3` with the `S3_*` variables (R2: `S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com`, `S3_REGION=auto`; allow `PUT` from your domain in the bucket's CORS). Optionally `MEDIA_PUBLIC_BASE_URL` for a CDN in front of public media.
3. SMS: `SMS_DRIVER=unifonic` (`UNIFONIC_APP_SID`, `UNIFONIC_SENDER_ID`) or `twilio`.
4. Invoice reading: `ANTHROPIC_API_KEY` (model in `INVOICE_AI_MODEL`, default `claude-opus-5-5`). Without it, the QR path and human review still work.
5. Web Push: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`. Google Wallet: `GOOGLE_WALLET_ISSUER_ID`, `GOOGLE_WALLET_SA_EMAIL`, `GOOGLE_WALLET_SA_PRIVATE_KEY`.
6. `vercel.json` pins functions to `fra1` and runs `/api/cron/sweep` daily.

`STORAGE_DRIVER=database` keeps files in PostgreSQL — fine for a demo, not for production volumes. Serverless disks are ephemeral, so `local` is for development only.

## Security & data protection

Phone OTP with HMAC-stored codes, attempt limits and per-number/per-IP rate limits in the database; revocable server-side sessions behind an httpOnly signed cookie; role and ownership checks in every service; same-origin checks on cookie-authenticated mutations; per-request CSP nonce with `strict-dynamic`; IP addresses stored only as keyed hashes; national IDs and voucher codes encrypted with AES-256-GCM; invoice and identity images private (owner and staff, audit-logged); spreadsheet exports neutralise formula injection; row-level security enabled on every table. Craftsmen can download all their data and request deletion (PDPL). Details in [docs/ARCHITECTURE.md §5](docs/ARCHITECTURE.md).

## Not in this milestone

Apple Wallet passes (need a Pass Type ID certificate), Nafath identity verification, a live check of freelance licences, dealer and brand portals, HLS video, and points expiry. They are designed and scheduled in [docs/ARCHITECTURE.md §8](docs/ARCHITECTURE.md).
