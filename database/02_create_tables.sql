-- Exact live-table columns and primary keys captured from MySQL 8.0.46.
-- IF NOT EXISTS preserves existing tables and their rows; it does not migrate drift.
USE `smartagriculturedb`;

CREATE TABLE IF NOT EXISTS `advisory` (
  `Advisory_ID` int NOT NULL,
  `Pest_ID` int DEFAULT NULL,
  `Title` varchar(150) NOT NULL,
  `Description` text,
  `Advisory_Date` date DEFAULT NULL,
  `Type` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`Advisory_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `crop` (
  `Crop_ID` int NOT NULL,
  `Crop_Name` varchar(100) NOT NULL,
  `Crop_Type` varchar(50) DEFAULT NULL,
  `Season` varchar(50) DEFAULT NULL,
  `Duration` int DEFAULT NULL,
  PRIMARY KEY (`Crop_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `cultivation` (
  `Cultivation_ID` int NOT NULL,
  `Farm_ID` int NOT NULL,
  `Crop_ID` int NOT NULL,
  `Start_Date` date DEFAULT NULL,
  `End_Date` date DEFAULT NULL,
  `Status` varchar(50) DEFAULT NULL,
  `Yield_Estimate` decimal(10,2) DEFAULT NULL,
  `Remarks` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`Cultivation_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `farm` (
  `Farm_ID` int NOT NULL,
  `Farmer_ID` int NOT NULL,
  `Farm_Name` varchar(100) DEFAULT NULL,
  `Area` decimal(10,2) DEFAULT NULL,
  `Soil_Type` varchar(50) DEFAULT NULL,
  `Location_ID` int DEFAULT NULL,
  PRIMARY KEY (`Farm_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `farmer` (
  `Farmer_ID` int NOT NULL,
  `Name` varchar(100) NOT NULL,
  `Phone` varchar(15) DEFAULT NULL,
  `Email` varchar(100) DEFAULT NULL,
  `Address` varchar(200) DEFAULT NULL,
  PRIMARY KEY (`Farmer_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `farmer_audit` (
  `Audit_ID` int NOT NULL AUTO_INCREMENT,
  `Farmer_ID` int DEFAULT NULL,
  `Farmer_Name` varchar(100) DEFAULT NULL,
  `Action_Type` varchar(20) DEFAULT NULL,
  `Action_Date` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
    `Old_Values` JSON NULL,
    `New_Values` JSON NULL,
  PRIMARY KEY (`Audit_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `fertilizer` (
  `Fertilizer_ID` int NOT NULL,
  `Name` varchar(100) NOT NULL,
  `Type` varchar(50) DEFAULT NULL,
  `Nutrient_Content` varchar(200) DEFAULT NULL,
  `Price` decimal(10,2) DEFAULT NULL,
  PRIMARY KEY (`Fertilizer_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `fertilizer_usage` (
  `Usage_ID` int NOT NULL,
  `Cultivation_ID` int NOT NULL,
  `Fertilizer_ID` int NOT NULL,
  `Quantity` decimal(10,2) DEFAULT NULL,
  `Usage_Date` date DEFAULT NULL,
  `Method` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`Usage_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `location` (
  `Location_ID` int NOT NULL,
  `Village` varchar(100) DEFAULT NULL,
  `District` varchar(100) DEFAULT NULL,
  `State` varchar(100) DEFAULT NULL,
  `Pincode` varchar(10) DEFAULT NULL,
  `Latitude` decimal(10,7) DEFAULT NULL,
  `Longitude` decimal(10,7) DEFAULT NULL,
  PRIMARY KEY (`Location_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `market` (
  `Market_ID` int NOT NULL,
  `Market_Name` varchar(100) NOT NULL,
  `Market_Type` varchar(50) DEFAULT NULL,
  `Location_ID` int DEFAULT NULL,
  PRIMARY KEY (`Market_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `market_price` (
  `Price_ID` int NOT NULL,
  `Market_ID` int NOT NULL,
  `Crop_ID` int NOT NULL,
  `Price` decimal(10,2) NOT NULL,
  `Date` date NOT NULL,
  PRIMARY KEY (`Price_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `pest_disease` (
  `Pest_ID` int NOT NULL,
  `Name` varchar(100) NOT NULL,
  `Type` varchar(50) DEFAULT NULL,
  `Symptoms` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`Pest_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `soil_test` (
  `Soil_Test_ID` int NOT NULL,
  `Farm_ID` int NOT NULL,
  `Test_Date` date NOT NULL,
  `pH_Level` decimal(4,2) DEFAULT NULL,
  `Nitrogen` decimal(8,2) DEFAULT NULL,
  `Phosphorus` decimal(8,2) DEFAULT NULL,
  `Potassium` decimal(8,2) DEFAULT NULL,
  PRIMARY KEY (`Soil_Test_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `weather` (
  `Weather_ID` int NOT NULL,
  `Location_ID` int NOT NULL,
  `Date` date NOT NULL,
  `Temperature` decimal(5,2) DEFAULT NULL,
  `Rainfall` decimal(8,2) DEFAULT NULL,
  `Humidity` decimal(5,2) DEFAULT NULL,
  `Wind_Speed` decimal(6,2) DEFAULT NULL,
  PRIMARY KEY (`Weather_ID`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
