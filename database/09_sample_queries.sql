USE `smartagriculturedb`;

-- Existing relational data and the installed summary view.
SELECT * FROM `Farmer_Farm_Summary` ORDER BY Farmer_ID, Farm_ID;

-- Join, filter, and order example.
SELECT f.Farm_ID, f.Farm_Name, fr.Name AS Farmer, l.Village, f.Area
FROM Farm AS f
INNER JOIN Farmer AS fr ON fr.Farmer_ID = f.Farmer_ID
LEFT JOIN Location AS l ON l.Location_ID = f.Location_ID
WHERE f.Area > 0
ORDER BY f.Area DESC, f.Farm_ID;

-- Aggregate and HAVING example.
SELECT Farmer_ID, COUNT(*) AS farm_count, SUM(Area) AS total_area
FROM Farm
GROUP BY Farmer_ID
HAVING COUNT(*) > 0
ORDER BY total_area DESC;

-- Nested and correlated EXISTS examples.
SELECT Farm_ID, Farm_Name, Area
FROM Farm
WHERE Area > (SELECT AVG(Area) FROM Farm)
ORDER BY Area DESC;

SELECT fr.Farmer_ID, fr.Name
FROM Farmer AS fr
WHERE EXISTS (
  SELECT 1
  FROM Farm AS f
  WHERE f.Farmer_ID = fr.Farmer_ID
    AND f.Area > (SELECT AVG(f2.Area) FROM Farm AS f2 WHERE f2.Farmer_ID = fr.Farmer_ID)
);

-- Stored routine/function demonstrations. Supply an existing ID when prompted.
-- CALL GetFarmerDetails(1);
-- CALL GetFarmsByFarmer(1);
-- SELECT GetTotalFarmArea(1) AS total_area;

-- INSERT / UPDATE / DELETE templates intentionally have no sample data values.
-- Use the parameterized application CRUD operations; do not paste invented records here.
