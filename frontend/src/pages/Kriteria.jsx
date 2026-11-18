import React, { useState, useMemo } from 'react'
import { Sliders, Plus, Edit2, Trash2, AlertTriangle, CheckCircle, X, Info } from 'lucide-react'
import { getSupabase } from '../lib/supabase'

export default function Kriteria({ kriteria = [], onRefresh, onToast }) {
  const [modalTambah, setModalTambah] = useState(false)
  const [modalEdit, setModalEdit] = useState(null)
  const [modalHapus, setModalHapus] = useState(null)
  const [loading, setLoading] = useState(false)

  // Form states
  const [kode, setKode] = useState('')
  const [nama, setNama] = useState('')
  const [tipe, setTipe] = useState('benefit')
  const [bobot, setBobot] = useState('0.20')

  // Hitung kode kriteria otomatis berikutnya (C1, C2, C3, dst)
  const nextKode = useMemo(() => {
    let maxNum = 0
    kriteria.forEach(k => {
      const match = (k.kode || '').match(/^C(\d+)$/i)
      if (match) {
        const num = parseInt(match[1], 10)
        if (num > maxNum) maxNum = num
      }
    })
    return `C${maxNum + 1}`
  }, [kriteria])

  // Total bobot
  const totalBobot = useMemo(() => {
    return Math.round(kriteria.reduce((acc, k) => acc + (parseFloat(k.bobot) || 0), 0) * 100) / 100
  }, [kriteria])

  const isValidBobot = Math.abs(totalBobot - 1.0) < 0.001 || Math.abs(totalBobot - 100) < 0.1

  const openTambah = () => {
    setKode(nextKode)
    setNama('')
    setTipe('benefit')
    setBobot('0.20')
    setModalTambah(true)
  }

  const handleTambah = async (e) => {
    e.preventDefault()
    setLoading(true)
    const client = getSupabase()
    try {
      const { error } = await client.from('kriteria').insert([
        {
          kode: nextKode,
          nama: nama.trim(),
          tipe: tipe.toLowerCase(),
          bobot: parseFloat(bobot) || 0
        }
      ])
      if (error) throw error
      onToast(`Kriteria ${nextKode} berhasil ditambahkan!`, 'success')
      setModalTambah(false)
      setNama('')
      setTipe('benefit')
      setBobot('0.20')
      onRefresh()
    } catch (err) {
      onToast(err.message || 'Gagal menambah kriteria.', 'danger')
    } finally {
      setLoading(false)
    }
  }

  const openEdit = (k) => {
    setModalEdit(k)
    setKode(k.kode)
    setNama(k.nama)
    setTipe(k.tipe || 'benefit')
    setBobot(String(k.bobot))
  }

  const handleSimpanEdit = async (e) => {
    e.preventDefault()
    if (!modalEdit) return
    setLoading(true)
    const client = getSupabase()
    try {
      const { error } = await client.from('kriteria').update({
        kode: kode.trim().toUpperCase(),
        nama: nama.trim(),
        tipe: tipe.toLowerCase(),
        bobot: parseFloat(bobot) || 0
      }).eq('id', modalEdit.id)

      if (error) throw error
      onToast('Kriteria berhasil diperbarui!', 'success')
      setModalEdit(null)
      onRefresh()
    } catch (err) {
      onToast(err.message || 'Gagal mengubah kriteria.', 'danger')
    } finally {
      setLoading(false)
    }
  }

  const handleHapus = async () => {
    if (!modalHapus) return
    setLoading(true)
    const client = getSupabase()
    try {
      const { error } = await client.from('kriteria').delete().eq('id', modalHapus.id)
      if (error) throw error
      onToast(`Kriteria ${modalHapus.kode} berhasil dihapus.`, 'success')
      setModalHapus(null)
      onRefresh()
    } catch (err) {
      onToast(err.message || 'Gagal menghapus kriteria.', 'danger')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Banner & Control */}
      <div className="steam-card" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff' }}>
            Daftar Indikator &amp; Bobot Penilaian
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Kriteria digunakan sebagai dasar perhitungan akumulasi evaluasi kinerja karyawan
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Bobot summary pill */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '7px 14px',
            borderRadius: '8px',
            background: isValidBobot ? 'rgba(61, 214, 140, 0.12)' : 'rgba(245, 158, 11, 0.15)',
            border: `1px solid ${isValidBobot ? 'rgba(61, 214, 140, 0.3)' : 'rgba(245, 158, 11, 0.35)'}`,
            color: isValidBobot ? '#3dd68c' : '#f59e0b',
            fontSize: '0.8rem',
            fontWeight: 600
          }}>
            {isValidBobot ? <CheckCircle size={15} /> : <AlertTriangle size={15} />}
            <span>Total Bobot: <strong>{totalBobot}</strong> {isValidBobot ? '(Ideal 1.0)' : '(Disarankan 1.0)'}</span>
          </div>

          <button onClick={openTambah} className="btn btn-primary btn-sm">
            <Plus size={15} />
            <span>Tambah Kriteria</span>
          </button>
        </div>
      </div>

      {/* Criteria Table */}
      <div className="table-container">
        <table className="steam-table">
          <thead>
            <tr>
              <th style={{ width: '80px' }}>Kode</th>
              <th>Nama Indikator / Kriteria</th>
              <th style={{ width: '130px' }}>Tipe</th>
              <th style={{ width: '130px' }}>Bobot Nilai</th>
              <th style={{ width: '140px' }}>Persentase</th>
              <th style={{ width: '120px', textAlign: 'center' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {kriteria.map((k) => {
              const b = parseFloat(k.bobot) || 0
              const pct = totalBobot > 0 ? Math.round((b / totalBobot) * 1000) / 10 : 0
              return (
                <tr key={k.id}>
                  <td style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--cyan-accent)', fontSize: '0.95rem' }}>
                    {k.kode}
                  </td>
                  <td style={{ fontWeight: 600, color: '#fff' }}>
                    {k.nama}
                  </td>
                  <td>
                    <span className={`badge badge-${k.tipe || 'benefit'}`}>
                      {(k.tipe || 'benefit').toUpperCase()}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                    {k.bobot}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ flex: 1, height: '6px', background: 'var(--surface-alt)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, pct)}%`, height: '100%', background: 'var(--primary)' }} />
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', width: '38px', fontFamily: 'monospace' }}>
                        {pct}%
                      </span>
                    </div>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', gap: '6px' }}>
                      <button onClick={() => openEdit(k)} className="btn btn-secondary btn-sm" style={{ padding: '5px 8px' }} title="Edit">
                        <Edit2 size={13} />
                      </button>
                      <button onClick={() => setModalHapus(k)} className="btn btn-danger btn-sm" style={{ padding: '5px 8px' }} title="Hapus">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Info Box Tipe Kriteria */}
      <div className="steam-card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'flex-start', gap: '14px', background: 'rgba(19, 28, 40, 0.6)' }}>
        <Info size={20} color="var(--cyan-accent)" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
          <strong>Petunjuk Tipe Kriteria:</strong><br />
          &bull; <strong>Benefit:</strong> Semakin tinggi nilai karyawan, semakin baik (contoh: Kualitas Kerja, Kedisiplinan, Inovasi).<br />
          &bull; <strong>Cost:</strong> Semakin rendah nilai karyawan, semakin baik (contoh: Jumlah Pelanggaran, Tingkat Keterlambatan).
        </div>
      </div>

      {/* Modal Tambah Kriteria */}
      {modalTambah && (
        <div className="modal-overlay" onClick={() => setModalTambah(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>Tambah Kriteria Baru</h3>
              <button onClick={() => setModalTambah(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleTambah}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                    Kode Kriteria (Otomatis)
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="text"
                      readOnly
                      value={nextKode}
                      className="input-steam font-mono"
                      style={{ background: 'var(--surface-alt)', fontWeight: 700, color: 'var(--cyan-accent)', cursor: 'not-allowed' }}
                    />
                    <span className="badge badge-admin">Auto</span>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-dim)', marginTop: '4px' }}>
                    Kode ditentukan otomatis oleh sistem secara berurutan.
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Nama Indikator</label>
                  <input type="text" required value={nama} onChange={e => setNama(e.target.value)} placeholder="Contoh: Kerjasama Tim" className="input-steam" />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Tipe Kriteria</label>
                  <select value={tipe} onChange={e => setTipe(e.target.value)} className="input-steam">
                    <option value="benefit">Benefit (Nilai tinggi lebih baik)</option>
                    <option value="cost">Cost (Nilai rendah lebih baik)</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Bobot (0.05 - 1.0)</label>
                  <input type="number" step="0.01" min="0.01" max="100" required value={bobot} onChange={e => setBobot(e.target.value)} className="input-steam font-mono" />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setModalTambah(false)} className="btn btn-secondary">Batal</button>
                <button type="submit" disabled={loading} className="btn btn-primary">{loading ? 'Menyimpan...' : 'Simpan Kriteria'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit Kriteria */}
      {modalEdit && (
        <div className="modal-overlay" onClick={() => setModalEdit(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>Edit Kriteria</h3>
              <button onClick={() => setModalEdit(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSimpanEdit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Kode Kriteria</label>
                  <input type="text" readOnly value={kode} className="input-steam font-mono" style={{ background: 'var(--surface-alt)', fontWeight: 700, color: 'var(--cyan-accent)', cursor: 'not-allowed' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Nama Indikator</label>
                  <input type="text" required value={nama} onChange={e => setNama(e.target.value)} className="input-steam" />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Tipe</label>
                  <select value={tipe} onChange={e => setTipe(e.target.value)} className="input-steam">
                    <option value="benefit">Benefit</option>
                    <option value="cost">Cost</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>Bobot</label>
                  <input type="number" step="0.01" min="0.01" max="100" required value={bobot} onChange={e => setBobot(e.target.value)} className="input-steam font-mono" />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setModalEdit(null)} className="btn btn-secondary">Batal</button>
                <button type="submit" disabled={loading} className="btn btn-primary">{loading ? 'Menyimpan...' : 'Simpan Perubahan'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Hapus Kriteria */}
      {modalHapus && (
        <div className="modal-overlay" onClick={() => setModalHapus(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#ff5252' }}>Hapus Kriteria</h3>
              <button onClick={() => setModalHapus(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body" style={{ fontSize: '0.875rem', lineHeight: 1.5, color: 'var(--text-main)' }}>
              Apakah Anda yakin ingin menghapus kriteria <strong>{modalHapus.kode} - {modalHapus.nama}</strong>? Seluruh nilai terkait kriteria ini akan ikut terhapus.
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
    </div>
  )
}

