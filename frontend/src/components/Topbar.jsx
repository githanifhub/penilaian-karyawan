import React from 'react'
import { RefreshCw } from 'lucide-react'

export default function Topbar({ title, subtitle, onRefresh, loading }) {
  // Tanggal hari ini
  const today = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })

  return (
    <header className="topbar">
      <div>
        <h1 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>
          {title}
        </h1>
        {subtitle && (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {subtitle}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="btn btn-secondary btn-sm"
            disabled={loading}
            title="Muat Ulang Data"
            style={{ padding: '6px 12px' }}
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
            <span style={{ fontSize: '0.78rem' }}>Muat Ulang</span>
          </button>
        )}

        {/* Status Indikator Sistem Bersih */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          borderRadius: '9999px',
          background: 'rgba(61, 214, 140, 0.1)',
          border: '1px solid rgba(61, 214, 140, 0.25)',
          color: '#3dd68c',
          fontSize: '0.75rem',
          fontWeight: 600
        }}>
          <div style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            background: '#3dd68c',
            boxShadow: '0 0 8px #3dd68c'
          }} />
          <span>Sistem Aktif</span>
        </div>

        {/* Tanggal */}
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'none' }} className="date-desktop">
          {today}
        </div>
      </div>
    </header>
  )
}
