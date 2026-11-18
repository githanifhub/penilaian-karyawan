import React, { useState } from 'react'
import { Database, Key, CheckCircle, AlertTriangle, Trash2, X, HelpCircle } from 'lucide-react'
import { getSupabaseConfig, saveSupabaseKey, clearSupabaseKey } from '../lib/supabase'

export default function SupabaseConfigModal({ isOpen, onClose }) {
  const config = getSupabaseConfig()
  const [anonKey, setAnonKey] = useState(config.key || '')
  const [saved, setSaved] = useState(false)

  if (!isOpen) return null

  // Validasi format kunci secara cerdas
  const isPostgresUrl = anonKey.includes('postgresql://') || anonKey.includes('postgres://')
  const isShortOrPassword = anonKey.length > 0 && anonKey.length < 50
  const looksValid = anonKey.startsWith('eyJ') || anonKey.startsWith('sb_')

  const handleSave = (e) => {
    e.preventDefault()
    if (!anonKey.trim()) return

    if (isPostgresUrl) {
      alert('Peringatan: Teks yang Anda masukkan adalah connection string database, BUKAN Supabase Anon Key. Silakan salin "anon public" key yang diawali "eyJ..." dari dashboard Supabase.')
      return
    }

    saveSupabaseKey(anonKey.trim())
    setSaved(true)
    setTimeout(() => {
      onClose()
    }, 700)
  }

  const handleReset = () => {
    if (confirm('Hapus kunci Supabase yang tersimpan di browser ini?')) {
      clearSupabaseKey()
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '560px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Database size={20} color="var(--cyan-accent)" />
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>
              Pengaturan Supabase Anon Key
            </h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSave}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Warning jika pernah tersimpan tapi invalid */}
            {config.key && !looksValid && (
              <div style={{
                background: 'rgba(255, 82, 82, 0.12)',
                border: '1px solid rgba(255, 82, 82, 0.35)',
                padding: '12px 14px',
                borderRadius: '8px',
                color: '#ff5252',
                fontSize: '0.8rem',
                display: 'flex',
                gap: '8px',
                lineHeight: 1.5
              }}>
                <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>
                  <strong>Penyebab "Invalid API key":</strong> Kunci yang tersimpan saat ini bukan Supabase Anon Key (format tidak sesuai). Silakan ganti dengan Anon Key yang benar di bawah ini.
                </span>
              </div>
            )}

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Project URL (Supabase)
              </label>
              <input
                type="text"
                readOnly
                value={config.url}
                className="input-steam font-mono"
                style={{ background: 'var(--surface-alt)', opacity: 0.8 }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                Supabase Anon / Public Key (Panjang ~150-250 Karakter)
              </label>
              <textarea
                rows={3}
                required
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={anonKey}
                onChange={(e) => setAnonKey(e.target.value)}
                className="input-steam font-mono"
                style={{
                  fontSize: '0.8rem',
                  resize: 'vertical',
                  borderColor: (isPostgresUrl || isShortOrPassword) ? '#ff5252' : looksValid ? '#3dd68c' : 'var(--border)'
                }}
              />

              {/* Real-time hint detection */}
              {isPostgresUrl && (
                <div style={{ fontSize: '0.75rem', color: '#ff5252', marginTop: '6px' }}>
                  ❌ Yang Anda tempel adalah URL connection database, bukan API Key!
                </div>
              )}

              {isShortOrPassword && (
                <div style={{ fontSize: '0.75rem', color: '#f59e0b', marginTop: '6px' }}>
                  ⚠️ Teks ini terlalu pendek ({anonKey.length} karakter). Anon Key asli adalah teks panjang yang diawali "eyJ...".
                </div>
              )}

              {looksValid && (
                <div style={{ fontSize: '0.75rem', color: '#3dd68c', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CheckCircle size={13} />
                  <span>Format Anon Key valid (diawali eyJ...).</span>
                </div>
              )}
            </div>

            {/* Petunjuk Visual Cara Ambil Anon Key */}
            <div style={{
              background: 'var(--surface-alt)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '12px 14px',
              fontSize: '0.78rem',
              color: 'var(--text-muted)',
              lineHeight: 1.6
            }}>
              <div style={{ fontWeight: 700, color: 'var(--cyan-accent)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                <HelpCircle size={14} />
                <span>Di Mana Menemukan Anon Key di Supabase?</span>
              </div>
              <ol style={{ paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <li>Buka dashboard project Anda di <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" style={{ color: 'var(--cyan-accent)', textDecoration: 'underline' }}>supabase.com</a></li>
                <li>Klik tombol <strong>Connect</strong> di bilah atas $\rightarrow$ pilih tab <strong>App Frameworks</strong> (React/Next.js)</li>
                <li>Atau klik menu <strong>Project Settings (⚙️)</strong> di pojok kiri bawah $\rightarrow$ pilih <strong>API</strong></li>
                <li>Salin nilai pada kotak <strong>anon / public</strong> (klik tombol Copy di samping teks <code>eyJ...</code>)</li>
              </ol>
            </div>

            {saved && (
              <div style={{
                background: 'rgba(61, 214, 140, 0.12)',
                border: '1px solid rgba(61, 214, 140, 0.3)',
                padding: '10px 14px',
                borderRadius: '8px',
                color: '#3dd68c',
                fontSize: '0.825rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <CheckCircle size={16} />
                <span>Koneksi tersimpan! Memuat ulang aplikasi...</span>
              </div>
            )}
          </div>

          <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
            {config.key ? (
              <button
                type="button"
                onClick={handleReset}
                className="btn btn-danger btn-sm"
                title="Hapus Kunci yang Tersimpan"
              >
                <Trash2 size={14} />
                <span>Hapus Kunci</span>
              </button>
            ) : <div />}

            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" onClick={onClose} className="btn btn-secondary">
                Batal
              </button>
              <button type="submit" className="btn btn-primary">
                <Key size={15} />
                <span>Simpan Kunci Baru</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
