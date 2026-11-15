import test from 'node:test'
import assert from 'node:assert/strict'
import bcrypt from 'bcryptjs'
import { passwordPolicy } from '../backend/business/services/authService.js'
import { signToken, verifyToken, readCookie } from '../backend/utils/jwt.js'
import { requireAdminRole, requireAuth } from '../backend/application/middleware/authentication.js'
import { authRepository } from '../backend/data-access/repositories/authRepository.js'
import { farmerPortalRepository } from '../backend/data-access/repositories/farmerPortalRepository.js'
import { portalService } from '../backend/business/services/portalService.js'
import { pool } from '../backend/database/connection/pool.js'

process.env.JWT_SECRET = 'test-only-secret-that-is-long-enough-for-hmac-validation'

test('password policy requires 12 to 128 characters', () => {
  assert.equal(passwordPolicy('Short-pass1'), false)
  assert.equal(passwordPolicy('Correct-Horse-Battery-4'), true)
  assert.equal(passwordPolicy('x'.repeat(129)), false)
})

test('bcrypt stores a non-plaintext hash and verifies the password', async () => {
  const password = 'Demo-Password-Only-123'
  const hash = await bcrypt.hash(password, 4)
  assert.notEqual(hash, password)
  assert.equal(await bcrypt.compare(password, hash), true)
  assert.equal(await bcrypt.compare('wrong-password', hash), false)
})

test('signed JWT preserves role claims and rejects tampering and expiration', () => {
  const token = signToken({ sub: 17, type: 'farmer', farmerId: 31, role: 'FARMER' }, 60)
  assert.deepEqual(verifyToken(token).farmerId, 31)
  const changedLastChar = token.endsWith('x') ? 'y' : 'x'
  assert.throws(() => verifyToken(`${token.slice(0,-1)}${changedLastChar}`))
  assert.throws(() => verifyToken(signToken({ sub: 1, type: 'admin', role: 'ADMIN' }, -1)))
})

test('cookie reader handles encoded values and ignores missing cookies', () => {
  assert.equal(readCookie({headers:{cookie:'other=a; fieldwise_admin=token%2Evalue'}}, 'fieldwise_admin'), 'token.value')
  assert.equal(readCookie({headers:{}}, 'fieldwise_admin'), null)
})

test('role authorization denies a farmer principal from administrator actions', () => {
  let received
  requireAdminRole('SUPER_ADMIN')({user:{type:'farmer',role:'FARMER'}},{},error=>{received=error})
  assert.equal(received.status, 403)
})

test('protected route rejects a missing session without querying MySQL', async () => {
  let received
  await requireAuth('admin')({headers:{},ip:'127.0.0.1'},{},error=>{received=error})
  assert.equal(received.status, 401)
})

test('admin login returns role claims and never returns a password hash', async t => {
  const hash=await bcrypt.hash('Administrator-Only-123',4)
  t.mock.method(authRepository,'findAdminByEmail',async email=>({admin_id:9,name:'Demo Admin',email,password_hash:hash,role:'SUPER_ADMIN',status:'ACTIVE',created_at:'2026-01-01'}))
  const result=await (await import('../backend/business/services/authService.js')).authService.loginAdmin({email:'DEMO@example.com',password:'Administrator-Only-123'})
  assert.equal(result.user.type,'admin')
  assert.equal(result.claims.role,'SUPER_ADMIN')
  assert.equal(Object.hasOwn(result.user,'password_hash'),false)
})

test('invalid administrator password is rejected without disclosing account state', async t => {
  const hash=await bcrypt.hash('Administrator-Only-123',4)
  t.mock.method(authRepository,'findAdminByEmail',async()=>({admin_id:9,name:'Demo Admin',email:'demo@example.com',password_hash:hash,role:'ADMIN',status:'ACTIVE'}))
  await assert.rejects((await import('../backend/business/services/authService.js')).authService.loginAdmin({email:'demo@example.com',password:'Incorrect-Password-123'}),error=>error.status===401&&error.message==='Invalid email or password.')
})

test('farmer login claims are linked to the database Farmer_ID', async t => {
  const hash=await bcrypt.hash('Farmer-Password-123',4)
  t.mock.method(authRepository,'findFarmerAccountByEmail',async()=>({account_id:12,farmer_id:44,email:'farmer@example.com',password_hash:hash,status:'ACTIVE',created_at:'2026-01-01'}))
  t.mock.method(authRepository,'findFarmerById',async id=>({Farmer_ID:id,Name:'Demo Farmer'}))
  const result=await (await import('../backend/business/services/authService.js')).authService.loginFarmer({email:'farmer@example.com',password:'Farmer-Password-123'})
  assert.equal(result.claims.farmerId,44)
  assert.equal(result.user.farmerId,44)
})

test('farmer update submission uses authenticated owner, ignoring body Farmer_ID', async t => {
  let captured
  t.mock.method(farmerPortalRepository,'assertFarmerFarm',async()=>{})
  t.mock.method(farmerPortalRepository,'submitUpdate',async(user,data)=>{captured={user,data};return{updateId:55,status:'PENDING'}})
  const result=await portalService.submitFarmerUpdate({type:'farmer',id:12,farmerId:44},{Farmer_ID:999,farmId:3,cultivationId:7,category:'CULTIVATION_PROGRESS',title:'Progress',description:'A field update',targetField:'CULTIVATION_REMARKS',proposedValue:'Growth observed'})
  assert.equal(captured.user.farmerId,44)
  assert.equal(Object.hasOwn(captured.data,'Farmer_ID'),false)
  assert.equal(result.status,'PENDING')
})

test('farmer update details are filtered by both authenticated Farmer_ID and account ID', async () => {
  let captured
  const executor={execute:async(sql,params)=>{captured={sql,params};return[[]]}}
  const result=await farmerPortalRepository.farmerUpdate({id:12,farmerId:44},55,executor)
  assert.equal(result,null)
  assert.match(captured.sql,/u\.farmer_id=\? AND u\.account_id=\?/)
  assert.deepEqual(captured.params,[55,44,12])
})

test('farmer ownership validation prevents choosing another farmer farm', async () => {
  let captured
  const executor={execute:async(sql,params)=>{captured={sql,params};return[[]]}}
  await assert.rejects(farmerPortalRepository.assertFarmerFarm({id:12,farmerId:44},99,null,executor),error=>error.code==='OWNERSHIP')
  assert.match(captured.sql,/Farm_ID=\? AND Farmer_ID=\?/)
  assert.deepEqual(captured.params,[99,44])
})

test('administrator account creation hashes the password and only Super Admin can create ADMIN', async t => {
  let captured
  t.mock.method(authRepository,'createAdminAccounts',async accounts=>{captured=accounts;return accounts.map((input,index)=>({admin_id:21+index,name:input.name,email:input.email,role:'ADMIN',status:'ACTIVE'}))})
  const service=(await import('../backend/business/services/authService.js')).authService
  const created=await service.createAdmin({type:'admin',id:1,role:'SUPER_ADMIN'},{name:'New Administrator',email:'new@example.com',password:'New-Admin-Password-123',role:'ADMIN'})
  assert.equal(created.admin_id,21)
  assert.notEqual(captured[0].passwordHash,'New-Admin-Password-123')
  assert.equal(await bcrypt.compare('New-Admin-Password-123',captured[0].passwordHash),true)
  assert.equal(Object.hasOwn(created,'passwordHash'),false)
  await assert.rejects(service.createAdmin({type:'admin',role:'ADMIN'},{name:'Unauthorized',email:'unauthorized@example.com',password:'New-Admin-Password-123',role:'ADMIN'}),error=>error.status===403)
  await assert.rejects(service.createAdmin({type:'admin',role:'SUPER_ADMIN'},{name:'Escalation',email:'escalate@example.com',password:'New-Admin-Password-123',role:'SUPER_ADMIN'}),error=>error.status===409)
})

test('bulk farmer creation hashes passwords and preserves each Farmer_ID link', async t => {
  let captured
  t.mock.method(authRepository,'createFarmerAccounts',async accounts=>{captured=accounts;return accounts.map((row,index)=>({account_id:40+index,farmer_id:row.farmerId,email:row.email,status:'ACTIVE'}))})
  const service=(await import('../backend/business/services/authService.js')).authService
  const result=await service.createFarmerAccounts({type:'admin',role:'ADMIN'},[
    {farmerId:5,email:'one@example.com',password:'Farmer-Password-001'},
    {farmerId:6,email:'two@example.com',password:'Farmer-Password-002'}
  ])
  assert.equal(result.ok,true)
  assert.deepEqual(result.results.map(row=>row.account.farmer_id),[5,6])
  assert.deepEqual(captured.map(row=>row.farmerId),[5,6])
  assert.equal(await bcrypt.compare('Farmer-Password-001',captured[0].passwordHash),true)
  assert.equal(result.results.some(row=>Object.hasOwn(row.account,'password_hash')),false)
})

test('bulk ADMIN creation rejects duplicate emails and non-ADMIN roles before repository writes', async t => {
  let calls=0
  t.mock.method(authRepository,'createAdminAccounts',async()=>{calls++;return[]})
  const service=(await import('../backend/business/services/authService.js')).authService
  const duplicate=await service.createAdminAccounts({type:'admin',role:'SUPER_ADMIN'},[
    {name:'First Admin',email:'same@example.com',password:'Admin-Password-001',role:'ADMIN'},
    {name:'Second Admin',email:'SAME@example.com',password:'Admin-Password-002',role:'ADMIN'}
  ])
  assert.equal(duplicate.ok,false)
  assert.equal(duplicate.results[1].status,'FAILED_VALIDATION')
  const elevated=await service.createAdminAccounts({type:'admin',role:'SUPER_ADMIN'},[
    {name:'Elevated Admin',email:'elevated@example.com',password:'Admin-Password-003',role:'SUPER_ADMIN'}
  ])
  assert.equal(elevated.ok,false)
  assert.equal(calls,0)
})

test('bulk farmer creation rejects invalid and repeated Farmer_ID values without writing', async t => {
  let calls=0
  t.mock.method(authRepository,'createFarmerAccounts',async()=>{calls++;return[]})
  const service=(await import('../backend/business/services/authService.js')).authService
  const result=await service.createFarmerAccounts({type:'admin',role:'ADMIN'},[
    {farmerId:0,email:'bad@example.com',password:'Farmer-Password-001'},
    {farmerId:7,email:'one@example.com',password:'Farmer-Password-002'},
    {farmerId:7,email:'two@example.com',password:'Farmer-Password-003'}
  ])
  assert.equal(result.ok,false)
  assert.equal(result.results[0].status,'FAILED_VALIDATION')
  assert.equal(result.results[2].status,'FAILED_VALIDATION')
  assert.equal(calls,0)
})

test('bulk creation reports an existing cross-table email without writing any accounts', async t => {
  t.mock.method(authRepository,'createAdminAccounts',async()=>{const error=new Error('Email already in use.');error.code='EMAIL_EXISTS';error.email='used@example.com';throw error})
  const service=(await import('../backend/business/services/authService.js')).authService
  const result=await service.createAdminAccounts({type:'admin',role:'SUPER_ADMIN'},[
    {name:'First Admin',email:'used@example.com',password:'Admin-Password-001',role:'ADMIN'},
    {name:'Second Admin',email:'other@example.com',password:'Admin-Password-002',role:'ADMIN'}
  ])
  assert.equal(result.ok,false)
  assert.equal(result.results[0].status,'FAILED')
  assert.equal(result.results[1].status,'ROLLED_BACK')
  assert.equal(result.results.some(row=>Object.hasOwn(row,'password')),false)
})

test('only Super Admin can list or manage administrator accounts and cannot deactivate self', async () => {
  assert.throws(()=>portalService.listAdmins({type:'admin',role:'ADMIN'}),error=>error.status===403)
  await assert.rejects(portalService.setAdminStatus({type:'admin',id:1,role:'ADMIN'},2,{status:'INACTIVE'}),error=>error.status===403)
  await assert.rejects(portalService.setAdminStatus({type:'admin',id:1,role:'SUPER_ADMIN'},1,{status:'INACTIVE'}),error=>error.status===403)
})

test('bulk administrator repository rolls back every insert when one insert fails', async t => {
  const calls=[]
  let insertCount=0
  const connection={
    query:async sql=>{calls.push(sql);return [[{acquired:1}]]},
    beginTransaction:async()=>calls.push('begin'),commit:async()=>calls.push('commit'),rollback:async()=>calls.push('rollback'),release:()=>calls.push('release'),
    execute:async(sql)=>{
      calls.push(sql)
      if(sql.startsWith('SELECT (EXISTS'))return [[{found:0}]]
      if(sql.startsWith('INSERT INTO admin_account')){insertCount++;if(insertCount===2){const error=new Error('duplicate');error.code='ER_DUP_ENTRY';throw error}return [{insertId:80}]}
      if(sql.startsWith('SELECT admin_id,name'))return [[{admin_id:80,name:'A',email:'a@example.com',role:'ADMIN',status:'ACTIVE'}]]
      return [{affectedRows:1}]
    }
  }
  t.mock.method(pool,'getConnection',async()=>connection)
  await assert.rejects(authRepository.createAdminAccounts([
    {name:'A Admin',email:'a@example.com',passwordHash:'hash-a'},
    {name:'B Admin',email:'b@example.com',passwordHash:'hash-b'}
  ]),error=>error.code==='ER_DUP_ENTRY')
  assert.equal(calls.includes('rollback'),true)
  assert.equal(calls.includes('commit'),false)
  assert.equal(calls.includes('release'),true)
})

test('farmer account repository rejects an already linked Farmer_ID transactionally', async t => {
  const calls=[]
  const connection={
    query:async sql=>{calls.push(sql);return [[{acquired:1}]]},
    beginTransaction:async()=>calls.push('begin'),commit:async()=>calls.push('commit'),rollback:async()=>calls.push('rollback'),release:()=>calls.push('release'),
    execute:async sql=>{calls.push(sql);if(sql.startsWith('SELECT Farmer_ID'))return [[{Farmer_ID:5}]];if(sql.startsWith('SELECT account_id FROM farmer_account'))return [[{account_id:9}]];return [{affectedRows:1}]}
  }
  t.mock.method(pool,'getConnection',async()=>connection)
  await assert.rejects(authRepository.createFarmerAccounts([{farmerId:5,email:'linked@example.com',passwordHash:'hash'}]),error=>error.code==='FARMER_ACCOUNT_EXISTS')
  assert.equal(calls.includes('rollback'),true)
  assert.equal(calls.includes('commit'),false)
  assert.equal(calls.some(sql=>typeof sql==='string'&&sql.startsWith('INSERT INTO farmer_account')),false)
})

test('farmer account activation uses status update without deleting farmer records', async t => {
  let captured
  t.mock.method(authRepository,'setFarmerAccountStatus',async(id,status)=>{captured={id,status};return{account_id:id,status}})
  const result=await portalService.setFarmerAccountStatus(19,{status:'INACTIVE'})
  assert.deepEqual(captured,{id:19,status:'INACTIVE'})
  assert.equal(result.status,'INACTIVE')
})

test('administrator transaction prevents deactivating the final active super-admin', async () => {
  const calls=[]
  const fakeConnection={
    beginTransaction:async()=>calls.push('begin'),commit:async()=>calls.push('commit'),rollback:async()=>calls.push('rollback'),release:()=>{},
    execute:async(sql)=>{calls.push(sql);if(sql.startsWith('SELECT admin_id,role,status'))return[[{admin_id:1,role:'SUPER_ADMIN',status:'ACTIVE'}]];return[{affectedRows:1}]},
    query:async(sql)=>{calls.push(sql);if(sql.includes('COUNT(*)'))return[[{total:1}]];return[[{admin_id:1}]]}
  }
  await assert.rejects(authRepository.setAdminStatus(1,'INACTIVE',fakeConnection),error=>error.code==='LAST_SUPER_ADMIN')
  assert.equal(calls.includes('rollback'),true)
  assert.equal(calls.includes('commit'),false)
  assert.equal(calls.some(sql=>typeof sql==='string'&&sql.startsWith('UPDATE admin_account')),false)
})

test('approval transaction updates its allowlisted cultivation target and creates history and notification', async () => {
  const calls=[]
  const fakeConnection={
    beginTransaction:async()=>calls.push('begin'),commit:async()=>calls.push('commit'),rollback:async()=>calls.push('rollback'),
    execute:async(sql,params)=>{calls.push({sql,params});if(sql.startsWith('SELECT * FROM farmer_update'))return[[{update_id:8,status:'PENDING',account_id:12,farmer_id:44,farm_id:3,cultivation_id:7,target_field:'CULTIVATION_STATUS',proposed_value:'HARVESTED'}]];if(sql.startsWith('SELECT Cultivation_ID'))return[[{Cultivation_ID:7}]];return[{affectedRows:1}]}
  }
  const result=await farmerPortalRepository.reviewUpdate({id:4},8,'APPROVED',null,fakeConnection)
  assert.equal(result.status,'APPROVED')
  assert.equal(calls.at(-1),'commit')
  assert.equal(calls.some(x=>typeof x==='object'&&x.sql==='UPDATE Cultivation SET `Status`=? WHERE Cultivation_ID=? AND Farm_ID=?'),true)
  assert.equal(calls.some(x=>typeof x==='object'&&x.sql.includes('INSERT INTO update_review')),true)
  assert.equal(calls.some(x=>typeof x==='object'&&x.sql.includes('INSERT INTO notification')),true)
})

test('rejected update creates review and notification without changing agricultural tables', async () => {
  const calls=[]
  const fakeConnection={
    beginTransaction:async()=>calls.push('begin'),commit:async()=>calls.push('commit'),rollback:async()=>calls.push('rollback'),
    execute:async(sql,params)=>{calls.push({sql,params});if(sql.startsWith('SELECT * FROM farmer_update'))return[[{update_id:8,status:'PENDING',account_id:12,farmer_id:44,farm_id:3,target_field:'FARM_SOIL_TYPE'}]];return[{affectedRows:1}]}
  }
  const result=await farmerPortalRepository.reviewUpdate({id:4},8,'REJECTED','Please verify the details.',fakeConnection)
  assert.equal(result.status,'REJECTED')
  assert.equal(calls.at(-1),'commit')
  assert.equal(calls.some(x=>typeof x==='object'&&/^UPDATE (Farm|Cultivation)/.test(x.sql)),false)
  assert.equal(calls.some(x=>typeof x==='object'&&x.sql.includes('INSERT INTO update_review')),true)
  assert.equal(calls.some(x=>typeof x==='object'&&x.sql.includes('INSERT INTO notification')),true)
})

test('ADMIN and SUPER_ADMIN sessions are both valid for the administrator review area', async t => {
  const {authService}=await import('../backend/business/services/authService.js')
  let activeRole='ADMIN'
  t.mock.method(authService,'resolveSession',async()=>({type:'admin',role:activeRole,id:activeRole==='ADMIN'?2:1}))
  for (const role of ['ADMIN','SUPER_ADMIN']) {
    activeRole=role
    let received
    await requireAuth('admin')({headers:{cookie:'fieldwise_admin=valid-token'},ip:'127.0.0.1'},{},error=>{received=error})
    assert.equal(received,undefined)
  }
})

test('rejection and clarification require a review comment before repository execution', async t => {
  let called=false
  t.mock.method(farmerPortalRepository,'reviewUpdate',async()=>{called=true})
  await assert.rejects(portalService.reviewUpdate({type:'admin',id:4,role:'ADMIN'},8,{decision:'REJECTED'}),error=>error.status===400)
  await assert.rejects(portalService.reviewUpdate({type:'admin',id:4,role:'ADMIN'},8,{decision:'CLARIFICATION_REQUESTED',comment:'   '}),error=>error.status===400)
  assert.equal(called,false)
})

test('clarification review writes history and farmer notification without changing agricultural records', async () => {
  const calls=[]
  const fakeConnection={
    beginTransaction:async()=>calls.push('begin'),commit:async()=>calls.push('commit'),rollback:async()=>calls.push('rollback'),
    execute:async(sql,params)=>{calls.push({sql,params});if(sql.startsWith('SELECT * FROM farmer_update'))return[[{update_id:8,status:'PENDING',account_id:12,farmer_id:44,farm_id:3,cultivation_id:7,target_field:'CULTIVATION_REMARKS',proposed_value:'Growth'}]];return[{affectedRows:1}]}
  }
  const result=await farmerPortalRepository.reviewUpdate({id:4},8,'CLARIFICATION_REQUESTED','Please attach the observation date.',fakeConnection)
  assert.equal(result.status,'CLARIFICATION_REQUESTED')
  assert.equal(calls.at(-1),'commit')
  assert.equal(calls.some(x=>typeof x==='object'&&/^UPDATE (Farm|Cultivation)/.test(x.sql)),false)
  assert.equal(calls.some(x=>typeof x==='object'&&x.sql.includes('INSERT INTO update_review')&&x.params.includes('CLARIFICATION_REQUESTED')),true)
  assert.equal(calls.some(x=>typeof x==='object'&&x.sql.includes('INSERT INTO notification')&&x.params[0]===12),true)
})

test('farmer notifications are scoped to the authenticated account', async t => {
  let captured
  t.mock.method(pool,'execute',async(sql,params)=>{captured={sql,params};return[[]]})
  await farmerPortalRepository.notifications({type:'farmer',id:12,farmerId:44})
  assert.match(captured.sql,/WHERE account_id=\? ORDER BY/)
  assert.deepEqual(captured.params,[12])
})

test('review rolls back approved agricultural changes if notification creation fails', async () => {
  const calls=[]
  const fakeConnection={
    beginTransaction:async()=>calls.push('begin'),commit:async()=>calls.push('commit'),rollback:async()=>calls.push('rollback'),
    execute:async(sql)=>{calls.push(sql);if(sql.startsWith('SELECT * FROM farmer_update'))return[[{update_id:8,status:'PENDING',account_id:12,farmer_id:44,farm_id:3,cultivation_id:7,target_field:'CULTIVATION_STATUS',proposed_value:'HARVESTED'}]];if(sql.startsWith('SELECT Cultivation_ID'))return[[{Cultivation_ID:7}]];if(sql.includes('INSERT INTO notification'))throw new Error('notification insert failed');return[{affectedRows:1}]}
  }
  await assert.rejects(farmerPortalRepository.reviewUpdate({id:4},8,'APPROVED',null,fakeConnection),/notification insert failed/)
  assert.equal(calls.includes('rollback'),true)
  assert.equal(calls.includes('commit'),false)
})

test('approval rolls back when the linked agricultural target is invalid', async () => {
  const calls=[]
  const fakeConnection={
    beginTransaction:async()=>calls.push('begin'),
    commit:async()=>calls.push('commit'),
    rollback:async()=>calls.push('rollback'),
    execute:async(sql)=>{calls.push(sql);if(sql.startsWith('SELECT * FROM farmer_update'))return[[{update_id:8,status:'PENDING',account_id:12,target_field:'CULTIVATION_STATUS',cultivation_id:null}]];return[{affectedRows:1}]}
  }
  await assert.rejects(farmerPortalRepository.reviewUpdate({id:4},8,'APPROVED',null,fakeConnection),/needs a linked cultivation/)
  assert.equal(calls.includes('rollback'),true)
  assert.equal(calls.includes('commit'),false)
  assert.equal(calls.some(call=>typeof call==='string'&&call.startsWith('UPDATE Cultivation')),false)
})
