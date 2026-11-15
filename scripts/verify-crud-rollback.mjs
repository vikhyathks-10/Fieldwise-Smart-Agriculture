import { pool } from '../backend/database/connection/pool.js'
import { tables } from '../shared/schema.js'
import { recordsService } from '../backend/business/services/recordsService.js'
import { agricultureRepository } from '../backend/data-access/repositories/agricultureRepository.js'

const updateFields={
 farmers:'Name',locations:'Village',farms:'Farm_Name',weather:'Temperature',crops:'Crop_Name',
 'soil-tests':'pH_Level',cultivation:'Status',fertilizers:'Name','fertilizer-usage':'Quantity',
 pests:'Name',advisories:'Title',markets:'Market_Name','market-prices':'Price'
}
const results=[]
const connection=await pool.getConnection()
let transactionOpen=false
let rollbackDone=false
try{
 const {database,engines}=await agricultureRepository.rollbackTestPreflight(connection)
 const engineByTable=new Map(engines.map(row=>[row.TABLE_NAME.toLowerCase(),row.ENGINE]))
 const required=['Farmer','Farmer_Audit',...Object.values(tables).map(meta=>meta.table)]
 const unsafe=required.filter(name=>engineByTable.get(name.toLowerCase())!=='InnoDB')
 if(unsafe.length)throw new Error(`Rollback safety check failed; these tables are missing or not InnoDB: ${unsafe.join(', ')}`)
 await connection.beginTransaction();transactionOpen=true

 // Run the new cultivation workflow inside this outer transaction so the test
 // can verify its steps and still roll back all test rows after assertions.
 const farms=await recordsService.list('farms',connection)
 const crops=await recordsService.list('crops',connection)
 const cultivations=await recordsService.list('cultivation',connection)
 if(!farms.length||!crops.length)throw new Error('Cultivation transaction test needs one existing Farm and Crop reference.')
 const cultivationId=Math.max(0,...cultivations.map(row=>Number(row.Cultivation_ID)||0))+1
 const cultivationTest=await recordsService.registerCultivation({Cultivation_ID:cultivationId,Farm_ID:farms[0].Farm_ID,Crop_ID:crops[0].Crop_ID,Start_Date:'2026-11-09',End_Date:null,Status:'Rollback verification',Yield_Estimate:null,Remarks:'Temporary transaction test; rolled back.'},connection)
 if(cultivationTest.cultivation?.Cultivation_ID!==cultivationId)throw new Error('Cultivation transaction did not read the inserted row back.')
 results.push({resource:'cultivation-transaction',insert:true,select:true,transaction:cultivationTest.transaction.status})

 for(const [slug,meta] of Object.entries(tables)){
  const existing=await recordsService.list(slug,connection)
  if(!existing.length)throw new Error(`Cannot safely clone a valid source row for ${slug}; no row exists.`)
  const idField=meta.key
  const testId=Math.max(0,...existing.map(row=>Number(row[idField])||0))+1
  const source=existing[0]
  const body=Object.fromEntries(meta.fields.map(([field])=>[field,source[field]??null]))
  body[idField]=testId
  const created=await recordsService.create(slug,body,connection)
  const afterInsert=await recordsService.list(slug,connection)
  if(!afterInsert.some(row=>Number(row[idField])===testId))throw new Error(`${slug} INSERT succeeded but SELECT could not find the temporary row.`)
  const field=updateFields[slug]
  const fieldMeta=meta.fields.find(item=>item[0]===field)
  const newValue=fieldMeta?.[2]==='number'?(Number(source[field]||0)+0.01):`__rollback_${slug}_${testId}`
  const updated=await recordsService.update(slug,testId,{[field]:newValue},connection)
  if(updated.execution.affectedRows!==1)throw new Error(`${slug} UPDATE affected ${updated.execution.affectedRows} rows; expected 1.`)
  const deleted=await recordsService.remove(slug,testId,connection)
  if(deleted.execution.affectedRows!==1)throw new Error(`${slug} DELETE affected ${deleted.execution.affectedRows} rows; expected 1.`)
  const afterDelete=await recordsService.list(slug,connection)
  if(afterDelete.some(row=>Number(row[idField])===testId))throw new Error(`${slug} temporary row remains after DELETE.`)
  results.push({resource:slug,insertAffectedRows:created.execution.affectedRows,selectFound:true,updateAffectedRows:updated.execution.affectedRows,deleteAffectedRows:deleted.execution.affectedRows})
  if(slug==='farmers'){
   const audit=await agricultureRepository.farmerAuditForId(testId,connection)
   const inserted=audit.find(row=>row.Action_Type==='INSERT'&&Number(row.Farmer_ID)===testId&&row.Farmer_Name===body.Name)
   if(!inserted)throw new Error('AfterFarmerInsert did not create the expected Farmer_Audit record.')
   if(Number(inserted.age_seconds)<0||Number(inserted.age_seconds)>60)throw new Error(`Trigger timestamp was outside the expected minute window (${inserted.age_seconds}s).`)
   results[results.length-1].trigger={name:'AfterFarmerInsert',action:inserted.Action_Type,ageSeconds:Number(inserted.age_seconds),auditId:inserted.Audit_ID}
  }
 }
 await connection.rollback();transactionOpen=false;rollbackDone=true
 console.log(JSON.stringify({database,engineSafety:'all test tables InnoDB',testMode:'single explicit transaction; unconditional rollback',rollbackDone,results},null,2))
}catch(error){
 if(transactionOpen){try{await connection.rollback();rollbackDone=true}catch(rollbackError){console.error('Rollback failed:',rollbackError.message)}}
 console.error(JSON.stringify({error:error.message,rollbackDone,results},null,2))
 process.exitCode=1
}finally{
 connection.release()
 await pool.end()
}
