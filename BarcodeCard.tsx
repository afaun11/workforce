'use client';

import React, { useEffect, useRef } from 'react';
import { User, WAREHOUSES } from '@/lib/types';
import { WarehouseBadge } from './WarehouseBadge';
import { Printer, Download, User as UserIcon } from 'lucide-react';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';

interface BarcodeCardProps {
  user: User;
  showPrintButton?: boolean;
}

export const BarcodeCard: React.FC<BarcodeCardProps> = ({ user, showPrintButton = true }) => {
  const barcodeSvgRef = useRef<SVGSVGElement>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Generate 1D Barcode (Code 128)
    if (barcodeSvgRef.current && user.nik) {
      try {
        JsBarcode(barcodeSvgRef.current, user.nik, {
          format: 'CODE128',
          width: 1.8,
          height: 48,
          displayValue: true,
          font: 'monospace',
          fontSize: 13,
          textMargin: 4,
          margin: 6,
          background: 'transparent',
          lineColor: '#0f172a',
        });
      } catch (err) {
        console.error('Barcode render error:', err);
      }
    }

    // Generate 2D QR Code
    if (qrCanvasRef.current && user.nik) {
      QRCode.toCanvas(
        qrCanvasRef.current,
        user.nik,
        {
          width: 90,
          margin: 1,
          color: {
            dark: '#0f172a',
            light: '#ffffff',
          },
        },
        (err) => {
          if (err) console.error('QR render error:', err);
        }
      );
    }
  }, [user]);

  const handlePrint = () => {
    window.print();
  };

  const isMBI = user.warehouse === 'MBI';
  const warehouseInfo = WAREHOUSES[user.warehouse] || WAREHOUSES.MBI;

  return (
    <div className="flex flex-col items-center">
      {/* ID Card Container */}
      <div
        ref={cardRef}
        className="w-[340px] bg-white rounded-2xl border-2 border-slate-800 shadow-xl overflow-hidden text-slate-800 relative select-none"
      >
        {/* Header Ribbon */}
        <div
          className={`p-4 text-white flex items-center justify-between ${
            isMBI
              ? 'bg-gradient-to-r from-sky-700 to-sky-900'
              : 'bg-gradient-to-r from-purple-700 to-purple-900'
          }`}
        >
          <div>
            <span className="text-[10px] uppercase font-bold tracking-widest text-sky-200 block">
              WORKFORCE MANAGEMENT
            </span>
            <h2 className="font-extrabold text-base tracking-tight flex items-center gap-1.5">
              <span>MEDIKA WFM</span>
            </h2>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-semibold bg-white/20 px-2 py-0.5 rounded text-white inline-block">
              {user.warehouse}
            </span>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-5 flex flex-col items-center text-center">
          {/* Avatar & Photo */}
          <div className="w-20 h-20 rounded-full bg-slate-100 border-4 border-white shadow-md flex items-center justify-center -mt-10 overflow-hidden mb-3">
            <UserIcon className="w-10 h-10 text-slate-400" />
          </div>

          <h3 className="font-bold text-lg text-slate-900 leading-tight">{user.name}</h3>
          <p className="text-xs text-slate-500 font-medium mt-0.5">{user.position}</p>

          <div className="mt-3 flex items-center gap-2">
            <WarehouseBadge warehouse={user.warehouse} size="sm" />
            <span className="text-xs font-mono font-bold bg-slate-100 px-2.5 py-0.5 rounded-md text-slate-700 border border-slate-200">
              {user.nik}
            </span>
          </div>

          <div className="w-full my-4 border-t border-dashed border-slate-200" />

          {/* Barcode & QR Display */}
          <div className="w-full flex items-center justify-between gap-3 bg-slate-50/80 p-3 rounded-xl border border-slate-200/80">
            <div className="flex-1 flex flex-col items-center">
              <svg ref={barcodeSvgRef} className="max-w-full h-auto" />
            </div>
            <div className="flex-shrink-0 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
              <canvas ref={qrCanvasRef} className="rounded" />
            </div>
          </div>

          <p className="text-[10px] text-slate-400 mt-3 text-center">
            {warehouseInfo.fullName} &bull; Kartu Identitas Absensi Resmi
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      {showPrintButton && (
        <div className="mt-4 flex items-center gap-3 no-print">
          <button
            onClick={handlePrint}
            type="button"
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-sm transition"
          >
            <Printer className="w-4 h-4" />
            Cetak ID Card
          </button>
        </div>
      )}
    </div>
  );
};
