# Fieldwise Farmer Audit System

## Behavior

`Farmer_Audit` retains its existing columns and adds nullable `Old_Values` and `New_Values` JSON snapshots. The project's fresh-install table definition is in `database/02_create_tables.sql`; the three triggers are in `database/08_triggers.sql`.

| Trigger | Event | Audit payload |
| --- | --- | --- |
| `AfterFarmerInsert` | AFTER INSERT | `Old_Values` is NULL; `New_Values` contains `Farmer_ID`, `Name`, `Phone`, `Email`, and `Address`. |
| `AfterFarmerUpdate` | AFTER UPDATE | `Old_Values` and `New_Values` contain all five fields before and after the update. |
| `AfterFarmerDelete` | AFTER DELETE | `Old_Values` contains all five deleted values; `New_Values` is NULL. |

MySQL supplies `Action_Date`. Existing audit rows are preserved by the migration; the new snapshot columns are NULL for those historical rows because their before/after values were not previously recorded.

The audit history page reads existing rows and displays JSON snapshots when available. It checks the live trigger definitions and indicates how many of the three expected triggers are installed. It remains compatible with a pre-migration database by returning NULL snapshot aliases until both columns exist. Database Operations shows each live definition and the current audit table output.

Farmer INSERT/UPDATE/DELETE repository operations are wrapped in a transaction. With InnoDB Farmer and Farmer_Audit tables, the Farmer mutation and its trigger-written audit entry commit or roll back together.

## Manual migration

No migration has been run by the application change. A database administrator must:

1. Take and verify a restorable backup.
2. Confirm `Farmer` and `Farmer_Audit` are InnoDB and that the existing table shape and `AfterFarmerInsert` definition match the expected preflight.
3. Pause Farmer writes for the deployment window. MySQL trigger DDL is not atomic; dropping then recreating triggers can temporarily leave auditing unavailable if a statement fails.
4. Select the intended `smartagriculturedb` schema and execute `database/12_farmer_audit_triggers_migration.sql` in MySQL Workbench or the MySQL client.
5. Review the script's `SHOW CREATE TRIGGER`, `SHOW CREATE TABLE`, counts, and sample rows. Confirm pre-existing audit IDs and row counts remain present.
6. Resume writes only after all three trigger definitions and both JSON columns are verified.

The migration adds missing nullable JSON columns, then replaces only the three named triggers. It does not update, insert, or delete farmer records or existing audit records. It is repeatable in that it checks for the columns and drops/recreates the three triggers, but rerunning it still replaces the live trigger definitions and introduces a DDL coverage gap; do not rerun casually.

## Recovery

`database/12_farmer_audit_triggers_recovery.sql` restores the original INSERT-only trigger and removes the two added trigger definitions. By default it **retains both JSON columns**, so no captured snapshots are discarded. If the old schema must be restored exactly, first back up/export every JSON payload, then change `@confirm_drop_json_audit_data` to the explicit token `DROP_JSON_AUDIT_DATA` in the recovery script and run it. Dropping either column permanently deletes all values in that column. Recovery does not change Farmer rows or pre-existing audit rows.

## Verification and test scope

`npm test` verifies the installed script definitions, all five explicit JSON object keys for each event, audit-query compatibility both before and after the migration, and rollback handling for a failed Farmer repository statement. These are application/static tests; they do not execute MySQL triggers. A DBA must verify the actual installed definitions with the `SHOW CREATE TRIGGER` statements in the migration and perform any live acceptance test separately against a disposable database, not production.
