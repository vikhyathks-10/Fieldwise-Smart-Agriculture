import test from 'node:test'
import assert from 'node:assert/strict'
import { farmerPortalRepository } from '../backend/data-access/repositories/farmerPortalRepository.js'
import { portalService } from '../backend/business/services/portalService.js'
import { pool } from '../backend/database/connection/pool.js'
import { routes } from '../backend/application/routes/index.js'

test('farmer soil tests are selected only through farms owned by the authenticated farmer', async t => {
  let captured
  t.mock.method(pool, 'execute', async (sql, params) => { captured={sql,params}; return [[]] })
  const result=await farmerPortalRepository.farmerSoilTests({type:'farmer',farmerId:36})
  assert.deepEqual(result,[])
  assert.match(captured.sql,/INNER JOIN Farm fm ON fm\.Farm_ID=st\.Farm_ID/)
  assert.match(captured.sql,/WHERE fm\.Farmer_ID=\?/)
  assert.deepEqual(captured.params,[36])
})

test('farmer fertilizer usage joins each application to the farmer-owned farm', async t => {
  let captured
  t.mock.method(pool, 'execute', async (sql, params) => { captured={sql,params}; return [[]] })
  await farmerPortalRepository.farmerFertilizerUsage({type:'farmer',farmerId:52})
  assert.match(captured.sql,/JOIN Farm fm ON fm\.Farm_ID=cu\.Farm_ID/)
  assert.match(captured.sql,/WHERE fm\.Farmer_ID=\?/)
  assert.deepEqual(captured.params,[52])
})

test('farmer weather uses EXISTS against owned farm locations and never accepts a requested Farmer_ID', async t => {
  let captured
  t.mock.method(pool, 'execute', async (sql, params) => { captured={sql,params}; return [[]] })
  await farmerPortalRepository.farmerWeather({type:'farmer',farmerId:18})
  assert.match(captured.sql,/EXISTS \(SELECT 1 FROM Farm fm WHERE fm\.Farmer_ID=\?/)
  assert.deepEqual(captured.params,[18])
})

test('shared catalogue endpoints reject a non-farmer service principal', async () => {
  await assert.rejects(async()=>portalService.farmerFertilizers({type:'admin',farmerId:18}),error=>error.status===403)
  await assert.rejects(async()=>portalService.farmerMarkets({type:'admin',farmerId:18},{}),error=>error.status===403)
})

test('all new farmer API routes are registered after farmer auth and before the admin-only legacy router', () => {
  const stack=routes.stack
  const farmerGate=stack.findIndex(layer=>String(layer.regexp).includes('\\/farmer\\/?'))
  const adminGate=stack.findIndex((layer,index)=>index>farmerGate&&layer.name!=='bound dispatch'&&String(layer.regexp)==='/^\\/?(?=\\/|$)/i')
  assert.ok(farmerGate>=0)
  assert.ok(adminGate>farmerGate)
  for(const path of ['/farmer/crops','/farmer/soil-tests','/farmer/weather','/farmer/fertilizers','/farmer/fertilizer-usage','/farmer/pests','/farmer/advisories','/farmer/alerts','/farmer/markets','/farmer/market-prices','/farmer/market-intelligence']){
    const index=stack.findIndex(layer=>layer.route?.path===path)
    assert.ok(index>farmerGate&&index<adminGate,`${path} must remain inside the farmer-protected route group`)
  }
})

