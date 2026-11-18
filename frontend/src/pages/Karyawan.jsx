import React, { useState, useMemo } from 'react'
import {
  Users,
  Search,
  Plus,
  FileSpreadsheet,
  Upload,
  KeyRound,
  Edit2,
  Trash2,
  Download,
  AlertCircle,
  CheckCircle,
  X,
  Filter
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { getSupabase } from '../lib/supabase'
import { hashPassword, generateRandomPassword } from '../lib/auth'

export default function Karyawan({ karyawan = [], onRefresh, onToast }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterDivisi, setFilterDivisi] = useState('')
  const [filterRole, setFilterRole] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  // Modals state
  const [modalTambah, setModalTambah] = useState(false)
  const [modalEdit, setModalEdit] = useState(null)
  const [modalHapus, setModalHapus] = useState(null)
  const [modalImport, setModalImport] = useState(false)
  const [modalGenerate, setModalGenerate] = useState(false)
  const [generatedAccounts, setGeneratedAccounts] = useState(null)
  const [loading, setLoading] = useState(false)

  // Form tambah/edit state
  const [formNik, setFormNik] = useState('')
  const [formNama, setFormNama] = useState('')
  const [formJabatan, setFormJabatan] = useState('')
  const [formDivisi, setFormDivisi] = useState('')
  const [formRole, setFormRole] = useState('karyawan')

  // Import CSV state
  const [csvFile, setCsvFile] = useState(null)
  const [csvPreview, setCsvPreview] = useState([])

  // Divisi unik untuk filter
  const listDivisi = useMemo(() => {
    const s = new Set()
    karyawan.forEach(k => { if (k.divisi) s.add(k.divisi) })
    return Array.from(s).sort()
  }, [karyawan])

  // Filter & Search
  const filteredKaryawan = useMemo(() => {
    return karyawan.filter(k => {
      const matchSearch =
        (k.nik || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (k.nama || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (k.jabatan || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (k.divisi || '').toLowerCase().includes(searchTerm.toLowerCase())

      const matchDivisi = !filterDivisi || k.divisi === filterDivisi
      const matchRole = !filterRole || (k.role || 'karyawan') === filterRole

      return matchSearch && matchDivisi && matchRole
    })
  }, [karyawan, searchTerm, filterDivisi, filterRole])

  // Pagination
  const totalRows = filteredKaryawan.length
  const actualPageSize = pageSize === 'all' ? (totalRows || 1) : Number(pageSize)
  const totalPages = Math.ceil(totalRows / actualPageSize) || 1
  const paginatedData = useMemo(() => {
    if (pageSize === 'all') return filteredKaryawan
    const start = (page - 1) * actualPageSize
    return filteredKaryawan.slice(start, start + actualPageSize)
  }, [filteredKaryawan, page, actualPageSize, pageSize])

  // Action: Tambah Karyawan
  const handleTambah = async (e) => {
    e.preventDefault()
    setLoading(true)
    const client = getSupabase()
    try {
      const { error } = await client.from('karyawan').insert([
        {
          nik: formNik.trim(),
          nama: formNama.trim(),
          jabatan: formJabatan.trim(),
          divisi: formDivisi.trim(),
          role: formRole
        }
      ])
      if (error) throw error
      onToast('Karyawan baru berhasil ditambahkan!', 'success')
      setModalTambah(false)
      setFormNik('')
      setFormNama('')
      setFormJabatan('')
      setFormDivisi('')
      setFormRole('karyawan')
      onRefresh()
    } catch (err) {
      onToast(err.message || 'Gagal menambah karyawan.', 'danger')
    } finally {
      setLoading(false)
    }
  }

  // Open Edit
  const openEdit = (k) => {
    setModalEdit(k)
    setFormNik(k.nik)
    setFormNama(k.nama)
    setFormJabatan(k.jabatan)
    setFormDivisi(k.divisi)
    setFormRole(k.role || 'karyawan')
  }

  // Action: Simpan Edit
  const handleSimpanEdit = async (e) => {
    e.preventDefault()
    if (!modalEdit) return
    setLoading(true)
    const client = getSupabase()
    try {
      const { error } = await client.from('karyawan').update({
        nik: formNik.trim(),
        nama: formNama.trim(),
        jabatan: formJabatan.trim(),
        divisi: formDivisi.trim(),
        role: formRole
      }).eq('id', modalEdit.id)

      if (error) throw error
      onToast('Data karyawan berhasil diperbarui!', 'success')
      setModalEdit(null)
      onRefresh()
    } catch (err) {
      onToast(err.message || 'Gagal mengubah data karyawan.', 'danger')
    } finally {
      setLoading(false)
    }
  }

  // Action: Hapus Karyawan
  const handleHapus = async () => {
    if (!modalHapus) return
    setLoading(true)
    const client = getSupabase()
    try {
      const { error } = await client.from('karyawan').delete().eq('id', modalHapus.id)
      if (error) throw error
      onToast(`Karyawan ${modalHapus.nama} berhasil dihapus.`, 'success')
      setModalHapus(null)
      onRefresh()
    } catch (err) {
      onToast(err.message || 'Gagal menghapus karyawan.', 'danger')
    } finally {
      setLoading(false)
    }
  }

  // Action: Export Excel
  const handleExportExcel = () => {
    const rows = filteredKaryawan.map((k, idx) => ({
      No: idx + 1,
      NIK: k.nik,
      'Nama Karyawan': k.nama,
      Jabatan: k.jabatan,
      Divisi: k.divisi,
      Role: k.role || 'karyawan'
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Daftar Karyawan')
    XLSX.writeFile(wb, 'data_karyawan_perfomax.xlsx')
    onToast('File Excel berhasil diunduh!', 'success')
  }

  // Handle CSV file selection
  const handleCsvSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setCsvFile(file)
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result
        const wb = XLSX.read(bstr, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 })
        setCsvPreview(data.slice(0, 6)) // Preview 5 baris pertama
      } catch {
        onToast('Format file CSV/Excel tidak valid.', 'danger')
      }
    }
    reader.readAsBinaryString(file)
  }

  // Action: Process Import CSV
  const handleProcessImport = async () => {
    if (!csvFile) return
    setLoading(true)
    const client = getSupabase()
    try {
      const reader = new FileReader()
      reader.onload = async (evt) => {
        try {
          const bstr = evt.target.result
          const wb = XLSX.read(bstr, { type: 'binary' })
          const ws = wb.Sheets[wb.SheetNames[0]]
          const rawRows = XLSX.utils.sheet_to_json(ws)

          const toInsert = []
          rawRows.forEach(row => {
            const nik = row.nik || row.NIK || row.NIP || row.nip || ''
            const nama = row.nama || row.Nama || row.NAMA || ''
            const jabatan = row.jabatan || row.Jabatan || row.JABATAN || ''
            const divisi = row.divisi || row.Divisi || row.DIVISI || ''
            const role = (row.role || row.Role || 'karyawan').toLowerCase()

            if (nik && nama) {
              toInsert.push({
                nik: String(nik).trim(),
                nama: String(nama).trim(),
                jabatan: String(jabatan).trim() || 'Staff',
                divisi: String(divisi).trim() || 'Umum',
                role: role === 'atasan' ? 'atasan' : 'karyawan'
              })
            }
          })

          if (toInsert.length === 0) {
            throw new Error('Tidak ada baris data valid ditemukan di file CSV.')
          }

          // Upsert or insert batch
          const { error } = await client.from('karyawan').upsert(toInsert, { onConflict: 'nik' })
          if (error) throw error

          onToast(`Berhasil mengimpor ${toInsert.length} data karyawan!`, 'success')
          setModalImport(false)
          setCsvFile(null)
          setCsvPreview([])
          onRefresh()
        } catch (err) {
          onToast(err.message || 'Gagal memproses file.', 'danger')
        } finally {
          setLoading(false)
        }
      }
      reader.readAsBinaryString(csvFile)
    } catch (err) {
      setLoading(false)
      onToast(err.message, 'danger')
    }
  }

  // Action: Generate Akun Massal
  const handleGenerateAkun = async (targetRole) => {
    setLoading(true)
    const client = getSupabase()
    try {
      // Ambil karyawan target
      const targets = karyawan.filter(k => {
        if (targetRole === 'atasan') return (k.role || '').toLowerCase() === 'atasan'
        return true // semua
      })

      if (targets.length === 0) {
        throw new Error('Tidak ada karyawan yang sesuai kriteria target.')
      }

      const generatedList = []
      const usersToUpsert = []

      for (const k of targets) {
        const plainPass = generateRandomPassword(8)
        const hash = await hashPassword(plainPass)

        generatedList.push({
          nik: k.nik,
          nama: k.nama,
          jabatan: k.jabatan,
          divisi: k.divisi,
          role: k.role || 'karyawan',
          username: k.nik,
          password: plainPass
        })

        usersToUpsert.push({
          username: k.nik,
          password_hash: hash,
          role: k.role || 'karyawan',
          must_change_password: true,
          karyawan_id: k.id
        })
      }

      // Batch upsert users in Supabase
      const { error } = await client.from('users').upsert(usersToUpsert, { onConflict: 'username' })
      if (error) throw error

      setGeneratedAccounts(generatedList)
      setModalGenerate(false)
      onToast(`Berhasil generate ${generatedList.length} akun!`, 'success')
      onRefresh()
    } catch (err) {
      onToast(err.message || 'Gagal membuat akun.', 'danger')
    } finally {
      setLoading(false)
    }
  }

  // Unduh Excel Akun Terbuat
  const downloadGeneratedExcel = () => {
    if (!generatedAccounts) return
    const rows = generatedAccounts.map((a, i) => ({
      No: i + 1,
      NIK: a.nik,
      'Nama Karyawan': a.nama,
      Jabatan: a.jabatan,
      Divisi: a.divisi,
      Role: a.role,
      Username: a.username,
      'Password Awal': a.password
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Akun Karyawan')
    XLSX.writeFile(wb, 'daftar_akun_karyawan_perfomax.xlsx')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Controls Bar */}
      <div className="steam-card" style={{ padding: '18px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          {/* Search Input */}
          <div className="input-search-wrapper" style={{ width: '320px' }}>
            <Search size={16} />
            <input
              type="text"
              placeholder="Cari NIK, nama, jabatan, divisi..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1) }}
              className="input-steam"
            />
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button onClick={() => setModalTambah(true)} className="btn btn-primary btn-sm">
              <Plus size={15} />
              <span>Tambah Karyawan</span>
            </button>
            <button onClick={() => setModalImport(true)} className="btn btn-secondary btn-sm">
              <Upload size={15} />
              <span>Import CSV (300+)</span>
            </button>
            <button onClick={() => setModalGenerate(true)} className="btn btn-secondary btn-sm">
              <KeyRound size={15} />
              <span>Generate Akun Massal</span>
            </button>
            <button onClick={handleExportExcel} className="btn btn-secondary btn-sm">
              <Download size={15} />
              <span>Export Excel</span>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            <Filter size={14} />
            <span>Filter:</span>
          </div>

          <select
            value={filterDivisi}
            onChange={(e) => { setFilterDivisi(e.target.value); setPage(1) }}
            className="input-steam"
            style={{ width: '200px', padding: '6px 12px', fontSize: '0.8rem' }}
          >
            <option value="">Semua Divisi ({listDivisi.length})</option>
            {listDivisi.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          <select
            value={filterRole}
            onChange={(e) => { setFilterRole(e.target.value); setPage(1) }}
            className="input-steam"
            style={{ width: '160px', padding: '6px 12px', fontSize: '0.8rem' }}
          >
            <option value="">Semua Role</option>
            <option value="karyawan">Karyawan</option>
            <option value="atasan">Atasan</option>
          </select>

          {/* Pengaturan Jumlah Baris Per Halaman */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Baris:</span>
            <select
              value={pageSize}
              onChange={(e) => {
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

          <div style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Menampilkan <strong>{paginatedData.length}</strong> dari {filteredKaryawan.length} karyawan
          </div>
        </div>
      </div>

      {/* Employee Table */}
      <div className="table-container">
        <table className="steam-table">
          <thead>
            <tr>
              <th style={{ width: '50px' }}>No</th>
              <th style={{ width: '120px' }}>NIK</th>
              <th>Nama Karyawan</th>
              <th>Jabatan</th>
              <th>Divisi</th>
              <th style={{ width: '110px' }}>Role</th>
              <th style={{ width: '110px', textAlign: 'center' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {paginatedData.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dim)' }}>
                  Tidak ada data karyawan yang cocok dengan pencarian.
                </td>
              </tr>
            ) : (
              paginatedData.map((k, idx) => (
                <tr key={k.id}>
                  <td style={{ color: 'var(--text-dim)', fontFamily: 'monospace' }}>
                    {(pageSize === 'all' ? 0 : (page - 1) * actualPageSize) + idx + 1}
                  </td>
                  <td style={{ fontWeight: 600, color: 'var(--cyan-accent)', fontFamily: 'monospace' }}>
                    {k.nik}
                  </td>
                  <td style={{ fontWeight: 600, color: '#fff' }}>
                    {k.nama}
                  </td>
                  <td>{k.jabatan}</td>
                  <td>{k.divisi}</td>
                  <td>
                    <span className={`badge badge-${k.role || 'karyawan'}`}>
                      {(k.role || 'karyawan').toUpperCase()}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', gap: '6px' }}>
                      <button
                        onClick={() => openEdit(k)}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '5px 8px' }}
                        title="Edit Data"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        onClick={() => setModalHapus(k)}
                        className="btn btn-danger btn-sm"
                        style={{ padding: '5px 8px' }}
                        title="Hapus Karyawan"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
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

      {/* Modal Tambah Karyawan */}
      {modalTambah && (
        <div className="modal-overlay" onClick={() => setModalTambah(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>Tambah Karyawan Baru</h3>
              <button onClick={() => setModalTambah(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleTambah}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                    Nomor Induk Karyawan (NIK)
                  </label>
                  <input
                    type="text"
                    required
                    value={formNik}
                    onChange={e => setFormNik(e.target.value)}
                    placeholder="Contoh: EMP0309 atau 19850101..."
                    className="input-steam"
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                    Nama Lengkap
                  </label>
                  <input
                    type="text"
                    required
                    value={formNama}
                    onChange={e => setFormNama(e.target.value)}
                    placeholder="Nama lengkap karyawan..."
                    className="input-steam"
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                    Jabatan
                  </label>
                  <input
                    type="text"
                    required
                    value={formJabatan}
                    onChange={e => setFormJabatan(e.target.value)}
                    placeholder="Contoh: Software Engineer, Staff..."
                    className="input-steam"
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                    Divisi
                  </label>
                  <input
                    type="text"
                    required
                    value={formDivisi}
                    onChange={e => setFormDivisi(e.target.value)}
                    placeholder="Contoh: Teknologi Informasi, HRD..."
                    className="input-steam"
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                    Role Hak Akses
                  </label>
                  <select
                    value={formRole}
                    onChange={e => setFormRole(e.target.value)}
                    className="input-steam"
                  >
                    <option value="karyawan">Karyawan (Hanya melihat nilai diri sendiri)</option>
                    <option value="atasan">Atasan (Bisa input nilai kinerja &amp; lihat ranking)</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setModalTambah(false)} className="btn btn-secondary">Batal</button>
                <button type="submit" disabled={loading} className="btn btn-primary">
                  {loading ? 'Menyimpan...' : 'Simpan Karyawan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit Karyawan */}
      {modalEdit && (
        <div className="modal-overlay" onClick={() => setModalEdit(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>Edit Data Karyawan</h3>
              <button onClick={() => setModalEdit(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSimpanEdit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Nomor Induk Karyawan (NIK)</label>
                  <input type="text" required value={formNik} onChange={e => setFormNik(e.target.value)} className="input-steam" />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Nama Lengkap</label>
                  <input type="text" required value={formNama} onChange={e => setFormNama(e.target.value)} className="input-steam" />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Jabatan</label>
                  <input type="text" required value={formJabatan} onChange={e => setFormJabatan(e.target.value)} className="input-steam" />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Divisi</label>
                  <input type="text" required value={formDivisi} onChange={e => setFormDivisi(e.target.value)} className="input-steam" />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Role</label>
                  <select value={formRole} onChange={e => setFormRole(e.target.value)} className="input-steam">
                    <option value="karyawan">Karyawan</option>
                    <option value="atasan">Atasan</option>
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setModalEdit(null)} className="btn btn-secondary">Batal</button>
                <button type="submit" disabled={loading} className="btn btn-primary">
                  {loading ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Hapus Karyawan */}
      {modalHapus && (
        <div className="modal-overlay" onClick={() => setModalHapus(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#ff5252' }}>Konfirmasi Hapus</h3>
              <button onClick={() => setModalHapus(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body" style={{ fontSize: '0.875rem', lineHeight: 1.5, color: 'var(--text-main)' }}>
              Apakah Anda yakin ingin menghapus data karyawan <strong>{modalHapus.nama}</strong> ({modalHapus.nik})? Seluruh nilai evaluasi dan akun login terkait akan ikut terhapus.
            </div>
            <div className="modal-footer">
              <button type="button" onClick={() => setModalHapus(null)} className="btn btn-secondary">Batal</button>
              <button type="button" onClick={handleHapus} disabled={loading} className="btn btn-danger">
                {loading ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Import CSV */}
      {modalImport && (
        <div className="modal-overlay" onClick={() => setModalImport(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>Import CSV Daftar Karyawan</h3>
              <button onClick={() => setModalImport(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Pilih file CSV atau Excel yang berisi kolom: <code>nik</code>, <code>nama</code>, <code>jabatan</code>, <code>divisi</code>, <code>role</code> (opsional: karyawan/atasan). Mendukung impor hingga 300+ baris sekaligus.
              </div>

              <input
                type="file"
                accept=".csv, .xlsx, .xls"
                onChange={handleCsvSelect}
                className="input-steam"
              />

              {csvPreview.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--cyan-accent)', textTransform: 'uppercase', marginBottom: '8px' }}>
                    Preview 5 Baris Pertama:
                  </div>
                  <div style={{ background: 'var(--surface-alt)', padding: '10px', borderRadius: '6px', fontSize: '0.75rem', overflowX: 'auto', fontFamily: 'monospace' }}>
                    {csvPreview.map((row, i) => (
                      <div key={i} style={{ padding: '2px 0', borderBottom: i === 0 ? '1px solid var(--border)' : 'none', color: i === 0 ? 'var(--cyan-accent)' : 'var(--text-main)' }}>
                        {Array.isArray(row) ? row.join(' | ') : JSON.stringify(row)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" onClick={() => setModalImport(false)} className="btn btn-secondary">Batal</button>
              <button
                type="button"
                onClick={handleProcessImport}
                disabled={!csvFile || loading}
                className="btn btn-primary"
              >
                {loading ? 'Memproses...' : 'Mulai Impor Data'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Generate Akun Pilihan */}
      {modalGenerate && (
        <div className="modal-overlay" onClick={() => setModalGenerate(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>Generate Akun Login Massal</h3>
              <button onClick={() => setModalGenerate(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Pilih kelompok karyawan yang akan dibuatkan akun login otomatis. Password awal akan digenerate secara acak dan aman:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => handleGenerateAkun('atasan')}
                  disabled={loading}
                  className="btn btn-secondary"
                  style={{ justifyContent: 'space-between', padding: '14px 18px', textAlign: 'left' }}
                >
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--purple-atasan)' }}>Buat Akun untuk Role Atasan Saja</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Khusus manajer/atasan yang berwenang mengisi penilaian kinerja.
                    </div>
                  </div>
                  <KeyRound size={20} color="var(--purple-atasan)" />
                </button>

                <button
                  type="button"
                  onClick={() => handleGenerateAkun('semua')}
                  disabled={loading}
                  className="btn btn-secondary"
                  style={{ justifyContent: 'space-between', padding: '14px 18px', textAlign: 'left' }}
                >
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--cyan-accent)' }}>Buat Akun untuk Semua Karyawan</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Seluruh 300+ karyawan &amp; atasan yang terdaftar di sistem.
                    </div>
                  </div>
                  <Users size={20} color="var(--cyan-accent)" />
                </button>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" onClick={() => setModalGenerate(false)} className="btn btn-secondary">Tutup</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Tampilan Hasil Akun Terbuat (Hanya Muncul Sekali Demi Keamanan) */}
      {generatedAccounts && (
        <div className="modal-overlay">
          <div className="modal-card" style={{ maxWidth: '750px' }}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#3dd68c', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle size={20} />
                  <span>Daftar Akun Berhasil Digenerate ({generatedAccounts.length})</span>
                </h3>
                <div style={{ fontSize: '0.75rem', color: '#f59e0b', marginTop: '2px' }}>
                  ⚠️ PERHATIAN: Password hanya ditampilkan sekali ini saja demi keamanan. Segera unduh file Excel!
                </div>
              </div>
              <button onClick={() => setGeneratedAccounts(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="table-container" style={{ maxHeight: '350px' }}>
                <table className="steam-table">
                  <thead>
                    <tr>
                      <th>NIK / Username</th>
                      <th>Nama Karyawan</th>
                      <th>Role</th>
                      <th>Password Awal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {generatedAccounts.map((acc, idx) => (
                      <tr key={idx}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--cyan-accent)' }}>
                          {acc.username}
                        </td>
                        <td style={{ fontWeight: 600, color: '#fff' }}>{acc.nama}</td>
                        <td>
                          <span className={`badge badge-${acc.role}`}>
                            {acc.role.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ fontFamily: 'monospace', background: 'rgba(26, 159, 255, 0.1)', color: '#3dd68c', fontWeight: 700 }}>
                          {acc.password}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Karyawan/Atasan wajib ganti password saat login pertama.
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={() => setGeneratedAccounts(null)} className="btn btn-secondary">
                  Tutup
                </button>
                <button type="button" onClick={downloadGeneratedExcel} className="btn btn-primary">
                  <Download size={15} />
                  <span>Unduh File Excel Akun</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

