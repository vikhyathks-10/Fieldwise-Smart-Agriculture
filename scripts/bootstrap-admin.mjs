import { pool } from '../backend/database/connection/pool.js'
import { authService } from '../backend/business/services/authService.js'

const { BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD } = process.env
try {
  if (!BOOTSTRAP_ADMIN_NAME || !BOOTSTRAP_ADMIN_EMAIL || !BOOTSTRAP_ADMIN_PASSWORD) {
    throw new Error('Set BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_EMAIL, and BOOTSTRAP_ADMIN_PASSWORD in the process environment before running bootstrap.')
  }
  const admin = await authService.bootstrapAdmin({ name: BOOTSTRAP_ADMIN_NAME, email: BOOTSTRAP_ADMIN_EMAIL, password: BOOTSTRAP_ADMIN_PASSWORD })
  console.log(`Initial super administrator created with ID ${admin.admin_id}. Remove the bootstrap variables from the shell now.`)
} catch (error) {
  console.error(`Administrator bootstrap failed: ${error.message}`)
  process.exitCode = 1
} finally {
  delete process.env.BOOTSTRAP_ADMIN_PASSWORD
  await pool.end()
}
