USE `smartagriculturedb`;

-- Emergency restoration only if the reviewed migration has dropped
-- GetTotalFarmArea and its recreation failed. This restores the exact live
-- definition captured by SHOW CREATE FUNCTION before correction, including its
-- current definer and routine characteristics. It restores availability, but
-- also restores the original (incorrect) DETERMINISTIC declaration.
-- Run only after confirming the function is absent or intentionally replacing
-- it, and only when the original definer account and privileges are available.
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
READS SQL DATA
DETERMINISTIC
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