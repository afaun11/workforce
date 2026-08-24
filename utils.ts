import { ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format tanggal ke Bahasa Indonesia (Contoh: Senin, 24 Agustus 2026)
 */
export function formatDateIndo(dateStrOrObj: string | Date): string {
  try {
    const date = typeof dateStrOrObj === 'string' ? new Date(dateStrOrObj) : dateStrOrObj;
    return new Intl.DateTimeFormat('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  } catch {
    return String(dateStrOrObj);
  }
}

/**
 * Format jam ke WIB (Contoh: 08:30:15 WIB)
 */
export function formatTimeWIB(dateStrOrObj?: string | Date | null): string {
  if (!dateStrOrObj) return '-';
  try {
    const date = typeof dateStrOrObj === 'string' ? new Date(dateStrOrObj) : dateStrOrObj;
    return new Intl.DateTimeFormat('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(date) + ' WIB';
  } catch {
    return String(dateStrOrObj);
  }
}

/**
 * Format durasi kerja (contoh: 8 jam 30 menit)
 */
export function formatDuration(minutes?: number | null): string {
  if (minutes === undefined || minutes === null) return '-';
  const hours = Math.floor(minutes / 60);
  const remainingMins = Math.round(minutes % 60);
  if (hours === 0) return `${remainingMins} menit`;
  if (remainingMins === 0) return `${hours} jam`;
  return `${hours} jam ${remainingMins} mnt`;
}

/**
 * Hitung selisih jam kerja dalam menit
 */
export function calculateMinutes(startIso: string, endIso: string): number {
  try {
    const start = new Date(startIso).getTime();
    const end = new Date(endIso).getTime();
    const diffMs = end - start;
    return Math.max(0, Math.floor(diffMs / (1000 * 60)));
  } catch {
    return 0;
  }
}

/**
 * Convert array of objects to CSV string & trigger download
 */
export function exportToCSV(filename: string, rows: object[]) {
  if (!rows || !rows.length) return;
  const separator = ',';
  const keys = Object.keys(rows[0]);
  const csvContent =
    keys.join(separator) +
    '\n' +
    rows
      .map((row: any) => {
        return keys
          .map((k) => {
            let cell = row[k] === null || row[k] === undefined ? '' : row[k];
            cell = cell instanceof Date ? cell.toLocaleString('id-ID') : cell.toString();
            cell = cell.replace(/"/g, '""');
            if (cell.search(/("|,|\n)/g) >= 0) {
              cell = `"${cell}"`;
            }
            return cell;
          })
          .join(separator);
      })
      .join('\n');

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
