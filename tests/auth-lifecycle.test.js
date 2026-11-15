import test from 'node:test'
import assert from 'node:assert/strict'
import bcrypt from 'bcryptjs'
import { authController } from '../backend/application/controllers/authController.js'
import { requireAuth } from '../backend/application/middleware/authentication.js'
import { authRepository } from '../backend/data-access/repositories/authRepository.js'
import { authService } from '../backend/business/services/authService.js'
import { readCookie, verifyToken } from '../backend/utils/jwt.js'

process.env.JWT_SECRET='fieldwise-test-secret-for-auth-lifecycle-32-bytes'

test('farmer login cookie is accepted by session resolution, /auth/me, and farmer middleware', async t => {
  const password='Farmer-Portal-Password-123'
  const passwordHash=await bcrypt.hash(password,4)
  const account={account_id:71,farmer_id:6,email:'farmer@example.test',password_hash:passwordHash,status:'ACTIVE',created_at:'2026-11-11'}
  t.mock.method(authRepository,'findFarmerAccountByEmail',async()=>account)
  t.mock.method(authRepository,'findFarmerAccountById',async()=>({account_id:71,farmer_id:6,email:account.email,status:'ACTIVE',created_at:account.created_at}))
  t.mock.method(authRepository,'findFarmerById',async id=>({Farmer_ID:id,Name:'Test Farmer',Email:account.email}))

  const response={headers:[],append(_name,value){this.headers.push(value);return this},json(value){this.body=value;return this}}
  let loginError
  await authController.farmerLogin({body:{email:account.email,password}},response,error=>{loginError=error})
  assert.equal(loginError,undefined)
  assert.equal(response.body.user.type,'farmer')
  const setCookie=response.headers.find(value=>value.startsWith('fieldwise_farmer='))
  assert.match(setCookie,/HttpOnly; SameSite=Strict; Path=\/api/)
  const cookiePair=setCookie.split(';')[0]
  const token=readCookie({headers:{cookie:cookiePair}},'fieldwise_farmer')
  assert.ok(token)
  assert.deepEqual({type:verifyToken(token).type,farmerId:verifyToken(token).farmerId},{type:'farmer',farmerId:6})

  const request={headers:{cookie:cookiePair}}
  let receivedUser
  await requireAuth('farmer')(request,{},error=>{if(error)throw error;receivedUser=request.user})
  assert.equal(receivedUser.id,71)
  assert.equal(receivedUser.farmerId,6)

  const meResponse={json(value){this.body=value;return this}}
  let meError
  await authController.me(request,meResponse,error=>{meError=error})
  assert.equal(meError,undefined)
  assert.equal(meResponse.body.user.type,'farmer')
  assert.equal(meResponse.body.user.farmerId,6)
})

test('invalid JWT diagnostics contain only a safe reason and portal type', async t => {
  const messages=[]
  t.mock.method(console,'warn',(...args)=>messages.push(args))
  await assert.rejects(authService.resolveSession('deliberately-invalid-token','farmer'),error=>error.status===401&&error.message==='Authentication required.')
  assert.equal(messages.length,1)
  assert.equal(messages[0][0],'[auth] JWT verification rejected')
  assert.deepEqual(messages[0][1],{expectedType:'farmer',reason:'JWT_FORMAT_INVALID'})
  assert.equal(JSON.stringify(messages).includes('deliberately-invalid-token'),false)
})

test('administrator and farmer cookies remain isolated by portal role', async t => {
  t.mock.method(authService,'resolveSession',async(_token,type)=>({type,id:9}))
  let farmerError,adminError
  await requireAuth('farmer')({headers:{cookie:'fieldwise_admin=admin-token'}},{},error=>{farmerError=error})
  await requireAuth('admin')({headers:{cookie:'fieldwise_farmer=farmer-token'}},{},error=>{adminError=error})
  assert.equal(farmerError.status,401)
  assert.equal(adminError.status,401)
})

