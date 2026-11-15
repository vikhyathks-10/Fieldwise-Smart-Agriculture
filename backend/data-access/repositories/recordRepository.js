import { pool } from '../../database/connection/pool.js'

async function runMutation(meta,executor,work) {
  if(meta.table!=='Farmer'||executor) return work(executor||pool)
  const connection=await pool.getConnection()
  try {
    await connection.beginTransaction()
    const result=await work(connection)
    await connection.commit()
    return result
  } catch(error) {
    try { await connection.rollback(); error.transactionStatus='rolled_back' }
    catch(rollbackError) { error.transactionStatus='rollback_failed'; error.rollbackError=rollbackError.message }
    throw error
  } finally { connection.release() }
}

export const recordRepository = {
  async validateReferences(meta,data,executor=pool) {
    for(const [field,table,key] of meta.references||[]) {
      if(data[field]===undefined||data[field]===null) continue
      const [rows]=await executor.execute(`SELECT 1 FROM \`${table}\` WHERE \`${key}\`=? LIMIT 1`,[data[field]])
      if(!rows.length) { const error=new Error(`${field} does not match an existing ${table} record.`);error.code='ER_NO_REFERENCED_ROW_2';throw error }
    }
  },
  async list(meta,executor=pool) { const [rows]=await executor.execute(`SELECT * FROM \`${meta.table}\` ORDER BY \`${meta.key}\` DESC`); return rows },
  async listWithExecution(meta,executor=pool) {
    const statement=`SELECT * FROM \`${meta.table}\` ORDER BY \`${meta.key}\` DESC`
    const [rows]=await executor.execute(statement)
    return {rows,execution:{statement,parameterCount:0,rowCount:rows.length}}
  },
  async insert(meta,data,executor) {
    const keys=Object.keys(data)
    const statement=`INSERT INTO \`${meta.table}\` (${keys.map(k=>`\`${k}\``).join(',')}) VALUES (${keys.map(()=>'?').join(',')})`
    return runMutation(meta,executor,async db=>{
      const [result]=await db.execute(statement,keys.map(k=>data[k]))
      return { [meta.key]:data[meta.key]??result.insertId, execution:{statement,parameterCount:keys.length,affectedRows:result.affectedRows,insertId:result.insertId||data[meta.key]||null} }
    })
  },
  async update(meta,id,data,executor) {
    const keys=Object.keys(data)
    const statement=`UPDATE \`${meta.table}\` SET ${keys.map(k=>`\`${k}\`=?`).join(',')} WHERE \`${meta.key}\`=?`
    return runMutation(meta,executor,async db=>{
      const [result]=await db.execute(statement,[...keys.map(k=>data[k]),id])
      return {affectedRows:result.affectedRows,execution:{statement,parameterCount:keys.length+1,affectedRows:result.affectedRows}}
    })
  },
  async remove(meta,id,executor) {
    const statement=`DELETE FROM \`${meta.table}\` WHERE \`${meta.key}\`=?`
    return runMutation(meta,executor,async db=>{
      const [result]=await db.execute(statement,[id])
      return {affectedRows:result.affectedRows,execution:{statement,parameterCount:1,affectedRows:result.affectedRows}}
    })
  },
  async registerCultivation(data,executor) {
    const ownsConnection=!executor
    const connection=executor||await pool.getConnection()
    const steps=[]
    try {
      if(ownsConnection) await connection.beginTransaction()
      const farmSql='SELECT Farm_ID FROM Farm WHERE Farm_ID=? FOR UPDATE'
      const [farms]=await connection.execute(farmSql,[data.Farm_ID])
      steps.push({statement:farmSql,parameterCount:1,rowCount:farms.length})
      if(!farms.length){const error=new Error('Selected farm does not exist.');error.code='ER_NO_REFERENCED_ROW_2';throw error}
      const cropSql='SELECT Crop_ID FROM Crop WHERE Crop_ID=? FOR UPDATE'
      const [crops]=await connection.execute(cropSql,[data.Crop_ID])
      steps.push({statement:cropSql,parameterCount:1,rowCount:crops.length})
      if(!crops.length){const error=new Error('Selected crop does not exist.');error.code='ER_NO_REFERENCED_ROW_2';throw error}
      const keys=Object.keys(data)
      const insertSql=`INSERT INTO \`Cultivation\` (${keys.map(k=>`\`${k}\``).join(',')}) VALUES (${keys.map(()=>'?').join(',')})`
      const [insertResult]=await connection.execute(insertSql,keys.map(k=>data[k]))
      steps.push({statement:insertSql,parameterCount:keys.length,affectedRows:insertResult.affectedRows,insertId:insertResult.insertId||data.Cultivation_ID})
      const readSql='SELECT * FROM Cultivation WHERE Cultivation_ID=?'
      const [rows]=await connection.execute(readSql,[data.Cultivation_ID])
      steps.push({statement:readSql,parameterCount:1,rowCount:rows.length})
      if(ownsConnection) await connection.commit()
      return {cultivation:rows[0],transaction:{status:ownsConnection?'committed':'pending_outer_transaction',steps}}
    } catch(error) {
      if(ownsConnection) {
        try { await connection.rollback(); error.transactionStatus='rolled_back' } catch(rollbackError) { error.transactionStatus='rollback_failed'; error.rollbackError=rollbackError.message }
      }
      throw error
    } finally {
      if(ownsConnection) connection.release()
    }
  }
}
