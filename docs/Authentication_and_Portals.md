# Fieldwise Authentication, Administrator and Farmer Portals

## Installation order

1. Install the existing database scripts `01`–`08` from `database/` in the order documented in `database/README.md` (skip existing routines/triggers only after confirming their definitions).
2. Back up an existing database. Inspect whether the five names in `10_auth_farmer_portal.sql` are unused, then run that additive migration. It does not drop objects, alter existing agricultural tables, or insert seed records.
3. Configure `backend/.env` with the MySQL settings, a random `JWT_SECRET` of at least 32 bytes, and the exact frontend `CORS_ORIGIN`.
4. Run `npm install`, then bootstrap one super administrator with `npm run bootstrap:admin` and the `BOOTSTRAP_ADMIN_NAME`, `BOOTSTRAP_ADMIN_EMAIL`, and `BOOTSTRAP_ADMIN_PASSWORD` process variables. The script only creates a super admin if one does not already exist. It hashes the password with bcrypt and clears the password variable before exit.
5. Start backend and frontend using the root README. Open `/login/admin` or `/login/farmer`.

No migration has been applied to the live database in the current environment. MySQL access was unavailable; apply and rehearse this migration on a backed-up development schema before production use.

## Session and authorization design

- Administrator and farmer authentication use distinct login endpoints and distinct cookies (`fieldwise_admin`, `fieldwise_farmer`). Cookies are `HttpOnly`, `SameSite=Strict`, scoped to `/api`, and marked `Secure` in production.
- JWTs are HMAC-SHA256 signed with `JWT_SECRET`, expire after eight hours, and carry only the subject, role/type, and farmer link when applicable. The backend rechecks account status and role on protected requests.
- Login failures use a generic error message; a per-process IP/email throttle responds with 429 after repeated failures. This in-memory limiter is not shared across multiple backend instances.
- Password hashes are produced by bcryptjs at cost 12. Passwords require 12–128 characters. Password hashes are excluded from all account listing responses.
- CORS only permits origins in `CORS_ORIGIN` (comma-separated exact origins); credentialed requests are enabled for the browser cookie session.
- Public routes are limited to health, role-specific login, session discovery, and logout. Every legacy management/CRUD/analytics route is administrator-only. `/api/admin/*` requires admin; `/api/farmer/*` requires farmer.
- Frontend route hiding is only a usability aid. Middleware/service ownership checks are the enforcement boundary.

## First administrator and account management

Create the first administrator using environment variables in a trusted PowerShell session. Do not put a real password in a command-line argument, source file, or `.env.example`:

```powershell
$env:BOOTSTRAP_ADMIN_NAME = "Fieldwise Administrator"
$env:BOOTSTRAP_ADMIN_EMAIL = "admin@example.com"
$securePassword = Read-Host "Initial administrator password (12+ characters)" -AsSecureString
$env:BOOTSTRAP_ADMIN_PASSWORD = [Net.NetworkCredential]::new("", $securePassword).Password
npm run bootstrap:admin
Remove-Item Env:BOOTSTRAP_ADMIN_NAME,Env:BOOTSTRAP_ADMIN_EMAIL,Env:BOOTSTRAP_ADMIN_PASSWORD
```

An existing administrator can create another `ADMIN` account. Only a `SUPER_ADMIN` can assign the `SUPER_ADMIN` role. A regular admin cannot modify a super-admin account. The backend serializes deactivation and prevents the final active super administrator from being deactivated. Administrators can create Farmer login accounts only for existing `Farmer_ID` values. They provide the login email and an initial password; no Farmer rows are duplicated. Farmers change their password from the portal.

## Farmer update workflow

1. The farmer session determines the account ID and Farmer_ID; neither can be supplied by the browser to choose an owner.
2. The service validates a submitted farm and optional cultivation against that Farmer_ID.
3. The repository inserts the update with `PENDING` status, inserts a history row, and notifies active administrators in one transaction.
4. Pending updates do not touch Farm or Cultivation. Rejection and clarification request only change workflow state/history/notifications.
5. Approval locks the pending update, updates the single allowed requested field (`Farm.Soil_Type`, `Cultivation.Status`, `Cultivation.Remarks`, or `Cultivation.Yield_Estimate`), writes review history and a farmer notification, then commits together. Missing targets or SQL failures roll back the whole approval.
6. A farmer response to a clarification is added to review history, returns the update to `PENDING`, and notifies administrators. Admin and farmer views read the same status and history tables.

The selected requested field/value are explicit so the service can make a controlled change to an existing column. SQL field identifiers are chosen from a fixed backend allowlist; request-supplied SQL is never executed.

## API reference

All routes are under `/api`. Browser authentication uses credentials cookies; API clients must retain and send cookies. Request bodies are JSON. Responses never include password hashes.

| Method and path | Role | Purpose |
| --- | --- | --- |
| `POST /auth/admin/login` | Public | Administrator email/password login. |
| `POST /auth/farmer/login` | Public | Farmer email/password login. |
| `GET /auth/me` | Public/optional | Returns the active session user or `null`. |
| `POST /auth/logout` | Public | Clears both role cookies. |
| `GET /admin/dashboard` | Admin | Update counts, recent updates, and advisories. |
| `GET /admin/farmers?search=` | Admin | Farmer list, account status, and farm totals. |
| `GET /admin/farmers/:id` | Admin | Farmer profile, farms/locations, and cultivation history. |
| `POST /admin/farmers`, `PUT /admin/farmers/:id` | Admin | Create/update farmer records through the existing business service. |
| `GET /admin/farms` | Admin | Farm details, location, farmer, and cultivation counts. |
| `GET /admin/admins`, `POST /admin/admins`, `PATCH /admin/admins/:id/status` | Admin | List, create, activate, or deactivate permitted administrator accounts. |
| `GET /admin/farmer-accounts`, `POST /admin/farmer-accounts`, `PATCH /admin/farmer-accounts/:id/status` | Admin | Manage logins linked to existing Farmer rows. |
| `GET /admin/updates?status=`, `GET /admin/updates/:id` | Admin | List updates and inspect review history. |
| `POST /admin/updates/:id/review` | Admin | Body `{ decision, comment }`, where decision is `APPROVED`, `REJECTED`, or `CLARIFICATION_REQUESTED`. |
| `GET /admin/notifications`, `PATCH /admin/notifications/:id/read` | Admin | Own notification inbox. |
| `GET /farmer/dashboard`, `/farmer/me` | Farmer | Authenticated farmer's profile and dashboard data. |
| `GET /farmer/farms`, `GET /farmer/cultivations` | Farmer | Only the signed-in farmer's farms/cultivations. |
| `GET /farmer/updates`, `GET /farmer/updates/:id` | Farmer | Own submissions and review history only. |
| `POST /farmer/updates` | Farmer | Submit an update for one of the farmer's farms. Does not accept Farmer_ID. |
| `POST /farmer/updates/:id/respond` | Farmer | Body `{ response }`; only own clarification-requested updates are accepted. |
| `GET /farmer/notifications`, `PATCH /farmer/notifications/:id/read` | Farmer | Own notification inbox. |
| `PUT /farmer/password` | Farmer | Body `{ currentPassword, newPassword }`. |

All legacy app CRUD, dashboard, reports, procedure/function, audit, and Database Operations endpoints now require an administrator cookie. Health remains public for connectivity diagnostics.

## Testing boundaries

`npm test` currently runs 17 tests. They cover JWT signing/tamper/expiration, bcrypt hashing, password policy, role authorization, missing-session denial, valid/invalid administrator and farmer login behavior with mocked repositories, password-hashed administrator creation, role escalation denial, farmer ownership filters, review/notification SQL issued through a fake transaction executor, rejection behavior, rollback on an invalid approval target, and the final-active-super-admin safeguard using a fake connection. These are unit-level or repository-executor tests, not live MySQL integration tests. Database integration (including migration 10, stored accounts, notification persistence, real approval commits/rollbacks, and concurrent super-admin deactivation) has not been executed in this environment because the MySQL connection is unavailable. Do not describe those paths as live-verified until run against a development database.
