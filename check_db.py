import os
import sys

# 1. Coba baca file .env
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
if os.path.exists(env_path):
    print(f"[INFO] File .env ditemukan di: {env_path}")
    with open(env_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#'):
                if '=' in line:
                    k, v = line.split('=', 1)
                    os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
                elif line.startswith('postgresql://') or line.startswith('postgres://'):
                    os.environ.setdefault('DATABASE_URL', line)
else:
    print("[INFO] File .env TIDAK ditemukan. Mengecek environment variable sistem...")

db_url = os.environ.get('DATABASE_URL')

print("=" * 60)
print("      CEK KONEKSI DATABASE PERFOMAX (SUPABASE / SQLITE)     ")
print("=" * 60)

if db_url:
    # Sensor password agar aman saat dicetak di console
    masked_url = db_url
    if '@' in db_url and '://' in db_url:
        protocol_and_creds, host_part = db_url.split('@', 1)
        if ':' in protocol_and_creds:
            user_part = protocol_and_creds.split(':', 2)[:2]
            masked_url = f"{user_part[0]}:****@{host_part}"
    print(f"[CONFIG] Target DATABASE_URL : {masked_url}")
else:
    print("[CONFIG] DATABASE_URL tidak diatur. Default: SQLite lokal (saw_karyawan.db)")

print("\nSedang menghubungkan ke database...")

try:
    from app import app, db, Karyawan, Kriteria, Penilaian, User
    from sqlalchemy import text

    with app.app_context():
        # Uji koneksi raw SQL
        dialect = db.engine.dialect.name
        
        if dialect == 'postgresql':
            res = db.session.execute(text("SELECT current_database(), version();")).fetchone()
            db_name = res[0]
            version = res[1]
            print("\n" + "=" * 60)
            print(" [BERHASIL] TERKONEKSI KE SUPABASE POSTGRESQL!")
            print("=" * 60)
            print(f"- Dialect       : {dialect}")
            print(f"- Database Name : {db_name}")
            print(f"- Server Host   : {db.engine.url.host}")
            print(f"- PostgreSQL    : {version.split(',')[0]}")
        else:
            print("\n" + "=" * 60)
            print(" [INFO] TERKONEKSI KE SQLITE LOKAL")
            print("=" * 60)
            print(f"- Dialect       : {dialect}")
            print(f"- Lokasi File   : {db.engine.url.database}")
            print("\nCatatan: Jika ingin menyambungkan ke Supabase:")
            print("1. Pastikan sudah membuat file .env berisi DATABASE_URL=postgresql://...")
            print("2. Pastikan sudah install driver: pip install psycopg2-binary")

        # Cek data tabel
        total_karyawan = Karyawan.query.count()
        total_kriteria = Kriteria.query.count()
        total_penilaian = Penilaian.query.count()
        total_users = User.query.count()

        print("\n--- RINGKASAN DATA TABEL ---")
        print(f"* Total Karyawan : {total_karyawan} orang")
        print(f"* Total Kriteria : {total_kriteria} kriteria")
        print(f"* Total Penilaian: {total_penilaian} baris nilai")
        print(f"* Total Akun User: {total_users} akun login")

        if total_karyawan > 0:
            sampel = Karyawan.query.order_by(Karyawan.id.asc()).limit(3).all()
            print("\nSampel 3 Data Teratas:")
            for k in sampel:
                print(f"  - [{k.nik}] {k.nama} ({k.jabatan} - {k.divisi})")

        print("\n[KESIMPULAN] Database aktif dan siap digunakan oleh aplikasi Perfomax!")
        print("=" * 60)

except ImportError as e:
    print("\n" + "!" * 60)
    print(" [GAGAL] Driver PostgreSQL belum terinstal!")
    print("!" * 60)
    print(f"Detail error: {e}")
    print("\nSolusi: Jalankan perintah berikut di terminal/PowerShell:")
    print("   pip install psycopg2-binary")
    print("!" * 60)
    sys.exit(1)

except Exception as e:
    err_str = str(e)
    print("\n" + "!" * 60)
    print(" [GAGAL] Tidak dapat terhubung ke database!")
    print("!" * 60)
    print(f"Pesan Error:\n{err_str}\n")
    print("Kemungkinan penyebab:")
    if "password authentication failed" in err_str.lower():
        print(">> Password database salah. Cek password Anda di Supabase atau klik 'Reset database password' di dashboard Supabase.")
    elif "could not translate host name" in err_str.lower() or "connection refused" in err_str.lower():
        print(">> Host / URL Supabase tidak terjangkau. Periksa koneksi internet Anda atau pastikan URL port 6543 / 5432 sudah benar.")
    elif "database" in err_str.lower() and "does not exist" in err_str.lower():
        print(">> Nama database salah. Di Supabase biasanya nama database adalah 'postgres'.")
    else:
        print(">> Periksa kembali format connection string DATABASE_URL di file .env Anda.")
    print("!" * 60)
    sys.exit(1)

