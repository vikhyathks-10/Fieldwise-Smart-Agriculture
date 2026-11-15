import { pool } from '../../database/connection/pool.js'

const updateSelect = `SELECT u.update_id,u.farmer_id,u.farm_id,u.cultivation_id,u.update_category,u.title,u.description,
  u.observed_on,u.crop_condition,u.progress_details,u.yield_estimate,u.target_field,u.proposed_value,u.status,u.submitted_at,u.updated_at,
  f.Name AS farmer_name,fa.email AS farmer_email,fm.Farm_Name AS farm_name,cu.Status AS cultivation_status,c.Crop_Name AS crop_name
  FROM farmer_update u
  INNER JOIN Farmer f ON f.Farmer_ID=u.farmer_id
  INNER JOIN farmer_account fa ON fa.account_id=u.account_id
  INNER JOIN Farm fm ON fm.Farm_ID=u.farm_id
  LEFT JOIN Cultivation cu ON cu.Cultivation_ID=u.cultivation_id
  LEFT JOIN Crop c ON c.Crop_ID=cu.Crop_ID`

export const farmerPortalRepository = {
  async adminDashboard() {
    const [[counts]] = await pool.query(`SELECT
      COUNT(*) AS total_updates,
      COALESCE(SUM(status='PENDING'),0) AS pending_updates,
      COALESCE(SUM(status='APPROVED'),0) AS approved_updates,
      COALESCE(SUM(status='REJECTED'),0) AS rejected_updates,
      COALESCE(SUM(status='CLARIFICATION_REQUESTED'),0) AS clarification_updates
      FROM farmer_update`)
    const [recentUpdates] = await pool.query(`${updateSelect} ORDER BY u.submitted_at DESC,u.update_id DESC LIMIT 8`)
    const [alerts] = await pool.query(`SELECT a.Advisory_ID,a.Title,a.Type,a.Advisory_Date,p.Name AS Pest_Name
      FROM Advisory a LEFT JOIN Pest_Disease p ON p.Pest_ID=a.Pest_ID
      ORDER BY a.Advisory_Date DESC,a.Advisory_ID DESC LIMIT 5`)
    return { counts, recentUpdates, alerts }
  },
  async listFarmers(search = '') {
    const like = `%${search}%`
    const [rows] = await pool.execute(`SELECT f.Farmer_ID,f.Name,f.Phone,f.Email,f.Address,
      a.account_id,a.email AS login_email,a.status AS account_status,a.created_at AS account_created_at,
      COALESCE(fs.farm_count,0) AS farm_count,COALESCE(fs.total_area,0) AS total_area
      FROM Farmer f
      LEFT JOIN farmer_account a ON a.farmer_id=f.Farmer_ID
      LEFT JOIN (SELECT Farmer_ID,COUNT(*) AS farm_count,SUM(Area) AS total_area FROM Farm GROUP BY Farmer_ID) fs ON fs.Farmer_ID=f.Farmer_ID
      WHERE (?='' OR f.Name LIKE ? OR f.Email LIKE ? OR CAST(f.Farmer_ID AS CHAR)=?)
      ORDER BY f.Name,f.Farmer_ID`, [search, like, like, search])
    return rows
  },
  async farmerProfile(id) {
    const [farmers] = await pool.execute(`SELECT f.*,a.account_id,a.email AS login_email,a.status AS account_status
      FROM Farmer f LEFT JOIN farmer_account a ON a.farmer_id=f.Farmer_ID WHERE f.Farmer_ID=?`, [id])
    if (!farmers.length) return null
    const [farms] = await pool.execute(`SELECT fm.*,l.Village,l.District,l.State,l.Pincode
      FROM Farm fm LEFT JOIN Location l ON l.Location_ID=fm.Location_ID
      WHERE fm.Farmer_ID=? ORDER BY fm.Farm_ID`, [id])
    const [cultivations] = await pool.execute(`SELECT cu.*,c.Crop_Name,fm.Farm_Name
      FROM Cultivation cu INNER JOIN Farm fm ON fm.Farm_ID=cu.Farm_ID
      INNER JOIN Crop c ON c.Crop_ID=cu.Crop_ID WHERE fm.Farmer_ID=?
      ORDER BY cu.Start_Date DESC,cu.Cultivation_ID DESC`, [id])
    const [updates] = await pool.execute(`${updateSelect} WHERE u.farmer_id=? ORDER BY u.submitted_at DESC,u.update_id DESC`, [id])
    return { farmer: farmers[0], farms, cultivations, updates }
  },
  async listFarms() {
    const [rows] = await pool.query(`SELECT fm.*,f.Name AS farmer_name,l.Village,l.District,l.State,
      COUNT(DISTINCT cu.Cultivation_ID) AS cultivation_count
      FROM Farm fm INNER JOIN Farmer f ON f.Farmer_ID=fm.Farmer_ID
      LEFT JOIN Location l ON l.Location_ID=fm.Location_ID
      LEFT JOIN Cultivation cu ON cu.Farm_ID=fm.Farm_ID
      GROUP BY fm.Farm_ID,fm.Farmer_ID,f.Name,fm.Farm_Name,fm.Area,fm.Soil_Type,fm.Location_ID,l.Village,l.District,l.State
      ORDER BY f.Name,fm.Farm_ID`)
    return rows
  },
  async listUpdates(status = null) {
    const statement = `${updateSelect} ${status ? 'WHERE u.status=?' : ''} ORDER BY u.submitted_at DESC,u.update_id DESC`
    const [rows] = status ? await pool.execute(statement, [status]) : await pool.query(statement)
    return rows
  },
  async getUpdate(id) {
    const [updates] = await pool.execute(`${updateSelect} WHERE u.update_id=? LIMIT 1`, [id])
    if (!updates.length) return null
    const [history] = await pool.execute(`SELECT r.review_id,r.actor_type,r.decision,r.review_comment,r.reviewed_at,
      r.admin_id,a.name AS admin_name FROM update_review r
      LEFT JOIN admin_account a ON a.admin_id=r.admin_id
      WHERE r.update_id=? ORDER BY r.reviewed_at,r.review_id`, [id])
    return { ...updates[0], history }
  },
  async listFarmerUpdates(user) {
    const [rows] = await pool.execute(`${updateSelect} WHERE u.farmer_id=? AND u.account_id=? ORDER BY u.submitted_at DESC,u.update_id DESC`, [user.farmerId, user.id])
    return rows
  },
  async farmerUpdate(user, id, executor = pool) {
    const [updates] = await executor.execute(`${updateSelect} WHERE u.update_id=? AND u.farmer_id=? AND u.account_id=? LIMIT 1`, [id,user.farmerId,user.id])
    if (!updates.length) return null
    const [history] = await executor.execute(`SELECT r.review_id,r.actor_type,r.decision,r.review_comment,r.reviewed_at,
      r.admin_id,a.name AS admin_name FROM update_review r LEFT JOIN admin_account a ON a.admin_id=r.admin_id
      WHERE r.update_id=? ORDER BY r.reviewed_at,r.review_id`, [id])
    return { ...updates[0], history }
  },
  async assertFarmerFarm(user, farmId, cultivationId, executor = pool) {
    const [farms] = await executor.execute('SELECT Farm_ID FROM Farm WHERE Farm_ID=? AND Farmer_ID=? LIMIT 1', [farmId, user.farmerId])
    if (!farms.length) { const error = new Error('Selected farm does not belong to this account.'); error.code = 'OWNERSHIP'; throw error }
    if (cultivationId != null) {
      const [cultivations] = await executor.execute('SELECT Cultivation_ID FROM Cultivation WHERE Cultivation_ID=? AND Farm_ID=? LIMIT 1', [cultivationId, farmId])
      if (!cultivations.length) { const error = new Error('Selected cultivation does not belong to the selected farm.'); error.code = 'OWNERSHIP'; throw error }
    }
  },
  async submitUpdate(user, data) {
    const connection = await pool.getConnection()
    try {
      await connection.beginTransaction()
      await this.assertFarmerFarm(user, data.farmId, data.cultivationId, connection)
      const [result] = await connection.execute(`INSERT INTO farmer_update
        (account_id,farmer_id,farm_id,cultivation_id,update_category,observed_on,title,description,crop_condition,progress_details,yield_estimate,target_field,proposed_value,status)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'PENDING')`, [user.id,user.farmerId,data.farmId,data.cultivationId,data.category,data.observedOn,data.title,data.description,data.cropCondition,data.progressDetails,data.yieldEstimate,data.targetField,data.proposedValue])
      await connection.execute(`INSERT INTO update_review (update_id,admin_id,actor_type,decision,review_comment)
        VALUES (?,NULL,'FARMER','SUBMITTED',?)`, [result.insertId, 'Farmer submitted an update for administrator review.'])
      await connection.execute(`INSERT INTO notification (recipient_type,admin_id,account_id,title,message)
        SELECT 'ADMIN',admin_id,NULL,?,? FROM admin_account WHERE status='ACTIVE'`, ['New farmer update', `A farmer submitted update #${result.insertId}: ${data.title}`])
      await connection.commit()
      return { updateId: result.insertId, status: 'PENDING' }
    } catch (error) {
      try { await connection.rollback() } catch {}
      throw error
    } finally { connection.release() }
  },
  async reviewUpdate(admin, id, decision, comment, executor) {
    const ownsConnection = !executor
    const connection = executor || await pool.getConnection()
    try {
      await connection.beginTransaction()
      const [rows] = await connection.execute('SELECT * FROM farmer_update WHERE update_id=? FOR UPDATE', [id])
      if (!rows.length) { const error = new Error('Farmer update not found.'); error.code = 'NOT_FOUND'; throw error }
      const update = rows[0]
      if (update.status !== 'PENDING') { const error = new Error('Only pending updates can be reviewed.'); error.code = 'INVALID_STATE'; throw error }
      if (decision === 'APPROVED') await this.applyApprovedChange(connection, update)
      const nextStatus = decision === 'CLARIFICATION_REQUESTED' ? 'CLARIFICATION_REQUESTED' : decision
      await connection.execute('UPDATE farmer_update SET status=? WHERE update_id=?', [nextStatus, id])
      await connection.execute(`INSERT INTO update_review (update_id,admin_id,actor_type,decision,review_comment)
        VALUES (?,?,'ADMIN',?,?)`, [id,admin.id,decision,comment || null])
      await connection.execute(`INSERT INTO notification (recipient_type,admin_id,account_id,title,message)
        VALUES ('FARMER',NULL,?,?,?)`, [update.account_id, `Update ${nextStatus.replaceAll('_',' ').toLowerCase()}`, `Your update #${id} is now ${nextStatus.replaceAll('_',' ').toLowerCase()}. ${comment || ''}`.trim()])
      await connection.commit()
      return { updateId: Number(id), status: nextStatus }
    } catch (error) {
      try { await connection.rollback() } catch {}
      throw error
    } finally { if (ownsConnection) connection.release() }
  },
  async applyApprovedChange(connection, update) {
    let statement, values
    if (update.target_field === 'FARM_SOIL_TYPE') {
      statement = 'UPDATE Farm SET Soil_Type=? WHERE Farm_ID=? AND Farmer_ID=?'
      values = [update.proposed_value, update.farm_id, update.farmer_id]
    } else {
      if (!update.cultivation_id) { const error = new Error('This update needs a linked cultivation before it can be approved.'); error.code = 'INVALID_TARGET'; throw error }
      const fields = {
        CULTIVATION_STATUS: 'Status',
        CULTIVATION_REMARKS: 'Remarks',
        YIELD_ESTIMATE: 'Yield_Estimate'
      }
      const field = fields[update.target_field]
      if (!field) { const error = new Error('Unsupported approved update field.'); error.code = 'INVALID_TARGET'; throw error }
      const [target] = await connection.execute('SELECT Cultivation_ID FROM Cultivation WHERE Cultivation_ID=? AND Farm_ID=? FOR UPDATE', [update.cultivation_id, update.farm_id])
      if (!target.length) { const error = new Error('The linked cultivation no longer exists for this farm.'); error.code = 'INVALID_TARGET'; throw error }
      statement = `UPDATE Cultivation SET \`${field}\`=? WHERE Cultivation_ID=? AND Farm_ID=?`
      values = [update.proposed_value, update.cultivation_id, update.farm_id]
    }
    const [result] = await connection.execute(statement, values)
    if (!result.affectedRows) {
      const [exists] = update.target_field === 'FARM_SOIL_TYPE'
        ? await connection.execute('SELECT Farm_ID FROM Farm WHERE Farm_ID=? AND Farmer_ID=?', [update.farm_id, update.farmer_id])
        : await connection.execute('SELECT Cultivation_ID FROM Cultivation WHERE Cultivation_ID=? AND Farm_ID=?', [update.cultivation_id, update.farm_id])
      if (!exists.length) { const error = new Error('The agricultural record could not be updated.'); error.code = 'UPDATE_TARGET_MISSING'; throw error }
    }
  },
  async respondToClarification(user, id, response) {
    const connection = await pool.getConnection()
    try {
      await connection.beginTransaction()
      const [rows] = await connection.execute('SELECT update_id,status,title FROM farmer_update WHERE update_id=? AND farmer_id=? AND account_id=? FOR UPDATE', [id,user.farmerId,user.id])
      if (!rows.length) { const error = new Error('Farmer update not found.'); error.code = 'NOT_FOUND'; throw error }
      if (rows[0].status !== 'CLARIFICATION_REQUESTED') { const error = new Error('This update is not awaiting clarification.'); error.code = 'INVALID_STATE'; throw error }
      await connection.execute('INSERT INTO update_review (update_id,admin_id,actor_type,decision,review_comment) VALUES (?,NULL,\'FARMER\',\'CLARIFICATION_RESPONDED\',?)', [id,response])
      await connection.execute("UPDATE farmer_update SET status='PENDING' WHERE update_id=?", [id])
      await connection.execute(`INSERT INTO notification (recipient_type,admin_id,account_id,title,message)
        SELECT 'ADMIN',admin_id,NULL,?,? FROM admin_account WHERE status='ACTIVE'`, ['Farmer clarification received', `A farmer responded to update #${id}: ${rows[0].title}`])
      await connection.commit()
      return { updateId: Number(id), status: 'PENDING' }
    } catch (error) {
      try { await connection.rollback() } catch {}
      throw error
    } finally { connection.release() }
  },
  async farmerDashboard(user) {
    const [farmerRows] = await pool.execute('SELECT Farmer_ID,Name,Phone,Email,Address FROM Farmer WHERE Farmer_ID=?', [user.farmerId])
    const [farms] = await pool.execute(`SELECT fm.*,l.Village,l.District,l.State,l.Pincode
      FROM Farm fm LEFT JOIN Location l ON l.Location_ID=fm.Location_ID
      WHERE fm.Farmer_ID=? ORDER BY fm.Farm_ID`, [user.farmerId])
    const [cultivations] = await pool.execute(`SELECT cu.Cultivation_ID,cu.Farm_ID,fm.Farm_Name,cu.Crop_ID,c.Crop_Name,
      cu.Start_Date,cu.End_Date,cu.Status,cu.Yield_Estimate,cu.Remarks
      FROM Cultivation cu INNER JOIN Farm fm ON fm.Farm_ID=cu.Farm_ID
      INNER JOIN Crop c ON c.Crop_ID=cu.Crop_ID
      WHERE fm.Farmer_ID=? ORDER BY cu.Start_Date DESC,cu.Cultivation_ID DESC`, [user.farmerId])
    const [weather] = await pool.execute(`SELECT w.Weather_ID,w.Location_ID,l.Village,l.District,w.Date,w.Temperature,w.Rainfall,w.Humidity
      FROM Weather w INNER JOIN Location l ON l.Location_ID=w.Location_ID
      WHERE EXISTS (SELECT 1 FROM Farm fm WHERE fm.Farmer_ID=? AND fm.Location_ID=w.Location_ID)
      ORDER BY w.Date DESC,w.Weather_ID DESC LIMIT 10`, [user.farmerId])
    const [advisories] = await pool.execute(`SELECT a.Advisory_ID,a.Title,a.Description,a.Advisory_Date,a.Type,p.Name AS Pest_Name
      FROM Advisory a LEFT JOIN Pest_Disease p ON p.Pest_ID=a.Pest_ID
      ORDER BY a.Advisory_Date DESC,a.Advisory_ID DESC LIMIT 10`)
    const [updates] = await pool.execute(`${updateSelect} WHERE u.farmer_id=? AND u.account_id=? ORDER BY u.submitted_at DESC,u.update_id DESC LIMIT 5`, [user.farmerId,user.id])
    const [notifications] = await pool.execute(`SELECT notification_id,title,message,is_read,created_at FROM notification
      WHERE recipient_type='FARMER' AND account_id=? ORDER BY created_at DESC,notification_id DESC LIMIT 10`, [user.id])
    const [totals] = await pool.execute(`SELECT COALESCE(SUM(Area),0) AS total_area FROM Farm WHERE Farmer_ID=?`, [user.farmerId])
    const activeCultivations = cultivations.filter(row => (!row.End_Date || String(row.End_Date) >= new Date().toISOString().slice(0,10)) && (!row.Start_Date || String(row.Start_Date) <= new Date().toISOString().slice(0,10)))
    return { farmer: farmerRows[0] || null, farms, totalArea: totals[0]?.total_area || 0, cultivations, activeCultivations, weather, advisories, updates, notifications }
  },
  async farmerFarms(user) {
    const [rows] = await pool.execute(`SELECT fm.*,l.Village,l.District,l.State,l.Pincode
      FROM Farm fm LEFT JOIN Location l ON l.Location_ID=fm.Location_ID
      WHERE fm.Farmer_ID=? ORDER BY fm.Farm_ID`, [user.farmerId])
    return rows
  },
  async farmerCultivations(user) {
    const [rows] = await pool.execute(`SELECT cu.*,c.Crop_Name,fm.Farm_Name
      FROM Cultivation cu INNER JOIN Crop c ON c.Crop_ID=cu.Crop_ID
      INNER JOIN Farm fm ON fm.Farm_ID=cu.Farm_ID
      WHERE fm.Farmer_ID=? ORDER BY cu.Start_Date DESC,cu.Cultivation_ID DESC`, [user.farmerId])
    return rows
  },
  async farmerCrops(user) {
    const [rows] = await pool.execute(`SELECT c.Crop_ID,c.Crop_Name,c.Crop_Type,c.Season,c.Duration,
      COUNT(cu.Cultivation_ID) AS cultivation_count,MAX(cu.Start_Date) AS latest_start,
      SUM(cu.Status='ACTIVE') AS active_records
      FROM Crop c INNER JOIN Cultivation cu ON cu.Crop_ID=c.Crop_ID
      INNER JOIN Farm fm ON fm.Farm_ID=cu.Farm_ID
      WHERE fm.Farmer_ID=?
      GROUP BY c.Crop_ID,c.Crop_Name,c.Crop_Type,c.Season,c.Duration
      ORDER BY c.Crop_Name`, [user.farmerId])
    return rows
  },
  async farmerSoilTests(user) {
    const [rows] = await pool.execute(`SELECT st.Soil_Test_ID,st.Farm_ID,fm.Farm_Name,st.Test_Date,
      st.pH_Level,st.Nitrogen,st.Phosphorus,st.Potassium
      FROM Soil_Test st INNER JOIN Farm fm ON fm.Farm_ID=st.Farm_ID
      WHERE fm.Farmer_ID=? ORDER BY st.Test_Date DESC,st.Soil_Test_ID DESC`, [user.farmerId])
    return rows
  },
  async farmerWeather(user) {
    const [rows] = await pool.execute(`SELECT w.Weather_ID,w.Location_ID,l.Village,l.District,l.State,
      w.Date,w.Temperature,w.Rainfall,w.Humidity,w.Wind_Speed
      FROM Weather w INNER JOIN Location l ON l.Location_ID=w.Location_ID
      WHERE EXISTS (SELECT 1 FROM Farm fm WHERE fm.Farmer_ID=? AND fm.Location_ID=w.Location_ID)
      ORDER BY w.Date DESC,w.Weather_ID DESC LIMIT 250`, [user.farmerId])
    return rows
  },
  async farmerFertilizers() {
    const [rows] = await pool.query(`SELECT Fertilizer_ID,Name,Type,Nutrient_Content,Price
      FROM Fertilizer ORDER BY Name,Fertilizer_ID`)
    return rows
  },
  async farmerFertilizerUsage(user) {
    const [rows] = await pool.execute(`SELECT fu.Usage_ID,fu.Cultivation_ID,cu.Farm_ID,fm.Farm_Name,
      c.Crop_Name,fu.Fertilizer_ID,fe.Name AS Fertilizer_Name,fe.Type AS Fertilizer_Type,
      fu.Quantity,fu.Usage_Date,fu.Method
      FROM Fertilizer_Usage fu
      INNER JOIN Cultivation cu ON cu.Cultivation_ID=fu.Cultivation_ID
      INNER JOIN Farm fm ON fm.Farm_ID=cu.Farm_ID
      INNER JOIN Crop c ON c.Crop_ID=cu.Crop_ID
      INNER JOIN Fertilizer fe ON fe.Fertilizer_ID=fu.Fertilizer_ID
      WHERE fm.Farmer_ID=? ORDER BY fu.Usage_Date DESC,fu.Usage_ID DESC`, [user.farmerId])
    return rows
  },
  async farmerPests() {
    const [rows] = await pool.query(`SELECT Pest_ID,Name,Type,Symptoms FROM Pest_Disease ORDER BY Name,Pest_ID`)
    return rows
  },
  async farmerAdvisories() {
    const [rows] = await pool.query(`SELECT a.Advisory_ID,a.Pest_ID,p.Name AS Pest_Name,
      a.Title,a.Description,a.Advisory_Date,a.Type
      FROM Advisory a LEFT JOIN Pest_Disease p ON p.Pest_ID=a.Pest_ID
      ORDER BY a.Advisory_Date DESC,a.Advisory_ID DESC`)
    return rows
  },
  async notifications(user) {
    const field = user.type === 'admin' ? 'admin_id' : 'account_id'
    const [rows] = await pool.execute(`SELECT notification_id,title,message,is_read,created_at FROM notification WHERE ${field}=? ORDER BY created_at DESC,notification_id DESC LIMIT 50`, [user.id])
    return rows
  },
  async markNotificationRead(user, id) {
    const field = user.type === 'admin' ? 'admin_id' : 'account_id'
    const [result] = await pool.execute(`UPDATE notification SET is_read=TRUE WHERE notification_id=? AND ${field}=?`, [id,user.id])
    return { updated: Boolean(result.affectedRows) }
  }
}
