USE `smartagriculturedb`;
DELIMITER $$

CREATE FUNCTION `GetTotalFarmArea`(p_Farmer_ID INT)
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
