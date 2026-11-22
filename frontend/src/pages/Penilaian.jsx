import React, { useState, useEffect, useMemo } from 'react'
import { ClipboardCheck, Search, Save, Trophy, Filter, CheckCircle, AlertCircle } from 'lucide-react'
import { getSupabase } from '../lib/supabase'

export default function Penilaian({ karyawan = [], kriteria = [], penilaian = [], onRefresh, onNavigate, onToast }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterDivisi, setFilterDivisi] = useState('')
  const [scores, setScores] = useState({})
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [pageSize, setPageSize] = useState(50)
  const [page, setPage] = useState(1)

  // Inisialisasi skor dari data penilaian Supabase
  useEffect(() => {
    const map = {}
    penilaian.forEach(p => {
      map[`${p.karyawan_id}_${p.kriteria_id}`] = p.nilai
    })
    setScores(map)
    setHasChanges(false)
  }, [penilaian])

  // Divisi unik
  const listDivisi = useMemo(() => {
    const s = new Set()
    karyawan.forEach(k => { if (k.divisi) s.add(k.divisi) })
    return Array.from(s).sort()
  }, [karyawan])

  // Kriteria terurut kode
  const sortedKriteria = useMemo(() => {
    return [...kriteria].sort((a, b) => (a.kode || '').localeCompare(b.kode || ''))
  }, [kriteria])

  // Filter Karyawan (Urutkan data terbaru di baris pertama)
  const filteredKaryawan = useMemo(() => {
    return karyawan
      .filter(k => {
        const matchSearch =
          (k.nik || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (k.nama || '').toLowerCase().includes(searchTerm.toLowerCase())
        const matchDivisi = !filterDivisi || k.divisi === filterDivisi
        return matchSearch && matchDivisi
      })
      .sort((a, b) => (Number(b.id) || 0) - (Number(a.id) || 0))
  }, [karyawan, searchTerm, filterDivisi])

  // Pagination Karyawan
  const totalRows = filteredKaryawan.length
  const actualPageSize = pageSize === 'all' ? (totalRows || 1) : Number(pageSize)
  const totalPages = Math.ceil(totalRows / actualPageSize) || 1
  const paginatedKaryawan = useMemo(() => {
    if (pageSize === 'all') return filteredKaryawan
    const start = (page - 1) * actualPageSize
    return filteredKaryawan.slice(start, start + actualPageSize)
  }, [filteredKaryawan, page, actualPageSize, pageSize])

  // Handle cell change
  const handleChange = (karyawanId, kriteriaId, val) => {
    const num = parseFloat(val) || 0
    setScores(prev => ({
      ...prev,
      [`${karyawanId}_${kriteriaId}`]: num
    }))
    setHasChanges(true)
  }

  // Simpan Semua Nilai ke Supabase
  const handleSaveAll = async () => {
    setSaving(true)
    const client = getSupabase()
    try {
      const rowsToUpsert = []
      karyawan.forEach(k => {
        sortedKriteria.forEach(c => {
          const key = `${k.id}_${c.id}`
          const val = scores[key] ?? 0.0
          rowsToUpsert.push({
            karyawan_id: k.id,
            kriteria_id: c.id,
            nilai: val
          })
        })
      })

      // Upsert batch to penilaian
      // Since unique constraint may or may not exist, let's delete and re-insert or upsert
      const { error: delErr } = await client.from('penilaian').delete().neq('id', 0)
      if (delErr) throw delErr

      const { error: insErr } = await client.from('penilaian').insert(rowsToUpsert)
      if (insErr) throw insErr

      onToast('Seluruh nilai penilaian berhasil disimpan!', 'success')
      setHasChanges(false)
      onRefresh()
    } catch (err) {
      onToast(err.message || 'Gagal menyimpan nilai.', 'danger')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Banner Control */}
      <div className="steam-card" style={{ padding: '18px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff' }}>
              Form Input &amp; Penilaian Kinerja
            </h2>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Masukkan skor evaluasi (skala 0 - 100) per karyawan pada masing-masing indikator
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleSaveAll}
              disabled={saving}
              className="btn btn-primary"
            >
              <Save size={16} />
              <span>{saving ? 'Menyimpan ke Cloud...' : hasChanges ? 'Simpan Perubahan Nilai *' : 'Simpan Semua Nilai'}</span>
            </button>
            <button onClick={() => onNavigate('hasil')} className="btn btn-secondary">
              <Trophy size={16} />
              <span>Lihat Hasil &amp; Peringkat</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
          <div className="input-search-wrapper" style={{ width: '280px' }}>
            <Search size={15} />
            <input
              type="text"
              placeholder="Cari NIK atau nama..."
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
              className="input-steam"
              style={{ fontSize: '0.8rem', padding: '7px 12px 7px 34px' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Filter size={14} color="var(--text-muted)" />
            <select
              value={filterDivisi}
              onChange={e => { setFilterDivisi(e.target.value); setPage(1); }}
              className="input-steam"
              style={{ width: '200px', fontSize: '0.8rem', padding: '7px 12px' }}
            >
              <option value="">Semua Divisi</option>
              {listDivisi.map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Pengaturan Jumlah Baris Per Halaman */}
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
              style={{ width: '90px', fontSize: '0.8rem', padding: '7px 10px' }}
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={300}>300</option>
              <option value="all">Semua</option>
            </select>
          </div>

          <div style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Menampilkan <strong>{paginatedKaryawan.length}</strong> dari {filteredKaryawan.length} karyawan &bull; {sortedKriteria.length} kriteria
          </div>
        </div>
      </div>

      {/* Table Input */}
      <div className="table-container">
        <table className="steam-table">
          <thead>
            <tr>
              <th style={{ width: '50px' }}>No</th>
              <th style={{ width: '120px' }}>NIK</th>
              <th style={{ minWidth: '180px' }}>Nama Karyawan</th>
              {sortedKriteria.map(c => (
                <th key={c.id} style={{ textAlign: 'center', minWidth: '110px' }}>
                  <div>{c.kode}</div>
                  <div style={{ fontSize: '0.68rem', fontWeight: 500, color: 'var(--text-dim)', textTransform: 'none' }}>
                    {c.nama} ({c.bobot})
                  </div>
                </th>
              ))}
              <th style={{ width: '90px', textAlign: 'center' }}>Rata-rata</th>
            </tr>
          </thead>
          <tbody>
            {paginatedKaryawan.map((k, idx) => {
              const kScores = sortedKriteria.map(c => scores[`${k.id}_${c.id}`] ?? 0)
              const avg = kScores.length ? Math.round((kScores.reduce((a, b) => a + b, 0) / kScores.length) * 10) / 10 : 0
              const rowNo = (pageSize === 'all' ? 0 : (page - 1) * actualPageSize) + idx + 1
              return (
                <tr key={k.id}>
                  <td style={{ color: 'var(--text-dim)', fontFamily: 'monospace' }}>{rowNo}</td>
                  <td style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--cyan-accent)' }}>
                    {k.nik}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: '#fff' }}>{k.nama}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{k.jabatan} &bull; {k.divisi}</div>
                  </td>
                  {sortedKriteria.map(c => {
                    const val = scores[`${k.id}_${c.id}`] ?? ''
                    return (
                      <td key={c.id} style={{ textAlign: 'center', padding: '8px' }}>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="1"
                          value={val}
                          onChange={e => handleChange(k.id, c.id, e.target.value)}
                          className="input-steam font-mono"
                          style={{
                            width: '80px',
                            textAlign: 'center',
                            padding: '6px',
                            fontWeight: 600,
                            color: val >= 80 ? '#3dd68c' : val >= 60 ? '#f59e0b' : '#ff5252'
                          }}
                        />
                      </td>
                    )
                  })}
                  <td style={{ textAlign: 'center', fontFamily: 'monospace', fontWeight: 700, color: '#fff' }}>
                    {avg}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar */}
      {pageSize !== 'all' && totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Halaman {page} dari {totalPages}
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn btn-secondary btn-sm"
            >
              Sebelumnya
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="btn btn-secondary btn-sm"
            >
              Selanjutnya
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

