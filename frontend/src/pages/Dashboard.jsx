import React, { useMemo } from 'react'
import { Users, Sliders, ClipboardCheck, Trophy, TrendingUp, Award, ArrowRight, UserCheck, Shield } from 'lucide-react'
import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
)

export default function Dashboard({ data, onNavigate, user }) {
  const { karyawan = [], kriteria = [], penilaian = [], sawResult } = data

  const totalKaryawan = karyawan.length
  const totalKriteria = kriteria.length
  const totalPenilaian = penilaian.length
  const hasilAkhir = sawResult?.hasilAkhir || []

  // Top 3 untuk Podium
  const top1 = hasilAkhir[0]
  const top2 = hasilAkhir[1]
  const top3 = hasilAkhir[2]

  // Top 10 untuk Grafik
  const top10 = useMemo(() => hasilAkhir.slice(0, 10), [hasilAkhir])

  const chartData = useMemo(() => {
    return {
      labels: top10.map(item => item.karyawan.nama),
      datasets: [
        {
          label: 'Skor Kinerja',
          data: top10.map(item => item.skor),
          backgroundColor: 'rgba(26, 159, 255, 0.75)',
          borderColor: '#66c0f4',
          borderWidth: 1.5,
          borderRadius: 6,
          hoverBackgroundColor: '#66c0f4'
        }
      ]
    }
  }, [top10])

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#172433',
        titleColor: '#f0f5fa',
        bodyColor: '#66c0f4',
        borderColor: '#2b425b',
        borderWidth: 1,
        padding: 12,
        displayColors: false,
        callbacks: {
          label: (ctx) => `Skor Kinerja: ${ctx.parsed.y} (Peringkat ${ctx.dataIndex + 1})`
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: '#8ba2b9', font: { size: 11 } }
      },
      y: {
        min: 0,
        max: 1.0,
        grid: { color: 'rgba(34, 53, 74, 0.4)' },
        ticks: { color: '#8ba2b9', font: { size: 11 } }
      }
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Welcome Banner */}
      <div className="steam-card" style={{
        background: 'linear-gradient(135deg, rgba(26, 159, 255, 0.12) 0%, rgba(14, 20, 27, 0.8) 100%)',
        borderColor: 'var(--border-light)',
        padding: '24px 28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff' }}>
              Selamat Datang, {user?.karyawan?.nama || user?.username}!
            </span>
            <span className={`badge badge-${user?.role || 'karyawan'}`}>
              {(user?.role || 'karyawan').toUpperCase()}
            </span>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Sistem evaluasi kinerja karyawan berbasis bobot kriteria terintegrasi database cloud.
          </p>
        </div>

        {user?.role === 'admin' && (
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => onNavigate('karyawan')} className="btn btn-secondary btn-sm">
              <Users size={14} />
              <span>Kelola Karyawan</span>
            </button>
            <button onClick={() => onNavigate('penilaian')} className="btn btn-primary btn-sm">
              <ClipboardCheck size={14} />
              <span>Input Penilaian</span>
            </button>
          </div>
        )}
      </div>

      {/* 4 Stat Cards */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(26, 159, 255, 0.14)', color: 'var(--cyan-accent)' }}>
            <Users size={24} />
          </div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff' }}>
              {totalKaryawan}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total Karyawan</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(167, 139, 250, 0.14)', color: 'var(--purple-atasan)' }}>
            <Sliders size={24} />
          </div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff' }}>
              {totalKriteria}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Kriteria Penilaian</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(61, 214, 140, 0.14)', color: 'var(--success)' }}>
            <ClipboardCheck size={24} />
          </div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff' }}>
              {totalPenilaian}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Nilai Terinput</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.14)', color: 'var(--warning)' }}>
            <Trophy size={24} />
          </div>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff' }}>
              {hasilAkhir.length}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Karyawan Teranking</div>
          </div>
        </div>
      </div>

      {/* Top 3 Podium */}
      {hasilAkhir.length >= 3 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Award size={18} color="#ffd700" />
              <span>Top 3 Kinerja Karyawan Terbaik</span>
            </h2>
            <button onClick={() => onNavigate('hasil')} className="btn btn-secondary btn-sm">
              <span>Lihat Semua Peringkat</span>
              <ArrowRight size={14} />
            </button>
          </div>

          <div className="podium-grid">
            {/* Rank 2 (Silver) */}
            {top2 && (
              <div className="podium-card podium-card-2">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <span className="badge" style={{ background: 'rgba(192, 192, 192, 0.2)', color: '#e0e0e0', borderColor: '#c0c0c0' }}>
                    🥈 Peringkat 2
                  </span>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#c0c0c0' }}>
                    {top2.skor}
                  </div>
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>
                  {top2.karyawan.nama}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {top2.karyawan.jabatan} &bull; {top2.karyawan.divisi}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '8px', fontFamily: 'monospace' }}>
                  NIK: {top2.karyawan.nik}
                </div>
              </div>
            )}

            {/* Rank 1 (Gold) */}
            {top1 && (
              <div className="podium-card podium-card-1" style={{ transform: 'scale(1.02)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <span className="badge" style={{ background: 'rgba(255, 215, 0, 0.2)', color: '#ffd700', borderColor: '#ffd700' }}>
                    👑 Juara 1 (Terbaik)
                  </span>
                  <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#ffd700' }}>
                    {top1.skor}
                  </div>
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', marginBottom: '4px' }}>
                  {top1.karyawan.nama}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  {top1.karyawan.jabatan} &bull; {top1.karyawan.divisi}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '8px', fontFamily: 'monospace' }}>
                  NIK: {top1.karyawan.nik}
                </div>
              </div>
            )}

            {/* Rank 3 (Bronze) */}
            {top3 && (
              <div className="podium-card podium-card-3">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <span className="badge" style={{ background: 'rgba(205, 127, 50, 0.2)', color: '#cd7f32', borderColor: '#cd7f32' }}>
                    🥉 Peringkat 3
                  </span>
                  <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#cd7f32' }}>
                    {top3.skor}
                  </div>
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>
                  {top3.karyawan.nama}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {top3.karyawan.jabatan} &bull; {top3.karyawan.divisi}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '8px', fontFamily: 'monospace' }}>
                  NIK: {top3.karyawan.nik}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Visualisasi Grafik Top 10 */}
      {top10.length > 0 && (
        <div className="steam-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TrendingUp size={18} color="var(--cyan-accent)" />
                <span>Visualisasi Grafik Top 10 Karyawan</span>
              </h3>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Perbandingan nilai skor akumulasi evaluasi kinerja karyawan
              </p>
            </div>
            <span className="badge badge-admin">Skor 0.0 - 1.0</span>
          </div>

          <div style={{ height: '300px', width: '100%' }}>
            <Bar data={chartData} options={chartOptions} />
          </div>
        </div>
      )}

      {/* Alur Cepat Penggunaan Sistem (Hanya Ditampilkan untuk Akun Admin) */}
      {user?.role === 'admin' && (
        <div className="steam-card">
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#fff', marginBottom: '16px' }}>
            Alur Cepat Penggunaan Sistem Perfomax
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div style={{ background: 'var(--surface-alt)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--cyan-accent)', textTransform: 'uppercase' }}>Langkah 1</div>
              <div style={{ fontWeight: 600, color: '#fff', marginTop: '4px' }}>Data Karyawan &amp; Akun</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                Import CSV atau tambah data karyawan, lalu buatkan akun login untuk akses mandiri.
              </div>
            </div>
            <div style={{ background: 'var(--surface-alt)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--cyan-accent)', textTransform: 'uppercase' }}>Langkah 2</div>
              <div style={{ fontWeight: 600, color: '#fff', marginTop: '4px' }}>Kriteria Penilaian</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                Tentukan indikator penilaian dan bobot kepentingan (Benefit/Cost) secara fleksibel.
              </div>
            </div>
            <div style={{ background: 'var(--surface-alt)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--cyan-accent)', textTransform: 'uppercase' }}>Langkah 3</div>
              <div style={{ fontWeight: 600, color: '#fff', marginTop: '4px' }}>Input Nilai Kinerja</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                Admin dan Atasan memasukkan skor evaluasi kinerja berkala setiap karyawan.
              </div>
            </div>
            <div style={{ background: 'var(--surface-alt)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--cyan-accent)', textTransform: 'uppercase' }}>Langkah 4</div>
              <div style={{ fontWeight: 600, color: '#fff', marginTop: '4px' }}>Peringkat &amp; Ekspor</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                Sistem menghitung ranking secara otomatis dan siap diekspor ke Excel atau cetak laporan.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

