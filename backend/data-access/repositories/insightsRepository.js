import { pool } from '../../database/connection/pool.js'

export const insightsRepository={
 async farmAdvisoryContext(farmId){
  const [[farm]] = await pool.execute('SELECT f.Farm_ID,f.Farm_Name,f.Area,f.Soil_Type,f.Location_ID,fr.Name AS farmer_name FROM Farm f JOIN Farmer fr ON fr.Farmer_ID=f.Farmer_ID WHERE f.Farm_ID=?',[farmId])
  if(!farm)return null
  const [soil]=await pool.execute('SELECT Soil_Test_ID,Test_Date,pH_Level,Nitrogen,Phosphorus,Potassium FROM Soil_Test WHERE Farm_ID=? ORDER BY Test_Date DESC LIMIT 5',[farmId])
  const [weather]=await pool.execute('SELECT Weather_ID,Date,Temperature,Rainfall,Humidity,Wind_Speed FROM Weather WHERE Location_ID=? ORDER BY Date DESC LIMIT 10',[farm.Location_ID||0])
  const [history]=await pool.execute('SELECT c.Crop_ID,c.Crop_Name,c.Crop_Type,c.Season,COUNT(*) AS recorded_cultivations,AVG(cu.Yield_Estimate) AS avg_yield_estimate,MAX(cu.Start_Date) AS latest_start FROM Cultivation cu JOIN Crop c ON c.Crop_ID=cu.Crop_ID WHERE cu.Farm_ID=? GROUP BY c.Crop_ID,c.Crop_Name,c.Crop_Type,c.Season ORDER BY recorded_cultivations DESC,latest_start DESC',[farmId])
  const [fertilizers]=await pool.execute('SELECT c.Crop_ID,c.Crop_Name,f.Name,f.Type,f.Nutrient_Content,COUNT(fu.Usage_ID) AS recorded_applications FROM Cultivation cu JOIN Crop c ON c.Crop_ID=cu.Crop_ID JOIN Fertilizer_Usage fu ON fu.Cultivation_ID=cu.Cultivation_ID JOIN Fertilizer f ON f.Fertilizer_ID=fu.Fertilizer_ID WHERE cu.Farm_ID=? GROUP BY c.Crop_ID,c.Crop_Name,f.Fertilizer_ID,f.Name,f.Type,f.Nutrient_Content ORDER BY recorded_applications DESC',[farmId])
  const [advisories]=await pool.query('SELECT a.Advisory_ID,a.Title,a.Description,a.Type,a.Advisory_Date,p.Name AS pest_name,p.Type AS pest_type FROM Advisory a LEFT JOIN Pest_Disease p ON p.Pest_ID=a.Pest_ID ORDER BY a.Advisory_Date DESC,a.Advisory_ID DESC LIMIT 12')
  return {farm,soil,weather,history,fertilizers,advisories}
 },
 async marketIntelligence({cropId,marketId,startDate,endDate,search}){
  const clauses=[],args=[]
  if(cropId){clauses.push('mp.Crop_ID=?');args.push(cropId)}
  if(marketId){clauses.push('mp.Market_ID=?');args.push(marketId)}
  if(startDate){clauses.push('mp.Date>=?');args.push(startDate)}
  if(endDate){clauses.push('mp.Date<=?');args.push(endDate)}
  if(search){clauses.push('(c.Crop_Name LIKE ? OR m.Market_Name LIKE ?)');args.push(`%${search}%`,`%${search}%`)}
  const where=clauses.length?`WHERE ${clauses.join(' AND ')}`:''
  const [markets]=await pool.query('SELECT m.Market_ID,m.Market_Name,m.Market_Type,m.Location_ID,l.Village,l.District,l.State FROM Market m LEFT JOIN Location l ON l.Location_ID=m.Location_ID ORDER BY m.Market_Name')
  const [crops]=await pool.query('SELECT Crop_ID,Crop_Name FROM Crop ORDER BY Crop_Name')
  const [prices]=await pool.execute(`SELECT mp.Price_ID,mp.Crop_ID,c.Crop_Name,mp.Market_ID,m.Market_Name,mp.Price,mp.Date FROM Market_Price mp JOIN Crop c ON c.Crop_ID=mp.Crop_ID JOIN Market m ON m.Market_ID=mp.Market_ID ${where} ORDER BY mp.Date DESC,mp.Price_ID DESC`,args)
  const [comparison]=await pool.execute(`SELECT c.Crop_ID,c.Crop_Name,m.Market_ID,m.Market_Name,MIN(mp.Price) AS lowest_recorded,MAX(mp.Price) AS highest_recorded,AVG(mp.Price) AS average_recorded,COUNT(*) AS observations,MAX(mp.Date) AS latest_date FROM Market_Price mp JOIN Crop c ON c.Crop_ID=mp.Crop_ID JOIN Market m ON m.Market_ID=mp.Market_ID ${where} GROUP BY c.Crop_ID,c.Crop_Name,m.Market_ID,m.Market_Name ORDER BY c.Crop_Name,m.Market_Name`,args)
  const [trends]=await pool.execute(`SELECT DATE_FORMAT(mp.Date,'%Y-%m-01') AS period,c.Crop_ID,c.Crop_Name,
    m.Market_ID,m.Market_Name,AVG(mp.Price) AS average_price,MIN(mp.Price) AS lowest_price,
    MAX(mp.Price) AS highest_price,COUNT(*) AS observations
    FROM Market_Price mp INNER JOIN Crop c ON c.Crop_ID=mp.Crop_ID
    INNER JOIN Market m ON m.Market_ID=mp.Market_ID ${where}
    GROUP BY DATE_FORMAT(mp.Date,'%Y-%m-01'),c.Crop_ID,c.Crop_Name,m.Market_ID,m.Market_Name
    ORDER BY period,c.Crop_Name,m.Market_Name`,args)
  return {markets,crops,prices,comparison,trends}
 },
 async alertRecords(){
  const [weather]=await pool.query('SELECT w.Weather_ID,l.Location_ID,w.Date,w.Temperature,w.Rainfall,w.Humidity,l.Village,l.District,DATEDIFF(CURDATE(),w.Date) AS age_days FROM Location l LEFT JOIN Weather w ON w.Weather_ID=(SELECT w2.Weather_ID FROM Weather w2 WHERE w2.Location_ID=l.Location_ID ORDER BY w2.Date DESC,w2.Weather_ID DESC LIMIT 1) ORDER BY w.Date DESC,l.Location_ID LIMIT 100')
  const [advisories]=await pool.query('SELECT a.Advisory_ID,a.Title,a.Description,a.Type,a.Advisory_Date,p.Name AS pest_name,p.Type AS pest_type,DATEDIFF(CURDATE(),a.Advisory_Date) AS age_days FROM Advisory a LEFT JOIN Pest_Disease p ON p.Pest_ID=a.Pest_ID ORDER BY a.Advisory_Date DESC,a.Advisory_ID DESC LIMIT 60')
  const [pests]=await pool.query('SELECT Pest_ID,Name,Type,Symptoms FROM Pest_Disease ORDER BY Name')
  const [cultivation]=await pool.query('SELECT cu.Cultivation_ID,cu.Farm_ID,f.Farm_Name,cu.Crop_ID,c.Crop_Name,cu.Start_Date,cu.End_Date,cu.Status FROM Cultivation cu JOIN Farm f ON f.Farm_ID=cu.Farm_ID JOIN Crop c ON c.Crop_ID=cu.Crop_ID WHERE (cu.End_Date IS NULL OR cu.End_Date>=CURDATE()) AND (cu.Start_Date IS NULL OR cu.Start_Date<=CURDATE()) ORDER BY cu.Start_Date DESC')
  const [fertilizerUsage]=await pool.query('SELECT fu.Usage_ID,fu.Usage_Date,fu.Quantity,fu.Method,fe.Name AS fertilizer_name,cu.Farm_ID,f.Farm_Name,c.Crop_Name FROM Fertilizer_Usage fu JOIN Fertilizer fe ON fe.Fertilizer_ID=fu.Fertilizer_ID JOIN Cultivation cu ON cu.Cultivation_ID=fu.Cultivation_ID JOIN Farm f ON f.Farm_ID=cu.Farm_ID JOIN Crop c ON c.Crop_ID=cu.Crop_ID ORDER BY fu.Usage_Date DESC,fu.Usage_ID DESC LIMIT 60')
  const [soil]=await pool.query('SELECT st.Soil_Test_ID,st.Farm_ID,f.Farm_Name,st.Test_Date,DATEDIFF(CURDATE(),st.Test_Date) AS age_days FROM Farm f LEFT JOIN Soil_Test st ON st.Soil_Test_ID=(SELECT st2.Soil_Test_ID FROM Soil_Test st2 WHERE st2.Farm_ID=f.Farm_ID ORDER BY st2.Test_Date DESC,st2.Soil_Test_ID DESC LIMIT 1) ORDER BY st.Test_Date DESC,f.Farm_ID LIMIT 100')
  return {weather,advisories,pests,cultivation,fertilizerUsage,soil}
 },
  async reportData(report,{startDate,endDate}={}){
   const queries={
    farmers:{sql:'SELECT Farmer_ID,Name,Phone,Email,Address FROM Farmer ORDER BY Farmer_ID'},
    farms:{sql:'SELECT f.Farm_ID,f.Farmer_ID,fr.Name AS Farmer_Name,f.Farm_Name,f.Area,f.Soil_Type,f.Location_ID,l.Village,l.District,l.State FROM Farm f JOIN Farmer fr ON fr.Farmer_ID=f.Farmer_ID LEFT JOIN Location l ON l.Location_ID=f.Location_ID ORDER BY f.Farm_ID'},
    crops:{sql:'SELECT Crop_ID,Crop_Name,Crop_Type,Season,Duration FROM Crop ORDER BY Crop_Name'},
    cultivation:{sql:'SELECT cu.Cultivation_ID,cu.Farm_ID,f.Farm_Name,cu.Crop_ID,c.Crop_Name,cu.Start_Date,cu.End_Date,cu.Status,cu.Yield_Estimate,cu.Remarks FROM Cultivation cu JOIN Farm f ON f.Farm_ID=cu.Farm_ID JOIN Crop c ON c.Crop_ID=cu.Crop_ID',dateColumn:'cu.Start_Date',orderBy:'cu.Start_Date DESC'},
    'soil-tests':{sql:'SELECT st.Soil_Test_ID,st.Farm_ID,f.Farm_Name,st.Test_Date,st.pH_Level,st.Nitrogen,st.Phosphorus,st.Potassium FROM Soil_Test st JOIN Farm f ON f.Farm_ID=st.Farm_ID',dateColumn:'st.Test_Date',orderBy:'st.Test_Date DESC'},
    'fertilizer-usage':{sql:'SELECT fu.Usage_ID,fu.Cultivation_ID,cu.Farm_ID,f.Farm_Name,c.Crop_Name,fu.Fertilizer_ID,fe.Name AS Fertilizer_Name,fu.Quantity,fu.Usage_Date,fu.Method FROM Fertilizer_Usage fu JOIN Cultivation cu ON cu.Cultivation_ID=fu.Cultivation_ID JOIN Farm f ON f.Farm_ID=cu.Farm_ID JOIN Crop c ON c.Crop_ID=cu.Crop_ID JOIN Fertilizer fe ON fe.Fertilizer_ID=fu.Fertilizer_ID',dateColumn:'fu.Usage_Date',orderBy:'fu.Usage_Date DESC'},
    pests:{sql:'SELECT Pest_ID,Name,Type,Symptoms FROM Pest_Disease ORDER BY Name'},
    advisories:{sql:'SELECT a.Advisory_ID,a.Pest_ID,p.Name AS Pest_Name,a.Title,a.Description,a.Advisory_Date,a.Type FROM Advisory a LEFT JOIN Pest_Disease p ON p.Pest_ID=a.Pest_ID',dateColumn:'a.Advisory_Date',orderBy:'a.Advisory_Date DESC'},
    'market-prices':{sql:'SELECT mp.Price_ID,mp.Crop_ID,c.Crop_Name,mp.Market_ID,m.Market_Name,mp.Price,mp.Date FROM Market_Price mp JOIN Crop c ON c.Crop_ID=mp.Crop_ID JOIN Market m ON m.Market_ID=mp.Market_ID',dateColumn:'mp.Date',orderBy:'mp.Date DESC'},
    summary:{sql:'SELECT (SELECT COUNT(*) FROM Farmer) AS farmers,(SELECT COUNT(*) FROM Farm) AS farms,(SELECT COALESCE(SUM(Area),0) FROM Farm) AS total_area,(SELECT COUNT(*) FROM Crop) AS crops,(SELECT COUNT(*) FROM Cultivation) AS cultivation_records,(SELECT COUNT(*) FROM Soil_Test) AS soil_tests,(SELECT COUNT(*) FROM Pest_Disease) AS pest_records,(SELECT COUNT(*) FROM Advisory) AS advisories,(SELECT COUNT(*) FROM Market_Price) AS price_records'}
   }
   const query=queries[report]
   if(!query)return null
   const clauses=[],args=[]
   if(query.dateColumn&&startDate){clauses.push(`${query.dateColumn}>=?`);args.push(startDate)}
   if(query.dateColumn&&endDate){clauses.push(`${query.dateColumn}<=?`);args.push(endDate)}
   const where=clauses.length?` WHERE ${clauses.join(' AND ')}`:''
   const order=query.orderBy?` ORDER BY ${query.orderBy}`:''
   const [rows]=await pool.execute(`${query.sql}${where}${order}`,args)
   return rows
 },
 async farmerAudit({actionType,startDate,endDate}){
  const clauses=[],args=[]
  if(actionType){clauses.push('Action_Type=?');args.push(actionType)}
  if(startDate){clauses.push('Action_Date>=?');args.push(`${startDate} 00:00:00`)}
  if(endDate){clauses.push('Action_Date<?');const next=new Date(`${endDate}T00:00:00Z`);next.setUTCDate(next.getUTCDate()+1);args.push(`${next.toISOString().slice(0,10)} 00:00:00`)}
  const where=clauses.length?`WHERE ${clauses.join(' AND ')}`:''
  const [columns]=await pool.execute("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND LOWER(TABLE_NAME)=LOWER(?) AND COLUMN_NAME IN ('Old_Values','New_Values')",['Farmer_Audit'])
  const available=new Set(columns.map(column=>column.COLUMN_NAME))
  const oldValues=available.has('Old_Values')?'Old_Values':'NULL AS Old_Values'
  const newValues=available.has('New_Values')?'New_Values':'NULL AS New_Values'
  const [rows]=await pool.execute(`SELECT Audit_ID,Farmer_ID,Farmer_Name,Action_Type,Action_Date,${oldValues},${newValues} FROM Farmer_Audit ${where} ORDER BY Action_Date DESC,Audit_ID DESC LIMIT 250`,args)
  const [actions]=await pool.query('SELECT DISTINCT Action_Type FROM Farmer_Audit WHERE Action_Type IS NOT NULL ORDER BY Action_Type')
  return {rows,actions:actions.map(x=>x.Action_Type)}
 },
 async operationsMetadata(){
  const db=process.env.DB_NAME||'SmartAgricultureDB'
  const [columns]=await pool.execute('SELECT TABLE_NAME,COLUMN_NAME,COLUMN_TYPE,IS_NULLABLE,COLUMN_KEY FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? ORDER BY TABLE_NAME,ORDINAL_POSITION',[db])
  const [views]=await pool.execute('SELECT TABLE_NAME,VIEW_DEFINITION FROM information_schema.VIEWS WHERE TABLE_SCHEMA=? ORDER BY TABLE_NAME',[db])
  const [indexes]=await pool.execute('SELECT TABLE_NAME,INDEX_NAME,COLUMN_NAME,NON_UNIQUE FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=? ORDER BY TABLE_NAME,INDEX_NAME,SEQ_IN_INDEX',[db])
  const [triggerDefinitions]=await pool.execute('SELECT TRIGGER_NAME,EVENT_OBJECT_TABLE,ACTION_STATEMENT FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=? ORDER BY TRIGGER_NAME',[db])
  return {columns,views,indexes,triggerDefinitions}
 }
}
