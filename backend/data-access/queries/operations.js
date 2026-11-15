// Display-only statements for the DBMS demonstration page. Live results are
// produced by the corresponding repository methods in agricultureRepository.js.
export const operationStatements = {
 ddl: 'CREATE TABLE Farmer (Farmer_ID INT PRIMARY KEY, Name VARCHAR(100) NOT NULL, Phone VARCHAR(15), Email VARCHAR(100), Address VARCHAR(200));',
 alter: 'ALTER TABLE <table_name> ADD <column_or_constraint_definition>;',
 drop: 'DROP TABLE <table_name>; -- destructive example only; not executed',
 ddlRelation: 'FOREIGN KEY (Farmer_ID) REFERENCES Farmer(Farmer_ID)',
 insert: 'INSERT INTO Farmer (Farmer_ID, Name, Phone, Email, Address) VALUES (?, ?, ?, ?, ?);',
 select: 'SELECT * FROM Farmer ORDER BY Farmer_ID DESC;',
 update: 'UPDATE Farmer SET Name=? WHERE Farmer_ID=?;',
 delete: 'DELETE FROM Farmer WHERE Farmer_ID=?;',
 join: 'SELECT f.Farm_ID, f.Farm_Name, fr.Name AS Farmer, l.Village, f.Area FROM Farm f JOIN Farmer fr ON fr.Farmer_ID=f.Farmer_ID LEFT JOIN Location l ON l.Location_ID=f.Location_ID ORDER BY f.Farm_ID LIMIT 8;',
 rightJoin: 'SELECT c.Crop_ID,c.Crop_Name,cu.Cultivation_ID,cu.Farm_ID FROM Cultivation cu RIGHT JOIN Crop c ON c.Crop_ID=cu.Crop_ID ORDER BY c.Crop_ID,cu.Cultivation_ID LIMIT 30;',
 whereOrder: 'SELECT Farm_ID,Farm_Name,Area FROM Farm WHERE Area>0 ORDER BY Area DESC,Farm_ID ASC LIMIT 20;',
 aggregate: 'SELECT COUNT(*) AS farm_count, SUM(Area) AS total_area, AVG(Area) AS average_area, MAX(Area) AS largest_area, MIN(Area) AS smallest_area FROM Farm;',
 group: 'SELECT Crop_ID, COUNT(*) AS cultivation_count FROM Cultivation GROUP BY Crop_ID HAVING COUNT(*)>0 ORDER BY cultivation_count DESC LIMIT 10;',
 nested: 'SELECT Farm_ID, Farm_Name, Area FROM Farm WHERE Area>(SELECT AVG(Area) FROM Farm) ORDER BY Area DESC;',
 correlated: 'SELECT fr.Farmer_ID, fr.Name FROM Farmer fr WHERE EXISTS (SELECT 1 FROM Farm f WHERE f.Farmer_ID=fr.Farmer_ID AND f.Area>(SELECT AVG(f2.Area) FROM Farm f2 WHERE f2.Farmer_ID=fr.Farmer_ID)) ORDER BY fr.Farmer_ID;',
 farmerProcedure: 'CALL GetFarmerDetails(?);',
 farmsProcedure: 'CALL GetFarmsByFarmer(?);',
 areaFunction: 'SELECT GetTotalFarmArea(?) AS total_area;',
 trigger: 'INSERT INTO Farmer (Farmer_ID, Name, Phone, Email, Address) VALUES (?, ?, ?, ?, ?); -- MySQL invokes AfterFarmerInsert. UPDATE and DELETE invoke AfterFarmerUpdate and AfterFarmerDelete; JSON_OBJECT snapshots are stored in Farmer_Audit.',
 view: 'CREATE OR REPLACE ALGORITHM=UNDEFINED SQL SECURITY INVOKER VIEW Farmer_Farm_Summary AS SELECT fr.Farmer_ID,fr.Name AS Farmer_Name,f.Farm_ID,f.Farm_Name,f.Area,f.Soil_Type,f.Location_ID,l.Village,l.District,l.State FROM farmer fr LEFT JOIN farm f ON f.Farmer_ID=fr.Farmer_ID LEFT JOIN location l ON l.Location_ID=f.Location_ID;',
 viewSelect: 'SELECT Farmer_ID,Farmer_Name,Farm_ID,Farm_Name,Area,Soil_Type,Location_ID,Village,District,State FROM Farmer_Farm_Summary ORDER BY Farmer_ID,Farm_ID;',
 transaction: 'START TRANSACTION; SELECT Farm_ID FROM Farm WHERE Farm_ID=? FOR UPDATE; SELECT Crop_ID FROM Crop WHERE Crop_ID=? FOR UPDATE; INSERT INTO Cultivation (...) VALUES (...); COMMIT; -- ROLLBACK on failure'
}
