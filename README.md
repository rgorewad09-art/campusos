# CampusOS

CampusOS is a modern, monochromatic administrator dashboard and Student Information System (SIS) built with the Next.js App Router, TypeScript, Tailwind CSS, and Supabase.

Designed for educational institutions, CampusOS streamlines administrative workflows including student enrollment, guardian records, secure document verification, daily attendance tracking, institutional reporting, and real-time operational analytics.

---

## Technology Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router, Server Actions, Partial Prerendering)
- **Language**: [TypeScript 5](https://www.typescriptlang.org/) (Strict Mode)
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/) (Custom Monochromatic Theme)
- **Database & Auth**: [Supabase](https://supabase.com/) (PostgreSQL 15+, Row Level Security, Supabase Auth)
- **File Storage**: Supabase Storage (Private bucket with authenticated signed URLs)
- **Icons**: [Lucide React](https://lucide.dev/)

---

## Key Features

1. **Administrator Authentication & Route Security**
   - Monochromatic sign-in interface with server-side role verification (`role = 'admin'` in `public.profiles`).
   - Server-side session validation in Next.js middleware and Server Actions; unauthorized sessions are revoked immediately.
   - Open redirect defense validating internal relative pathnames.

2. **Student Directory & Manual Enrollment**
   - Searchable student directory with PostgREST query sanitization, status filtering, and pagination.
   - Manual student enrollment workflow with database-generated codes (`STU-YYYY-XXXXX`).
   - Student profile editing and soft deletion safeguards with administrative confirmation.

3. **Detailed Student Profiles & Guardian Management**
   - Comprehensive student profile view displaying biographical details, enrollment dates, and status.
   - Guardian association workflow: link multiple guardians, designate primary contacts, and record relationships and contact info.

4. **Secure Document Management & Storage**
   - Upload documents directly to private Supabase Storage buckets.
   - Server-side binary magic-byte validation (PDF, JPEG, PNG, WebP) and strict 10 MB size enforcement.
   - Strict UUID verification on storage paths to prevent path traversal attacks.
   - Document verification workflow: Approve or Reject with mandatory administrative reasons.
   - Time-limited signed URLs (60-second expiry) for secure in-browser document preview.

5. **Daily Attendance Management**
   - Calendar-based daily attendance sheet for tracking Active students (Present, Absent, Late).
   - Batch attendance saving with database uniqueness constraints on `(student_id, attendance_date)`.
   - Per-student historical attendance rates and daily summary metrics.

6. **Institutional Reports & Formula-Safe CSV Export**
   - Student enrollment reports by status (Active, Inactive, Graduated, Suspended, Pending).
   - Date-range attendance summary reports.
   - Document verification status reports.
   - Spreadsheet formula injection protection (CWE-1236) neutralizing formula prefixes (`=`, `+`, `-`, `@`, `\t`, `\r`) even when preceded by leading whitespace.

7. **Dashboard Analytics & Activity Audit**
   - Real-time KPI metric cards (student counts, today's attendance percentages, pending document verifications).
   - Multi-day attendance trend visualization.
   - Recent system activity timeline backed by immutable server-side audit logs.

8. **Monochromatic Skeleton Loading**
   - Layout-matched animated shimmer skeletons across dashboard, tables, profiles, and reports for smooth transitions.

---

## Project Structure

```text
campusos/
├── app/
│   ├── actions/          # Server Actions (Auth, Students, Guardians, Documents, Attendance, Reports)
│   ├── assignments/      # Academic assignments (placeholder)
│   ├── attendance/       # Daily attendance sheet and recording views
│   ├── components/       # Monochromatic layout, navigation, charts, and skeletons
│   ├── documents/        # Global document verification center
│   ├── login/            # Administrator sign-in page
│   ├── reports/          # Institutional reports and CSV download center
│   ├── settings/         # Institution settings (placeholder)
│   ├── students/         # Student directory, enrollment form, and profile views
│   └── page.tsx          # Real-time dashboard view
├── scripts/
│   └── migrations/       # SQL migrations for Supabase
├── src/
│   ├── lib/              # Supabase clients (client, server, middleware), CSV utils, security helpers
│   └── types/            # TypeScript interfaces and domain schemas
├── .env.example          # Safe template for required environment variables
└── package.json          # Dependencies and npm scripts
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (version 20.x or higher recommended)
- `npm`, `pnpm`, or `yarn`
- A [Supabase](https://supabase.com/) project (free tier is sufficient)

### 1. Clone & Install Dependencies

```bash
git clone <your-repository-url>
cd campusos
npm install
```

### 2. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env.local
```

Open `.env.local` and enter your Supabase project credentials:

```ini
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-anon-publishable-key-here
```

> **Note**: Both values can be found in the Supabase Dashboard under **Project Settings > API**. Never commit `.env.local` to Git.

### 3. Database & Storage Configuration

1. In the **Supabase Dashboard**, open the **SQL Editor**.
2. Run the database migration scripts located in `scripts/migrations/` in order:
   - `001_student_documents_enhancements.sql`: Adds metadata columns, sets up the private `student-documents` Storage bucket, and configures Storage RLS policies.
   - `002_attendance_enhancements.sql`: Sets up attendance uniqueness constraints and RLS policies.
   - `003_secure_profiles_role.sql`: Attaches a `BEFORE INSERT OR UPDATE` trigger to `public.profiles` to lock down the `role` column against client-side escalation.
3. Ensure an administrator account exists in **Authentication > Users**, and verify that the corresponding row in `public.profiles` has `role = 'admin'`.

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. Unauthenticated visits to protected routes will automatically redirect to `/login`.

---

## Available Scripts

- `npm run dev`: Starts the Next.js development server with Turbopack.
- `npm run build`: Creates an optimized production build.
- `npm run start`: Starts the Next.js production server.
- `npm run typecheck`: Runs strict TypeScript type checking (`tsc --noEmit`).
- `npm run lint`: Runs ESLint over the project.

---

## Synthetic Data & Demonstration

This portfolio project is designed for evaluation using **synthetic demonstration data**:
- **Do not import real Personally Identifiable Information (PII)**, actual student records, or genuine government identification documents.
- Use synthetic student names, placeholder email addresses (`@example.com`), and test PDF/image documents when demonstrating file uploads.
- Sample CSV exports contain neutralized formula values to demonstrate security mitigations.

---

## Known Limitations

- **Single-Institution Focus**: Designed for single-campus administrative workflows; multi-tenant organization switching is not currently implemented.
- **Admin Portal**: Focuses strictly on the administrator management experience. Public self-service student/guardian portals are out of scope.
- **Academic Assignments & Settings**: The Assignments and Settings sections are currently placeholder views for future institutional module expansion.

---

## Security Mitigations Implemented

- **CWE-601 (Open Redirect)**: Validates target redirect URLs against relative origin rules.
- **CWE-89 / PostgREST Injection**: Strips AST filter control characters from user search queries before `.or()` execution.
- **CWE-22 (Path Traversal)**: Strictly validates UUID formats for student and document identifiers before constructing Storage paths.
- **CWE-209 (Information Disclosure)**: Database error messages and schema internals are masked from client responses and logged exclusively on the server.
- **CWE-1236 (CSV Injection)**: Prepends single quotes to dangerous formula operators even when preceded by leading whitespace.
