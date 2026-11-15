-- Fieldwise farmer audit expansion for MySQL 8.0.46.
-- Manual DBA execution only: take a verified backup and pause Farmer writes.
-- Execute in two passes: first run only the preflight through the original-trigger checks.
-- Review results; run the DDL section only after every required check passes.
-- No Farmer or Farmer_Audit data rows are inserted, updated, or deleted here.
-- MySQL trigger DDL is not atomic; see the partial-failure recovery instructions.
USE `smartagriculturedb`;

-- PREFLIGHT: require the intended schema and both InnoDB base tables.
-- Diagnostic PASS/STOP rows do not halt a MySQL script automatically. The operator must stop on any STOP/FAIL,
-- unexpected trigger definer, or missing privilege; never continue past a failed check.
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

-- Verify the five Farmer columns used in the trigger payloads.
SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA=DATABASE() AND LOWER(TABLE_NAME)='farmer'
 AND COLUMN_NAME IN ('Farmer_ID','Name','Phone','Email','Address')
ORDER BY ORDINAL_POSITION;

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
-- Existing snapshot columns must be nullable JSON. Missing columns will be added;
-- any present column reported STOP must be corrected manually before proceeding.
SELECT expected.COLUMN_NAME, actual.DATA_TYPE, actual.IS_NULLABLE,
 CASE WHEN actual.COLUMN_NAME IS NULL THEN 'PASS: will be added'
      WHEN LOWER(actual.DATA_TYPE)='json' AND actual.IS_NULLABLE='YES' THEN 'PASS'
      ELSE 'STOP: existing column must be nullable JSON' END AS column_status
FROM (SELECT 'Old_Values' COLUMN_NAME UNION ALL SELECT 'New_Values') expected
LEFT JOIN information_schema.COLUMNS actual
 ON actual.TABLE_SCHEMA=DATABASE() AND LOWER(actual.TABLE_NAME)='farmer_audit'
 AND actual.COLUMN_NAME=expected.COLUMN_NAME;
SELECT COUNT(*) AS pre_migration_audit_rows, MAX(Audit_ID) AS highest_existing_audit_id
FROM `Farmer_Audit`;
SHOW CREATE TRIGGER `AfterFarmerInsert`;
SELECT TRIGGER_NAME, DEFINER, EVENT_OBJECT_TABLE, EVENT_MANIPULATION, ACTION_TIMING,
 CASE WHEN DEFINER='root@localhost' THEN 'PASS' ELSE 'STOP: unexpected definer' END AS definer_status
FROM information_schema.TRIGGERS
WHERE TRIGGER_SCHEMA=DATABASE() AND TRIGGER_NAME='AfterFarmerInsert';

-- Inspect all three existing names, definers, timing/events, and full saved bodies.
-- The result includes absent optional triggers and their definitions when present.
-- If either UPDATE/DELETE trigger exists: inspect its ACTION_STATEMENT and run
-- SHOW CREATE TRIGGER for that name. Only after reviewing its behavior may you
-- replace NO below with the exact confirmation token shown here, then rerun and
-- review this preflight in the same session before executing the DDL pass.
SET @confirm_replace_existing_update_delete_triggers='NO';
SELECT expected.TRIGGER_NAME,existing.DEFINER,existing.EVENT_OBJECT_TABLE,
       existing.EVENT_MANIPULATION,existing.ACTION_TIMING,existing.ACTION_STATEMENT,
       CASE
        WHEN existing.TRIGGER_NAME IS NULL AND expected.TRIGGER_NAME='AfterFarmerInsert'
          THEN 'STOP: required original INSERT trigger missing'
        WHEN existing.TRIGGER_NAME IS NULL THEN 'PASS: optional trigger absent'
        WHEN expected.TRIGGER_NAME='AfterFarmerInsert'
         AND existing.DEFINER='root@localhost'
         AND existing.EVENT_OBJECT_TABLE='Farmer'
         AND existing.EVENT_MANIPULATION='INSERT'
         AND existing.ACTION_TIMING='AFTER'
          THEN 'PASS: original INSERT trigger has expected definer, table, event, and timing'
        WHEN expected.TRIGGER_NAME='AfterFarmerInsert'
          THEN CONCAT('STOP: expected root@localhost AFTER INSERT ON Farmer; found definer=',
                      COALESCE(existing.DEFINER,'NULL'),', table=',COALESCE(existing.EVENT_OBJECT_TABLE,'NULL'),
                      ', event=',COALESCE(existing.EVENT_MANIPULATION,'NULL'),
                      ', timing=',COALESCE(existing.ACTION_TIMING,'NULL'))
        WHEN @confirm_replace_existing_update_delete_triggers='REPLACE_EXISTING_UPDATE_DELETE_TRIGGERS_AFTER_REVIEW'
          THEN 'PASS: explicit replacement confirmation supplied; verify reviewed definition'
        ELSE 'STOP: inspect existing definition and explicitly confirm before replacement'
       END AS replacement_status
FROM (
 SELECT 'AfterFarmerInsert' AS TRIGGER_NAME UNION ALL
 SELECT 'AfterFarmerUpdate' UNION ALL SELECT 'AfterFarmerDelete'
) expected
LEFT JOIN information_schema.TRIGGERS existing
 ON existing.TRIGGER_SCHEMA=DATABASE() AND existing.TRIGGER_NAME=expected.TRIGGER_NAME
ORDER BY expected.TRIGGER_NAME;
-- Confirm root@localhost exists and the executing account has CREATE TRIGGER
-- and authority to set that explicit definer. Never substitute CURRENT_USER.
-- MySQL does not automatically halt on STOP. Do not execute the DDL pass until
-- every required preflight passes and any existing UPDATE/DELETE body was reviewed.

-- ===== DDL EXECUTION PASS =====
-- Run this section only after the separately executed preflight returned PASS.
-- Add missing nullable JSON columns; existing audit rows and columns are preserved.
SET @schema_name=DATABASE();
SET @ddl=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND LOWER(TABLE_NAME)='farmer_audit' AND COLUMN_NAME='Old_Values')=0,
 'ALTER TABLE `Farmer_Audit` ADD COLUMN `Old_Values` JSON NULL',
 'SELECT ''Old_Values exists; preflight must confirm nullable JSON'' AS status');
PREPARE fieldwise_stmt FROM @ddl; EXECUTE fieldwise_stmt; DEALLOCATE PREPARE fieldwise_stmt;
SET @ddl=IF((SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=@schema_name AND LOWER(TABLE_NAME)='farmer_audit' AND COLUMN_NAME='New_Values')=0,
 'ALTER TABLE `Farmer_Audit` ADD COLUMN `New_Values` JSON NULL',
 'SELECT ''New_Values exists; preflight must confirm nullable JSON'' AS status');
PREPARE fieldwise_stmt FROM @ddl; EXECUTE fieldwise_stmt; DEALLOCATE PREPARE fieldwise_stmt;

-- PARTIAL FAILURE: if any trigger DROP/CREATE or verification fails, keep writes
-- paused. Do not rerun blindly. Run 12_farmer_audit_triggers_recovery.sql to
-- restore the prior INSERT-only trigger (JSON columns stay by default), verify
-- recovery, diagnose the error, take a fresh backup, then plan another attempt.
DROP TRIGGER IF EXISTS `AfterFarmerInsert`;
-- The script never automatically drops an existing UPDATE/DELETE trigger.
-- If preflight finds either one, inspect ACTION_STATEMENT and SHOW CREATE output.
-- Only after confirming replacement, execute DROP TRIGGER IF EXISTS manually for
-- each existing optional trigger before running the CREATE TRIGGER statements.
-- Example statements (intentionally comments; they do not execute automatically):
-- DROP TRIGGER IF EXISTS `AfterFarmerUpdate`;
-- DROP TRIGGER IF EXISTS `AfterFarmerDelete`;
-- If an existing name was not manually removed after review, its CREATE will fail;
-- do not force past that failure or silently replace the saved behavior.
DELIMITER $$

CREATE DEFINER = 'root'@'localhost' TRIGGER `AfterFarmerInsert`
AFTER INSERT ON `Farmer`
FOR EACH ROW
BEGIN
 INSERT INTO `Farmer_Audit` (Farmer_ID,Farmer_Name,Action_Type,Old_Values,New_Values)
 VALUES (NEW.Farmer_ID,NEW.Name,'INSERT',NULL,
 JSON_OBJECT('Farmer_ID',NEW.Farmer_ID,'Name',NEW.Name,'Phone',NEW.Phone,'Email',NEW.Email,'Address',NEW.Address));
END$$

CREATE DEFINER = 'root'@'localhost' TRIGGER `AfterFarmerUpdate`
AFTER UPDATE ON `Farmer`
FOR EACH ROW
BEGIN
 INSERT INTO `Farmer_Audit` (Farmer_ID,Farmer_Name,Action_Type,Old_Values,New_Values)
 VALUES (NEW.Farmer_ID,NEW.Name,'UPDATE',
 JSON_OBJECT('Farmer_ID',OLD.Farmer_ID,'Name',OLD.Name,'Phone',OLD.Phone,'Email',OLD.Email,'Address',OLD.Address),
 JSON_OBJECT('Farmer_ID',NEW.Farmer_ID,'Name',NEW.Name,'Phone',NEW.Phone,'Email',NEW.Email,'Address',NEW.Address));
END$$

CREATE DEFINER = 'root'@'localhost' TRIGGER `AfterFarmerDelete`
AFTER DELETE ON `Farmer`
FOR EACH ROW
BEGIN
 INSERT INTO `Farmer_Audit` (Farmer_ID,Farmer_Name,Action_Type,Old_Values,New_Values)
 VALUES (OLD.Farmer_ID,OLD.Name,'DELETE',
 JSON_OBJECT('Farmer_ID',OLD.Farmer_ID,'Name',OLD.Name,'Phone',OLD.Phone,'Email',OLD.Email,'Address',OLD.Address),NULL);
END$$
DELIMITER ;

-- POSTFLIGHT: verify all three names, events, AFTER timing, and exact definer.
SELECT TRIGGER_NAME, DEFINER, EVENT_OBJECT_TABLE, EVENT_MANIPULATION, ACTION_TIMING
FROM information_schema.TRIGGERS
WHERE TRIGGER_SCHEMA=DATABASE()
 AND TRIGGER_NAME IN ('AfterFarmerInsert','AfterFarmerUpdate','AfterFarmerDelete')
ORDER BY TRIGGER_NAME;
SELECT CASE WHEN COUNT(*)=3 AND SUM(DEFINER='root@localhost')=3
 AND SUM(LOWER(EVENT_OBJECT_TABLE)='farmer')=3 AND SUM(ACTION_TIMING='AFTER')=3
 AND SUM((TRIGGER_NAME='AfterFarmerInsert' AND EVENT_MANIPULATION='INSERT')
      OR (TRIGGER_NAME='AfterFarmerUpdate' AND EVENT_MANIPULATION='UPDATE')
      OR (TRIGGER_NAME='AfterFarmerDelete' AND EVENT_MANIPULATION='DELETE'))=3
 THEN 'PASS' ELSE 'FAIL: inspect definitions and use recovery if needed' END AS trigger_check
FROM information_schema.TRIGGERS
WHERE TRIGGER_SCHEMA=DATABASE()
 AND TRIGGER_NAME IN ('AfterFarmerInsert','AfterFarmerUpdate','AfterFarmerDelete');
SELECT CASE WHEN COUNT(*)=2
 AND COUNT(DISTINCT COLUMN_NAME)=2
 AND SUM(COLUMN_NAME='Old_Values' AND LOWER(DATA_TYPE)='json' AND IS_NULLABLE='YES')=1
 AND SUM(COLUMN_NAME='New_Values' AND LOWER(DATA_TYPE)='json' AND IS_NULLABLE='YES')=1
 THEN 'PASS: exactly Old_Values and New_Values exist as nullable JSON'
 ELSE 'FAIL: expected exactly two nullable JSON snapshot columns' END AS json_columns_check
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA=DATABASE() AND LOWER(TABLE_NAME)='farmer_audit'
 AND COLUMN_NAME IN ('Old_Values','New_Values');
SHOW CREATE TRIGGER `AfterFarmerInsert`;
SHOW CREATE TRIGGER `AfterFarmerUpdate`;
SHOW CREATE TRIGGER `AfterFarmerDelete`;
SHOW CREATE TABLE `Farmer_Audit`;
SELECT COUNT(*) AS post_migration_audit_rows, MAX(Audit_ID) AS highest_audit_id
FROM `Farmer_Audit`;
SELECT Audit_ID,Farmer_ID,Farmer_Name,Action_Type,Action_Date,Old_Values,New_Values
FROM `Farmer_Audit` ORDER BY Audit_ID DESC LIMIT 20;