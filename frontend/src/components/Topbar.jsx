import React from 'react'

export default function Topbar({ title, subtitle }) {
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
        {/* Tanggal */}
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          {today}
        </div>
      </div>
    </header>
  )
}
