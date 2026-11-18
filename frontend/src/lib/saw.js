// Algoritma Evaluasi & Penilaian Kinerja Karyawan (SAW Engine)

export function hitungEvaluasiKinerja(karyawanList = [], kriteriaList = [], penilaianList = []) {
  if (!karyawanList.length || !kriteriaList.length) {
    return {
      karyawan: karyawanList,
      kriteria: kriteriaList,
      matriksX: {},
      minMax: {},
      matriksR: {},
      hasilAkhir: [],
      bobotNormal: {},
      totalBobot: 0,
      hasData: false
    }
  }

  // 1. Urutkan kriteria berdasarkan kode (C1, C2, dst)
  const sortedKriteria = [...kriteriaList].sort((a, b) => (a.kode || '').localeCompare(b.kode || ''))

  // 2. Total bobot dan normalisasi w_j
  const totalBobot = sortedKriteria.reduce((acc, k) => acc + (parseFloat(k.bobot) || 0), 0)
  const bobotNormal = {}
  sortedKriteria.forEach(k => {
    const b = parseFloat(k.bobot) || 0
    bobotNormal[k.id] = totalBobot > 0 ? (b / totalBobot) : 0
  })

  // 3. Matriks Keputusan X (x_ij)
  const nilaiDict = {}
  penilaianList.forEach(p => {
    nilaiDict[`${p.karyawan_id}_${p.kriteria_id}`] = parseFloat(p.nilai) || 0.0
  })

  const matriksX = {}
  karyawanList.forEach(k => {
    matriksX[k.id] = {}
    sortedKriteria.forEach(c => {
      matriksX[k.id][c.id] = nilaiDict[`${k.id}_${c.id}`] ?? 0.0
    })
  })

  // 4. Cari Nilai Max/Min per kriteria
  const minMax = {}
  sortedKriteria.forEach(c => {
    const listNilai = karyawanList.map(k => matriksX[k.id][c.id])
    const tipe = (c.tipe || 'benefit').toLowerCase()
    if (tipe === 'benefit') {
      const maxVal = listNilai.length ? Math.max(...listNilai) : 0
      minMax[c.id] = maxVal > 0 ? maxVal : 1.0
    } else {
      // Cost
      const positiveVals = listNilai.filter(n => n > 0)
      const minVal = positiveVals.length ? Math.min(...positiveVals) : 0
      minMax[c.id] = minVal > 0 ? minVal : 1.0
    }
  })

  // 5. Matriks Normalisasi R (r_ij)
  const matriksR = {}
  karyawanList.forEach(k => {
    matriksR[k.id] = {}
    sortedKriteria.forEach(c => {
      const xVal = matriksX[k.id][c.id]
      const tipe = (c.tipe || 'benefit').toLowerCase()
      if (tipe === 'benefit') {
        matriksR[k.id][c.id] = minMax[c.id] > 0 ? (xVal / minMax[c.id]) : 0.0
      } else {
        matriksR[k.id][c.id] = xVal > 0 ? (minMax[c.id] / xVal) : 0.0
      }
    })
  })

  // 6. Nilai Preferensi Skor Akhir V_i = sum(w_j * r_ij)
  const hasilAkhir = karyawanList.map(k => {
    let vi = 0
    sortedKriteria.forEach(c => {
      vi += matriksR[k.id][c.id] * (bobotNormal[c.id] || 0)
    })
    return {
      karyawan: k,
      skor: Math.round(vi * 10000) / 10000,
      skorPersen: Math.round(vi * 1000) / 10
    }
  })

  // Urutkan ranking dari skor tertinggi ke terendah
  hasilAkhir.sort((a, b) => b.skor - a.skor)
  hasilAkhir.forEach((item, idx) => {
    item.rank = idx + 1
  })

  return {
    karyawan: karyawanList,
    kriteria: sortedKriteria,
    matriksX,
    minMax,
    matriksR,
    hasilAkhir,
    bobotNormal,
    totalBobot: Math.round(totalBobot * 100) / 100,
    hasData: karyawanList.length > 0 && sortedKriteria.length > 0
  }
}

