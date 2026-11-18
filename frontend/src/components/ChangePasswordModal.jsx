import React, { useState } from 'react'
import { KeyRound, CheckCircle, AlertTriangle, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function ChangePasswordModal({ isOpen, onClose, isForced = false }) {
  const { user, changePassword } = useAuth()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  if (!isOpen) return null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (newPassword.length < 6) {
      setError('Password baru minimal 6 karakter.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Konfirmasi password tidak cocok dengan password baru.')
      return
    }

    setLoading(true)
    try {
      await changePassword(newPassword)
      setSuccess(true)
      setTimeout(() => {
        setSuccess(false)
        setNewPassword('')
        setConfirmPassword('')
        onClose()
      }, 1000)
    } catch (err) {
      setError(err.message || 'Gagal mengganti password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: '440px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '6px',
              background: isForced ? 'rgba(245, 158, 11, 0.15)' : 'var(--primary-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isForced ? '#f59e0b' : 'var(--primary)'
            }}>
              <KeyRound size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff' }}>
                {isForced ? 'Wajib Ganti Password' : 'Ganti Password Akun'}
              </h3>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Akun: {user?.username} ({user?.role})
              </div>
            </div>
          </div>
          {!isForced && (
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <X size={18} />
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {isForced && (
              <div style={{
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '0.8rem',
                color: '#f59e0b',
                display: 'flex',
                gap: '8px',
                lineHeight: 1.4
              }}>
                <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>Ini adalah login pertama Anda. Demi keamanan, Anda diwajibkan mengganti password bawaan sistem terlebih dahulu.</span>
              </div>
            )}

            {error && (
              <div style={{
                background: 'rgba(255, 82, 82, 0.12)',
                border: '1px solid rgba(255, 82, 82, 0.3)',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '0.8rem',
                color: '#ff5252'
              }}>
                {error}
              </div>
            )}

            {success && (
              <div style={{
                background: 'rgba(61, 214, 140, 0.12)',
                border: '1px solid rgba(61, 214, 140, 0.3)',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '0.8rem',
                color: '#3dd68c',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <CheckCircle size={16} />
                <span>Password berhasil diperbarui!</span>
              </div>
            )}

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Password Baru (Min 6 Karakter)
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Masukkan password baru..."
                className="input-steam"
              />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Ulangi Password Baru
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Konfirmasi password baru..."
                className="input-steam"
              />
            </div>
          </div>

          <div className="modal-footer">
            {!isForced && (
              <button type="button" onClick={onClose} className="btn btn-secondary">
                Batal
              </button>
            )}
            <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: isForced ? '100%' : 'auto' }}>
              <span>{loading ? 'Menyimpan...' : 'Simpan Password Baru'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

