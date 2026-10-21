# حِرفة · Hirfa — Architecture & Technical Blueprint

> منظومة رقمية رأسية (B2B2C) لقطاع الدهانات والتشطيبات في المملكة: هوية مهنية موثقة للفني، ولاء الموزعين والمصانع عبر الفواتير، تحقق فوري للعميل، ورقابة مركزية على الاحتيال والحوافز.
>
> A vertical B2B2C platform for the Saudi paint and finishing trade: a verified professional identity for each craftsman, dealer and brand loyalty driven by real purchase invoices, instant verification for property owners and contractors, and central control of fraud and incentives.

This document is the contract the code follows. It is written in the order the brief asked for: **data schema → API contracts → security → frontend → milestones**. Sections marked **Shipped** exist in this repository; **Next** sections are designed here and scheduled in the milestones at the end.

---

## 1. System overview

```
                ┌──────────────────────────── Next.js 16 (App Router, Node runtime) ────────────────────────────┐
  Browser/PWA ──┤  proxy.ts  (CSP nonce · device cookie · optimistic auth gate)                                   │
  (RTL/LTR)     │                                                                                                  │
                │  Server Components ── services (src/lib/*) ── Drizzle ── PostgreSQL 14+                         │
                │  Route Handlers /api/v1/* ─┘        │                                                            │
                │  Server Actions (admin console) ────┘        ┌── Storage driver: database │ s3/R2 │ local       │
                │                                              ├── SMS driver: console │ Unifonic │ Twilio        │
                │  after()  → invoice pipeline (QR → AI → risk → ledger)                                            │
                │  /api/cron/sweep → stuck invoices, expired uploads/OTPs                                          │
                └──────────────────────────────────────────────────────────────────────────────────────────────────┘
                         │ Web Push (VAPID)      │ Claude vision (invoice extraction)     │ Google Wallet JWT
```

* **One deployable** (`craft/`), stateless functions, all state in PostgreSQL and object storage. It deploys to Vercel (root directory `craft`) or any Node host.
* **Services first.** Every rule lives in `src/lib/**` as plain TypeScript. Route handlers, server actions and the cron job are thin adapters, so a future native app uses the same `/api/v1` contract as the web.
* **Pure domain core.** Codes, phone numbers, ZATCA QR decoding, the incentive engine, fraud scoring, trust score and the paint estimator are pure functions with Vitest suites (`tests/`).

---

## 2. Data schema (PostgreSQL · Drizzle) — **Shipped**

Source of truth: `src/db/schema.ts`; migrations in `drizzle/`. All ids are UUID v4, all timestamps `timestamptz`, money `numeric(12,2)` in SAR, points are integers.

```
users ─1:1─ craftsmen ─1:N─ portfolio_projects ─1:N─ portfolio_media
  │            │  │  └─1:N─ invoices ─N:1─ dealers ─N:1─ brands
  │            │  ├─1:1─ wallets ─1:N─ points_ledger (append-only)
  │            │  ├─1:N─ referrals (as referrer / as referee, referee unique)
  │            │  ├─1:N─ redemptions ─N:1─ rewards
  │            │  ├─1:N─ leads
  │            │  └─1:N─ verification_documents
  ├─1:N─ sessions · push_subscriptions · notifications · device_signals
  └─1:N─ audit_log (as actor)
regions ─1:N─ cities ─< incentive_rules (scope: national │ region │ city)
otp_challenges · uploads · stored_files · rate_limit_hits · fraud_flags · app_settings
```

| Table | Purpose | Key constraints |
| --- | --- | --- |
| `users` | Anyone who signs in (phone is the identity). `role`: craftsman · reviewer · admin · super_admin. | `phone` unique (E.164). |
| `sessions` | Server-side sessions referenced by an HS256-signed httpOnly cookie. Revocable. | Stores HMAC of IP, never the raw IP. |
| `otp_challenges` | One-time codes. Only an HMAC of the code is stored; 5 attempts; 5 minutes. | Consumed once. |
| `craftsmen` | Professional identity: referral code, tier (A/B/C), city, trades, availability, identity and licence status, encrypted national ID, `referred_by_id`, `activated_at`. | `referral_code` unique; `user_id` unique. |
| `verification_documents` | National ID, freelance licence (وثيقة العمل الحر), insurance, reviewed by staff. | |
| `portfolio_projects` | A job: title, city, area, paint brand, colours used (`jsonb`), field verification, warranty. | |
| `portfolio_media` | Up to 5 per project. Image or video, role (before · after · gallery), object key, thumbnail key, poster key, LQIP, dimensions, SHA-256, capture time and GPS (optional). | `(project_id, sort_order)`; count enforced in service. |
| `brands` / `dealers` | Paint brands and the partner dealers (branches) whose invoices earn points. Dealers carry the **VAT number** (15 digits) and the **pinned ZATCA public key** of their e-invoicing unit. | `dealers.vat_number` unique. |
| `invoices` | A purchase claim. Image key + SHA-256, decoded QR (seller, VAT number, time, total, VAT, invoice hash, signature verdict), AI extraction, declared amount, risk score and reasons, points awarded and the rule snapshot used. | **`fingerprint` unique** (one real invoice can be claimed once platform-wide); `image_sha256` unique. |
| `wallets` | Cached balance per craftsman, updated in the same transaction as the ledger row. | `CHECK (balance >= 0)`. |
| `points_ledger` | Append-only journal: invoice, referral bonus, commission L1/L2, welcome bonus, redemption, refund, adjustment. Each row stores `balance_after`. | **`idempotency_key` unique**. |
| `referrals` | Referrer → referee, status (pending · activated · rejected · held), risk score. | `referee_id` unique (one referrer per person). |
| `incentive_rules` | City/region/national campaigns: multiplier and/or flat bonus, time window, target (invoice · referral signup · commission), priority. | |
| `rewards` / `redemptions` | Catalog (fuel vouchers, supplier discounts, tools, cash-out) and requests with fulfilment (encrypted voucher code, payout handle). | Stock decremented atomically. |
| `leads` | Contact intents from profiles: WhatsApp, call, vCard, estimate, profile view, with the source (QR · NFC · search · link). | Powers craftsman analytics. |
| `device_signals` | Device cookie id, HMAC(IP), HMAC(IP /24), user-agent hash, event. | Feeds clustering. |
| `fraud_flags` | Rule hits against craftsmen, invoices and referrals, with review status. | |
| `uploads` / `stored_files` | Pending signed uploads; the database storage driver's bytes. | Uploads expire after 30 minutes. |
| `push_subscriptions` / `notifications` | Web Push endpoints and the in-app inbox. | `endpoint` unique. |
| `app_settings` | Points economics (points per SAR, bonuses, commission rates, tier multipliers, thresholds). | Single row per key. |
| `audit_log` | Every staff action and every sensitive craftsman action. | |

### 2.1 Referral codes — typo-proof by construction
Codes are **6 digits: 5 random digits + one [Damm](https://en.wikipedia.org/wiki/Damm_algorithm) check digit**. Damm catches **every single-digit error and every adjacent transposition**, so a mistyped code is rejected in the browser before it reaches the server, and a referral can never be credited to the wrong person by a typo. Weak patterns (`000000`, `123456`, a single repeated digit, leading zero) are never issued. Capacity is 90,000 six-digit codes; the generator and validator are length-agnostic, so the platform moves to 7 digits (900,000) without a migration when the 6-digit space passes 80 %.

### 2.2 Points ledger — money-grade
* Every movement is one `points_ledger` row with an **idempotency key** (`invoice:<id>`, `commission:l1:<invoice>`, `redeem:<client key>`…). Replays return the original row.
* Posting locks the wallet row (`SELECT … FOR UPDATE`), writes the journal row with `balance_after`, then updates the wallet, all in one transaction; the `CHECK (balance >= 0)` constraint is the last line of defence against overspending.
* Balances can always be rebuilt from the journal (`SUM(delta)`), and the admin overview shows the **outstanding liability in SAR** (points in circulation × point value).

### 2.3 Points economics (defaults, editable in the console)
| Setting | Default |
| --- | --- |
| Points per SAR (pre-VAT invoice value) | 1 |
| Point value (for liability and cash-out) | 0.025 SAR (1,000 pts = 25 SAR) |
| Tier multipliers | A ×1.25 · B ×1.10 · C ×1.00 |
| Welcome bonus (referee, on activation) | 100 |
| Referral bonus (referrer, on referee activation) | 300 |
| Commission L1 / L2 (of the referee's base points) | 5 % / 2 % |
| Max campaign multiplier | ×3 |
| Invoice max age / max amount / daily cap | 30 days / 50,000 SAR / 5 per day |
| Auto-approve when risk ≤ / flag when risk ≥ | 20 / 60 |

**Two levels only.** Commissions stop at level 2 on purpose: deeper chains turn a loyalty programme into a pyramid scheme, which invites regulatory trouble and rewards recruiting over real purchases. Referral bonuses are paid on **activation** (identity complete + first approved invoice), never on bare sign-up, which removes the incentive to farm fake accounts.

### 2.4 Incentive engine
`resolveIncentive(rules, { target, cityId, regionCode, at })`: all active rules in their window that match the target and scope apply. The **highest multiplier wins** (capped by the max multiplier), **flat bonuses add up**, and the result lists the rule ids so every ledger row records why it paid what it paid (`rule_snapshot`). Invoice points use the purchase time on the invoice, so a Riyadh campaign rewards purchases made during the campaign.

---

## 3. Anti-fraud design — **Shipped**

### 3.1 ZATCA QR: verify the invoice, not the photo
Every B2C tax invoice in the Kingdom carries a QR code in ZATCA's Base64 **TLV** format: seller name (1), VAT number (2), timestamp (3), total with VAT (4), VAT (5), and from Phase 2 the invoice hash (6), ECDSA signature (7), public key (8) and certificate signature (9).

1. The phone camera reads the QR on the receipt (BarcodeDetector, or jsQR as fallback) while the photo is taken.
2. The server decodes the TLV, checks the VAT number format (15 digits, starts and ends with 3) and the seller against the **partner dealer registry**.
3. For Phase 2 codes it **verifies the ECDSA (secp256k1) signature over the invoice hash with the embedded public key**, and compares that key with the key **pinned** for that dealer (pinned by staff, or on first approved invoice). A forged QR cannot carry a valid signature under the dealer's key.
4. The invoice **fingerprint** (`hash(VAT number | invoice hash or timestamp | total)`) is unique platform-wide: a genuine receipt can be claimed once, by one craftsman.

### 3.2 AI extraction as a second witness
When `ANTHROPIC_API_KEY` is set, Claude reads the photo and returns structured fields (seller, VAT number, invoice number, date, total, VAT, whether it looks like a real tax invoice, signs of editing). The pipeline compares it with the QR and with the amount the craftsman typed. Without a key, the QR path alone still works and anything without a QR goes to manual review.

### 3.3 Risk scoring (0–100, explainable)
`assessInvoice()` returns a score and the reasons, each a stable code shown to reviewers in Arabic and English:

| Signal | Weight |
| --- | --- |
| Phase 2 signature invalid / key differs from the dealer's pinned key | +60 / +70 |
| No QR on the invoice | +25 |
| Seller not a partner dealer | +30 |
| AI total vs QR total differ > 2 % · declared vs detected differ > 5 % | +35 · +15 |
| Invoice older than 30 days (rejected) · dated in the future | reject · +40 |
| Amount above the cap or the dealer's typical range | +25 |
| Velocity over the daily cap · account younger than 24 h | +20 · +10 |
| Device shared with other accounts | +30 |
| AI suspects editing / not an invoice | +40 / +50 |

≤ 20 with a valid signature and a partner dealer → **auto-approved** and points posted. ≥ 60 → **flagged**. Otherwise → **manual review** in the console, where batches are approved in one click.

Referrals have their own assessment: same device as the referrer (+80), same IP /24 within 24 h (+30), more than 5 referrals in 24 h (+25), adjacent phone numbers (+15). Held referrals pay nothing until a reviewer clears them.

### 3.4 Clustering
`device_signals` record a random first-party device id (httpOnly cookie) and HMACs of the IP and its /24 prefix at sign-up, login, invoice and referral time. The console groups accounts that share a device or a prefix, so referral rings show up as clusters.

---

## 4. API contracts (`/api/v1`) — **Shipped**

Conventions:
* JSON in and out. Success: `{ "data": … }`. Error: `{ "error": { "code": "snake_case", "message": "…localised…", "details"?: … } }` with a matching HTTP status (400 validation, 401 unauthenticated, 403 forbidden, 404, 409 conflict, 422 business rule, 429 rate limited).
* Inputs validated with Zod; Arabic-Indic digits are normalised everywhere a number is typed.
* Mutations require a same-origin `Origin` header (CSRF) and the session cookie. Every public endpoint is rate limited in the database (works across instances).
* Pagination: `?cursor=<opaque>&limit=` → `{ data: { items, nextCursor } }`.

### Auth
| Method & path | Body | Result |
| --- | --- | --- |
| `POST /auth/otp` | `{ phone }` | `{ challengeId, expiresAt, resendAt, devCode? }` — 3 per 10 min per number, 10 per hour per IP. `devCode` only with the console SMS driver outside production. |
| `POST /auth/verify` | `{ challengeId, code }` | Sets the session cookie. `{ user, next }` where `next` is `/app/onboarding` for new craftsmen. |
| `POST /auth/logout` | — | Revokes the session. |
| `GET /me` | — | Current user, craftsman summary, wallet balance. |

### Craftsmen & discovery
| Method & path | Notes |
| --- | --- |
| `GET /craftsmen/{referralCode}` | Public profile. **Edge cached** (`Cache-Control: public, s-maxage=60, stale-while-revalidate=600`) and tagged `craftsman:{code}` in the Next.js data cache; invalidated on every profile change. `400 invalid_code` when the check digit fails (no DB hit). |
| `GET /craftsmen/{code}/contact?channel=whatsapp\|call&src=` | Logs a lead and redirects to `wa.me` with a pre-filled message carrying the code, or to `tel:`. Phone numbers never appear in page HTML, which stops scraping. |
| `GET /craftsmen/{code}/vcard` | `.vcf` contact card with the profile link. |
| `GET /craftsmen/{code}/qr?target=profile\|join&src=` | SVG QR for the card (profile link, or a referral sign-up link). |
| `POST /craftsmen/{code}/estimate` | Paint estimate from the public calculator; logs an `estimate` lead and returns the WhatsApp link with the estimate. |
| `POST /onboarding` | `{ displayName, cityId, trades[], yearsExperience, referralCode?, consent: true }` → creates the craftsman, wallet and referral. |
| `PATCH /me/profile` · `PATCH /me/availability` | Profile fields · `{ availability: available\|busy\|away, until? }`. |

### Referrals
| `POST /referrals/validate` | `{ code }` → `{ valid, referrer?: { displayName, city, tier } }`. Checks digit, existence, not self. |
| `GET /referrals` | Level-1 list with status, level-2 count, earnings by kind. |

### Uploads (direct, signed)
| `POST /portfolio/upload` · `POST /invoices/upload` · `POST /me/documents/upload` | `{ mime, bytes, sha256 }` → `{ uploadId, method: "PUT", url, headers }`. With S3/R2 the URL is a **presigned PUT bound to the content type, length and SHA-256 checksum** (the bucket rejects anything else). With the database or local driver the URL is `/api/v1/uploads/{uploadId}` on this server. |
| `PUT /uploads/{uploadId}` | Raw body (database/local drivers). Size, type (magic bytes) and SHA-256 are verified. |

Files are at most 5 MB, so a single PUT is used; S3 multipart only starts at 5 MiB parts and would add round-trips for nothing. Images are converted to WebP in the browser (longest side 3,840 px), with a 720 px thumbnail and a ~1 KB blurred placeholder, so the server never needs an image pipeline.

### Portfolio
| `GET/POST /portfolio/projects` · `PATCH/DELETE /portfolio/projects/{id}` | Project CRUD (owner only). |
| `POST /portfolio/projects/{id}/media` | `{ uploadId, thumbUploadId?, posterUploadId?, role, width, height, durationSec?, lqip?, capturedAt?, geo? }` — max 5 per project; type re-checked from the stored bytes. |
| `DELETE /portfolio/media/{id}` | |
| `GET /media/{key}` | Public media (portfolio, avatars). Immutable cache. With S3 it redirects to the CDN/public base URL or a short presigned GET. |

### Invoices
| `POST /invoices` | `{ uploadId, qrPayload?, declaredAmount?, fp? }` → `202 { id, status: "processing" }`. The pipeline runs in `after()`; the client polls. |
| `GET /invoices` · `GET /invoices/{id}` | Own invoices with status, points, and reasons in plain language. |
| `GET /invoices/{id}/image` | Owner and reviewers only, `no-store`. |

### Wallet & rewards
| `GET /wallet` | Balance, lifetime totals, ledger page. |
| `GET /rewards` | Catalog with affordability and progress to the next reward. |
| `POST /rewards/{id}/redeem` | `{ idempotencyKey, payoutHandle? }` → `201` redemption; points held immediately, refunded if staff reject. |
| `GET /redemptions` | |
| `GET /wallet/pass/google` | `{ saveUrl }` — Google Wallet generic pass signed with the service account (RS256). `501 not_configured` without credentials. |

### Notifications
| `POST /push/subscribe` · `DELETE /push/subscribe` | Web Push subscription (VAPID). |
| `GET /notifications` · `POST /notifications/read` | In-app inbox. |

### Admin (reviewer · admin · super_admin)
| `GET /admin/invoices?status=&minRisk=` | Review queue. |
| `POST /admin/invoices/batch` | `{ ids[], action: approve\|reject, note? }` — each approval is idempotent; returns per-id results. |
| `GET /admin/export?type=invoices\|ledger\|redemptions\|craftsmen&format=xlsx\|csv&from=&to=` | Accounting exports. |
| Console mutations (tiers, verification, incentives, rewards, dealers, settings, fraud) are server actions over the same services, all audit-logged. |

### Cron
`GET /api/cron/sweep` (Bearer `CRON_SECRET`): re-runs invoices stuck in `processing`, expires stale uploads and OTP challenges.

---

## 5. Security & data protection (Saudi PDPL) — **Shipped**

* **Identity:** phone OTP (HMAC-stored codes, 5 attempts, 5-minute expiry, per-number and per-IP limits). SMS through Unifonic or Twilio; console driver in development.
* **Sessions:** random server-side ids behind an HS256-signed, httpOnly, `SameSite=Lax`, `Secure` cookie; revocable; 30 days.
* **Authorisation:** role checks in every service (`requireRole`), ownership checks on every craftsman resource, staff actions audit-logged.
* **CSRF:** same-origin `Origin` check on all cookie-authenticated mutations; server actions get Next.js's built-in origin check.
* **CSP:** per-request nonce with `strict-dynamic`, `frame-ancestors 'none'`, HSTS, `nosniff`, strict referrer policy.
* **Data minimisation (PDPL):** no raw IP is stored (HMAC with a server key); the national ID is encrypted with AES-256-GCM and only the last 4 digits are shown; phone numbers are not rendered into public HTML; invoice images are private. Consent is recorded at onboarding with the policy version. Craftsmen can **export their data** (JSON) and **request deletion** from their profile.
* **Uploads:** size and type limits, magic-byte sniffing, SHA-256 verified, random keys, invoice images never public.
* **Database:** row-level security is switched on for every table after migrations, so roles other than the application owner (for example Supabase's public API roles) see nothing even if granted by mistake.

---

## 6. Frontend — **Shipped**

* **Stack:** Next.js 16 App Router, React 19, Tailwind CSS 4 with the Hirfa tokens, `motion` (spring physics: stiffness 300, damping 25), TanStack Query v5 for client polling and caching, Lucide icons at stroke 1.75, `next/font` (IBM Plex Sans Arabic + IBM Plex Mono with tabular numbers).
* **Arabic-first:** `dir="rtl"`, logical CSS properties throughout (so English LTR works without separate styles), full Arabic and English dictionaries.
* **Design tokens:** Navy `#102A43` (trust), Amber `#F59E0B → #FBBF24` (earnings and primary actions), canvas `#F8FAFC` / surface `#FFFFFF`, slate lines `#E2E8F0`, 8-pt spacing, glass surfaces with `backdrop-blur`. Light and dark themes.
* **Signature components:** 3D parallax membership card (pointer and gyroscope), dynamic QR (profile or join link), live verification seal (ticking Riyadh time so a screenshot cannot pass as live), before/after slider (keyboard accessible), progress-to-next-reward bar, confetti on milestones, skeleton shimmers that match the real layout, type-anywhere code lookup.
* **PWA:** manifest, service worker with an offline copy of the craftsman's card, Web Push.

### Screens
| Area | Screens |
| --- | --- |
| Public | Landing with universal search, craftsman profile `/c/{code}`, sign-in/sign-up (OTP), join via referral link. |
| Craftsman `/app` | Home (card, wallet, next reward, trust score, leads, recent activity), invoices (camera + QR scan), portfolio (projects, media, before/after), rewards marketplace, referrals network, full-screen card (NFC write, Google Wallet, vCard), profile and verification documents, notifications. |
| Console `/admin` | Overview (KPIs, liability, trends), invoice review queue with batch approval, craftsmen (tiering, verification, adjustments), fraud clusters and flags, incentive configurator with live preview, rewards and redemptions, dealers and pinned keys, KSA heatmap, reports and exports, settings. |

---

## 7. Innovation beyond the brief

1. **ZATCA QR signature verification + dealer key pinning** — anti-forgery grounded in the Kingdom's own e-invoicing system rather than OCR guesswork (§3.1).
2. **Damm check-digit referral codes** — typos never credit the wrong craftsman (§2.1).
3. **Live verification seal** — a moving, time-stamped seal on every public profile defeats screenshot impersonation.
4. **Phone-number shielding** — contact goes through tracked redirects, so profiles drive measurable leads and scrapers get nothing.
5. **Paint estimator on the profile** — a client computes litres and buckets for their walls and sends the estimate to the craftsman on WhatsApp, a warmer lead than "hello".
6. **Trust Score** — one explainable 0–100 number (tier, identity, licence, verified projects, purchase history, tenure) with "how to raise it" tips for the craftsman.
7. **Liability-aware economics** — the console shows outstanding points as SAR liability, so finance sees the programme's real cost.
8. **Write-to-NFC** — on Android Chrome the craftsman writes their profile link onto any NFC sticker or card from the app (Web NFC), no extra hardware vendor needed.

---

## 8. Milestones

| # | Scope | Status |
| --- | --- | --- |
| **M1 — Foundation** | Schema, ledger, OTP auth, onboarding with referral, public profile with cache, portfolio with signed uploads, invoice pipeline (ZATCA QR + AI + risk), rewards and redemptions, referral L1/L2, incentive engine, admin console (review queue, tiers, fraud clusters, incentives, rewards, dealers, heatmap, exports), PWA + Web Push, Google Wallet, Arabic/English, tests. | **This repository** |
| M2 — Trust & identity | Nafath (national SSO) identity verification; freelance-licence check against the Ministry of HR API; Apple Wallet pass (PKCS #7 signing with a Pass Type ID certificate); WebAuthn passkeys for staff; client reviews tied to tracked leads. | Next |
| M3 — Partners | Dealer and brand portals (their invoices, their craftsmen, co-funded campaigns), voucher code bulk import, STC Pay / urpay payouts, HLS video through Cloudflare Stream. | Next |
| M4 — Scale | Points expiry with notices, read replicas for analytics, event stream to a warehouse, native wrappers (Capacitor) reusing `/api/v1`. | Next |
