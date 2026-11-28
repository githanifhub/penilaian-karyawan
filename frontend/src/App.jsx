import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { getSupabase, isSupabaseConfigured } from './lib/supabase'
import { hitungEvaluasiKinerja } from './lib/saw'

// Components
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import ChangePasswordModal from './components/ChangePasswordModal'
import SupabaseConfigModal from './components/SupabaseConfigModal'

// Pages
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Karyawan from './pages/Karyawan'
import Kriteria from './pages/Kriteria'
import Penilaian from './pages/Penilaian'
import Hasil from './pages/Hasil'
import DataDiri from './pages/DataDiri'

function MainLayout() {
  const { user } = useAuth()
  const [currentPage, setCurrentPage] = useState('dashboard')

  // Data State
  const [karyawan, setKaryawan] = useState([])
  const [kriteria, setKriteria] = useState([])
  const [penilaian, setPenilaian] = useState([])
  const [loading, setLoading] = useState(false)

  // Modals & Toast State
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [showSupabaseConfig, setShowSupabaseConfig] = useState(false)
  const [toasts, setToasts] = useState([])

  const addToast = (message, type = 'info') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3500)
  }

  // Fetch all core data from Supabase
  const fetchData = useCallback(async () => {
    const client = getSupabase()
    if (!client) return

    setLoading(true)
    try {
      const [
        { data: rawKaryawan, error: errK },
        { data: rawKriteria, error: errC },
        { data: rawPenilaian, error: errP }
      ] = await Promise.all([
        client.from('karyawan').select('*').order('id', { ascending: false }),
        client.from('kriteria').select('*').order('id', { ascending: false }),
        client.from('penilaian').select('*')
      ])

      if (errK) throw errK
      if (errC) throw errC
      if (errP) throw errP

      setKaryawan(rawKaryawan || [])
      setKriteria(rawKriteria || [])
      setPenilaian(rawPenilaian || [])
    } catch (err) {
      console.error('Error fetching data:', err)
      addToast(err.message || 'Gagal memuat data dari server.', 'danger')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user && isSupabaseConfigured()) {
      fetchData()
    }
  }, [user, fetchData])

  // Evaluasi SAW Kinerja
  const sawResult = useMemo(() => {
    return hitungEvaluasiKinerja(karyawan, kriteria, penilaian)
  }, [karyawan, kriteria, penilaian])

  // If user is not logged in, show Login
  if (!user) {
    return (
      <>
        <Login onOpenSupabaseConfig={() => setShowSupabaseConfig(true)} />
        <SupabaseConfigModal isOpen={showSupabaseConfig} onClose={() => setShowSupabaseConfig(false)} />
      </>
    )
  }

  // Page titles
  const pageMeta = {
    dashboard: { title: 'Dashboard Utama', subtitle: 'Ringkasan evaluasi dan performa karyawan perusahaan' },
    karyawan: { title: 'Manajemen Data Karyawan', subtitle: 'Kelola data karyawan, impor CSV, dan generate akun massal' },
    kriteria: { title: 'Kriteria Penilaian Kinerja', subtitle: 'Atur bobot dan indikator penilaian kinerja (Benefit / Cost)' },
    penilaian: { title: 'Input & Penilaian Kinerja', subtitle: 'Form penilaian berkala karyawan berdasarkan indikator' },
    hasil: { title: 'Hasil & Peringkat Kinerja', subtitle: 'Peringkat akhir evaluasi kinerja karyawan terhitung otomatis' },
    datadiri: { title: 'Data Diri & Profil Pegawai', subtitle: 'Informasi biodata akun dan formulir pengajuan perubahan data' },
  }

  const meta = pageMeta[currentPage] || pageMeta.dashboard

  return (
    <div className="app-container">
      {/* Sidebar */}
      <Sidebar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        onOpenChangePassword={() => setShowChangePassword(true)}
      />

      {/* Main Content Area */}
      <div className="main-content">
        <Topbar
          title={meta.title}
          subtitle={meta.subtitle}
          onRefresh={fetchData}
          loading={loading}
        />

        <main className="content-body">
          {currentPage === 'dashboard' && (
            <Dashboard
              data={{ karyawan, kriteria, penilaian, sawResult }}
              onNavigate={setCurrentPage}
              user={user}
            />
          )}

          {currentPage === 'karyawan' && (
            <Karyawan
              karyawan={karyawan}
              kriteria={kriteria}
              onRefresh={fetchData}
              onToast={addToast}
            />
          )}

          {currentPage === 'kriteria' && (
            <Kriteria
              kriteria={kriteria}
              onRefresh={fetchData}
              onToast={addToast}
            />
          )}

          {currentPage === 'penilaian' && (
            <Penilaian
              karyawan={karyawan}
              kriteria={kriteria}
              penilaian={penilaian}
              onRefresh={fetchData}
              onNavigate={setCurrentPage}
              onToast={addToast}
            />
          )}

          {currentPage === 'hasil' && (
            <Hasil
              data={{ sawResult }}
              user={user}
            />
          )}

          {currentPage === 'datadiri' && (
            <DataDiri
              user={user}
              karyawan={karyawan}
              onRefresh={fetchData}
              onOpenChangePassword={() => setShowChangePassword(true)}
              onToast={addToast}
            />
          )}
        </main>
      </div>

      {/* Forced Change Password if user.must_change_password is true */}
      <ChangePasswordModal
        isOpen={Boolean(user?.must_change_password) || showChangePassword}
        isForced={Boolean(user?.must_change_password)}
        onClose={() => setShowChangePassword(false)}
      />

      {/* Supabase Config Modal */}
      <SupabaseConfigModal
        isOpen={showSupabaseConfig}
        onClose={() => setShowSupabaseConfig(false)}
      />

      {/* Toast Notifications */}
      <div className="toast-container">
        {toasts.map(t => (
          <div
            key={t.id}
            className="toast"
            style={{
              borderLeftColor: t.type === 'success' ? '#3dd68c' : t.type === 'danger' ? '#ff5252' : '#66c0f4'
            }}
          >
            {t.message}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <MainLayout />
    </AuthProvider>
  )
}
