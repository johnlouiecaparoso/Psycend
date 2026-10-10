# Psycend — psychology board exam review platform

Mobile-responsive review platform for the Philippine psychology licensure exam. Mock
exams, quizzes, per-topic analytics, instructor and admin tooling.

**This is the repo with a live generative-AI integration** (`@google/genai`), which makes
it the portfolio piece for AI-integration work. It's also the only Next.js project here.

## Stack

Next.js App Router · TypeScript · Tailwind · shadcn-style primitives (Radix) · Supabase
(`@supabase/ssr`) · Google Gemini (`@google/genai`) · React Hook Form + Zod · TanStack
Table · Recharts · PapaParse

## Commands

```bash
npm run dev
npm run build
npm run start
npm run lint
npm run typecheck    # tsc --noEmit — run this before every commit
```

## Layout

```
app/
  page.tsx  layout.tsx  error.tsx  loading.tsx
  api/            route handlers — Gemini calls and server-only work live here
  admin/  instructor/  student/  dashboard/    role-scoped sections
  login/  register/  forgot-password/  profile/  settings/
  offline/        PWA offline fallback
middleware.ts     auth + role routing — read this before touching any route
components/  lib/  supabase/  scripts/
```

Root also holds many `*-from-pdf.txt` / `*-import-*.csv` files — these are question-bank
import artifacts, not application code. Leave them alone unless working on imports.

## Conventions

- Server Components by default. Add `"use client"` only where you need interactivity.
- Two Supabase clients via `@supabase/ssr` — a server client and a browser client. Use the
  right one for the context; mixing them is the most common bug here.
- Role gating happens in `middleware.ts` **and** should be enforced by RLS. Never rely on
  the middleware alone — it's UX, not security.
- Question-bank imports go through PapaParse; see `scripts/`.

## Gotchas

- **`SUPABASE_SERVICE_ROLE_KEY` and `GEMINI_API_KEY` are server-only.** They must never
  appear in a Client Component, and never be renamed to `NEXT_PUBLIC_*`. Anything
  `NEXT_PUBLIC_` prefixed ships to the browser. Leaking the service-role key bypasses
  every RLS policy in the project.
- Gemini calls belong in `app/api/` route handlers, never in client code — otherwise the
  key is exposed and the quota is anyone's to spend.
- `GEMINI_MODEL` is configurable via env; don't hardcode a model name.
- Run `npm run typecheck` before committing. `next build` will surface type errors late
  and slowly.
- `tsconfig.tsbuildinfo` is build cache — never commit it.
