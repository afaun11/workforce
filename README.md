# WFM Medika - Sistem Workforce Management Multi-Gudang (MBI & MAI)

Sistem Workforce Management (WFM) modern berbasis Next.js 14+ yang dirancang untuk dijalankan di **Vercel** dengan **GitHub Repository sebagai Database** tanpa perlu database server eksternal seperti SQL/Postgres.

---

## 🌟 Fitur Utama

1. **Autentikasi & Akun**:
   - Menu **Login** & **Daftar Akun** Karyawan Baru.
   - Pilihan Role: Karyawan dan Super Admin / Supervisor.
   - Akun demo instan untuk pengujian cepat.

2. **Pilihan Multi-Gudang (MBI & MAI)**:
   - **MBI**: *PT Medika Bina Investama* (Gudang Pusat Distribusi & Logistik).
   - **MAI**: *PT Medika Akses Investama* (Gudang Suplai & Fast Moving).
   - Filter kehadiran, lembur, dan data staf berdasarkan gudang.

3. **Absensi Barcode (Masuk & Keluar)**:
   - **Absen Masuk (Clock In)** & **Absen Keluar (Clock Out)** via Scanner Kamera atau Input Barcode NIK.
   - Kalkulasi otomatis durasi jam kerja dan status ketepatan waktu (Tepat Waktu vs Terlambat).
   - **Terminal Kiosk Gerbang**: Mode scanner otomatis di pintu masuk gudang untuk scan kartu ID karyawan.

4. **Manajemen & Input Lembur (Overtime)**:
   - Form pengajuan lembur dengan perhitungan otomatis estimasi durasi jam lembur.
   - Workflow persetujuan status: `Pending`, `Disetujui` (Approved), `Ditolak` (Rejected) oleh Admin/Supervisor.

5. **Kartu ID Barcode Digital**:
   - Generator otomatis Barcode 1D (Code128 NIK) dan 2D QR Code untuk setiap staf.
   - Fitur cetak ID Card resmi (Print layout).

6. **Rekapitulasi Laporan & Ekspor CSV**:
   - Rekap absensi dan lembur terintegrasi.
   - Filter multi-gudang MBI/MAI dan tanggal.
   - Tombol 1-klik unduh file CSV (kompatibel dengan Microsoft Excel).

7. **GitHub Repository Database Engine**:
   - Menyimpan seluruh data (`users.json`, `attendance.json`, `overtime.json`) langsung ke repositori GitHub via GitHub REST Contents API.
   - Fallback otomatis ke penyimpanan lokal saat token GitHub belum dipasang.

---

## 🚀 Cara Menjalankan di Lokal (Development)

1. Buka folder proyek di terminal:
   ```bash
   cd wfm-medika
   ```

2. Install dependensi:
   ```bash
   npm install
   ```

3. Jalankan server development:
   ```bash
   npm run dev
   ```

4. Buka di browser:
   `http://localhost:3000`

---

## ☁️ Panduan Deploy ke Vercel

1. Push folder proyek ini ke repository GitHub Anda (misal `wfm-medika-app`).
2. Masuk ke dashboard [Vercel](https://vercel.com) dan klik **Add New Project &rarr; Import Git Repository**.
3. Pada bagian **Environment Variables**, tambahkan:

| Variabel | Contoh Nilai | Keterangan |
|---|---|---|
| `GITHUB_TOKEN` | `ghp_xxxxxxxxxxxxxx` | GitHub Personal Access Token (dengan scope `repo`) |
| `GITHUB_OWNER` | `username-anda` | Username atau Organisasi GitHub |
| `GITHUB_REPO` | `wfm-medika-db` | Nama repo tempat data JSON disimpan |
| `GITHUB_BRANCH` | `main` | Branch default |
| `GITHUB_DATA_PATH` | `data` | Direktori penyimpanan file JSON |
| `JWT_SECRET` | `medika_wfm_secret_key_2026_secure` | Kunci rahasia enkripsi sesi cookie |

4. Klik **Deploy**. Aplikasi siap diakses secara online!

---

## 🔑 Akun Demo Pengujian

| Peran | NIK / Email | Password | Unit Gudang |
|---|---|---|---|
| **Super Admin** | `ADM001` / `admin@medika.com` | `password123` | MBI |
| **Staf Gudang MBI** | `MBI-1001` / `budi@medika.com` | `password123` | MBI (Medika Bina) |
| **Staf Gudang MAI** | `MAI-2001` / `siti@medika.com` | `password123` | MAI (Medika Akses) |

---

&copy; 2026 PT Medika Group &bull; Workforce Management System
