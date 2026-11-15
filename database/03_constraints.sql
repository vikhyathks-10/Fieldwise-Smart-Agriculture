-- Idempotently adds the 12 live foreign keys if the named constraints are absent.
-- Parent tables must exist first. Run after 02_create_tables.sql.
USE `smartagriculturedb`;
SET @schema_name = DATABASE();

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=@schema_name AND TABLE_NAME='advisory' AND CONSTRAINT_NAME='advisory_ibfk_1')=0,
  'ALTER TABLE `advisory` ADD CONSTRAINT `advisory_ibfk_1` FOREIGN KEY (`Pest_ID`) REFERENCES `pest_disease` (`Pest_ID`)', 'SELECT ''advisory_ibfk_1 already exists'' AS status');
PREPARE fieldwise_stmt FROM @ddl; EXECUTE fieldwise_stmt; DEALLOCATE PREPARE fieldwise_stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=@schema_name AND TABLE_NAME='cultivation' AND CONSTRAINT_NAME='cultivation_ibfk_1')=0,
  'ALTER TABLE `cultivation` ADD CONSTRAINT `cultivation_ibfk_1` FOREIGN KEY (`Farm_ID`) REFERENCES `farm` (`Farm_ID`)', 'SELECT ''cultivation_ibfk_1 already exists'' AS status');
PREPARE fieldwise_stmt FROM @ddl; EXECUTE fieldwise_stmt; DEALLOCATE PREPARE fieldwise_stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=@schema_name AND TABLE_NAME='cultivation' AND CONSTRAINT_NAME='cultivation_ibfk_2')=0,
  'ALTER TABLE `cultivation` ADD CONSTRAINT `cultivation_ibfk_2` FOREIGN KEY (`Crop_ID`) REFERENCES `crop` (`Crop_ID`)', 'SELECT ''cultivation_ibfk_2 already exists'' AS status');
PREPARE fieldwise_stmt FROM @ddl; EXECUTE fieldwise_stmt; DEALLOCATE PREPARE fieldwise_stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=@schema_name AND TABLE_NAME='farm' AND CONSTRAINT_NAME='farm_ibfk_1')=0,
  'ALTER TABLE `farm` ADD CONSTRAINT `farm_ibfk_1` FOREIGN KEY (`Farmer_ID`) REFERENCES `farmer` (`Farmer_ID`)', 'SELECT ''farm_ibfk_1 already exists'' AS status');
PREPARE fieldwise_stmt FROM @ddl; EXECUTE fieldwise_stmt; DEALLOCATE PREPARE fieldwise_stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=@schema_name AND TABLE_NAME='farm' AND CONSTRAINT_NAME='farm_ibfk_2')=0,
  'ALTER TABLE `farm` ADD CONSTRAINT `farm_ibfk_2` FOREIGN KEY (`Location_ID`) REFERENCES `location` (`Location_ID`)', 'SELECT ''farm_ibfk_2 already exists'' AS status');
PREPARE fieldwise_stmt FROM @ddl; EXECUTE fieldwise_stmt; DEALLOCATE PREPARE fieldwise_stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=@schema_name AND TABLE_NAME='fertilizer_usage' AND CONSTRAINT_NAME='fertilizer_usage_ibfk_1')=0,
  'ALTER TABLE `fertilizer_usage` ADD CONSTRAINT `fertilizer_usage_ibfk_1` FOREIGN KEY (`Cultivation_ID`) REFERENCES `cultivation` (`Cultivation_ID`)', 'SELECT ''fertilizer_usage_ibfk_1 already exists'' AS status');
PREPARE fieldwise_stmt FROM @ddl; EXECUTE fieldwise_stmt; DEALLOCATE PREPARE fieldwise_stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=@schema_name AND TABLE_NAME='fertilizer_usage' AND CONSTRAINT_NAME='fertilizer_usage_ibfk_2')=0,
  'ALTER TABLE `fertilizer_usage` ADD CONSTRAINT `fertilizer_usage_ibfk_2` FOREIGN KEY (`Fertilizer_ID`) REFERENCES `fertilizer` (`Fertilizer_ID`)', 'SELECT ''fertilizer_usage_ibfk_2 already exists'' AS status');
PREPARE fieldwise_stmt FROM @ddl; EXECUTE fieldwise_stmt; DEALLOCATE PREPARE fieldwise_stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=@schema_name AND TABLE_NAME='market' AND CONSTRAINT_NAME='market_ibfk_1')=0,
  'ALTER TABLE `market` ADD CONSTRAINT `market_ibfk_1` FOREIGN KEY (`Location_ID`) REFERENCES `location` (`Location_ID`)', 'SELECT ''market_ibfk_1 already exists'' AS status');
PREPARE fieldwise_stmt FROM @ddl; EXECUTE fieldwise_stmt; DEALLOCATE PREPARE fieldwise_stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=@schema_name AND TABLE_NAME='market_price' AND CONSTRAINT_NAME='market_price_ibfk_1')=0,
  'ALTER TABLE `market_price` ADD CONSTRAINT `market_price_ibfk_1` FOREIGN KEY (`Market_ID`) REFERENCES `market` (`Market_ID`)', 'SELECT ''market_price_ibfk_1 already exists'' AS status');
PREPARE fieldwise_stmt FROM @ddl; EXECUTE fieldwise_stmt; DEALLOCATE PREPARE fieldwise_stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=@schema_name AND TABLE_NAME='market_price' AND CONSTRAINT_NAME='market_price_ibfk_2')=0,
  'ALTER TABLE `market_price` ADD CONSTRAINT `market_price_ibfk_2` FOREIGN KEY (`Crop_ID`) REFERENCES `crop` (`Crop_ID`)', 'SELECT ''market_price_ibfk_2 already exists'' AS status');
PREPARE fieldwise_stmt FROM @ddl; EXECUTE fieldwise_stmt; DEALLOCATE PREPARE fieldwise_stmt;

SET @ddl = IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=@schema_name AND TABLE_NAME='soil_test' AND CONSTRAINT_NAME='soil_test_ibfk_1')=0,
  'ALTER TABLE `soil_test` ADD CONSTRAINT `soil_test_ibfk_1` FOREIGN KEY (`Farm_ID`) REFERENCES `farm` (`Farm_ID`)', 'SELECT ''soil_test_ibfk_1 already exists'' AS status');
PREPARE fieldwise_stmt FROM @ddl; EXECUTE fieldwise_stmt; DEALLOCATE PREPARE fieldwise_stmt;
SET @ddl = IF((SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=@schema_name AND TABLE_NAME='weather' AND CONSTRAINT_NAME='weather_ibfk_1')=0,
  'ALTER TABLE `weather` ADD CONSTRAINT `weather_ibfk_1` FOREIGN KEY (`Location_ID`) REFERENCES `location` (`Location_ID`)', 'SELECT ''weather_ibfk_1 already exists'' AS status');
PREPARE fieldwise_stmt FROM @ddl; EXECUTE fieldwise_stmt; DEALLOCATE PREPARE fieldwise_stmt;
