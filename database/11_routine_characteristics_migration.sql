USE `smartagriculturedb`;

-- Proposed correction for the existing MySQL 8.0.46 routines.
-- Do not execute until the preflight checklist in database/README.md is complete.
-- This script changes only the two named procedure characteristics and the
-- named function. It does not modify tables or application records.
--
-- Rerunning is technically repeatable after success, but it re-runs both ALTERs
-- and DROPs/recreates GetTotalFarmArea each time. Do not rerun casually.
--
-- The procedure ALTER statements preserve the existing procedure bodies,
-- parameters, result sets, definers, and security characteristics.
ALTER PROCEDURE `GetFarmerDetails` READS SQL DATA;
ALTER PROCEDURE `GetFarmsByFarmer` READS SQL DATA;

-- ALTER FUNCTION cannot change DETERMINISTIC. A DROP/CREATE is required.
-- The function is unavailable between these two statements; quiesce callers.
-- The definer is pinned to the exact value returned by the current SHOW CREATE.
-- The migration operator needs ALTER ROUTINE, CREATE ROUTINE, and any required
-- SET_USER_ID or administrative privilege documented in the preflight checklist.
SET @fieldwise_saved_sql_mode := @@SESSION.sql_mode;
SET @fieldwise_saved_character_set_client := @@SESSION.character_set_client;
SET @fieldwise_saved_character_set_results := @@SESSION.character_set_results;
SET @fieldwise_saved_character_set_connection := @@SESSION.character_set_connection;
SET @fieldwise_saved_collation_connection := @@SESSION.collation_connection;
SET SESSION sql_mode = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';
SET NAMES utf8mb4 COLLATE utf8mb4_0900_ai_ci;

DROP FUNCTION IF EXISTS `GetTotalFarmArea`;
DELIMITER $$
CREATE DEFINER = 'root'@'localhost' FUNCTION `GetTotalFarmArea`(p_Farmer_ID INT)
RETURNS DECIMAL(10,2)
NOT DETERMINISTIC
READS SQL DATA
BEGIN
  DECLARE total_area DECIMAL(10,2);
  SELECT COALESCE(SUM(Area), 0)
    INTO total_area
    FROM Farm
    WHERE Farmer_ID = p_Farmer_ID;
  RETURN total_area;
END$$
DELIMITER ;

SET SESSION character_set_client = @fieldwise_saved_character_set_client;
SET SESSION character_set_results = @fieldwise_saved_character_set_results;
SET SESSION character_set_connection = @fieldwise_saved_character_set_connection;
SET SESSION collation_connection = @fieldwise_saved_collation_connection;
SET SESSION sql_mode = @fieldwise_saved_sql_mode;

-- Verify with the SHOW CREATE statements in database/README.md.