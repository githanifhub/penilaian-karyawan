import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  User,
  Shield,
  Edit3,
  KeyRound,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Building,
  Briefcase,
  IdCard,
  FileText,
  Send,
  X,
  Check,
  RotateCcw
} from 'lucide-react'
import { getSupabase } from '../lib/supabase'

export default function DataDiri({ user, karyawan = [], onRefresh, onOpenChangePassword, onToast }) {
  // Ambil data karyawan terbaru yang cocok dengan user yang login
  const myKaryawan = useMemo(() => {
    if (user?.karyawan_id) {
      return karyawan.find(k => k.id === user.karyawan_id) || user.karyawan
    }
    // Jika admin atau user tanpa karyawan_id, cek kecocokan username ke NIK
    if (user?.username) {
      const match = karyawan.find(k => k.nik?.toLowerCase() === user.username?.toLowerCase())
      if (match) return match
    }
    return user?.karyawan || null
  }, [user, karyawan])

  const isAdmin = user?.role === 'admin'
  const displayName = myKaryawan?.nama || (isAdmin ? 'Administrator' : user?.username || 'User')
  const displayNik = myKaryawan?.nik || (isAdmin ? 'ADMIN-SYS' : user?.username || '-')
  const displayJabatan = myKaryawan?.jabatan || (isAdmin ? 'System Administrator' : 'Staff')
  const displayDivisi = myKaryawan?.divisi || (isAdmin ? 'IT & Sistem Informasi' : 'Umum')
  const displayRole = user?.role || 'karyawan'

  // Modal Pengajuan Perubahan Data
  const [modalAjukan, setModalAjukan] = useState(false)
  const [formNama, setFormNama] = useState(displayName)
  const [formJabatan, setFormJabatan] = useState(displayJabatan)
  const [formDivisi, setFormDivisi] = useState(displayDivisi)
  const [formAlasan, setFormAlasan] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Riwayat Pengajuan
  const [riwayat, setRiwayat] = useState([])
  const [loadingRiwayat, setLoadingRiwayat] = useState(false)
  const [filterStatus, setFilterStatus] = useState('semua') // 'semua' | 'menunggu' | 'disetujui' | 'ditolak'

  // Modal Tolak Catatan Admin
  const [modalTolak, setModalTolak] = useState(null)
  const [catatanTolak, setCatatanTolak] = useState('')

  // Sinkronisasi form saat myKaryawan berubah
  useEffect(() => {
    if (!modalAjukan) {
      setFormNama(displayName)
      setFormJabatan(displayJabatan)
      setFormDivisi(displayDivisi)
    }
  }, [displayName, displayJabatan, displayDivisi, modalAjukan])

  // Muat riwayat pengajuan dari Supabase
  const fetchRiwayat = useCallback(async () => {
    const client = getSupabase()
    if (!client) return

    setLoadingRiwayat(true)
    try {
      let query = client.from('pengajuan_perubahan').select('*').order('created_at', { ascending: false })

      // Jika bukan admin, hanya ambil pengajuan milik sendiri
      if (!isAdmin) {
        if (user?.id) {
          query = query.eq('user_id', user.id)
        } else if (displayNik) {
          query = query.eq('nik', displayNik)
        }
      }

      const { data, error } = await query
      if (error) throw error
      setRiwayat(data || [])
    } catch (err) {
      console.warn('Riwayat pengajuan belum dapat dimuat:', err.message)
    } finally {
      setLoadingRiwayat(false)
    }
  }, [isAdmin, user, displayNik])

  useEffect(() => {
    fetchRiwayat()
  }, [fetchRiwayat])

  // Submit pengajuan perubahan data
  const handleSubmitPengajuan = async (e) => {
    e.preventDefault()
    if (!formAlasan.trim()) {
      onToast('Harap masukkan alasan pengajuan perubahan data.', 'danger')
      return
    }

    setSubmitting(true)
    const client = getSupabase()
    try {
      const payload = {
        user_id: user?.id || null,
        karyawan_id: myKaryawan?.id || null,
        nik: displayNik,
        nama_lama: displayName,
        jabatan_lama: displayJabatan,
        divisi_lama: displayDivisi,
        nama_baru: formNama.trim(),
        jabatan_baru: formJabatan.trim(),
        divisi_baru: formDivisi.trim(),
        alasan: formAlasan.trim(),
        status: isAdmin ? 'disetujui' : 'menunggu',
        catatan_admin: isAdmin ? 'Diperbarui langsung oleh Administrator' : null
      }

      const { error: insErr } = await client.from('pengajuan_perubahan').insert([payload])
      if (insErr) throw insErr

      // Jika yang mengajukan adalah admin dan ada data karyawan terkait, langsung update data karyawan
      if (isAdmin && myKaryawan?.id) {
        const { error: updErr } = await client.from('karyawan').update({
          nama: formNama.trim(),
          jabatan: formJabatan.trim(),
          divisi: formDivisi.trim()
        }).eq('id', myKaryawan.id)

        if (updErr) throw updErr
        onToast('Data profil berhasil diperbarui langsung!', 'success')
      } else {
        onToast('Pengajuan perubahan data berhasil dikirim! Menunggu verifikasi admin.', 'success')
      }

      setModalAjukan(false)
      setFormAlasan('')
      fetchRiwayat()
      if (onRefresh) onRefresh()
    } catch (err) {
      onToast(err.message || 'Gagal mengirim pengajuan.', 'danger')
    } finally {
      setSubmitting(false)
    }
  }

  // Aksi Admin: Setujui Pengajuan
  const handleSetujuiPengajuan = async (item) => {
    const client = getSupabase()
    try {
      // 1. Update data karyawan jika ada karyawan_id atau nik
      if (item.karyawan_id) {
        const { error: updErr } = await client.from('karyawan').update({
          nama: item.nama_baru,
          jabatan: item.jabatan_baru,
          divisi: item.divisi_baru
        }).eq('id', item.karyawan_id)

        if (updErr) throw updErr
      } else if (item.nik) {
        const { error: updErr } = await client.from('karyawan').update({
          nama: item.nama_baru,
          jabatan: item.jabatan_baru,
          divisi: item.divisi_baru
        }).eq('nik', item.nik)

        if (updErr) throw updErr
      }

      // 2. Tandai pengajuan sebagai disetujui
      const { error: statErr } = await client
        .from('pengajuan_perubahan')
        .update({
          status: 'disetujui',
          catatan_admin: 'Pengajuan telah disetujui oleh Administrator.',
          updated_at: new Date().toISOString()
        })
        .eq('id', item.id)

      if (statErr) throw statErr

      onToast(`Pengajuan data untuk ${item.nama_baru} berhasil disetujui dan diterapkan!`, 'success')
      fetchRiwayat()
      if (onRefresh) onRefresh()
    } catch (err) {
      onToast(err.message || 'Gagal menyetujui pengajuan.', 'danger')
    }
  }

  // Aksi Admin: Tolak Pengajuan
  const handleTolakPengajuan = async () => {
    if (!modalTolak) return
    const client = getSupabase()
    try {
      const { error } = await client
        .from('pengajuan_perubahan')
        .update({
          status: 'ditolak',
          catatan_admin: catatanTolak.trim() || 'Pengajuan ditolak oleh Administrator.',
          updated_at: new Date().toISOString()
        })
        .eq('id', modalTolak.id)

      if (error) throw error

      onToast(`Pengajuan perubahan data untuk ${modalTolak.nama_lama} telah ditolak.`, 'info')
      setModalTolak(null)
      setCatatanTolak('')
      fetchRiwayat()
    } catch (err) {
      onToast(err.message || 'Gagal menolak pengajuan.', 'danger')
    }
  }

  // Filter riwayat pengajuan
  const filteredRiwayat = useMemo(() => {
    if (filterStatus === 'semua') return riwayat
    return riwayat.filter(r => (r.status || 'menunggu').toLowerCase() === filterStatus)
  }, [riwayat, filterStatus])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. Header Profil Card */}
      <div className="steam-card" style={{
        padding: '24px',
        background: 'linear-gradient(135deg, rgba(26, 159, 255, 0.12) 0%, rgba(14, 20, 27, 0.95) 100%)',
        border: '1px solid rgba(26, 159, 255, 0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '20px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
          {/* Avatar Inisial */}
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #1a9fff 0%, #0070c9 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: '1.6rem',
            color: '#fff',
            boxShadow: '0 8px 24px rgba(26, 159, 255, 0.4)'
          }}>
            {displayName.slice(0, 2).toUpperCase()}
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                {displayName}
              </h2>
              <span className={`badge badge-${displayRole}`}>
                {displayRole.toUpperCase()}
              </span>
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--cyan-accent)', fontFamily: 'monospace', marginTop: '4px' }}>
              NIK: {displayNik} &bull; @{user?.username || '-'}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              {displayJabatan} &bull; {displayDivisi}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setModalAjukan(true)}
            className="btn btn-primary"
            style={{ padding: '9px 16px', fontSize: '0.85rem' }}
          >
            <Edit3 size={15} />
            <span>Ajukan Perubahan Data</span>
          </button>
          <button
            onClick={onOpenChangePassword}
            className="btn btn-secondary"
            style={{ padding: '9px 16px', fontSize: '0.85rem' }}
          >
            <KeyRound size={15} />
            <span>Ganti Password</span>
          </button>
        </div>
      </div>

      {/* 2. Rincian Informasi Data Diri */}
      <div className="steam-card" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <User size={18} color="var(--cyan-accent)" />
          <span>Informasi Biodata &amp; Akun</span>
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
          {/* NIK */}
          <div style={{ background: 'var(--surface-alt)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
              <IdCard size={15} color="var(--cyan-accent)" />
              <span>Nomor Induk Karyawan (NIK)</span>
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff', fontFamily: 'monospace', marginTop: '6px' }}>
              {displayNik}
            </div>
          </div>

          {/* Nama Lengkap */}
          <div style={{ background: 'var(--surface-alt)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
              <User size={15} color="var(--cyan-accent)" />
              <span>Nama Lengkap</span>
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff', marginTop: '6px' }}>
              {displayName}
            </div>
          </div>

          {/* Jabatan */}
          <div style={{ background: 'var(--surface-alt)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
              <Briefcase size={15} color="var(--cyan-accent)" />
              <span>Jabatan / Posisi</span>
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff', marginTop: '6px' }}>
              {displayJabatan}
            </div>
          </div>

          {/* Divisi */}
          <div style={{ background: 'var(--surface-alt)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
              <Building size={15} color="var(--cyan-accent)" />
              <span>Divisi / Departemen</span>
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff', marginTop: '6px' }}>
              {displayDivisi}
            </div>
          </div>

          {/* Role / Akses */}
          <div style={{ background: 'var(--surface-alt)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
              <Shield size={15} color="var(--cyan-accent)" />
              <span>Tingkat Hak Akses</span>
            </div>
            <div style={{ marginTop: '6px' }}>
              <span className={`badge badge-${displayRole}`} style={{ fontSize: '0.82rem', padding: '4px 10px' }}>
                {displayRole.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Username */}
          <div style={{ background: 'var(--surface-alt)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
              <FileText size={15} color="var(--cyan-accent)" />
              <span>Username Login</span>
            </div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff', fontFamily: 'monospace', marginTop: '6px' }}>
              {user?.username || '-'}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Riwayat & Daftar Pengajuan Perubahan Data */}
      <div className="steam-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={18} color="var(--cyan-accent)" />
              <span>{isAdmin ? 'Seluruh Pengajuan Perubahan Data Karyawan' : 'Riwayat Pengajuan Perubahan Data Anda'}</span>
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              {isAdmin
                ? 'Daftar permohonan pembaruan data biodata yang diajukan oleh staf/karyawan'
                : 'Pantau status permohonan perubahan data yang pernah Anda kirimkan ke admin'}
            </p>
          </div>

          {/* Filter Status */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {['semua', 'menunggu', 'disetujui', 'ditolak'].map(st => (
              <button
                key={st}
                type="button"
                onClick={() => setFilterStatus(st)}
                className="btn btn-secondary btn-sm"
                style={{
                  fontSize: '0.78rem',
                  padding: '5px 12px',
                  background: filterStatus === st ? 'rgba(26, 159, 255, 0.2)' : 'var(--surface-alt)',
                  color: filterStatus === st ? 'var(--cyan-accent)' : 'var(--text-muted)',
                  border: filterStatus === st ? '1px solid var(--cyan-accent)' : '1px solid var(--border)'
                }}
              >
                {st.charAt(0).toUpperCase() + st.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {loadingRiwayat ? (
          <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
            Memuat riwayat pengajuan...
          </div>
        ) : filteredRiwayat.length === 0 ? (
          <div style={{
            background: 'var(--surface-alt)',
            borderRadius: '8px',
            padding: '36px 20px',
            textAlign: 'center',
            color: 'var(--text-muted)',
            border: '1px dashed var(--border)'
          }}>
            <FileText size={32} color="var(--text-dim)" style={{ margin: '0 auto 10px' }} />
            <div style={{ fontSize: '0.9rem', color: '#fff', fontWeight: 600 }}>Belum Ada Pengajuan</div>
            <div style={{ fontSize: '0.78rem', marginTop: '4px' }}>
              {isAdmin
                ? 'Tidak ada permohonan perubahan data dari karyawan saat ini.'
                : 'Anda belum pernah mengajukan perubahan data diri. Klik tombol "Ajukan Perubahan Data" di atas jika ada data yang perlu dikoreksi.'}
            </div>
          </div>
        ) : (
          <div className="table-container">
            <table className="steam-table">
              <thead>
                <tr>
                  <th style={{ width: '130px' }}>Waktu</th>
                  {isAdmin && <th style={{ width: '130px' }}>Pemohon</th>}
                  <th>Data Lama</th>
                  <th>Perubahan Diajukan</th>
                  <th style={{ width: '180px' }}>Alasan</th>
                  <th style={{ width: '120px', textAlign: 'center' }}>Status</th>
                  {isAdmin && <th style={{ width: '130px', textAlign: 'center' }}>Aksi Admin</th>}
                </tr>
              </thead>
              <tbody>
                {filteredRiwayat.map(item => {
                  const isMenunggu = (item.status || 'menunggu').toLowerCase() === 'menunggu'
                  const isDisetujui = item.status === 'disetujui'
                  const isDitolak = item.status === 'ditolak'
                  const tgl = item.created_at ? new Date(item.created_at).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  }) : '-'

                  return (
                    <tr key={item.id}>
                      <td style={{ fontSize: '0.78rem', color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
                        {tgl}
                      </td>

                      {isAdmin && (
                        <td>
                          <div style={{ fontWeight: 600, color: '#fff' }}>{item.nama_lama}</div>
                          <div style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: 'var(--cyan-accent)' }}>
                            {item.nik}
                          </div>
                        </td>
                      )}

                      <td>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          <div>Nama: <strong style={{ color: '#fff' }}>{item.nama_lama}</strong></div>
                          <div>Jabatan: {item.jabatan_lama}</div>
                          <div>Divisi: {item.divisi_lama}</div>
                        </div>
                      </td>

                      <td>
                        <div style={{ fontSize: '0.8rem' }}>
                          <div>Nama: <strong style={{ color: 'var(--cyan-accent)' }}>{item.nama_baru}</strong></div>
                          <div>Jabatan: <strong style={{ color: 'var(--cyan-accent)' }}>{item.jabatan_baru}</strong></div>
                          <div>Divisi: <strong style={{ color: 'var(--cyan-accent)' }}>{item.divisi_baru}</strong></div>
                        </div>
                      </td>

                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        <div>{item.alasan}</div>
                        {item.catatan_admin && (
                          <div style={{ marginTop: '4px', fontSize: '0.72rem', color: isDisetujui ? '#3dd68c' : '#ff5252' }}>
                            Catatan: {item.catatan_admin}
                          </div>
                        )}
                      </td>

                      <td style={{ textAlign: 'center' }}>
                        {isMenunggu && (
                          <span className="badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                            Menunggu
                          </span>
                        )}
                        {isDisetujui && (
                          <span className="badge" style={{ background: 'rgba(61, 214, 140, 0.15)', color: '#3dd68c', border: '1px solid rgba(61, 214, 140, 0.3)' }}>
                            Disetujui
                          </span>
                        )}
                        {isDitolak && (
                          <span className="badge" style={{ background: 'rgba(255, 82, 82, 0.15)', color: '#ff5252', border: '1px solid rgba(255, 82, 82, 0.3)' }}>
                            Ditolak
                          </span>
                        )}
                      </td>

                      {isAdmin && (
                        <td style={{ textAlign: 'center' }}>
                          {isMenunggu ? (
                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                              <button
                                onClick={() => handleSetujuiPengajuan(item)}
                                className="btn btn-primary btn-sm"
                                style={{ padding: '4px 8px', fontSize: '0.72rem', background: '#3dd68c', borderColor: '#3dd68c', color: '#0e141b' }}
                                title="Setujui dan Perbarui Data Karyawan"
                              >
                                <Check size={13} />
                                <span>Setujui</span>
                              </button>
                              <button
                                onClick={() => { setModalTolak(item); setCatatanTolak(''); }}
                                className="btn btn-danger btn-sm"
                                style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                                title="Tolak Pengajuan"
                              >
                                <X size={13} />
                                <span>Tolak</span>
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                              Selesai
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Modal Ajukan Perubahan Data */}
      {modalAjukan && (
        <div className="modal-overlay" onClick={() => setModalAjukan(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit3 size={18} color="var(--cyan-accent)" />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>
                  {isAdmin ? 'Perbarui Data Profil' : 'Form Pengajuan Perubahan Data Diri'}
                </h3>
              </div>
              <button
                onClick={() => setModalAjukan(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitPengajuan}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{
                  background: 'rgba(26, 159, 255, 0.08)',
                  border: '1px solid rgba(26, 159, 255, 0.25)',
                  borderRadius: '6px',
                  padding: '10px 14px',
                  fontSize: '0.78rem',
                  color: 'var(--text-muted)'
                }}>
                  {isAdmin ? (
                    <span>Sebagai <strong>Admin</strong>, perubahan yang Anda simpan akan langsung memperbarui database profil.</span>
                  ) : (
                    <span>Pengajuan perubahan akan ditinjau oleh Administrator. Data profil akan diperbarui setelah permohonan disetujui.</span>
                  )}
                </div>

                {/* NIK Readonly */}
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                    Nomor Induk Karyawan (NIK)
                  </label>
                  <input
                    type="text"
                    value={displayNik}
                    disabled
                    className="input-steam"
                    style={{ background: 'rgba(255, 255, 255, 0.04)', color: 'var(--cyan-accent)', fontFamily: 'monospace' }}
                  />
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '2px', display: 'block' }}>
                    * NIK bersifat tetap dan menjadi identitas unik pegawai.
                  </span>
                </div>

                {/* Nama Lengkap Baru */}
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                    Nama Lengkap Baru
                  </label>
                  <input
                    type="text"
                    required
                    value={formNama}
                    onChange={e => setFormNama(e.target.value)}
                    placeholder="Masukkan nama lengkap baru..."
                    className="input-steam"
                  />
                </div>

                {/* Jabatan Baru */}
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                    Jabatan Baru
                  </label>
                  <input
                    type="text"
                    required
                    value={formJabatan}
                    onChange={e => setFormJabatan(e.target.value)}
                    placeholder="Masukkan jabatan baru..."
                    className="input-steam"
                  />
                </div>

                {/* Divisi Baru */}
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                    Divisi / Unit Kerja Baru
                  </label>
                  <input
                    type="text"
                    required
                    value={formDivisi}
                    onChange={e => setFormDivisi(e.target.value)}
                    placeholder="Masukkan divisi baru..."
                    className="input-steam"
                  />
                </div>

                {/* Alasan Perubahan */}
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                    Alasan / Keterangan Pengajuan
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={formAlasan}
                    onChange={e => setFormAlasan(e.target.value)}
                    placeholder="Contoh: Penyesuaian ejaan nama pada KTP, promosi kenaikan jabatan, atau mutasi divisi..."
                    className="input-steam"
                    style={{ resize: 'vertical' }}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setModalAjukan(false)}
                  className="btn btn-secondary"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary"
                >
                  <Send size={14} />
                  <span>{submitting ? 'Mengirim...' : isAdmin ? 'Simpan Perubahan' : 'Kirim Pengajuan'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Modal Tolak Pengajuan (Admin) */}
      {modalTolak && (
        <div className="modal-overlay" onClick={() => setModalTolak(null)}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#ff5252' }}>
                Tolak Pengajuan Perubahan Data
              </h3>
              <button
                onClick={() => setModalTolak(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Anda akan menolak pengajuan perubahan data dari <strong>{modalTolak.nama_lama}</strong> ({modalTolak.nik}).
              </p>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                  Alasan Penolakan (akan dilihat pemohon):
                </label>
                <textarea
                  rows={3}
                  value={catatanTolak}
                  onChange={e => setCatatanTolak(e.target.value)}
                  placeholder="Contoh: SK mutasi belum terverifikasi oleh bagian HRD..."
                  className="input-steam"
                  style={{ resize: 'vertical' }}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                onClick={() => setModalTolak(null)}
                className="btn btn-secondary"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleTolakPengajuan}
                className="btn btn-danger"
              >
                Tolak Pengajuan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
