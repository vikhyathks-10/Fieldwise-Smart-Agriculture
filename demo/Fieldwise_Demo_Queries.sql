-- Fieldwise Smart Agriculture DBMS demonstration queries
-- Schema/table definitions were checked against the project's SQL scripts.
-- The inspected schema name is lowercase `smartagriculturedb`.
-- Run read-only queries individually. For Query 10, execute the entire block
-- through ROLLBACK in one Workbench action. Query 11 is also fully rolled back.

USE `smartagriculturedb`;

-- =====================================================
-- QUERY 1: BASIC FARMER DETAILS
-- Concept: SELECT, WHERE, ORDER BY
-- Purpose: Retrieve farmer details alphabetically.
-- Expected output: One row per farmer with a non-NULL name.
-- =====================================================
SELECT Farmer_ID, Name, Phone, Email, Address
FROM Farmer
WHERE Name IS NOT NULL
ORDER BY Name ASC, Farmer_ID ASC;


-- =====================================================
-- QUERY 2: FARMER AND FARM DETAILS
-- Concept: INNER JOIN
-- Purpose: Display each farmer with their associated farms.
-- Expected output: One row per farm that has a matching farmer.
-- =====================================================
SELECT fr.Farmer_ID, fr.Name AS Farmer_Name,
       f.Farm_ID, f.Farm_Name, f.Area, f.Soil_Type
FROM Farmer AS fr
INNER JOIN Farm AS f ON f.Farmer_ID = fr.Farmer_ID
ORDER BY fr.Name, f.Farm_Name, f.Farm_ID;


-- =====================================================
-- QUERY 3: FARMER, FARM AND LOCATION
-- Concept: Multiple-table JOIN, INNER JOIN, LEFT JOIN
-- Purpose: Show farm ownership and its optional location details.
-- Expected output: One row per farm; location fields can be NULL.
-- =====================================================
SELECT fr.Farmer_ID, fr.Name AS Farmer_Name,
       f.Farm_ID, f.Farm_Name, f.Area,
       l.Location_ID, l.Village, l.District, l.State, l.Pincode
FROM Farmer AS fr
INNER JOIN Farm AS f ON f.Farmer_ID = fr.Farmer_ID
LEFT JOIN Location AS l ON l.Location_ID = f.Location_ID
ORDER BY fr.Name, f.Farm_ID;


-- =====================================================
-- QUERY 4: FARMER, FARM AND CULTIVATED-AREA TOTALS
-- Concept: Aggregate functions, scalar subqueries, EXISTS
-- Purpose: Count farmers and farms, and sum areas of farms with cultivation.
-- Expected output: One summary row; cultivated farms are counted once each.
-- =====================================================
SELECT
  (SELECT COUNT(*) FROM Farmer) AS Total_Farmers,
  (SELECT COUNT(*) FROM Farm) AS Total_Farms,
  COALESCE((
    SELECT SUM(f.Area)
    FROM Farm AS f
    WHERE EXISTS (
      SELECT 1
      FROM Cultivation AS cu
      WHERE cu.Farm_ID = f.Farm_ID
    )
  ), 0) AS Total_Cultivated_Farm_Area;


-- =====================================================
-- QUERY 5: NUMBER OF FARMS PER FARMER
-- Concept: INNER JOIN, GROUP BY, HAVING, COUNT
-- Purpose: Count each farmer's farms and retain groups with at least one farm.
-- Expected output: One row per farmer who owns one or more farms.
-- =====================================================
SELECT fr.Farmer_ID, fr.Name AS Farmer_Name,
       COUNT(f.Farm_ID) AS Farm_Count,
       COALESCE(SUM(f.Area), 0) AS Total_Farm_Area
FROM Farmer AS fr
INNER JOIN Farm AS f ON f.Farmer_ID = fr.Farmer_ID
GROUP BY fr.Farmer_ID, fr.Name
HAVING COUNT(f.Farm_ID) >= 1
ORDER BY Farm_Count DESC, Total_Farm_Area DESC, fr.Name;


-- =====================================================
-- QUERY 6: FARMERS ABOVE THE AVERAGE FARM AREA
-- Concept: GROUP BY, aggregate function, subquery, HAVING
-- Purpose: Find farmers whose combined farm area exceeds the average area
--          of one farm in the database.
-- Expected output: Farmers whose summed area is greater than AVG(Farm.Area).
-- =====================================================
SELECT fr.Farmer_ID, fr.Name AS Farmer_Name,
       SUM(f.Area) AS Farmer_Total_Area,
       (SELECT AVG(Area) FROM Farm) AS Average_Single_Farm_Area
FROM Farmer AS fr
INNER JOIN Farm AS f ON f.Farmer_ID = fr.Farmer_ID
GROUP BY fr.Farmer_ID, fr.Name
HAVING SUM(f.Area) > (SELECT AVG(Area) FROM Farm)
ORDER BY Farmer_Total_Area DESC, fr.Name;


-- =====================================================
-- QUERY 7: FARMER AND FARM SUMMARY VIEW
-- Concept: CREATE VIEW / SELECT from a view, LEFT JOIN result
-- Purpose: Read the existing Farmer_Farm_Summary database view.
-- Expected output: Farmer/farm/location summary; farmers without farms remain.
-- =====================================================
SELECT Farmer_ID, Farmer_Name, Farm_ID, Farm_Name,
       Area, Soil_Type, Location_ID, Village, District, State
FROM Farmer_Farm_Summary
ORDER BY Farmer_Name, Farm_ID;


-- =====================================================
-- QUERY 8: STORED PROCEDURE — FARMER DETAILS
-- Concept: Stored procedure call with a value selected from existing data.
-- Purpose: Call GetFarmerDetails for the first farmer by ID.
-- Expected output: Farmer details; if Farmer is empty, the procedure returns
--                  an empty result set without modifying data.
-- =====================================================
SET @fieldwise_demo_farmer_id = (
  SELECT Farmer_ID FROM Farmer ORDER BY Farmer_ID LIMIT 1
);
CALL GetFarmerDetails(@fieldwise_demo_farmer_id);


-- =====================================================
-- QUERY 9: USER-DEFINED FUNCTION — TOTAL FARM AREA
-- Concept: User-defined function, scalar SELECT
-- Purpose: Calculate the total area for an existing farmer.
-- Expected output: One row with the selected farmer ID and total area;
--                  the function returns 0 when that farmer owns no farms.
-- =====================================================
SET @fieldwise_area_farmer_id = (
  SELECT Farmer_ID FROM Farmer ORDER BY Farmer_ID LIMIT 1
);
SELECT @fieldwise_area_farmer_id AS Farmer_ID,
       GetTotalFarmArea(@fieldwise_area_farmer_id) AS Total_Farm_Area;


-- =====================================================
-- QUERY 10: INSERT TRIGGER AND AUDIT TABLE (ROLLBACK DEMO)
-- Concept: AFTER INSERT trigger, transaction, audit verification, ROLLBACK
-- Purpose: Insert a temporary Farmer only if its generated ID is unused,
--          verify AfterFarmerInsert wrote Farmer_Audit, then undo both rows.
-- Expected output: The preflight says whether the random candidate is in use;
--                  the audit SELECT shows a matching row if the trigger exists;
--                  the final counts after ROLLBACK are zero.
-- SAFETY: Execute this whole block at once through ROLLBACK. Do not omit it.
-- =====================================================
START TRANSACTION;

-- Farmer_ID is an INT primary key without AUTO_INCREMENT. A random candidate
-- is checked and the INSERT itself is guarded by NOT EXISTS. The PK remains
-- the final protection against a concurrent ID collision.
SET @fieldwise_demo_trigger_id = FLOOR(RAND() * 2147483646) + 1;
SET @fieldwise_demo_trigger_name = CONCAT('Fieldwise Demo ', UUID());

SELECT @fieldwise_demo_trigger_id AS Candidate_Farmer_ID,
       EXISTS (
         SELECT 1 FROM Farmer
         WHERE Farmer_ID = @fieldwise_demo_trigger_id
       ) AS Candidate_ID_Already_Used;

INSERT INTO Farmer (Farmer_ID, Name, Phone, Email, Address)
SELECT @fieldwise_demo_trigger_id,
       @fieldwise_demo_trigger_name,
       NULL, NULL, NULL
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM Farmer
  WHERE Farmer_ID = @fieldwise_demo_trigger_id
);

-- A matching result proves that the AFTER INSERT trigger wrote the audit row.
SELECT Audit_ID, Farmer_ID, Farmer_Name, Action_Type, Action_Date
FROM Farmer_Audit
WHERE Farmer_ID = @fieldwise_demo_trigger_id
  AND Farmer_Name = @fieldwise_demo_trigger_name
  AND Action_Type = 'INSERT'
ORDER BY Audit_ID DESC;

-- Farmer and Farmer_Audit use InnoDB, so this rolls back both temporary rows.
ROLLBACK;

SELECT
  (SELECT COUNT(*) FROM Farmer
   WHERE Farmer_ID = @fieldwise_demo_trigger_id) AS Temporary_Farmer_Rows_Remaining,
  (SELECT COUNT(*) FROM Farmer_Audit
   WHERE Farmer_ID = @fieldwise_demo_trigger_id
     AND Farmer_Name = @fieldwise_demo_trigger_name
     AND Action_Type = 'INSERT') AS Temporary_Audit_Rows_Remaining;


-- =====================================================
-- QUERY 11: TRANSACTION WITH UPDATE AND ROLLBACK
-- Concept: START TRANSACTION, UPDATE, read-your-writes, ROLLBACK
-- Purpose: Temporarily increase one existing farm's area by 0.01, display it,
--          and prove that the original value is restored after ROLLBACK.
-- Expected output: The in-transaction area is 0.01 greater (or 0.01 if NULL);
--                  the post-rollback area matches the original value.
-- =====================================================
SET @fieldwise_demo_farm_id = (
  SELECT Farm_ID FROM Farm ORDER BY Farm_ID LIMIT 1
);

SELECT Farm_ID, Area AS Area_Before_Transaction
FROM Farm
WHERE Farm_ID = @fieldwise_demo_farm_id;

START TRANSACTION;

UPDATE Farm
SET Area = COALESCE(Area, 0) + 0.01
WHERE Farm_ID = @fieldwise_demo_farm_id;

SELECT Farm_ID, Area AS Area_Inside_Transaction
FROM Farm
WHERE Farm_ID = @fieldwise_demo_farm_id;

ROLLBACK;

SELECT Farm_ID, Area AS Area_After_Rollback
FROM Farm
WHERE Farm_ID = @fieldwise_demo_farm_id;


-- =====================================================
-- QUERY 12: FARM CULTIVATION, FERTILIZER AND SOIL ANALYTICS
-- Concept: Multiple LEFT JOINs, derived tables, GROUP_CONCAT, aggregates
-- Purpose: Summarize crop cultivation, fertilizer use and soil tests per farm.
-- Expected output: One row per farm; missing optional activity appears as 0
--                  counts/quantities or NULL crop/pH details.
-- =====================================================
SELECT fr.Farmer_ID, fr.Name AS Farmer_Name,
       f.Farm_ID, f.Farm_Name, f.Area AS Farm_Area,
       COALESCE(cultivation_summary.Cultivation_Count, 0) AS Cultivation_Count,
       cultivation_summary.Crop_Names,
       COALESCE(fertilizer_summary.Fertilizer_Usage_Count, 0) AS Fertilizer_Usage_Count,
       COALESCE(fertilizer_summary.Total_Fertilizer_Quantity, 0) AS Total_Fertilizer_Quantity,
       COALESCE(soil_summary.Soil_Test_Count, 0) AS Soil_Test_Count,
       ROUND(soil_summary.Average_pH, 2) AS Average_pH
FROM Farm AS f
INNER JOIN Farmer AS fr ON fr.Farmer_ID = f.Farmer_ID
LEFT JOIN (
  SELECT cu.Farm_ID,
         COUNT(DISTINCT cu.Cultivation_ID) AS Cultivation_Count,
         GROUP_CONCAT(DISTINCT c.Crop_Name ORDER BY c.Crop_Name SEPARATOR ', ') AS Crop_Names
  FROM Cultivation AS cu
  INNER JOIN Crop AS c ON c.Crop_ID = cu.Crop_ID
  GROUP BY cu.Farm_ID
) AS cultivation_summary ON cultivation_summary.Farm_ID = f.Farm_ID
LEFT JOIN (
  SELECT cu.Farm_ID,
         COUNT(fu.Usage_ID) AS Fertilizer_Usage_Count,
         SUM(fu.Quantity) AS Total_Fertilizer_Quantity
  FROM Cultivation AS cu
  INNER JOIN Fertilizer_Usage AS fu ON fu.Cultivation_ID = cu.Cultivation_ID
  GROUP BY cu.Farm_ID
) AS fertilizer_summary ON fertilizer_summary.Farm_ID = f.Farm_ID
LEFT JOIN (
  SELECT st.Farm_ID,
         COUNT(st.Soil_Test_ID) AS Soil_Test_Count,
         AVG(st.pH_Level) AS Average_pH
  FROM Soil_Test AS st
  GROUP BY st.Farm_ID
) AS soil_summary ON soil_summary.Farm_ID = f.Farm_ID
ORDER BY fr.Name, f.Farm_ID;
