'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, RefreshCw, CheckCircle2, AlertCircle, Keyboard } from 'lucide-react';

interface BarcodeScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onScanError?: (error: string) => void;
  fps?: number;
  qrbox?: number | { width: number; height: number };
  title?: string;
  subtitle?: string;
}

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({
  onScanSuccess,
  onScanError,
  fps = 10,
  qrbox = 250,
  title = 'Scan Barcode / QR Code',
  subtitle = 'Arahkan kamera ke barcode ID Card atau barcode gudang',
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [useManual, setUseManual] = useState(false);
  const scannerRef = useRef<any>(null);
  const elementId = useRef(`qr-reader-${Math.random().toString(36).substring(2, 9)}`).current;

  const startScanner = async () => {
    try {
      setErrorMessage(null);
      const { Html5Qrcode } = await import('html5-qrcode');

      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(elementId);
      }

      await scannerRef.current.start(
        { facingMode: 'environment' },
        {
          fps: fps,
          qrbox: typeof qrbox === 'number' ? { width: qrbox, height: qrbox } : qrbox,
          aspectRatio: 1.0,
        },
        (decodedText: string) => {
          setLastScanned(decodedText);
          onScanSuccess(decodedText);
        },
        (err: any) => {
          if (onScanError) onScanError(err);
        }
      );
      setIsScanning(true);
    } catch (err: any) {
      console.error('Scanner start error:', err);
      setErrorMessage(
        err?.message || 'Tidak dapat mengakses kamera. Pastikan izin kamera telah diberikan atau gunakan input manual.'
      );
      setIsScanning(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current && isScanning) {
      try {
        await scannerRef.current.stop();
        setIsScanning(false);
      } catch (err) {
        console.error('Scanner stop error:', err);
      }
    }
  };

  useEffect(() => {
    if (!useManual) {
      startScanner();
    } else {
      stopScanner();
    }

    return () => {
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            scannerRef.current.stop().catch(() => {});
          }
          scannerRef.current.clear();
        } catch (e) {}
      }
    };
  }, [useManual]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      setLastScanned(manualInput.trim());
      onScanSuccess(manualInput.trim());
      setManualInput('');
    }
  };

  return (
    <div className="w-full bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div>
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <Camera className="w-4 h-4 text-teal-600" />
            {title}
          </h3>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => setUseManual(!useManual)}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 flex items-center gap-1.5 text-slate-700 transition"
        >
          {useManual ? <Camera className="w-3.5 h-3.5" /> : <Keyboard className="w-3.5 h-3.5" />}
          {useManual ? 'Gunakan Kamera' : 'Input Manual'}
        </button>
      </div>

      <div className="p-6">
        {!useManual ? (
          <div>
            <div className="relative mx-auto max-w-sm overflow-hidden rounded-xl bg-black aspect-square flex items-center justify-center">
              <div id={elementId} className="w-full h-full" />
              {!isScanning && !errorMessage && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 text-white p-4 text-center">
                  <RefreshCw className="w-8 h-8 text-teal-400 animate-spin mb-3" />
                  <p className="text-sm font-medium">Menyiapkan Kamera Barcode Scanner...</p>
                </div>
              )}
            </div>

            {errorMessage && (
              <div className="mt-4 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Kamera Tidak Tersedia</p>
                  <p className="mt-0.5">{errorMessage}</p>
                  <button
                    onClick={() => setUseManual(true)}
                    className="mt-2 text-teal-700 font-bold underline hover:text-teal-900"
                  >
                    Beralih ke Input Manual Barcode
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleManualSubmit} className="max-w-md mx-auto py-4">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Ketik atau Scan Barcode (Alat Scanner USB/Bluetooth / NIK):
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="Contoh: MBI-1001 atau MEDIKA-WH-MBI-LOC-01"
                autoFocus
                className="flex-1 px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 uppercase tracking-wide font-mono"
              />
              <button
                type="submit"
                className="px-5 py-2.5 bg-teal-600 text-white font-bold text-sm rounded-xl hover:bg-teal-700 transition"
              >
                Scan
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-2">
              Tip: Jika menggunakan barcode gun/scanner handheld, fokuskan kursor pada kotak input di atas lalu tembak barcode.
            </p>
          </form>
        )}

        {lastScanned && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-800 text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>
              Barcode Terdeteksi: <strong className="font-mono">{lastScanned}</strong>
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
