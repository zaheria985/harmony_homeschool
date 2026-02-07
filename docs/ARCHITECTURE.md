# Architecture

## Directory Structure

```
harmony-homeschool/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Landing page
│   ├── api/                # API routes
│   │   └── auth/           # NextAuth endpoints
│   ├── dashboard/          # Authenticated pages
│   ├── students/           # Student management
│   ├── activities/         # Activity logging
│   └── import/             # AI import feature
├── components/             # Shared React components
│   ├── ui/                 # Base UI primitives
│   └── forms/              # Form components
├── lib/                    # Shared utilities
│   ├── db.ts               # Database connection pool
│   ├── auth.ts             # NextAuth configuration
│   └── llm.ts              # LLM provider abstraction
├── db/                     # Database layer
│   ├── schema.sql          # Table definitions
│   └── migrations/         # Incremental migrations
├── prompts/                # AI import prompt profiles
├── docs/                   # Project documentation
├── public/                 # Static assets
└── .env.example            # Environment template
```

## Key Design Decisions

### Database Access
Direct PostgreSQL queries via `pg` driver. No ORM - keeps queries explicit and
the dependency surface small. Connection pooling handled by `pg.Pool`.

### Authentication
NextAuth with a PostgreSQL adapter. Supports credentials (email/password) and
OAuth providers. Session strategy: JWT stored in HTTP-only cookies.

### LLM Abstraction
A single `lib/llm.ts` module abstracts over providers. The `LLM_PROVIDER` env
var selects the backend. All providers conform to the OpenAI chat completions
interface (Claude via its OpenAI-compatible endpoint, or custom base URLs).

### File Storage
FileRun provides a self-hosted file management backend. Attachments are uploaded
to FileRun and referenced by URL in the `attachments` table.

### Server Actions
Next.js Server Actions handle form submissions and mutations. This keeps the
API surface minimal - no separate REST or GraphQL layer needed for CRUD.

## Request Flow

```
Browser -> Next.js App Router -> Server Component / Server Action
                                        |
                                  lib/db.ts (pg.Pool)
                                        |
                                   PostgreSQL
```

## Security

- All database queries use parameterized statements (no string interpolation)
- Authentication enforced at the layout level for protected routes
- CSRF protection via NextAuth
- Environment secrets never exposed to the client bundle
