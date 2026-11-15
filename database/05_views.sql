-- Read-only summary view; excludes contact fields and preserves farmers without farms.
USE `smartagriculturedb`;

CREATE OR REPLACE
  ALGORITHM = UNDEFINED
  SQL SECURITY INVOKER
VIEW `Farmer_Farm_Summary` AS
SELECT
  fr.`Farmer_ID`,
  fr.`Name` AS `Farmer_Name`,
  f.`Farm_ID`,
  f.`Farm_Name`,
  f.`Area`,
  f.`Soil_Type`,
  f.`Location_ID`,
  l.`Village`,
  l.`District`,
  l.`State`
FROM `farmer` AS fr
LEFT JOIN `farm` AS f ON f.`Farmer_ID` = fr.`Farmer_ID`
LEFT JOIN `location` AS l ON l.`Location_ID` = f.`Location_ID`;
