import os
import io
import csv
import secrets
import string
from functools import wraps
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment
from flask import Flask, render_template, request, redirect, url_for, flash, send_file, jsonify, session
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from sqlalchemy import text

import re
import urllib.parse

def clean_database_url(url: str) -> str:
    url = url.strip().strip('"').strip("'")
    if not url:
        return url
    if url.startswith('postgres://'):
        url = url.replace('postgres://', 'postgresql://', 1)
    # Parse dan rapikan jika ada kurung siku placeholder [password] atau karakter khusus
    match = re.match(r'^(postgres(?:ql)?(?:\+[a-zA-Z0-9_]+)?:\/\/)([^:]+):(.*)@([^@\/]+)(:\d+)?(\/.*)?$', url)
    if match:
        proto, user, password, host, port, path = match.groups()
        if password.startswith('[') and password.endswith(']'):
            password = password[1:-1]
        if '%' not in password:
            password = urllib.parse.quote_plus(password)
        port = port or ''
        path = path or ''
        url = f"{proto}{user}:{password}@{host}{port}{path}"
    return url

# Muat file konfigurasi .env jika tersedia
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
if os.path.exists(env_path):
    with open(env_path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#'):
                if '=' in line:
                    k, v = line.split('=', 1)
                    os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
                elif line.startswith('postgresql://') or line.startswith('postgres://'):
                    os.environ.setdefault('DATABASE_URL', line)

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'perfomax-spk-saw-secret-key-kp-2026')

# Dukungan database Supabase PostgreSQL via DATABASE_URL atau fallback ke SQLite lokal
database_url = os.environ.get('DATABASE_URL')
if database_url:
    database_url = clean_database_url(database_url)
    if database_url.startswith('postgresql://') and not database_url.startswith('postgresql+'):
        try:
            import psycopg2  # type: ignore
            database_url = database_url.replace('postgresql://', 'postgresql+psycopg2://', 1)
        except ImportError:
            pass
    app.config['SQLALCHEMY_DATABASE_URI'] = database_url
    # Optimasi Connection Pool untuk menangani 100+ user bersamaan di Supabase
    app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
        'pool_size': 20,        # Pool koneksi siap pakai
        'max_overflow': 40,     # Cadangan lonjakan traffic (bisa melayani 60 koneksi simultan)
        'pool_timeout': 30,     # Batas waktu tunggu antrean
        'pool_recycle': 300,    # Refresh koneksi setiap 5 menit agar tidak terputus di cloud
        'pool_pre_ping': True,  # Cek kesehatan koneksi sebelum query dijalankan
    }
else:
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///saw_karyawan.db'

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# Cache memori sementara untuk menampung daftar password yang baru di-generate
# (Menghindari batasan cookie 4KB saat generate ratusan akun sekaligus)
GENERATED_ACCOUNTS_CACHE = {}

def get_current_generated_accounts():
    token = session.get('generated_token')
    if token and token in GENERATED_ACCOUNTS_CACHE:
        return GENERATED_ACCOUNTS_CACHE[token]
    return []

# ===================================================
# DATABASE MODELS
# ===================================================

class Karyawan(db.Model):
    __tablename__ = 'karyawan'
    id = db.Column(db.Integer, primary_key=True)
    nik = db.Column(db.String(20), unique=True, nullable=False) # NIP / NIK Karyawan
    nama = db.Column(db.String(100), nullable=False)
    jabatan = db.Column(db.String(100), nullable=False)
    divisi = db.Column(db.String(100), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='karyawan') # 'atasan' atau 'karyawan'
    penilaian = db.relationship('Penilaian', backref='karyawan', cascade='all, delete-orphan', lazy=True)
    user = db.relationship('User', backref=db.backref('karyawan', uselist=False), uselist=False, cascade='all, delete-orphan', lazy=True)

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False) # NIP/NIK untuk pegawai, 'admin' untuk administrator
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), nullable=False, default='karyawan') # 'admin', 'atasan', 'karyawan'
    must_change_password = db.Column(db.Boolean, default=True) # Wajib ganti password pada login pertama
    karyawan_id = db.Column(db.Integer, db.ForeignKey('karyawan.id', ondelete='CASCADE'), nullable=True)

class Kriteria(db.Model):
    __tablename__ = 'kriteria'
    id = db.Column(db.Integer, primary_key=True)
    kode = db.Column(db.String(10), unique=True, nullable=False)
    nama = db.Column(db.String(100), nullable=False)
    tipe = db.Column(db.String(10), nullable=False) # 'benefit' atau 'cost'
    bobot = db.Column(db.Float, nullable=False)
    penilaian = db.relationship('Penilaian', backref='kriteria', cascade='all, delete-orphan', lazy=True)

class Penilaian(db.Model):
    __tablename__ = 'penilaian'
    id = db.Column(db.Integer, primary_key=True)
    karyawan_id = db.Column(db.Integer, db.ForeignKey('karyawan.id'), nullable=False)
    kriteria_id = db.Column(db.Integer, db.ForeignKey('kriteria.id'), nullable=False)
    nilai = db.Column(db.Float, nullable=False, default=0.0)

# ===================================================
# AUTHENTICATION HELPERS & DECORATORS
# ===================================================

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            flash('Silakan login terlebih dahulu untuk mengakses sistem.', 'warning')
            return redirect(url_for('login', next=request.path))
        return f(*args, **kwargs)
    return decorated_function

def role_required(*allowed_roles):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if 'user_id' not in session:
                return redirect(url_for('login', next=request.path))
            user_role = session.get('role', 'karyawan')
            if user_role not in allowed_roles:
                flash(f'Akses ditolak: Menu ini memerlukan hak akses {" / ".join(allowed_roles)}.', 'danger')
                return redirect(url_for('dashboard'))
            return f(*args, **kwargs)
        return decorated_function
    return decorator

def admin_required(f):
    return role_required('admin')(f)

@app.before_request
def enforce_change_password():
    if 'user_id' in session and session.get('must_change_password'):
        allowed = ['ganti_password', 'logout', 'static']
        if request.endpoint and request.endpoint not in allowed:
            flash('Demi keamanan akun, Anda diwajibkan membuat password baru sebelum dapat menggunakan sistem.', 'warning')
            return redirect(url_for('ganti_password'))

@app.context_processor
def inject_user():
    return {
        'current_user': {
            'is_authenticated': 'user_id' in session,
            'id': session.get('user_id'),
            'username': session.get('username'),
            'role': session.get('role'),
            'nama': session.get('nama', 'User'),
            'must_change_password': session.get('must_change_password', False)
        }
    }

# ===================================================
# SAW CALCULATION HELPER
# ===================================================

def hitung_saw():
    karyawan_list = Karyawan.query.all()
    kriteria_list = Kriteria.query.order_by(Kriteria.kode).all()

    if not karyawan_list or not kriteria_list:
        return {
            'karyawan': karyawan_list,
            'kriteria': kriteria_list,
            'matriks_x': {},
            'min_max': {},
            'matriks_r': {},
            'hasil_akhir': [],
            'bobot_normal': {},
            'total_bobot': 0
        }

    # 1. Total bobot dan normalisasi w_j
    total_bobot = sum(k.bobot for k in kriteria_list)
    bobot_normal = {}
    for k in kriteria_list:
        bobot_normal[k.id] = (k.bobot / total_bobot) if total_bobot > 0 else 0

    # 2. Ambil nilai matriks keputusan X (x_ij)
    matriks_x = {karyawan.id: {} for karyawan in karyawan_list}
    semua_penilaian = Penilaian.query.all()
    nilai_dict = {(p.karyawan_id, p.kriteria_id): p.nilai for p in semua_penilaian}

    for karyawan in karyawan_list:
        for kriteria in kriteria_list:
            matriks_x[karyawan.id][kriteria.id] = nilai_dict.get((karyawan.id, kriteria.id), 0.0)

    # 3. Cari Max dan Min untuk tiap kriteria
    min_max = {}
    for kriteria in kriteria_list:
        values = [matriks_x[k.id].get(kriteria.id, 0.0) for k in karyawan_list]
        min_val = min(values) if values else 0.0
        max_val = max(values) if values else 0.0
        min_max[kriteria.id] = {'min': min_val, 'max': max_val}

    # 4. Matriks Normalisasi R (r_ij)
    matriks_r = {karyawan.id: {} for karyawan in karyawan_list}
    for karyawan in karyawan_list:
        for kriteria in kriteria_list:
            x_ij = matriks_x[karyawan.id].get(kriteria.id, 0.0)
            k_min = min_max[kriteria.id]['min']
            k_max = min_max[kriteria.id]['max']

            if kriteria.tipe.lower() == 'benefit':
                r_ij = (x_ij / k_max) if k_max > 0 else 0.0
            else:
                r_ij = (k_min / x_ij) if x_ij > 0 else 0.0

            matriks_r[karyawan.id][kriteria.id] = round(r_ij, 4)

    # 5. Nilai Preferensi V (v_i = sum(w_j * r_ij))
    hasil_akhir = []
    for karyawan in karyawan_list:
        total_skor = 0.0
        rincian_v = {}
        for kriteria in kriteria_list:
            r_ij = matriks_r[karyawan.id].get(kriteria.id, 0.0)
            w_j = bobot_normal.get(kriteria.id, 0.0)
            kontribusi = w_j * r_ij
            rincian_v[kriteria.id] = round(kontribusi, 4)
            total_skor += kontribusi

        hasil_akhir.append({
            'karyawan': karyawan,
            'skor': round(total_skor, 4),
            'rincian_v': rincian_v
        })

    hasil_akhir.sort(key=lambda x: x['skor'], reverse=True)
    for idx, item in enumerate(hasil_akhir, start=1):
        item['ranking'] = idx

    return {
        'karyawan': karyawan_list,
        'kriteria': kriteria_list,
        'matriks_x': matriks_x,
        'min_max': min_max,
        'matriks_r': matriks_r,
        'hasil_akhir': hasil_akhir,
        'bobot_normal': bobot_normal,
        'total_bobot': total_bobot
    }

# ===================================================
# SEED INITIAL DATA & DATABASE MIGRATION
# ===================================================

def inisialisasi_data_default():
    if Kriteria.query.count() == 0 and Karyawan.query.count() == 0:
        kriteria_data = [
            Kriteria(kode='C1', nama='Kedisiplinan & Kehadiran', tipe='benefit', bobot=25.0),
            Kriteria(kode='C2', nama='Kualitas Hasil Kerja', tipe='benefit', bobot=30.0),
            Kriteria(kode='C3', nama='Kerjasama Tim & Komunikasi', tipe='benefit', bobot=20.0),
            Kriteria(kode='C4', nama='Tingkat Keterlambatan / Komplain', tipe='cost', bobot=15.0),
            Kriteria(kode='C5', nama='Inisiatif & Loyalitas', tipe='benefit', bobot=10.0),
        ]
        db.session.add_all(kriteria_data)
        db.session.commit()

        karyawan_data = [
            Karyawan(nik='EMP0001', nama='Ahmad Pratama', jabatan='Senior Programmer / Team Lead', divisi='IT & Development', role='atasan'),
            Karyawan(nik='EMP0002', nama='Citra Lestari', jabatan='UI/UX Designer', divisi='Product Design', role='karyawan'),
            Karyawan(nik='EMP0003', nama='Budi Santoso', jabatan='Finance Manager', divisi='Finance & Accounting', role='atasan'),
            Karyawan(nik='EMP0004', nama='Dewi Anggraeni', jabatan='Marketing Specialist', divisi='Marketing & Sales', role='karyawan'),
            Karyawan(nik='EMP0005', nama='Eko Wicaksono', jabatan='Quality Assurance', divisi='IT & Development', role='karyawan'),
        ]
        db.session.add_all(karyawan_data)
        db.session.commit()

        nilai_sampel = {
            'EMP0001': [85, 90, 88, 10, 85],
            'EMP0002': [90, 85, 92, 5, 80],
            'EMP0003': [80, 82, 75, 15, 78],
            'EMP0004': [95, 88, 85, 8, 90],
            'EMP0005': [88, 86, 80, 12, 82],
        }

        kriteria_map = {k.kode: k.id for k in Kriteria.query.all()}
        karyawan_map = {e.nik: e.id for e in Karyawan.query.all()}
        kodes = ['C1', 'C2', 'C3', 'C4', 'C5']

        for nik, scores in nilai_sampel.items():
            emp_id = karyawan_map[nik]
            for idx, skor in enumerate(scores):
                krit_kode = kodes[idx]
                penilaian = Penilaian(
                    karyawan_id=emp_id,
                    kriteria_id=kriteria_map[krit_kode],
                    nilai=float(skor)
                )
                db.session.add(penilaian)

        db.session.commit()

def init_database_and_admin():
    db.create_all()

    # Migrasi otomatis kolom role pada tabel karyawan jika belum ada (khusus SQLite)
    if db.engine.dialect.name == 'sqlite':
        try:
            cols = [c[1] for c in db.session.execute(text("PRAGMA table_info(karyawan)")).fetchall()]
            if 'role' not in cols:
                db.session.execute(text("ALTER TABLE karyawan ADD COLUMN role VARCHAR(20) DEFAULT 'karyawan'"))
                db.session.commit()
        except Exception:
            db.session.rollback()

    inisialisasi_data_default()

    # Pastikan akun Admin default tersedia
    admin_user = User.query.filter_by(username='admin').first()
    if not admin_user:
        admin_user = User(
            username='admin',
            password_hash=generate_password_hash('admin123'),
            role='admin',
            must_change_password=False
        )
        db.session.add(admin_user)
        db.session.commit()

# ===================================================
# AUTHENTICATION ROUTES (LOGIN, LOGOUT, GANTI PASSWORD)
# ===================================================

@app.route('/login', methods=['GET', 'POST'])
def login():
    if 'user_id' in session:
        if session.get('must_change_password'):
            return redirect(url_for('ganti_password'))
        if session.get('role') == 'admin':
            return redirect(url_for('karyawan'))
        return redirect(url_for('dashboard'))

    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '').strip()

        user = User.query.filter_by(username=username).first()
        if user and check_password_hash(user.password_hash, password):
            session['user_id'] = user.id
            session['username'] = user.username
            session['role'] = user.role
            session['nama'] = user.karyawan.nama if user.karyawan else ('Administrator' if user.role == 'admin' else user.username)
            session['must_change_password'] = user.must_change_password

            # 5. Karyawan/Atasan login pakai NIP + password awal -> wajib ganti password
            if user.must_change_password:
                flash('Login berhasil dengan password awal. Demi keamanan akun, Anda diwajibkan mengganti password baru sekarang.', 'info')
                return redirect(url_for('ganti_password'))

            flash(f'Selamat datang, {session["nama"]}!', 'success')
            next_url = request.form.get('next')
            if next_url and next_url.startswith('/'):
                return redirect(next_url)

            # 1. Admin login -> menu Karyawan
            if user.role == 'admin':
                return redirect(url_for('karyawan'))
            elif user.role == 'atasan':
                return redirect(url_for('penilaian'))
            else:
                return redirect(url_for('hasil'))
        else:
            flash('NIP/Username atau Password tidak cocok. Harap periksa kembali.', 'danger')

    return render_template('login.html')

@app.route('/logout')
def logout():
    session.clear()
    flash('Anda telah berhasil keluar (logout) dari sistem.', 'info')
    return redirect(url_for('login'))

@app.route('/ganti-password', methods=['GET', 'POST'])
@login_required
def ganti_password():
    user = User.query.get(session['user_id'])
    if not user:
        session.clear()
        return redirect(url_for('login'))

    if request.method == 'POST':
        pw_baru = request.form.get('password_baru', '').strip()
        konfirmasi = request.form.get('konfirmasi_password', '').strip()

        if len(pw_baru) < 6:
            flash('Password baru minimal harus 6 karakter!', 'danger')
            return redirect(url_for('ganti_password'))

        if pw_baru != konfirmasi:
            flash('Password baru dan konfirmasi password tidak cocok!', 'danger')
            return redirect(url_for('ganti_password'))

        user.password_hash = generate_password_hash(pw_baru)
        user.must_change_password = False
        db.session.commit()

        session['must_change_password'] = False
        flash('Password berhasil diperbarui! Sekarang akun Anda sudah aman dan dapat digunakan sepenuhnya.', 'success')

        if user.role == 'admin':
            return redirect(url_for('karyawan'))
        elif user.role == 'atasan':
            return redirect(url_for('penilaian'))
        else:
            return redirect(url_for('hasil'))

    return render_template('ganti_password.html')

# ===================================================
# DASHBOARD
# ===================================================

@app.route('/')
@login_required
def dashboard():
    total_karyawan = Karyawan.query.count()
    total_kriteria = Kriteria.query.count()
    total_penilaian = Penilaian.query.count()
    total_atasan = Karyawan.query.filter_by(role='atasan').count()
    total_staff = total_karyawan - total_atasan

    saw_data = hitung_saw()
    hasil_akhir = saw_data['hasil_akhir'] if saw_data['hasil_akhir'] else []
    top_karyawan = hasil_akhir[:3]
    top_10 = hasil_akhir[:10]

    # Data visualisasi grafik kinerja karyawan (Top 10)
    chart_labels = [item['karyawan'].nama for item in top_10]
    chart_scores = [item['skor'] for item in top_10]
    chart_nips = [item['karyawan'].nik for item in top_10]

    # Data bobot kriteria untuk grafik distribusi
    kriteria_labels = [f"{k.kode} ({k.nama})" for k in saw_data['kriteria']]
    kriteria_weights = [round(saw_data['bobot_normal'].get(k.id, 0) * 100, 2) for k in saw_data['kriteria']]

    # Eksekutif metrik
    skor_list = [item['skor'] for item in hasil_akhir]
    skor_tertinggi = max(skor_list) if skor_list else 0.0
    skor_rata_rata = round(sum(skor_list) / len(skor_list), 4) if skor_list else 0.0

    return render_template(
        'dashboard.html',
        total_karyawan=total_karyawan,
        total_kriteria=total_kriteria,
        total_penilaian=total_penilaian,
        total_atasan=total_atasan,
        total_staff=total_staff,
        top_karyawan=top_karyawan,
        top_10=top_10,
        chart_labels=chart_labels,
        chart_scores=chart_scores,
        chart_nips=chart_nips,
        kriteria_labels=kriteria_labels,
        kriteria_weights=kriteria_weights,
        skor_tertinggi=skor_tertinggi,
        skor_rata_rata=skor_rata_rata
    )

# ===================================================
# CRUD KARYAWAN & ACCOUNT GENERATION
# ===================================================

@app.route('/karyawan')
@login_required
def karyawan():
    data_karyawan = Karyawan.query.order_by(Karyawan.nik).all()
    return render_template('karyawan.html', karyawan_list=data_karyawan)

@app.route('/karyawan/tambah', methods=['POST'])
@admin_required
def tambah_karyawan():
    nik = request.form.get('nik', '').strip()
    nama = request.form.get('nama', '').strip()
    jabatan = request.form.get('jabatan', '').strip()
    divisi = request.form.get('divisi', '').strip()
    role = request.form.get('role', 'karyawan').strip().lower()

    if not nik or not nama or not jabatan or not divisi:
        flash('Semua field data karyawan wajib diisi!', 'danger')
        return redirect(url_for('karyawan'))

    existing = Karyawan.query.filter_by(nik=nik).first()
    if existing:
        flash(f'Karyawan dengan NIP/NIK {nik} sudah terdaftar!', 'warning')
        return redirect(url_for('karyawan'))

    baru = Karyawan(nik=nik, nama=nama, jabatan=jabatan, divisi=divisi, role=role)
    db.session.add(baru)
    db.session.commit()

    kriteria_list = Kriteria.query.all()
    for k in kriteria_list:
        db.session.add(Penilaian(karyawan_id=baru.id, kriteria_id=k.id, nilai=0.0))
    db.session.commit()

    flash(f'Data karyawan "{nama}" berhasil ditambahkan.', 'success')
    return redirect(url_for('karyawan'))

@app.route('/karyawan/edit/<int:id>', methods=['POST'])
@admin_required
def edit_karyawan(id):
    emp = Karyawan.query.get_or_404(id)
    nik = request.form.get('nik', '').strip()
    nama = request.form.get('nama', '').strip()
    jabatan = request.form.get('jabatan', '').strip()
    divisi = request.form.get('divisi', '').strip()
    role = request.form.get('role', 'karyawan').strip().lower()

    existing = Karyawan.query.filter(Karyawan.nik == nik, Karyawan.id != id).first()
    if existing:
        flash(f'NIP/NIK {nik} sudah digunakan oleh karyawan lain!', 'danger')
        return redirect(url_for('karyawan'))

    emp.nik = nik
    emp.nama = nama
    emp.jabatan = jabatan
    emp.divisi = divisi
    emp.role = role

    if emp.user:
        emp.user.username = nik
        emp.user.role = role

    db.session.commit()

    flash(f'Data karyawan "{nama}" berhasil diperbarui.', 'success')
    return redirect(url_for('karyawan'))

@app.route('/karyawan/hapus/<int:id>', methods=['POST'])
@admin_required
def hapus_karyawan(id):
    emp = Karyawan.query.get_or_404(id)
    nama = emp.nama
    db.session.delete(emp)
    db.session.commit()
    flash(f'Karyawan "{nama}" berhasil dihapus beserta penilaian dan akunnya.', 'success')
    return redirect(url_for('karyawan'))

# --- 3 & 4. GENERATE PASSWORD & TAMPILKAN/UNDUH SEKALI ---

@app.route('/karyawan/generate-akun', methods=['POST'])
@admin_required
def generate_akun():
    target_role = request.form.get('target_role', 'atasan') # 'atasan' atau 'semua'
    lewati_ada = request.form.get('lewati_ada') == '1'

    if target_role == 'atasan':
        target_karyawan = Karyawan.query.filter_by(role='atasan').all()
    else:
        target_karyawan = Karyawan.query.all()

    if not target_karyawan:
        flash(f'Tidak ditemukan karyawan dengan kriteria target ({target_role}). Silakan pastikan data karyawan sudah tersedia.', 'warning')
        return redirect(url_for('karyawan'))

    chars = string.ascii_letters + string.digits
    generated_list = []
    diproses = 0

    for emp in target_karyawan:
        user = emp.user or User.query.filter_by(username=emp.nik).first()

        if user and lewati_ada:
            continue

        raw_password = ''.join(secrets.choice(chars) for _ in range(8))

        if user:
            user.password_hash = generate_password_hash(raw_password)
            user.role = emp.role
            user.must_change_password = True
        else:
            user = User(
                username=emp.nik,
                password_hash=generate_password_hash(raw_password),
                role=emp.role,
                must_change_password=True,
                karyawan_id=emp.id
            )
            db.session.add(user)

        generated_list.append({
            'nip': emp.nik,
            'nama': emp.nama,
            'jabatan': emp.jabatan,
            'divisi': emp.divisi,
            'role': emp.role,
            'password_awal': raw_password
        })
        diproses += 1

    db.session.commit()

    if generated_list:
        token = secrets.token_hex(16)
        GENERATED_ACCOUNTS_CACHE[token] = generated_list
        session['generated_token'] = token
        flash(f'Berhasil membuat {diproses} akun! Harap segera unduh daftar akun di bawah ini karena password awal hanya ditampilkan satu kali.', 'success')
        return redirect(url_for('daftar_akun_terbuat'))
    else:
        flash('Semua karyawan yang dipilih sudah memiliki akun login. Tidak ada akun baru yang digenerate.', 'info')
        return redirect(url_for('karyawan'))

@app.route('/karyawan/daftar-akun-terbuat')
@admin_required
def daftar_akun_terbuat():
    akun_list = get_current_generated_accounts()
    if not akun_list:
        flash('Daftar password awal telah ditutup atau kedaluwarsa. Password awal tidak dapat dilihat kembali demi alasan keamanan.', 'info')
        return redirect(url_for('karyawan'))
    return render_template('daftar_akun_terbuat.html', akun_list=akun_list)

@app.route('/karyawan/tutup-daftar-akun', methods=['POST'])
@admin_required
def tutup_daftar_akun():
    token = session.pop('generated_token', None)
    if token:
        GENERATED_ACCOUNTS_CACHE.pop(token, None)
    flash('Daftar password awal telah ditutup dan dihapus dari memori server.', 'info')
    return redirect(url_for('karyawan'))

@app.route('/karyawan/unduh-akun-csv')
@admin_required
def unduh_akun_csv():
    akun_list = get_current_generated_accounts()
    if not akun_list:
        flash('Data akun tidak ditemukan dalam sesi.', 'warning')
        return redirect(url_for('karyawan'))

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(['No', 'NIP / Username', 'Nama Lengkap', 'Jabatan', 'Divisi', 'Role', 'Password Awal', 'Keterangan'])
    for idx, item in enumerate(akun_list, start=1):
        writer.writerow([idx, item['nip'], item['nama'], item['jabatan'], item['divisi'], item['role'].title(), item['password_awal'], 'Wajib Ganti Password'])

    output_bytes = io.BytesIO(output.getvalue().encode('utf-8-sig'))
    return send_file(
        output_bytes,
        as_attachment=True,
        download_name="daftar_akun_karyawan_spk.csv",
        mimetype="text/csv"
    )

@app.route('/karyawan/unduh-akun-excel')
@admin_required
def unduh_akun_excel():
    akun_list = get_current_generated_accounts()
    if not akun_list:
        flash('Data akun tidak ditemukan dalam sesi.', 'warning')
        return redirect(url_for('karyawan'))

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Daftar Akun Pengguna"

    header_fill = PatternFill(start_color="4F46E5", end_color="4F46E5", fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    align_center = Alignment(horizontal="center", vertical="center")

    headers = ["No", "NIP / Username", "Nama Lengkap", "Jabatan", "Divisi", "Role", "Password Awal", "Keterangan"]
    ws.append(headers)

    for col_idx in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_idx)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = align_center

    for idx, item in enumerate(akun_list, start=1):
        ws.append([idx, item['nip'], item['nama'], item['jabatan'], item['divisi'], item['role'].title(), item['password_awal'], 'Wajib Ganti Password'])

    for col in ws.columns:
        max_len = max(len(str(cell.value or '')) for cell in col)
        col_letter = openpyxl.utils.get_column_letter(col[0].column)
        ws.column_dimensions[col_letter].width = max(max_len + 4, 14)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    return send_file(
        output,
        as_attachment=True,
        download_name="daftar_akun_karyawan_spk.xlsx",
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )

# ===================================================
# 2. BULK IMPORT CSV & EXCEL (300+ BARIS) & TEMPLATE
# ===================================================

@app.route('/karyawan/template-csv')
def template_csv():
    kriteria_list = Kriteria.query.order_by(Kriteria.kode).all()
    headers = ['NIP', 'Nama Lengkap', 'Jabatan', 'Divisi', 'Role']
    for k in kriteria_list:
        headers.append(k.kode)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(headers)

    sample_rows = [
        ['EMP0001', 'Ahmad Pratama', 'Engineering Manager', 'IT & Development', 'Atasan', 85, 90, 88, 5, 85],
        ['EMP0002', 'Citra Lestari', 'Senior Programmer', 'IT & Development', 'Karyawan', 90, 85, 92, 4, 80],
        ['EMP0003', 'Budi Santoso', 'Finance Manager', 'Finance & Accounting', 'Atasan', 80, 82, 75, 8, 78],
        ['EMP0004', 'Dewi Anggraeni', 'Marketing Specialist', 'Marketing & Sales', 'Karyawan', 95, 88, 85, 2, 90],
        ['EMP0005', 'Eko Wicaksono', 'Quality Assurance', 'IT & Development', 'Karyawan', 88, 86, 80, 6, 82],
    ]
    for r in sample_rows:
        writer.writerow(r[:len(headers)])

    output_bytes = io.BytesIO(output.getvalue().encode('utf-8-sig'))
    return send_file(
        output_bytes,
        as_attachment=True,
        download_name="template_data_karyawan_300.csv",
        mimetype="text/csv"
    )

@app.route('/karyawan/template-excel')
def template_karyawan():
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Data Karyawan"

    header_fill = PatternFill(start_color="4F46E5", end_color="4F46E5", fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    align_center = Alignment(horizontal="center", vertical="center")

    headers = ["NIP", "Nama Lengkap", "Jabatan", "Divisi", "Role"]
    kriteria_list = Kriteria.query.order_by(Kriteria.kode).all()
    for k in kriteria_list:
        headers.append(f"{k.kode} - {k.nama}")

    ws.append(headers)

    for col_idx in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_idx)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = align_center

    contoh_data = [
        ["EMP0001", "Ahmad Pratama", "Engineering Manager", "IT & Development", "Atasan"] + [85, 90, 88, 5, 85][:len(kriteria_list)],
        ["EMP0002", "Citra Lestari", "Senior Programmer", "IT & Development", "Karyawan"] + [90, 85, 92, 4, 80][:len(kriteria_list)],
        ["EMP0003", "Budi Santoso", "Finance Manager", "Finance & Accounting", "Atasan"] + [80, 82, 75, 8, 78][:len(kriteria_list)],
        ["EMP0004", "Dewi Anggraeni", "Marketing Specialist", "Marketing & Sales", "Karyawan"] + [95, 88, 85, 2, 90][:len(kriteria_list)],
        ["EMP0005", "Eko Wicaksono", "Quality Assurance", "IT & Development", "Karyawan"] + [88, 86, 80, 6, 82][:len(kriteria_list)]
    ]
    for row in contoh_data:
        ws.append(row)

    for col in ws.columns:
        max_len = max(len(str(cell.value or '')) for cell in col)
        col_letter = openpyxl.utils.get_column_letter(col[0].column)
        ws.column_dimensions[col_letter].width = max(max_len + 4, 14)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    return send_file(
        output,
        as_attachment=True,
        download_name="template_data_karyawan_300.xlsx",
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )

def parse_uploaded_spreadsheet(file):
    filename = file.filename.lower()
    rows = []
    if filename.endswith('.csv'):
        raw_text = file.stream.read().decode("utf-8-sig", errors="ignore")
        first_line = raw_text.splitlines()[0] if raw_text.splitlines() else ""
        delim = ';' if ';' in first_line and ',' not in first_line else ','
        stream = io.StringIO(raw_text)
        reader = csv.reader(stream, delimiter=delim)
        rows = [list(r) for r in reader if any(str(c).strip() for c in r)]
    else:
        wb = openpyxl.load_workbook(file, data_only=True)
        ws = wb.active
        rows = [list(r) for r in ws.iter_rows(values_only=True) if any(c is not None and str(c).strip() != '' for c in r)]
    return rows

@app.route('/karyawan/preview-import', methods=['POST'])
@admin_required
def preview_import_karyawan():
    file = request.files.get('file_excel')
    if not file or file.filename == '':
        return jsonify({'success': False, 'message': 'Pilih file CSV atau Excel terlebih dahulu!'})

    filename = file.filename.lower()
    if not (filename.endswith('.xlsx') or filename.endswith('.xls') or filename.endswith('.csv')):
        return jsonify({'success': False, 'message': 'Format file tidak didukung! Harap unggah file .csv atau .xlsx'})

    try:
        rows = parse_uploaded_spreadsheet(file)

        if not rows or len(rows) < 2:
            return jsonify({'success': False, 'message': 'File CSV/Excel kosong atau tidak memiliki baris data!'})

        raw_headers = [str(h or '').strip().lower() for h in rows[0]]

        col_nik = None
        col_nama = None
        col_jabatan = None
        col_divisi = None
        col_role = None

        kriteria_list = Kriteria.query.order_by(Kriteria.kode).all()
        kriteria_cols = {}

        for idx, h in enumerate(raw_headers):
            if any(k in h for k in ['nip', 'nik', 'nomor induk', 'no induk', 'id karyawan', 'kode karyawan']) and col_nik is None:
                col_nik = idx
            elif any(k in h for k in ['nama', 'nama lengkap', 'karyawan']) and col_nama is None:
                col_nama = idx
            elif any(k in h for k in ['jabatan', 'posisi', 'role pekerjaan', 'pekerjaan']) and col_jabatan is None:
                col_jabatan = idx
            elif any(k in h for k in ['divisi', 'departemen', 'dept', 'bagian', 'unit']) and col_divisi is None:
                col_divisi = idx
            elif any(k in h for k in ['role', 'peran', 'tipe role', 'tingkatan', 'hak akses']) and col_role is None:
                col_role = idx

            for k in kriteria_list:
                if k.kode.lower() in h or k.nama.lower() in h:
                    kriteria_cols[k.id] = idx

        if col_nama is None and len(raw_headers) >= 2:
            col_nik = 0 if col_nik is None else col_nik
            col_nama = 1
            col_jabatan = 2 if len(raw_headers) > 2 else None
            col_divisi = 3 if len(raw_headers) > 3 else None
            col_role = 4 if len(raw_headers) > 4 else None

        if col_nama is None:
            return jsonify({'success': False, 'message': 'Kolom "Nama Lengkap" tidak terdeteksi dalam file CSV/Excel.'})

        # Bulk pre-fetch existing NIK untuk efisiensi data 300+ baris
        existing_niks = set(k[0] for k in db.session.query(Karyawan.nik).all())

        data_preview = []
        count_baru = 0
        count_update = 0

        for row_idx, row in enumerate(rows[1:], start=2):
            nik_val = str(row[col_nik]).strip() if (col_nik is not None and col_nik < len(row) and row[col_nik] is not None) else ''
            nama_val = str(row[col_nama]).strip() if (col_nama < len(row) and row[col_nama] is not None) else ''

            if not nama_val:
                continue

            if not nik_val:
                nik_val = f"EMP{row_idx:04d}"

            jabatan_val = str(row[col_jabatan]).strip() if (col_jabatan is not None and col_jabatan < len(row) and row[col_jabatan] is not None) else 'Staff'
            divisi_val = str(row[col_divisi]).strip() if (col_divisi is not None and col_divisi < len(row) and row[col_divisi] is not None) else 'Umum'

            # Role detection
            role_val = 'karyawan'
            if col_role is not None and col_role < len(row) and row[col_role] is not None:
                raw_r = str(row[col_role]).strip().lower()
                if any(x in raw_r for x in ['atasan', 'manager', 'lead', 'supervisor', 'kepala']):
                    role_val = 'atasan'
            else:
                if any(x in jabatan_val.lower() for x in ['manager', 'kepala', 'supervisor', 'lead', 'atasan', 'kabag', 'koordinator']):
                    role_val = 'atasan'

            if nik_val in existing_niks:
                status = 'update'
                count_update += 1
            else:
                status = 'baru'
                count_baru += 1

            scores = {}
            for k in kriteria_list:
                c_idx = kriteria_cols.get(k.id)
                if c_idx is not None and c_idx < len(row) and row[c_idx] is not None:
                    try:
                        scores[k.kode] = float(row[c_idx])
                    except (ValueError, TypeError):
                        scores[k.kode] = 0.0
                else:
                    scores[k.kode] = '-'

            data_preview.append({
                'no': len(data_preview) + 1,
                'nik': nik_val,
                'nama': nama_val,
                'jabatan': jabatan_val,
                'divisi': divisi_val,
                'role': role_val,
                'status': status,
                'scores': scores
            })

        return jsonify({
            'success': True,
            'total': len(data_preview),
            'baru': count_baru,
            'update': count_update,
            'kriteria': [{'kode': k.kode, 'nama': k.nama} for k in kriteria_list],
            'rows': data_preview
        })

    except Exception as e:
        return jsonify({'success': False, 'message': f'Gagal membaca file: {str(e)}'})

@app.route('/karyawan/import', methods=['POST'])
@admin_required
def import_karyawan():
    file = request.files.get('file_excel')
    if not file or file.filename == '':
        flash('Pilih file CSV atau Excel terlebih dahulu!', 'danger')
        return redirect(url_for('karyawan'))

    filename = file.filename.lower()
    if not (filename.endswith('.xlsx') or filename.endswith('.xls') or filename.endswith('.csv')):
        flash('Format file tidak didukung! Harap unggah file .csv atau .xlsx', 'danger')
        return redirect(url_for('karyawan'))

    try:
        rows = parse_uploaded_spreadsheet(file)

        if not rows or len(rows) < 2:
            flash('File CSV/Excel kosong atau tidak memiliki baris data!', 'warning')
            return redirect(url_for('karyawan'))

        raw_headers = [str(h or '').strip().lower() for h in rows[0]]

        col_nik = None
        col_nama = None
        col_jabatan = None
        col_divisi = None
        col_role = None

        kriteria_list = Kriteria.query.order_by(Kriteria.kode).all()
        kriteria_cols = {}

        for idx, h in enumerate(raw_headers):
            if any(k in h for k in ['nip', 'nik', 'nomor induk', 'no induk', 'id karyawan', 'kode karyawan']) and col_nik is None:
                col_nik = idx
            elif any(k in h for k in ['nama', 'nama lengkap', 'karyawan']) and col_nama is None:
                col_nama = idx
            elif any(k in h for k in ['jabatan', 'posisi', 'role pekerjaan', 'pekerjaan']) and col_jabatan is None:
                col_jabatan = idx
            elif any(k in h for k in ['divisi', 'departemen', 'dept', 'bagian', 'unit']) and col_divisi is None:
                col_divisi = idx
            elif any(k in h for k in ['role', 'peran', 'tipe role', 'tingkatan', 'hak akses']) and col_role is None:
                col_role = idx

            for k in kriteria_list:
                if k.kode.lower() in h or k.nama.lower() in h:
                    kriteria_cols[k.id] = idx

        if col_nama is None and len(raw_headers) >= 2:
            col_nik = 0 if col_nik is None else col_nik
            col_nama = 1
            col_jabatan = 2 if len(raw_headers) > 2 else None
            col_divisi = 3 if len(raw_headers) > 3 else None
            col_role = 4 if len(raw_headers) > 4 else None

        if col_nama is None:
            flash('Gagal mengenali kolom "Nama" dalam file CSV/Excel. Silakan gunakan template yang tersedia.', 'danger')
            return redirect(url_for('karyawan'))

        # Bulk pre-fetching dalam memori untuk kecepatan pemrosesan 300+ baris data
        karyawan_dict = {k.nik: k for k in Karyawan.query.all()}
        semua_penilaian = Penilaian.query.all()
        penilaian_dict = {(p.karyawan_id, p.kriteria_id): p for p in semua_penilaian}

        ditambahkan = 0
        diperbarui = 0

        for row_idx, row in enumerate(rows[1:], start=2):
            nik_val = str(row[col_nik]).strip() if (col_nik is not None and col_nik < len(row) and row[col_nik] is not None) else ''
            nama_val = str(row[col_nama]).strip() if (col_nama < len(row) and row[col_nama] is not None) else ''

            if not nama_val:
                continue

            if not nik_val:
                nik_val = f"EMP{row_idx:04d}"

            jabatan_val = str(row[col_jabatan]).strip() if (col_jabatan is not None and col_jabatan < len(row) and row[col_jabatan] is not None) else 'Staff'
            divisi_val = str(row[col_divisi]).strip() if (col_divisi is not None and col_divisi < len(row) and row[col_divisi] is not None) else 'Umum'

            role_val = 'karyawan'
            if col_role is not None and col_role < len(row) and row[col_role] is not None:
                raw_r = str(row[col_role]).strip().lower()
                if any(x in raw_r for x in ['atasan', 'manager', 'lead', 'supervisor', 'kepala']):
                    role_val = 'atasan'
            else:
                if any(x in jabatan_val.lower() for x in ['manager', 'kepala', 'supervisor', 'lead', 'atasan', 'kabag', 'koordinator']):
                    role_val = 'atasan'

            emp = karyawan_dict.get(nik_val)
            if emp:
                emp.nama = nama_val
                emp.jabatan = jabatan_val
                emp.divisi = divisi_val
                emp.role = role_val
                if emp.user:
                    emp.user.role = role_val
                diperbarui += 1
            else:
                emp = Karyawan(nik=nik_val, nama=nama_val, jabatan=jabatan_val, divisi=divisi_val, role=role_val)
                db.session.add(emp)
                db.session.flush() # Mendapatkan emp.id
                karyawan_dict[nik_val] = emp
                ditambahkan += 1

            for k in kriteria_list:
                c_idx = kriteria_cols.get(k.id)
                skor_val = 0.0
                if c_idx is not None and c_idx < len(row) and row[c_idx] is not None:
                    try:
                        skor_val = float(row[c_idx])
                    except (ValueError, TypeError):
                        skor_val = 0.0

                pen = penilaian_dict.get((emp.id, k.id))
                if pen:
                    if c_idx is not None:
                        pen.nilai = skor_val
                else:
                    pen_baru = Penilaian(karyawan_id=emp.id, kriteria_id=k.id, nilai=skor_val)
                    db.session.add(pen_baru)
                    penilaian_dict[(emp.id, k.id)] = pen_baru

        db.session.commit()
        flash(f'Import massal berhasil! {ditambahkan} karyawan baru ditambahkan, {diperbarui} data diperbarui.', 'success')

    except Exception as e:
        db.session.rollback()
        flash(f'Terjadi kesalahan saat memproses file import: {str(e)}', 'danger')

    return redirect(url_for('karyawan'))

@app.route('/karyawan/export')
@login_required
def export_karyawan():
    karyawan_list = Karyawan.query.order_by(Karyawan.nik).all()
    kriteria_list = Kriteria.query.order_by(Kriteria.kode).all()

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Data Karyawan & Penilaian"

    header_fill = PatternFill(start_color="10B981", end_color="10B981", fill_type="solid")
    header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
    align_center = Alignment(horizontal="center", vertical="center")

    headers = ["No", "NIP / NIK", "Nama Lengkap", "Jabatan", "Divisi", "Role"]
    for k in kriteria_list:
        headers.append(f"{k.kode} ({k.nama}) [{k.tipe.upper()}]")

    ws.append(headers)

    for col_idx in range(1, len(headers) + 1):
        cell = ws.cell(row=1, column=col_idx)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = align_center

    semua_penilaian = Penilaian.query.all()
    nilai_dict = {(p.karyawan_id, p.kriteria_id): p.nilai for p in semua_penilaian}

    for idx, emp in enumerate(karyawan_list, start=1):
        row_data = [idx, emp.nik, emp.nama, emp.jabatan, emp.divisi, emp.role.title()]
        for k in kriteria_list:
            row_data.append(nilai_dict.get((emp.id, k.id), 0.0))
        ws.append(row_data)

    for col in ws.columns:
        max_len = max(len(str(cell.value or '')) for cell in col)
        col_letter = openpyxl.utils.get_column_letter(col[0].column)
        ws.column_dimensions[col_letter].width = max(max_len + 4, 12)

    output = io.BytesIO()
    wb.save(output)
    output.seek(0)

    return send_file(
        output,
        as_attachment=True,
        download_name="export_data_karyawan_perfomax.xlsx",
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )

# ===================================================
# CRUD KRITERIA
# ===================================================

@app.route('/kriteria')
@login_required
def kriteria():
    data_kriteria = Kriteria.query.order_by(Kriteria.kode).all()
    total_bobot = sum(k.bobot for k in data_kriteria)
    return render_template('kriteria.html', kriteria_list=data_kriteria, total_bobot=total_bobot)

@app.route('/kriteria/tambah', methods=['POST'])
@admin_required
def tambah_kriteria():
    kode = request.form.get('kode', '').strip().upper()
    nama = request.form.get('nama', '').strip()
    tipe = request.form.get('tipe', '').strip().lower()
    bobot_str = request.form.get('bobot', '').strip()

    try:
        bobot = float(bobot_str)
    except ValueError:
        flash('Bobot harus berupa angka numerik!', 'danger')
        return redirect(url_for('kriteria'))

    existing = Kriteria.query.filter_by(kode=kode).first()
    if existing:
        flash(f'Kriteria dengan kode {kode} sudah ada!', 'warning')
        return redirect(url_for('kriteria'))

    baru = Kriteria(kode=kode, nama=nama, tipe=tipe, bobot=bobot)
    db.session.add(baru)
    db.session.commit()

    karyawan_list = Karyawan.query.all()
    for emp in karyawan_list:
        db.session.add(Penilaian(karyawan_id=emp.id, kriteria_id=baru.id, nilai=0.0))
    db.session.commit()

    flash(f'Kriteria "{nama}" ({kode}) berhasil ditambahkan.', 'success')
    return redirect(url_for('kriteria'))

@app.route('/kriteria/edit/<int:id>', methods=['POST'])
@admin_required
def edit_kriteria(id):
    krit = Kriteria.query.get_or_404(id)
    kode = request.form.get('kode', '').strip().upper()
    nama = request.form.get('nama', '').strip()
    tipe = request.form.get('tipe', '').strip().lower()
    bobot_str = request.form.get('bobot', '').strip()

    try:
        bobot = float(bobot_str)
    except ValueError:
        flash('Bobot harus berupa angka numerik!', 'danger')
        return redirect(url_for('kriteria'))

    existing = Kriteria.query.filter(Kriteria.kode == kode, Kriteria.id != id).first()
    if existing:
        flash(f'Kode kriteria {kode} sudah digunakan kriteria lain!', 'danger')
        return redirect(url_for('kriteria'))

    krit.kode = kode
    krit.nama = nama
    krit.tipe = tipe
    krit.bobot = bobot
    db.session.commit()

    flash(f'Kriteria "{nama}" ({kode}) berhasil diperbarui.', 'success')
    return redirect(url_for('kriteria'))

@app.route('/kriteria/hapus/<int:id>', methods=['POST'])
@admin_required
def hapus_kriteria(id):
    krit = Kriteria.query.get_or_404(id)
    nama = krit.nama
    db.session.delete(krit)
    db.session.commit()
    flash(f'Kriteria "{nama}" berhasil dihapus.', 'success')
    return redirect(url_for('kriteria'))

# ===================================================
# MATRIKS PENILAIAN (ADMIN & ATASAN)
# ===================================================

@app.route('/penilaian')
@role_required('admin', 'atasan')
def penilaian():
    karyawan_list = Karyawan.query.order_by(Karyawan.nik).all()
    kriteria_list = Kriteria.query.order_by(Kriteria.kode).all()

    semua_penilaian = Penilaian.query.all()
    nilai_dict = {(p.karyawan_id, p.kriteria_id): p.nilai for p in semua_penilaian}

    matriks_nilai = {}
    for emp in karyawan_list:
        matriks_nilai[emp.id] = {}
        for krit in kriteria_list:
            matriks_nilai[emp.id][krit.id] = nilai_dict.get((emp.id, krit.id), 0.0)

    return render_template(
        'penilaian.html',
        karyawan_list=karyawan_list,
        kriteria_list=kriteria_list,
        matriks_nilai=matriks_nilai
    )

@app.route('/penilaian/simpan', methods=['POST'])
@role_required('admin', 'atasan')
def simpan_penilaian():
    karyawan_list = Karyawan.query.all()
    kriteria_list = Kriteria.query.all()

    semua_penilaian = Penilaian.query.all()
    pen_dict = {(p.karyawan_id, p.kriteria_id): p for p in semua_penilaian}

    for emp in karyawan_list:
        for krit in kriteria_list:
            field_name = f'nilai_{emp.id}_{krit.id}'
            nilai_str = request.form.get(field_name, '').strip()
            try:
                nilai = float(nilai_str) if nilai_str else 0.0
            except ValueError:
                nilai = 0.0

            pen = pen_dict.get((emp.id, krit.id))
            if pen:
                pen.nilai = nilai
            else:
                db.session.add(Penilaian(karyawan_id=emp.id, kriteria_id=krit.id, nilai=nilai))

    db.session.commit()
    flash('Seluruh nilai penilaian alternatif berhasil disimpan!', 'success')
    return redirect(url_for('penilaian'))

# ===================================================
# HASIL & PERANGKINGAN SAW
# ===================================================

@app.route('/hasil')
@login_required
def hasil():
    saw_data = hitung_saw()
    return render_template('hasil.html', saw=saw_data)

# ===================================================
# RESET DATA KE DEFAULT
# ===================================================

@app.route('/reset-data', methods=['POST'])
@admin_required
def reset_data():
    User.query.filter(User.role != 'admin').delete()
    Penilaian.query.delete()
    Karyawan.query.delete()
    Kriteria.query.delete()
    db.session.commit()
    inisialisasi_data_default()
    flash('Data berhasil di-reset ke sample data default.', 'info')
    return redirect(url_for('dashboard'))

# ===================================================
# MAIN ENTRY POINT
# ===================================================

if __name__ == '__main__':
    with app.app_context():
        init_database_and_admin()
        dialect = db.engine.dialect.name
        print("\n" + "=" * 55)
        if dialect == 'postgresql':
            print(" [STATUS] PERFOMAX TERHUBUNG KE SUPABASE (POSTGRESQL)")
            print(f" Host: {db.engine.url.host} | DB: {db.engine.url.database}")
            print(f" Data: {Karyawan.query.count()} Karyawan | {User.query.count()} Users")
        else:
            print(" [STATUS] PERFOMAX MENGGUNAKAN SQLITE LOKAL")
            print(" File: instance/saw_karyawan.db")
            print(" (Jika ingin beralih ke Supabase, isi DATABASE_URL di .env)")
        print("=" * 55 + "\n")
    app.run(debug=True, host='127.0.0.1', port=5000)
