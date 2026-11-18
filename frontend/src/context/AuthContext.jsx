import React, { createContext, useContext, useState, useEffect } from 'react'
import { getSupabase, isSupabaseConfigured } from '../lib/supabase'
import { verifyPassword, hashPassword } from '../lib/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('perfomax_user')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (user) {
      localStorage.setItem('perfomax_user', JSON.stringify(user))
    } else {
      localStorage.removeItem('perfomax_user')
    }
  }, [user])

  const login = async (username, password) => {
    setError(null)
    setLoading(true)
    const client = getSupabase()

    if (!client) {
      setLoading(false)
      throw new Error('Supabase belum dikonfigurasi. Silakan masukkan Anon Key di pengaturan.')
    }

    try {
      // 1. Ambil data user berdasarkan username (case-insensitive)
      const { data: users, error: fetchErr } = await client
        .from('users')
        .select('*, karyawan(*)')
        .ilike('username', username.trim())
        .limit(1)

      if (fetchErr) throw fetchErr

      if (!users || users.length === 0) {
        throw new Error('Username atau NIK tidak ditemukan.')
      }

      const userData = users[0]

      // 2. Verifikasi Password
      const isValid = await verifyPassword(password, userData.password_hash, userData.username)
      if (!isValid) {
        throw new Error('Password yang Anda masukkan salah.')
      }

      // 3. Susun data session
      const sessionUser = {
        id: userData.id,
        username: userData.username,
        role: userData.role || 'karyawan',
        must_change_password: Boolean(userData.must_change_password),
        karyawan_id: userData.karyawan_id,
        karyawan: userData.karyawan || null
      }

      setUser(sessionUser)
      setLoading(false)
      return sessionUser
    } catch (err) {
      setLoading(false)
      setError(err.message || 'Gagal login.')
      throw err
    }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem('perfomax_user')
  }

  const changePassword = async (newPassword) => {
    if (!user) throw new Error('Tidak ada sesi login.')
    const client = getSupabase()
    if (!client) throw new Error('Supabase client tidak tersedia.')

    const newHash = await hashPassword(newPassword)
    const { error: updateErr } = await client
      .from('users')
      .update({
        password_hash: newHash,
        must_change_password: false
      })
      .eq('id', user.id)

    if (updateErr) throw updateErr

    const updated = {
      ...user,
      must_change_password: false
    }
    setUser(updated)
    return true
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, changePassword, loading, error }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}

