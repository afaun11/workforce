'use client';

import React, { useState } from 'react';
import { User, WarehouseType, WAREHOUSES } from '@/lib/types';
import { WarehouseBadge } from './WarehouseBadge';
import { LogOut, Bell, Shield, User as UserIcon, Building2, Menu, X, QrCode } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { KioskScannerModal } from './KioskScannerModal';

interface NavbarProps {
  user: User | null;
  onToggleSidebar?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ user, onToggleSidebar }) => {
  const router = useRouter();
  const [isKioskOpen, setIsKioskOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <>
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm">
        <div className="px-4 lg:px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onToggleSidebar && (
              <button
                onClick={onToggleSidebar}
                className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 lg:hidden"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-teal-600 flex items-center justify-center text-white font-black text-lg shadow-md shadow-teal-600/20">
                M
              </div>
              <div>
                <h1 className="font-extrabold text-base text-slate-900 leading-none flex items-center gap-1.5">
                  <span>MEDIKA WFM</span>
                  <span className="text-[10px] bg-teal-100 text-teal-800 font-bold px-1.5 py-0.5 rounded">
                    v1.0
                  </span>
                </h1>
                <p className="text-[11px] text-slate-500 font-medium">Workforce & Warehouse Management</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Kiosk Mode Quick Trigger (For entrance scanner) */}
            <button
              onClick={() => setIsKioskOpen(true)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-xl transition shadow-sm"
              title="Buka Terminal Scanner Pintu Masuk"
            >
              <QrCode className="w-4 h-4" />
              <span>Terminal Kiosk Barcode</span>
            </button>

            {/* Warehouse Tag */}
            {user && (
              <div className="hidden md:flex items-center gap-2">
                <WarehouseBadge warehouse={user.warehouse} showFullName size="md" />
              </div>
            )}

            {/* User Profile Pill */}
            {user && (
              <div className="flex items-center gap-3 pl-2 border-l border-slate-200">
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-bold text-slate-800 leading-tight">{user.name}</p>
                  <p className="text-[11px] text-slate-500 font-mono">
                    {user.role === 'admin' ? 'Super Admin' : user.nik}
                  </p>
                </div>
                <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-600 font-bold text-xs">
                  {user.name.charAt(0)}
                </div>
                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition"
                  title="Logout / Keluar"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Terminal Kiosk Modal */}
      <KioskScannerModal
        isOpen={isKioskOpen}
        onClose={() => setIsKioskOpen(false)}
      />
    </>
  );
};
