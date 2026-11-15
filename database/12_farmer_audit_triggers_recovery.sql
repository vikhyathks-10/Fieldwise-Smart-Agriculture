-- Recovery for 12_farmer_audit_triggers_migration.sql (MySQL 8.0.46).
-- Manual DBA execution only. Does not change Farmer or Farmer_Audit data rows.
-- First run only the preflight and snapshot-count section; continue only if safe.
-- Restores the prior INSERT-only trigger with explicit DEFINER root@localhost.
-- JSON columns are kept by default; dropping them permanently destroys snapshots.
USE `smartagriculturedb`;

-- PREFLIGHT: expected schema and both InnoDB base tables.
-- Printed STOP results do not halt a MySQL script. Run/inspect preflight separately;
-- if any required definition fails, stop manually before the DDL section.
SELECT DATABASE() AS selected_schema,
 CASE WHEN LOWER(DATABASE())='smartagriculturedb' THEN 'PASS' ELSE 'STOP' END AS schema_status;
SELECT expected.TABLE_NAME, actual.ENGINE, actual.TABLE_TYPE,
 CASE WHEN actual.TABLE_NAME IS NULL THEN 'STOP: table missing'
      WHEN actual.TABLE_TYPE<>'BASE TABLE' THEN 'STOP: expected base table'
      WHEN UPPER(COALESCE(actual.ENGINE,''))<>'INNODB' THEN 'STOP: InnoDB required'
      ELSE 'PASS' END AS table_status
FROM (SELECT 'Farmer' AS TABLE_NAME UNION ALL SELECT 'Farmer_Audit') expected
LEFT JOIN information_schema.TABLES actual
 ON actual.TABLE_SCHEMA=DATABASE() AND LOWER(actual.TABLE_NAME)=LOWER(expected.TABLE_NAME);

-- Required original column-definition checks. These expected definitions follow
-- the supplied live schema: Farmer_ID INT PK; Name VARCHAR(100) NOT NULL;
-- Phone VARCHAR(15), Email VARCHAR(100), Address VARCHAR(200); audit columns as
-- originally described. Stop on any STOP result before executing any later DDL.
SELECT e.TABLE_NAME,e.COLUMN_NAME,c.COLUMN_TYPE,c.IS_NULLABLE,c.COLUMN_DEFAULT,c.EXTRA,c.COLUMN_KEY,
 CASE
  WHEN c.COLUMN_NAME IS NULL THEN 'STOP: required column missing'
  WHEN e.TABLE_NAME='Farmer' AND e.COLUMN_NAME='Farmer_ID'
       AND (LOWER(c.DATA_TYPE)<>'int' OR c.IS_NULLABLE<>'NO' OR c.COLUMN_KEY<>'PRI') THEN 'STOP: Farmer_ID must be INT NOT NULL PRIMARY KEY'
  WHEN e.TABLE_NAME='Farmer' AND e.COLUMN_NAME='Name'
       AND (LOWER(c.DATA_TYPE)<>'varchar' OR c.CHARACTER_MAXIMUM_LENGTH<>100 OR c.IS_NULLABLE<>'NO') THEN 'STOP: Name must be VARCHAR(100) NOT NULL'
  WHEN e.TABLE_NAME='Farmer' AND e.COLUMN_NAME='Phone'
       AND (LOWER(c.DATA_TYPE)<>'varchar' OR c.CHARACTER_MAXIMUM_LENGTH<>15 OR c.IS_NULLABLE<>'YES') THEN 'STOP: Phone must be nullable VARCHAR(15)'
  WHEN e.TABLE_NAME='Farmer' AND e.COLUMN_NAME='Email'
       AND (LOWER(c.DATA_TYPE)<>'varchar' OR c.CHARACTER_MAXIMUM_LENGTH<>100 OR c.IS_NULLABLE<>'YES') THEN 'STOP: Email must be nullable VARCHAR(100)'
  WHEN e.TABLE_NAME='Farmer' AND e.COLUMN_NAME='Address'
       AND (LOWER(c.DATA_TYPE)<>'varchar' OR c.CHARACTER_MAXIMUM_LENGTH<>200 OR c.IS_NULLABLE<>'YES') THEN 'STOP: Address must be nullable VARCHAR(200)'
  WHEN e.TABLE_NAME='Farmer_Audit' AND e.COLUMN_NAME='Audit_ID'
       AND (LOWER(c.DATA_TYPE)<>'int' OR c.IS_NULLABLE<>'NO' OR c.COLUMN_KEY<>'PRI' OR c.EXTRA NOT LIKE '%auto_increment%') THEN 'STOP: Audit_ID must be INT AUTO_INCREMENT PRIMARY KEY'
  WHEN e.TABLE_NAME='Farmer_Audit' AND e.COLUMN_NAME='Farmer_ID'
       AND (LOWER(c.DATA_TYPE)<>'int' OR c.IS_NULLABLE<>'YES'
         OR LOWER(c.COLUMN_TYPE)<>LOWER(COALESCE((SELECT f.COLUMN_TYPE FROM information_schema.COLUMNS f WHERE f.TABLE_SCHEMA=DATABASE() AND LOWER(f.TABLE_NAME)='farmer' AND f.COLUMN_NAME='Farmer_ID'),'!missing!'))) THEN 'STOP: audit Farmer_ID must be nullable INT compatible with Farmer.Farmer_ID'
  WHEN e.TABLE_NAME='Farmer_Audit' AND e.COLUMN_NAME='Farmer_Name'
       AND (LOWER(c.DATA_TYPE)<>'varchar' OR c.CHARACTER_MAXIMUM_LENGTH<>100 OR c.IS_NULLABLE<>'YES') THEN 'STOP: Farmer_Name must be nullable VARCHAR(100)'
  WHEN e.TABLE_NAME='Farmer_Audit' AND e.COLUMN_NAME='Action_Type'
       AND (LOWER(c.DATA_TYPE)<>'varchar' OR c.CHARACTER_MAXIMUM_LENGTH<>20 OR c.IS_NULLABLE<>'YES') THEN 'STOP: Action_Type must be nullable VARCHAR(20)'
  WHEN e.TABLE_NAME='Farmer_Audit' AND e.COLUMN_NAME='Action_Date'
       AND (LOWER(c.DATA_TYPE)<>'timestamp' OR LOWER(REPLACE(COALESCE(c.COLUMN_DEFAULT,''),'()',''))<>'current_timestamp') THEN 'STOP: Action_Date must be TIMESTAMP DEFAULT CURRENT_TIMESTAMP'
  ELSE 'PASS'
 END AS definition_status
FROM (
 SELECT 'Farmer' TABLE_NAME,'Farmer_ID' COLUMN_NAME UNION ALL
 SELECT 'Farmer','Name' UNION ALL SELECT 'Farmer','Phone' UNION ALL
 SELECT 'Farmer','Email' UNION ALL SELECT 'Farmer','Address' UNION ALL
 SELECT 'Farmer_Audit','Audit_ID' UNION ALL SELECT 'Farmer_Audit','Farmer_ID' UNION ALL
 SELECT 'Farmer_Audit','Farmer_Name' UNION ALL SELECT 'Farmer_Audit','Action_Type' UNION ALL
 SELECT 'Farmer_Audit','Action_Date'
) e
LEFT JOIN information_schema.COLUMNS c
 ON c.TABLE_SCHEMA=DATABASE() AND LOWER(c.TABLE_NAME)=LOWER(e.TABLE_NAME)
 AND c.COLUMN_NAME=e.COLUMN_NAME
ORDER BY e.TABLE_NAME,e.COLUMN_NAME;
-- MySQL does not automatically halt this script when a query prints STOP.
-- Run/inspect preflight as a separate pass; the operator must stop manually if
-- any required definition is not PASS. Do not run the DDL section in that case.

-- A missing JSON column is acceptable after a partial migration. Any column that
-- exists must be nullable JSON; STOP for manual correction if status says otherwise.
SELECT expected.COLUMN_NAME, actual.DATA_TYPE, actual.IS_NULLABLE,
 CASE WHEN actual.COLUMN_NAME IS NULL THEN 'INFO: absent; recovery can continue'
      WHEN LOWER(actual.DATA_TYPE)='json' AND actual.IS_NULLABLE='YES' THEN 'PASS'
      ELSE 'STOP: existing column must be nullable JSON' END AS column_status
FROM (SELECT 'Old_Values' COLUMN_NAME UNION ALL SELECT 'New_Values') expected
LEFT JOIN information_schema.COLUMNS actual
 ON actual.TABLE_SCHEMA=DATABASE() AND LOWER(actual.TABLE_NAME)='farmer_audit'
 AND actual.COLUMN_NAME=expected.COLUMN_NAME;
-- Inspect the existing INSERT trigger as well as optional UPDATE/DELETE triggers.
-- ACTION_STATEMENT is included in the result; if AfterFarmerInsert exists, also
-- inspect SHOW CREATE TRIGGER before any replacement. Its exact definition gets
-- automatic PASS only if all five conditions below match.
-- If any condition fails, inspect manually and set the exact confirmation token
-- only after review, then rerun and inspect this preflight before the DDL pass.
SET @confirm_replace_existing_insert_trigger='NO';
SET @confirm_drop_existing_update_delete_triggers='NO';
SELECT expected.TRIGGER_NAME,existing.DEFINER,existing.EVENT_OBJECT_TABLE,
       existing.EVENT_MANIPULATION,existing.ACTION_TIMING,existing.ACTION_STATEMENT,
       CASE
        WHEN existing.TRIGGER_NAME IS NULL AND expected.TRIGGER_NAME='AfterFarmerInsert'
          THEN 'PASS: original INSERT trigger absent; recovery can create it'
        WHEN expected.TRIGGER_NAME='AfterFarmerInsert'
         AND existing.DEFINER='root@localhost'
         AND existing.EVENT_OBJECT_TABLE='Farmer'
         AND existing.EVENT_MANIPULATION='INSERT'
         AND existing.ACTION_TIMING='AFTER'
         AND existing.ACTION_STATEMENT LIKE '%INSERT INTO%Farmer_Audit%'
         AND existing.ACTION_STATEMENT LIKE '%NEW.Farmer_ID%'
         AND existing.ACTION_STATEMENT LIKE '%NEW.Name%'
         AND LOCATE(CONCAT(CHAR(39),'INSERT',CHAR(39)),existing.ACTION_STATEMENT)>0
          THEN 'PASS: existing INSERT trigger matches expected definition'
        WHEN expected.TRIGGER_NAME='AfterFarmerInsert'
         AND @confirm_replace_existing_insert_trigger='REPLACE_AFTER_FARMER_INSERT_AFTER_REVIEW'
          THEN 'PASS: manual INSERT-trigger replacement confirmed; SHOW CREATE inspection required'
        WHEN expected.TRIGGER_NAME='AfterFarmerInsert'
          THEN CONCAT('STOP: existing INSERT trigger differs; definer=',COALESCE(existing.DEFINER,'NULL'),
                      ', table=',COALESCE(existing.EVENT_OBJECT_TABLE,'NULL'),
                      ', event=',COALESCE(existing.EVENT_MANIPULATION,'NULL'),
                      ', timing=',COALESCE(existing.ACTION_TIMING,'NULL'),
                      '; inspect ACTION_STATEMENT and SHOW CREATE TRIGGER, then set the exact confirmation token only after review')
        WHEN existing.TRIGGER_NAME IS NULL THEN 'PASS: optional trigger absent'
        WHEN @confirm_drop_existing_update_delete_triggers='DROP_EXISTING_UPDATE_DELETE_TRIGGERS_AFTER_REVIEW'
          THEN 'PASS: optional-trigger replacement confirmed; verify reviewed definition'
        ELSE 'STOP: inspect existing definition and explicitly confirm before dropping'
       END AS replacement_status
FROM (
 SELECT 'AfterFarmerInsert' AS TRIGGER_NAME UNION ALL
 SELECT 'AfterFarmerUpdate' UNION ALL SELECT 'AfterFarmerDelete'
) expected
LEFT JOIN information_schema.TRIGGERS existing
 ON existing.TRIGGER_SCHEMA=DATABASE() AND existing.TRIGGER_NAME=expected.TRIGGER_NAME
ORDER BY expected.TRIGGER_NAME;
-- Optional UPDATE/DELETE triggers are never dropped automatically. For each
-- existing one, inspect ACTION_STATEMENT and SHOW CREATE TRIGGER, then set
-- DROP_EXISTING_UPDATE_DELETE_TRIGGERS_AFTER_REVIEW only after manual review.
-- STOP rows are diagnostic; MySQL does not halt later statements automatically.
-- Run/inspect preflight separately and stop manually whenever a required check fails.
-- Diagnostic STOP does not automatically halt MySQL. Run preflight separately,
-- inspect ACTION_STATEMENT plus SHOW CREATE output, and stop manually on failure.

-- Count payload-bearing rows safely whether zero, one, or both columns exist.
SET @has_old=(SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND LOWER(TABLE_NAME)='farmer_audit' AND COLUMN_NAME='Old_Values');
SET @has_new=(SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND LOWER(TABLE_NAME)='farmer_audit' AND COLUMN_NAME='New_Values');
SET @snapshot_count_sql=CONCAT(
 'SELECT COUNT(*) AS audit_rows_with_snapshots FROM `Farmer_Audit` WHERE ',
 IF(@has_old=1,'`Old_Values` IS NOT NULL','0'),
 ' OR ',
 IF(@has_new=1,'`New_Values` IS NOT NULL','0')
);
PREPARE fieldwise_snapshot_stmt FROM @snapshot_count_sql;
EXECUTE fieldwise_snapshot_stmt;
DEALLOCATE PREPARE fieldwise_snapshot_stmt;

-- Destructive removal is disabled unless this exact token is deliberately set.
SET @confirm_drop_json_audit_data='NO';
-- Keep writes paused. Trigger DDL is not atomic. If recovery fails, inspect the
-- trigger listing and repair/recreate this original trigger before resuming.
-- ===== DDL RECOVERY SECTION =====
-- Do not execute this section unless required table/column checks passed.
-- Recovery restores INSERT-only auditing. It does not reverse or delete audit
-- snapshots previously recorded by the UPDATE/DELETE triggers.
-- If preflight reports STOP for AfterFarmerInsert, do not execute this DROP.
-- Inspect its ACTION_STATEMENT and SHOW CREATE TRIGGER; only after manual review
-- set REPLACE_AFTER_FARMER_INSERT_AFTER_REVIEW and rerun/approve preflight.
DROP TRIGGER IF EXISTS `AfterFarmerInsert`;
-- Do not automatically drop optional triggers. After the preflight review and
-- exact confirmation token, manually execute only the corresponding statement
-- for each existing optional trigger, then run/continue the restoration section:
-- DROP TRIGGER IF EXISTS `AfterFarmerUpdate`;
-- DROP TRIGGER IF EXISTS `AfterFarmerDelete`;
-- Without manual removal, post-recovery verification fails and JSON cleanup is blocked.
DELIMITER $$

CREATE DEFINER = 'root'@'localhost' TRIGGER `AfterFarmerInsert`
AFTER INSERT ON `Farmer`
FOR EACH ROW
BEGIN
 INSERT INTO `Farmer_Audit` (Farmer_ID,Farmer_Name,Action_Type)
 VALUES (NEW.Farmer_ID,NEW.Name,'INSERT');
END$$
DELIMITER ;

-- Verify restoration and absence of added triggers before any optional column drop.
SHOW CREATE TRIGGER `AfterFarmerInsert`;
SELECT CASE WHEN SUM(TRIGGER_NAME='AfterFarmerInsert')=1
 AND SUM(TRIGGER_NAME='AfterFarmerInsert' AND DEFINER='root@localhost'
         AND LOWER(EVENT_OBJECT_TABLE)='farmer' AND EVENT_MANIPULATION='INSERT'
         AND ACTION_TIMING='AFTER'
 AND ACTION_STATEMENT LIKE '%Farmer_Audit%'
 AND ACTION_STATEMENT LIKE '%NEW.Farmer_ID%'
 AND ACTION_STATEMENT LIKE '%NEW.Name%')=1
 AND SUM(TRIGGER_NAME IN ('AfterFarmerUpdate','AfterFarmerDelete'))=0
 THEN 'PASS: original INSERT trigger restored; added triggers absent'
 ELSE 'FAIL: recovery trigger state not verified' END AS recovery_check
FROM information_schema.TRIGGERS
WHERE TRIGGER_SCHEMA=DATABASE()
 AND TRIGGER_NAME IN ('AfterFarmerInsert','AfterFarmerUpdate','AfterFarmerDelete');
SELECT CASE WHEN COUNT(*)=1 AND MAX(DEFINER='root@localhost')=1
 AND MAX(LOWER(EVENT_OBJECT_TABLE)='farmer')=1 AND MAX(EVENT_MANIPULATION='INSERT')=1
 AND MAX(ACTION_TIMING='AFTER')=1
 AND MAX(ACTION_STATEMENT LIKE '%Farmer_Audit%' AND ACTION_STATEMENT LIKE '%NEW.Farmer_ID%' AND ACTION_STATEMENT LIKE '%NEW.Name%')=1 THEN 1 ELSE 0 END
INTO @recovery_trigger_ok
FROM information_schema.TRIGGERS
WHERE TRIGGER_SCHEMA=DATABASE() AND TRIGGER_NAME='AfterFarmerInsert';
SELECT CASE WHEN COUNT(*)=0 THEN 1 ELSE 0 END
INTO @update_delete_triggers_absent
FROM information_schema.TRIGGERS
WHERE TRIGGER_SCHEMA=DATABASE()
 AND TRIGGER_NAME IN ('AfterFarmerUpdate','AfterFarmerDelete');
SELECT CASE WHEN @update_delete_triggers_absent=1
 THEN 'PASS: AfterFarmerUpdate and AfterFarmerDelete are absent'
 ELSE 'STOP: optional triggers remain; do not remove JSON columns' END AS optional_trigger_absence_check;

-- OPTIONAL DESTRUCTIVE ROLLBACK. Before setting this exact token, export/backup
-- snapshots and accept permanent loss. Default NO retains both JSON columns.
-- Removal is additionally blocked unless the original trigger verified above.
SET @ddl=IF(@confirm_drop_json_audit_data='DROP_JSON_AUDIT_DATA' AND @recovery_trigger_ok=1 AND @update_delete_triggers_absent=1
 AND (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND LOWER(TABLE_NAME)='farmer_audit' AND COLUMN_NAME='Old_Values')>0,
 'ALTER TABLE `Farmer_Audit` DROP COLUMN `Old_Values`',
 'SELECT ''Old_Values retained; no JSON payload was removed'' AS status');
PREPARE fieldwise_stmt FROM @ddl; EXECUTE fieldwise_stmt; DEALLOCATE PREPARE fieldwise_stmt;
SET @ddl=IF(@confirm_drop_json_audit_data='DROP_JSON_AUDIT_DATA' AND @recovery_trigger_ok=1 AND @update_delete_triggers_absent=1
 AND (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND LOWER(TABLE_NAME)='farmer_audit' AND COLUMN_NAME='New_Values')>0,
 'ALTER TABLE `Farmer_Audit` DROP COLUMN `New_Values`',
 'SELECT ''New_Values retained; no JSON payload was removed'' AS status');
PREPARE fieldwise_stmt FROM @ddl; EXECUTE fieldwise_stmt; DEALLOCATE PREPARE fieldwise_stmt;

SHOW CREATE TRIGGER `AfterFarmerInsert`;
SHOW CREATE TABLE `Farmer_Audit`;
SELECT Audit_ID,Farmer_ID,Farmer_Name,Action_Type,Action_Date
FROM `Farmer_Audit` ORDER BY Audit_ID DESC LIMIT 20;