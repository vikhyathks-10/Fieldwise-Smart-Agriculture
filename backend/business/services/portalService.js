import { farmerPortalRepository } from '../../data-access/repositories/farmerPortalRepository.js'
import { authRepository } from '../../data-access/repositories/authRepository.js'
import { recordsService } from './recordsService.js'
import { authService } from './authService.js'
import { insightsService } from './insightsService.js'
import { AppError } from '../../utils/errors.js'

const categories = new Set(['CULTIVATION_PROGRESS','CROP_HEALTH','PEST_DISEASE','IRRIGATION','SOIL_CONDITION','YIELD_ESTIMATE','GENERAL'])
const targets = new Set(['CULTIVATION_STATUS','CULTIVATION_REMARKS','YIELD_ESTIMATE','FARM_SOIL_TYPE'])
const reviewDecisions = new Set(['APPROVED','REJECTED','CLARIFICATION_REQUESTED'])
const positiveId = (value, label) => {
  const id = Number(value)
  if (!Number.isInteger(id) || id < 1) throw new AppError(`${label} must be a positive integer.`, 400)
  return id
}
function requireSuperAdmin(actor) {
  if (actor?.type !== 'admin' || actor.role !== 'SUPER_ADMIN') throw new AppError('Super administrator access required.', 403)
}
function requireFarmer(actor) {
  if (actor?.type !== 'farmer' || !Number.isInteger(Number(actor.farmerId))) throw new AppError('Farmer access required.', 403)
}
const boundedText = (value, label, max, required = false) => {
  if (value == null && !required) return null
  const clean = String(value ?? '').trim()
  if (required && !clean) throw new AppError(`${label} is required.`, 400)
  if (clean.length > max) throw new AppError(`${label} must not exceed ${max} characters.`, 400)
  return clean || null
}

function validateUpdate(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AppError('Update body must be an object.', 400)
  const farmId = positiveId(body.farmId, 'Farm')
  const cultivationId = body.cultivationId == null || body.cultivationId === '' ? null : positiveId(body.cultivationId, 'Cultivation')
  const category = String(body.category || '')
  const targetField = String(body.targetField || '')
  if (!categories.has(category)) throw new AppError('Choose a valid update category.', 400)
  if (!targets.has(targetField)) throw new AppError('Choose a supported agricultural field for administrator approval.', 400)
  if (targetField !== 'FARM_SOIL_TYPE' && cultivationId == null) throw new AppError('Choose a cultivation for the selected update field.', 400)
  const proposedValue = boundedText(body.proposedValue, 'Proposed value', targetField === 'CULTIVATION_REMARKS' ? 255 : 255, true)
  let yieldEstimate = body.yieldEstimate == null || body.yieldEstimate === '' ? null : Number(body.yieldEstimate)
  if (yieldEstimate != null && (!Number.isFinite(yieldEstimate) || yieldEstimate < 0 || yieldEstimate > 99999999.99)) throw new AppError('Yield estimate must be a non-negative number.', 400)
  if (targetField === 'YIELD_ESTIMATE') {
    const numberValue = Number(proposedValue)
    if (!Number.isFinite(numberValue) || numberValue < 0 || numberValue > 99999999.99) throw new AppError('A yield estimate must be a valid non-negative number.', 400)
    yieldEstimate = numberValue
  }
  if (targetField === 'CULTIVATION_STATUS' && proposedValue.length > 50) throw new AppError('Cultivation status must not exceed 50 characters.', 400)
  if (targetField === 'FARM_SOIL_TYPE' && proposedValue.length > 50) throw new AppError('Soil type must not exceed 50 characters.', 400)
  const observedOn = body.observedOn ? String(body.observedOn) : new Date().toISOString().slice(0,10)
  const observedTime = /^\d{4}-\d{2}-\d{2}$/.test(observedOn) ? Date.parse(`${observedOn}T00:00:00.000Z`) : NaN
  if (!Number.isFinite(observedTime) || new Date(observedTime).toISOString().slice(0,10) !== observedOn) throw new AppError('Observation date must be a valid YYYY-MM-DD date.', 400)
  return {
    farmId, cultivationId, category,
    observedOn,
    title: boundedText(body.title, 'Title', 160, true),
    description: boundedText(body.description, 'Description', 5000, true),
    cropCondition: boundedText(body.cropCondition, 'Crop condition', 255),
    progressDetails: boundedText(body.progressDetails, 'Progress details', 5000),
    yieldEstimate, targetField, proposedValue
  }
}

export const portalService = {
  adminDashboard() { return farmerPortalRepository.adminDashboard() },
  listFarmers(search) { return farmerPortalRepository.listFarmers(String(search || '').trim().slice(0, 120)) },
  async farmerProfile(id) { const row = await farmerPortalRepository.farmerProfile(positiveId(id, 'Farmer ID')); if (!row) throw new AppError('Farmer record not found.', 404); return row },
  listFarms() { return farmerPortalRepository.listFarms() },
  listUpdates(status) {
    if (status == null || status === '') return farmerPortalRepository.listUpdates()
    const value = String(status).toUpperCase()
    if (!['PENDING','APPROVED','REJECTED','CLARIFICATION_REQUESTED'].includes(value)) throw new AppError('Choose a valid update status.', 400)
    return farmerPortalRepository.listUpdates(value)
  },
  async getAdminUpdate(id) { const row = await farmerPortalRepository.getUpdate(positiveId(id, 'Update ID')); if (!row) throw new AppError('Farmer update not found.', 404); return row },
  async reviewUpdate(admin, id, body) {
    const decision = String(body?.decision || '').toUpperCase()
    const comment = boundedText(body?.comment, 'Review comment', 2000, decision !== 'APPROVED')
    if (!reviewDecisions.has(decision)) throw new AppError('Choose approve, reject, or request clarification.', 400)
    return farmerPortalRepository.reviewUpdate(admin, positiveId(id, 'Update ID'), decision, comment)
  },
  farmerDashboard(user) { return farmerPortalRepository.farmerDashboard(user) },
  farmerFarms(user) { return farmerPortalRepository.farmerFarms(user) },
  farmerCultivations(user) { return farmerPortalRepository.farmerCultivations(user) },
  farmerCrops(user) { requireFarmer(user); return farmerPortalRepository.farmerCrops(user) },
  farmerSoilTests(user) { requireFarmer(user); return farmerPortalRepository.farmerSoilTests(user) },
  farmerWeather(user) { requireFarmer(user); return farmerPortalRepository.farmerWeather(user) },
  farmerFertilizers(user) { requireFarmer(user); return farmerPortalRepository.farmerFertilizers() },
  farmerFertilizerUsage(user) { requireFarmer(user); return farmerPortalRepository.farmerFertilizerUsage(user) },
  farmerPests(user) { requireFarmer(user); return farmerPortalRepository.farmerPests() },
  farmerAdvisories(user) { requireFarmer(user); return farmerPortalRepository.farmerAdvisories() },
  async farmerAlerts(user) {
    requireFarmer(user)
    const [farms,weather,soil,cultivations,fertilizerUsage,advisories,pests] = await Promise.all([
      farmerPortalRepository.farmerFarms(user),farmerPortalRepository.farmerWeather(user),
      farmerPortalRepository.farmerSoilTests(user),farmerPortalRepository.farmerCultivations(user),
      farmerPortalRepository.farmerFertilizerUsage(user),farmerPortalRepository.farmerAdvisories(),
      farmerPortalRepository.farmerPests()
    ])
    const alerts=[]
    for (const row of weather) alerts.push({category:'Weather',severity:'info',title:`Stored weather · ${row.Village||row.District||`Location ${row.Location_ID}`}`,description:`${row.Temperature??'—'} °C · rainfall ${row.Rainfall??'—'} mm · humidity ${row.Humidity??'—'}%. Stored observation, not a live forecast.`,date:row.Date})
    for (const row of advisories) alerts.push({category:'Advisory',severity:'info',title:row.Title,description:`${row.Pest_Name?`${row.Pest_Name}: `:''}${row.Description||row.Type||'Agricultural advisory'}`,date:row.Advisory_Date})
    for (const row of pests) alerts.push({category:'Pest & disease',severity:'info',title:row.Name,description:`${row.Type||'Information'}${row.Symptoms?`: ${row.Symptoms}`:''}`,date:null})
    const testedFarmIds=new Set(soil.map(row=>Number(row.Farm_ID)))
    for (const farm of farms) if (!testedFarmIds.has(Number(farm.Farm_ID))) alerts.push({category:'Soil testing',severity:'attention',title:`No soil test recorded · ${farm.Farm_Name||`Farm ${farm.Farm_ID}`}`,description:'No soil test is linked to this farm in the stored records.',date:null})
    for (const row of soil) alerts.push({category:'Soil testing',severity:'info',title:`Soil test · ${row.Farm_Name}`,description:`pH ${row.pH_Level??'—'} · N ${row.Nitrogen??'—'} · P ${row.Phosphorus??'—'} · K ${row.Potassium??'—'}`,date:row.Test_Date})
    for (const row of cultivations) alerts.push({category:'Cultivation',severity:'info',title:`${row.Crop_Name} · ${row.Farm_Name}`,description:`Status: ${row.Status||'not recorded'}.`,date:row.Start_Date})
    for (const row of fertilizerUsage) alerts.push({category:'Fertilizer usage',severity:'info',title:`${row.Fertilizer_Name} applied · ${row.Farm_Name}`,description:`${row.Quantity??'Quantity not recorded'}${row.Method?` by ${row.Method}`:''}.`,date:row.Usage_Date})
    return {alerts:alerts.sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))),note:'Personal items are scoped to your linked farms. Shared advisories and pest information are visible to all authenticated farmers.'}
  },
  farmerMarkets(user, filters) { requireFarmer(user); return insightsService.markets(filters) },
  farmerUpdates(user) { return farmerPortalRepository.listFarmerUpdates(user) },
  async farmerUpdate(user, id) { const row = await farmerPortalRepository.farmerUpdate(user, positiveId(id, 'Update ID')); if (!row) throw new AppError('Farmer update not found.', 404); return row },
  async submitFarmerUpdate(user, body) {
    if (user?.type !== 'farmer') throw new AppError('Farmer access required.', 403)
    const data = validateUpdate(body)
    await farmerPortalRepository.assertFarmerFarm(user, data.farmId, data.cultivationId)
    return farmerPortalRepository.submitUpdate(user, data)
  },
  async respondToClarification(user, id, body) {
    const response = boundedText(body?.response, 'Clarification response', 3000, true)
    return farmerPortalRepository.respondToClarification(user, positiveId(id, 'Update ID'), response)
  },
  notifications(user) { return farmerPortalRepository.notifications(user) },
  async markNotificationRead(user, id) { return farmerPortalRepository.markNotificationRead(user, positiveId(id, 'Notification ID')) },
  createAdmin(actor, body) { return authService.createAdmin(actor, body) },
  createAdminAccounts(actor, accounts) { return authService.createAdminAccounts(actor, accounts) },
  listAdmins(actor) { requireSuperAdmin(actor); return authRepository.listAdmins() },
  async setAdminStatus(actor, id, body) {
    requireSuperAdmin(actor)
    const status = String(body?.status || '').toUpperCase()
    if (!['ACTIVE','INACTIVE'].includes(status)) throw new AppError('Administrator status must be ACTIVE or INACTIVE.', 400)
    const targetId = positiveId(id, 'Administrator ID')
    if (Number(targetId) === Number(actor.id) && status !== 'ACTIVE') throw new AppError('You cannot deactivate your own administrator account.', 403)
    try { return await authRepository.setAdminStatus(targetId, status) }
    catch (error) {
      if (error.code === 'LAST_SUPER_ADMIN') throw new AppError(error.message, 409)
      if (error.code === 'NOT_FOUND') throw new AppError(error.message, 404)
      throw error
    }
  },
  createFarmerAccount(actor, body) { return authService.createFarmerAccount(actor, body) },
  createFarmerAccounts(actor, accounts) { return authService.createFarmerAccounts(actor, accounts) },
  listFarmerAccounts() { return authRepository.listFarmerAccounts() },
  async setFarmerAccountStatus(id, body) {
    const status = String(body?.status || '').toUpperCase()
    if (!['ACTIVE','INACTIVE','PENDING'].includes(status)) throw new AppError('Farmer account status must be ACTIVE, INACTIVE, or PENDING.', 400)
    try { return await authRepository.setFarmerAccountStatus(positiveId(id, 'Account ID'), status) }
    catch (error) { if (error.code === 'NOT_FOUND') throw new AppError(error.message, 404); throw error }
  },
  createFarmer(body) { return recordsService.create('farmers', body) },
  updateFarmer(id, body) { return recordsService.update('farmers', id, body) },
  changeFarmerPassword(user, body) { return authService.changeFarmerPassword(user, body) }
}
