export type WarehouseType = 'MBI' | 'MAI';

export interface WarehouseInfo {
  code: WarehouseType;
  name: string;
  fullName: string;
  description: string;
  address: string;
  barcodeLocationKey: string;
  color: string;
  bgLight: string;
}

export const WAREHOUSES: Record<WarehouseType, WarehouseInfo> = {
  MBI: {
    code: 'MBI',
    name: 'MBI',
    fullName: 'Medika Bina Investama',
    description: 'Gudang Pusat Distribusi & Logistik Medika Bina Investama',
    address: 'Kawasan Industri Medika Blok B-12, Jakarta',
    barcodeLocationKey: 'MEDIKA-WH-MBI-LOC-01',
    color: '#0284c7',
    bgLight: 'bg-sky-50 text-sky-700 border-sky-200',
  },
  MAI: {
    code: 'MAI',
    name: 'MAI',
    fullName: 'Medika Akses Investama',
    description: 'Gudang Suplai & Fast Moving Medika Akses Investama',
    address: 'Kawasan Logistik Medika Sentra Blok A-08, Tangerang',
    barcodeLocationKey: 'MEDIKA-WH-MAI-LOC-02',
    color: '#7c3aed',
    bgLight: 'bg-purple-50 text-purple-700 border-purple-200',
  },
};

export type UserRole = 'admin' | 'karyawan';

export interface User {
  id: string;
  nik: string;
  name: string;
  email: string;
  password?: string; // plain or hashed
  role: UserRole;
  warehouse: WarehouseType;
  position: string;
  phone?: string;
  barcodeValue: string; // NIK based barcode
  createdAt: string;
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  userNik: string;
  userName: string;
  warehouse: WarehouseType;
  date: string; // YYYY-MM-DD
  checkInTime: string; // ISO String
  checkOutTime?: string; // ISO String
  checkInStatus: 'on_time' | 'late';
  checkOutStatus?: 'normal' | 'early';
  workDurationMinutes?: number;
  checkInMethod: 'barcode_camera' | 'barcode_scanner' | 'manual';
  checkOutMethod?: 'barcode_camera' | 'barcode_scanner' | 'manual';
  locationScanCode?: string;
  notes?: string;
  createdAt: string;
}

export type OvertimeStatus = 'pending' | 'approved' | 'rejected';

export interface OvertimeRecord {
  id: string;
  userId: string;
  userNik: string;
  userName: string;
  warehouse: WarehouseType;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  durationHours: number;
  reason: string;
  status: OvertimeStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  notes?: string;
  createdAt: string;
}

export interface GitHubDBConfig {
  token: string;
  owner: string;
  repo: string;
  branch: string;
  dataPath: string;
}

export interface GitHubDBStatus {
  isConfigured: boolean;
  isConnected: boolean;
  mode: 'github' | 'local_fallback';
  repo?: string;
  owner?: string;
  branch?: string;
  message?: string;
  filesStatus?: {
    users: boolean;
    attendance: boolean;
    overtime: boolean;
  };
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
