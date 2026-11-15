import { pool } from '../../database/connection/pool.js'
import { tables } from '../../../shared/schema.js'
import { operationStatements } from '../queries/operations.js'
import '../../database/config/env.js'
export const agricultureRepository = {
 async health(){await pool.query('SELECT 1');return{ok:true,database:process.env.DB_NAME||'SmartAgricultureDB'}},
 async dashboard(){
  const counts=Object.fromEntries(await Promise.all(Object.entries(tables).map(async([slug,m])=>{const [r]=await pool.query(`SELECT COUNT(*) AS total FROM \`${m.table}\``);return[slug,r[0].total]})))
  const [area]=await pool.query('SELECT COUNT(*) AS farms, COALESCE(SUM(Area),0) AS total_area, COALESCE(AVG(Area),0) AS average_area, COALESCE(MAX(Area),0) AS largest_area, COALESCE(MIN(Area),0) AS smallest_area FROM Farm')
  const [activeCultivations]=await pool.query('SELECT COUNT(*) AS total FROM Cultivation WHERE (Start_Date IS NULL OR Start_Date<=CURDATE()) AND (End_Date IS NULL OR End_Date>=CURDATE())')
  const [cropRows]=await pool.query('SELECT c.Crop_Name AS name, COUNT(*) AS value FROM Cultivation cu JOIN Crop c ON c.Crop_ID=cu.Crop_ID GROUP BY c.Crop_ID,c.Crop_Name ORDER BY value DESC LIMIT 8')
  const [recentFarmers]=await pool.query('SELECT Farmer_ID, Name, Phone FROM Farmer ORDER BY Farmer_ID DESC LIMIT 5')
  const [prices]=await pool.query('SELECT c.Crop_Name AS crop,m.Market_Name AS market,mp.Price AS price,mp.Date AS date FROM Market_Price mp JOIN Crop c ON c.Crop_ID=mp.Crop_ID JOIN Market m ON m.Market_ID=mp.Market_ID ORDER BY mp.Date DESC LIMIT 6')
  const [soil]=await pool.query('SELECT COALESCE(AVG(pH_Level),0) AS average_ph, COUNT(*) AS tests FROM Soil_Test')
  const [fertilizer]=await pool.query('SELECT COALESCE(SUM(Quantity),0) AS total_quantity FROM Fertilizer_Usage')
  const [farmAreasByFarmer]=await pool.query('SELECT f.Farmer_ID,fr.Name AS farmer,COUNT(*) AS farm_count,SUM(f.Area) AS total_area FROM Farm f JOIN Farmer fr ON fr.Farmer_ID=f.Farmer_ID GROUP BY f.Farmer_ID,fr.Name HAVING SUM(f.Area)>0 ORDER BY total_area DESC LIMIT 6')
  const [fertilizerByName]=await pool.query('SELECT f.Name AS name,COALESCE(SUM(u.Quantity),0) AS quantity,COUNT(u.Usage_ID) AS applications FROM Fertilizer f LEFT JOIN Fertilizer_Usage u ON u.Fertilizer_ID=f.Fertilizer_ID GROUP BY f.Fertilizer_ID,f.Name ORDER BY quantity DESC LIMIT 8')
  const [soilTypes]=await pool.query('SELECT COALESCE(Soil_Type,\'Not recorded\') AS name,COUNT(*) AS value FROM Farm GROUP BY Soil_Type ORDER BY value DESC')
  const [weatherStats]=await pool.query('SELECT COUNT(*) AS records,MAX(Date) AS latest_date,AVG(Temperature) AS average_temperature,AVG(Rainfall) AS average_rainfall,AVG(Humidity) AS average_humidity FROM Weather')
  const [marketStats]=await pool.query('SELECT COUNT(*) AS records,MIN(Price) AS lowest_price,MAX(Price) AS highest_price,AVG(Price) AS average_price,MAX(Date) AS latest_date FROM Market_Price')
  const [recentAdvisories]=await pool.query('SELECT a.Advisory_ID,a.Title,a.Type,a.Advisory_Date,p.Name AS pest_name FROM Advisory a LEFT JOIN Pest_Disease p ON p.Pest_ID=a.Pest_ID ORDER BY a.Advisory_Date DESC,a.Advisory_ID DESC LIMIT 5')
  return {counts,area:area[0].total_area,areaStats:area[0],activeCultivations:activeCultivations[0].total,cropRows,recentFarmers,prices,soil:soil[0],fertilizer:fertilizer[0],farmAreasByFarmer,fertilizerByName,soilTypes,weatherStats:weatherStats[0],marketStats:marketStats[0],recentAdvisories}
 },
 async farmerDetails(id){const [sets]=await pool.query('CALL GetFarmerDetails(?)',[id]);return sets[0]||[]},
 async farmsByFarmer(id){const [sets]=await pool.query('CALL GetFarmsByFarmer(?)',[id]);return sets[0]||[]},
 async totalFarmArea(id){const [rows]=await pool.query('SELECT GetTotalFarmArea(?) AS total_area',[id]);return rows[0]},
 async farmerFarmSummary(){const statement='SELECT Farmer_ID,Farmer_Name,Farm_ID,Farm_Name,Area,Soil_Type,Location_ID,Village,District,State FROM Farmer_Farm_Summary ORDER BY Farmer_ID,Farm_ID';const [rows]=await pool.query(statement);return {rows,statement}},
 async databaseOperations(){
  const db=process.env.DB_NAME||'SmartAgricultureDB'
  const [foundTables]=await pool.execute('SELECT TABLE_NAME AS name,TABLE_TYPE AS type FROM information_schema.TABLES WHERE TABLE_SCHEMA=? ORDER BY TABLE_NAME',[db])
  const [foreignKeys]=await pool.execute('SELECT TABLE_NAME AS table_name,COLUMN_NAME AS column_name,REFERENCED_TABLE_NAME AS referenced_table,REFERENCED_COLUMN_NAME AS referenced_column FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=? AND REFERENCED_TABLE_NAME IS NOT NULL ORDER BY TABLE_NAME,COLUMN_NAME',[db])
  const [routines]=await pool.execute('SELECT ROUTINE_NAME AS name,ROUTINE_TYPE AS type FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA=? ORDER BY ROUTINE_NAME',[db])
  const [triggers]=await pool.execute('SELECT TRIGGER_NAME AS name,EVENT_OBJECT_TABLE AS table_name,ACTION_TIMING AS timing,EVENT_MANIPULATION AS event FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=? ORDER BY TRIGGER_NAME',[db])
  const [join]=await pool.query('SELECT f.Farm_ID, f.Farm_Name, fr.Name AS Farmer, l.Village, f.Area FROM Farm f JOIN Farmer fr ON fr.Farmer_ID=f.Farmer_ID LEFT JOIN Location l ON l.Location_ID=f.Location_ID ORDER BY f.Farm_ID LIMIT 8')
  const [aggregate]=await pool.query('SELECT COUNT(*) AS farm_count,COALESCE(SUM(Area),0) AS total_area,COALESCE(AVG(Area),0) AS average_area,COALESCE(MAX(Area),0) AS largest_area,COALESCE(MIN(Area),0) AS smallest_area FROM Farm')
  const [grouped]=await pool.query('SELECT Crop_ID,COUNT(*) AS cultivation_count FROM Cultivation GROUP BY Crop_ID HAVING COUNT(*)>0 ORDER BY cultivation_count DESC LIMIT 10')
  const [nested]=await pool.query('SELECT Farm_ID,Farm_Name,Area FROM Farm WHERE Area>(SELECT AVG(Area) FROM Farm) ORDER BY Area DESC')
  const [correlated]=await pool.query('SELECT fr.Farmer_ID,fr.Name FROM Farmer fr WHERE EXISTS (SELECT 1 FROM Farm f WHERE f.Farmer_ID=fr.Farmer_ID AND f.Area>(SELECT AVG(f2.Area) FROM Farm f2 WHERE f2.Farmer_ID=fr.Farmer_ID)) ORDER BY fr.Farmer_ID')
  const [rightJoin]=await pool.query('SELECT c.Crop_ID,c.Crop_Name,cu.Cultivation_ID,cu.Farm_ID FROM Cultivation cu RIGHT JOIN Crop c ON c.Crop_ID=cu.Crop_ID ORDER BY c.Crop_ID,cu.Cultivation_ID LIMIT 30')
  const [whereOrder]=await pool.query('SELECT Farm_ID,Farm_Name,Area FROM Farm WHERE Area>0 ORDER BY Area DESC,Farm_ID ASC LIMIT 20')
  return {tables:foundTables,foreignKeys,routines,triggers,join,rightJoin,whereOrder,aggregate:aggregate[0],grouped,nested,correlated,statements:operationStatements}
 },
 async auditRecords(){
  const db=process.env.DB_NAME||'SmartAgricultureDB'
  const [matches]=await pool.execute("SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA=? AND LOWER(TABLE_NAME) LIKE '%audit%' ORDER BY TABLE_NAME",[db])
  const results=[]
  for(const item of matches){const safe=item.name.replaceAll('`','``');const [rows]=await pool.query(`SELECT * FROM \`${safe}\` ORDER BY 1 DESC LIMIT 30`);results.push({table:item.name,rows})}
  return results
 },
 async farmerAuditForId(id,executor=pool){
  const [columns]=await executor.execute("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND LOWER(TABLE_NAME)=LOWER(?) AND COLUMN_NAME IN ('Old_Values','New_Values')",['Farmer_Audit'])
  const available=new Set(columns.map(column=>column.COLUMN_NAME))
  const oldValues=available.has('Old_Values')?'Old_Values':'NULL AS Old_Values'
  const newValues=available.has('New_Values')?'New_Values':'NULL AS New_Values'
  const [rows]=await executor.execute(`SELECT Audit_ID,Farmer_ID,Farmer_Name,Action_Type,Action_Date,${oldValues},${newValues},TIMESTAMPDIFF(SECOND,Action_Date,CURRENT_TIMESTAMP) AS age_seconds FROM Farmer_Audit WHERE Farmer_ID=? ORDER BY Audit_ID DESC LIMIT 5`,[id])
  return rows
 },
 async rollbackTestPreflight(executor=pool){
  const [[database]]=await executor.query('SELECT DATABASE() AS name')
  const [engines]=await executor.execute('SELECT TABLE_NAME,ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE=?',['BASE TABLE'])
  return {database:database.name,engines}
 }
}
