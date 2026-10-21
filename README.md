# hr-2026

This repository holds two independent applications:

| Folder | What it is | Stack |
| --- | --- | --- |
| `/` (root) | **بوابة التوظيف** — the hiring portal (job posts, aptitude tests, interview scheduling) | Vite + React + Supabase |
| [`platform/`](platform/README.md) | **متابعة · Mutabaa** — a multi-tenant SaaS for Saudi government compliance: Muqeem, GOSI, Tamm, TGA operating/driver cards, company documents, Telegram/WhatsApp/e-mail alerts | Next.js 16 + PostgreSQL (Drizzle) |
| [`craft/`](craft/README.md) | **حِرفة · Hirfa** — the professional platform for the Saudi paint trade: verified craftsman identity and smart card, portfolios, ZATCA-verified invoice points, referrals, rewards, and an anti-fraud console | Next.js 16 + PostgreSQL (Drizzle) |

They share no code and deploy separately. Point your host's root directory at `platform/` or `craft/`; see [platform/README.md](platform/README.md) and [craft/README.md](craft/README.md) for setup, environment variables and deployment.
