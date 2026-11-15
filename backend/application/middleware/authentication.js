import { readCookie } from '../../utils/jwt.js'
import { authService } from '../../business/services/authService.js'
import { AppError } from '../../utils/errors.js'

const cookieFor = type => type === 'admin' ? 'fieldwise_admin' : 'fieldwise_farmer'
const failures = new Map()

export function authLoginLimiter(req, res, next) {
  const email = String(req.body?.email || '').trim().toLowerCase().slice(0,254)
  const key = `${req.ip || 'unknown'}:${email}`
  const now = Date.now()
  const state = failures.get(key)
  if (state?.lockedUntil > now) return res.status(429).json({ error: 'Too many sign-in attempts. Try again later.' })
  res.once('finish', () => {
    if (res.statusCode === 401) {
      const current = failures.get(key) || { count: 0, lockedUntil: 0 }
      current.count += 1
      if (current.count >= 8) { current.count = 0; current.lockedUntil = Date.now() + 15 * 60 * 1000 }
      failures.set(key, current)
      if (failures.size > 5000) {
        const currentTime = Date.now()
        for (const [candidate, entry] of failures) {
          if (entry.lockedUntil < currentTime) failures.delete(candidate)
          if (failures.size <= 4000) break
        }
      }
    } else if (res.statusCode < 400) failures.delete(key)
  })
  next()
}

export function requireAuth(type) {
  return async (req, _res, next) => {
    try {
      const token = readCookie(req, cookieFor(type))
      if (!token) throw new AppError('Authentication required.', 401)
      req.user = await authService.resolveSession(token, type)
      next()
    } catch (error) { next(error) }
  }
}

export function requireAdminRole(...roles) {
  return (req, _res, next) => {
    if (req.user?.type !== 'admin' || (roles.length && !roles.includes(req.user.role))) return next(new AppError('You are not permitted to perform this administrator action.', 403))
    next()
  }
}

export async function resolveOptionalSession(req) {
  const adminToken = readCookie(req, cookieFor('admin'))
  const farmerToken = readCookie(req, cookieFor('farmer'))
  if (adminToken) {
    try { return await authService.resolveSession(adminToken, 'admin') } catch {}
  }
  if (farmerToken) {
    try { return await authService.resolveSession(farmerToken, 'farmer') } catch {}
  }
  return null
}
