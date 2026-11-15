import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { pool } from '../backend/database/connection/pool.js'
import { insightsRepository } from '../backend/data-access/repositories/insightsRepository.js'
import { recordRepository } from '../backend/data-access/repositories/recordRepository.js'
import { tables } from '../shared/schema.js'

const migration=await readFile(new URL('../database/12_farmer_audit_triggers_migration.sql',import.meta.url),'utf8')
const installTriggers=await readFile(new URL('../database/08_triggers.sql',import.meta.url),'utf8')
const tableInstall=await readFile(new URL('../database/02_create_tables.sql',import.meta.url),'utf8')

test('installed INSERT trigger creates a full new-value audit snapshot',()=>{
  assert.match(migration,/CREATE (?:DEFINER\s*=\s*'root'@'localhost'\s+)?TRIGGER `AfterFarmerInsert`\s+AFTER INSERT ON `Farmer`/i)
  assert.match(migration,/NEW\.Farmer_ID,\s*NEW\.Name,\s*'INSERT',\s*NULL,\s*JSON_OBJECT\('Farmer_ID',\s*NEW\.Farmer_ID,\s*'Name',\s*NEW\.Name,\s*'Phone',\s*NEW\.Phone,\s*'Email',\s*NEW\.Email,\s*'Address',\s*NEW\.Address\)\s*\)/i)
  assert.match(installTriggers,/CREATE TRIGGER `AfterFarmerInsert`/i)
})

test('UPDATE trigger stores explicit old and new snapshots for all farmer columns',()=>{
  assert.match(migration,/CREATE (?:DEFINER\s*=\s*'root'@'localhost'\s+)?TRIGGER `AfterFarmerUpdate`\s+AFTER UPDATE ON `Farmer`/i)
  for(const field of ['Farmer_ID','Name','Phone','Email','Address']){
    assert.match(migration,new RegExp(`'${field}',\\s*OLD\\.${field}`))
    assert.match(migration,new RegExp(`'${field}',\\s*NEW\\.${field}`))
  }
  assert.match(installTriggers,/CREATE TRIGGER `AfterFarmerUpdate`/i)
})

test('DELETE trigger stores the deleted farmer snapshot and NULL new values',()=>{
  assert.match(migration,/CREATE (?:DEFINER\s*=\s*'root'@'localhost'\s+)?TRIGGER `AfterFarmerDelete`\s+AFTER DELETE ON `Farmer`/i)
  assert.match(migration,/OLD\.Farmer_ID,\s*OLD\.Name,\s*'DELETE',\s*JSON_OBJECT\('Farmer_ID',\s*OLD\.Farmer_ID,\s*'Name',\s*OLD\.Name,\s*'Phone',\s*OLD\.Phone,\s*'Email',\s*OLD\.Email,\s*'Address',\s*OLD\.Address\),\s*NULL/i)
  assert.match(installTriggers,/CREATE TRIGGER `AfterFarmerDelete`/i)
})

test('audit history listing returns nullable snapshot fields with existing filters and ordering',async t=>{
  const statements=[]
  t.mock.method(pool,'execute',async(statement,args)=>{
    statements.push({statement,args})
    if(statement.includes('information_schema.COLUMNS')) return [[{COLUMN_NAME:'Old_Values'},{COLUMN_NAME:'New_Values'}],[]]
    return [[{Audit_ID:5,Farmer_ID:4,Farmer_Name:'Farmer',Action_Type:'UPDATE',Old_Values:{Name:'Before'},New_Values:{Name:'After'}}],[]]
  })
  t.mock.method(pool,'query',async()=>[[{Action_Type:'UPDATE'}],[]])
  const result=await insightsRepository.farmerAudit({actionType:'UPDATE',startDate:'2026-01-01'})
  assert.equal(result.rows[0].Old_Values.Name,'Before')
  assert.deepEqual(result.actions,['UPDATE'])
  const select=statements.find(call=>call.statement.includes('FROM Farmer_Audit'))
  assert.match(select.statement,/Old_Values,New_Values/)
  assert.match(select.statement,/ORDER BY Action_Date DESC,Audit_ID DESC LIMIT 250/)
  assert.deepEqual(select.args,['UPDATE','2026-01-01 00:00:00'])
})

test('audit history remains compatible before nullable JSON columns are installed',async t=>{
  const statements=[]
  t.mock.method(pool,'execute',async(statement)=>{
    statements.push(statement)
    if(statement.includes('information_schema.COLUMNS')) return [[],[]]
    return [[{Audit_ID:2,Old_Values:null,New_Values:null}],[]]
  })
  t.mock.method(pool,'query',async()=>[[],[]])
  const result=await insightsRepository.farmerAudit({})
  assert.equal(result.rows[0].Old_Values,null)
  assert.match(statements[1],/NULL AS Old_Values,NULL AS New_Values/)
})

test('failed Farmer DML rolls back its transaction and releases the connection',async t=>{
  const calls=[]
  const connection={
    beginTransaction:async()=>calls.push('begin'),
    execute:async(sql)=>{calls.push(sql);const error=new Error('simulated audit trigger failure');error.code='ER_SIGNAL_EXCEPTION';throw error},
    commit:async()=>calls.push('commit'),
    rollback:async()=>calls.push('rollback'),
    release:()=>calls.push('release')
  }
  t.mock.method(pool,'getConnection',async()=>connection)
  await assert.rejects(recordRepository.insert(tables.farmers,{Farmer_ID:999,Name:'Rollback check'}),error=>error.code==='ER_SIGNAL_EXCEPTION'&&error.transactionStatus==='rolled_back')
  assert.equal(calls[0],'begin')
  assert.match(calls[1],/^INSERT INTO `Farmer`/)
  assert.deepEqual(calls.slice(2),['rollback','release'])
})

test('Farmer UPDATE and DELETE mutations commit through the repository transaction',async t=>{
  const calls=[]
  const connection={
    beginTransaction:async()=>calls.push('begin'),
    execute:async(sql,args)=>{calls.push({sql,args});return [{affectedRows:1},[]]},
    commit:async()=>calls.push('commit'),
    rollback:async()=>calls.push('rollback'),
    release:()=>calls.push('release')
  }
  t.mock.method(pool,'getConnection',async()=>connection)
  await recordRepository.update(tables.farmers,12,{Name:'Updated farmer'})
  await recordRepository.remove(tables.farmers,12)
  const statements=calls.filter(item=>typeof item==='object')
  assert.match(statements[0].sql,/^UPDATE `Farmer`/)
  assert.match(statements[1].sql,/^DELETE FROM `Farmer`/)
  assert.deepEqual(calls.filter(item=>item==='commit').length,2)
  assert.equal(calls.includes('rollback'),false)
  assert.equal(calls.filter(item=>item==='release').length,2)
})
