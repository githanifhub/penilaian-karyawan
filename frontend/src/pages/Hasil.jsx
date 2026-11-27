import React, { useState, useMemo } from 'react'
import { Trophy, Search, Download, Printer, Award, FileSpreadsheet, ChevronDown, ChevronRight, User } from 'lucide-react'
import * as XLSX from 'xlsx'
import confetti from 'canvas-confetti'
import Pagination from '../components/Pagination'

export default function Hasil({ data, user }) {
  const { sawResult } = data
  const { hasilAkhir = [], kriteria = [], matriksX = {}, matriksR = {}, bobotNormal = {} } = sawResult || {}

  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState('ranking') // 'ranking' | 'matriksX' | 'matriksR' | 'matriksBobot'
  const [pageSize, setPageSize] = useState(25) // 10 | 25 | 50 | 100 | 300 | 'all'
  const [page, setPage] = useState(1)

  // Filter Ranking / Pencarian
  const filteredHasil = useMemo(() => {
    return hasilAkhir.filter(item => {
      const k = item.karyawan
      return (
        (k.nik || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (k.nama || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (k.jabatan || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (k.divisi || '').toLowerCase().includes(searchTerm.toLowerCase())
      )
    })
  }, [hasilAkhir, searchTerm])

  // Pagination calculation
  const actualPageSize = pageSize === 'all' ? filteredHasil.length : Number(pageSize)
  const totalPages = pageSize === 'all' ? 1 : Math.ceil(filteredHasil.length / actualPageSize) || 1
  const paginatedHasil = useMemo(() => {
    if (pageSize === 'all') return filteredHasil
    const start = (page - 1) * actualPageSize
    return filteredHasil.slice(start, start + actualPageSize)
  }, [filteredHasil, page, actualPageSize, pageSize])

  // Cari data user yang login jika role karyawan
  const myRank = useMemo(() => {
    if (user?.role === 'karyawan' && user?.karyawan_id) {
      return hasilAkhir.find(item => item.karyawan.id === user.karyawan_id)
    }
    return null
  }, [hasilAkhir, user])

  // Trigger celebration confetti
  const triggerConfetti = () => {
    confetti({
      particleCount: 80,
      spread: 60,
      origin: { y: 0.6 }
    })
  }

  // Export Excel
  const handleExportExcel = () => {
    const rows = hasilAkhir.map(item => ({
      Peringkat: item.rank,
      NIK: item.karyawan.nik,
      'Nama Karyawan': item.karyawan.nama,
      Jabatan: item.karyawan.jabatan,
      Divisi: item.karyawan.divisi,
      'Skor Akhir Kinerja': item.skor,
      'Skor Persentase': `${item.skorPersen}%`
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Hasil & Peringkat')
    XLSX.writeFile(wb, 'hasil_peringkat_kinerja_perfomax.xlsx')
  }

  // Print
  const handlePrint = () => {
    window.print()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner */}
      <div className="steam-card" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Trophy size={24} color="#ffd700" />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff' }}>
              Hasil &amp; Peringkat Evaluasi Kinerja
            </h2>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Akumulasi skor akhir dihitung otomatis berdasarkan standarisasi nilai dan bobot setiap indikator kinerja
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={handleExportExcel} className="btn btn-secondary btn-sm">
            <Download size={14} />
            <span>Export Excel</span>
          </button>
          <button onClick={handlePrint} className="btn btn-secondary btn-sm">
            <Printer size={14} />
            <span>Cetak Laporan</span>
          </button>
        </div>
      </div>

      {/* Jika User Karyawan: Tampilkan Banner Khusus Nilai Dirinya Sendiri */}
      {myRank && (
        <div className="steam-card" style={{
          background: 'linear-gradient(135deg, rgba(26, 159, 255, 0.16) 0%, rgba(14, 20, 27, 0.9) 100%)',
          border: '1px solid var(--cyan-accent)',
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              background: 'var(--cyan-accent)',
              color: '#0e141b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '1.1rem'
            }}>
              #{myRank.rank}
            </div>
            <div>
              <div style={{ fontSize: '0.78rem', color: 'var(--cyan-accent)', fontWeight: 700, textTransform: 'uppercase' }}>
                Hasil Evaluasi Kinerja Anda
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>
                {myRank.karyawan.nama} ({myRank.karyawan.nik})
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {myRank.karyawan.jabatan} &bull; {myRank.karyawan.divisi}
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Skor Akumulasi Kinerja</div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#3dd68c', fontFamily: 'monospace' }}>
              {myRank.skor}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--cyan-accent)' }}>
              Peringkat {myRank.rank} dari {hasilAkhir.length} Karyawan
            </div>
          </div>
        </div>
      )}

      {/* Tabs Navigasi */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', gap: '6px', flexWrap: 'wrap' }}>
        <button
          onClick={() => setActiveTab('ranking')}
          style={{
            padding: '10px 18px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'ranking' ? '2px solid var(--cyan-accent)' : '2px solid transparent',
            color: activeTab === 'ranking' ? 'var(--cyan-accent)' : 'var(--text-muted)',
            fontWeight: 600,
            fontSize: '0.875rem',
            cursor: 'pointer'
          }}
        >
          🏆 Peringkat &amp; Skor Akhir
        </button>
        <button
          onClick={() => setActiveTab('matriksX')}
          style={{
            padding: '10px 18px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'matriksX' ? '2px solid var(--cyan-accent)' : '2px solid transparent',
            color: activeTab === 'matriksX' ? 'var(--cyan-accent)' : 'var(--text-muted)',
            fontWeight: 600,
            fontSize: '0.875rem',
            cursor: 'pointer'
          }}
        >
          1. Data Nilai Mentah
        </button>
        <button
          onClick={() => setActiveTab('matriksR')}
          style={{
            padding: '10px 18px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'matriksR' ? '2px solid var(--cyan-accent)' : '2px solid transparent',
            color: activeTab === 'matriksR' ? 'var(--cyan-accent)' : 'var(--text-muted)',
            fontWeight: 600,
            fontSize: '0.875rem',
            cursor: 'pointer'
          }}
        >
          2. Standarisasi Nilai Kinerja
        </button>
        <button
          onClick={() => setActiveTab('matriksBobot')}
          style={{
            padding: '10px 18px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'matriksBobot' ? '2px solid var(--cyan-accent)' : '2px solid transparent',
            color: activeTab === 'matriksBobot' ? 'var(--cyan-accent)' : 'var(--text-muted)',
            fontWeight: 600,
            fontSize: '0.875rem',
            cursor: 'pointer'
          }}
        >
          3. Kontribusi Bobot &amp; Skor
        </button>
      </div>

      {/* Bar Pencarian & Pengaturan Jumlah Baris Per Halaman */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div className="input-search-wrapper" style={{ width: '320px' }}>
          <Search size={16} />
          <input
            type="text"
            placeholder="Cari peringkat, NIK, atau nama..."
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setPage(1) }}
            className="input-steam"
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Baris:</span>
            <select
              value={pageSize}
              onChange={e => {
                const val = e.target.value === 'all' ? 'all' : Number(e.target.value)
                setPageSize(val)
                setPage(1)
              }}
              className="input-steam"
              style={{ width: '90px', padding: '6px 10px', fontSize: '0.8rem' }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={300}>300</option>
              <option value="all">Semua</option>
            </select>
          </div>

          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Menampilkan <strong>{paginatedHasil.length}</strong> dari {filteredHasil.length} karyawan
          </div>
        </div>
      </div>

      {/* TAB 1: Ranking Table */}
      {activeTab === 'ranking' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="table-container">
            <table className="steam-table">
              <thead>
                <tr>
                  <th style={{ width: '90px', textAlign: 'center' }}>Peringkat</th>
                  <th style={{ width: '120px' }}>NIK</th>
                  <th>Nama Karyawan</th>
                  <th>Jabatan</th>
                  <th>Divisi</th>
                  <th style={{ width: '160px', textAlign: 'right' }}>Total Skor Akhir</th>
                </tr>
              </thead>
              <tbody>
                {paginatedHasil.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                      Tidak ada data yang cocok dengan kriteria pencarian.
                    </td>
                  </tr>
                ) : (
                  paginatedHasil.map(item => {
                    const isTop1 = item.rank === 1
                    const isTop2 = item.rank === 2
                    const isTop3 = item.rank === 3
                    const isMe = user?.karyawan_id === item.karyawan.id

                    return (
                      <tr
                        key={item.karyawan.id}
                        style={{
                          background: isMe ? 'rgba(26, 159, 255, 0.12)' : isTop1 ? 'rgba(255, 215, 0, 0.05)' : 'transparent'
                        }}
                      >
                        <td style={{ textAlign: 'center' }}>
                          {isTop1 ? (
                            <span style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ffd700' }}>👑 1</span>
                          ) : isTop2 ? (
                            <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#c0c0c0' }}>🥈 2</span>
                          ) : isTop3 ? (
                            <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#cd7f32' }}>🥉 3</span>
                          ) : (
                            <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--text-dim)' }}>
                              #{item.rank}
                            </span>
                          )}
                        </td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--cyan-accent)' }}>
                          {item.karyawan.nik}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 600, color: '#fff' }}>{item.karyawan.nama}</span>
                            {isMe && <span className="badge badge-admin">Anda</span>}
                          </div>
                        </td>
                        <td>{item.karyawan.jabatan}</td>
                        <td>{item.karyawan.divisi}</td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '1rem', color: isTop1 ? '#ffd700' : '#3dd68c' }}>
                            {item.skor}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>
                            {item.skorPersen}%
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: Data Nilai Mentah */}
      {activeTab === 'matriksX' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{
            background: 'rgba(26, 159, 255, 0.05)',
            border: '1px solid rgba(26, 159, 255, 0.2)',
            borderRadius: '6px',
            padding: '12px 16px',
            fontSize: '0.82rem',
            color: 'var(--text-muted)'
          }}>
            <strong style={{ color: 'var(--cyan-accent)' }}>Data Nilai Mentah:</strong> Nilai asli hasil penilaian kinerja karyawan untuk setiap kriteria evaluasi sebelum dilakukan standarisasi.
          </div>

          <div className="table-container">
            <table className="steam-table">
              <thead>
                <tr>
                  <th style={{ width: '120px' }}>NIK</th>
                  <th>Nama Karyawan</th>
                  {kriteria.map(c => (
                    <th key={c.id} style={{ textAlign: 'center', minWidth: '130px' }}>
                      <div style={{ fontWeight: 700 }}>{c.kode}</div>
                      <div style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--text-dim)', textTransform: 'none' }}>
                        {c.nama} ({c.tipe})
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedHasil.length === 0 ? (
                  <tr>
                    <td colSpan={2 + kriteria.length} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                      Tidak ada data.
                    </td>
                  </tr>
                ) : (
                  paginatedHasil.map(item => {
                    const k = item.karyawan
                    return (
                      <tr key={k.id}>
                        <td style={{ fontFamily: 'monospace', color: 'var(--cyan-accent)' }}>{k.nik}</td>
                        <td style={{ fontWeight: 600, color: '#fff' }}>{k.nama}</td>
                        {kriteria.map(c => (
                          <td key={c.id} style={{ textAlign: 'center', fontFamily: 'monospace' }}>
                            {matriksX[k.id]?.[c.id] ?? 0}
                          </td>
                        ))}
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: Standarisasi Nilai Kinerja */}
      {activeTab === 'matriksR' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{
            background: 'rgba(26, 159, 255, 0.08)',
            border: '1px solid rgba(26, 159, 255, 0.25)',
            borderRadius: '6px',
            padding: '12px 16px',
            fontSize: '0.82rem',
            color: 'var(--text-muted)'
          }}>
            <strong style={{ color: 'var(--cyan-accent)' }}>Standarisasi Nilai Kinerja:</strong> Nilai mentah dari setiap kriteria disesuaikan ke skala seragam <strong>(0.000 s/d 1.000)</strong> agar seluruh indikator penilaian dapat diperbandingkan secara proporsional.
          </div>

          <div className="table-container">
            <table className="steam-table">
              <thead>
                <tr>
                  <th style={{ width: '120px' }}>NIK</th>
                  <th>Nama Karyawan</th>
                  {kriteria.map(c => (
                    <th key={c.id} style={{ textAlign: 'center', minWidth: '140px' }}>
                      <div style={{ fontWeight: 700 }}>Standar {c.kode}</div>
                      <div style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--text-dim)', textTransform: 'none' }}>
                        {c.nama}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginatedHasil.length === 0 ? (
                  <tr>
                    <td colSpan={2 + kriteria.length} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                      Tidak ada data.
                    </td>
                  </tr>
                ) : (
                  paginatedHasil.map(item => {
                    const k = item.karyawan
                    return (
                      <tr key={k.id}>
                        <td style={{ fontFamily: 'monospace', color: 'var(--cyan-accent)' }}>{k.nik}</td>
                        <td style={{ fontWeight: 600, color: '#fff' }}>{k.nama}</td>
                        {kriteria.map(c => {
                          const val = matriksR[k.id]?.[c.id] ?? 0
                          return (
                            <td key={c.id} style={{ textAlign: 'center', fontFamily: 'monospace', color: 'var(--cyan-accent)' }}>
                              {Math.round(val * 1000) / 1000}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: Kontribusi Bobot & Skor */}
      {activeTab === 'matriksBobot' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{
            background: 'rgba(61, 214, 140, 0.08)',
            border: '1px solid rgba(61, 214, 140, 0.25)',
            borderRadius: '6px',
            padding: '12px 16px',
            fontSize: '0.82rem',
            color: 'var(--text-muted)'
          }}>
            <strong style={{ color: '#3dd68c' }}>Kontribusi Bobot &amp; Skor:</strong> Poin yang diperoleh karyawan pada masing-masing kriteria setelah dikalikan bobot kepentingannya. Akumulasi seluruh poin kriteria menghasilkan <strong>Total Skor Akhir</strong>.
          </div>

          <div className="table-container">
            <table className="steam-table">
              <thead>
                <tr>
                  <th style={{ width: '120px' }}>NIK</th>
                  <th>Nama Karyawan</th>
                  {kriteria.map(c => (
                    <th key={c.id} style={{ textAlign: 'center', minWidth: '140px' }}>
                      <div style={{ fontWeight: 700 }}>Poin {c.kode}</div>
                      <div style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--text-dim)', textTransform: 'none' }}>
                        {c.nama} ({c.bobot}%)
                      </div>
                    </th>
                  ))}
                  <th style={{ width: '160px', textAlign: 'right' }}>
                    <div style={{ color: '#3dd68c', fontWeight: 700 }}>Total Skor Akhir</div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--text-dim)', textTransform: 'none' }}>
                      Akumulasi Poin
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedHasil.length === 0 ? (
                  <tr>
                    <td colSpan={3 + kriteria.length} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                      Tidak ada data.
                    </td>
                  </tr>
                ) : (
                  paginatedHasil.map(item => {
                    const k = item.karyawan
                    return (
                      <tr key={k.id}>
                        <td style={{ fontFamily: 'monospace', color: 'var(--cyan-accent)' }}>{k.nik}</td>
                        <td style={{ fontWeight: 600, color: '#fff' }}>{k.nama}</td>
                        {kriteria.map(c => {
                          const w = bobotNormal[c.id] || 0
                          const r = matriksR[k.id]?.[c.id] || 0
                          const part = Math.round(w * r * 10000) / 10000
                          return (
                            <td key={c.id} style={{ textAlign: 'center', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                              {part}
                            </td>
                          )
                        })}
                        <td style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 800, color: '#3dd68c' }}>
                          {item.skor}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination Bar Sesuai Gambar */}
      <Pagination
        page={page}
        totalPages={totalPages}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(newSize) => {
          setPageSize(newSize)
          setPage(1)
        }}
        pageSizeOptions={[10, 25, 50, 100, 300, 'all']}
      />
    </div>
  )
}
