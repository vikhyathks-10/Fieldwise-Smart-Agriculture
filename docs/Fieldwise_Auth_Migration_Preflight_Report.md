# Fieldwise Authentication Migration Preflight Report

**Audit date:** 2026-11-10  
**Database:** `smartagriculturedb`  
**Migration reviewed:** `database/10_auth_farmer_portal.sql`  
**Audit mode:** Initial review was read-only. A later requested static follow-up removed two explicit TEXT defaults from the migration and updated this report. No migration execution, database connection, DDL/DML against MySQL, or application source changes were made.

## Executive assessment

**Assessment: CONDITIONAL — do not run against the existing database until the live preflight checks below succeed.** The migration text is additive and defines five new InnoDB tables. It contains no `DROP`, `TRUNCATE`, `ALTER TABLE` against an existing table, or DML statement. Therefore the migration itself contains no statement that inserts, updates, or deletes the six existing Farmer records.

In the initial audit session, a read-only connection using the project's configured pool was denied with `EACCES`; no metadata or row data was returned. The latest instruction now supplies verified environment facts (MySQL 8.0.46, `smartagriculturedb`, 15 objects, six Farmer rows, InnoDB tables, the existing summary view, and a completed backup). Those facts are incorporated in the final compatibility section as user-provided environment verification; this agent has not independently reconnected or inspected the backup file. See the final section for the updated conclusion.

The migration is idempotent only at the object-existence level: each statement uses `CREATE TABLE IF NOT EXISTS`. MySQL can silently skip an existing same-name table without comparing its columns or constraints. It does not repair schema drift, and a partial/conflicting installation can fail later at foreign-key creation or at application runtime.

## Scope and evidence labels

- **Verified from current project source:** Direct inspection of the migration and checked-in base schema scripts. The authentication/portal files described in the historical report are absent from the current project copy.
- **Reported context:** Facts stated in the request or prior project documentation; not independently confirmed against MySQL in this audit.
- **Not verified:** Live-only facts which require the configured database connection.

The requested documentation path `docs/Fieldwise_Auth_Portal_Implementation_Report.md` does not exist in the current workspace. The prior implementation report is at the project root as `Fieldwise_Auth_Portal_Implementation_Report.md`; the authentication workflow documentation is `docs/Authentication_and_Portals.md`.

## Live read-only check

Attempted `SELECT`-only reads from `information_schema` and `Farmer` through the configured MySQL pool. Connection was denied (`EACCES`). No SQL mutation was issued. Consequently, this audit could not verify:

- The current server version, schema name resolution, `lower_case_table_names`, engine, collation, SQL mode, or grants.
- Whether any of the five target names already exists as a table or view.
- The current `Farmer_ID` definition and six-row count/IDs on the live database.
- The live InnoDB status and exact types/indexes of Farmer, Farm, and Cultivation.

## Migration safety assessment

The migration starts with `USE smartagriculturedb` and contains five `CREATE TABLE IF NOT EXISTS` statements. It has no `INSERT`, `UPDATE`, `DELETE`, `DROP`, `TRUNCATE`, or `ALTER TABLE`. Creating child-side foreign keys does not rewrite parent rows. The migration does not reseed or duplicate Farmer, Farm, or Cultivation data.

The use of `ON DELETE RESTRICT` means account/update/review/notification history can prevent deletion of referenced rows after the feature has data. This is protective for record retention but is a behavior change for future deletes; account deactivation is the expected alternative. `ON UPDATE CASCADE` is present on the migration's foreign keys.

**Existing-data conclusion:** by static inspection, the migration has no operation that changes existing Farmer rows or their IDs. A live before/after checksum was not possible and is not required to infer that the migration's SQL does not perform DML against Farmer. The six-record count is unverified here.

## Table-by-table analysis

| Table | Columns and primary key | Constraints and indexes | Preflight observations |
| --- | --- | --- | --- |
| `admin_account` | `admin_id INT AUTO_INCREMENT PRIMARY KEY`; name/email/password hash; role/status enums; created/updated timestamps. | Unique `email`; `(role,status)` index. No FK. | Appropriate for multiple admins. There is no cross-table email uniqueness constraint with `farmer_account`. Bootstrap/service checks email across both tables, but that check plus insert is not atomic across tables; concurrent account creation could reuse an email across roles. |
| `farmer_account` | `account_id INT AUTO_INCREMENT PRIMARY KEY`; `farmer_id INT NOT NULL`; email/password hash/status; timestamps. | Unique `farmer_id`, unique `email`, status index; FK to `farmer(Farmer_ID)` with update cascade/delete restrict. | One account per Farmer row. The supplied base DDL defines `Farmer_ID int NOT NULL PRIMARY KEY`, matching signed `INT` structurally. The live definition and InnoDB engine were not verified. |
| `farmer_update` | `update_id BIGINT AUTO_INCREMENT PRIMARY KEY`; account/farmer/farm IDs; nullable cultivation ID; category, observed date, narrative/proposed fields; status and timestamps. | Four FKs: account, Farmer, Farm, nullable Cultivation; status/submission, farmer/submission, farm, and cultivation indexes. | The independent FKs prove that each referenced row exists but do **not** prove that `account_id` belongs to the same `farmer_id` or that `farm_id` belongs to that `farmer_id`. Current application code derives the account and Farmer_ID from the session and verifies farm/cultivation ownership. The relational schema alone does not enforce that association if another database writer bypasses the application. |
| `update_review` | `review_id BIGINT AUTO_INCREMENT PRIMARY KEY`; update ID; nullable admin ID; actor type/decision/comment/time. | FKs to `farmer_update` and `admin_account`; update/time and admin indexes; check requires `admin_id` for ADMIN and NULL for FARMER. | Correctly supports farmer submission/clarification history and admin decisions. CHECK enforcement requires MySQL 8.0.16 or newer. |
| `notification` | `notification_id BIGINT AUTO_INCREMENT PRIMARY KEY`; recipient type, nullable admin/account recipient IDs, title/message/read flag/time. | FKs to admin and farmer account; recipient indexes; CHECK requires exactly the recipient ID corresponding to recipient type. | Intended admin/farmer recipient shape is represented. The CHECK also requires MySQL 8.0.16 or newer to be enforced. |

The migration defines **5 primary keys, 9 foreign keys, 3 unique keys, 2 CHECK constraints, and 10 explicit secondary indexes** (several FK child indexes also cover the FK columns). No existing table is altered.

## Foreign-key validation

The migration's nine references are:

1. `farmer_account.farmer_id` → `farmer.Farmer_ID`.
2. `farmer_update.account_id` → `farmer_account.account_id`.
3. `farmer_update.farmer_id` → `farmer.Farmer_ID`.
4. `farmer_update.farm_id` → `farm.Farm_ID`.
5. `farmer_update.cultivation_id` → `cultivation.Cultivation_ID` (nullable).
6. `update_review.update_id` → `farmer_update.update_id`.
7. `update_review.admin_id` → `admin_account.admin_id` (nullable for farmer-authored history).
8. `notification.admin_id` → `admin_account.admin_id` (nullable for farmer notifications).
9. `notification.account_id` → `farmer_account.account_id` (nullable for admin notifications).

The base schema scripts in this workspace create lower-case `farmer`, `farm`, and `cultivation` tables with signed `INT` primary keys, `ENGINE=InnoDB`; the migration references those lower-case names and uses matching `INT` child columns. This is a **source-to-source compatibility check only**. The existing database must still be checked for actual type/sign, indexed parent key, storage engine, partitioning, and table-name case behavior. MySQL requires matching integer size/sign and supported engines for FK creation; it also needs usable indexes on referenced and referencing columns. See the [MySQL 8.0 foreign-key requirements](https://dev.mysql.com/doc/refman/8.0/en/create-table-foreign-keys.html).

`farmer_account.farmer_id` uses a unique key and the parent Farmer_ID is a primary key in the supplied base DDL. On live metadata, confirm the exact referenced column, signedness, InnoDB engine, and that foreign-key checks are enabled. No FK prevents `farmer_update.account_id` and `farmer_update.farmer_id` from disagreeing; consider a composite relationship in a separately reviewed schema change if database-level consistency must hold for non-application writers.

## MySQL 8.0 compatibility

- `CREATE TABLE IF NOT EXISTS`, InnoDB, enums, `AUTO_INCREMENT`, timestamp defaults, `utf8mb4`, and `utf8mb4_0900_ai_ci` are MySQL 8-compatible syntax.
- **Minimum recommended version: MySQL 8.0.16.** Earlier MySQL 8.0 versions did not enforce CHECK constraints; MySQL documents CHECK support/enforcement beginning with 8.0.16. See [MySQL CHECK constraint documentation](https://dev.mysql.com/doc/refman/8.0/en/create-table-check-constraints.html).
- `farmer_update.progress_details` and `update_review.review_comment` are nullable `TEXT` columns without explicit defaults. Nullable columns retain their implicit NULL default. See [MySQL 8.0 default-value rules](https://dev.mysql.com/doc/refman/8.0/en/data-type-defaults.html).
- Parent key matching and engine/index requirements remain deployment-specific and unverified because the live server was unreachable.
- Do not assume MariaDB compatibility from this MySQL 8.0 assessment.

## Idempotency and potential migration errors

| Condition | Expected result / risk |
| --- | --- |
| All five names are unused and referenced base tables/keys exist | The five tables should be created in dependency order. This is a static expectation, not an executed migration. |
| Migration rerun after a complete matching creation | `IF NOT EXISTS` skips each existing table. It does not compare or repair the definition. |
| A target name already exists as a differently-defined table | MySQL may skip it with a warning; a later FK can fail or the app can fail against the mismatched shape. Inspect `SHOW CREATE TABLE` and compare every column/constraint before proceeding. |
| A target name exists as a view or other conflicting object | `CREATE TABLE IF NOT EXISTS` may error; stop and resolve the name collision through a reviewed plan. |
| Parent FK column has a different integer sign/size, lacks an appropriate key/index, parent engine is not InnoDB, or table is unsupported partitioned InnoDB | Foreign-key table creation can fail (commonly FK definition/errno 150 class). |
| Same constraint symbol already exists in schema due to a partial/manual prior install | MySQL can reject a duplicate FK symbol. Check `TABLE_CONSTRAINTS`/`KEY_COLUMN_USAGE` and `SHOW CREATE TABLE`. |
| Server is below 8.0.16 | Migration may parse CHECK syntax without enforcing those rules; reject as incompatible for this design. |
| Older MySQL TEXT default behavior | The two nullable TEXT columns now have no explicit default clause, avoiding the version-dependent TEXT DEFAULT syntax. |
| Execution stops partway through | Earlier CREATE statements can remain. DDL statements are not wrapped as one all-or-nothing migration. Inspect current objects before retrying; do not drop them blindly. |

## Security findings from prior implementation workspace (not current-project evidence)

### Historical source findings

The following code-level details came from the prior implementation workspace. The corresponding auth/bootstrap/middleware files are absent from the current Fieldwise project inspected for this update; do not treat these bullets as verification of the current copy.

- `scripts/bootstrap-admin.mjs` requires process values for `BOOTSTRAP_ADMIN_NAME`, `BOOTSTRAP_ADMIN_EMAIL`, and `BOOTSTRAP_ADMIN_PASSWORD`, delegates hashing/validation to `authService`, and deletes its process password variable in `finally`. Bootstrap uses a named MySQL advisory lock, checks for an existing `SUPER_ADMIN`, and inserts a bcrypt hash—not the raw password. It prints an account ID but no password.
- `authService.js` hashes new admin/farmer passwords with bcryptjs (cost 12); login compares bcrypt hashes. Account responses omit `password_hash`.
- `JWT_SECRET` is required at runtime to be at least 32 bytes. Tokens use HMAC-SHA256, an issuer, expiry (eight hours by default), and accepted role types. Sessions re-read account status/role from the database on protected requests.
- Cookies are role-specific, `HttpOnly`, `SameSite=Strict`, scoped to `/api`, and use `Secure` when `NODE_ENV=production`. CORS is an explicit allowlist with credential support. Login has an in-process IP/email throttle.
- `/api/admin/*` is behind admin authentication; `/api/farmer/*` is behind farmer authentication. Legacy app/database routes are admin-protected. Login and health/session/logout endpoints are public as designed.
- Farmer reads use authenticated Farmer_ID/account ID predicates. Update submission ignores browser-supplied owner IDs and checks selected farm/cultivation ownership before inserting.
- No password or JWT secret was read or included in this report. `.env.example` contains placeholders only.

### Limitations / risks

- The login throttle is per process, so it does not coordinate across multiple backend instances.
- Application checks global email uniqueness across admin and farmer tables, while the schema only enforces uniqueness separately per table. Concurrent creation can race; consider a single identity table or a transactional serialization strategy if cross-role uniqueness is mandatory.
- The database does not tie `farmer_update.account_id` to the same `farmer_id` nor tie `farm_id` to that Farmer_ID via a composite FK. Application ownership checks currently enforce the relationship, but direct SQL writers could create mismatches.
- The configured database name must be exactly `smartagriculturedb` on case-sensitive hosts. `backend/.env.example` uses that lowercase name; the code fallback in `pool.js` is `SmartAgricultureDB`. Do not rely on that fallback for a case-sensitive server.
- The historical UI/source has mixed-case references such as `Farmer` while installation SQL creates lower-case `farmer`. Confirm `@@lower_case_table_names` and actual table naming for the intended OS/server; this is broader existing-app compatibility, not a rename performed by migration 10.

## Approval transaction and update safety (prior-workspace claims not present in current project)

An earlier version of this report described a transaction-based approval workflow in `farmerPortalRepository`. That repository is not present in the current Fieldwise project. No `farmer_update` application workflow or approval transaction was found in the current copy, so transaction commit/rollback behavior cannot be confirmed for this project.

The current-project ownership and route findings are documented in the final “Current Fieldwise project review and requested SQL correction” section. No live MySQL test was performed.

## Farmer data-isolation findings (current project)

Farmer data isolation cannot be confirmed in the current project. The inspected backend has no auth middleware/account repository or farmer portal service, and its generic CRUD routes have no authenticated farmer principal. The existing reference validator checks record existence but does not assert ownership. See the final project review below.

## Required environment variables for the prior authentication implementation

These were documented for the prior auth implementation. The current project copy has no auth/bootstrap implementation or `.env.example`; do not infer that the JWT/bootstrap settings are configured in this copy. No actual environment file or secret was inspected.

Read from `backend/.env` by `backend/database/config/env.js` (do not print/share the actual file):

| Variable | Requirement |
| --- | --- |
| `DB_HOST` | MySQL host; commonly `localhost`. |
| `DB_PORT` | MySQL port; commonly `3306`. |
| `DB_USER` | Account with connection and CREATE privileges for the five new tables; required parent-table REFERENCES privileges must also be available. |
| `DB_PASSWORD` | Private credential for that account; never put in commands/source/report. |
| `DB_NAME` | Must resolve to the existing `smartagriculturedb` schema, with exact case on case-sensitive systems. |
| `JWT_SECRET` | At least 32 bytes of private random secret. |
| `CORS_ORIGIN` | Exact frontend origin(s), comma-separated if needed. |
| `PORT` | Optional; backend defaults to 4000. |

One-time bootstrap additionally needs `BOOTSTRAP_ADMIN_NAME`, `BOOTSTRAP_ADMIN_EMAIL`, and `BOOTSTRAP_ADMIN_PASSWORD` in the current trusted process environment. Use a hidden/secure password prompt; do not put a password in a command literal. Bootstrap must happen only after the migration succeeds.

## Blockers recorded during the initial audit (status superseded below)

1. **Initial session could not connect:** The database connection returned `EACCES`; the latest user-provided environment verification supersedes this as an environment fact, but is not an agent-run connection test.
2. **Target-name conflicts were not independently queried:** Compare all five names against current live metadata before execution. The known base schema object list does not use these names, but live metadata was not returned in the initial audit.
3. **Server compatibility and InnoDB parent status:** Supplied as verified in the latest instruction; still not independently queried by this audit.
4. **Backup:** Supplied as successfully created at `backups/smartagriculturedb_pre_auth_20261110.sql`; the file itself was not opened or restore-tested by this audit.
5. **Owner association is application-only (design risk):** Decide whether to accept application-enforced consistency or revise the schema in a separately reviewed migration to tie account, farmer, and farm ownership together. This is not a destructive-safety blocker, but it is a data-integrity gap for any direct SQL writer.
6. **Cross-role email uniqueness is not a database invariant (design risk):** Decide whether per-table uniqueness is sufficient or make global uniqueness race-safe before relying on account provisioning at scale.

## Exact recommended execution steps (only after blockers clear)

### A. Read-only preflight in MySQL Workbench

Select `smartagriculturedb` and run these queries before migration. They do not mutate data:

```sql
SELECT VERSION() AS mysql_version,
       DATABASE() AS selected_schema,
       @@lower_case_table_names AS lower_case_table_names,
       @@foreign_key_checks AS foreign_key_checks;

SELECT TABLE_NAME, TABLE_TYPE, ENGINE
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'smartagriculturedb'
ORDER BY TABLE_TYPE, TABLE_NAME;

SELECT TABLE_NAME, TABLE_TYPE, ENGINE
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'smartagriculturedb'
  AND TABLE_NAME IN ('admin_account','farmer_account','farmer_update','update_review','notification');

SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY, EXTRA
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'smartagriculturedb'
  AND TABLE_NAME IN ('farmer','farm','cultivation')
ORDER BY TABLE_NAME, ORDINAL_POSITION;

SELECT TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'smartagriculturedb'
  AND TABLE_NAME IN ('farm','cultivation')
  AND REFERENCED_TABLE_NAME IS NOT NULL
ORDER BY TABLE_NAME, CONSTRAINT_NAME;

SELECT COUNT(*) AS farmer_count,
       COUNT(DISTINCT Farmer_ID) AS distinct_farmer_ids
FROM smartagriculturedb.farmer;
```

Expected preflight: correct target schema; Oracle MySQL 8.0.16+; foreign-key checks enabled; Farmer_ID is a signed `INT` primary/indexed key; Farm_ID and Cultivation_ID are compatible signed `INT` indexed keys; parent and future child tables use InnoDB; no target-name collision. The user-provided six Farmer rows should produce count 6, but the ID set should not be copied into an unsecured report.

Then inspect `SHOW CREATE TABLE smartagriculturedb.farmer;`, `farm`, and `cultivation`, and save the DDL/backup according to your normal change-control procedure. Confirm no target-name object has an unrelated meaning. If any target name exists, **stop**; `IF NOT EXISTS` is not a schema comparison or migration repair.

### B. Backup

Take a consistent backup/export of `smartagriculturedb` and verify it can be restored to a separate development schema. Do not use `DROP`, reset, or overwrite commands.

### C. Run only the reviewed migration

From the project root, after filling in the approved MySQL account name (the `-p` option prompts for the private password):

```text
mysql --host=localhost --port=3306 --user=YOUR_DB_USER --password smartagriculturedb
```

At the MySQL prompt, execute:

```sql
SOURCE database/10_auth_farmer_portal.sql;
```

Run no base install/reset script as part of this step. Read every result/warning. Stop on the first error; do not blindly rerun or drop partial objects.

### D. Verify after migration (read-only)

Check the five created tables and definitions with `SHOW CREATE TABLE` for each. Confirm all nine FKs, five PKs, three unique keys, two enforced CHECK constraints, expected indexes, and `ENGINE=InnoDB` in `information_schema`. Confirm the pre-existing object count increases only by five tables (subject to preflight exclusions) and that Farmer row count/ID snapshot matches the pre-migration snapshot. Only after DDL verification should the one-time super-admin bootstrap be run.

## Initial audit recommendation (superseded by final section)

The SQL is non-destructive by static inspection and structurally matches the supplied base DDL. **Do not execute it on the named existing database yet** because live schema/version/name/engine checks and a verified backup are outstanding. The current EACCES connection failure is the primary pre-execution blocker. The owner-association and cross-table email uniqueness findings should be explicitly accepted or addressed in separately reviewed schema/application work; no such change was made during this read-only audit.

## MySQL 8.0.46 Compatibility Review

**Review mode:** Static compatibility check only. The current instruction supplies MySQL 8.0.46, database `smartagriculturedb`, 15 existing objects, six Farmer records, InnoDB tables, `farmer_farm_summary` view, and successful backup creation. These are treated as verified environment facts supplied by the user. This review did **not** reconnect to MySQL, inspect the backup file, execute migration SQL, or test a migration run.

| Finding | Classification | Evidence / rationale |
| --- | --- | --- |
| Five `CREATE TABLE IF NOT EXISTS` definitions | **PASS** | Tables are `admin_account`, `farmer_account`, `farmer_update`, `update_review`, and `notification`; all request `ENGINE=InnoDB`. No `CREATE OR REPLACE`, `ALTER` to existing tables, or table rebuild is present. |
| Column types and defaults | **PASS** | `INT`, `BIGINT`, `VARCHAR`, `ENUM`, `DATE`, `DECIMAL(10,2)`, `TEXT`, `TIMESTAMP`, and `BOOLEAN`/`TINYINT(1)` are compatible with MySQL 8.0.46. Nullable fields and timestamp defaults are syntactically appropriate for the specified version. |
| Nullable TEXT columns | **PASS** | `farmer_update.progress_details` and `update_review.review_comment` remain nullable and have no explicit default clause. |
| Primary keys | **PASS** | Each new table has one non-null `AUTO_INCREMENT` primary key; MySQL supports these integer key definitions. |
| Farmer account foreign key | **PASS** | `farmer_account.farmer_id INT` references `farmer.Farmer_ID`. The checked-in base schema defines `Farmer_ID int NOT NULL PRIMARY KEY`; the database identity and InnoDB status are supplied as verified. The migration does not create or duplicate Farmer rows. |
| Remaining foreign keys | **PASS** | The eight remaining references target the new account/update tables or the existing `farm.Farm_ID` and `cultivation.Cultivation_ID`. Checked-in base DDL defines the existing referenced IDs as signed `INT` primary keys; child types match. Foreign-key compatibility also requires matching integer size/sign and supported indexed InnoDB parents, per the [MySQL 8.0 FK rules](https://dev.mysql.com/doc/refman/8.0/en/create-table-foreign-keys.html). |
| Unique constraints and indexes | **PASS** | Three unique keys enforce admin email, one farmer account per Farmer_ID, and farmer-account email uniqueness. Ten explicit non-unique indexes support role/status, status/date, owner/date, farm/cultivation, review, and notification lookups; InnoDB can provide the required child FK index for `farmer_update.account_id`. |
| CHECK constraints | **PASS** | Two table CHECKs validate actor/admin consistency and notification recipient consistency. MySQL 8.0.46 enforces these; CHECK constraints became supported/enforced in MySQL 8.0.16. See the [MySQL 8.0 CHECK documentation](https://dev.mysql.com/doc/refman/8.0/en/create-table-check-constraints.html). |
| Farmer/Farm/Cultivation preservation | **PASS** | The migration contains only `USE` and the five CREATE TABLE statements. It has no `INSERT`, `UPDATE`, `DELETE`, `DROP`, `TRUNCATE`, or `ALTER TABLE`; existing Farmer_IDs and Farmer/Farm/Cultivation rows are not changed by its SQL. |
| Existing 15 objects and target-name collision | **PASS with condition** | The supplied base schema object inventory is 14 tables plus `Farmer_Farm_Summary`; none of those source-defined names match the five new table names. The user reports the live inventory as 15 objects. Since the live names were not re-queried in this static review, confirm the exact five names are absent immediately before execution. |
| Rerunning after a complete successful migration | **PASS with limitation** | All five statements use `IF NOT EXISTS`, so a second complete run skips existing tables rather than recreating them. It does not compare or repair definitions. A partial run or a pre-existing same-name table/view with a conflicting definition can still produce later errors or runtime incompatibility. |
| Destructive SQL | **PASS** | No `DROP`, `TRUNCATE`, `ALTER`, table reset, seed DML, or replacement of the existing view appears in the migration. |
| Bootstrap and password storage in current project | **BLOCKER** | The current project copy does not contain `scripts/bootstrap-admin.mjs` or the auth service/repository. The migration itself creates no account and stores no plaintext credential, but bootstrap/hash behavior is not implemented or verifiable in this copy. |
| Required application environment for auth | **WARNING** | DB settings are expected by the backend connection setup. The current copy does not include the auth/bootstrap implementation or an `.env.example`; JWT/bootstrap configuration cannot be verified. No actual environment file or secret was read. |
| Account/Farmer/Farm owner consistency | **WARNING** | Separate foreign keys ensure each ID exists, but do not guarantee `farmer_update.account_id` belongs to `farmer_update.farmer_id` or that `farm_id` belongs to that farmer. Application session-derived ownership checks currently enforce this on normal application writes; direct SQL writers could create inconsistent associations. |
| Global uniqueness of email across roles | **WARNING** | Email is unique within each account table, but no constraint spans both `admin_account` and `farmer_account`. The application checks both tables before insert, but check-then-insert is not atomic across concurrent account creation. This does not prevent migration execution, but it is not a database-enforced global invariant. |
| Live migration validation | **WARNING** | No migration was executed and no claim of live migration testing is made. The supplied version/schema/backup facts and static definitions support compatibility, but a disposable-schema rehearsal is still recommended before production use. |

**Blockers:** None identified for MySQL 8.0.46 static DDL compatibility based on the supplied environment facts and checked-in schema definitions. The owner-association and cross-role email findings are warnings about data-integrity guarantees, not syntax failures or destructive migration behavior. Confirm the five target names are still unused and retain the provided backup before execution.

### DDL-only recommendation (does not certify farmer portal readiness)

**SAFE TO APPLY** — the migration DDL is statically compatible with the supplied MySQL 8.0.46 environment and is additive/non-destructive. This is not a claim that the migration has been executed or tested live. Use the provided backup, verify the five target names remain absent, and inspect all client/server warnings during the actual change window. The current project backend still lacks the auth/ownership feature layer, as documented in the final addendum; applying this schema alone does not enable a secure farmer portal.
## Current Fieldwise project review and requested SQL correction

**Review mode:** Static file/source review only. I did not connect to MySQL, run the migration, or create records. The two requested migration clauses were changed; no other schema definition or backend source file was changed.

### Exact SQL changes

```diff
-  `progress_details` TEXT DEFAULT NULL,
+  `progress_details` TEXT,
...
-  `review_comment` TEXT DEFAULT NULL,
+  `review_comment` TEXT,
```

Both columns remain nullable because neither definition specifies `NOT NULL`. MySQL supplies the implicit NULL default for nullable columns. All other migration statements were retained byte-for-byte apart from normal file encoding preservation.

### MySQL 8.0.46 static checks

- **Five CREATE TABLE statements:** Present, in dependency order: `admin_account`, `farmer_account`, `farmer_update`, `update_review`, `notification`. All specify InnoDB.
- **Primary/foreign keys:** Five PKs and nine FKs are present. `farmer_account.farmer_id INT` references `farmer.Farmer_ID INT`; farmer_update references account INT, Farmer_ID INT, Farm_ID INT, and nullable Cultivation_ID INT; review and notification FKs refer to the new tables with matching INT/BIGINT ID types.
- **Existing schema type comparison:** Checked-in `database/02_create_tables.sql` defines existing Farmer_ID, Farm_ID, and Cultivation_ID as signed `INT` primary keys. This is source-DDL compatibility evidence; current live metadata was not queried.
- **Constraints/indexes:** Three unique keys, two CHECK constraints, and the explicit lookup indexes are present. CHECK expressions require MySQL 8.0.16+ and are supported by the supplied 8.0.46 version. Constraint symbols (`fk_*`, `chk_*`) do not collide with the names in checked-in existing schema scripts, which use the legacy `*_ibfk_*` names. No live INFORMATION_SCHEMA query was performed.
- **Data preservation:** The migration still contains only `USE` and five `CREATE TABLE IF NOT EXISTS` statements. It contains no INSERT, UPDATE, DELETE, DROP, TRUNCATE, or ALTER TABLE of an existing table, so it does not modify Farmer, Farm, or Cultivation rows.
- **Repeat execution:** A complete second run skips already-created tables. `IF NOT EXISTS` does not compare definitions or recover automatically from a partial/conflicting install.
- **No execution claim:** This is a syntax/definition review only, not a live migration test.

### Backend ownership validation — critical blocker

The current project's backend does **not** contain the authentication/farmer-portal implementation described by the previous report. Files such as `backend/data-access/repositories/authRepository.js`, `farmerPortalRepository.js`, `backend/business/services/authService.js`, `portalService.js`, and authentication middleware are absent from this workspace. `backend/application/routes/index.js` exposes the generic CRUD routes without authentication middleware.

The existing `recordRepository.validateReferences` checks only whether referenced IDs exist. The cultivation transaction locks/validates that a farm exists and a crop exists; it does not validate an authenticated account-to-farmer owner, farmer-to-farm ownership, or farm-to-cultivation ownership. No `farmer_update` application workflow is present in this project copy. Therefore those ownership checks **cannot be confirmed** and are not implemented in the inspected backend snapshot. This is a critical application-security/integration blocker to enabling the farmer portal; the migration alone does not supply those protections.

### Remaining warnings

1. `farmer_update` has independent FKs to account, farmer, and farm, but no composite constraint tying the three identities together. Enforce ownership in the backend and consider a composite FK if direct database writers must also be constrained.
2. Email uniqueness is per account table, not globally shared between administrator and farmer tables; cross-table service checks can race.
3. `CREATE TABLE IF NOT EXISTS` is existence-idempotent only and will not reconcile an incompatible same-name object.
4. Existing schema type and constraint-name comparison is against checked-in DDL, not current live INFORMATION_SCHEMA, because this review made no database connection.

**DDL conclusion:** The two requested TEXT edits are syntactically compatible with MySQL 8.0.46 and preserve nullability. The migration remains additive by static inspection. **Application conclusion:** Do not treat authentication/ownership security as ready in this current project copy; the required backend feature layer is absent. No backend source was changed in this task.

## Current application implementation follow-up

**Updated 2026-11-10 after the portal port.** The earlier historical statement that authentication files were absent described the state at the time of the static migration review. The authentication and farmer-portal backend and frontend are now present in this current workspace; see [Fieldwise_Auth_Portal_Implementation_Report.md](Fieldwise_Auth_Portal_Implementation_Report.md) for exact files and verification results. The port and its tests did not connect to MySQL or execute `database/10_auth_farmer_portal.sql`. Migration compatibility/safety conclusions in this preflight report remain static findings and are not a claim of live schema validation.
