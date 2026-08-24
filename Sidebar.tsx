'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  QrCode,
  Clock,
  FileSpreadsheet,
  Contact,
  Users,
  Settings,
  Database,
  Building2,
  ChevronRight,
} from 'lucide-react';
import { User, WAREHOUSES } from '@/lib/types';

interface SidebarProps {
  user: User | null;
  isOpen?: boolean;
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ user, isOpen = true, onClose }) => {
  const pathname = usePathname();
  const isAdmin = user?.role === 'admin';

  const menuItems = [
    {
      label: 'Dashboard',
      href: '/dashboard',
      icon: LayoutDashboard,
      roles: ['admin', 'karyawan'],
    },
    {
      label: 'Absensi Barcode',
      href: '/dashboard/attendance',
      icon: QrCode,
      roles: ['admin', 'karyawan'],
      highlight: true,
    },
    {
      label: 'Pengajuan Lembur',
      href: '/dashboard/overtime',
      icon: Clock,
      roles: ['admin', 'karyawan'],
    },
    {
      label: 'Rekap & Laporan',
      href: '/dashboard/reports',
      icon: FileSpreadsheet,
      roles: ['admin', 'karyawan'],
    },
    {
      label: 'Kartu ID Barcode',
      href: '/dashboard/id-card',
      icon: Contact,
      roles: ['admin', 'karyawan'],
    },
    {
      label: 'Daftar Karyawan',
      href: '/dashboard/employees',
      icon: Users,
      roles: ['admin'],
    },
    {
      label: 'Pengaturan & GitHub DB',
      href: '/dashboard/settings',
      icon: Database,
      roles: ['admin'],
    },
  ];

  const filteredItems = menuItems.filter(
    (item) => !user || item.roles.includes(user.role)
  );

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/40 z-30 lg:hidden backdrop-blur-xs"
        />
      )}

      <aside
        className={`fixed lg:static top-0 bottom-0 left-0 z-40 w-64 bg-slate-900 text-slate-300 flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Sidebar Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-teal-500 flex items-center justify-center text-slate-950 font-black text-base">
              M
            </div>
            <div>
              <h2 className="font-bold text-white text-sm">MEDIKA PORTAL</h2>
              <p className="text-[10px] text-slate-400">MBI & MAI Warehouse</p>
            </div>
          </div>
        </div>

        {/* Warehouse Status Pill in Sidebar */}
        <div className="px-4 py-3 bg-slate-950/60 border-b border-slate-800">
          <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1.5 flex items-center gap-1">
            <Building2 className="w-3 h-3 text-teal-400" />
            Unit Operasional
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            <div className="bg-sky-950/50 border border-sky-800/60 rounded-lg p-1.5 text-center">
              <span className="text-[11px] font-bold text-sky-300 block">MBI</span>
              <span className="text-[9px] text-sky-400/80">Medika Bina</span>
            </div>
            <div className="bg-purple-950/50 border border-purple-800/60 rounded-lg p-1.5 text-center">
              <span className="text-[11px] font-bold text-purple-300 block">MAI</span>
              <span className="text-[9px] text-purple-400/80">Medika Akses</span>
            </div>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {filteredItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                  isActive
                    ? 'bg-teal-600 text-white shadow-md shadow-teal-600/30'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/80'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? 'text-white' : item.highlight ? 'text-teal-400' : 'text-slate-400'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {isActive && <ChevronRight className="w-3.5 h-3.5 text-teal-200" />}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-800 text-center text-[10px] text-slate-500">
          <p className="font-semibold text-slate-400">Medika Workforce v1.0</p>
          <p className="mt-0.5">Vercel & GitHub Database Engine</p>
        </div>
      </aside>
    </>
  );
};
