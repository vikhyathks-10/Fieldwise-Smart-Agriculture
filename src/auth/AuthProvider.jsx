import { createContext, useContext, useEffect, useState } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    api.get('/auth/me').then(response => setUser(response.data.user || null)).catch(() => setUser(null)).finally(() => setLoading(false))
  }, [])
  const login = async (role, credentials) => {
    const response = await api.post(`/auth/${role}/login`, credentials)
    setUser(response.data.user)
    return response.data.user
  }
  const logout = async () => {
    try { await api.post('/auth/logout') } finally { setUser(null) }
  }
  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>
}
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider.')
  return context
}
