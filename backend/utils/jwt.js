import { createHmac, timingSafeEqual } from 'node:crypto'

const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url')
const sessionError = code => Object.assign(new Error('Invalid session.'), { code })
function secret() {
  const value = process.env.JWT_SECRET || ''
  if (Buffer.byteLength(value) < 32) throw Object.assign(new Error('JWT_SECRET must contain at least 32 bytes.'), { code: 'JWT_SECRET_INVALID' })
  return value
}
export function signToken(payload, ttlSeconds = 8 * 60 * 60) {
  const now = Math.floor(Date.now() / 1000)
  const header = encode({ alg: 'HS256', typ: 'JWT' })
  const body = encode({ ...payload, iss: 'fieldwise', iat: now, exp: now + ttlSeconds })
  const input = `${header}.${body}`
  const signature = createHmac('sha256', secret()).update(input).digest('base64url')
  return `${input}.${signature}`
}
export function verifyToken(token) {
  if (typeof token !== 'string') throw sessionError('JWT_FORMAT_INVALID')
  const parts = token.split('.')
  if (parts.length !== 3) throw sessionError('JWT_FORMAT_INVALID')
  const input = `${parts[0]}.${parts[1]}`
  const expected = createHmac('sha256', secret()).update(input).digest()
  let received
  try { received = Buffer.from(parts[2], 'base64url') } catch { throw sessionError('JWT_SIGNATURE_ENCODING_INVALID') }
  if (received.toString('base64url') !== parts[2] || received.length !== expected.length || !timingSafeEqual(received, expected)) throw sessionError('JWT_SIGNATURE_INVALID')
  let header, claims
  try { header = JSON.parse(Buffer.from(parts[0], 'base64url').toString()); claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString()) } catch { throw sessionError('JWT_CLAIMS_INVALID') }
  if (header.alg !== 'HS256' || claims.iss !== 'fieldwise' || !Number.isInteger(claims.exp)) throw sessionError('JWT_CLAIMS_INVALID')
  if (claims.exp <= Math.floor(Date.now() / 1000)) throw sessionError('JWT_EXPIRED')
  if (!['admin', 'farmer'].includes(claims.type)) throw sessionError('JWT_ROLE_INVALID')
  return claims
}

export function readCookie(req, name) {
  const header = req.headers.cookie || ''
  for (const part of header.split(';')) {
    const index = part.indexOf('=')
    if (index < 0) continue
    if (part.slice(0, index).trim() === name) {
      try { return decodeURIComponent(part.slice(index + 1).trim()) } catch { return null }
    }
  }
  return null
}
