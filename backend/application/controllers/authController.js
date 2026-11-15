import { authService } from '../../business/services/authService.js'
import { signToken } from '../../utils/jwt.js'
import { resolveOptionalSession } from '../middleware/authentication.js'
import { toAppError } from '../../utils/errors.js'

const cookieFlags = `HttpOnly; SameSite=Strict; Path=/api; Max-Age=${8 * 60 * 60}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
const setCookie = (res, name, value) => res.append('Set-Cookie', `${name}=${encodeURIComponent(value)}; ${cookieFlags}`)
const clearCookie = (res, name) => res.append('Set-Cookie', `${name}=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`)

export const authController = {
  adminLogin: (req, res, next) => login(req, res, next, 'admin'),
  farmerLogin: (req, res, next) => login(req, res, next, 'farmer'),
  async me(req, res, next) {
    try { return res.json({ user: await resolveOptionalSession(req) }) }
    catch (error) { return next(toAppError(error)) }
  },
  logout(_req, res) {
    clearCookie(res, 'fieldwise_admin')
    clearCookie(res, 'fieldwise_farmer')
    return res.json({ loggedOut: true })
  },
  async changeFarmerPassword(req, res, next) {
    try { return res.json(await authService.changeFarmerPassword(req.user, req.body)) }
    catch (error) { return next(toAppError(error)) }
  }
}

async function login(req, res, next, type) {
  try {
    const result = type === 'admin' ? await authService.loginAdmin(req.body || {}) : await authService.loginFarmer(req.body || {})
    const token = signToken(result.claims)
    if (type === 'admin') { setCookie(res, 'fieldwise_admin', token); clearCookie(res, 'fieldwise_farmer') }
    else { setCookie(res, 'fieldwise_farmer', token); clearCookie(res, 'fieldwise_admin') }
    return res.json({ user: result.user })
  } catch (error) { return next(toAppError(error)) }
}
