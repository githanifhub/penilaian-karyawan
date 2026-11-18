import React, { useState } from 'react'
import { Shield, KeyRound, User, AlertCircle, ArrowRight, Database } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { isSupabaseConfigured } from '../lib/supabase'

export default function Login({ onOpenSupabaseConfig }) {
  const { login, loading } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const isConfigured = isSupabaseConfigured()

  const handleLogin = async (e) => {
    e.preventDefault()
    setError(null)
    try {
      await login(username, password)
    } catch (err) {
      setError(err.message || 'Gagal login. Periksa kembali username/password Anda.')
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      position: 'relative'
    }}>
      {/* Background glow orbs */}
      <div style={{
        position: 'absolute',
        top: '20%',
        left: '25%',
        width: '400px',
        height: '400px',
        background: 'radial-gradient(circle, rgba(26, 159, 255, 0.08) 0%, transparent 70%)',
        pointerEvents: 'none'
      }} />

      <div style={{ width: '100%', maxWidth: '440px', position: 'relative', zIndex: 10 }}>
        {/* Brand Card */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #1a9fff 0%, #0070c9 100%)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 24px rgba(26, 159, 255, 0.45)',
            marginBottom: '16px'
          }}>
            <Shield size={32} color="#fff" />
          </div>
          <h1 style={{ fontSize: '1.85rem', fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
            PERFOMAX
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Sistem Evaluasi &amp; Penilaian Kinerja Karyawan
          </p>
        </div>

        {/* Login Card */}
        <div className="steam-card" style={{ padding: '32px' }}>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {error && (
              <div style={{
                background: 'rgba(255, 82, 82, 0.12)',
                border: '1px solid rgba(255, 82, 82, 0.35)',
                borderRadius: '8px',
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '0.825rem',
                color: '#ff5252'
              }}>
                <AlertCircle size={18} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
                NIK atau Username
              </label>
              <div className="input-search-wrapper">
                <User size={16} />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Masukkan NIK atau username..."
                  className="input-steam"
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
                Password
              </label>
              <div className="input-search-wrapper">
                <KeyRound size={16} />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password akun..."
                  className="input-steam"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: '0.95rem' }}
            >
              <span>{loading ? 'Memverifikasi...' : 'Masuk ke Sistem'}</span>
              <ArrowRight size={16} />
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.75rem', color: 'var(--text-dim)' }}>
          Perfomax Enterprise &bull; Sistem Evaluasi &amp; Penilaian Kinerja Karyawan
        </div>
      </div>
    </div>
  )
}

