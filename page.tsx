import Link from 'next/link';
import { getAuthSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Building2, QrCode, Clock, ShieldCheck, ArrowRight, CheckCircle2 } from 'lucide-react';
import { WAREHOUSES } from '@/lib/types';

export default async function HomePage() {
  const session = await getAuthSession();
  if (session) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-teal-950 text-white flex flex-col justify-between">
      {/* Top Navbar */}
      <header className="px-6 lg:px-12 py-5 flex items-center justify-between border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500 flex items-center justify-center text-slate-950 font-black text-xl shadow-lg shadow-teal-500/20">
            M
          </div>
          <div>
            <span className="text-xs uppercase font-extrabold tracking-widest text-teal-400 block">
              MEDIKA GROUP
            </span>
            <h1 className="text-lg font-black tracking-tight leading-tight">WFM SYSTEM</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="px-4 py-2 text-xs font-bold text-slate-200 hover:text-white transition"
          >
            Masuk
          </Link>
          <Link
            href="/register"
            className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-teal-600/30"
          >
            Daftar Akun
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-6xl mx-auto px-6 py-16 lg:py-24 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-teal-950/80 border border-teal-500/30 text-teal-300 text-xs font-semibold mb-6">
          <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
          <span>Sistem Workforce Management Terpadu MBI & MAI</span>
        </div>

        <h2 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight max-w-4xl mx-auto leading-tight">
          Absensi Barcode & Manajemen Lembur Gudang Farmasi Medika
        </h2>

        <p className="mt-6 text-base md:text-lg text-slate-300 max-w-2xl mx-auto font-normal">
          Kelola kehadiran shift kerja, scan barcode ID Card, input pengajuan lembur, dan monitoring real-time berbasis cloud Vercel & GitHub Database.
        </p>

        {/* Action Buttons */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/login"
            className="w-full sm:w-auto px-8 py-3.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-extrabold text-sm rounded-xl transition flex items-center justify-center gap-2 shadow-xl shadow-teal-500/20"
          >
            <span>Masuk ke Portal</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/register"
            className="w-full sm:w-auto px-8 py-3.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm rounded-xl border border-slate-700 transition flex items-center justify-center gap-2"
          >
            <span>Registrasi Karyawan Baru</span>
          </Link>
        </div>

        {/* Warehouse Cards Grid */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-6 text-left max-w-4xl mx-auto">
          {/* MBI Card */}
          <div className="p-6 rounded-2xl bg-slate-800/60 border border-sky-500/30 backdrop-blur hover:border-sky-400/60 transition">
            <div className="flex items-center justify-between mb-4">
              <span className="px-3 py-1 rounded-lg text-xs font-black bg-sky-500/20 text-sky-300 border border-sky-500/30">
                GUDANG MBI
              </span>
              <Building2 className="w-5 h-5 text-sky-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Medika Bina Investama</h3>
            <p className="text-xs text-slate-300 mb-4">{WAREHOUSES.MBI.description}</p>
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />
              <span>Barcode ID & Scanner Terintegrasi</span>
            </div>
          </div>

          {/* MAI Card */}
          <div className="p-6 rounded-2xl bg-slate-800/60 border border-purple-500/30 backdrop-blur hover:border-purple-400/60 transition">
            <div className="flex items-center justify-between mb-4">
              <span className="px-3 py-1 rounded-lg text-xs font-black bg-purple-500/20 text-purple-300 border border-purple-500/30">
                GUDANG MAI
              </span>
              <Building2 className="w-5 h-5 text-purple-400" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">Medika Akses Investama</h3>
            <p className="text-xs text-slate-300 mb-4">{WAREHOUSES.MAI.description}</p>
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
              <span>Sistem Lembur & Shift Gudang</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-6 text-center text-xs text-slate-500 border-t border-slate-800/80">
        <p>&copy; 2026 PT Medika Group &bull; WFM System &bull; Powered by Vercel & GitHub Database</p>
      </footer>
    </div>
  );
}
