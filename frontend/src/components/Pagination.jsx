import React, { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function Pagination({
  page = 1,
  totalPages = 1,
  pageSize = 10,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100, 300, 'all']
}) {
  const [goToInput, setGoToInput] = useState(page)

  useEffect(() => {
    setGoToInput(page)
  }, [page])

  const handleGoToSubmit = (e) => {
    if (e) e.preventDefault()
    const target = parseInt(goToInput, 10)
    if (!isNaN(target)) {
      const clamped = Math.max(1, Math.min(totalPages, target))
      onPageChange(clamped)
      setGoToInput(clamped)
    } else {
      setGoToInput(page)
    }
  }

  // Generate pagination items matching the user's reference image:
  // e.g. < 1 2 3 4 5 6 ... 140 > Go to [ 1 ]
  const getPageNumbers = () => {
    if (totalPages <= 7) {
      const pages = []
      for (let i = 1; i <= totalPages; i++) pages.push(i)
      return pages
    }

    if (page <= 4) {
      return [1, 2, 3, 4, 5, 6, '...', totalPages]
    }

    if (page >= totalPages - 3) {
      return [1, '...', totalPages - 5, totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
    }

    return [1, '...', page - 2, page - 1, page, page + 1, page + 2, '...', totalPages]
  }

  const pageNumbers = getPageNumbers()

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '14px',
      padding: '12px 4px',
      fontSize: '0.85rem',
      color: 'var(--text-muted)'
    }}>
      {/* Dropdown Jumlah Baris: "[ 10 Baris  v ]" (Sesuai Gambar Sisi Kiri) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <select
          value={pageSize}
          onChange={(e) => {
            const val = e.target.value === 'all' ? 'all' : Number(e.target.value)
            if (onPageSizeChange) onPageSizeChange(val)
          }}
          className="input-steam"
          style={{
            minWidth: '120px',
            padding: '6px 12px',
            fontSize: '0.85rem',
            background: 'var(--surface-alt)',
            color: '#ffffff',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            cursor: 'pointer'
          }}
        >
          {pageSizeOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt === 'all' ? 'Semua Baris' : `${opt} Baris`}
            </option>
          ))}
        </select>
      </div>

      {/* Nomor Halaman & Go to (Sesuai Gambar Sisi Kanan) */}
      {pageSize !== 'all' && totalPages > 1 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexWrap: 'wrap'
        }}>
          {/* Tombol Sebelumnya (<) */}
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page === 1}
            style={{
              background: 'none',
              border: 'none',
              color: page === 1 ? 'var(--text-dim)' : 'var(--text-muted)',
              cursor: page === 1 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px',
              transition: 'color 0.15s ease'
            }}
            title="Halaman Sebelumnya"
          >
            <ChevronLeft size={16} />
          </button>

          {/* Deretan Angka Halaman */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {pageNumbers.map((p, idx) => {
              if (p === '...') {
                return (
                  <span
                    key={`ellipsis-${idx}`}
                    style={{
                      padding: '0 4px',
                      color: 'var(--text-dim)',
                      userSelect: 'none'
                    }}
                  >
                    &hellip;
                  </span>
                )
              }

              const isActive = p === page
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => onPageChange(p)}
                  style={{
                    minWidth: '28px',
                    height: '28px',
                    padding: '0 6px',
                    borderRadius: '4px',
                    border: 'none',
                    background: isActive ? 'rgba(26, 159, 255, 0.15)' : 'transparent',
                    color: isActive ? 'var(--cyan-accent)' : 'var(--text-muted)',
                    fontWeight: isActive ? 700 : 500,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.color = '#ffffff'
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.color = 'var(--text-muted)'
                      e.currentTarget.style.background = 'transparent'
                    }
                  }}
                >
                  {p}
                </button>
              )
            })}
          </div>

          {/* Tombol Selanjutnya (>) */}
          <button
            type="button"
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            style={{
              background: 'none',
              border: 'none',
              color: page === totalPages ? 'var(--text-dim)' : 'var(--text-muted)',
              cursor: page === totalPages ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '4px',
              transition: 'color 0.15s ease'
            }}
            title="Halaman Selanjutnya"
          >
            <ChevronRight size={16} />
          </button>

          {/* Input Go to: "Go to [ 1 ]" (Sesuai Gambar) */}
          <form
            onSubmit={handleGoToSubmit}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              marginLeft: '6px'
            }}
          >
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Go to</span>
            <input
              type="number"
              min="1"
              max={totalPages}
              value={goToInput}
              onChange={(e) => setGoToInput(e.target.value)}
              onBlur={handleGoToSubmit}
              style={{
                width: '46px',
                height: '30px',
                textAlign: 'center',
                padding: '2px 4px',
                fontSize: '0.85rem',
                fontWeight: 600,
                background: 'var(--surface-alt)',
                color: '#ffffff',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                outline: 'none'
              }}
            />
          </form>
        </div>
      )}
    </div>
  )
}
