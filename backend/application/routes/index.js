
import { Router } from 'express'

import { recordsController as c } from '../controllers/recordsController.js'
import { authController as auth } from '../controllers/authController.js'
import { portalController as portal } from '../controllers/portalController.js'
import { weatherObservationController as weather } from '../controllers/weatherObservationController.js'

import {
    authLoginLimiter,
    requireAdminRole,
    requireAuth
} from '../middleware/authentication.js'

export const routes = Router()

// =====================================================
// PUBLIC ROUTES
// =====================================================

routes.get('/health', c.health)

routes.post('/auth/admin/login', authLoginLimiter, auth.adminLogin)
routes.post('/auth/farmer/login', authLoginLimiter, auth.farmerLogin)

routes.get('/auth/me', auth.me)
routes.post('/auth/logout', auth.logout)


// =====================================================
// ADMIN AUTHENTICATION AND ROUTES
// =====================================================

routes.use('/admin', requireAuth('admin'))

routes.get('/admin/dashboard', portal.adminDashboard)

routes.get('/admin/farmers', portal.listFarmers)
routes.get('/admin/farmers/:id', portal.farmerProfile)
routes.post('/admin/farmers', portal.createFarmer)
routes.put('/admin/farmers/:id', portal.updateFarmer)

routes.get('/admin/farms', portal.listFarms)

routes.get('/admin/updates', portal.listUpdates)
routes.get('/admin/updates/:id', portal.getUpdate)
routes.post('/admin/updates/:id/review', portal.reviewUpdate)

routes.get(
    '/admin/admins',
    requireAdminRole('SUPER_ADMIN'),
    portal.listAdmins
)

routes.post(
    '/admin/admins',
    requireAdminRole('SUPER_ADMIN'),
    portal.createAdmin
)

routes.post(
    '/admin/admins/bulk',
    requireAdminRole('SUPER_ADMIN'),
    portal.createAdminAccounts
)

routes.patch(
    '/admin/admins/:id/status',
    requireAdminRole('SUPER_ADMIN'),
    portal.setAdminStatus
)

routes.get('/admin/farmer-accounts', portal.listFarmerAccounts)
routes.post('/admin/farmer-accounts', portal.createFarmerAccount)
routes.post('/admin/farmer-accounts/bulk', portal.createFarmerAccounts)

routes.patch(
    '/admin/farmer-accounts/:id/status',
    portal.setFarmerAccountStatus
)

routes.get('/admin/notifications', portal.notifications)

routes.patch(
    '/admin/notifications/:id/read',
    portal.markNotificationRead
)


// =====================================================
// FARMER AUTHENTICATION AND ROUTES
// =====================================================

routes.use('/farmer', requireAuth('farmer'))

routes.get('/farmer/dashboard', portal.farmerDashboard)
routes.get('/farmer/me', portal.farmerDashboard)

routes.get('/farmer/farms', portal.farmerFarms)
routes.get('/farmer/cultivations', portal.farmerCultivations)
routes.get('/farmer/crops', portal.farmerCrops)

routes.get('/farmer/soil-tests', portal.farmerSoilTests)
routes.get('/farmer/weather', portal.farmerWeather)

routes.get('/farmer/fertilizers', portal.farmerFertilizers)
routes.get('/farmer/fertilizer-usage', portal.farmerFertilizerUsage)

routes.get('/farmer/pests', portal.farmerPests)
routes.get('/farmer/advisories', portal.farmerAdvisories)
routes.get('/farmer/alerts', portal.farmerAlerts)

routes.get('/farmer/markets', portal.farmerMarkets)
routes.get('/farmer/market-prices', portal.farmerMarkets)
routes.get('/farmer/market-intelligence', portal.farmerMarkets)

routes.get('/farmer/updates', portal.farmerUpdates)
routes.get('/farmer/updates/:id', portal.farmerUpdate)

routes.post('/farmer/updates', portal.submitFarmerUpdate)

routes.post(
    '/farmer/updates/:id/respond',
    portal.respondToClarification
)

routes.get('/farmer/notifications', portal.notifications)

routes.patch(
    '/farmer/notifications/:id/read',
    portal.markNotificationRead
)

routes.put('/farmer/password', portal.changePassword)


// =====================================================
// MONGODB WEATHER OBSERVATION ROUTES
// =====================================================

// CREATE: Store a weather observation
routes.post(
    '/farmer/weather-observations',
    weather.create
)

// READ: Retrieve all observations belonging to a farm
routes.get(
    '/farmer/weather-observations/:farmId',
    weather.listByFarm
)

// READ: Retrieve one observation using its MongoDB ID
routes.get(
    '/farmer/weather-observations/detail/:id',
    weather.getById
)

// UPDATE: Modify a weather observation
routes.put(
    '/farmer/weather-observations/:id',
    weather.update
)

// DELETE: Remove a weather observation
routes.delete(
    '/farmer/weather-observations/:id',
    weather.remove
)


// =====================================================
// ADMIN-ONLY LEGACY MANAGEMENT ROUTES
// =====================================================

// Every legacy management, analytics, operation,
// and CRUD endpoint is admin-only.

routes.use(requireAuth('admin'))

routes.get('/dashboard', c.dashboard)

routes.get('/database-operations', c.databaseOperations)
routes.get('/database-operations/metadata', c.operationsMetadata)
routes.get('/database-operations/audit', c.auditRecords)

routes.post(
    '/database-operations/execute',
    c.executeDatabaseOperation
)

routes.get(
    '/database-operations/views/farmer-farm-summary',
    c.farmerFarmSummary
)

routes.post('/cultivation/transaction', c.registerCultivation)


// =====================================================
// ANALYTICS AND REPORTS
// =====================================================

routes.get('/insights/dashboard', c.advancedDashboard)

routes.get(
    '/insights/crop-advisory/:farmId',
    c.cropAdvisory
)

routes.get(
    '/insights/market-intelligence',
    c.marketIntelligence
)

routes.get('/alerts', c.alerts)
routes.get('/audit', c.farmerAudit)

routes.get('/reports/:report', c.report)


// =====================================================
// DATABASE PROCEDURES AND FUNCTIONS
// =====================================================

routes.get('/procedures/farmer/:id', c.farmerDetails)

routes.get(
    '/procedures/farmer/:id/farms',
    c.farmsByFarmer
)

routes.get(
    '/functions/farmer/:id/area',
    c.totalFarmArea
)


// =====================================================
// GENERIC ADMIN CRUD ROUTES
// =====================================================

routes.get('/:slug', c.list)
routes.post('/:slug', c.create)
routes.put('/:slug/:id', c.update)
routes.delete('/:slug/:id', c.remove)
