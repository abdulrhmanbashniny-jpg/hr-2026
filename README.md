# hr-2026

This repository holds two independent applications:

| Folder | What it is | Stack |
| --- | --- | --- |
| `/` (root) | **بوابة التوظيف** — the hiring portal (job posts, aptitude tests, interview scheduling) | Vite + React + Supabase |
| [`platform/`](platform/README.md) | **متابعة · Mutabaa** — a multi-tenant SaaS for Saudi government compliance: Muqeem, GOSI, Tamm, TGA operating/driver cards, company documents, Telegram/WhatsApp/e-mail alerts | Next.js 16 + PostgreSQL (Drizzle) |
| [`craft/`](craft/README.md) | **منصة معلمي الدهانات · Paint Masters** — a paint factory's platform for its painters: photo member card with QR, three showcase works, client reviews, factory catalogue, ZATCA-verified invoice points, referrals, rewards and an anti-fraud console | Next.js 16 + PostgreSQL (Drizzle) |

They share no code and deploy separately. Point your host's root directory at `platform/` or `craft/`; see [platform/README.md](platform/README.md) and [craft/README.md](craft/README.md) for setup, environment variables and deployment.
