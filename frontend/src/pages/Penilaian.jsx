import React, { useState, useEffect, useMemo } from 'react'
import {
  ClipboardCheck,
  Search,
  Save,
  Trophy,
  Filter,
  CheckCircle,
  AlertCircle,
  FileSpreadsheet,
  Download,
  Upload,
  X
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { getSupabase } from '../lib/supabase'
import Pagination from '../components/Pagination'

export default function Penilaian({ karyawan = [], kriteria = [], penilaian = [], onRefresh, onNavigate, onToast }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterDivisi, setFilterDivisi] = useState('')
  const [scores, setScores] = useState({})
  const [saving, setSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)

  // Modal Import Template Penilaian state
  const [modalImport, setModalImport] = useState(false)
  const [importFile, setImportFile] = useState(null)
  const [importPreview, setImportPreview] = useState([])
  const [parsedScores, setParsedScores] = useState({})
  const [importMatchCount, setImportMatchCount] = useState(0)

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

  // Kriteria terurut kode (C1, C2, C3, dst)
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

  // Unduh Template Penilaian (Berisi seluruh karyawan aktif dan kolom kriteria)
  const handleDownloadTemplate = (type = 'xlsx') => {
    if (!karyawan || karyawan.length === 0) {
      onToast('Data karyawan belum tersedia untuk membuat template.', 'danger')
      return
    }

    const headers = ['NIK', 'Nama Karyawan', 'Jabatan', 'Divisi', ...sortedKriteria.map(c => c.kode)]
    const rows = karyawan.map(k => {
      const row = {
        NIK: k.nik,
        'Nama Karyawan': k.nama,
        Jabatan: k.jabatan,
        Divisi: k.divisi
      }
      sortedKriteria.forEach(c => {
        const val = scores[`${k.id}_${c.id}`]
        row[c.kode] = val !== undefined && val !== null ? val : 0
      })
      return row
    })

    const ws = XLSX.utils.json_to_sheet(rows, { header: headers })
    ws['!cols'] = [
      { wch: 15 },
      { wch: 25 },
      { wch: 22 },
      { wch: 20 },
      ...sortedKriteria.map(() => ({ wch: 12 }))
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Penilaian Kinerja')

    if (type === 'xlsx') {
      XLSX.writeFile(wb, 'template_input_penilaian_kinerja.xlsx')
      onToast('Template Excel input penilaian berhasil diunduh!', 'success')
    } else {
      XLSX.writeFile(wb, 'template_input_penilaian_kinerja.csv', { bookType: 'csv' })
      onToast('Template CSV input penilaian berhasil diunduh!', 'success')
    }
  }

  // Handle Pemilihan File Template untuk Diimpor
  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImportFile(file)

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result
        const wb = XLSX.read(bstr, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rawRows = XLSX.utils.sheet_to_json(ws)

        // Buat map pencarian cepat NIK dan Nama
        const nikMap = {}
        const namaMap = {}
        karyawan.forEach(k => {
          if (k.nik) nikMap[String(k.nik).trim().toLowerCase()] = k
          if (k.nama) namaMap[String(k.nama).trim().toLowerCase()] = k
        })

        const newScoresMap = {}
        const previewList = []
        let matchCount = 0

        rawRows.forEach(row => {
          let emp = null
          let nikVal = ''
          let namaVal = ''

          Object.entries(row).forEach(([k, v]) => {
            const kLower = k.trim().toLowerCase()
            const vStr = String(v ?? '').trim()
            if (['nik', 'nip', 'nomor induk', 'no induk', 'id karyawan'].includes(kLower)) {
              nikVal = vStr
            } else if (['nama', 'nama lengkap', 'nama karyawan', 'karyawan'].includes(kLower)) {
              namaVal = vStr
            }
          })

          if (nikVal && nikMap[nikVal.toLowerCase()]) {
            emp = nikMap[nikVal.toLowerCase()]
          } else if (namaVal && namaMap[namaVal.toLowerCase()]) {
            emp = namaMap[namaVal.toLowerCase()]
          }

          if (emp) {
            matchCount++
            const rowScores = {}
            sortedKriteria.forEach(c => {
              const entry = Object.entries(row).find(([k]) => {
                const kLower = k.trim().toLowerCase()
                return (
                  kLower === c.kode.toLowerCase() ||
                  kLower.startsWith(`${c.kode.toLowerCase()} `) ||
                  kLower.startsWith(`${c.kode.toLowerCase()}-`) ||
                  kLower.startsWith(`${c.kode.toLowerCase()}(`) ||
                  kLower.includes(`(${c.kode.toLowerCase()})`)
                )
              })
              if (entry && !isNaN(Number(entry[1]))) {
                const val = Math.max(0, Math.min(100, Math.round(Number(entry[1]) * 100) / 100))
                newScoresMap[`${emp.id}_${c.id}`] = val
                rowScores[c.kode] = val
              }
            })

            if (previewList.length < 5) {
              previewList.push({
                nik: emp.nik,
                nama: emp.nama,
                jabatan: emp.jabatan,
                divisi: emp.divisi,
                scores: rowScores
              })
            }
          }
        })

        setParsedScores(newScoresMap)
        setImportPreview(previewList)
        setImportMatchCount(matchCount)
      } catch (err) {
        onToast('Format file spreadsheet tidak valid atau gagal dibaca.', 'danger')
      }
    }
    reader.readAsBinaryString(file)
  }

  // Terapkan nilai yang diimpor
  const handleApplyImportScores = async (directSave = false) => {
    const totalNew = Object.keys(parsedScores).length
    if (totalNew === 0) {
      onToast('Tidak ada data nilai valid yang ditemukan pada file.', 'danger')
      return
    }

    if (!directSave) {
      setScores(prev => ({
        ...prev,
        ...parsedScores
      }))
      setHasChanges(true)
      setModalImport(false)
      setImportFile(null)
      setImportPreview([])
      setParsedScores({})
      onToast(`Berhasil menerapkan ${totalNew} nilai ke form! Klik "Simpan Semua Nilai" untuk menyimpan permanen ke cloud.`, 'success')
      return
    }

    // Simpan langsung ke cloud
    setSaving(true)
    const client = getSupabase()
    try {
      const merged = { ...scores, ...parsedScores }
      const rowsToUpsert = []
      karyawan.forEach(k => {
        sortedKriteria.forEach(c => {
          const key = `${k.id}_${c.id}`
          const val = merged[key] ?? 0.0
          rowsToUpsert.push({
            karyawan_id: k.id,
            kriteria_id: c.id,
            nilai: val
          })
        })
      })

      const { error: delErr } = await client.from('penilaian').delete().neq('id', 0)
      if (delErr) throw delErr

      const { error: insErr } = await client.from('penilaian').insert(rowsToUpsert)
      if (insErr) throw insErr

      setScores(merged)
      setHasChanges(false)
      setModalImport(false)
      setImportFile(null)
      setImportPreview([])
      setParsedScores({})
      onToast('Seluruh nilai dari template berhasil disimpan permanen ke cloud!', 'success')
      onRefresh()
    } catch (err) {
      onToast(err.message || 'Gagal menyimpan nilai ke database.', 'danger')
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
              Masukkan skor evaluasi (skala 0 - 100) per karyawan pada masing-masing indikator kriteria
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {/* Tombol Unduh Template Penilaian */}
            <button
              onClick={() => handleDownloadTemplate('xlsx')}
              className="btn btn-secondary btn-sm"
              title="Unduh template Excel yang sudah memuat daftar seluruh karyawan dan kolom kriteria"
            >
              <Download size={14} color="#3dd68c" />
              <span>Unduh Template</span>
            </button>

            {/* Tombol Import Nilai Menggunakan Template */}
            <button
              onClick={() => {
                setModalImport(true)
                setImportFile(null)
                setImportPreview([])
                setParsedScores({})
              }}
              className="btn btn-secondary btn-sm"
              title="Unggah file spreadsheet template penilaian untuk mengisi skor secara otomatis"
            >
              <Upload size={14} color="var(--cyan-accent)" />
              <span>Import Nilai Template</span>
            </button>

            {/* Simpan Semua Nilai */}
            <button
              onClick={handleSaveAll}
              disabled={saving}
              className="btn btn-primary btn-sm"
            >
              <Save size={14} />
              <span>{saving ? 'Menyimpan...' : hasChanges ? 'Simpan Nilai *' : 'Simpan Semua Nilai'}</span>
            </button>

            <button onClick={() => onNavigate('hasil')} className="btn btn-secondary btn-sm">
              <Trophy size={14} />
              <span>Peringkat</span>
            </button>
          </div>
        </div>

        {/* Filters Toolbar */}
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

      {/* Pagination Bar Sesuai Gambar User: Dropdown di Kiri, Angka Halaman & Go to di Kanan */}
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

      {/* Modal Import Nilai Menggunakan Template */}
      {modalImport && (
        <div className="modal-overlay" onClick={() => setModalImport(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <FileSpreadsheet size={20} color="var(--cyan-accent)" />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>
                  Input Nilai Menggunakan Template Spreadsheet
                </h3>
              </div>
              <button
                onClick={() => setModalImport(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Gunakan template spreadsheet untuk memasukkan atau memperbarui nilai seluruh karyawan sekaligus. Unduh template di bawah, isi nilai pada kolom kriteria, lalu unggah kembali file tersebut.
              </div>

              {/* Box Unduh Template */}
              <div style={{
                background: 'rgba(26, 159, 255, 0.08)',
                border: '1px solid rgba(26, 159, 255, 0.25)',
                borderRadius: '8px',
                padding: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '10px'
              }}>
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>
                    1. Unduh Template Penilaian
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Sudah terisi otomatis dengan {karyawan.length} karyawan dan {sortedKriteria.length} kolom kriteria
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => handleDownloadTemplate('xlsx')}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                  >
                    <FileSpreadsheet size={14} color="#3dd68c" />
                    <span>Template Excel (.xlsx)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDownloadTemplate('csv')}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                  >
                    <FileSpreadsheet size={14} color="#66c0f4" />
                    <span>Template CSV (.csv)</span>
                  </button>
                </div>
              </div>

              {/* Area Upload File */}
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff', display: 'block', marginBottom: '6px' }}>
                  2. Pilih File Template yang Sudah Diisi Nilai:
                </label>
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileSelect}
                  className="input-steam"
                  style={{ width: '100%', padding: '10px' }}
                />
              </div>

              {/* Preview Data Terbaca */}
              {importPreview.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--cyan-accent)', textTransform: 'uppercase' }}>
                      Preview Data Terbaca ({importMatchCount} Karyawan Cocok, {Object.keys(parsedScores).length} Nilai Kriteria):
                    </span>
                  </div>

                  <div style={{ background: 'var(--surface-alt)', borderRadius: '6px', overflowX: 'auto', border: '1px solid var(--border)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                      <thead>
                        <tr style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-muted)' }}>
                          <th style={{ padding: '6px 10px', textAlign: 'left' }}>NIK</th>
                          <th style={{ padding: '6px 10px', textAlign: 'left' }}>Nama</th>
                          {sortedKriteria.map(c => (
                            <th key={c.id} style={{ padding: '6px 8px', textAlign: 'center' }}>{c.kode}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {importPreview.map((item, idx) => (
                          <tr key={idx} style={{ borderTop: '1px solid var(--border)' }}>
                            <td style={{ padding: '6px 10px', fontFamily: 'monospace', color: 'var(--cyan-accent)' }}>{item.nik}</td>
                            <td style={{ padding: '6px 10px', fontWeight: 600, color: '#fff' }}>{item.nama}</td>
                            {sortedKriteria.map(c => (
                              <td key={c.id} style={{ padding: '6px 8px', textAlign: 'center', fontFamily: 'monospace', color: '#3dd68c' }}>
                                {item.scores[c.kode] !== undefined ? item.scores[c.kode] : '-'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ gap: '8px' }}>
              <button
                type="button"
                onClick={() => setModalImport(false)}
                className="btn btn-secondary"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleApplyImportScores(false)}
                disabled={!importFile || Object.keys(parsedScores).length === 0}
                className="btn btn-secondary"
                title="Terapkan ke form tabel untuk ditinjau terlebih dahulu"
              >
                <span>Terapkan ke Form</span>
              </button>
              <button
                type="button"
                onClick={() => handleApplyImportScores(true)}
                disabled={!importFile || Object.keys(parsedScores).length === 0 || saving}
                className="btn btn-primary"
                title="Simpan langsung nilai ke database cloud"
              >
                <Save size={14} />
                <span>{saving ? 'Menyimpan...' : 'Simpan Langsung ke Cloud'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
