'use client';

import React, { useState } from 'react';
import { BarcodeScanner } from './BarcodeScanner';
import { WarehouseBadge } from './WarehouseBadge';
import { WarehouseType, WAREHOUSES } from '@/lib/types';
import { X, CheckCircle, AlertTriangle, User, Clock, ArrowRight, ShieldCheck } from 'lucide-react';
import { formatTimeWIB } from '@/lib/utils';

interface KioskScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const KioskScannerModal: React.FC<KioskScannerModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [selectedWarehouse, setSelectedWarehouse] = useState<WarehouseType>('MBI');
  const [isLoading, setIsLoading] = useState(false);
  const [scanResult, setScanResult] = useState<{
    success: boolean;
    type?: 'check_in' | 'check_out';
    message: string;
    user?: any;
    data?: any;
  } | null>(null);

  if (!isOpen) return null;

  const handleBarcodeScanned = async (barcode: string) => {
    if (isLoading) return;
    setIsLoading(true);
    setScanResult(null);

    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'kiosk_scan',
          barcodeValue: barcode,
          warehouse: selectedWarehouse,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setScanResult({
          success: true,
          type: data.type,
          message: data.message,
          user: data.user,
          data: data.data,
        });
        if (onSuccess) onSuccess();
      } else {
        setScanResult({
          success: false,
          message: data.error || 'Barcode gagal diproses.',
        });
      }
    } catch (err: any) {
      setScanResult({
        success: false,
        message: err.message || 'Koneksi ke server gagal.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-t-3xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg">Kiosk Scanner Pintu Masuk</h3>
              <p className="text-xs text-slate-300">
                Mode Terminal Absensi Otomatis Karyawan (Check-In & Check-Out)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Warehouse Selector */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-4 flex-wrap">
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
            Lokasi Gerbang Gudang:
          </span>
          <div className="flex items-center gap-2">
            {(['MBI', 'MAI'] as WarehouseType[]).map((wh) => (
              <button
                key={wh}
                type="button"
                onClick={() => setSelectedWarehouse(wh)}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  selectedWarehouse === wh
                    ? wh === 'MBI'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'bg-purple-600 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-100'
                }`}
              >
                <span>{wh}</span>
                <span className="text-[10px] opacity-80">({WAREHOUSES[wh].fullName})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          <BarcodeScanner
            onScanSuccess={handleBarcodeScanned}
            title="Scan ID Card Barcode Karyawan"
            subtitle={`Arahkan barcode kartu ID karyawan ke kamera untuk mencatat absensi di Gudang ${selectedWarehouse}`}
          />

          {/* Feedback Card */}
          {scanResult && (
            <div
              className={`p-5 rounded-2xl border transition-all ${
                scanResult.success
                  ? scanResult.type === 'check_in'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                    : 'bg-blue-50 border-blue-300 text-blue-900'
                  : 'bg-rose-50 border-rose-300 text-rose-900'
              }`}
            >
              <div className="flex items-start gap-3">
                {scanResult.success ? (
                  <CheckCircle className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-rose-600 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <h4 className="font-bold text-base">{scanResult.message}</h4>
                  {scanResult.user && (
                    <div className="mt-3 p-3 bg-white/70 rounded-xl border border-slate-200/60 flex items-center justify-between gap-4 text-xs text-slate-800">
                      <div>
                        <p className="font-bold text-sm text-slate-900">{scanResult.user.name}</p>
                        <p className="text-slate-500 font-mono font-medium">
                          NIK: {scanResult.user.nik} &bull; {scanResult.user.position}
                        </p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold text-white ${
                            scanResult.type === 'check_in' ? 'bg-emerald-600' : 'bg-blue-600'
                          }`}
                        >
                          {scanResult.type === 'check_in' ? 'MASUK' : 'KELUAR'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 transition"
          >
            Tutup Terminal
          </button>
        </div>
      </div>
    </div>
  );
};
