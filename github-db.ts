import fs from 'fs';
import path from 'path';
import { GitHubDBConfig, GitHubDBStatus, User, AttendanceRecord, OvertimeRecord } from './types';

// Seed data imports for fallback/initialization
import initialUsers from '@/data/users.json';
import initialAttendance from '@/data/attendance.json';
import initialOvertime from '@/data/overtime.json';

// In-memory cache for serverless environments when filesystem write is restricted
const memoryCache: Record<string, any> = {
  users: initialUsers,
  attendance: initialAttendance,
  overtime: initialOvertime,
};

// Global SHA cache for GitHub operations
const shaCache: Record<string, string> = {};

export function getGitHubConfig(): GitHubDBConfig | null {
  const token = process.env.GITHUB_TOKEN || '';
  const owner = process.env.GITHUB_OWNER || '';
  const repo = process.env.GITHUB_REPO || '';
  const branch = process.env.GITHUB_BRANCH || 'main';
  const dataPath = process.env.GITHUB_DATA_PATH || 'data';

  if (!token || !owner || !repo) {
    return null;
  }

  return { token, owner, repo, branch, dataPath };
}

/**
 * Membaca data koleksi (users, attendance, overtime) dari GitHub atau Local Fallback
 */
export async function getCollection<T>(
  collectionName: 'users' | 'attendance' | 'overtime'
): Promise<T[]> {
  const config = getGitHubConfig();

  if (config) {
    try {
      const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${config.dataPath}/${collectionName}.json?ref=${config.branch}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${config.token}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'Medika-WFM-App',
        },
        cache: 'no-store',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.sha) {
          shaCache[collectionName] = data.sha;
        }
        if (data.content) {
          const decoded = Buffer.from(data.content, 'base64').toString('utf-8');
          const parsed = JSON.parse(decoded);
          memoryCache[collectionName] = parsed;
          return parsed as T[];
        }
      } else if (response.status === 404) {
        // File belum ada di GitHub, gunakan data default dan auto-init
        console.warn(`[GitHub DB] File ${collectionName}.json not found in repo. Using seed data.`);
      } else {
        console.error(`[GitHub DB Error] Failed to fetch ${collectionName}: ${response.statusText}`);
      }
    } catch (err) {
      console.error(`[GitHub DB Exception] Fetching ${collectionName}:`, err);
    }
  }

  // Fallback: Local filesystem jika berjalan di Node.js lokal
  try {
    const localFilePath = path.join(process.cwd(), 'src', 'data', `${collectionName}.json`);
    if (fs.existsSync(localFilePath)) {
      const fileData = fs.readFileSync(localFilePath, 'utf-8');
      return JSON.parse(fileData) as T[];
    }
  } catch (fsErr) {
    // Di Vercel serverless, fs read/write bisa dibatasi, gunakan memory cache
  }

  return (memoryCache[collectionName] || []) as T[];
}

/**
 * Menyimpan data koleksi (users, attendance, overtime) ke GitHub atau Local Fallback
 */
export async function saveCollection<T>(
  collectionName: 'users' | 'attendance' | 'overtime',
  items: T[]
): Promise<{ success: boolean; mode: 'github' | 'local'; message?: string }> {
  // Update memory cache
  memoryCache[collectionName] = items;
  const config = getGitHubConfig();

  if (config) {
    try {
      const contentString = JSON.stringify(items, null, 2);
      const encodedContent = Buffer.from(contentString, 'utf-8').toString('base64');
      const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${config.dataPath}/${collectionName}.json`;

      // Ambil SHA terbaru jika belum ada
      let currentSha = shaCache[collectionName];
      if (!currentSha) {
        const getRes = await fetch(`${url}?ref=${config.branch}`, {
          headers: {
            Authorization: `Bearer ${config.token}`,
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'Medika-WFM-App',
          },
          cache: 'no-store',
        });
        if (getRes.ok) {
          const getJson = await getRes.json();
          currentSha = getJson.sha;
        }
      }

      const bodyPayload: any = {
        message: `Update ${collectionName} via WFM Medika System [skip ci]`,
        content: encodedContent,
        branch: config.branch,
      };

      if (currentSha) {
        bodyPayload.sha = currentSha;
      }

      const putRes = await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${config.token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'Medika-WFM-App',
        },
        body: JSON.stringify(bodyPayload),
      });

      if (putRes.ok) {
        const putJson = await putRes.json();
        if (putJson.content?.sha) {
          shaCache[collectionName] = putJson.content.sha;
        }
        return { success: true, mode: 'github', message: 'Data berhasil disimpan ke GitHub Database' };
      } else {
        const errJson = await putRes.json().catch(() => ({}));
        console.error(`[GitHub DB Save Error]`, errJson);
        // Jika error konflik SHA, reset cache
        if (putRes.status === 409) {
          delete shaCache[collectionName];
        }
      }
    } catch (err) {
      console.error(`[GitHub DB Save Exception]`, err);
    }
  }

  // Fallback: Simpan ke local file jika memungkinkan
  try {
    const localFilePath = path.join(process.cwd(), 'src', 'data', `${collectionName}.json`);
    fs.writeFileSync(localFilePath, JSON.stringify(items, null, 2), 'utf-8');
    return { success: true, mode: 'local', message: 'Data disimpan ke Local Storage' };
  } catch (fsErr) {
    return { success: true, mode: 'local', message: 'Data disimpan ke Session Memory' };
  }
}

/**
 * Cek status koneksi GitHub Database
 */
export async function checkGitHubStatus(): Promise<GitHubDBStatus> {
  const config = getGitHubConfig();

  if (!config) {
    return {
      isConfigured: false,
      isConnected: false,
      mode: 'local_fallback',
      message: 'GitHub Database belum dikonfigurasi. Sistem saat ini berjalan dengan Local Storage.',
    };
  }

  try {
    const res = await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}`, {
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'Medika-WFM-App',
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      return {
        isConfigured: true,
        isConnected: false,
        mode: 'local_fallback',
        owner: config.owner,
        repo: config.repo,
        branch: config.branch,
        message: `Koneksi GitHub gagal (${res.status}): Repository tidak ditemukan atau token tidak memiliki izin.`,
      };
    }

    // Cek file status
    const checkFile = async (name: string) => {
      const fileRes = await fetch(
        `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${config.dataPath}/${name}.json?ref=${config.branch}`,
        {
          headers: {
            Authorization: `Bearer ${config.token}`,
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'Medika-WFM-App',
          },
          cache: 'no-store',
        }
      );
      return fileRes.ok;
    };

    const [usersOk, attendanceOk, overtimeOk] = await Promise.all([
      checkFile('users'),
      checkFile('attendance'),
      checkFile('overtime'),
    ]);

    return {
      isConfigured: true,
      isConnected: true,
      mode: 'github',
      owner: config.owner,
      repo: config.repo,
      branch: config.branch,
      message: 'Terhubung aktif ke GitHub Repository Database!',
      filesStatus: {
        users: usersOk,
        attendance: attendanceOk,
        overtime: overtimeOk,
      },
    };
  } catch (err: any) {
    return {
      isConfigured: true,
      isConnected: false,
      mode: 'local_fallback',
      owner: config.owner,
      repo: config.repo,
      branch: config.branch,
      message: `Error koneksi: ${err?.message || 'Network error'}`,
    };
  }
}

/**
 * Inisialisasi file database di repo GitHub secara otomatis
 */
export async function initializeGitHubRepoFiles(): Promise<{ success: boolean; message: string }> {
  const config = getGitHubConfig();
  if (!config) {
    return { success: false, message: 'Konfigurasi GitHub belum lengkap di environment variable' };
  }

  try {
    await saveCollection('users', initialUsers);
    await saveCollection('attendance', initialAttendance);
    await saveCollection('overtime', initialOvertime);

    return {
      success: true,
      message: 'Inisialisasi tabel database users.json, attendance.json, overtime.json di GitHub berhasil!',
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Gagal inisialisasi: ${err.message}`,
    };
  }
}
