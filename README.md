# Psycend

Psycend is a modern, mobile-responsive psychology board exam review platform built with Next.js App Router, TypeScript, Tailwind CSS, shadcn-style UI primitives, Supabase, React Hook Form, Zod, Recharts, and TanStack Table.

## Included

- Role-based experience for `admin`, `instructor`, and `student`
- Auth pages for login, registration, and password reset
- Instructor upload workflow with CSV/Excel parsing, validation, preview, and import summary
- Student mock exam and flashcard review flows
- Admin, instructor, and student dashboards with analytics widgets
- Supabase schema with RLS policies and profile bootstrap trigger
- Sample CSV file that matches the required import format

## Project structure

```text
app/
  admin/
  dashboard/
  forgot-password/
  instructor/
    question-bank/
    upload/
  login/
  register/
  student/
    flashcards/
    mock-exams/[id]/
    results/[id]/
components/
  auth/
  charts/
  csv-import/
  exam/
  flashcards/
  tables/
  ui/
lib/
  csv/
  supabase/
  validations/
public/samples/
supabase/schema.sql
```

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy environment variables:

```bash
cp .env.example .env.local
```

3. Add your Supabase keys to `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

4. Create the database schema in Supabase SQL editor with [`supabase/schema.sql`](./supabase/schema.sql).

5. Start the app:

```bash
npm run dev
```

## Required CSV format

The import system expects these exact columns:

```text
Question
Choice 1
Choice 2
Choice 3
Choice 4
Correct Answer (1-4)
Explanation
Difficulty
Subject
Topic
```

Example:

```csv
Question,Choice 1,Choice 2,Choice 3,Choice 4,Correct Answer (1-4),Explanation,Difficulty,Subject,Topic
What is the primary focus of psychology?,Behavior,Mental processes,Both A and B,None of the above,3,Psychology studies both behavior and mental processes.,easy,General Psychology,Introduction
```

## Import behavior

- Supports `.csv`, `.xlsx`, and `.xls`
- Validates required question text and all four choices
- Converts `Correct Answer (1-4)` into `A/B/C/D`
- Accepts only `easy`, `medium`, or `hard`
- Requires non-empty `Subject` and `Topic`
- Rejects invalid rows and records them in `upload_errors`
- Produces a summary with total, success, and failed rows

## Vercel deployment

1. Push the latest code to GitHub.
2. Import the repository into Vercel.
3. In Vercel project settings, add these environment variables for `Production`, `Preview`, and `Development`:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

4. In Supabase SQL Editor, run these files before the first production login:
   - [`supabase/schema.sql`](./supabase/schema.sql)
   - [`supabase/secure_roles.sql`](./supabase/secure_roles.sql)
   - [`supabase/review_materials.sql`](./supabase/review_materials.sql)
5. Redeploy the project in Vercel after saving the environment variables.

Important:
- `SUPABASE_SERVICE_ROLE_KEY` must only be set in server environments like Vercel, never exposed in the browser.
- New public registrations are student-only. Create admin/instructor accounts from Supabase or your protected admin workflow.
- Uploaded mock exams create separate exam batches, so a later CSV upload does not merge into an older exam automatically.

## Production notes

- Active dashboards, mock exams, quiz mode, flashcards, results, and reviewer PDFs use live Supabase data.
- Flashcards are generated from uploaded question-bank data; they are not imported separately.
- If a student leaves an exam mid-session, progress resumes on the same device/browser through local autosave.
- Register one fresh student account after deployment and verify it can see existing and future uploads.
