import { pool } from '../../database/connection/pool.js'

async function lockAccountCreation(connection) {
  const [[lock]] = await connection.query("SELECT GET_LOCK('fieldwise_account_creation',10) AS acquired")
  if (Number(lock.acquired) !== 1) { const error = new Error('Could not acquire the account-creation lock.'); error.code = 'ACCOUNT_LOCK'; throw error }
}

const safeAdminRow = row => ({ admin_id: row.admin_id, name: row.name, email: row.email, role: row.role, status: row.status, created_at: row.created_at })
const safeFarmerAccountRow = row => ({ account_id: row.account_id, farmer_id: row.farmer_id, email: row.email, status: row.status, created_at: row.created_at })

export const authRepository = {
  async findAdminByEmail(email) {
    const [rows] = await pool.execute('SELECT admin_id, name, email, password_hash, role, status, created_at FROM admin_account WHERE email=? LIMIT 1', [email])
    return rows[0] || null
  },
  async findAdminById(id) {
    const [rows] = await pool.execute('SELECT admin_id, name, email, role, status, created_at FROM admin_account WHERE admin_id=? LIMIT 1', [id])
    return rows[0] || null
  },
  async findFarmerAccountByEmail(email) {
    const [rows] = await pool.execute('SELECT account_id, farmer_id, email, password_hash, status, created_at FROM farmer_account WHERE email=? LIMIT 1', [email])
    return rows[0] || null
  },
  async findFarmerAccountById(id) {
    const [rows] = await pool.execute('SELECT account_id, farmer_id, email, status, created_at FROM farmer_account WHERE account_id=? LIMIT 1', [id])
    return rows[0] || null
  },
  async createAdminAccounts(accounts) {
    const connection = await pool.getConnection()
    let lockHeld = false
    try {
      await lockAccountCreation(connection)
      lockHeld = true
      await connection.beginTransaction()
      for (const account of accounts) {
        const teamName = account.name.trim().toLowerCase()
        if (['vikhyath bharadwaj k s','yaseen mulla'].includes(teamName)) {
          const [matches] = await connection.execute('SELECT admin_id FROM admin_account WHERE LOWER(TRIM(name))=LOWER(?) LIMIT 1', [account.name])
          if (matches.length) { const error = new Error(`The team administrator ${account.name} already has an account.`); error.code = 'TEAM_ADMIN_EXISTS'; error.nameValue = account.name; throw error }
        }
        const [[exists]] = await connection.execute('SELECT (EXISTS(SELECT 1 FROM admin_account WHERE email=?) OR EXISTS(SELECT 1 FROM farmer_account WHERE email=?)) AS found', [account.email, account.email])
        if (exists?.found) { const error = new Error(`Email ${account.email} is already in use.`); error.code = 'EMAIL_EXISTS'; error.email = account.email; throw error }
      }
      const created = []
      for (const account of accounts) {
        const [result] = await connection.execute("INSERT INTO admin_account (name,email,password_hash,role,status) VALUES (?,?,?,'ADMIN','ACTIVE')", [account.name, account.email, account.passwordHash])
        const [rows] = await connection.execute('SELECT admin_id,name,email,role,status,created_at FROM admin_account WHERE admin_id=?', [result.insertId])
        created.push(safeAdminRow(rows[0]))
      }
      await connection.commit()
      return created
    } catch (error) {
      try { await connection.rollback() } catch {}
      throw error
    } finally {
      if (lockHeld) { try { await connection.query("SELECT RELEASE_LOCK('fieldwise_account_creation')") } catch {} }
      connection.release()
    }
  },
  async createFarmerAccounts(accounts) {
    const connection = await pool.getConnection()
    let lockHeld = false
    try {
      await lockAccountCreation(connection)
      lockHeld = true
      await connection.beginTransaction()
      for (const account of accounts) {
        const [farmers] = await connection.execute('SELECT Farmer_ID FROM Farmer WHERE Farmer_ID=? LIMIT 1', [account.farmerId])
        if (!farmers.length) { const error = new Error(`Farmer ${account.farmerId} was not found.`); error.code = 'FARMER_NOT_FOUND'; error.farmerId = account.farmerId; throw error }
        const [linked] = await connection.execute('SELECT account_id FROM farmer_account WHERE farmer_id=? LIMIT 1', [account.farmerId])
        if (linked.length) { const error = new Error(`Farmer ${account.farmerId} already has a login account.`); error.code = 'FARMER_ACCOUNT_EXISTS'; error.farmerId = account.farmerId; throw error }
        const [[exists]] = await connection.execute('SELECT (EXISTS(SELECT 1 FROM admin_account WHERE email=?) OR EXISTS(SELECT 1 FROM farmer_account WHERE email=?)) AS found', [account.email, account.email])
        if (exists?.found) { const error = new Error(`Email ${account.email} is already in use.`); error.code = 'EMAIL_EXISTS'; error.email = account.email; throw error }
      }
      const created = []
      for (const account of accounts) {
        const [result] = await connection.execute("INSERT INTO farmer_account (farmer_id,email,password_hash,status) VALUES (?,?,?,'ACTIVE')", [account.farmerId, account.email, account.passwordHash])
        const [rows] = await connection.execute('SELECT account_id,farmer_id,email,status,created_at FROM farmer_account WHERE account_id=?', [result.insertId])
        created.push(safeFarmerAccountRow(rows[0]))
      }
      await connection.commit()
      return created
    } catch (error) {
      try { await connection.rollback() } catch {}
      throw error
    } finally {
      if (lockHeld) { try { await connection.query("SELECT RELEASE_LOCK('fieldwise_account_creation')") } catch {} }
      connection.release()
    }
  },
  async listAdmins() {
    const [rows] = await pool.query('SELECT admin_id,name,email,role,status,created_at,updated_at FROM admin_account ORDER BY created_at DESC,admin_id DESC')
    return rows
  },
  async setAdminStatus(id, status, executor) {
    const ownsConnection = !executor
    const connection = executor || await pool.getConnection()
    try {
      await connection.beginTransaction()
      const [rows] = await connection.execute('SELECT admin_id,role,status FROM admin_account WHERE admin_id=? FOR UPDATE', [id])
      if (!rows.length) { const error = new Error('Administrator account not found.'); error.code = 'NOT_FOUND'; throw error }
      const target = rows[0]
      if (target.role === 'SUPER_ADMIN' && target.status === 'ACTIVE' && status !== 'ACTIVE') {
        await connection.query("SELECT admin_id FROM admin_account WHERE role='SUPER_ADMIN' AND status='ACTIVE' FOR UPDATE")
        const [[count]] = await connection.query("SELECT COUNT(*) AS total FROM admin_account WHERE role='SUPER_ADMIN' AND status='ACTIVE'")
        if (Number(count.total) <= 1) { const error = new Error('The final active super administrator cannot be deactivated.'); error.code = 'LAST_SUPER_ADMIN'; throw error }
      }
      await connection.execute('UPDATE admin_account SET status=? WHERE admin_id=?', [status, id])
      const [updated] = await connection.execute('SELECT admin_id,name,email,role,status,created_at FROM admin_account WHERE admin_id=?', [id])
      await connection.commit()
      return updated[0] || null
    } catch (error) {
      try { await connection.rollback() } catch {}
      throw error
    } finally { if (ownsConnection) connection.release() }
  },
  async findFarmerById(id, executor = pool) {
    const [rows] = await executor.execute('SELECT Farmer_ID,Name,Email FROM Farmer WHERE Farmer_ID=? LIMIT 1', [id])
    return rows[0] || null
  },
  async createFarmerAccount({ farmerId, email, passwordHash, status = 'ACTIVE' }) {
    const [result] = await pool.execute('INSERT INTO farmer_account (farmer_id,email,password_hash,status) VALUES (?,?,?,?)', [farmerId, email, passwordHash, status])
    const [rows] = await pool.execute('SELECT account_id,farmer_id,email,status,created_at FROM farmer_account WHERE account_id=?', [result.insertId])
    return rows[0]
  },
  async listFarmerAccounts() {
    const [rows] = await pool.query('SELECT a.account_id,a.farmer_id,a.email,a.status,a.created_at,a.updated_at,f.Name AS farmer_name FROM farmer_account a INNER JOIN Farmer f ON f.Farmer_ID=a.farmer_id ORDER BY a.created_at DESC,a.account_id DESC')
    return rows
  },
  async setFarmerAccountStatus(id, status) {
    await pool.execute('UPDATE farmer_account SET status=? WHERE account_id=?', [status, id])
    const [rows] = await pool.execute('SELECT account_id,farmer_id,email,status,created_at,updated_at FROM farmer_account WHERE account_id=?', [id])
    if (!rows.length) { const error = new Error('Farmer account not found.'); error.code = 'NOT_FOUND'; throw error }
    return rows[0]
  },
  async emailExists(email, executor = pool) {
    const [rows] = await executor.execute('SELECT (EXISTS(SELECT 1 FROM admin_account WHERE email=?) OR EXISTS(SELECT 1 FROM farmer_account WHERE email=?)) AS found', [email, email])
    return Boolean(rows[0]?.found)
  },
  async changeFarmerPassword(accountId, passwordHash) {
    await pool.execute('UPDATE farmer_account SET password_hash=? WHERE account_id=?', [passwordHash, accountId])
  },
  async bootstrapAdmin({ name, email, passwordHash }) {
    const connection = await pool.getConnection()
    let lockHeld = false
    try {
      const [[lock]] = await connection.query("SELECT GET_LOCK('fieldwise_bootstrap_super_admin',10) AS acquired")
      if (Number(lock.acquired) !== 1) { const error = new Error('Could not acquire the one-time bootstrap lock.'); error.code = 'BOOTSTRAP_LOCK'; throw error }
      lockHeld = true
      await connection.beginTransaction()
      const [[existing]] = await connection.query("SELECT COUNT(*) AS total FROM admin_account WHERE role='SUPER_ADMIN'")
      if (Number(existing.total) > 0) { const error = new Error('A super administrator already exists; bootstrap is disabled.'); error.code = 'BOOTSTRAP_COMPLETE'; throw error }
      const [emailRows] = await connection.execute('SELECT (EXISTS(SELECT 1 FROM admin_account WHERE email=?) OR EXISTS(SELECT 1 FROM farmer_account WHERE email=?)) AS found', [email,email])
      if (emailRows[0]?.found) { const error = new Error('An account already uses that email address.'); error.code = 'ER_DUP_ENTRY'; throw error }
      const [result] = await connection.execute("INSERT INTO admin_account (name,email,password_hash,role,status) VALUES (?,?,?,'SUPER_ADMIN','ACTIVE')", [name,email,passwordHash])
      await connection.commit()
      return this.findAdminById(result.insertId)
    } catch (error) {
      try { await connection.rollback() } catch {}
      throw error
    } finally {
      if (lockHeld) { try { await connection.query("SELECT RELEASE_LOCK('fieldwise_bootstrap_super_admin')") } catch {} }
      connection.release()
    }
  }
}
