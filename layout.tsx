import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'WFM Medika - Sistem Workforce Management MBI & MAI',
  description: 'Sistem Workforce Management, Absensi Barcode, dan Pengajuan Lembur Gudang Medika Bina Investama (MBI) dan Medika Akses Investama (MAI)',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="bg-slate-50 text-slate-900 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
