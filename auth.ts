import { cookies } from 'next/headers';
import { User } from './types';

const SESSION_COOKIE_NAME = 'wfm_medika_session';

export interface SessionPayload {
  id: string;
  nik: string;
  name: string;
  email: string;
  role: 'admin' | 'karyawan';
  warehouse: 'MBI' | 'MAI';
  position: string;
  barcodeValue: string;
}

export function encodeSession(payload: SessionPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

export function decodeSession(token: string): SessionPayload | null {
  try {
    const jsonStr = Buffer.from(token, 'base64').toString('utf-8');
    return JSON.parse(jsonStr) as SessionPayload;
  } catch {
    return null;
  }
}

export async function setAuthSession(user: User) {
  const cookieStore = cookies();
  const payload: SessionPayload = {
    id: user.id,
    nik: user.nik,
    name: user.name,
    email: user.email,
    role: user.role,
    warehouse: user.warehouse,
    position: user.position,
    barcodeValue: user.barcodeValue,
  };

  const encoded = encodeSession(payload);

  cookieStore.set(SESSION_COOKIE_NAME, encoded, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export async function getAuthSession(): Promise<SessionPayload | null> {
  const cookieStore = cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

  if (!sessionCookie?.value) {
    return null;
  }

  return decodeSession(sessionCookie.value);
}

export async function clearAuthSession() {
  const cookieStore = cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
