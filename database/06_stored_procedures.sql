USE `smartagriculturedb`;
DELIMITER $$

CREATE PROCEDURE `GetFarmerDetails`(IN p_Farmer_ID INT)
READS SQL DATA
BEGIN
  SELECT Farmer_ID, Name, Phone, Email, Address
  FROM Farmer
  WHERE Farmer_ID = p_Farmer_ID;
END$$

CREATE PROCEDURE `GetFarmsByFarmer`(IN p_Farmer_ID INT)
READS SQL DATA
BEGIN
  SELECT Farm_ID, Farmer_ID, Farm_Name, Area, Soil_Type, Location_ID
  FROM Farm
  WHERE Farmer_ID = p_Farmer_ID;
END$$

DELIMITER ;
