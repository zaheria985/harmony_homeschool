# Auth: Parent/Kid Roles

## Goal
- Implement authentication with two role types: `parent` and `kid`.
- Support default seed users for local/dev bootstrap:
  - parent: `admin` / `admin`
  - kid: `kid` / `kid`
- Enforce authorization so kids have read/checkoff access but cannot perform admin/edit actions.

## Non-goals
- OAuth/social login.
- Multi-tenant org support.
- Complex permissions matrix beyond parent/kid for MVP.

## Current state
- Next.js app router project with middleware present.
- Existing DB folder and likely migration flow exists.
- No finalized, enforced RBAC boundaries yet.

## Proposed design

### Data model changes
- `users` table (or extend existing auth user model) with:
  - `id`
  - `username` (unique, indexed)
  - `password_hash`
  - `role` enum/string: `parent | kid`
  - timestamps
- Optional: `is_active` boolean default true.
- Seed script inserts default local users if missing.

### API changes
- `POST /api/auth/login`:
  - input: username, password
  - output: httpOnly session cookie (or JWT cookie), user profile (id, username, role)
- `POST /api/auth/logout`
- `GET /api/auth/me` returns current session user
- Server-side helper: `requireRole("parent")`, `requireAuth()`

### UI changes
- `/login` page (username/password)
- Global auth guard behavior:
  - unauthenticated users redirected to `/login`
- Role-aware UI:
  - hide/disable admin controls for `kid`
  - parent sees full management controls

## Step-by-step implementation (checklist)

1. [ ] Add/confirm user schema with `role` and secure password hash storage; create migration.
2. [ ] Add seed script for default dev users (`admin/admin`, `kid/kid`) with idempotent logic.
3. [ ] Implement auth service utilities:
   - password verify/hash
   - session create/read/destroy
   - role guard helpers
4. [ ] Add API routes: login/logout/me with validation and secure cookie flags.
5. [ ] Implement `/login` UI and basic error handling for bad credentials.
6. [ ] Integrate middleware/server guard to protect app routes.
7. [ ] Add RBAC checks in write/admin endpoints and UI actions (kid read-only/checkoff only).
8. [ ] Add tests (unit + minimal integration) for:
   - login success/failure
   - role-restricted action forbidden for kid
   - parent action allowed
9. [ ] Add docs snippet in `DEPLOYMENT.md` or `AGENTS.md` about default credentials (dev-only warning).

## Tests
- Unit:
  - password hashing/verify
  - role guard functions
- API integration:
  - `/api/auth/login` returns session cookie
  - `/api/auth/me` reflects role
  - forbidden response for kid on parent-only route
- UI smoke:
  - login redirect flow works
  - parent vs kid visible controls differ

## Edge cases
- Duplicate usernames in seed step (must be idempotent).
- Session cookie missing/expired.
- Kid manually hitting parent endpoints (must return 403).
- Dev defaults must not be used in production.

## Rollback plan
- Revert auth middleware enforcement first (prevent lockout).
- Revert API auth routes and session checks.
- Roll back migration if schema change causes failures.
- Keep existing user data backup before migration.

## Definition of done
- Parent can log in and access management actions.
- Kid can log in and complete kid-safe actions only.
- Unauthorized or forbidden actions consistently blocked.
- Tests pass in CI/local.
