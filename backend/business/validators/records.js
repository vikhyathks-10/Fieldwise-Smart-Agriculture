import { AppError } from '../../utils/errors.js'
export function validateRecord(meta, body, { update = false } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new AppError('Body must be a JSON object.',400)
  const allowed = new Set(meta.fields.map(([name])=>name))
  const data = Object.fromEntries(Object.entries(body).filter(([key])=>allowed.has(key) && (!update || key !== meta.key)))
  if (!Object.keys(data).length) throw new AppError('No writable fields were provided.',400)
  const required = update ? [] : meta.required
  const missing = required.filter(k=>data[k]===undefined||data[k]===null||data[k]==='')
  if (missing.length) throw new AppError(`Required fields: ${missing.join(', ')}`,400)
  for (const [key,value] of Object.entries(data)) {
    if (value === '') { data[key] = null; continue }
    if (value === null) continue
    if (typeof value === 'string' && value.length > 5000) throw new AppError(`${key} is too long.`,400)
    const field = meta.fields.find(f=>f[0]===key)
    if (field?.[2] === 'number' && !Number.isFinite(Number(value))) throw new AppError(`${key} must be a valid number.`,400)
    if (field?.[2] === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new AppError('Enter a valid email address.',400)
    if (field?.[2] === 'number') {
      data[key] = Number(value)
      const isIdentifier=key===meta.key||(meta.references||[]).some(([referenceField])=>referenceField===key)
      if(isIdentifier&&(!Number.isInteger(data[key])||data[key]<1))throw new AppError(`${key} must be a positive integer.`,400)
    }
  }
  return data
}
export function validateId(id) { if (!/^\d+$/.test(String(id))) throw new AppError('Record ID must be a positive integer.',400); return id }
