# Fieldwise database scripts

These scripts capture the live `smartagriculturedb` schema observed on MySQL 8.0.46. The table columns, types, primary keys, foreign keys, indexes, procedures, function, and trigger were read from the existing MySQL database before authoring. The schema has 14 InnoDB base tables, including `Farmer_Audit`.

## Order

Run these files in one MySQL 8.0 session, in order:

1. `01_create_database.sql`
2. `02_create_tables.sql`
3. `03_constraints.sql`
4. `04_indexes.sql`
5. `05_views.sql`
6. `06_stored_procedures.sql`
7. `07_functions.sql`
8. `08_triggers.sql`
9. `09_sample_queries.sql` (read-only examples)

For example, from the repository root in the MySQL command-line client, use `SOURCE database/01_create_database.sql;` and continue with each next file. Every file selects `smartagriculturedb` itself so the selected schema is explicit.

## Safety and existing installations

- No script contains `DROP DATABASE`, `DROP TABLE`, `TRUNCATE`, seed inserts, or table resets.
- `01` creates the database only if absent. `02` uses `CREATE TABLE IF NOT EXISTS`; on an existing table it preserves rows and does **not** reconcile schema drift. Compare `SHOW CREATE TABLE` against the script before using this as an upgrade.
- `03` and `04` inspect `information_schema` before adding a named foreign key or supporting index. They skip an object with the same name. If an existing object has a different definition or name, compare it manually; do not add a duplicate constraint or modify an existing object blindly.
- `05` creates/replaces only the project-owned `Farmer_Farm_Summary` view. It reads base tables and contains no contact details. Confirm the name is not used for another object before applying it to an existing schema.
- `06`–`08` use plain `CREATE` because MySQL does not offer consistent `IF NOT EXISTS` behavior for these routine objects across supported versions. On a database where the named object already exists, inspect `SHOW CREATE PROCEDURE/FUNCTION/TRIGGER`, compare it, and skip the file if it matches. If it differs, stop and make a reviewed migration; these files intentionally do not drop existing routines or triggers.
- The scripts contain no fabricated DML records. Runtime application records remain in MySQL and are not reseeded.
- Back up the database before applying schema scripts to an existing installation. The scripts are an installation reference and are not a schema migration tool.

## Stored-routine characteristic correction (existing installations only)

The checked-in definitions in `06_stored_procedures.sql` already declare `READS SQL DATA`. The live procedure bodies are SELECT-only but their definitions omit that characteristic, so MySQL reports its default, `CONTAINS SQL`. The database cannot establish which earlier installer or manual statement created them. Re-running plain `CREATE PROCEDURE` does not update an existing routine and fails on a duplicate name.

The live `SHOW CREATE FUNCTION GetTotalFarmArea` reports definer `'root'@'localhost'`, SQL mode `ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION`, and connection collation `utf8mb4_0900_ai_ci`. The function reads mutable `Farm` rows, so the corrected characteristic is `NOT DETERMINISTIC READS SQL DATA`. `ALTER FUNCTION` cannot change DETERMINISTIC, so the migration must replace only this function. It pins the exact current definer and creation SQL mode/charset.

### Preflight checklist

Before manual approval and execution:

- [ ] Run and save `SHOW CREATE PROCEDURE` for both named procedures and `SHOW CREATE FUNCTION GetTotalFarmArea`.
- [ ] Confirm the function definer is still `'root'@'localhost'`; stop and review the migration if it differs.
- [ ] Confirm all three parameters, the function return type, procedure result columns/order, and routine bodies match the checked-in definitions. Stop if anything else has drifted.
- [ ] Confirm the function's current SQL mode and character set/collation match the values captured above; update the proposal and recovery file if they differ.
- [ ] Take a database backup and separately save the routine definitions so the old function can be restored.
- [ ] Confirm the executing account has `ALTER ROUTINE` for both procedures and for dropping the function, plus `CREATE ROUTINE` for recreating it. MySQL uses `ALTER ROUTINE` to alter or drop stored routines; there is no separate `DROP ROUTINE` privilege. Because the migration pins a definer, confirm the required definer privilege (`SET_USER_ID` or the applicable administrative privilege) and that `'root'@'localhost'` exists.
- [ ] Schedule a quiet window: the function is unavailable between DROP and CREATE, and routine DDL does not form one transaction.
- [ ] Review the exact migration SQL below and approve it before execution.

### Proposed migration and recovery

`11_routine_characteristics_migration.sql` alters only the two procedure characteristics. MySQL's `ALTER PROCEDURE` changes characteristics without changing the procedure body or parameters; these statements preserve their existing result sets, definers, and security characteristics. The same statements can be run again, but rerunning the full migration drops and recreates `GetTotalFarmArea` again. Do not rerun casually.

If the function DROP succeeds but CREATE fails, stop application calls to the function and use `11_routine_characteristics_recovery.sql` after resolving any privilege or syntax issue. The recovery script restores the exact pre-migration function definition captured above, including its original definer, return type, body, SQL mode, and `DETERMINISTIC` characteristic. That characteristic is incorrect; recovery is only to restore availability. Do not run recovery if the function still exists unless intentionally restoring the original definition.

### Manual execution and verification

First inspect and save the live routine definitions:

```sql
SHOW CREATE PROCEDURE `GetFarmerDetails`;
SHOW CREATE PROCEDURE `GetFarmsByFarmer`;
SHOW CREATE FUNCTION `GetTotalFarmArea`;
```

After reviewing and approving the proposal, execute `11_routine_characteristics_migration.sql` in MySQL Workbench or the MySQL client as the exact function definer. After successful execution, verify again with the three `SHOW CREATE` statements above. Both procedures should show `READS SQL DATA`; the function should show definer `'root'@'localhost'`, `NOT DETERMINISTIC`, and `READS SQL DATA`. Routine body, parameter, return type, and result columns must remain the same.

This correction is only for existing installations. Fresh installs should use corrected `06_stored_procedures.sql` and `07_functions.sql`; do not run the corrective migration as part of normal fresh installation.
## Connection settings

The application reads backend-only connection values from `backend/.env`. Keep real environment files out of Git and archives. The configured database name should match `smartagriculturedb` on case-sensitive MySQL installations.

## Object notes

- All 14 live tables use InnoDB and `utf8mb4_0900_ai_ci`.
- The 12 foreign keys are preserved. InnoDB creates supporting indexes when the foreign keys are added; `04_indexes.sql` verifies the expected index names and skips those already present.
- The audit trigger records Farmer INSERT events only. It does not log UPDATE or DELETE.
- `Farmer_Farm_Summary` uses LEFT JOINs so a farmer without a farm remains visible.
- `09_sample_queries.sql` is read-only. Application write examples require real validated input and are executed through SQL repositories.
