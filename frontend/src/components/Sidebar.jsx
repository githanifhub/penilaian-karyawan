import React from 'react'
import { LayoutDashboard, Users, Sliders, ClipboardCheck, Trophy, LogOut, KeyRound, Shield } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Sidebar({ currentPage, onNavigate, onOpenChangePassword }) {
  const { user, logout } = useAuth()

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'atasan', 'karyawan'] },
    { id: 'karyawan', label: 'Data Karyawan', icon: Users, roles: ['admin'] },
    { id: 'kriteria', label: 'Kriteria Penilaian', icon: Sliders, roles: ['admin'] },
    { id: 'penilaian', label: 'Input Penilaian', icon: ClipboardCheck, roles: ['admin', 'atasan'] },
    { id: 'hasil', label: 'Hasil & Peringkat', icon: Trophy, roles: ['admin', 'atasan', 'karyawan'] },
  ]

  const userRole = user?.role || 'karyawan'
  const visibleNav = navItems.filter(item => item.roles.includes(userRole))

  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div style={{ padding: '24px 20px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg, #1a9fff 0%, #0070c9 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 14px rgba(26, 159, 255, 0.4)'
          }}>
            <Shield size={20} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '0.04em', color: '#fff' }}>
              PERFOMAX
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Enterprise SPK
            </div>
          </div>
        </div>
      </div>

      {/* Nav Menu */}
      <div style={{ padding: '16px 12px', flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase', padding: '0 10px 8px', letterSpacing: '0.08em' }}>
          Menu Utama
        </div>
        {visibleNav.map(item => {
          const Icon = item.icon
          const isActive = currentPage === item.id
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                width: '100%',
                padding: '11px 14px',
                borderRadius: '8px',
                border: 'none',
                background: isActive ? 'linear-gradient(90deg, rgba(26, 159, 255, 0.16) 0%, rgba(26, 159, 255, 0.04) 100%)' : 'transparent',
                color: isActive ? 'var(--cyan-accent)' : 'var(--text-muted)',
                fontWeight: isActive ? 600 : 500,
                fontSize: '0.875rem',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
                position: 'relative'
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'var(--surface-hover)'
                  e.currentTarget.style.color = '#fff'
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'var(--text-muted)'
                }
              }}
            >
              {isActive && (
                <div style={{
                  position: 'absolute',
                  left: 0,
                  top: '15%',
                  bottom: '15%',
                  width: '3px',
                  borderRadius: '0 3px 3px 0',
                  background: 'var(--cyan-accent)',
                  boxShadow: '0 0 10px var(--cyan-accent)'
                }} />
              )}
              <Icon size={18} color={isActive ? 'var(--cyan-accent)' : 'currentColor'} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </div>

      {/* User Section Bottom */}
      <div style={{ padding: '16px', borderTop: '1px solid var(--border)', background: 'rgba(14, 20, 27, 0.4)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            background: 'var(--surface-hover)',
            border: '1px solid var(--border-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: '0.875rem',
            color: 'var(--cyan-accent)'
          }}>
            {user?.username ? user.username.slice(0, 2).toUpperCase() : 'U'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.karyawan?.nama || user?.username || 'User'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
              <span className={`badge badge-${userRole}`}>
                {userRole.toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={onOpenChangePassword}
            className="btn btn-secondary btn-sm"
            style={{ flex: 1, justifyContent: 'center' }}
            title="Ganti Password"
          >
            <KeyRound size={14} />
            <span>Password</span>
          </button>
          <button
            onClick={logout}
            className="btn btn-danger btn-sm"
            style={{ padding: '6px 10px' }}
            title="Keluar / Logout"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  )
}

