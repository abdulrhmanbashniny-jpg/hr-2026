# hr-2026

This repository holds two independent applications:

| Folder | What it is | Stack |
| --- | --- | --- |
| `/` (root) | **بوابة التوظيف** — the hiring portal (job posts, aptitude tests, interview scheduling) | Vite + React + Supabase |
| [`platform/`](platform/README.md) | **متابعة · Mutabaa** — a multi-tenant SaaS for Saudi government compliance: Muqeem, GOSI, Tamm, TGA operating/driver cards, company documents, Telegram/WhatsApp/e-mail alerts | Next.js 16 + PostgreSQL (Drizzle) |

They share no code and deploy separately. For the compliance platform, point your host's root directory at `platform/`; see [platform/README.md](platform/README.md) for setup, environment variables and deployment.
