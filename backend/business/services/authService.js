import bcrypt from 'bcryptjs'
import { authRepository } from '../../data-access/repositories/authRepository.js'
import { verifyToken } from '../../utils/jwt.js'
import { AppError } from '../../utils/errors.js'

const normalizeEmail = value => String(value || '').trim().toLowerCase()
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_ACCOUNT_BATCH = 50
export const passwordPolicy = password => typeof password === 'string' && password.length >= 12 && password.length <= 128
const safeAdmin = row => ({ id: row.admin_id, type: 'admin', name: row.name, email: row.email, role: row.role, createdAt: row.created_at })
const safeFarmer = row => ({ id: row.account_id, type: 'farmer', farmerId: row.farmer_id, name: row.farmer_name || row.name, email: row.email, role: 'FARMER', createdAt: row.created_at })

function requireEmail(value) {
  const email = normalizeEmail(value)
  if (!emailPattern.test(email) || email.length > 254) throw new AppError('Enter a valid email address.', 400)
  return email
}
function requirePassword(value) {
  if (typeof value !== 'string' || !passwordPolicy(value)) throw new AppError('Password must be between 12 and 128 characters.', 400)
  return value
}
function requireName(value, label = 'Name') {
  const name = String(value || '').trim()
  if (name.length < 2 || name.length > 120) throw new AppError(`${label} must be between 2 and 120 characters.`, 400)
  return name
}
function requireBatch(actor, accounts, role) {
  if (actor?.type !== 'admin' || (role === 'admin' && actor.role !== 'SUPER_ADMIN') || (role === 'farmer' && !['ADMIN','SUPER_ADMIN'].includes(actor.role))) {
    throw new AppError(role === 'admin' ? 'Super administrator access required.' : 'Administrator access required.', 403)
  }
  if (!Array.isArray(accounts) || accounts.length < 1 || accounts.length > MAX_ACCOUNT_BATCH) {
    throw new AppError(`Provide between 1 and ${MAX_ACCOUNT_BATCH} accounts per batch.`, 400)
  }
}
function batchErrorResults(accounts, errors, type) {
  return accounts.map((entry, index) => ({
    index,
    ...(type === 'farmer' ? { farmerId: Number(entry?.farmerId) || null } : { name: String(entry?.name || '').trim().slice(0,120) }),
    email: normalizeEmail(entry?.email),
    status: errors.has(index) ? 'FAILED_VALIDATION' : 'NOT_CREATED',
    error: errors.get(index) || 'Batch validation failed; no accounts were created.'
  }))
}
function repositoryErrorMessage(error) {
  if (error.code === 'EMAIL_EXISTS') return error.message
  if (error.code === 'TEAM_ADMIN_EXISTS') return error.message
  if (error.code === 'FARMER_NOT_FOUND') return error.message
  if (error.code === 'FARMER_ACCOUNT_EXISTS') return error.message
  if (error.code === 'ER_DUP_ENTRY') return 'A duplicate account or email conflicts with an existing record; the full batch was rolled back.'
  return 'Account creation failed; the full batch was rolled back.'
}

export const authService = {
  async loginAdmin({ email: rawEmail, password }) {
    const email = requireEmail(rawEmail)
    if (typeof password !== 'string' || password.length > 128) throw new AppError('Invalid email or password.', 401)
    const account = await authRepository.findAdminByEmail(email)
    if (!account || account.status !== 'ACTIVE' || !await bcrypt.compare(password, account.password_hash)) throw new AppError('Invalid email or password.', 401)
    return { user: safeAdmin(account), claims: { sub: account.admin_id, type: 'admin', role: account.role } }
  },
  async loginFarmer({ email: rawEmail, password }) {
    const email = requireEmail(rawEmail)
    if (typeof password !== 'string' || password.length > 128) throw new AppError('Invalid email or password.', 401)
    const account = await authRepository.findFarmerAccountByEmail(email)
    if (!account || account.status !== 'ACTIVE' || !await bcrypt.compare(password, account.password_hash)) throw new AppError('Invalid email or password.', 401)
    const farmer = await authRepository.findFarmerById(account.farmer_id)
    if (!farmer) throw new AppError('Invalid email or password.', 401)
    return { user: safeFarmer({ ...account, name: farmer.Name }), claims: { sub: account.account_id, type: 'farmer', farmerId: account.farmer_id, role: 'FARMER' } }
  },
  async resolveSession(token, expectedType) {
    let claims
    try { claims = verifyToken(token) } catch (error) {
      const knownReasons = new Set(['JWT_SECRET_INVALID','JWT_FORMAT_INVALID','JWT_SIGNATURE_ENCODING_INVALID','JWT_SIGNATURE_INVALID','JWT_CLAIMS_INVALID','JWT_EXPIRED','JWT_ROLE_INVALID'])
      console.warn('[auth] JWT verification rejected', {
        expectedType,
        reason: knownReasons.has(error?.code) ? error.code : 'JWT_VERIFICATION_FAILED'
      })
      throw new AppError('Authentication required.', 401)
    }
    if (claims.type !== expectedType) throw new AppError('This account cannot access that portal.', 403)
    if (expectedType === 'admin') {
      const account = await authRepository.findAdminById(claims.sub)
      if (!account || account.status !== 'ACTIVE' || account.role !== claims.role) throw new AppError('This administrator account is inactive.', 401)
      return { ...safeAdmin(account), role: account.role }
    }
    const account = await authRepository.findFarmerAccountById(claims.sub)
    if (!account || account.status !== 'ACTIVE' || Number(account.farmer_id) !== Number(claims.farmerId)) throw new AppError('This farmer account is inactive.', 401)
    const farmer = await authRepository.findFarmerById(account.farmer_id)
    if (!farmer) throw new AppError('This farmer account is inactive.', 401)
    return safeFarmer({ ...account, name: farmer.Name })
  },
  async createAdminAccounts(actor, accounts) {
    requireBatch(actor, accounts, 'admin')
    const errors = new Map(), normalized = [], seenEmails = new Set(), seenTeamNames = new Set()
    accounts.forEach((entry, index) => {
      try {
        const name = requireName(entry?.name, 'Administrator name')
        const email = requireEmail(entry?.email)
        const password = requirePassword(entry?.password)
        if (entry?.role != null && entry.role !== 'ADMIN') throw new AppError('Only the ADMIN role may be created here.', 400)
        if (seenEmails.has(email)) throw new AppError('This email is repeated in the batch.', 400)
        seenEmails.add(email)
        const teamName=name.toLowerCase()
        if(['vikhyath bharadwaj k s','yaseen mulla'].includes(teamName)&&seenTeamNames.has(teamName))throw new AppError('This project team administrator is repeated in the batch.',400)
        if(['vikhyath bharadwaj k s','yaseen mulla'].includes(teamName))seenTeamNames.add(teamName)
        normalized[index] = { name, email, password }
      } catch (error) { errors.set(index, error.message) }
    })
    if (errors.size) return { ok: false, message: 'Correct the invalid entries; no accounts were created.', results: batchErrorResults(accounts, errors, 'admin') }
    const hashed = await Promise.all(normalized.map(async account => ({ ...account, passwordHash: await bcrypt.hash(account.password, 12) })))
    try {
      const created = await authRepository.createAdminAccounts(hashed)
      return { ok: true, results: created.map((account, index) => ({ index, name: account.name, email: account.email, status: 'CREATED', account })) }
    } catch (error) {
      const message = repositoryErrorMessage(error)
      const failedIndex = normalized.findIndex(account => account.email === error.email || account.name.toLowerCase() === String(error.nameValue||'').toLowerCase())
      return { ok: false, message, results: normalized.map((account, index) => ({ index, name: account.name, email: account.email, status: failedIndex === index ? 'FAILED' : 'ROLLED_BACK', error: failedIndex === index ? message : 'Not created because the batch transaction was rolled back.' })) }
    }
  },
  async createFarmerAccounts(actor, accounts) {
    requireBatch(actor, accounts, 'farmer')
    const errors = new Map(), normalized = [], seenEmails = new Set(), seenFarmers = new Set()
    accounts.forEach((entry, index) => {
      try {
        const farmerId = Number(entry?.farmerId)
        if (!Number.isInteger(farmerId) || farmerId < 1) throw new AppError('Select a valid existing Farmer_ID.', 400)
        if (seenFarmers.has(farmerId)) throw new AppError('This Farmer_ID is repeated in the batch.', 400)
        seenFarmers.add(farmerId)
        const email = requireEmail(entry?.email)
        const password = requirePassword(entry?.password)
        if (seenEmails.has(email)) throw new AppError('This email is repeated in the batch.', 400)
        seenEmails.add(email)
        normalized[index] = { farmerId, email, password }
      } catch (error) { errors.set(index, error.message) }
    })
    if (errors.size) return { ok: false, message: 'Correct the invalid entries; no accounts were created.', results: batchErrorResults(accounts, errors, 'farmer') }
    const hashed = await Promise.all(normalized.map(async account => ({ ...account, passwordHash: await bcrypt.hash(account.password, 12) })))
    try {
      const created = await authRepository.createFarmerAccounts(hashed)
      return { ok: true, results: created.map((account, index) => ({ index, farmerId: account.farmer_id, email: account.email, status: 'CREATED', account })) }
    } catch (error) {
      const message = repositoryErrorMessage(error)
      const failedIndex = normalized.findIndex(account => account.email === error.email || account.farmerId === Number(error.farmerId))
      return { ok: false, message, results: normalized.map((account, index) => ({ index, farmerId: account.farmerId, email: account.email, status: failedIndex === index ? 'FAILED' : 'ROLLED_BACK', error: failedIndex === index ? message : 'Not created because the batch transaction was rolled back.' })) }
    }
  },
  async createAdmin(actor, body) {
    const result = await this.createAdminAccounts(actor, [body])
    if (!result.ok) throw new AppError(result.results[0]?.error || result.message, 409)
    return result.results[0].account
  },
  async createFarmerAccount(actor, body) {
    const result = await this.createFarmerAccounts(actor, [body])
    if (!result.ok) throw new AppError(result.results[0]?.error || result.message, 409)
    return result.results[0].account
  },
  async changeFarmerPassword(user, body) {
    if (user?.type !== 'farmer') throw new AppError('Farmer access required.', 403)
    const currentPassword = body?.currentPassword
    const newPassword = requirePassword(body?.newPassword)
    const account = await authRepository.findFarmerAccountByEmail(user.email)
    if (!account || Number(account.account_id) !== Number(user.id) || !await bcrypt.compare(String(currentPassword || ''), account.password_hash)) throw new AppError('Current password is incorrect.', 400)
    await authRepository.changeFarmerPassword(user.id, await bcrypt.hash(newPassword, 12))
    return { changed: true }
  },
  async bootstrapAdmin({ name, email: rawEmail, password }) {
    const cleanName = String(name || '').trim()
    const cleanEmail = requireEmail(rawEmail)
    const cleanPassword = requirePassword(password)
    if (cleanName.length < 2 || cleanName.length > 120) throw new AppError('Bootstrap administrator name must be between 2 and 120 characters.', 400)
    try { return await authRepository.bootstrapAdmin({ name: cleanName, email: cleanEmail, passwordHash: await bcrypt.hash(cleanPassword, 12) }) }
    catch (error) {
      if (['BOOTSTRAP_COMPLETE','ER_DUP_ENTRY'].includes(error.code)) throw new AppError(error.message, 409)
      throw error
    }
  }
}
