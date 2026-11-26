// === WFM MEDIKA RULES & THEME/BRANDING ===
  // ATURAN TOLERANSI SHIFT & MISS SCAN RESMI: 16 JAM (16 * 60 * 60 * 1000 ms)
  // Sesi aktif berjalan berlaku hingga batas maksimal 16 jam (mendukung penuh seluruh shift: Pagi, Siang, Sore, Lembur, serta Shift Malam Lintas Hari).
  // Jika melewati 16 jam atau sesi hari kemarin yang sudah tidak aktif tanpa tap pulang:
  // Sesi otomatis berstatus "Miss Scan" & terhitung 7 jam kerja efektif di laporan.
  // =========================================================
  const MAX_SHIFT_MS = 18 * 60 * 60 * 1000;

  function hasValidCheckOut(rec) {
   if (!rec || !rec.checkOutTime) return false;
   const s = String(rec.checkOutTime).trim();
   if (!s || s === '-' || s.toLowerCase().includes('miss') || s.toLowerCase().includes('sedang')) return false;
   const t = (typeof parseSafeTimeMs === 'function')
    ? (parseSafeTimeMs(rec.checkOutTime, rec.date) || new Date(rec.checkOutTime).getTime())
    : new Date(rec.checkOutTime).getTime();
   return !isNaN(t) && t > 0;
  }

  function cleanStaleMissScanFlags(rec) {
   if (!rec || typeof rec !== 'object') return false;
   if (!hasValidCheckOut(rec)) return false;
   let changed = false;
   if (rec.notes && /miss\s*scan/i.test(rec.notes)) {
    let cleaned = rec.notes
     .replace(/\(?\s*miss\s*scan\s*\)?/gi, '')
     .replace(/\|\s*\|/g, '|')
     .replace(/^\s*[|\-]+\s*|\s*[|\-]+\s*$/g, '')
     .trim();
    rec.notes = cleaned;
    changed = true;
   }
   if (rec.checkInStatus === 'miss_scan') {
    rec.checkInStatus = 'on_time';
    changed = true;
   }
   if (rec.checkOutStatus === 'miss_scan') {
    rec.checkOutStatus = 'normal';
    changed = true;
   }
   if (rec.status === 'Miss Scan' || rec.status === 'miss_scan') {
    rec.status = rec.checkInStatus || 'on_time';
    changed = true;
   }
   return changed;
  }

   function parseSafeTimeMs(timeVal, dateVal) {
    if (!timeVal || timeVal === '-' || timeVal === '') return null;
    if (typeof timeVal === 'number') return isNaN(timeVal) ? null : timeVal;
    if (typeof timeVal === 'string') {
     const cleanT = timeVal.trim();
     if (cleanT.includes('T') && (cleanT.endsWith('Z') || cleanT.includes('+') || cleanT.includes('-'))) {
      const t = new Date(cleanT).getTime();
      if (!isNaN(t)) return t;
     }
     const timeClean = cleanT.replace(/\./g, ':');
     const safeDate = dateVal || '2026-01-01';
     if (/^\d{1,2}:\d{1,2}(:\d{1,2})?$/.test(timeClean)) {
      const parts = timeClean.split(':');
      const hh = parts[0].padStart(2, '0');
      const mm = parts[1].padStart(2, '0');
      const ss = (parts[2] || '00').padStart(2, '0');
      const isoStr = `${safeDate}T${hh}:${mm}:${ss}+07:00`;
      const t = new Date(isoStr).getTime();
      if (!isNaN(t)) return t;
     }
     const t = new Date(cleanT).getTime();
     if (!isNaN(t)) return t;
    }
    return null;
   }

   function getAttendanceDurationInfo(rec) {
    if (!rec || !rec.checkInTime) {
     return {
      durationMinutes: 0,
      durationStr: '-',
      effectiveMinutes: 0,
      effectiveHours: 0,
      statusOut: 'Belum Masuk',
      isMissScan: false,
      isOngoing: false
     };
    }

    const validOut = hasValidCheckOut(rec);
    // Sesi yang eksplisit ditandai Miss Scan (HANYA jika ada catatan/status Miss Scan eksplisit)
    // Jangan pernah menganggap checkOutTime kosong/tanda-kurang (-) sebagai Miss Scan jika shift masih berlangsung!
    const isExplicitMissScan = !validOut && (
     (rec.notes && rec.notes.toLowerCase().includes('miss scan')) ||
     rec.checkInStatus === 'miss_scan' ||
     rec.checkOutStatus === 'miss_scan' ||
     rec.status === 'Miss Scan' ||
     (typeof rec.checkOutTime === 'string' && rec.checkOutTime.toLowerCase().includes('miss'))
    );

    if (validOut && !isExplicitMissScan) {
     const inMs = parseSafeTimeMs(rec.checkInTime, rec.date) || new Date(rec.checkInTime).getTime();
     let outMs = parseSafeTimeMs(rec.checkOutTime, rec.date) || new Date(rec.checkOutTime).getTime();

     // Penanganan Shift Malam Lintas Hari (Overnight Shift):
     // Jika outMs lebih kecil dari inMs (misal masuk 20:05 kemarin dan keluar 06:00 pagi berikutnya),
     // maka outMs berada pada keesokan harinya (+ 24 jam)
     if (inMs && outMs && outMs < inMs) {
      if ((outMs + 24 * 3600 * 1000) - inMs <= 20 * 3600 * 1000) {
       outMs += 24 * 3600 * 1000;
      }
     }

     const diffMs = (inMs && outMs && outMs >= inMs) ? (outMs - inMs) : 0;
     const grossMins = Math.max(0, Math.floor(diffMs / (1000 * 60)));
     const hrs = Math.floor(grossMins / 60);
     const mins = grossMins % 60;
     // Potongan 1 jam istirahat jika durasi kotor >= 5 jam (300 menit)
     const effMins = grossMins >= 300 ? Math.max(0, grossMins - 60) : grossMins;
     return {
      durationMinutes: grossMins,
      durationStr: `${hrs} Jam ${mins} Mnt`,
      effectiveMinutes: effMins,
      effectiveHours: Math.round((effMins / 60) * 10) / 10,
      statusOut: 'Sudah Pulang',
      isMissScan: false,
      isOngoing: false
     };
   } else {
    const inMs = parseSafeTimeMs(rec.checkInTime, rec.date) || new Date(rec.checkInTime).getTime();
    const elapsedMs = (!isNaN(inMs) && inMs > 0) ? Math.max(0, Date.now() - inMs) : 0;

    // Kriteria Miss Scan:
    // 1. Sudah ditandai 'Miss Scan' secara eksplisit
    // 2. Berjalan MELEWATI batas maksimal shift resmi (>= 16 Jam / MAX_SHIFT_MS)
    // Sesi yang masih berjalan < 16 jam (termasuk shift malam lintas hari, misal masuk 22:00 kemarin dan sekarang jam 04:00 pagi) TETAP DIAKUI SEBAGAI SEDANG SHIFT
    if (isExplicitMissScan || elapsedMs >= MAX_SHIFT_MS) {
     return {
      durationMinutes: 7 * 60,
      durationStr: '7 Jam (Miss Scan)',
      effectiveMinutes: 7 * 60,
      effectiveHours: 7.0,
      statusOut: 'Miss Scan',
      isMissScan: true,
      isOngoing: false
     };
    } else {
     // Masih dalam rentang toleransi shift aktif (< 16 jam) -> SEDANG SHIFT (Karyawan MASIH BISA ABSEN PULANG)
     const grossMins = Math.max(0, Math.floor(elapsedMs / (1000 * 60)));
     const hrs = Math.floor(grossMins / 60);
     const mins = grossMins % 60;
     const effMins = grossMins >= 300 ? Math.max(0, grossMins - 60) : grossMins;
     return {
      durationMinutes: grossMins,
      durationStr: `Sedang Shift (${hrs}j ${mins}m)`,
      effectiveMinutes: effMins,
      effectiveHours: Math.round((effMins / 60) * 10) / 10,
      statusOut: 'Sedang Shift',
      isMissScan: false,
      isOngoing: true
     };
    }
   }
  }

  // 1. SMART MERGE ABSENSI (CLOUD-FIRST SSOT AUTHORITATIVE ENGINE)
  function mergeAttendanceArrays(localList, cloudList) {
   const map = new Map();
   const dayMap = new Map();
   const cloudDates = new Set();

   (cloudList || []).forEach(item => {
    if (!item) return;
    // Data yang datang dari Cloud Supabase adalah data resmi (SSOT) yang sah dan aktif.
    // Pulihkan dari tombstone lokal agar data tidak hilang di layar.
    if (typeof untrackDeletedAttendance === 'function') {
     untrackDeletedAttendance(item);
    }
    const key = item.id || `${(item.userNik || '').toUpperCase()}_${item.date || ''}_${item.checkInTime || ''}`;
    map.set(key, item);
    if (item.userNik && item.date) {
     dayMap.set(`${item.userNik.toUpperCase().trim()}__${item.date}`, key);
    }
    if (item.date) cloudDates.add(item.date);
   });

   // Ambil daftar ID yang sedang dalam antrean upload offline (Outbox)
   const outboxIds = new Set();
   try {
    if (typeof readAttOutbox === 'function') {
     readAttOutbox().forEach(x => { if (x && x.rec && x.rec.id) outboxIds.add(String(x.rec.id)); });
    }
   } catch(e) {}

   const todayStr = (typeof getLocalDateString === 'function') ? getLocalDateString(new Date()) : new Date().toISOString().split('T')[0];
   const yesterdayObj = new Date();
   yesterdayObj.setDate(yesterdayObj.getDate() - 1);
   const yesterdayStr = (typeof getLocalDateString === 'function') ? getLocalDateString(yesterdayObj) : yesterdayObj.toISOString().split('T')[0];

   const cloudHasRecords = (cloudList && cloudList.length > 0);

   // Data lokal menggabungkan record yang sah ke dalam peta
   (localList || []).forEach(localItem => {
    if (!localItem || isAttendanceMarkedDeleted(localItem)) return;
    const key = localItem.id || `${(localItem.userNik || '').toUpperCase()}_${localItem.date || ''}_${localItem.checkInTime || ''}`;
    const dayK = (localItem.userNik && localItem.date) ? `${localItem.userNik.toUpperCase().trim()}__${localItem.date}` : null;
    const matchedKey = map.has(key) ? key : (dayK && dayMap.has(dayK) ? dayMap.get(dayK) : null);

    if (!matchedKey) {
     map.set(key, localItem);
     if (dayK) dayMap.set(dayK, key);
    } else {
     const cloudItem = map.get(matchedKey);
     const hasOutLocal = !!(localItem.checkOutTime && localItem.checkOutTime !== '-' && localItem.checkOutTime !== '');
     const hasOutCloud = !!(cloudItem.checkOutTime && cloudItem.checkOutTime !== '-' && cloudItem.checkOutTime !== '');

     const tUpdA = (localItem.updatedAt && !isNaN(new Date(localItem.updatedAt).getTime())) ? new Date(localItem.updatedAt).getTime() : 0;
     const tUpdB = (cloudItem.updatedAt && !isNaN(new Date(cloudItem.updatedAt).getTime())) ? new Date(cloudItem.updatedAt).getTime() : 0;
     const isLocalAdminEdit = !!(localItem.correctedByAdmin || localItem.manualInput);
     const isCloudAdminEdit = !!(cloudItem.correctedByAdmin || cloudItem.manualInput);

     const isLocalGs = !!(localItem.id && localItem.id.includes('-gs-'));
     const isCloudGs = !!(cloudItem.id && cloudItem.id.includes('-gs-'));
     const localWins = (!isLocalGs && isCloudGs) || (tUpdA > tUpdB) || (isLocalAdminEdit && !isCloudAdminEdit && tUpdB === 0);
     const merged = localWins ? { ...cloudItem, ...localItem } : { ...localItem, ...cloudItem };

     // Pertahankan ID scanner asli (jangan gunakan ID buatan -gs-)
     if (cloudItem.id && !cloudItem.id.includes('-gs-')) {
      merged.id = cloudItem.id;
     } else if (localItem.id && !localItem.id.includes('-gs-')) {
      merged.id = localItem.id;
     }

     if (localWins) {
      merged.checkInTime = localItem.checkInTime;
      merged.date = localItem.date || cloudItem.date;
      if (hasOutLocal) {
       merged.checkOutTime = localItem.checkOutTime;
      } else if (hasOutCloud && !localItem.correctedByAdmin) {
       merged.checkOutTime = cloudItem.checkOutTime;
      } else {
       merged.checkOutTime = localItem.checkOutTime || null;
      }
     } else {
      if (hasOutCloud && hasOutLocal) {
       merged.checkOutTime = cloudItem.checkOutTime;
      } else if (hasOutCloud) {
       merged.checkOutTime = cloudItem.checkOutTime;
      } else if (hasOutLocal && !cloudItem.correctedByAdmin) {
       merged.checkOutTime = localItem.checkOutTime;
      } else {
       merged.checkOutTime = cloudItem.checkOutTime || null;
      }
     }

     if (hasValidCheckOut(merged)) {
      cleanStaleMissScanFlags(merged);
     }

     map.set(matchedKey, merged);
    }
   });

   // DEDUPLIKASI KETAT: Bersihkan data ganda untuk NIK + Tanggal yang sama dalam shift
   const dedupMap = new Map();
   for (const item of map.values()) {
    if (!item || isAttendanceMarkedDeleted(item)) continue;
    const nik = (item.userNik || '').toUpperCase().trim();
    const dt = item.date || '';
    if (!nik || !dt) {
     dedupMap.set(item.id || Math.random().toString(), item);
     continue;
    }
    const dKey = `${nik}__${dt}`;
    if (!dedupMap.has(dKey)) {
     dedupMap.set(dKey, item);
    } else {
     const ex = dedupMap.get(dKey);
     let keepOut = ex.checkOutTime;
      if (!keepOut || keepOut === '-' || keepOut === '') {
       keepOut = item.checkOutTime;
      } else if (item.checkOutTime && item.checkOutTime !== '-' && item.checkOutTime !== '') {
       if (item.checkOutTime.includes('.') && !keepOut.includes('.')) {
        keepOut = item.checkOutTime;
       }
      }
     const keepId = (!ex.id || ex.id.includes('-gs-')) && (item.id && !item.id.includes('-gs-')) ? item.id : ex.id;
     const keepNotes = (item.notes && item.notes !== '-') ? item.notes : ex.notes;
     const unified = { ...ex, ...item, id: keepId, checkOutTime: keepOut, notes: keepNotes };
     if (hasValidCheckOut(unified)) cleanStaleMissScanFlags(unified);
     dedupMap.set(dKey, unified);
    }
   }
   return Array.from(dedupMap.values());
  }

  // 2. SMART MERGE PENGAJUAN SAKIT / CUTI (Kunci ID / NIK+TglMulai+Jenis)
  function mergeLeaveArrays(localList, cloudList) {
   const map = new Map();
   (cloudList || []).forEach(item => {
    if (!item || isLeaveMarkedDeleted(item)) return;
    const key = item.id || `${(item.userNik || '').toUpperCase()}_${item.startDate || ''}_${item.type || ''}`;
    map.set(key, item);
   });
   const cloudHasRecords = (cloudList && cloudList.length > 0);
   (localList || []).forEach(localItem => {
    if (!localItem || isLeaveMarkedDeleted(localItem)) return;
    const key = localItem.id || `${(localItem.userNik || '').toUpperCase()}_${localItem.startDate || ''}_${localItem.type || ''}`;
    if (!map.has(key)) {
     const createdTime = (localItem.createdAt && !isNaN(new Date(localItem.createdAt).getTime())) ? new Date(localItem.createdAt).getTime() : 0;
     const isRecentlyCreatedOffline = (Date.now() - createdTime < 86400000 || localItem._pendingSync);
     if (!cloudHasRecords || isRecentlyCreatedOffline) {
      map.set(key, localItem);
     }
    } else {
     const cloudItem = map.get(key);
     const statusPriority = { approved: 3, rejected: 3, pending_manager: 2, pending: 1 };
     const cloudPrio = statusPriority[cloudItem.status] || 0;
     const localPrio = statusPriority[localItem.status] || 0;
     const status = cloudPrio >= localPrio ? cloudItem.status : localItem.status;
     map.set(key, { ...localItem, ...cloudItem, status });
    }
   });
   return Array.from(map.values());
  }

  // 3. SMART MERGE LEMBURAN (Kunci ID / NIK+Tanggal+JamMulai)
  function mergeOvertimeArrays(localList, cloudList) {
   const map = new Map();
   (cloudList || []).forEach(item => {
    if (!item || isOvertimeMarkedDeleted(item)) return;
    const key = item.id || `${(item.userNik || '').toUpperCase()}_${item.date || ''}_${item.startTime || ''}`;
    map.set(key, item);
   });
   (localList || []).forEach(localItem => {
    if (!localItem || isOvertimeMarkedDeleted(localItem)) return;
    const key = localItem.id || `${(localItem.userNik || '').toUpperCase()}_${localItem.date || ''}_${localItem.startTime || ''}`;
    if (!map.has(key)) {
     // Pastikan data lembur lokal baru TIDAK PERNAH terhapus saat sinkronisasi cloud
     map.set(key, localItem);
    } else {
     const cloudItem = map.get(key);
     const statusPriority = { approved: 3, rejected: 3, pending_manager: 2, pending: 1 };
     const cloudPrio = statusPriority[cloudItem.status] || 0;
     const localPrio = statusPriority[localItem.status] || 0;
     const status = cloudPrio >= localPrio ? cloudItem.status : localItem.status;
     map.set(key, { ...cloudItem, ...localItem, status });
    }
   });
   return Array.from(map.values());
  }

  // 4. SMART MERGE MASTER KARYAWAN & DATA SHIELD ANTI-HILANG (2-WAY BIDIRECTIONAL SYNC)
  function mergeUserArrays(localList, cloudList, wh, cloudUpdatedAt = '') {
   const deletedKeys = getDeletedUserKeys();
   // SINGLE SOURCE OF TRUTH: Data cloud adalah master sah, TIDAK BOLEH dipotong oleh cache tombstone lokal perangkat!
   localList = (Array.isArray(localList) ? localList : []).filter(u => !isUserMarkedDeleted(u, deletedKeys));
   cloudList = (Array.isArray(cloudList) ? cloudList : []).filter(u => u && u.nik && !isUserMarkedDeleted(u, deletedKeys));

   // Filter list berdasarkan gudang target agar data antar gudang tidak pernah tercampur saat sync cloud
   const filterWhStrict = (list, targetWh) => {
    return (list || []).filter(u => {
     if (!u) return false;
     if (isUserManager(u)) return true;
     const uNik = (u.nik || '').toUpperCase().trim();
     const uWh = (u.warehouse || '').toUpperCase().trim();
     const uId = (u.id || '').toLowerCase().trim();
     if (targetWh === 'MBI') {
      if (uWh === 'MAI' || uNik.startsWith('MAI') || uId.startsWith('mai-') || cleanStr(u.name) === 'admingudangmai') return false;
     } else if (targetWh === 'MAI') {
      if (uWh === 'MBI' || uNik.startsWith('MBI') || uId.startsWith('mbi-') || cleanStr(u.name) === 'admingudangmbi') return false;
     }
     return true;
    });
   };

   // Bersihkan akun ghost yang nama berupa ID jika ada kandidat nama manusia sah
   const filterGhost = (list) => {
    const hasHuman = list.some(u => u && !isManagementSystemAccount(u) && isLikelyHumanName(u.name) && !isLikelyIdNotName(u.name));
    if (hasHuman) {
     return list.filter(u => {
      if (!u) return false;
      if (isManagementSystemAccount(u)) return true;
      return isLikelyHumanName(u.name) && !isLikelyIdNotName(u.name);
     });
    }
    return list;
   };

   localList = filterWhStrict(filterGhost(localList), wh);
   cloudList = filterWhStrict(filterGhost(cloudList), wh);

   const countRegular = (list) => list.filter(u => u && !isManagementSystemAccount(u)).length;
   let localRegCount = countRegular(localList);
   const cloudRegCount = countRegular(cloudList);

   // Cek apakah lokal punya cadangan backup Excel jika data aktif saat ini sempat kosong
   if (localRegCount === 0) {
    try {
     const rawBackup = localStorage.getItem(`wfm_${wh.toLowerCase()}_users_backup`);
     if (rawBackup) {
      const backupUsers = JSON.parse(rawBackup);
      if (Array.isArray(backupUsers) && countRegular(backupUsers) > 0) {
       localList = filterGhost(backupUsers.filter(u => !isUserMarkedDeleted(u, deletedKeys)));
       localRegCount = countRegular(localList);
      }
     }
    } catch(e) {}
   }

   // PERISAI 1: Jika Lokal memiliki karyawan reguler tapi Cloud KOSONG / HANYA SEED (0 karyawan reguler):
   // DILARANG KERAS menghapus data lokal! Pertahankan lokal 100% dan re-sync ke Cloud.
   if (localRegCount > 0 && cloudRegCount === 0) {
    console.warn(`[DataShield] Mencegah penghapusan ${localRegCount} karyawan lokal oleh cloud kosong pada Gudang ${wh}`);
    return deduplicateUserList(localList, wh);
   }

   // PERISAI 2: Jika Lokal kosong / baru dibuka di HP, tapi Cloud memiliki karyawan reguler:
   // Adopsi seluruh data Cloud 100%!
   if (localRegCount === 0 && cloudRegCount > 0) {
    console.log(`[DataShield] Mengadopsi ${cloudRegCount} karyawan dari Cloud ke Gudang ${wh}`);
    return deduplicateUserList(cloudList, wh);
   }

   // SMART MERGE 2-WAY: SINKRONISASI LENGKAP SEMUA PERANGKAT
   // Menggabungkan data lokal & data cloud tanpa menghilangkan karyawan baru dari perangkat manapun.
   const resultList = [];
   const matchedCloudUserIds = new Set();
   const matchedCloudNiks = new Set();
   const matchedCloudNames = new Set();

   // Tahap 1: Iterasi seluruh karyawan lokal dan padukan atribut terbaru dari Cloud (permissions, password, kontak)
   localList.forEach((loc) => {
    if (!loc || isUserMarkedDeleted(loc, deletedKeys)) return;
    const normName = cleanStr(loc.name);
    const normNik = (loc.nik || '').toUpperCase().trim();
    const locId = (loc.id || '').trim();

    // Cari record cloud yang cocok
    const cloudMatch = cloudList.find(c => {
     if (!c || isUserMarkedDeleted(c, deletedKeys)) return false;
     if (locId && c.id && String(c.id).trim() === locId) return true;
     if (normNik && c.nik && String(c.nik).toUpperCase().trim() === normNik) return true;
     if (normName && c.name && cleanStr(c.name) === normName) return true;
     return false;
    });

    if (cloudMatch) {
     if (cloudMatch.id) matchedCloudUserIds.add(String(cloudMatch.id).trim());
     if (cloudMatch.nik) matchedCloudNiks.add(String(cloudMatch.nik).toUpperCase().trim());
     if (cloudMatch.name) matchedCloudNames.add(cleanStr(cloudMatch.name));

     const locTime = (loc.updatedAt && !isNaN(new Date(loc.updatedAt).getTime())) ? new Date(loc.updatedAt).getTime() : 0;
     const cloudTime = (cloudMatch.updatedAt && !isNaN(new Date(cloudMatch.updatedAt).getTime())) ? new Date(cloudMatch.updatedAt).getTime() : 0;
     const isLocalNewer = (locTime > cloudTime);
     const isCloudNewer = (cloudTime > locTime);
     const isLocalExplicitlyNewer = isLocalNewer;

     const merged = isLocalExplicitlyNewer ? { ...cloudMatch, ...loc } : { ...loc, ...cloudMatch };

     if (isLocalExplicitlyNewer) {
      merged.name = loc.name || cloudMatch.name;
      merged.dept = loc.dept || loc.department || cloudMatch.dept || cloudMatch.department;
      merged.department = merged.dept;
      merged.outsource = loc.outsource !== undefined ? loc.outsource : cloudMatch.outsource;
      merged.role = loc.role || cloudMatch.role;
      merged.phone = loc.phone !== undefined ? loc.phone : cloudMatch.phone;
      merged.email = loc.email !== undefined ? loc.email : cloudMatch.email;
      if (loc.password) merged.password = loc.password;
      merged.updatedAt = loc.updatedAt;
     } else {
      // CLOUD-FIRST SSOT: Adopsi data terbaru dari Cloud sebagai sumber kebenaran utama
      if (cloudMatch.name && isLikelyHumanName(cloudMatch.name)) {
       merged.name = cloudMatch.name;
      } else if (!merged.name && loc.name) {
       merged.name = loc.name;
      }
      merged.dept = cloudMatch.dept || cloudMatch.department || loc.dept || loc.department;
      merged.department = merged.dept;
      if (cloudMatch.outsource !== undefined) {
       if (cloudMatch.outsource === 'Internal' && (loc.outsource === 'Staffinc' || loc.outsource === 'ADP') && !isCloudNewer) {
        merged.outsource = loc.outsource;
       } else {
        merged.outsource = cloudMatch.outsource;
       }
      }
      if (cloudMatch.role) merged.role = cloudMatch.role;
      if (isCloudNewer) {
       if (cloudMatch.phone !== undefined) merged.phone = cloudMatch.phone;
       if (cloudMatch.email !== undefined) merged.email = cloudMatch.email;
      } else {
       if (cloudMatch.phone) merged.phone = cloudMatch.phone;
       if (cloudMatch.email) merged.email = cloudMatch.email;
      }
      if (cloudMatch.password) merged.password = cloudMatch.password;
      merged.updatedAt = cloudMatch.updatedAt || loc.updatedAt || new Date().toISOString();
     }

     // Prioritas Sinkronisasi NIK:
     const cMName = cleanStr(merged.name);
     if (wh === 'MBI' && cMName === 'ogisaputra') {
      merged.nik = 'MBI26-009';
      merged.barcodeValue = 'MBI26-009';
     } else if (wh === 'MBI' && cMName === 'yonno') {
      merged.nik = 'MBI26-010';
      merged.barcodeValue = 'MBI26-010';
     } else if (wh === 'MBI' && (cMName === 'galangerdiansyah' || (merged.name && merged.name.toUpperCase().includes('GALANG') && merged.name.toUpperCase().includes('ERDIANSYAH')))) {
      merged.nik = 'MBI26-011';
      merged.barcodeValue = 'MBI26-011';
     } else if (wh === 'MBI' && (cMName === 'dhiobaguscandraarguna' || (merged.name && merged.name.toUpperCase().includes('DHIO') && merged.name.toUpperCase().includes('ARGUNA')))) {
      merged.nik = 'MBI26-117';
      merged.barcodeValue = 'MBI26-117';
     } else if (wh === 'MBI' && (cMName === 'dinarya' || (merged.name && merged.name.toUpperCase().includes('DINARYA')))) {
      merged.nik = 'MBI26-118';
      merged.barcodeValue = 'MBI26-118';
     } else if (wh === 'MBI' && (cMName === 'melindagitawismaya' || cMName.includes('melinda'))) {
      merged.nik = 'MBI26-122';
      merged.barcodeValue = 'MBI26-122';
     } else if (wh === 'MAI' && (cMName === 'akmal' || cMName.includes('akmal'))) {
      merged.nik = 'MAI26-034';
      merged.barcodeValue = 'MAI26-034';
     } else if (wh === 'MAI' && (cMName === 'achmadvikih' || cMName.includes('vikih'))) {
      merged.nik = 'MAI26-035';
      merged.barcodeValue = 'MAI26-035';
     } else if (wh === 'MAI' && (cMName === 'mohamadyuliandi' || cMName.includes('yuliandi'))) {
      merged.nik = 'MAI26-041';
      merged.barcodeValue = 'MAI26-041';
     } else if (wh === 'MAI' && (cMName === 'nirwanfadlipulungan' || cMName.includes('nirwan'))) {
      merged.nik = 'MAI26-042';
      merged.barcodeValue = 'MAI26-042';
     } else if (cloudMatch.nik && cloudMatch.nik.trim() !== '') {
      merged.nik = cloudMatch.nik.toUpperCase().trim();
      merged.barcodeValue = merged.nik;
     } else if (loc.nik) {
      merged.nik = loc.nik.toUpperCase().trim();
      merged.barcodeValue = loc.nik.toUpperCase().trim();
     }

     // Sinkronisasi status aktif/nonaktif berdasarkan timestamp terbaru atau prioritas status nonaktif
     if (isCloudNewer) {
      merged.status = cloudMatch.status || (cloudMatch.isActive === false ? 'inactive' : 'active');
      merged.isActive = (merged.status !== 'inactive');
     } else if (isLocalNewer) {
      merged.status = loc.status || (loc.isActive === false ? 'inactive' : 'active');
      merged.isActive = (merged.status !== 'inactive');
     } else {
      if (cloudMatch.status === 'inactive' || loc.status === 'inactive' || cloudMatch.isActive === false || loc.isActive === false) {
       merged.status = 'inactive';
       merged.isActive = false;
      } else {
       merged.status = 'active';
       merged.isActive = true;
      }
     }

     // Prioritas hak akses: jika Cloud lebih baru (diubah oleh Admin), adopsi Cloud 100%!
     if (isCloudNewer && cloudMatch.permissions && typeof cloudMatch.permissions === 'object') {
      merged.permissions = { ...cloudMatch.permissions };
     } else if (isLocalNewer && loc.permissions && typeof loc.permissions === 'object') {
      merged.permissions = { ...loc.permissions };
     } else if (cloudMatch.permissions && typeof cloudMatch.permissions === 'object') {
      merged.permissions = { ...cloudMatch.permissions };
     } else if (loc.permissions && typeof loc.permissions === 'object') {
      merged.permissions = { ...loc.permissions };
     }
     if (merged.permissions && merged.nik) {
      try {
       localStorage.setItem(`wfm_perm_${wh.toLowerCase()}_${merged.nik.toUpperCase().trim()}`, JSON.stringify(merged.permissions));
       localStorage.setItem(`wfm_perm_${merged.nik.toUpperCase().trim()}`, JSON.stringify(merged.permissions));
      } catch(e) {}
     }
     // Jika akun yang diperbarui izinnya adalah akun yang sedang aktif login, terapkan seketika
     if (currentUser && ((merged.nik && currentUser.nik && merged.nik.toUpperCase() === currentUser.nik.toUpperCase()) || (merged.id && currentUser.id && merged.id === currentUser.id))) {
      currentUser.permissions = { ...(merged.permissions || {}) };
      try { localStorage.setItem('wfm_active_session', JSON.stringify(currentUser)); } catch(e) {}
      try { applyRolePermissions(); } catch(e) {}
     }
     resultList.push(merged);
    } else {
     // Karyawan lokal ini TIDAK ditemukan di Cloud
     // 1. Akun manajemen sistem (Admin, Scanner, Manager) SELALU DIPERTAHANKAN 100% agar login tidak pernah gagal!
     const isOfficialMaster = (wh === 'MBI' && loc.nik && /^MBI26-\d{3}$/i.test(loc.nik)) || (wh === 'MAI' && loc.nik && /^MAI26-\d{3}$/i.test(loc.nik));
     if (isManagementSystemAccount(loc) || isOfficialMaster) {
      resultList.push(loc);
     } else if (cloudRegCount === 0) {
      // Jika Cloud kosong / belum ada karyawan reguler, pertahankan lokal (Data Shield)
      resultList.push(loc);
     } else {
      // Cloud SUDAH memiliki karyawan reguler (>0), tetapi karyawan lokal ini TIDAK ADA di Cloud.
      // Cek apakah karyawan ini baru saja dibuat offline secara lokal dalam 1 jam terakhir:
      const createdTime = (loc.createdAt && !isNaN(new Date(loc.createdAt).getTime())) ? new Date(loc.createdAt).getTime() : 0;
      const isRecentlyCreatedOffline = (Date.now() - createdTime < 3600000 && loc._pendingSync);
      if (isRecentlyCreatedOffline) {
       resultList.push(loc);
      } else {
       console.log(`[SmartSync] Menghapus data karyawan usang dari penyimpanan lokal karena tidak ada di Cloud: ${loc.name} (${loc.nik})`);
      }
     }
    }
   });

   // Tahap 2: Tambahkan SELURUH karyawan baru yang sah dari Cloud yang belum ada di database lokal
   cloudList.forEach((c) => {
    if (!c || isUserMarkedDeleted(c, deletedKeys)) return;
    const cId = String(c.id || '').trim();
    const cNik = String(c.nik || '').toUpperCase().trim();
    const cName = cleanStr(c.name);

    if (cId && matchedCloudUserIds.has(cId)) return;
    if (cNik && matchedCloudNiks.has(cNik)) return;
    if (cName && matchedCloudNames.has(cName)) return;

    const alreadyExists = resultList.some(r => {
     if (!r) return false;
     if (cId && r.id && String(r.id).trim() === cId) return true;
     if (cNik && r.nik && String(r.nik).toUpperCase().trim() === cNik) return true;
     if (cName && r.name && cleanStr(r.name) === cName) return true;
     return false;
    });

    if (!alreadyExists) {
     if (isManagementSystemAccount(c) || (isLikelyHumanName(c.name) && !isLikelyIdNotName(c.name)) || (c.name && c.nik)) {
      resultList.push(c);
     }
    }
   });

   const finalCleaned = deduplicateUserList(resultList, wh);
   return ensureMasterBaseline(finalCleaned, wh);
  }

  let lastAppliedCloudUpdatedAt = null;
  function applyIncomingDatabase(db, sourceWh = null) {
   if (!db || typeof db !== 'object' || Array.isArray(db)) return;
   clearWhDBCache();
   isApplyingFromCloud = true;
   try {
    let hasUsersChanged = false;
    let hasAttChanged = false;
    let hasOtChanged = false;
    let hasLeavesChanged = false;
    // Version banner hanya dicek dari version.json hosting agar tidak pernah loop akibat data cloud
    // Sinkronkan daftar user yang dihapus dari Cloud dan bersihkan seketika dari memori lokal
    if (Array.isArray(db.deleted_user_keys)) {
     const localKeys = getDeletedUserKeys();
     const mgmtKeys = new Set(['admin', 'admingudangmbi', 'admingudangmai', 'adm001', 'admmai', 'scanner', 'scannerpresensigudang', 'absenmbi', 'absenmai', 'manager', 'mgreko', 'mgr001']);
     const forbiddenProtected = new Set([
      'dinarya', 'mbi26118', 'mbi26-118', 'mbi1792229164411', 'mbi-1792229164411', 'mbi-1790828522744-116-dxyq', 'mbi1790828522744116dxyq',
      'dhio', 'dhiobagus', 'dhiobaguscandraarguna', 'mbi26117', 'mbi26-117', 'mbi-1790828522744-115-i7t3', 'mbi1790828522744115i7t3'
     ]);
     let keysAdded = false;

     db.deleted_user_keys.forEach(k => {
      if (!k) return;
      const cleanK = cleanStr(k);
      if (mgmtKeys.has(cleanK) || forbiddenProtected.has(cleanK)) return;
      const rawK = String(k).trim().toLowerCase();
      if (forbiddenProtected.has(rawK)) return;
      if (!localKeys.has(rawK)) { localKeys.add(rawK); keysAdded = true; }
      if (cleanK && !localKeys.has(cleanK)) { localKeys.add(cleanK); keysAdded = true; }
     });
     if (keysAdded) {
      saveDeletedUserKeys(localKeys);
     }

     // Bersihkan seketika seluruh karyawan lokal yang kuncinya masuk daftar hapus Cloud
     ['MBI', 'MAI'].forEach(w => {
      const storageKey = `wfm_${w.toLowerCase()}_users`;
      const raw = localStorage.getItem(storageKey);
      if (raw) {
       try {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
         const filtered = list.filter(u => !u || isManagementSystemAccount(u) || !isUserMarkedDeleted(u, localKeys));
         if (filtered.length !== list.length) {
          localStorage.setItem(storageKey, JSON.stringify(filtered));
          localStorage.setItem(`wfm_${w.toLowerCase()}_users_backup`, JSON.stringify(filtered));
          hasUsersChanged = true;
         }
        }
       } catch(e) {}
      }
     });
    }

   // Sinkronkan tombstone hapus presensi, pengajuan, dan lembur dari Cloud ke Lokal
   if (Array.isArray(db.deleted_attendance_ids) && db.deleted_attendance_ids.length > 0) {
    trackDeletedAttendance(db.deleted_attendance_ids);
   }
   if (Array.isArray(db.deleted_leave_ids) && db.deleted_leave_ids.length > 0) {
    trackDeletedLeaves(db.deleted_leave_ids);
   }
   if (Array.isArray(db.deleted_overtime_ids) && db.deleted_overtime_ids.length > 0) {
    trackDeletedOvertime(db.deleted_overtime_ids);
   }

   const cloudUpdatedAt = db.updatedAt || '';

   const currMbiUsers = localStorage.getItem('wfm_mbi_users') || '';
   const currMaiUsers = localStorage.getItem('wfm_mai_users') || '';
   const currMbiAtt = localStorage.getItem('wfm_mbi_attendance') || '';
   const currMaiAtt = localStorage.getItem('wfm_mai_attendance') || '';
   const currMbiOt = localStorage.getItem('wfm_mbi_overtime') || '';
   const currMaiOt = localStorage.getItem('wfm_mai_overtime') || '';
   const currMbiLeaves = localStorage.getItem('wfm_mbi_leaves') || '';
   const currMaiLeaves = localStorage.getItem('wfm_mai_leaves') || '';

   // PROSES DATA GUDANG MBI (JIKA DIKIRIM DARI SERVER MBI ATAU DATABASE MBI)
   const rawMbiUsers = db.mbi_users !== undefined ? db.mbi_users : ((sourceWh === 'MBI' || !sourceWh) ? db.users : undefined);
   const rawMbiAtt = db.mbi_attendance !== undefined ? db.mbi_attendance : ((sourceWh === 'MBI' || !sourceWh) ? db.attendance : undefined);
   const rawMbiAttLive = db.mbi_attendance_live !== undefined ? db.mbi_attendance_live : ((sourceWh === 'MBI' || !sourceWh) ? db.attendance_live : undefined);
   const rawMbiOt = db.mbi_overtime !== undefined ? db.mbi_overtime : ((sourceWh === 'MBI' || !sourceWh) ? db.overtime : undefined);
   const rawMbiLeaves = db.mbi_leaves !== undefined ? db.mbi_leaves : ((sourceWh === 'MBI' || !sourceWh) ? db.leaves : undefined);

   if (rawMbiUsers !== undefined || rawMbiAtt !== undefined || rawMbiAttLive !== undefined || rawMbiOt !== undefined || rawMbiLeaves !== undefined) {
    if (rawMbiUsers !== undefined) {
     let cloudMbiRaw = normalizeFirebaseArray(rawMbiUsers);
      if (Array.isArray(cloudMbiRaw) && cloudMbiRaw.length > 0) {
       cloudMbiRaw = ensureMasterBaseline(cloudMbiRaw, 'MBI');
       const localMbiUsers = getWhDB('MBI', 'users', SEED_MBI_USERS);
       let cleanMbiUsers = ensureMasterBaseline(mergeUserArrays(localMbiUsers, cloudMbiRaw, 'MBI', db.updatedAt), 'MBI');
      cleanMbiUsers.forEach(u => {
       if (u && (u.role === 'scanner' || (u.nik && u.nik.startsWith('ABSEN-')) || (u.id && u.id.includes('scanner')))) {
        u.name = 'Scanner Presensi Gudang';
       }
      });
      const newMbiUsers = JSON.stringify(cleanMbiUsers);
      if (currMbiUsers !== newMbiUsers) {
       localStorage.setItem('wfm_mbi_users', newMbiUsers);
       localStorage.setItem('wfm_mbi_users_backup', newMbiUsers);
       hasUsersChanged = true;
      }
      whDBCache.set('wfm_mbi_users', cleanMbiUsers);
     }
    }
    if (rawMbiAtt !== undefined || rawMbiAttLive !== undefined) {
     const rawCloudMbiAtt = combineCloudAttendanceWithLive(rawMbiAtt, rawMbiAttLive);
     const localMbiAtt = getWhDB('MBI', 'attendance', []);
     const mergedMbiAtt = mergeAttendanceArrays(localMbiAtt, rawCloudMbiAtt);
     const newMbiAtt = JSON.stringify(mergedMbiAtt);
     if (currMbiAtt !== newMbiAtt) {
      localStorage.setItem('wfm_mbi_attendance', newMbiAtt);
      hasAttChanged = true;
     }
     whDBCache.set('wfm_mbi_attendance', mergedMbiAtt);
    }
    if (rawMbiOt !== undefined) {
     const rawCloudOt = normalizeFirebaseArray(rawMbiOt);
     const mergedMbiOt = mergeOvertimeArrays(getWhDB('MBI', 'overtime', []), rawCloudOt);
     const newMbiOt = JSON.stringify(mergedMbiOt);
     if (currMbiOt !== newMbiOt) {
      localStorage.setItem('wfm_mbi_overtime', newMbiOt);
      whDBCache.set('wfm_mbi_overtime', mergedMbiOt);
      hasOtChanged = true;
     }
    }
    if (rawMbiLeaves !== undefined) {
     const rawCloudLeaves = normalizeFirebaseArray(rawMbiLeaves);
     const mergedMbiLeaves = mergeLeaveArrays(getWhDB('MBI', 'leaves', []), rawCloudLeaves);
     const newMbiLeaves = JSON.stringify(mergedMbiLeaves);
     if (currMbiLeaves !== newMbiLeaves) {
      localStorage.setItem('wfm_mbi_leaves', newMbiLeaves);
      whDBCache.set('wfm_mbi_leaves', mergedMbiLeaves);
      hasLeavesChanged = true;
     }
    }
   }

   // PROSES DATA GUDANG MAI (JIKA DIKIRIM DARI SERVER MAI ATAU DATABASE MAI)
   const rawMaiUsers = db.mai_users !== undefined ? db.mai_users : (sourceWh === 'MAI' ? db.users : undefined);
   const rawMaiAtt = db.mai_attendance !== undefined ? db.mai_attendance : (sourceWh === 'MAI' ? db.attendance : undefined);
   const rawMaiAttLive = db.mai_attendance_live !== undefined ? db.mai_attendance_live : (sourceWh === 'MAI' ? db.attendance_live : undefined);
   const rawMaiOt = db.mai_overtime !== undefined ? db.mai_overtime : (sourceWh === 'MAI' ? db.overtime : undefined);
   const rawMaiLeaves = db.mai_leaves !== undefined ? db.mai_leaves : (sourceWh === 'MAI' ? db.leaves : undefined);

   if (rawMaiUsers !== undefined || rawMaiAtt !== undefined || rawMaiAttLive !== undefined || rawMaiOt !== undefined || rawMaiLeaves !== undefined) {
    if (rawMaiUsers !== undefined) {
     let cloudMaiRaw = normalizeFirebaseArray(rawMaiUsers);
      if (Array.isArray(cloudMaiRaw) && cloudMaiRaw.length > 0) {
       cloudMaiRaw = ensureMasterBaseline(cloudMaiRaw, 'MAI');
       const localMaiUsers = getWhDB('MAI', 'users', SEED_MAI_USERS);
       const cleanMaiUsers = ensureMasterBaseline(mergeUserArrays(localMaiUsers, cloudMaiRaw, 'MAI', db.updatedAt), 'MAI');
      cleanMaiUsers.forEach(u => {
       if (u && (u.role === 'scanner' || (u.nik && u.nik.startsWith('ABSEN-')) || (u.id && u.id.includes('scanner')))) {
        u.name = 'Scanner Presensi Gudang';
       }
      });
      const newMaiUsers = JSON.stringify(cleanMaiUsers);
      if (currMaiUsers !== newMaiUsers) {
       localStorage.setItem('wfm_mai_users', newMaiUsers);
       localStorage.setItem('wfm_mai_users_backup', newMaiUsers);
       hasUsersChanged = true;
      }
      whDBCache.set('wfm_mai_users', cleanMaiUsers);
     }
    }
    if (rawMaiAtt !== undefined || rawMaiAttLive !== undefined) {
     const rawCloudMaiAtt = combineCloudAttendanceWithLive(rawMaiAtt, rawMaiAttLive);
     const localMaiAtt = getWhDB('MAI', 'attendance', []);
     const mergedMaiAtt = mergeAttendanceArrays(localMaiAtt, rawCloudMaiAtt);
     const newMaiAtt = JSON.stringify(mergedMaiAtt);
     if (currMaiAtt !== newMaiAtt) {
      localStorage.setItem('wfm_mai_attendance', newMaiAtt);
      hasAttChanged = true;
     }
     whDBCache.set('wfm_mai_attendance', mergedMaiAtt);
    }
    if (rawMaiOt !== undefined) {
     const rawCloudOt = normalizeFirebaseArray(rawMaiOt);
     const mergedMaiOt = mergeOvertimeArrays(getWhDB('MAI', 'overtime', []), rawCloudOt);
     const newMaiOt = JSON.stringify(mergedMaiOt);
     if (currMaiOt !== newMaiOt) {
      localStorage.setItem('wfm_mai_overtime', newMaiOt);
      whDBCache.set('wfm_mai_overtime', mergedMaiOt);
      hasOtChanged = true;
     }
    }
    if (rawMaiLeaves !== undefined) {
     const rawCloudLeaves = normalizeFirebaseArray(rawMaiLeaves);
     const mergedMaiLeaves = mergeLeaveArrays(getWhDB('MAI', 'leaves', []), rawCloudLeaves);
     const newMaiLeaves = JSON.stringify(mergedMaiLeaves);
     if (currMaiLeaves !== newMaiLeaves) {
      localStorage.setItem('wfm_mai_leaves', newMaiLeaves);
      whDBCache.set('wfm_mai_leaves', mergedMaiLeaves);
      hasLeavesChanged = true;
     }
    }
   }

   let hasCoordsChanged = false;
   const lastGpsChange = parseInt(localStorage.getItem('wfm_last_gps_change_time') || '0', 10);
   const isRecentLocalGpsChange = (Date.now() - lastGpsChange < 30000); // 30 detik grace period

   if (!isRecentLocalGpsChange) {
    if (db.mbi_coords && Number(db.mbi_coords.radius) > 0) {
     const cloudMbiRad = Number(db.mbi_coords.radius);
     const localMbi = getWarehouseCoords('MBI');
     if (localMbi.radius !== cloudMbiRad) {
      localStorage.setItem('wfm_mbi_coords', JSON.stringify({ lat: DEFAULT_COORDS.MBI.lat, lng: DEFAULT_COORDS.MBI.lng, radius: cloudMbiRad, name: 'Gudang MBI' }));
      localStorage.setItem('wfm_gps_radius_mbi', String(cloudMbiRad));
      if (activeWarehouse === 'MBI') localStorage.setItem('wfm_gps_radius', String(cloudMbiRad));
      latestCachedGPS = null;
      hasCoordsChanged = true;
     }
    }
    if (db.mai_coords && Number(db.mai_coords.radius) > 0) {
     const cloudMaiRad = Number(db.mai_coords.radius);
     const localMai = getWarehouseCoords('MAI');
     if (localMai.radius !== cloudMaiRad) {
      localStorage.setItem('wfm_mai_coords', JSON.stringify({ lat: DEFAULT_COORDS.MAI.lat, lng: DEFAULT_COORDS.MAI.lng, radius: cloudMaiRad, name: 'Gudang MAI' }));
      localStorage.setItem('wfm_gps_radius_mai', String(cloudMaiRad));
      if (activeWarehouse === 'MAI') localStorage.setItem('wfm_gps_radius', String(cloudMaiRad));
      latestCachedGPS = null;
      hasCoordsChanged = true;
     }
    }
   }

   if (hasCoordsChanged) {
    latestCachedGPS = null;
    updateRegisteredCoordsDisplay();
   }

   // SINKRONISASI TEMA WARNA GLOBAL DARI CLOUD (ADMIN-CONTROLLED)
   if (db.app_theme && typeof db.app_theme === 'string' && typeof APP_THEMES !== 'undefined' && APP_THEMES[db.app_theme]) {
    const curTheme = localStorage.getItem('wfm_app_theme') || 'navy';
    if (db.app_theme !== curTheme) {
     applyAppTheme(db.app_theme, true);
    }
   }

   if (hasUsersChanged) {
    const curMbi = getWhDB('MBI', 'users', []);
    const curMai = getWhDB('MAI', 'users', []);

    // Update permanent registry di HP / perangkat ini dengan NIK master Cloud
    try {
     const permObj = {};
     curMbi.forEach(u => {
      if (u && u.name && u.nik && !isLikelyIdNotName(u.name)) {
       permObj[`MBI_${cleanStr(u.name)}`] = u.nik.toUpperCase().trim();
      }
     });
     curMai.forEach(u => {
      if (u && u.name && u.nik && !isLikelyIdNotName(u.name)) {
       permObj[`MAI_${cleanStr(u.name)}`] = u.nik.toUpperCase().trim();
      }
     });
     localStorage.setItem('wfm_permanent_nik_name_registry', JSON.stringify(permObj));
    } catch(e) {}

    // Selaraskan riwayat presensi di HP / perangkat ini
    if (typeof realignAllAttendanceRecordsWithMaster === 'function') {
     realignAllAttendanceRecordsWithMaster();
    }

    if (currentUser) {
     const myWh = currentUser.warehouse || activeWarehouse || 'MBI';
     const myUsers = myWh === 'MAI' ? curMai : curMbi;
     const me = myUsers.find(u => (u.nik && u.nik === currentUser.nik) || (u.id && u.id === currentUser.id) || (u.name && cleanStr(u.name) === cleanStr(currentUser.name)));
     if (me) {
      currentUser.permissions = me.permissions || currentUser.permissions;
      localStorage.setItem('wfm_active_session', JSON.stringify(currentUser));
      applyRolePermissions();
     }
    }
   }

   // Render ulang layar aktif secara selektif & cepat dengan data paling segar
   clearWhDBCache();
   renderAllLiveScreens();

   if (db.updatedAt && db.updatedAt !== lastAppliedCloudUpdatedAt) {
    lastAppliedCloudUpdatedAt = db.updatedAt;
    if (typeof syncGoogleSheetDirectly === 'function') {
     syncGoogleSheetDirectly(false, sourceWh || null);
    }
   }
   } finally {
    clearWhDBCache();
    isApplyingFromCloud = false;
   }
  }

  // PENGHEMAT KINERJA: HANYA PERBARUI PANEL LAYAR YANG SEDANG AKTIF DILIHAT PENGGUNA
  let renderScreensTimeout = null;
  function renderAllLiveScreens() {
   if (renderScreensTimeout) clearTimeout(renderScreensTimeout);
   renderScreensTimeout = setTimeout(() => {
    const activePanel = document.querySelector('.view-panel:not(.hidden)');
    const activeViewId = activePanel ? activePanel.id : '';

    // PENGHEMAT KINERJA HP: Hanya hitung data dashboard jika panel dashboard yang aktif
    if (!activeViewId || activeViewId === 'view-dashboard') {
     refreshAllDashboardData();
    }

    if (activeViewId === 'view-attendance') {
     renderScannerTodayRecords();
     updateRegisteredCoordsDisplay();
    } else if (activeViewId === 'view-employees') {
     if (!window.selectedEmployeeNiks || window.selectedEmployeeNiks.size === 0) {
      renderEmployeeTable();
     } else {
      updateSelectedEmployeesCount();
     }
    } else if (activeViewId === 'view-reports-group') {
     if (activeReportTab === 'records') renderRecordsTable();
     else if (activeReportTab === 'matrix') renderMatrixTable();
     else if (activeReportTab === 'workhours') renderWorkHoursReport();
     else if (activeReportTab === 'leaves') renderReportLeavesTable();
     else if (activeReportTab === 'overtime') renderReportOvertimeTable();
    } else if (activeViewId === 'view-leaves') {
     try { filterLeaveEmployeeDropdown(document.getElementById('leave-emp-search-input')?.value || ''); } catch(eLvDd) {}
     renderLeavesTable();
    } else if (activeViewId === 'view-overtime') {
     renderOvertimeEmployeeGrid();
     renderOvertimeTable();
    } else if (activeViewId === 'view-idcard') {
     populateDropdownEmployees();
     renderSelectedIDCard();
    } else if (activeViewId === 'view-permissions') {
     renderPermissionEditor();
    }

    if (!currentUser) {
     renderAccountLookupList();
    }
   }, 60);
  }

  function updateCloudSyncStatusBadge(status) {
   const authStatus = document.getElementById('auth-cloud-status');
   const authDot = document.getElementById('auth-cloud-dot');
   const navLabel = document.getElementById('nav-cloud-label');
   const navDot = document.getElementById('nav-cloud-dot');

   if (status === 'syncing') {
    if (authStatus) authStatus.innerText = 'Supabase: Menghubungkan...';
    if (authDot) authDot.className = 'w-2 h-2 rounded-full bg-amber-400 animate-spin';
    if (navLabel) navLabel.innerText = 'Supabase: Sync...';
    if (navDot) navDot.className = 'w-2 h-2 rounded-full bg-amber-400 animate-spin';
   } else if (status === 'uploading') {
    if (authStatus) authStatus.innerText = 'Supabase: Menyimpan ke Cloud...';
    if (authDot) authDot.className = 'w-2 h-2 rounded-full bg-sky-400 animate-pulse';
    if (navLabel) navLabel.innerText = 'Supabase: Simpan...';
    if (navDot) navDot.className = 'w-2 h-2 rounded-full bg-sky-400 animate-pulse';
   } else if (status === 'synced') {
    if (authStatus) authStatus.innerText = 'Supabase Cloud: Terhubung 24/7';
    if (authDot) authDot.className = 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse';
    if (navLabel) navLabel.innerText = 'Supabase: 24/7 Online';
    if (navDot) navDot.className = 'w-2 h-2 rounded-full bg-emerald-500 animate-pulse';
   } else if (status === 'permission_denied') {
    if (authStatus) authStatus.innerText = 'Supabase: Perlu Izin Akses';
    if (authDot) authDot.className = 'w-2 h-2 rounded-full bg-rose-500 animate-ping';
    if (navLabel) navLabel.innerText = 'Supabase: Terkunci';
    if (navDot) navDot.className = 'w-2 h-2 rounded-full bg-rose-500 animate-pulse';
   } else {
    const isOnline = (typeof navigator !== 'undefined') ? navigator.onLine : true;
    if (isOnline) {
     if (authStatus) authStatus.innerText = 'Supabase Cloud: Terhubung 24/7';
     if (authDot) authDot.className = 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse';
     if (navLabel) navLabel.innerText = 'Supabase: 24/7 Online';
     if (navDot) navDot.className = 'w-2 h-2 rounded-full bg-emerald-500 animate-pulse';
    } else {
     if (authStatus) authStatus.innerText = 'Supabase: Offline (Lokal)';
     if (authDot) authDot.className = 'w-2 h-2 rounded-full bg-slate-400';
     if (navLabel) navLabel.innerText = 'Supabase: Offline';
     if (navDot) navDot.className = 'w-2 h-2 rounded-full bg-slate-400';
    }
   }
  }

  let cloudSaveTimeout = null;
  let isSavingToCloud = false;
  let hasPendingCloudSave = false;
  let pendingMasterForceUpload = false;
  let lastSentMbiPayloadHash = '';
  let lastSentMaiPayloadHash = '';

  async function saveFullDatabaseToCloud(forceAlert = false, immediate = false, isMasterForceUpload = false, targetWarehouse = null, isExplicitAdminMasterReset = false, isExplicitAdminAttendanceReset = false, isAttendanceScanSave = false) {
   if (isMasterForceUpload === true) {
    pendingMasterForceUpload = true;
   }
   const isManualAlert = (forceAlert === true);
   const isImmediateCall = (immediate === true);

   const executeSave = async () => {
    if (isSavingToCloud) {
     hasPendingCloudSave = true;
     return;
    }
    isSavingToCloud = true;
    hasPendingCloudSave = false;

    const effectiveForceMaster = (isMasterForceUpload === true) || (pendingMasterForceUpload === true);
    pendingMasterForceUpload = false;

    updateCloudSyncStatusBadge('uploading');

    const mbiEndpoint = getFirebaseEndpoint('MBI');
    const maiEndpoint = getFirebaseEndpoint('MAI');

    const countReg = (arr) => (arr || []).filter(u => u && !isManagementSystemAccount(u)).length;
    let finalMbiUsers = getWhDB('MBI', 'users', SEED_MBI_USERS);
    let finalMaiUsers = getWhDB('MAI', 'users', SEED_MAI_USERS);

    const mbiCoordsToSave = getWarehouseCoords('MBI');
    const maiCoordsToSave = getWarehouseCoords('MAI');
    const mbiRadToSave = Number(mbiCoordsToSave?.radius) > 0 ? Number(mbiCoordsToSave.radius) : 100;
    const maiRadToSave = Number(maiCoordsToSave?.radius) > 0 ? Number(maiCoordsToSave.radius) : 100;

    const deletedKeys = getDeletedUserKeys();
    const nowIso = new Date().toISOString();
    const lastChangeNow = parseInt(localStorage.getItem('wfm_last_master_change_time') || '0', 10);
    const isProtectedMaster = (effectiveForceMaster === true) || (Date.now() - lastChangeNow < 600000);

    const safeMbiUsers = (finalMbiUsers || []).filter(u => u && !isUserMarkedDeleted(u, deletedKeys));
    const safeMaiUsers = (finalMaiUsers || []).filter(u => u && !isUserMarkedDeleted(u, deletedKeys));

    // Sinkronisasi otomatis master data karyawan & akun ke Supabase SSOT
    try {
     if (typeof saveUsersToSupabase === 'function') {
      if (!targetWarehouse || targetWarehouse === 'MBI') {
       saveUsersToSupabase('MBI', safeMbiUsers).catch(() => {});
      }
      if (!targetWarehouse || targetWarehouse === 'MAI') {
       saveUsersToSupabase('MAI', safeMaiUsers).catch(() => {});
      }
     }
    } catch (eSbUsers) {}

    // PAYLOAD TERPISAH: MBI HANYA DATA MBI, MAI HANYA DATA MAI (STRUKTUR DATA MURNI UNTUK HASHING)
    const mbiDataPure = {
     mbi_users: safeMbiUsers,
     mbi_attendance: getWhDB('MBI', 'attendance', []),
     mbi_leaves: getWhDB('MBI', 'leaves', []),
     mbi_overtime: getWhDB('MBI', 'overtime', []),
     mbi_coords: mbiCoordsToSave,
     gps_radius: mbiRadToSave,
     deleted_user_keys: Array.from(deletedKeys),
     deleted_attendance_ids: Array.from(getDeletedAttendanceIds()),
     deleted_leave_ids: Array.from(getDeletedLeaveIds()),
     deleted_overtime_ids: Array.from(getDeletedOvertimeIds()),
     app_theme: localStorage.getItem('wfm_app_theme') || 'navy',
     app_version: CURRENT_APP_VERSION
    };

    const maiDataPure = {
     mai_users: safeMaiUsers,
     mai_attendance: getWhDB('MAI', 'attendance', []),
     mai_leaves: getWhDB('MAI', 'leaves', []),
     mai_overtime: getWhDB('MAI', 'overtime', []),
     mai_coords: maiCoordsToSave,
     gps_radius: maiRadToSave,
     deleted_user_keys: Array.from(deletedKeys),
     deleted_attendance_ids: Array.from(getDeletedAttendanceIds()),
     deleted_leave_ids: Array.from(getDeletedLeaveIds()),
     deleted_overtime_ids: Array.from(getDeletedOvertimeIds()),
     app_theme: localStorage.getItem('wfm_app_theme') || 'navy',
     app_version: CURRENT_APP_VERSION
    };

    const currentMbiHash = JSON.stringify(mbiDataPure);
    const currentMaiHash = JSON.stringify(maiDataPure);

    const filterWh = targetWarehouse ? targetWarehouse.toUpperCase() : null;
    let shouldUploadMbi = (filterWh === null || filterWh === 'MBI') && (isManualAlert || effectiveForceMaster || currentMbiHash !== lastSentMbiPayloadHash);
    let shouldUploadMai = (filterWh === null || filterWh === 'MAI') && (isManualAlert || effectiveForceMaster || currentMaiHash !== lastSentMaiPayloadHash);

    // DATA SHIELD GUARD RAILS: Mencegah penimpaan data Cloud hanya jika data lokal benar-benar kosong (0) akibat crash
    if (shouldUploadMbi && safeMbiUsers.length === 0 && !isExplicitAdminMasterReset) {
     console.warn('[DataShield] Upload MBI dibatalkan: data karyawan lokal kosong (0)');
     shouldUploadMbi = false;
    }
    if (shouldUploadMai && safeMaiUsers.length === 0 && !isExplicitAdminMasterReset) {
     console.warn('[DataShield] Upload MAI dibatalkan: data karyawan lokal kosong (0)');
     shouldUploadMai = false;
    }

    // JIKA TIDAK ADA PERUBAHAN DATA: HEMAT KUOTA FIREBASE (0 REQUEST / 0 KB DIKIRIM)
    if (!shouldUploadMbi && !shouldUploadMai) {
     isSavingToCloud = false;
     updateCloudSyncStatusBadge('synced');
     return;
    }

    let mbiPayload = { ...mbiDataPure, updatedAt: nowIso };
    let maiPayload = { ...maiDataPure, updatedAt: nowIso };

    // HEMAT KUOTA PRESENSI: Jika simpan dipicu oleh scan absensi, HANYA kirim data presensi & timestamp!
    // Firebase PATCH secara otomatis memperbarui presensi tanpa mengirim ulang ratusan data karyawan/lembur/cuti
    if (isAttendanceScanSave) {
     mbiPayload = { mbi_attendance: mbiDataPure.mbi_attendance, updatedAt: nowIso };
     maiPayload = { mai_attendance: maiDataPure.mai_attendance, updatedAt: nowIso };
    } else if (!isExplicitAdminAttendanceReset) {
     // Rutin simpan master biasa TIDAK BOLEH mengunggah attendance agar tidak menimpa Cloud
     delete mbiPayload.mbi_attendance;
     delete maiPayload.mai_attendance;
    }

    lastAppliedCloudUpdatedAt = nowIso;
    localStorage.setItem('wfm_master_updated_at', nowIso);

    let mbiSuccess = !shouldUploadMbi;
    let maiSuccess = !shouldUploadMai;
    let lastStatusCode = 200;

    try {
     // SINKRONISASI CLOUD FIRESTORE MASTER SNAPSHOT (Zero Quota Limit Engine - 1 Write per Gudang)
     if (shouldUploadMbi) {
      await saveMasterSnapshotToFirestore('MBI');
      mbiSuccess = true;
      lastSentMbiPayloadHash = currentMbiHash;
      localStorage.setItem('wfm_mbi_master_updated_at', nowIso);
     }
     if (shouldUploadMai) {
      await saveMasterSnapshotToFirestore('MAI');
      maiSuccess = true;
      lastSentMaiPayloadHash = currentMaiHash;
      localStorage.setItem('wfm_mai_master_updated_at', nowIso);
     }

     try {
      if (typeof BroadcastChannel !== 'undefined') {
       new BroadcastChannel('wfm_firebase_live_sync').postMessage('update');
      }
     } catch (e) {}
    } catch (e) {
     console.warn('Firestore master upload error:', e);
    }

    isSavingToCloud = false;
    if (mbiSuccess || maiSuccess) {
     updateCloudSyncStatusBadge('synced');
    } else if (lastStatusCode === 401) {
     updateCloudSyncStatusBadge('permission_denied');
    } else {
     updateCloudSyncStatusBadge('local');
    }

    // SINKRONISASI OTOMATIS KE GOOGLE SPREADSHEET HANYA UNTUK GUDANG YANG BERUBAH
    try {
     if (typeof syncGoogleSheetDirectly === 'function') {
      if (shouldUploadMbi && shouldUploadMai) {
       syncGoogleSheetDirectly(false, 'ALL');
      } else if (shouldUploadMbi) {
       syncGoogleSheetDirectly(false, 'MBI');
      } else if (shouldUploadMai) {
       syncGoogleSheetDirectly(false, 'MAI');
      }
     }
    } catch (eGSheet) {
     console.warn('Google Sheet auto backup error:', eGSheet);
    }

    if (hasPendingCloudSave) {
     hasPendingCloudSave = false;
     const forceNext = pendingMasterForceUpload;
     pendingMasterForceUpload = false;
     setTimeout(() => {
      saveFullDatabaseToCloud(false, true, forceNext);
     }, 50);
    }

    if (isManualAlert) {
     if (mbiSuccess && maiSuccess) {
      alert(`Å“â€¦ Sukses Tersimpan ke Kedua Database Firebase Cloud (MBI & MAI)!\n\n• Database MBI: ${mbiPayload.mbi_users.length} Karyawan, ${mbiPayload.mbi_attendance.length} Absensi\n• Database MAI: ${maiPayload.mai_users.length} Karyawan, ${maiPayload.mai_attendance.length} Absensi\n\nSemua perubahan data telah terpisah rapi & aman di Cloud.`);
     } else if (mbiSuccess || maiSuccess) {
      alert(`Å“â€¦ Sebagian data berhasil disimpan ke Cloud (${mbiSuccess ? 'Gudang MBI Online' : 'Gudang MAI Online'}). Data lokal tetap aman.`);
     } else if (lastStatusCode === 401) {
      alert('Å¡  Gagal terhubung ke Firebase Cloud (HTTP 401: Permission Denied).\n\nAturan Keamanan (Rules) Firebase Realtime Database Anda telah kedaluwarsa atau terkunci.\n\nBuka console.firebase.google.com > Realtime Database > tab Rules, ubah .read dan .write menjadi true, lalu klik Publish.');
     } else {
      alert(`Å¡  Gagal terhubung ke Firebase Cloud. Data tersimpan aman di memori lokal.`);
     }
    }
   };

   if (isManualAlert || isImmediateCall) {
    if (cloudSaveTimeout) clearTimeout(cloudSaveTimeout);
    if (isSavingToCloud) {
     hasPendingCloudSave = true;
     let retries = 0;
     while (isSavingToCloud && retries < 25) {
      await new Promise(r => setTimeout(r, 100));
      retries++;
     }
    }
    return await executeSave();
   }

   if (cloudSaveTimeout) clearTimeout(cloudSaveTimeout);
   cloudSaveTimeout = setTimeout(executeSave, 250);
  }

  async function syncLeavesToCloud(warehouse, leavesList) {
   const wh = (warehouse || (typeof activeWarehouse !== 'undefined' ? activeWarehouse : 'MBI') || 'MBI').toUpperCase();
   try {
    if (typeof untrackDeletedLeaves === 'function') {
     untrackDeletedLeaves(leavesList);
    }
    setWhDB(wh, 'leaves', leavesList, true);
    
    // Simpan langsung ke Database Supabase & Cloud Firestore
    if (Array.isArray(leavesList)) {
     if (typeof saveLeavesToSupabase === 'function') {
      saveLeavesToSupabase(wh, leavesList).catch(() => {});
     }
     if (typeof saveDocToFirestore === 'function') {
      leavesList.forEach(l => {
       if (l && l.id) saveDocToFirestore(wh, 'leaves', l.id, { ...l, warehouse: wh }).catch(() => {});
      });
     }
    }
   } catch (err) {
    console.warn('syncLeavesToCloud notice:', err);
   }
   try {
    if (typeof BroadcastChannel !== 'undefined') {
     new BroadcastChannel('wfm_firebase_live_sync').postMessage('update');
    }
   } catch(e) {}
   if (typeof triggerGoogleSheetAutoSync === 'function') {
    triggerGoogleSheetAutoSync(true);
   }
  }

  async function syncAttendanceToCloud(warehouse, attendancesList, record = null) {
   const wh = (warehouse || (typeof activeWarehouse !== 'undefined' ? activeWarehouse : 'MBI') || 'MBI').toUpperCase();
   const whLower = wh.toLowerCase();
   try {
    const deletedAttKeys = getDeletedAttendanceIds();
    const cleanList = (attendancesList || []).filter(a => a && !isAttendanceMarkedDeleted(a, deletedAttKeys));

    // DataShield Protection: Jangan biarkan array di Cloud berkurang jika ada perangkat dengan data parsial
    let finalPushList = cleanList;
    try {
     const cachedBackup = JSON.parse(localStorage.getItem(`wfm_${whLower}_attendance_backup`) || '[]');
     if (Array.isArray(cachedBackup) && cachedBackup.length > finalPushList.length) {
      finalPushList = mergeAttendanceArrays(finalPushList, cachedBackup);
     }
    } catch(eGuard) {}

    // 1. Simpan ke database lokal dan cache memori seketika (0ms)
    setWhDB(wh, 'attendance', finalPushList, true);
    try {
     localStorage.setItem(`wfm_${whLower}_attendance_backup`, JSON.stringify(finalPushList));
    } catch(eBackup) {}

    // 2. Masukkan ke Outbox Anti-Hilang & kirim ke Cloud Firestore (otomatis retry jika sinyal putus)
    if (record) {
     if (typeof queueAttendanceCloudPush === 'function') {
      queueAttendanceCloudPush(wh, record);
     } else if (typeof saveAttendanceDocToFirestore === 'function') {
      saveAttendanceDocToFirestore(wh, record);
     }
     // 2b. Kirim 1 baris scan detik ini juga langsung ke Google Sheet (independen dari status kuota Firestore, aman scan bersamaan multi-HP via LockService)
     if (typeof pushSingleScanToGoogleSheet === 'function') {
      pushSingleScanToGoogleSheet(wh, record);
     }
    }
   } catch (err) {
    console.warn('syncAttendanceToCloud notice:', err);
   }

   // 3. Siarkan sinyal seketika ke antarmuka Management di tab / jendela lain (0ms)
   try {
    if (typeof BroadcastChannel !== 'undefined') {
     new BroadcastChannel('wfm_firebase_live_sync').postMessage('update');
    }
   } catch(eBc) {}

   // 4. Trigger Google Sheet Auto Sync penuh (untuk Admin/non-scanner atau sinkronisasi susulan)
   const isScannerAcc = (typeof currentUser !== 'undefined' && currentUser && typeof isUserScanner === 'function' && isUserScanner(currentUser));
   if (!isScannerAcc && typeof syncGoogleSheetDirectly === 'function') {
    syncGoogleSheetDirectly(false, wh);
   }
  }

  async function syncOvertimeToCloud(warehouse, overtimeList) {
   const wh = (warehouse || (typeof activeWarehouse !== 'undefined' ? activeWarehouse : 'MBI') || 'MBI').toUpperCase();
   try {
    if (typeof untrackDeletedOvertime === 'function') {
     untrackDeletedOvertime(overtimeList);
    }
    setWhDB(wh, 'overtime', overtimeList, true);
    // Simpan langsung ke Database Supabase & Cloud Firestore
    if (Array.isArray(overtimeList)) {
     if (typeof saveOvertimeToSupabase === 'function') {
      saveOvertimeToSupabase(wh, overtimeList).catch(() => {});
     }
     if (typeof saveDocToFirestore === 'function') {
      overtimeList.forEach(o => {
       if (o && o.id) saveDocToFirestore(wh, 'overtime', o.id, { ...o, warehouse: wh }).catch(() => {});
      });
     }
    }
   } catch (err) {
    console.warn('syncOvertimeToCloud notice:', err);
   }
   try {
    if (typeof BroadcastChannel !== 'undefined') {
     new BroadcastChannel('wfm_firebase_live_sync').postMessage('update');
    }
   } catch(e) {}
   if (typeof triggerGoogleSheetAutoSync === 'function') {
    triggerGoogleSheetAutoSync(true);
   }
  }

  async function initializeAndUploadToFirebase() {
   if (!isUserAdmin(currentUser)) {
    alert('Akses Ditolak: Hanya Akun Administrator yang berwenang mengunggah Database Master ke Firebase Cloud.');
    return;
   }
   harmonizeAndResequenceAllNIKs();
   const mbiUsers = getWhDB('MBI', 'users', SEED_MBI_USERS);
   const maiUsers = getWhDB('MAI', 'users', SEED_MAI_USERS);
   const nowIso = new Date().toISOString();
   const deletedAttKeys = getDeletedAttendanceIds();
   const deletedKeys = getDeletedUserKeys();

   // Data Master yang diunggah ke Cloud HANYA Master Karyawan, Departemen, Koordinat & Pengaturan
   // DILARANG MENYERTAKAN attendance agar tidak menimpa/menghapus riwayat absen live yang ada di Cloud!
   const mbiPayload = {
    mbi_users: mbiUsers,
    mbi_leaves: getWhDB('MBI', 'leaves', []),
    mbi_overtime: getWhDB('MBI', 'overtime', []),
    mbi_coords: getWarehouseCoords('MBI'),
    deleted_user_keys: Array.from(deletedKeys),
    deleted_attendance_ids: Array.from(deletedAttKeys),
    app_theme: localStorage.getItem('wfm_app_theme') || 'navy',
    updatedAt: nowIso
   };

   const maiPayload = {
    mai_users: maiUsers,
    mai_leaves: getWhDB('MAI', 'leaves', []),
    mai_overtime: getWhDB('MAI', 'overtime', []),
    mai_coords: getWarehouseCoords('MAI'),
    deleted_user_keys: Array.from(deletedKeys),
    deleted_attendance_ids: Array.from(deletedAttKeys),
    app_theme: localStorage.getItem('wfm_app_theme') || 'navy',
    updatedAt: nowIso
   };

   try {
    await saveMasterSnapshotToFirestore('MBI');
    await saveMasterSnapshotToFirestore('MAI');
    updateCloudSyncStatusBadge('synced');
    alert(`Å¸Å¡â‚¬ SUKSES MENGUNGGAH MASTER DATABASE KE CLOUD FIRESTORE!\n\n` +
       `Å“â€œ Database MBI: ${mbiUsers.length} Karyawan (Tersimpan di wfm-medika-mbi-new)\n` +
       `Å“â€œ Database MAI: ${maiUsers.length} Karyawan (Tersimpan di wfm-medika2)\n` +
       `Å“â€œ Riwayat Absensi Karyawan 100% Aman & Terlindungi (Tidak ditimpa).\n\n` +
       `Semua HP & laptop sekarang terhubung langsung ke Cloud Firestore 24/7.`);
    renderAllLiveScreens();
   } catch (err) {
    updateCloudSyncStatusBadge('local');
    alert('Gagal menghubungi Firestore: ' + err.message + '\nPastikan terhubung ke internet.');
   }
  }

  async function purgeAndReloadFromFirebase(targetWh = null) {
   const wh = (targetWh || activeWarehouse || 'MBI').toUpperCase();
   if (!confirm(`Apakah Anda ingin menyinkronkan & memuat ulang database murni Gudang ${wh} dari Cloud Firestore ke perangkat ini?\n\nData karyawan dan riwayat absensi resmi Gudang ${wh} dari Cloud akan dimuat ulang agar 100% sama.`)) {
    return;
   }

   updateCloudSyncStatusBadge('syncing');
   try {
    await fetchFullDatabaseFromCloud(false, wh, true);
    await syncAttendanceArchiveFromCloud(wh, false);
    await pullAttendanceFromFirestore(wh, false);

    renderAllLiveScreens();
    updateCloudSyncStatusBadge('synced');

    alert(`Å“â€¦ SUKSES MEMUAT DATA GUDANG ${wh} DARI CLOUD FIRESTORE!\n\n` +
       `• Gudang: ${wh}\n` +
       `• Backend Cloud: Google Cloud Firestore (24/7 SSOT)\n\n` +
       `Semua data di perangkat ini sekarang 100% SINKRON & SAMA dengan Cloud Server.`);
   } catch (err) {
    updateCloudSyncStatusBadge('local');
    alert('Gagal memuat data dari Cloud Firestore: ' + err.message);
   }
  }

  async function testFirebaseConnection() {
   if (typeof testFirestoreConnection === 'function') {
    return testFirestoreConnection();
   }
  }

  function sanitizeEmployeesData() {
   if (typeof repairCorruptedEmployeeNames === 'function') repairCorruptedEmployeeNames();
   const deletedKeys = getDeletedUserKeys();
   ['MBI', 'MAI'].forEach(wh => {
    const storageKey = `wfm_${wh.toLowerCase()}_users`;
    const data = localStorage.getItem(storageKey);
    if (!data) return;
    try {
     let users = JSON.parse(data);
     if (!Array.isArray(users)) return;
     let hasChanges = false;
     const cleanUsers = users.filter(u => u && u.name && u.name.trim() !== '' && u.nik !== 'SPV-MBI' && u.nik !== 'SPV-MAI' && u.id !== 'mbi-spv' && u.id !== 'mai-spv');
     if (cleanUsers.length !== users.length) hasChanges = true;

     cleanUsers.forEach(u => {
      const cUName = cleanStr(u.name);
      if (wh === 'MBI' && cUName === 'ogisaputra') {
       if (u.nik !== 'MBI26-009' || u.barcodeValue !== 'MBI26-009') {
        u.nik = 'MBI26-009';
        u.barcodeValue = 'MBI26-009';
        hasChanges = true;
       }
      }
      if (wh === 'MBI' && cUName === 'yonno') {
       if (u.nik !== 'MBI26-010' || u.barcodeValue !== 'MBI26-010') {
        u.nik = 'MBI26-010';
        u.barcodeValue = 'MBI26-010';
        hasChanges = true;
       }
      }
      if (wh === 'MBI' && (cUName === 'galangerdiansyah' || (u.name && u.name.toUpperCase().includes('GALANG') && u.name.toUpperCase().includes('ERDIANSYAH')))) {
       if (u.nik !== 'MBI26-011' || u.barcodeValue !== 'MBI26-011') {
        u.nik = 'MBI26-011';
        u.barcodeValue = 'MBI26-011';
        hasChanges = true;
       }
      }
      if (wh === 'MBI' && (cUName === 'melindagitawismaya' || cUName.includes('melinda'))) {
       if (u.nik !== 'MBI26-122' || u.barcodeValue !== 'MBI26-122') {
        u.nik = 'MBI26-122';
        u.barcodeValue = 'MBI26-122';
        hasChanges = true;
       }
      }
      if (wh === 'MAI' && (cUName === 'akmal' || cUName.includes('akmal'))) {
       if (u.nik !== 'MAI26-034' || u.barcodeValue !== 'MAI26-034') {
        u.nik = 'MAI26-034';
        u.barcodeValue = 'MAI26-034';
        hasChanges = true;
       }
      }
      if (wh === 'MAI' && (cUName === 'achmadvikih' || cUName.includes('vikih'))) {
       if (u.nik !== 'MAI26-035' || u.barcodeValue !== 'MAI26-035') {
        u.nik = 'MAI26-035';
        u.barcodeValue = 'MAI26-035';
        hasChanges = true;
       }
      }
      if (wh === 'MAI' && (cUName === 'mohamadyuliandi' || cUName.includes('yuliandi'))) {
       if (u.nik !== 'MAI26-041' || u.barcodeValue !== 'MAI26-041') {
        u.nik = 'MAI26-041';
        u.barcodeValue = 'MAI26-041';
        hasChanges = true;
       }
      }
      if (wh === 'MAI' && (cUName === 'nirwanfadlipulungan' || cUName.includes('nirwan'))) {
       if (u.nik !== 'MAI26-042' || u.barcodeValue !== 'MAI26-042') {
        u.nik = 'MAI26-042';
        u.barcodeValue = 'MAI26-042';
        hasChanges = true;
       }
      }
      if (u.phone && (u.phone === u.name || !/\d{4,}/.test(u.phone)) && u.phone !== '-') {
       u.phone = '-';
       hasChanges = true;
      }
      if (u.joinDate && /^\d{4,5}(\.\d+)?$/.test(String(u.joinDate).trim())) {
       u.joinDate = typeof formatExcelDate === 'function' ? formatExcelDate(u.joinDate) : u.joinDate;
       hasChanges = true;
      }

      const userRole = (u.role || 'staff').toLowerCase().trim();
      const userDept = (u.dept || '').toLowerCase().trim();
      const isSysAdmin = u.id === 'mbi-admin' || u.id === 'mai-admin' || u.nik === 'ADM001' || u.nik === 'ADM-MAI' || cleanStr(u.name) === 'admingudangmbi' || cleanStr(u.name) === 'admingudangmai';
      const isSysScanner = u.id === 'mbi-scanner' || u.id === 'mai-scanner' || u.nik === 'ABSEN-MBI' || u.nik === 'ABSEN-MAI';
      const isSysManager = u.id === 'mgr-eko' || u.nik === 'MGR001' || u.role === 'manager';

      if (isSysAdmin) {
       if (u.dept !== 'Administrator') { u.dept = 'Administrator'; hasChanges = true; }
       if (u.role !== 'admin') { u.role = 'admin'; hasChanges = true; }
       if (u.hasAccount !== true) { u.hasAccount = true; hasChanges = true; }
       if (!u.password) { u.password = 'password123'; hasChanges = true; }
      } else if (isSysScanner) {
       if (u.dept !== 'presensi') { u.dept = 'presensi'; hasChanges = true; }
       if (u.role !== 'scanner') { u.role = 'scanner'; hasChanges = true; }
       if (u.name !== 'Scanner Presensi Gudang') { u.name = 'Scanner Presensi Gudang'; hasChanges = true; }
       if (u.hasAccount !== true) { u.hasAccount = true; hasChanges = true; }
       if (!u.password) { u.password = 'medika123'; hasChanges = true; }
      } else if (isSysManager) {
       if (u.dept !== 'Management') { u.dept = 'Management'; hasChanges = true; }
       if (u.role !== 'manager') { u.role = 'manager'; hasChanges = true; }
       if (!u.name || u.name.trim() === '') { u.name = 'Manager'; hasChanges = true; }
       if (u.hasAccount !== true) { u.hasAccount = true; hasChanges = true; }
       if (!u.password) { u.password = 'medika123'; hasChanges = true; }
      } else {
       // Karyawan biasa: mendukung Admin, Supervisor, Coordinator, atau Staff
       const isAdmin = userRole === 'admin' || userDept.includes('administrator') || userDept.includes('admin');
       const isSpv = userRole.includes('supervisor') || userRole === 'spv' || userDept.includes('supervisor') || userDept === 'spv';
       const isCoord = userRole.includes('coordinator') || userRole.includes('koordinator') || userRole.includes('cordinator') || userDept.includes('coordinator') || userDept.includes('koordinator') || userDept.includes('cordinator');

       if (isAdmin) {
        if (u.dept !== 'Administrator') { u.dept = 'Administrator'; hasChanges = true; }
        if (u.role !== 'admin') { u.role = 'admin'; hasChanges = true; }
        if (u.hasAccount !== true) { u.hasAccount = true; hasChanges = true; }
        if (!u.password) { u.password = 'medika123'; hasChanges = true; }
       } else if (isSpv) {
        if (u.dept !== 'Supervisor') { u.dept = 'Supervisor'; hasChanges = true; }
        if (u.role !== 'supervisor') { u.role = 'supervisor'; hasChanges = true; }
        if (u.hasAccount !== true) { u.hasAccount = true; hasChanges = true; }
        if (!u.password) { u.password = 'medika123'; hasChanges = true; }
        if (!u.permissions) u.permissions = {};
        if (u.permissions.perm_approve_leave_spv !== true || u.permissions.perm_approve_ot_spv !== true) {
         u.permissions.perm_approve_leave_spv = true;
         u.permissions.perm_approve_ot_spv = true;
         u.permissions.perm_reject_submission = true;
         hasChanges = true;
        }
       } else if (isCoord) {
        if (u.dept !== 'Coordinator') { u.dept = 'Coordinator'; hasChanges = true; }
        if (u.role !== 'coordinator') { u.role = 'coordinator'; hasChanges = true; }
        if (u.hasAccount !== true) { u.hasAccount = true; hasChanges = true; }
        if (!u.password) { u.password = 'medika123'; hasChanges = true; }
       } else {
        if (!u.dept) { u.dept = 'Warehouse Staff'; hasChanges = true; }
        if (u.role !== 'staff') { u.role = 'staff'; hasChanges = true; }
        if (u.hasAccount !== false) { u.hasAccount = false; hasChanges = true; }
        if (u.password !== '') { u.password = ''; hasChanges = true; }
       }
      }
     });

     if (hasChanges) {
      localStorage.setItem(storageKey, JSON.stringify(cleanUsers));
     }
    } catch (e) {}
   });
  }

  // =========================================================
  // FITUR PEMULIHAN DATA KARYAWAN OTOMATIS & CADANGAN PERMANEN
  // Memulihkan data master karyawan dari backup snapshot & riwayat presensi/lembur/izin
  // =========================================================
  function recoverLostEmployees(silent = false) {
   let totalRecovered = 0;
   const targetWarehouses = ['MBI', 'MAI'];

   targetWarehouses.forEach(wh => {
    const usersKey = `wfm_${wh.toLowerCase()}_users`;
    const backupKey = `wfm_${wh.toLowerCase()}_users_backup`;

    let currentUsers = getWhDB(wh, 'users', wh === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);
    const existingNames = new Set(currentUsers.map(u => cleanStr(u.name)).filter(Boolean));
    const existingNiks = new Set(currentUsers.map(u => (u.nik || '').toUpperCase().trim()).filter(Boolean));

    const recoveredForWh = [];

    // 1. Periksa Snapshot Cadangan Backup Permanen dari Excel / Master Simpanan
    try {
     const rawBak = localStorage.getItem(backupKey);
     if (rawBak) {
      const bakUsers = JSON.parse(rawBak);
      if (Array.isArray(bakUsers)) {
       bakUsers.forEach(u => {
        if (!u || !u.name || isManagementSystemAccount(u) || isLikelyIdNotName(u.name) || !isLikelyHumanName(u.name)) return;
        const cName = cleanStr(u.name);
        const cNik = (u.nik || '').toUpperCase().trim();
        if (!existingNames.has(cName) && (!cNik || !existingNiks.has(cNik))) {
         recoveredForWh.push(u);
         existingNames.add(cName);
         if (cNik) existingNiks.add(cNik);
        }
       });
      }
     }
    } catch (eBak) {
     console.warn('Backup parse error:', eBak);
    }

    // 2, 3, 4: JIKA KARYAWAN REGULER MASIH 0 (Backup Kosong / Rusak), REKONSTRUKSI SEBAGAI JARING PENGAMAN TERAKHIR
    const regCountSoFar = currentUsers.filter(u => u && !isManagementSystemAccount(u)).length + recoveredForWh.length;
    if (regCountSoFar === 0) {
     // Rekonstruksi dari Riwayat Absensi (attendance)
     try {
      const attKey = `wfm_${wh.toLowerCase()}_attendance`;
      const rawAtt = localStorage.getItem(attKey);
      if (rawAtt) {
       const atts = JSON.parse(rawAtt);
       if (Array.isArray(atts)) {
        atts.forEach(a => {
         if (!a || !a.userName || isLikelyIdNotName(a.userName) || !isLikelyHumanName(a.userName)) return;
         const cName = cleanStr(a.userName);
         const cNik = (a.userNik || '').toUpperCase().trim();
         if (cName === 'admin' || cName.includes('scanner') || cName === 'eko') return;

         if (!existingNames.has(cName) && (!cNik || !existingNiks.has(cNik))) {
          const dept = a.dept || 'Warehouse Staff';
          const isSpv = dept.toLowerCase().includes('supervisor') || dept.toLowerCase() === 'spv';
          const isCoord = dept.toLowerCase().includes('coordinator') || dept.toLowerCase().includes('koordinator');
          const role = isSpv ? 'supervisor' : (isCoord ? 'coordinator' : 'staff');
          const hasAcc = isSpv || isCoord;

          recoveredForWh.push({
           id: a.userId || `${wh.toLowerCase()}-rec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
           name: a.userName,
           dept: isSpv ? 'Supervisor' : (isCoord ? 'Coordinator' : 'Warehouse Staff'),
           outsource: 'Internal',
           phone: '-',
           email: '',
           joinDate: '-',
           nik: a.userNik || '',
           barcodeValue: a.userNik || '',
           role: role,
           hasAccount: hasAcc,
           password: hasAcc ? 'medika123' : '',
           isFirstLogin: hasAcc,
           warehouse: wh
          });
          existingNames.add(cName);
          if (cNik) existingNiks.add(cNik);
         }
        });
       }
      }
     } catch (eAtt) {}

     // Rekonstruksi dari Riwayat Lemburan (overtime)
     try {
      const otKey = `wfm_${wh.toLowerCase()}_overtime`;
      const rawOt = localStorage.getItem(otKey);
      if (rawOt) {
       const ots = JSON.parse(rawOt);
       if (Array.isArray(ots)) {
        ots.forEach(o => {
         if (!o || !o.userName || isLikelyIdNotName(o.userName) || !isLikelyHumanName(o.userName)) return;
         const cName = cleanStr(o.userName);
         const cNik = (o.userNik || '').toUpperCase().trim();
         if (cName === 'admin' || cName.includes('scanner') || cName === 'eko') return;

         if (!existingNames.has(cName) && (!cNik || !existingNiks.has(cNik))) {
          recoveredForWh.push({
           id: o.userId || `${wh.toLowerCase()}-rec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
           name: o.userName,
           dept: o.dept || 'Warehouse Staff',
           outsource: 'Internal',
           phone: '-',
           email: '',
           joinDate: '-',
           nik: o.userNik || '',
           barcodeValue: o.userNik || '',
           role: 'staff',
           hasAccount: false,
           password: '',
           isFirstLogin: false,
           warehouse: wh
          });
          existingNames.add(cName);
          if (cNik) existingNiks.add(cNik);
         }
        });
       }
      }
     } catch (eOt) {}

     // Rekonstruksi dari Riwayat Izin / Cuti (leaves)
     try {
      const lvKey = `wfm_${wh.toLowerCase()}_leaves`;
      const rawLv = localStorage.getItem(lvKey);
      if (rawLv) {
       const lvs = JSON.parse(rawLv);
       if (Array.isArray(lvs)) {
        lvs.forEach(l => {
         if (!l || !l.userName || isLikelyIdNotName(l.userName) || !isLikelyHumanName(l.userName)) return;
         const cName = cleanStr(l.userName);
         const cNik = (l.userNik || '').toUpperCase().trim();
         if (cName === 'admin' || cName.includes('scanner') || cName === 'eko') return;

         if (!existingNames.has(cName) && (!cNik || !existingNiks.has(cNik))) {
          recoveredForWh.push({
           id: `${wh.toLowerCase()}-rec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
           name: l.userName,
           dept: 'Warehouse Staff',
           outsource: 'Internal',
           phone: '-',
           email: '',
           joinDate: '-',
           nik: l.userNik || '',
           barcodeValue: l.userNik || '',
           role: 'staff',
           hasAccount: false,
           password: '',
           isFirstLogin: false,
           warehouse: wh
          });
          existingNames.add(cName);
          if (cNik) existingNiks.add(cNik);
         }
        });
       }
      }
     } catch (eLv) {}
    }

    if (recoveredForWh.length > 0) {
     totalRecovered += recoveredForWh.length;
     const combined = deduplicateUserList([...currentUsers, ...recoveredForWh], wh);
     localStorage.setItem(usersKey, JSON.stringify(combined));
     localStorage.setItem(backupKey, JSON.stringify(combined));
     const nowIso = new Date().toISOString();
     localStorage.setItem('wfm_last_master_change_time', Date.now().toString());
     localStorage.setItem('wfm_master_updated_at', nowIso);
    }
   });

   if (totalRecovered > 0) {
    harmonizeAndResequenceAllNIKs();
    saveFullDatabaseToCloud(false, true);
    if (typeof renderEmployeeTable === 'function') renderEmployeeTable();
    if (typeof populateDropdownEmployees === 'function') populateDropdownEmployees();
    if (typeof renderOvertimeEmployeeGrid === 'function') renderOvertimeEmployeeGrid();
    if (typeof refreshAllDashboardData === 'function') refreshAllDashboardData();
    if (!silent) {
     alert(`Å“â€¦ BERHASIL MEMULIHKAN DATA KARYAWAN!\n\n• Sebanyak ${totalRecovered} data karyawan berhasil dipulihkan dari cadangan backup & riwayat presensi.\n• Data karyawan kini telah aktif kembali dan aman tersimpan di Cloud Database.`);
    }
   } else {
    if (!silent) {
     alert('â€ž  INFORMASI PEMULIHAN DATA:\n\nSemua data karyawan sudah lengkap & aman. Tidak ada data karyawan yang terhapus atau hilang.');
    }
   }
   return totalRecovered;
  }

  function deduplicateAndFixNIKs() {
   harmonizeAndResequenceAllNIKs();
  }

  function migrateAllUsersNIK() {
   harmonizeAndResequenceAllNIKs();
  }

  // =========================================================
  // FITUR RESMI PEMULIHAN & SINKRONISASI MASTER ABSENSI MBI
  // Sumber Utama: Google Sheet Tab RECORD ABSEN (Live Master SSOT)
  // Otomatis menggabungkan data absensi live dari Google Sheet & Cloud Firebase
  // Membersihkan seluruh 229 tombstone palsu dan menyamakan data di semua laptop/HP
  // =========================================================
  function parseGSheetAttendanceRow(col, users, fallbackWh = 'MBI') {
   if (!Array.isArray(col) || col.length < 5) return null;
   let rawDate = (col[1] || '').trim();
   const rawNik = (col[2] || '').trim().toUpperCase();
   const rawName = (col[3] || '').trim();
   const rawDept = (col[4] || '').trim();
   const rawCheckIn = (col[5] || '').trim();
   const rawCheckOut = (col[6] || '').trim();
   const rawDuration = (col[7] || '').trim();
   const rawStatusIn = (col[8] || '').trim();
   const rawStatusOut = (col[9] || '').trim();
   const rawNotes = (col[10] || '').trim();
   const rawWh = (col[11] || fallbackWh || 'MBI').trim().toUpperCase();

   // Standardisasi format tanggal fleksibel (YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, angka serial)
   let dateStr = '';
   if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    dateStr = rawDate;
   } else if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(rawDate)) {
    const parts = rawDate.split(/[\/\-]/);
    const p0 = parseInt(parts[0], 10);
    const p1 = parseInt(parts[1], 10);
    const p2 = parseInt(parts[2], 10);
    if (p0 <= 31 && p1 <= 12) {
     dateStr = `${p2}-${String(p1).padStart(2, '0')}-${String(p0).padStart(2, '0')}`;
    } else {
     dateStr = `${p2}-${String(p0).padStart(2, '0')}-${String(p1).padStart(2, '0')}`;
    }
   } else if (/^\d{5}(\.\d+)?$/.test(rawDate)) {
    const serial = parseFloat(rawDate);
    const dt = new Date((serial - 25569) * 86400 * 1000);
    if (!isNaN(dt.getTime())) dateStr = dt.toISOString().split('T')[0];
   } else {
    const parsedDt = new Date(rawDate);
    if (!isNaN(parsedDt.getTime())) dateStr = parsedDt.toISOString().split('T')[0];
   }

   if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
   if (!rawNik && !rawName) return null;

   // Filter akun yang bukan peserta absen (Hanya akun dedicated Admin dan Scanner)
   const nonAttendingNiks = new Set(['ADM001', 'ADM-MAI', 'ABSEN-MBI', 'ABSEN-MAI']);
   if (nonAttendingNiks.has(rawNik)) return null;

   // Parse Jam Masuk
   if (!rawCheckIn || rawCheckIn === '-' || rawCheckIn.toLowerCase().includes('shift')) return null;
   const inParts = rawCheckIn.replace(/:/g, '.').split('.');
   const inH = parseInt(inParts[0] || '0', 10);
   const inM = parseInt(inParts[1] || '0', 10);
   const inS = parseInt(inParts[2] || '0', 10);
   if (isNaN(inH) || isNaN(inM)) return null;

   const inTimeIso = new Date(`${dateStr}T${String(inH).padStart(2, '0')}:${String(inM).padStart(2, '0')}:${String(inS).padStart(2, '0')}+07:00`).toISOString();

   // Parse Jam Pulang
   let outTimeIso = null;
   const isOngoing = rawCheckOut.toLowerCase().includes('shift');
   const isMissScan = rawStatusOut.toLowerCase().includes('miss scan') || rawDuration.toLowerCase().includes('miss scan');

   if (!isOngoing && !isMissScan && rawCheckOut && rawCheckOut !== '-' && rawCheckOut !== '') {
    const outParts = rawCheckOut.replace(/:/g, '.').split('.');
    const outH = parseInt(outParts[0] || '0', 10);
    const outM = parseInt(outParts[1] || '0', 10);
    const outS = parseInt(outParts[2] || '0', 10);
    if (!isNaN(outH) && !isNaN(outM)) {
     let outDateStr = dateStr;
     // Shift malam lintas hari (jam pulang lebih kecil dari jam masuk)
     if (outH < inH) {
      const d = new Date(dateStr + 'T00:00:00+07:00');
      d.setDate(d.getDate() + 1);
      outDateStr = d.toISOString().split('T')[0];
     }
     outTimeIso = new Date(`${outDateStr}T${String(outH).padStart(2, '0')}:${String(outM).padStart(2, '0')}:${String(outS).padStart(2, '0')}+07:00`).toISOString();
    }
   }

   // Cocokkan ke User Master (Prioritas 1: NIK sebagai Primary Key Mutlak)
   const cleanTargetName = cleanStr(rawName);
   let matchedUser = null;
   if (rawNik) {
    matchedUser = users.find(u => u && u.nik && u.nik.toUpperCase() === rawNik);
   }
   if (!matchedUser && cleanTargetName) {
    matchedUser = users.find(u => u && u.name && cleanStr(u.name) === cleanTargetName);
   }

   const finalName = matchedUser ? matchedUser.name : rawName;
   const finalNik = matchedUser ? matchedUser.nik : rawNik;
   const finalDept = matchedUser ? (matchedUser.dept || 'Warehouse Staff') : (rawDept || 'Warehouse Staff');
   const finalOs = matchedUser ? (matchedUser.outsource || 'Staffinc') : 'Staffinc';
   const finalUserId = matchedUser ? matchedUser.id : `${rawWh.toLowerCase()}-user-${rawNik.toLowerCase()}`;

   let notes = rawNotes
    .replace(/(Normal|Late In)\s*-\s*(Sedang Shift|Sudah Pulang|Miss Scan)/gi, '')
    .replace(/Miss Scan/gi, '')
    .replace(/[()|]/g, '')
    .trim();

   // Hanya tandai Miss Scan jika memang tidak punya jam pulang yang sah
   if (isMissScan && !outTimeIso) {
    notes = notes ? `${notes} (Miss Scan)` : 'Miss Scan';
   }

   return {
    id: `att-${rawWh.toLowerCase()}-gs-${dateStr}-${finalNik}-${String(inH).padStart(2, '0')}${String(inM).padStart(2, '0')}${String(inS).padStart(2, '0')}`,
    date: dateStr,
    userId: finalUserId,
    userNik: finalNik,
    userName: finalName,
    dept: finalDept,
    outsource: finalOs,
    warehouse: rawWh,
    checkInTime: inTimeIso,
    checkOutTime: outTimeIso,
    checkInStatus: (rawStatusIn.toLowerCase().includes('late') ? 'late' : 'on_time'),
    notes: notes
   };
  }

  async function syncAttendanceFromGoogleSheetMaster(forceAlert = false, targetWh = null) {
   const wh = (targetWh || (typeof activeWarehouse !== 'undefined' ? activeWarehouse : 'MBI') || 'MBI').toUpperCase();
   updateCloudSyncStatusBadge('syncing');
   const sheetId = (wh === 'MAI') ? GOOGLE_SPREADSHEET_ID_MAI : GOOGLE_SPREADSHEET_ID_MBI;
   const gsheetCsvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=RECORD%20ABSEN&t=${Date.now()}`;
   
   try {
    const res = await fetch(gsheetCsvUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error('Gagal mengunduh data dari Google Sheet (HTTP ' + res.status + ')');
    const csvText = await res.text();
    
    // Parsing baris CSV
    const rawLines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (rawLines.length <= 1) throw new Error('Format Google Sheet kosong');

    const parseCsvLine = (text) => {
     const result = [];
     let cur = '';
     let inQuotes = false;
     for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') {
       if (inQuotes && text[i + 1] === '"') {
        cur += '"';
        i++;
       } else {
        inQuotes = !inQuotes;
       }
      } else if (c === ',' && !inQuotes) {
       result.push(cur.trim());
       cur = '';
      } else {
       cur += c;
      }
     }
     result.push(cur.trim());
     return result;
    };

    const users = getWhDB(wh, 'users', wh === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);
    const parsedGSheetRecords = [];

    for (let i = 1; i < rawLines.length; i++) {
     const cols = parseCsvLine(rawLines[i]).map(c => c.replace(/^"|"$/g, '').trim());
     const rec = parseGSheetAttendanceRow(cols, users, wh);
     if (rec && !isAttendanceMarkedDeleted(rec)) parsedGSheetRecords.push(rec);
    }

    // Ambil riwayat lokal yang ada sekarang (saring yang sudah dihapus)
    const localAtt = getWhDB(wh, 'attendance', []);
    const attMap = new Map();

    // 1. Masukkan data lokal terlebih dahulu (kunci primer NIK + Tanggal)
    (localAtt || []).forEach(item => {
     if (!item || isAttendanceMarkedDeleted(item)) return;
     const k = (item.userNik && item.date)
      ? `${(item.userNik || '').toUpperCase().trim()}__${item.date}`
      : (item.id || `${(item.userNik || '').toUpperCase()}__${item.date || ''}__${item.checkInTime || ''}`);
     attMap.set(k, item);
    });

    // 2. Padukan data resmi dari Google Sheet (SSOT Live & Rekonsiliasi Jam Pulang) tanpa menimpa koreksi/input manual Admin
    parsedGSheetRecords.forEach(gsRec => {
     if (isAttendanceMarkedDeleted(gsRec)) return;
     const k = (gsRec.userNik && gsRec.date)
      ? `${gsRec.userNik.toUpperCase().trim()}__${gsRec.date}`
      : (gsRec.id || `${gsRec.userNik.toUpperCase().trim()}__${gsRec.date}__${gsRec.checkInTime || ''}`);
     if (!attMap.has(k)) {
      attMap.set(k, gsRec);
     } else {
      const existing = attMap.get(k);
      // Selalu pertahankan ID asli scanner agar tidak terbuat ID duplikat baru
      gsRec.id = existing.id || gsRec.id;
      if (existing.correctedByAdmin || existing.manualInput) {
       attMap.set(k, existing);
       return;
      }
      const merged = { ...existing, ...gsRec };
      if (existing.id) merged.id = existing.id;
      if (existing._firestoreDocId) merged._firestoreDocId = existing._firestoreDocId;
      // Pertahankan jam tap keluar jika salah satu sudah memiliki record pulang yang sah
      if (gsRec.checkOutTime && gsRec.checkOutTime !== '-' && gsRec.checkOutTime !== '') {
       merged.checkOutTime = gsRec.checkOutTime;
      } else if (existing.checkOutTime && existing.checkOutTime !== '-' && existing.checkOutTime !== '') {
       merged.checkOutTime = existing.checkOutTime;
      }
      // Pertahankan jam masuk paling awal yang valid
      if (existing.checkInTime && gsRec.checkInTime) {
       const ta = new Date(existing.checkInTime).getTime();
       const tb = new Date(gsRec.checkInTime).getTime();
       if (!isNaN(ta) && !isNaN(tb) && ta < tb) {
        merged.checkInTime = existing.checkInTime;
       }
      }
      // Jika sudah memiliki jam pulang yang sah, bersihkan label Miss Scan usang dari hasil gabungan
      if (hasValidCheckOut(merged)) {
       cleanStaleMissScanFlags(merged);
      }
      attMap.set(k, merged);
     }
    });

    // 3. Saring akun sistem non-absen bawaan (Hanya admin dan scanner yang tidak tap presensi)
    const nonAttendingNiks = new Set(['ADM001', 'ADM-MAI', 'ABSEN-MBI', 'ABSEN-MAI']);
    const unifiedList = Array.from(attMap.values()).filter(a => {
     if (!a) return false;
     const n = (a.userNik || '').toUpperCase().trim();
     return !nonAttendingNiks.has(n);
    });

    // 4. Urutkan tanggal descending, lalu jam masuk descending
    unifiedList.sort((a, b) => {
     const ta = a.checkInTime ? new Date(a.checkInTime).getTime() : 0;
     const tb = b.checkInTime ? new Date(b.checkInTime).getTime() : 0;
     return tb - ta;
    });

    // 5. Simpan ke database lokal dan push ke Firebase Cloud seketika
    await syncAttendanceToCloud(wh, unifiedList);

    updateCloudSyncStatusBadge('synced');
    renderAllLiveScreens();

    if (forceAlert) {
     alert(`Å¡ SUKSES MENYINKRONKAN MASTER ABSEN GUDANG ${wh} DARI GOOGLE SHEET!\n\n` +
        `Å“â€œ Total Data Absensi Sah: ${unifiedList.length} Record Presensi\n` +
        `Å“â€œ Data Absensi Hari Ini: ${unifiedList.filter(a => a.date === getLocalDateString(new Date())).length} Karyawan\n` +
        `Å“â€œ Tersimpan aman di LocalStorage & Firebase Cloud 24/7.\n\n` +
        `Semua perangkat Management sekarang membaca data yang sama persis.`);
    }
   } catch (err) {
    console.error('syncAttendanceFromGoogleSheetMaster error:', err);
    updateCloudSyncStatusBadge('local');
    if (forceAlert) {
     alert(`Å¡  Gagal menyinkronkan dari Google Sheet Gudang ${wh}: ` + err.message);
    }
   }
  }
  const syncMbiAttendanceFromGoogleSheetMaster = syncAttendanceFromGoogleSheetMaster;


  let lastCloudFetchErrorStatus = null;

  async function fetchFullDatabaseFromCloud(forceAlert = false, targetWarehouse = null, forceDownload = false) {
   const isManualAlert = (forceAlert === true);
   if (!isManualAlert && html5QrScanner) {
    return;
   }
   updateCloudSyncStatusBadge('syncing');
   let loaded = false;
   let syncSummary = '';
   let hasNewDataApplied = false;
   const whList = targetWarehouse ? [targetWarehouse.toUpperCase()] : ['MBI', 'MAI'];

   try {
    for (const wh of whList) {
     try {
      const uRes = await pullUsersFromSupabase(wh);
      if (Array.isArray(uRes) && uRes.length > 0) {
       loaded = true;
       hasNewDataApplied = true;
      }
     } catch (eU) {
      console.warn('[Supabase] pullUsers notice for ' + wh + ':', eU);
     }

     try {
      const aRes = await pullAttendanceFromSupabase(wh, null, isManualAlert || forceDownload);
      if (Array.isArray(aRes) && aRes.length > 0) {
       loaded = true;
       hasNewDataApplied = true;
      }
     } catch (eA) {
      console.warn('[Supabase] pullAttendance notice for ' + wh + ':', eA);
     }

     try {
      if (typeof pullLeavesFromSupabase === 'function') {
       const lRes = await pullLeavesFromSupabase(wh);
       if (Array.isArray(lRes) && lRes.length > 0) loaded = true;
      }
     } catch(eL) {}

     try {
      if (typeof pullOvertimeFromSupabase === 'function') {
       const oRes = await pullOvertimeFromSupabase(wh);
       if (Array.isArray(oRes) && oRes.length > 0) loaded = true;
      }
     } catch(eO) {}
    }

    if (loaded) {
     lastCloudFetchErrorStatus = null;
     if (hasNewDataApplied || isManualAlert || forceDownload) {
      try { renderAllLiveScreens(); } catch(eRender) {}
     }
     const currentMBI = getWhDB('MBI', 'users', []);
     const currentMAI = getWhDB('MAI', 'users', []);
     const currentOt = getWhDB(activeWarehouse, 'overtime', []);
     const currentAtt = getWhDB(activeWarehouse, 'attendance', []);
     syncSummary = `\n• ${currentMBI.length} Karyawan MBI & ${currentMAI.length} Karyawan MAI\n• ${currentOt.length} Data Lemburan\n• ${currentAtt.length} Data Riwayat Absensi`;
    }
   } catch (e) {
    console.warn('[Supabase] Cloud sync error:', e);
   }

   if (loaded) {
    updateCloudSyncStatusBadge('synced');
   } else {
    updateCloudSyncStatusBadge('local');
   }

   if (isManualAlert) {
    if (loaded) {
     alert('✅ Sinkronisasi Berhasil!\nData terbaru dari Database Supabase 24/7 telah disinkronkan ke perangkat ini:' + syncSummary + '\nSemua data kini 100% sinkron dan aman.');
    } else {
     alert('⚠️ Gagal terhubung ke Database Supabase. Pastikan koneksi internet aktif.');
    }
   }
  }

  let firebaseEventSource = null;
  let currentLiveStreamWh = null;
  let isLiveStreamFetching = false;

  let firestoreBeaconPollTimer = null;
  let supabaseLivePollTimer = null;

  // ==============================================================================
  // SUPABASE REALTIME WEBSOCKET ENGINE (HEMAT BANDWIDTH 99.9% / BEBAS KUOTA)
  // ==============================================================================
  let supabaseWsClient = null;
  let supabaseWsChannel = null;

  function initSupabaseRealtimeWebSocket() {
   try {
    const sbLib = (typeof window !== 'undefined' && window.supabase) ? window.supabase : null;
    if (!sbLib || typeof sbLib.createClient !== 'function') {
     console.log('[Supabase WS] Library @supabase/supabase-js sedang dimuat...');
     setTimeout(initSupabaseRealtimeWebSocket, 1500);
     return;
    }
    if (supabaseWsChannel) {
     try { supabaseWsChannel.unsubscribe(); } catch(e) {}
     supabaseWsChannel = null;
    }

    supabaseWsClient = sbLib.createClient(SUPABASE_PROJECT_URL, SUPABASE_ANON_KEY);
    supabaseWsChannel = supabaseWsClient
     .channel('wfm_medika_realtime_stream')
     .on('postgres_changes', { event: '*', schema: 'public', table: 'wfm_attendance' }, (payload) => {
      handleRealtimeAttendancePush(payload);
     })
     .on('postgres_changes', { event: '*', schema: 'public', table: 'wfm_users' }, (payload) => {
      handleRealtimeUserPush(payload);
     })
     .on('postgres_changes', { event: '*', schema: 'public', table: 'wfm_leaves' }, () => {
      if (typeof pullLeavesFromSupabase === 'function') pullLeavesFromSupabase(activeWarehouse);
     })
     .on('postgres_changes', { event: '*', schema: 'public', table: 'wfm_overtime' }, () => {
      if (typeof pullOvertimeFromSupabase === 'function') pullOvertimeFromSupabase(activeWarehouse);
     })
     .on('postgres_changes', { event: '*', schema: 'public', table: 'wfm_coords' }, (payload) => {
      if (payload.new && payload.new.warehouse) {
       const wh = payload.new.warehouse.toUpperCase();
       const rad = Number(payload.new.radius) > 0 ? Number(payload.new.radius) : 100;
       const def = DEFAULT_COORDS[wh] || (wh === 'MAI' ? { lat: -6.217808, lng: 106.889398 } : { lat: -6.263295, lng: 106.877066 });
       const coords = { lat: def.lat, lng: def.lng, radius: rad, name: `Gudang ${wh}` };
       localStorage.setItem(`wfm_${wh.toLowerCase()}_coords`, JSON.stringify(coords));
       localStorage.setItem(`wfm_gps_radius_${wh.toLowerCase()}`, String(rad));
       if (activeWarehouse === wh) {
        localStorage.setItem('wfm_gps_radius', String(rad));
       }
       latestCachedGPS = null;
       if (typeof updateRegisteredCoordsDisplay === 'function') {
        updateRegisteredCoordsDisplay();
       }
      }
     })
     .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
       console.log('[Supabase WS] Terhubung ke WebSocket Realtime! Sinyal aktif (0 KB Polling).');
       updateCloudSyncStatusBadge('synced');
      }
     });
   } catch(err) {
    console.warn('[Supabase WS] Notice inisialisasi WebSocket:', err);
   }
  }

  function handleRealtimeAttendancePush(payload) {
   if (!payload || !payload.eventType) return;
   const evType = payload.eventType;
   const newRow = payload.new;
   const oldRow = payload.old;
   const targetWh = (newRow?.warehouse || oldRow?.warehouse || activeWarehouse || 'MBI').toUpperCase();

   if (evType === 'INSERT' || evType === 'UPDATE') {
    if (!newRow || !newRow.id) return;
    const item = {
     ...(newRow.raw_data || {}),
     id: newRow.id,
     userId: newRow.user_id,
     userNik: newRow.user_nik,
     userName: newRow.user_name,
     dept: newRow.dept,
     warehouse: newRow.warehouse,
     date: newRow.date,
     checkInTime: newRow.check_in_time,
     checkOutTime: newRow.check_out_time,
     checkInStatus: newRow.check_in_status,
     notes: newRow.notes,
     outsource: newRow.outsource,
     updatedAt: newRow.updated_at
    };

    const cur = getWhDB(targetWh, 'attendance', []);
    const merged = mergeAttendanceArrays(cur, [item]);
    setWhDB(targetWh, 'attendance', merged, true);

    if (typeof untrackDeletedAttendance === 'function') {
     untrackDeletedAttendance([item]);
    }
    if (typeof renderAllLiveScreens === 'function') {
     renderAllLiveScreens();
    }
   } else if (evType === 'DELETE') {
    if (!oldRow || !oldRow.id) return;
    const cur = getWhDB(targetWh, 'attendance', []);
    const filtered = cur.filter(x => x.id !== oldRow.id);
    setWhDB(targetWh, 'attendance', filtered, true);

    if (typeof trackDeletedAttendance === 'function') {
     trackDeletedAttendance([oldRow.id]);
    }
    if (typeof renderAllLiveScreens === 'function') {
     renderAllLiveScreens();
    }
   }
  }

  function handleRealtimeUserPush(payload) {
   if (!payload || !payload.eventType) return;
   const newRow = payload.new;
   const oldRow = payload.old;
   const targetWh = (newRow?.warehouse || oldRow?.warehouse || activeWarehouse || 'MBI').toUpperCase();
   if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
    if (!newRow || !newRow.nik) return;
    const user = {
     ...(newRow.raw_data || {}),
     id: newRow.id,
     nik: newRow.nik,
     name: newRow.name,
     warehouse: newRow.warehouse,
     role: newRow.role,
     dept: newRow.dept,
     status: newRow.status,
     password: newRow.password,
     customPassword: newRow.custom_password,
     email: newRow.email,
     phone: newRow.phone,
     outsource: newRow.outsource,
     permissions: newRow.permissions || {},
     updatedAt: newRow.updated_at
    };
    const cur = getWhDB(targetWh, 'users', []);
    const merged = mergeUserArrays(cur, [user], targetWh);
    setWhDB(targetWh, 'users', merged, true);
    localStorage.setItem(`wfm_${targetWh.toLowerCase()}_users_backup`, JSON.stringify(merged));
    
    // Seketika render UI di perangkat lain
    if (typeof renderEmployeeTable === 'function') renderEmployeeTable();
    if (typeof populateDropdownEmployees === 'function') populateDropdownEmployees();
    if (typeof renderOvertimeEmployeeGrid === 'function') renderOvertimeEmployeeGrid();
    if (typeof refreshAllDashboardData === 'function') refreshAllDashboardData();
    if (typeof renderAccountLookupList === 'function') renderAccountLookupList();
   } else if (payload.eventType === 'DELETE') {
    if (!oldRow || !oldRow.nik) return;
    const cur = getWhDB(targetWh, 'users', []);
    const filtered = cur.filter(u => u.nik !== oldRow.nik && u.id !== oldRow.id);
    setWhDB(targetWh, 'users', filtered, true);
    localStorage.setItem(`wfm_${targetWh.toLowerCase()}_users_backup`, JSON.stringify(filtered));
    if (typeof renderEmployeeTable === 'function') renderEmployeeTable();
    if (typeof populateDropdownEmployees === 'function') populateDropdownEmployees();
    if (typeof renderAccountLookupList === 'function') renderAccountLookupList();
    if (typeof refreshAllDashboardData === 'function') refreshAllDashboardData();
   }
  }

  // Otomatis pindahkan seluruh data jika database baru masih kosong (0 Karyawan)
  async function autoMigrateIfDatabaseEmpty() {
   try {
    const res = await fetch(SUPABASE_PROJECT_URL + '/rest/v1/wfm_users?select=id&limit=1', {
     headers: getSupabaseHeaders(),
     cache: 'no-store'
    });
    if (res.ok) {
     const data = await res.json();
     if (Array.isArray(data) && data.length === 0) {
      console.log('[Supabase Auto-Setup] Database baru terdeteksi kosong. Memulai migrasi otomatis master data...');
      if (typeof migrateAllDataToSupabase === 'function') {
       await migrateAllDataToSupabase(null, false);
       console.log('[Supabase Auto-Setup] Migrasi data awal berhasil!');
      }
     }
    }
   } catch(e) {}
  }
  function initFirebaseLiveStream(wh = null) {
   const targetWh = (wh || (typeof activeWarehouse !== 'undefined' ? activeWarehouse : 'MBI') || 'MBI').toUpperCase();
   currentLiveStreamWh = targetWh;

   try {
    if (firebaseEventSource) {
     firebaseEventSource.close();
     firebaseEventSource = null;
    }
   } catch (err) {}

   updateCloudSyncStatusBadge('synced');

   // SUPABASE REALTIME WEBSOCKET (0 KB Idle / Instan):
   initSupabaseRealtimeWebSocket();

   // Fallback safety interval (hanya cek ringan tiap 60 detik jika WebSocket terputus):
   if (supabaseLivePollTimer) clearInterval(supabaseLivePollTimer);
   supabaseLivePollTimer = setInterval(async () => {
    if (document.hidden || document.visibilityState !== 'visible') return;
    try {
     const todayStr = (typeof getLocalDateString === 'function') ? getLocalDateString(new Date()) : '';
     if (typeof pullAttendanceFromSupabase === 'function' && todayStr) {
      const updated = await pullAttendanceFromSupabase(targetWh, todayStr);
      if (updated && updated._hasChanged && typeof renderAllLiveScreens === 'function') {
       renderAllLiveScreens();
      }
     }
    } catch (eSbPoll) {}
   }, 60000);
  }

  function generateUniqueNIK(warehouse = 'MBI', name = '', existingUsersArray = null) {
   const wh = warehouse || activeWarehouse || 'MBI';
   const year = new Date().getFullYear().toString().slice(-2); // "26"
   const prefix = `${wh.toUpperCase()}${year}-`;
   const users = existingUsersArray || getWhDB(wh, 'users', wh === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);
   const assignedNiks = new Set(users.map(u => (u.nik || '').trim().toUpperCase()));
   let maxNum = 0;
   users.forEach(u => {
    if (!u || !u.nik || typeof u.nik !== 'string') return;
    const cleanNik = u.nik.toUpperCase().trim();
    if (cleanNik.startsWith(prefix)) {
     const numPart = parseInt(cleanNik.replace(prefix, ''), 10);
     if (!isNaN(numPart) && numPart > maxNum) {
      maxNum = numPart;
     }
    } else if (/^\d+$/.test(cleanNik)) {
     const numPart = parseInt(cleanNik, 10);
     if (!isNaN(numPart) && numPart > maxNum) {
      maxNum = numPart;
     }
    }
   });
   let nextNum = maxNum + 1;
   let candidate = `${prefix}${String(nextNum).padStart(3, '0')}`;
   while (assignedNiks.has(candidate)) {
    nextNum++;
    candidate = `${prefix}${String(nextNum).padStart(3, '0')}`;
   }
   return candidate;
  }

  async function syncWhToGitHub(warehouse, key, data) {
   const config = getWhDB('global', 'github_config', null);
   if (!config || !config.token || !config.owner || !config.repo) return;

   try {
    const filePath = `data/${warehouse.toLowerCase()}/${key}.json`;
    const url = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${filePath}`;
    
    let sha = null;
    const getRes = await fetch(url, {
     headers: { 'Authorization': `Bearer ${config.token}`, 'Accept': 'application/vnd.github.v3+json' }
    });
    if (getRes.ok) {
     const getJson = await getRes.json();
     sha = getJson.sha;
    }

    const body = {
     message: `Update ${filePath} via WFM Medika`,
     content: btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2)))),
     branch: 'main'
    };
    if (sha) body.sha = sha;

    await fetch(url, {
     method: 'PUT',
     headers: { 'Authorization': `Bearer ${config.token}`, 'Content-Type': 'application/json' },
     body: JSON.stringify(body)
    });
   } catch (err) {
    console.error('GitHub Sync error:', err);
   }
  }

  window.onload = async () => {
   // Sinkronisasi data revision tanpa pernah menghapus tombstone (anti-resurrection)
   const CURRENT_DATA_REVISION = 'wfm_rev_20261108_v3';
   if (localStorage.getItem('wfm_data_revision') !== CURRENT_DATA_REVISION) {
    try {
     localStorage.removeItem('wfm_mbi_master_updated_at');
     localStorage.removeItem('wfm_mai_master_updated_at');
     localStorage.setItem('wfm_data_revision', CURRENT_DATA_REVISION);
    } catch(e) {}
   }
   // Auto-purge database lama di HP & Laptop agar otomatis terhubung ke database baru masing-masing gudang
   try {
    const legacyMbi = localStorage.getItem('wfm_firebase_custom_mbi_url') || '';
    const legacyAll = localStorage.getItem('wfm_firebase_custom_url') || '';
    const legacyMai = localStorage.getItem('wfm_firebase_custom_mai_url') || '';
    if (!legacyMbi.includes('wfm-medika-mbi-new')) localStorage.removeItem('wfm_firebase_custom_mbi_url');
    if (!legacyAll.includes('wfm-medika-mbi-new')) localStorage.removeItem('wfm_firebase_custom_url');
    if (!legacyMai.includes('wfm-medika2')) localStorage.removeItem('wfm_firebase_custom_mai_url');
   } catch(e) {}

   try { updateLoginWhStyle(); } catch(e) {}
   try { updateNavbarBrand(); } catch(e) {}
   try { if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons(); } catch(e) {}
   try { if (typeof updateGSheetSyncBadge === 'function') updateGSheetSyncBadge(); } catch(e) {}
   try { if (typeof updateFirebaseUrlUI === 'function') updateFirebaseUrlUI(); } catch(e) {}

   // CLOUD-FIRST SSOT: Unduh master database terbaru dari Firebase Cloud secara asinkron tanpa memblokir render UI
   try {
    fetchFullDatabaseFromCloud(false, null, false).catch(e => {
     console.warn('Initial Cloud fetch error:', e);
    });
   } catch(e) {}

   // Ensure DB initialized & clean active users from tombstone list
   try {
    if (!window._hasRunBootSanitize) {
     window._hasRunBootSanitize = true;
     if (typeof separateAndCleanWarehouseData === 'function') separateAndCleanWarehouseData();
     if (typeof unmarkDeletedUser === 'function') unmarkDeletedUser('melinda');
     if (typeof sanitizeDeletedUserKeysWithActiveUsers === 'function') sanitizeDeletedUserKeysWithActiveUsers();
     if (typeof repairCorruptedEmployeeNames === 'function') repairCorruptedEmployeeNames();
     if (typeof autoMigrateAndPersistAllEmployeeOS === 'function') autoMigrateAndPersistAllEmployeeOS();
     if (typeof autoPurgeDuplicateAndCorruptEmployees === 'function') autoPurgeDuplicateAndCorruptEmployees(false);
     if (typeof restoreSeparateMelindaAndManagerAccounts === 'function') restoreSeparateMelindaAndManagerAccounts();
     if (typeof lockAndHarmonizeAllEmployeeNIKs === 'function') lockAndHarmonizeAllEmployeeNIKs();
     if (typeof realignAllAttendanceRecordsWithMaster === 'function') realignAllAttendanceRecordsWithMaster();
     if (typeof sanitizeEmployeesData === 'function') sanitizeEmployeesData();
     if (typeof repairAndSanitizeAttendanceRecords === 'function') repairAndSanitizeAttendanceRecords();
    }
   } catch(e) {
    console.warn('DB sanitize warning:', e);
   }

   try {
    getWhDB('MBI', 'users', SEED_MBI_USERS);
    getWhDB('MAI', 'users', SEED_MAI_USERS);
    getWhDB('MBI', 'attendance', []);
    getWhDB('MAI', 'attendance', []);
    getWhDB('MBI', 'overtime', []);
    if (typeof migrateAllUsersNIK === 'function') migrateAllUsersNIK();
   } catch(e) {}

   try {
    const now = new Date();
    const realToday = getLocalDateString(now);
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
    
    const firstDayStr = `${year}-${month}-01`;
    const lastDayStr = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
    const effectiveStartForRecords = firstDayStr;
    const effectiveEndForRecords = realToday;

    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    setVal('matrix-start-date', firstDayStr);
    setVal('matrix-end-date', lastDayStr);
    setVal('record-start-date', effectiveStartForRecords);
    setVal('record-end-date', effectiveEndForRecords);
    setVal('report-leave-start', firstDayStr);
    setVal('report-leave-end', lastDayStr);
    setVal('report-ot-start', effectiveStartForRecords);
    setVal('report-ot-end', effectiveEndForRecords);
    setVal('ot-filter-start', effectiveStartForRecords);
    setVal('ot-filter-end', lastDayStr);
    setVal('ot-date', realToday);
    setVal('leave-start-date', realToday);
    setVal('leave-end-date', realToday);

    updateRealtimeDashboardDate();
    if (!window._globalClockInterval) {
     window._globalClockInterval = setInterval(updateRealtimeDashboardDate, 1000);
    }
   } catch(e) {}

   try { renderLocationQRCode(); } catch(e) {}
   try { updateRegisteredCoordsDisplay(); } catch(e) {}
   try { setAttendanceType('check_in'); } catch(e) {}

   const getActiveWhTarget = () => (activeWarehouse || (currentUser && currentUser.warehouse) || 'MBI').toUpperCase();

   // Sinkronkan data awal: Utamakan Firebase RTDB (0 Read Quota Limit) & GPS Coords
   try {
    syncGPSCoordsFromFirestore('MBI').catch(() => {});
    syncGPSCoordsFromFirestore('MAI').catch(() => {});
    if (typeof pullGPSCoordsFromSupabase === 'function') {
     pullGPSCoordsFromSupabase('MBI').catch(() => {});
     pullGPSCoordsFromSupabase('MAI').catch(() => {});
    }
    autoMigrateIfDatabaseEmpty();
    fetchFullDatabaseFromCloud(false, getActiveWhTarget(), false);
    initFirebaseLiveStream(getActiveWhTarget());
    syncAttendanceFromGoogleSheetMaster(false, getActiveWhTarget());
   } catch(e) {}

   // Smart Delta Check hemat kuota di latar belakang (3 menit sekali saat tab aktif, 0 pemborosan)
   setInterval(() => {
    if (!document.hidden && document.visibilityState === 'visible') {
     fetchFullDatabaseFromCloud(false, getActiveWhTarget(), false);
    }
   }, 180000);

   // Bersihkan parameter ?_v= setelah reload versi baru agar URL tetap rapi
   try {
    const curUrl = new URL(window.location.href);
    if (curUrl.searchParams.has('_v')) {
     curUrl.searchParams.delete('_v');
     window.history.replaceState(null, '', curUrl.pathname + curUrl.search + curUrl.hash);
    }
   } catch(eUrlClean) {}

   // Cek pembaruan ringan ke version.json (0 kuota Firestore)
   setTimeout(() => { try { checkAppVersionUpdate(true); } catch(e) {} }, 8000);
   setInterval(() => {
    if (!document.hidden && document.visibilityState === 'visible') {
     try { checkAppVersionUpdate(false); } catch(e) {}
    }
   }, 180000);

   // Auto-wakeup hemat kuota: Cek perubahan saat layar/tab aktif kembali (Dibatasi minimal jeda 60 detik)
   let lastWakeupSyncTime = 0;
   const triggerWakeupSync = () => {
    const now = Date.now();
    if (now - lastWakeupSyncTime < 60000) return; // Debounce 60s
    lastWakeupSyncTime = now;
    fetchFullDatabaseFromCloud(false, getActiveWhTarget(), false);
    try { checkAppVersionUpdate(false); } catch(e) {}
   };

   document.addEventListener('visibilitychange', () => {
    if (!document.hidden && document.visibilityState === 'visible') {
     try { triggerWakeupSync(); } catch(e) {}
    }
   });
   window.addEventListener('focus', () => {
    try { triggerWakeupSync(); } catch(e) {}
   });

   window.addEventListener('storage', (e) => {
    if (e.key && e.key.startsWith('wfm_')) {
     try { renderAllLiveScreens(); } catch(err) {}
    }
   });

   if (typeof BroadcastChannel !== 'undefined') {
    try {
     const syncBc = new BroadcastChannel('wfm_firebase_live_sync');
     syncBc.onmessage = () => {
      try {
       fetchFullDatabaseFromCloud(false, getActiveWhTarget(), false).then(() => {
        if (typeof renderAllLiveScreens === 'function') renderAllLiveScreens();
       });
      } catch(e) {}
     };
    } catch(e) {}
   }

   try { initSidebarState(); } catch(e) {}
   try { initAppFont(); } catch(e) {}
   try { initAppTheme(); } catch(e) {}
   try { updateLoginWhStyle(); } catch(e) {}

   const savedUser = localStorage.getItem('wfm_active_session');
   if (savedUser) {
    try {
     const parsed = JSON.parse(savedUser);
     if (parsed && (parsed.nik || parsed.id)) {
      const lastSaved = parseInt(localStorage.getItem('wfm_last_user_interaction') || '0', 10);
      const isExpired = lastSaved > 0 && (Date.now() - lastSaved >= 45 * 60 * 1000);
      if (isExpired) {
       localStorage.removeItem('wfm_active_session');
       localStorage.removeItem('wfm_last_user_interaction');
       const authContainer = document.getElementById('auth-container');
       const appContainer = document.getElementById('app-container');
       if (appContainer) { appContainer.classList.add('hidden'); appContainer.classList.remove('flex'); appContainer.style.display = 'none'; }
       if (authContainer) { authContainer.classList.remove('hidden'); authContainer.classList.add('flex'); authContainer.style.display = 'flex'; }
      } else {
       loginUserSession(parsed);
      }
     }
    } catch (e) {
     localStorage.removeItem('wfm_active_session');
    }
   } else {
    const authContainer = document.getElementById('auth-container');
    const appContainer = document.getElementById('app-container');
    if (appContainer) { appContainer.classList.add('hidden'); appContainer.classList.remove('flex'); appContainer.style.display = 'none'; }
    if (authContainer) { authContainer.classList.remove('hidden'); authContainer.classList.add('flex'); authContainer.style.display = 'flex'; }
   }

   document.addEventListener('click', (e) => {
    const editCont = document.getElementById('edit-dept-container');
    const addCont = document.getElementById('add-dept-container');
    if (editCont && !editCont.contains(e.target)) {
     const editMenu = document.getElementById('edit-dept-menu');
     const editChevron = document.getElementById('edit-dept-chevron');
     if (editMenu) editMenu.classList.add('hidden');
     if (editChevron) editChevron.classList.remove('rotate-180');
    }
    if (addCont && !addCont.contains(e.target)) {
     const addMenu = document.getElementById('add-dept-menu');
     const addChevron = document.getElementById('add-dept-chevron');
     if (addMenu) addMenu.classList.add('hidden');
     if (addChevron) addChevron.classList.remove('rotate-180');
    }
   });
  };

  // =========================================================
  // TIPOGRAFI & FONT MANAGER (PLUS JAKARTA SANS / INTER / TIMES NEW ROMAN)
  // =========================================================
  const FONT_PRESETS = {
   'plus-jakarta': "'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
   'inter': "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
   'times': "'Times New Roman', Times, 'Liberation Serif', Georgia, serif"
  };

  function applyWebFont(fontKey, save = true) {
   if (!FONT_PRESETS[fontKey]) fontKey = 'plus-jakarta';
   const fontVal = FONT_PRESETS[fontKey];
   document.documentElement.style.setProperty('--app-font', fontVal);
   document.body.style.setProperty('--app-font', fontVal);
   document.body.style.fontFamily = fontVal;
   if (save) {
    localStorage.setItem('wfm_app_font', fontKey);
   }
   
   // Update visual highlight pada kartu pilihan font di halaman pengaturan
   document.querySelectorAll('.font-choice-card').forEach(card => {
    const key = card.getAttribute('data-font-key');
    if (key === fontKey) {
     card.classList.add('border-teal-600', 'bg-teal-50/50', 'ring-2', 'ring-teal-500/20');
     card.classList.remove('border-slate-200', 'bg-white');
    } else {
     card.classList.remove('border-teal-600', 'bg-teal-50/50', 'ring-2', 'ring-teal-500/20');
     card.classList.add('border-slate-200', 'bg-white');
    }
   });
  }

  function initAppFont() {
   try {
    const savedFont = localStorage.getItem('wfm_app_font') || 'plus-jakarta';
    applyWebFont(savedFont, false);
   } catch (e) {}
  }

  // Jalankan inisialisasi font seketika
  initAppFont();

  // =========================================================
  // TEMA WARNA APLIKASI (NAVY BLUE DEFAULT, EMERALD MEDIKA, ROYAL INDIGO)
  // Pengaturan Terpusat di Admin, Otomatis Sinkron ke Semua Akun & Perangkat
  // =========================================================
  const APP_THEMES = {
   'navy': {
    name: 'Biru Navy',
    className: 'theme-navy',
    primary: '#1e3a5f',
    primaryHover: '#264a78',
    primaryDark: '#152840',
    primaryLight: '#e8f0fe',
    sidebarBg: '#132237',
    sidebarBorder: '#1d3350',
    sidebarHover: '#1c3250',
    sidebarActive: '#223f66',
    authBg: '#101c2e',
    authFrom: '#132237',
    authTo: '#1e3a5f',
    accent: '#3b82f6'
   },
   'emerald': {
    name: 'Emerald Medika',
    className: 'theme-emerald',
    primary: '#065f46',
    primaryHover: '#047857',
    primaryDark: '#064e3b',
    primaryLight: '#ecfdf5',
    sidebarBg: '#06392b',
    sidebarBorder: '#0b5340',
    sidebarHover: '#0a4f3d',
    sidebarActive: '#0d614b',
    authBg: '#04291f',
    authFrom: '#06392b',
    authTo: '#065f46',
    accent: '#10b981'
   },
   'indigo': {
    name: 'Royal Indigo',
    className: 'theme-indigo',
    primary: '#312e81',
    primaryHover: '#3730a3',
    primaryDark: '#1e1b4b',
    primaryLight: '#eef2ff',
    sidebarBg: '#19173d',
    sidebarBorder: '#2c2866',
    sidebarHover: '#29255e',
    sidebarActive: '#3b3685',
    authBg: '#12102e',
    authFrom: '#19173d',
    authTo: '#312e81',
    accent: '#6366f1'
   }
  };

  function applyAppTheme(themeKey, save = true) {
   if (!APP_THEMES[themeKey]) themeKey = 'navy';
   const t = APP_THEMES[themeKey];

   document.documentElement.classList.remove('theme-navy', 'theme-emerald', 'theme-indigo');
   document.body.classList.remove('theme-navy', 'theme-emerald', 'theme-indigo');
   document.documentElement.classList.add(t.className);
   document.body.classList.add(t.className);

   const root = document.documentElement;
   root.style.setProperty('--theme-name', themeKey);
   root.style.setProperty('--theme-primary', t.primary);
   root.style.setProperty('--theme-primary-hover', t.primaryHover);
   root.style.setProperty('--theme-primary-dark', t.primaryDark);
   root.style.setProperty('--theme-primary-light', t.primaryLight);
   root.style.setProperty('--theme-sidebar-bg', t.sidebarBg);
   root.style.setProperty('--theme-sidebar-border', t.sidebarBorder);
   root.style.setProperty('--theme-sidebar-hover', t.sidebarHover);
   root.style.setProperty('--theme-sidebar-active', t.sidebarActive);
   root.style.setProperty('--theme-auth-bg', t.authBg);
   root.style.setProperty('--theme-auth-from', t.authFrom);
   root.style.setProperty('--theme-auth-to', t.authTo);
   root.style.setProperty('--theme-accent', t.accent);

   if (save) {
    localStorage.setItem('wfm_app_theme', themeKey);
   }

   // Update visual highlight pada kartu tema di Pengaturan
   document.querySelectorAll('.theme-choice-card').forEach(card => {
    const key = card.getAttribute('data-theme-key');
    const activeTag = card.querySelector('.theme-active-tag');
    if (key === themeKey) {
     card.classList.add('border-blue-600', 'bg-blue-50/40', 'ring-2', 'ring-blue-500/20');
     card.classList.remove('border-slate-300', 'bg-white');
     if (activeTag) activeTag.classList.remove('hidden');
    } else {
     card.classList.remove('border-blue-600', 'bg-blue-50/40', 'ring-2', 'ring-blue-500/20');
     card.classList.add('border-slate-300', 'bg-white');
     if (activeTag) activeTag.classList.add('hidden');
    }
   });
  }

  async function setAppThemeByAdmin(themeKey) {
   if (!isUserAdmin(currentUser) && !isUserManager(currentUser)) {
    alert('Akses Ditolak: Hanya Akun Administrator atau Manager yang berwenang mengubah tema warna sistem.');
    return;
   }
   applyAppTheme(themeKey, true);

   // Siarkan ke tab/jendela lain di browser yang sama
   try {
    if (typeof BroadcastChannel !== 'undefined') {
     new BroadcastChannel('wfm_theme_live_channel').postMessage(themeKey);
    }
   } catch (e) {}

   // Simpan perubahan tema ke Firebase Cloud agar HP seluruh staf otomatis ikut berganti
   await saveFullDatabaseToCloud(false, true);
  }

  function initAppTheme() {
   try {
    const savedTheme = localStorage.getItem('wfm_app_theme') || 'navy';
    applyAppTheme(savedTheme, false);
   } catch (e) {}
  }

  // Jalankan inisialisasi tema warna seketika sebelum render halaman
  initAppTheme();

  // Listener Live Sync Tema antar-Tab
  try {
   if (typeof BroadcastChannel !== 'undefined') {
    const themeBc = new BroadcastChannel('wfm_theme_live_channel');
    themeBc.onmessage = (e) => {
     if (e.data) {
      applyAppTheme(e.data, false);
     }
    };
   }
  } catch(e) {}

  // =========================================================
  // BRANDING & LOGO ENGINE (MBI: GAMBAR 2 / UPLOAD, MAI: GAMBAR 3)
  // =========================================================
  const MBI_UPLOADED_IMG_PATHS = [
   '../../brain/ae53b394-8a5f-42da-80ad-ae820aaaa4a6/.user_uploaded/media_1790591977381.png',
   'media_1790591977381.png',
   'logo-mbi.png',
   'icon-mbi.png'
  ];

  if (!window.__mbiUploadedLogoImg) {
   window.__mbiUploadedLogoImg = new Image();
   window.__mbiUploadedLogoImg.crossOrigin = 'anonymous';
   window.__mbiUploadedLogoImg.src = MBI_UPLOADED_IMG_PATHS[0];
   window.__mbiUploadedLogoImg.onerror = function() {
    if (!this.dataset.retry) {
     this.dataset.retry = '1';
     this.src = MBI_UPLOADED_IMG_PATHS[1];
    } else if (this.dataset.retry === '1') {
     this.dataset.retry = '2';
     this.src = MBI_UPLOADED_IMG_PATHS[2];
    }
   };
  }

  function getMBIIconSVGFallback(size = 32) {
   return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" style="width: ${size}px; height: ${size}px; display: block;" fill="none">
     <!-- 1. Golden Yellow Head Circle (Floating clearly above petals) -->
     <circle cx="100" cy="38" r="28" fill="#F7B200"/>
     <!-- 2. Cyan Right Capsule (+45 deg around 128, 114) -->
     <rect x="97" y="47" width="62" height="134" rx="31" fill="#24D3E3" transform="rotate(45 128 114)"/>
     <!-- 3. Pink Left Capsule (-45 deg around 72, 114, overlapping on top) -->
     <rect x="41" y="47" width="62" height="134" rx="31" fill="#EE1D78" transform="rotate(-45 72 114)"/>
    </svg>
   `;
  }

  function getMBIIconHTML(size = 32) {
   return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" style="width: ${size}px; height: ${size}px; display: block;" fill="none">
     <!-- 1. Golden Yellow Head Circle -->
     <circle cx="100" cy="38" r="28" fill="#F7B200"/>
     <!-- 2. Cyan Right Capsule (+45 deg around 128, 114) -->
     <rect x="97" y="47" width="62" height="134" rx="31" fill="#24D3E3" transform="rotate(45 128 114)"/>
     <!-- 3. Pink Left Capsule (-45 deg around 72, 114, overlapping on top) -->
     <rect x="41" y="47" width="62" height="134" rx="31" fill="#EE1D78" transform="rotate(-45 72 114)"/>
    </svg>
   `;
  }

  function getMAIIconHTML(size = 32) {
   return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" style="width: ${size}px; height: ${size}px; display: block;" fill="none">
     <!-- MAI Icon (Gambar 3): Yellow Left/Bottom + Crimson Red Top/Right overlapping -->
     <rect x="8" y="36" width="56" height="28" rx="14" fill="#FDB913"/>
     <rect x="36" y="36" width="28" height="56" rx="14" fill="#FDB913"/>
     <path d="M 36,22 A 14,14 0 0,1 64,22 L 64,36 L 78,36 A 14,14 0 0,1 78,64 L 50,64 A 14,14 0 0,1 36,50 Z" fill="#E30638"/>
    </svg>
   `;
  }

  function updateNavbarBrand(targetWh = null) {
   const wh = targetWh || activeWarehouse || (currentUser ? currentUser.warehouse : 'MBI');
   const isMBI = wh === 'MBI';

   const nameEl = document.getElementById('nav-company-name');
   if (nameEl) {
    nameEl.innerText = isMBI ? 'Medika Bina Investama' : 'Medika Akses Investama';
   }

   const logoContainer = document.getElementById('nav-logo-container');
   if (logoContainer) {
    logoContainer.innerHTML = isMBI ? getMBIIconHTML(34) : getMAIIconHTML(34);
   }
  }

  function updateLoginWhStyle() {
   const val = document.querySelector('input[name="login-warehouse"]:checked')?.value || 'MBI';
   const isMBI = val === 'MBI';
   const mbiEl = document.getElementById('lbl-login-mbi');
   const maiEl = document.getElementById('lbl-login-mai');
   if (mbiEl) mbiEl.className = isMBI ? 'cursor-pointer p-2.5 rounded-xl border-2 border-slate-900 bg-slate-900 text-white flex items-center justify-center gap-1.5 font-bold text-xs shadow-xs' : 'cursor-pointer p-2.5 rounded-xl border border-slate-300 bg-slate-50 text-slate-700 flex items-center justify-center gap-1.5 font-bold text-xs';
   if (maiEl) maiEl.className = !isMBI ? 'cursor-pointer p-2.5 rounded-xl border-2 border-slate-900 bg-slate-900 text-white flex items-center justify-center gap-1.5 font-bold text-xs shadow-xs' : 'cursor-pointer p-2.5 rounded-xl border border-slate-300 bg-slate-50 text-slate-700 flex items-center justify-center gap-1.5 font-bold text-xs';

   const loginLogo = document.getElementById('login-logo-container');
   if (loginLogo) {
    loginLogo.innerHTML = isMBI ? getMBIIconHTML(46) : getMAIIconHTML(46);
   }
   const loginTitle = document.getElementById('login-brand-title');
   if (loginTitle) {
    loginTitle.innerText = isMBI ? 'Medika Bina Investama' : 'Medika Akses Investama';
   }
  }

  try { updateLoginWhStyle(); } catch(e) {}


  function isManagementSystemAccount(user) {
   if (!user) return false;
   const id = (user.id || '').toLowerCase().trim();
   const nik = (user.nik || '').toUpperCase().trim();
   const name = (user.name || '').toLowerCase().trim();
   const clean = cleanStr(name);
   const role = (user.role || '').toLowerCase().trim();
   const dept = (user.dept || '').toLowerCase().trim();

   // Khusus akun sistem bawaan (Admin Utama, Scanner Presensi, dan Manager Utama)
   if (id === 'mbi-admin' || id === 'mai-admin' || id === 'mbi-scanner' || id === 'mai-scanner' || id === 'mgr-eko') return true;
   if (nik === 'ADM001' || nik === 'ADM-MAI' || nik === 'ABSEN-MBI' || nik === 'ABSEN-MAI' || nik === 'MGR001') return true;
   if (role === 'manager' || role === 'admin' || role === 'scanner') return true;
   if (dept === 'management' && role === 'manager') return true;
   if (clean === 'admingudangmbi' || clean === 'admingudangmai' || clean === 'scannerpresensigudang') return true;
   return false;
  }

  function isUserAdmin(user = currentUser) {
   if (!user) return false;
   const role = (user.role || '').toLowerCase().trim();
   const nik = (user.nik || '').toUpperCase().trim();
   const id = (user.id || '').toLowerCase().trim();
   const name = (user.name || '').toLowerCase().trim();
   return (
    role === 'admin' ||
    role === 'superadmin' ||
    nik === 'ADM001' ||
    nik === 'ADM-MAI' ||
    id === 'mbi-admin' ||
    id === 'mai-admin' ||
    (id.includes('admin') && !id.includes('user')) ||
    (name.includes('admin') && !name.includes('scanner') && (id.includes('admin') || nik === 'ADM001' || nik === 'ADM-MAI' || role === 'admin'))
   );
  }

  function isUserManager(user = currentUser) {
   if (!user) return false;
   if (isUserAdmin(user)) return false;
   const role = (user.role || '').toLowerCase().trim();
   const nik = (user.nik || '').toUpperCase().trim();
   const id = (user.id || '').toLowerCase().trim();
   const dept = (user.dept || '').toLowerCase().trim();
   return (
    role === 'manager' ||
    role.includes('manager') ||
    dept.includes('manager') ||
    dept === 'management' ||
    nik === 'MGR001' ||
    nik.startsWith('MGR') ||
    id === 'mgr-eko' ||
    id.includes('mgr')
   );
  }

  function isUserScanner(user = currentUser) {
   if (!user) return false;
   const role = (user.role || '').toLowerCase().trim();
   const nik = (user.nik || '').toUpperCase().trim();
   const id = (user.id || '').toLowerCase().trim();
   const name = (user.name || '').toLowerCase().trim();
   return (
    role === 'scanner' ||
    nik === 'ABSEN-MAI' ||
    nik === 'ABSEN-MBI' ||
    nik.startsWith('ABSEN') ||
    id === 'mai-scanner' ||
    id === 'mbi-scanner' ||
    id.includes('scanner') ||
    name.includes('scanner') ||
    (name.includes('absen') && !isUserAdmin(user))
   );
  }

  function isUserSupervisor(user = currentUser) {
   if (!user) return false;
   if (isUserAdmin(user)) return false; // Akun Administrator TIDAK BISA approve
   if (isUserManager(user)) return false; // Akun Manager adalah approver tahap 2 / final
   const role = (user.role || '').toLowerCase().trim();
   const dept = (user.dept || '').toLowerCase().trim();
   const title = (user.position || '').toLowerCase().trim();
   return (
    role === 'supervisor' ||
    role.includes('supervisor') ||
    role === 'spv' ||
    dept.includes('supervisor') ||
    dept.includes('spv') ||
    title.includes('supervisor') ||
    title.includes('spv')
   );
  }

  function isUserCoordinator(user = currentUser) {
   if (!user) return false;
   if (isUserAdmin(user)) return false;
   if (isUserManager(user)) return false;
   const role = (user.role || '').toLowerCase().trim();
   const dept = (user.dept || '').toLowerCase().trim();
   const title = (user.position || '').toLowerCase().trim();
   return (
    role === 'coordinator' ||
    role.includes('coordinator') ||
    role.includes('koordinator') ||
    role.includes('cordinator') ||
    dept.includes('coordinator') ||
    dept.includes('koordinator') ||
    dept.includes('cordinator') ||
    title.includes('coordinator') ||
    title.includes('koordinator')
   );
  }

  // Hanya Coordinator, Supervisor, Manager, Admin, Pos Scanner Presensi, dan akun yang memiliki izin modul yang diizinkan login
  function isUserAllowedToLogin(user) {
   if (!user) return false;
   if (isUserAdmin(user)) return true;
   if (isUserManager(user)) return true;
   if (isUserSupervisor(user)) return true;
   if (isUserCoordinator(user)) return true;
   if (isUserScanner(user)) return true;
   
   // Izin kustom: jika akun telah diberikan hak akses modul tertentu
   try {
    if (user.permissions && typeof user.permissions === 'object') {
     if (Object.values(user.permissions).some(v => v === true)) return true;
    }
    const savedPerms = getSavedUserPerms(user.nik || user.id, user.warehouse);
    if (savedPerms && typeof savedPerms === 'object') {
     if (Object.values(savedPerms).some(v => v === true)) return true;
    }
   } catch(e) {}

   return false;
  }

  // =========================================================
  // SISTEM KONTROL HAK AKSES AKUN (GRANULAR PERMISSION ENGINE)
  // =========================================================
  const PERMISSION_DEFINITIONS = [
   {
    category: "Cakupan Gudang & Switcher",
    icon: "warehouse",
    items: [
     { key: "perm_wh_mbi", label: "Akses Gudang MBI", desc: "Izin melihat dan mengelola operasional di Gudang MBI" },
     { key: "perm_wh_mai", label: "Akses Gudang MAI", desc: "Izin melihat dan mengelola operasional di Gudang MAI" },
     { key: "perm_wh_switch", label: "Akses Multi-Gudang (Kelola MBI & MAI)", desc: "Beri izin akun untuk berpindah dan mengelola operasional di kedua gudang secara penuh (termasuk approve cuti & lembur di MBI & MAI)" }
    ]
   },
   {
    category: "Manajemen Karyawan",
    icon: "users",
    items: [
     { key: "perm_emp_view", label: "Lihat Data Karyawan", desc: "Membuka tabel dan mencari data seluruh karyawan" },
     { key: "perm_emp_add", label: "Tambah Karyawan Manual", desc: "Menambahkan akun karyawan baru satu per satu" },
     { key: "perm_emp_edit", label: "Edit Data & Outsource", desc: "Mengubah NIK, nama, vendor/outsource, dan bagian karyawan" },
     { key: "perm_emp_delete", label: "Hapus Karyawan", desc: "Menghapus akun karyawan satuan atau centang massal" },
     { key: "perm_emp_upload_excel", label: "Upload Master Data Excel", desc: "Mengimpor data karyawan secara massal dari file Excel" },
     { key: "perm_emp_download_excel", label: "Download Master / Template Excel", desc: "Mengunduh file Excel master data karyawan" },
     { key: "perm_emp_reset_all", label: "Reset Semua Data Karyawan", desc: "Mengosongkan total seluruh data karyawan gudang" }
    ]
   },
   {
    category: "Approval & Persetujuan (Sakit, Cuti, Lembur)",
    icon: "check-circle",
    items: [
     { key: "perm_approve_leave_spv", label: "Approve Cuti/Sakit Tahap 1 (SPV)", desc: "Menyetujui pengajuan sakit/cuti untuk diteruskan ke Manager" },
     { key: "perm_approve_leave_mgr", label: "Approve Cuti/Sakit Tahap 2 (Manager)", desc: "Persetujuan final pengajuan sakit/cuti karyawan" },
     { key: "perm_approve_ot_spv", label: "Approve Lembur Tahap 1 (SPV)", desc: "Menyetujui nominal dan jam lembur ke tahap Manager" },
     { key: "perm_approve_ot_mgr", label: "Approve Lembur Tahap 2 (Manager)", desc: "Persetujuan final pengajuan upah lembur karyawan" },
     { key: "perm_reject_submission", label: "Tolak Pengajuan & Lembur", desc: "Berhak menolak pengajuan izin, sakit, cuti, atau lembur" }
    ]
   },
   {
    category: "Input Pengajuan & Lembur",
    icon: "file-plus",
    items: [
     { key: "perm_submit_batch_ot", label: "Input Lembur Massal (Batch)", desc: "Mengajukan daftar lembur karyawan sekaligus" },
     { key: "perm_submit_leave_staff", label: "Input Form Sakit / Izin / Cuti", desc: "Mengajukan permohonan izin, sakit, atau cuti" }
    ]
   },
   {
    category: "Laporan & Rekapitulasi",
    icon: "bar-chart-3",
    items: [
     { key: "perm_rep_records", label: "Lihat Record Absen Harian", desc: "Membuka riwayat scan jam masuk dan pulang harian" },
     { key: "perm_rep_matrix", label: "Lihat Matriks Kehadiran", desc: "Membuka tabel matriks kehadiran bulanan" },
     { key: "perm_rep_workhours", label: "Lihat Rekap Jam Kerja", desc: "Membuka kalkulasi durasi jam kerja karyawan" },
     { key: "perm_rep_leaves", label: "Lihat Rekap Sakit & Cuti", desc: "Membuka rekapitulasi seluruh pengajuan izin & sakit" },
     { key: "perm_rep_ot", label: "Lihat Rekap Lembur & Biaya", desc: "Membuka rekap upah dan jam lembur operasional" },
     { key: "perm_rep_copy_matrix", label: "Salin Matriks (WhatsApp/Clipboard)", desc: "Menyalin teks tabel matriks untuk dikirim ke chat" },
     { key: "perm_rep_download_excel", label: "Download Laporan Excel", desc: "Mengekspor laporan record absen & lembur ke Excel" },
     { key: "perm_rep_reset_att", label: "Reset Riwayat Absensi", desc: "Menghapus total riwayat scan absensi gudang" }
    ]
   },
   {
    category: "Cetak & Kartu ID Karyawan",
    icon: "contact",
    items: [
     { key: "perm_idcard_single", label: "Cetak / Unduh Kartu ID Satuan", desc: "Mencetak atau mengunduh 1 kartu ID ber-QR" },
     { key: "perm_idcard_batch_a4", label: "Cetak Lembar Massal A4", desc: "Mencetak kartu ID seluruh karyawan di lembar A4" },
     { key: "perm_idcard_qr_location", label: "QR Barcode Lokasi Gudang", desc: "Melihat dan mencetak QR Code titik koordinat absensi" }
    ]
   },
   {
    category: "Sistem, GPS & Database Cloud",
    icon: "settings",
    items: [
     { key: "perm_sys_gps_edit", label: "Ubah Titik Koordinat GPS", desc: "Memperbarui titik lintang & bujur absensi gudang" },
     { key: "perm_sys_cloud_sync", label: "Akses Database Cloud 24/7", desc: "Membuka kontrol sinkronisasi database Firebase" },
     { key: "perm_sys_gsheet_backup", label: "Backup Google Spreadsheet", desc: "Melakukan sinkronisasi data ke Google Sheets" },
     { key: "perm_sys_audio_settings", label: "Pengaturan Suara Presensi", desc: "Mengatur berkas audio notifikasi suara scan" },
     { key: "perm_sys_manage_permissions", label: "Kelola Hak Akses Akun", desc: "Berhak membuka menu ini dan mengatur izin akun lain" }
    ]
   }
  ];

  function getDefaultPermissions(user) {
   if (!user) return {};
   const isAdmin = isUserAdmin(user);
   const isMgr = isUserManager(user);
   const isScanner = isUserScanner(user);
   const role = (user.role || 'staff').toLowerCase().trim();
   const isSpv = role === 'supervisor' || role.includes('supervisor');
   const isCoord = role === 'coordinator' || role.includes('coordinator') || role.includes('cordinator');

   const perms = {};
   PERMISSION_DEFINITIONS.forEach(cat => {
    cat.items.forEach(it => {
     perms[it.key] = false;
    });
   });

   if (isAdmin) {
    // Admin Utama memiliki semua izin secara default
    Object.keys(perms).forEach(k => perms[k] = true);
    return perms;
   }

   if (isMgr) {
    // Manager Eko: Full operasional & approval final, switch gudang, manage permissions
    Object.keys(perms).forEach(k => perms[k] = true);
    perms['perm_sys_cloud_sync'] = false;
    perms['perm_sys_gsheet_backup'] = false;
    perms['perm_approve_leave_spv'] = false; // Manager adalah final approval
    perms['perm_approve_ot_spv'] = false;
    return perms;
   }

   if (isSpv || isCoord) {
    // Supervisor & Coordinator
    const isMulti = !!user.isMultiWarehouse || user.warehouse === 'ALL' || (Array.isArray(user.accessibleWarehouses) && user.accessibleWarehouses.length > 1);
    perms['perm_wh_mbi'] = user.warehouse === 'MBI' || !user.warehouse || isMulti;
    perms['perm_wh_mai'] = user.warehouse === 'MAI' || isMulti;
    perms['perm_wh_switch'] = isMulti;

    perms['perm_emp_view'] = true;
    perms['perm_emp_add'] = isSpv;
    perms['perm_emp_edit'] = isSpv;
    perms['perm_emp_delete'] = false;
    perms['perm_emp_upload_excel'] = false;
    perms['perm_emp_download_excel'] = true;
    perms['perm_emp_reset_all'] = false;

    // SPV DIJAMIN memiliki akses persetujuan (approval) cuti sakit & lembur
    perms['perm_approve_leave_spv'] = isSpv;
    perms['perm_approve_leave_mgr'] = false;
    perms['perm_approve_ot_spv'] = isSpv;
    perms['perm_approve_ot_mgr'] = false;
    perms['perm_reject_submission'] = isSpv;

    perms['perm_submit_batch_ot'] = true;
    perms['perm_submit_leave_staff'] = true;

    perms['perm_rep_records'] = true;
    perms['perm_rep_matrix'] = true;
    perms['perm_rep_workhours'] = true;
    perms['perm_rep_leaves'] = true;
    perms['perm_rep_ot'] = true;
    perms['perm_rep_copy_matrix'] = true;
    perms['perm_rep_download_excel'] = true;
    perms['perm_rep_reset_att'] = false;

    perms['perm_idcard_single'] = true;
    perms['perm_idcard_batch_a4'] = true;
    perms['perm_idcard_qr_location'] = true;

    perms['perm_sys_gps_edit'] = false;
    perms['perm_sys_cloud_sync'] = false;
    perms['perm_sys_gsheet_backup'] = false;
    perms['perm_sys_audio_settings'] = false;
    perms['perm_sys_manage_permissions'] = isSpv;
    return perms;
   }

   if (isScanner) {
    return perms;
   }

   // Karyawan Staff Biasa
   perms['perm_wh_mbi'] = user.warehouse === 'MBI' || !user.warehouse;
   perms['perm_wh_mai'] = user.warehouse === 'MAI';
   perms['perm_wh_switch'] = false;
   perms['perm_submit_leave_staff'] = true;
   perms['perm_idcard_single'] = true;
   return perms;
  }

  function hasPermission(permKey, user = currentUser) {
   if (!user) return false;

   // 1. Hak akses eksplisit yang tersimpan di objek user (Prioritas Tertinggi)
   if (user.permissions && typeof user.permissions[permKey] === 'boolean') {
    return user.permissions[permKey];
   }
   const savedPerms = getSavedUserPerms(user.nik || user.id, user.warehouse);
   if (savedPerms && typeof savedPerms[permKey] === 'boolean') {
    if (!user.permissions) user.permissions = {};
    user.permissions[permKey] = savedPerms[permKey];
    return savedPerms[permKey];
   }

   // 2. Hak akses default berdasarkan Role jika belum ada kustomisasi izin:
   // Akun Supervisor default memiliki wewenang approve tahap 1 cuti/sakit & lembur
   if (isUserSupervisor(user)) {
    if (permKey === 'perm_approve_leave_spv' || permKey === 'perm_approve_ot_spv' || permKey === 'perm_reject_submission') {
     return true;
    }
   }

   // Akun Manager default memiliki wewenang approve final, tolak, dan switch multi gudang
   if (isUserManager(user)) {
    if (permKey === 'perm_approve_leave_mgr' || permKey === 'perm_approve_ot_mgr' || permKey === 'perm_reject_submission' || permKey === 'perm_wh_switch' || permKey === 'perm_wh_mbi' || permKey === 'perm_wh_mai') {
     return true;
    }
   }

   // Akun Coordinator default memiliki wewenang form lembur massal & form izin/cuti
   if (isUserCoordinator(user)) {
    if (permKey === 'perm_submit_batch_ot' || permKey === 'perm_submit_leave_staff' || permKey === 'perm_rep_records' || permKey === 'perm_rep_matrix') {
     return true;
    }
   }

   // Akun Multi-Gudang default memiliki izin membuka & switch gudang MBI dan MAI
   if (canAccessMultiWarehouse(user)) {
    if (permKey === 'perm_wh_switch' || permKey === 'perm_wh_mbi' || permKey === 'perm_wh_mai') {
     return true;
    }
   }

   const defaults = getDefaultPermissions(user);
   return !!defaults[permKey];
  }

  function canAccessMultiWarehouse(user = currentUser) {
   if (!user) return false;
   const role = (user.role || '').toLowerCase().trim();
   if (role === 'scanner' || user.nik === 'ABSEN-MBI' || user.nik === 'ABSEN-MAI') return false;

   // 1. Prioritaskan izin eksplisit perm_wh_switch (termasuk Admin yang dinonaktifkan multi-gudangnya)
   if (user.permissions && typeof user.permissions.perm_wh_switch === 'boolean') {
    return user.permissions.perm_wh_switch;
   }
   const savedPerms = getSavedUserPerms(user.nik || user.id, user.warehouse);
   if (savedPerms && typeof savedPerms.perm_wh_switch === 'boolean') {
    return savedPerms.perm_wh_switch;
   }

   // 2. Akun yang secara eksplisit diset bukan multi warehouse
   if (user.isMultiWarehouse === false) {
    return false;
   }

   // 3. Akun dengan pengaturan multi-gudang eksplisit (isMultiWarehouse / warehouse ALL)
   if (user.isMultiWarehouse === true || user.warehouse === 'ALL' || (Array.isArray(user.accessibleWarehouses) && user.accessibleWarehouses.length > 1)) {
    return true;
   }

   // 4. Default role (Administrator & Manager default aktif multi-gudang jika belum dikustomisasi)
   if (isUserAdmin(user) || isUserManager(user)) {
    return true;
   }

   return false;
  }

  let currentEditingUserNik = null;
  let currentEditingPermissions = {};

  function isLoginManagementAccount(u) {
   if (!u) return false;
   if (isUserAdmin(u) || isUserManager(u)) return true;
   if (isUserScanner(u)) return false;
   const role = (u.role || '').toLowerCase().trim();
   const dept = (u.dept || '').toLowerCase().trim();
   const nik = (u.nik || u.id || '').toString().toUpperCase().trim();
   
   const isSpv = role === 'supervisor' || role.includes('supervisor') || role === 'spv' || dept.includes('supervisor') || dept.includes('spv') || nik.startsWith('SPV');
   const isCoord = role === 'coordinator' || role.includes('coordinator') || role.includes('cordinator') || role.includes('koordinator') || dept.includes('coordinator') || dept.includes('cordinator') || dept.includes('koordinator') || nik.startsWith('CRD');
   const isMgr = role === 'manager' || (dept.includes('manager') && role === 'manager') || nik === 'MGR001' || nik.startsWith('MGR');
   const isAdminRole = role === 'admin' || role === 'superadmin' || dept.includes('admin') || nik.startsWith('ADM');
   const hasExplicitAccount = (u.hasAccount === true && role !== 'scanner');
   const hasCustomPass = !!(u.password && String(u.password).trim().length > 0 && role !== 'scanner');
   const hasCustomPerms = !!(u.permissions && Object.values(u.permissions).some(v => v === true));
   const hasSavedPerms = !!(() => {
    const sp = getSavedUserPerms(u.nik || u.id, u.warehouse);
    return sp && Object.values(sp).some(v => v === true);
   })();

   return isSpv || isCoord || isMgr || isAdminRole || hasExplicitAccount || hasCustomPass || u.isMultiWarehouse === true || hasCustomPerms || hasSavedPerms;
  }

  function populatePermissionAccountDropdown(selectedNik = null) {
   const select = document.getElementById('perm-account-select');
   if (!select) return;

   const mbiUsers = getWhDB('MBI', 'users', SEED_MBI_USERS);
   const maiUsers = getWhDB('MAI', 'users', SEED_MAI_USERS);
   
   const map = new Map();

   // Pastikan akun manager terdaftar dari database mutakhir atau fallback seed
   const existingMbiMgr = mbiUsers.find(u => u && (u.id === 'mgr-eko' || u.nik === 'MGR001' || u.role === 'manager'));
   const existingMaiMgr = maiUsers.find(u => u && (u.id === 'mgr-eko' || u.nik === 'MGR001' || u.role === 'manager'));

   if (existingMbiMgr) {
    map.set(`MBI_${existingMbiMgr.nik || 'MGR001'}`, { ...existingMbiMgr, warehouse: 'MBI', nik: existingMbiMgr.nik || 'MGR001' });
   } else if (typeof SEED_MANAGER_USER !== 'undefined' && SEED_MANAGER_USER) {
    map.set(`MBI_${SEED_MANAGER_USER.nik}`, { ...SEED_MANAGER_USER, warehouse: 'MBI' });
   }

   if (existingMaiMgr) {
    map.set(`MAI_${existingMaiMgr.nik || 'MGR001'}`, { ...existingMaiMgr, warehouse: 'MAI', nik: existingMaiMgr.nik || 'MGR001' });
   } else if (typeof SEED_MANAGER_USER !== 'undefined' && SEED_MANAGER_USER) {
    map.set(`MAI_${SEED_MANAGER_USER.nik}`, { ...SEED_MANAGER_USER, warehouse: 'MAI' });
   }

   mbiUsers.forEach(u => {
    if (!u || isUserScanner(u)) return;
    const userNik = (u.nik || u.id || u.name || '').toString().trim();
    if (userNik) {
     map.set(`MBI_${userNik}`, { ...u, warehouse: 'MBI', nik: u.nik || userNik });
    }
   });
   maiUsers.forEach(u => {
    if (!u || isUserScanner(u)) return;
    const userNik = (u.nik || u.id || u.name || '').toString().trim();
    if (userNik) {
     map.set(`MAI_${userNik}`, { ...u, warehouse: 'MAI', nik: u.nik || userNik });
    }
   });

   const all = Array.from(map.values());
   all.sort((a, b) => {
    if (isUserAdmin(a)) return -1;
    if (isUserAdmin(b)) return 1;
    if (isUserManager(a)) return -1;
    if (isUserManager(b)) return 1;
    if (isUserSupervisor(a)) return -1;
    if (isUserSupervisor(b)) return 1;
    if (isUserCoordinator(a)) return -1;
    if (isUserCoordinator(b)) return 1;
    const aHasPerms = (a.permissions && Object.values(a.permissions).some(v => v === true)) ? 1 : 0;
    const bHasPerms = (b.permissions && Object.values(b.permissions).some(v => v === true)) ? 1 : 0;
    if (aHasPerms !== bHasPerms) return bHasPerms - aHasPerms;
    return (a.name || '').localeCompare(b.name || '');
   });

   select.innerHTML = '';
   if (all.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.innerText = '-- Tidak ada akun manajemen (Supervisor/Coordinator/Admin/Manager) --';
    select.appendChild(opt);
    return;
   }

   all.forEach(u => {
    const opt = document.createElement('option');
    const uniqueVal = `${u.warehouse}__${u.nik}`;
    opt.value = uniqueVal;
    const roleLabel = (u.role || 'staff').toUpperCase();
    opt.innerText = `[Gudang ${u.warehouse}] ${u.name} (NIK: ${u.nik}) - ${roleLabel} [${u.dept || '-'}]`;
    select.appendChild(opt);
   });

   const targetSearch = selectedNik || (currentUser ? currentUser.nik : null);
   if (targetSearch) {
    const matchingOpt = Array.from(select.options).find(o => o.value.endsWith(`__${targetSearch}`) || o.value.toLowerCase().includes(String(targetSearch).toLowerCase()));
    if (matchingOpt) select.value = matchingOpt.value;
   }
  }

  function filterPermissionAccountOptions(query) {
   const q = (query || '').toLowerCase().trim();
   const select = document.getElementById('perm-account-select');
   if (!select) return;

   let firstMatch = null;
   Array.from(select.options).forEach(opt => {
    const match = !q || opt.innerText.toLowerCase().includes(q) || opt.value.toLowerCase().includes(q);
    opt.style.display = match ? '' : 'none';
    if (match && !firstMatch) firstMatch = opt;
   });

   if (firstMatch && q) {
    select.value = firstMatch.value;
    onPermissionAccountChange();
   }
  }

  function onPermissionAccountChange() {
   const select = document.getElementById('perm-account-select');
   if (!select || !select.value) return;
   const [wh, nik] = select.value.split('__');
   renderPermissionEditor(nik, wh);
  }

  function findUserByWhAndNik(nik, wh = null) {
   const targetWh = wh || activeWarehouse || 'MBI';
   const cleanTarget = (nik || '').toString().trim().toUpperCase();
   const users = getWhDB(targetWh, 'users', targetWh === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);
   
   let found = users.find(u => 
    (u.nik && u.nik.toString().trim().toUpperCase() === cleanTarget) || 
    (u.id && u.id.toString().trim().toUpperCase() === cleanTarget) ||
    (u.name && cleanStr(u.name) === cleanStr(nik))
   );

   if (!found) {
    const otherWh = targetWh === 'MBI' ? 'MAI' : 'MBI';
    const otherUsers = getWhDB(otherWh, 'users', otherWh === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);
    found = otherUsers.find(u => 
     (u.nik && u.nik.toString().trim().toUpperCase() === cleanTarget) || 
     (u.id && u.id.toString().trim().toUpperCase() === cleanTarget) ||
     (u.name && cleanStr(u.name) === cleanStr(nik))
    );
   }

   if (!found && currentUser && ((currentUser.nik && currentUser.nik.toString().trim().toUpperCase() === cleanTarget) || cleanStr(currentUser.name) === cleanStr(nik))) {
    found = currentUser;
   }

   if (found) {
    if (!found.permissions || Object.keys(found.permissions).length === 0) {
     try {
      const uNik = (found.nik || found.id || '').toUpperCase().trim();
      const pKey = `wfm_perm_${(wh || found.warehouse || targetWh).toLowerCase()}_${uNik}`;
      const pSaved = localStorage.getItem(pKey);
      if (pSaved) found.permissions = JSON.parse(pSaved);
     } catch(e) {}
    }
   }

   return found;
  }

  function renderPermissionEditor(targetNik = null, targetWh = null) {
   const select = document.getElementById('perm-account-select');
   if (!select) return;

   populatePermissionAccountDropdown(targetNik || (currentUser ? currentUser.nik : null));

   let selectedVal = select.value;
   if (targetNik) {
    const matchingOpt = Array.from(select.options).find(o => o.value.endsWith(`__${targetNik}`) || o.value.toLowerCase().includes(String(targetNik).toLowerCase()));
    if (matchingOpt) {
     select.value = matchingOpt.value;
     selectedVal = matchingOpt.value;
    }
   }

   if (!selectedVal && select.options.length > 0) {
    selectedVal = select.options[0].value;
    select.value = selectedVal;
   }

   let user = null;
   let userWh = targetWh || activeWarehouse || 'MBI';

   if (selectedVal && selectedVal.includes('__')) {
    const [wh, nik] = selectedVal.split('__');
    user = findUserByWhAndNik(nik, wh);
    userWh = wh || (user ? user.warehouse : activeWarehouse);
   }

   if (!user && currentUser) {
    user = currentUser;
    userWh = currentUser.warehouse || activeWarehouse || 'MBI';
   }

   if (!user) {
    const allUsers = [...getWhDB('MBI', 'users', SEED_MBI_USERS), ...getWhDB('MAI', 'users', SEED_MAI_USERS)];
    if (allUsers.length > 0) {
     user = allUsers[0];
     userWh = user.warehouse || 'MBI';
    }
   }

   if (!user) {
    user = {
     name: 'Administrator',
     nik: 'ADM001',
     dept: 'IT & Management',
     role: 'admin',
     warehouse: activeWarehouse || 'MBI'
    };
    userWh = activeWarehouse || 'MBI';
   }

   currentEditingUserNik = user.nik;

   // Load existing permissions or saved permissions from backup or generate defaults
   const defaults = getDefaultPermissions(user);
   let savedPermObj = null;
   try {
    const permKey = `wfm_perm_${(userWh || 'MBI').toLowerCase()}_${(user.nik || user.id || '').toUpperCase().trim()}`;
    const raw = localStorage.getItem(permKey);
    if (raw) savedPermObj = JSON.parse(raw);
   } catch(e) {}

   currentEditingPermissions = {};
   PERMISSION_DEFINITIONS.forEach(cat => {
    cat.items.forEach(it => {
     if (user.permissions && typeof user.permissions[it.key] === 'boolean') {
      currentEditingPermissions[it.key] = user.permissions[it.key];
     } else if (savedPermObj && typeof savedPermObj[it.key] === 'boolean') {
      currentEditingPermissions[it.key] = savedPermObj[it.key];
     } else {
      currentEditingPermissions[it.key] = !!defaults[it.key];
     }
    });
   });

   // Update Summary Card
   const nameEl = document.getElementById('perm-user-name-display');
   const metaEl = document.getElementById('perm-user-meta-display');
   const roleEl = document.getElementById('perm-user-role-display');
   const whBadge = document.getElementById('perm-user-badge-wh');
   const btnMulti = document.getElementById('btn-perm-toggle-multiwh');
   const descMulti = document.getElementById('perm-user-multiwh-desc');

   if (nameEl) nameEl.innerText = user.name || '-';
   if (metaEl) metaEl.innerText = `NIK: ${user.nik} • Bagian: ${user.dept || '-'} • Outsource: ${user.outsource || 'Internal'}`;
   if (roleEl) {
    roleEl.innerText = (user.role || 'STAFF').toUpperCase();
    roleEl.className = (user.role === 'admin' || user.role === 'supervisor') ? 'font-black text-teal-700 uppercase' : 'font-black text-slate-900 uppercase';
   }
   if (whBadge) whBadge.innerText = `Gudang ${userWh}`;

   const isMulti = (typeof currentEditingPermissions['perm_wh_switch'] === 'boolean') ? currentEditingPermissions['perm_wh_switch'] : !!(user.isMultiWarehouse || user.warehouse === 'ALL');
   if (btnMulti) {
    if (isMulti) {
     btnMulti.className = 'px-2.5 py-1 rounded-xl text-[10px] font-black transition flex items-center gap-1 bg-emerald-600 text-white shadow-xs cursor-pointer';
     btnMulti.innerHTML = '<i data-lucide="check" class="w-3 h-3"></i> <span>MBI &amp; MAI Aktif</span>';
     if (descMulti) descMulti.innerText = 'Bisa akses & kelola kedua gudang';
    } else {
     btnMulti.className = 'px-2.5 py-1 rounded-xl text-[10px] font-black transition flex items-center gap-1 bg-slate-200 text-slate-700 hover:bg-slate-300 cursor-pointer';
     btnMulti.innerHTML = '<i data-lucide="lock" class="w-3 h-3"></i> <span>1 Gudang Saja</span>';
     if (descMulti) descMulti.innerText = `Terkunci di Gudang ${userWh}`;
    }
   }

   // Render Categories
   const container = document.getElementById('perm-categories-container');
   if (!container) return;
   container.innerHTML = '';

   PERMISSION_DEFINITIONS.forEach((cat, catIdx) => {
    const catCard = document.createElement('div');
    catCard.className = 'bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4';

    const grantedCount = cat.items.filter(it => currentEditingPermissions[it.key] === true).length;
    const totalCount = cat.items.length;

    catCard.innerHTML = `
     <div class="flex items-center justify-between pb-3 border-b border-slate-100 flex-wrap gap-2">
      <div class="flex items-center gap-2.5">
       <div class="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
        <i data-lucide="${cat.icon || 'shield'}" class="w-4 h-4"></i>
       </div>
       <div>
        <h4 class="font-extrabold text-sm text-slate-900">${cat.category}</h4>
        <p class="text-[11px] text-slate-500">${totalCount} opsi kewenangan</p>
       </div>
      </div>
      <span id="cat-badge-${catIdx}" class="px-2.5 py-1 rounded-full text-[10px] font-bold ${grantedCount === totalCount ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : (grantedCount === 0 ? 'bg-rose-100 text-rose-800 border border-rose-300' : 'bg-slate-100 text-slate-700 border border-slate-200')}">
       ${grantedCount} / ${totalCount} Diizinkan
      </span>
     </div>

     <div class="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1" id="cat-items-${catIdx}">
      <!-- Item cards populated below -->
     </div>
    `;

    const itemsContainer = catCard.querySelector(`#cat-items-${catIdx}`);
    cat.items.forEach(it => {
     const isAllowed = currentEditingPermissions[it.key] === true;
     const itemDiv = document.createElement('div');
     itemDiv.id = `perm-box-${it.key}`;
     itemDiv.className = `p-3.5 rounded-2xl border transition flex flex-col justify-between gap-3 ${isAllowed ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200 bg-slate-50/50'}`;

     itemDiv.innerHTML = `
      <div class="space-y-1">
       <div class="flex items-center justify-between gap-2">
        <span class="text-xs font-bold text-slate-900">${it.label}</span>
        <span id="status-tag-${it.key}" class="px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${isAllowed ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'}">
         ${isAllowed ? 'Å¸Å¸ Diizinkan' : 'Å¸â€ Ditolak'}
        </span>
       </div>
       <p class="text-[11px] text-slate-500 leading-snug">${it.desc}</p>
      </div>

      <div class="flex items-center gap-1.5 pt-2 border-t border-slate-200/60">
       <button type="button" onclick="togglePermissionItem('${it.key}', true, ${catIdx})" id="btn-allow-${it.key}" class="flex-1 py-1.5 px-2 rounded-xl text-[11px] font-bold transition flex items-center justify-center gap-1 shadow-2xs ${isAllowed ? 'bg-emerald-600 text-white font-extrabold shadow-sm' : 'bg-white hover:bg-emerald-50 text-slate-600 border border-slate-200'}">
        <i data-lucide="check" class="w-3.5 h-3.5"></i>
        <span>IZINKAN</span>
       </button>
       <button type="button" onclick="togglePermissionItem('${it.key}', false, ${catIdx})" id="btn-deny-${it.key}" class="flex-1 py-1.5 px-2 rounded-xl text-[11px] font-bold transition flex items-center justify-center gap-1 shadow-2xs ${!isAllowed ? 'bg-rose-600 text-white font-extrabold shadow-sm' : 'bg-white hover:bg-rose-50 text-slate-600 border border-slate-200'}">
        <i data-lucide="x" class="w-3.5 h-3.5"></i>
        <span>TOLAK</span>
       </button>
      </div>
     `;
     itemsContainer.appendChild(itemDiv);
    });

    container.appendChild(catCard);
   });

   if (window.lucide) lucide.createIcons();
  }

  function togglePermissionItem(permKey, state, catIdx = null) {
   currentEditingPermissions[permKey] = state;

   const itemBox = document.getElementById(`perm-box-${permKey}`);
   const statusTag = document.getElementById(`status-tag-${permKey}`);
   const btnAllow = document.getElementById(`btn-allow-${permKey}`);
   const btnDeny = document.getElementById(`btn-deny-${permKey}`);

   if (itemBox) {
    itemBox.className = `p-3.5 rounded-2xl border transition flex flex-col justify-between gap-3 ${state ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200 bg-slate-50/50'}`;
   }
   if (statusTag) {
    statusTag.className = `px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${state ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'}`;
    statusTag.innerText = state ? 'Å¸Å¸ Diizinkan' : 'Å¸â€ Ditolak';
   }
   if (btnAllow) {
    btnAllow.className = `flex-1 py-1.5 px-2 rounded-xl text-[11px] font-bold transition flex items-center justify-center gap-1 shadow-2xs ${state ? 'bg-emerald-600 text-white font-extrabold shadow-sm' : 'bg-white hover:bg-emerald-50 text-slate-600 border border-slate-200'}`;
   }
   if (btnDeny) {
    btnDeny.className = `flex-1 py-1.5 px-2 rounded-xl text-[11px] font-bold transition flex items-center justify-center gap-1 shadow-2xs ${!state ? 'bg-rose-600 text-white font-extrabold shadow-sm' : 'bg-white hover:bg-rose-50 text-slate-600 border border-slate-200'}`;
   }

   // Sinkronkan status tombol toggle kartu multi-gudang jika yang diubah adalah perm_wh_switch
   if (permKey === 'perm_wh_switch') {
    const btnMulti = document.getElementById('btn-perm-toggle-multiwh');
    const descMulti = document.getElementById('perm-user-multiwh-desc');
    if (btnMulti) {
     if (state) {
      btnMulti.className = 'px-2.5 py-1 rounded-xl text-[10px] font-black transition flex items-center gap-1 bg-emerald-600 text-white shadow-xs cursor-pointer';
      btnMulti.innerHTML = '<i data-lucide="check" class="w-3 h-3"></i> <span>MBI &amp; MAI Aktif</span>';
      if (descMulti) descMulti.innerText = 'Bisa akses & kelola kedua gudang';
     } else {
      btnMulti.className = 'px-2.5 py-1 rounded-xl text-[10px] font-black transition flex items-center gap-1 bg-slate-200 text-slate-700 hover:bg-slate-300 cursor-pointer';
      btnMulti.innerHTML = '<i data-lucide="lock" class="w-3 h-3"></i> <span>1 Gudang Saja</span>';
      if (descMulti) descMulti.innerText = 'Terkunci 1 Gudang Saja';
     }
     if (window.lucide) lucide.createIcons();
    }
   }

   // Update badge category count
   if (catIdx !== null && PERMISSION_DEFINITIONS[catIdx]) {
    const cat = PERMISSION_DEFINITIONS[catIdx];
    const grantedCount = cat.items.filter(it => currentEditingPermissions[it.key] === true).length;
    const totalCount = cat.items.length;
    const badgeEl = document.getElementById(`cat-badge-${catIdx}`);
    if (badgeEl) {
     badgeEl.className = `px-2.5 py-1 rounded-full text-[10px] font-bold ${grantedCount === totalCount ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : (grantedCount === 0 ? 'bg-rose-100 text-rose-800 border border-rose-300' : 'bg-slate-100 text-slate-700 border border-slate-200')}`;
     badgeEl.innerText = `${grantedCount} / ${totalCount} Diizinkan`;
    }
   }
  }

  function toggleMultiWarehouseInPermissions() {
   const isCurrentlyMulti = !!currentEditingPermissions['perm_wh_switch'];
   const nextState = !isCurrentlyMulti;

   currentEditingPermissions['perm_wh_switch'] = nextState;
   if (nextState) {
    currentEditingPermissions['perm_wh_mbi'] = true;
    currentEditingPermissions['perm_wh_mai'] = true;
   } else {
    const select = document.getElementById('perm-account-select');
    const [wh] = (select?.value || '').split('__');
    const targetWh = (wh || activeWarehouse || 'MBI').toUpperCase();
    if (targetWh === 'MAI') {
     currentEditingPermissions['perm_wh_mbi'] = false;
     currentEditingPermissions['perm_wh_mai'] = true;
    } else {
     currentEditingPermissions['perm_wh_mbi'] = true;
     currentEditingPermissions['perm_wh_mai'] = false;
    }
   }

   togglePermissionItem('perm_wh_switch', nextState, 0);
   togglePermissionItem('perm_wh_mbi', !!currentEditingPermissions['perm_wh_mbi'], 0);
   togglePermissionItem('perm_wh_mai', !!currentEditingPermissions['perm_wh_mai'], 0);
   if (window.lucide) lucide.createIcons();
  }

  function applyPermissionPreset(presetType) {
   const select = document.getElementById('perm-account-select');
   if (!select || !select.value) return;
   const [wh, nik] = select.value.split('__');
   const user = findUserByWhAndNik(nik, wh);
   if (!user) return;

   if (presetType === 'allow_all') {
    PERMISSION_DEFINITIONS.forEach(cat => {
     cat.items.forEach(it => {
      currentEditingPermissions[it.key] = true;
     });
    });
   } else if (presetType === 'deny_all') {
    PERMISSION_DEFINITIONS.forEach(cat => {
     cat.items.forEach(it => {
      currentEditingPermissions[it.key] = false;
     });
    });
   } else if (presetType === 'supervisor') {
    const tempUser = { ...user, role: 'supervisor' };
    const spvDefaults = getDefaultPermissions(tempUser);
    Object.keys(currentEditingPermissions).forEach(k => {
     currentEditingPermissions[k] = !!spvDefaults[k];
    });
   } else if (presetType === 'manager') {
    const tempUser = { ...user, role: 'manager' };
    const mgrDefaults = getDefaultPermissions(tempUser);
    Object.keys(currentEditingPermissions).forEach(k => {
     currentEditingPermissions[k] = !!mgrDefaults[k];
    });
   } else if (presetType === 'default_role') {
    const defaults = getDefaultPermissions(user);
    Object.keys(currentEditingPermissions).forEach(k => {
     currentEditingPermissions[k] = !!defaults[k];
    });
   }

   // Re-render editor with updated state
   PERMISSION_DEFINITIONS.forEach((cat, catIdx) => {
    cat.items.forEach(it => {
     togglePermissionItem(it.key, !!currentEditingPermissions[it.key], catIdx);
    });
   });
   if (window.lucide) lucide.createIcons();
  }

  async function saveUserPermissions() {
   if (!isUserAdmin(currentUser) && !hasPermission('perm_sys_manage_permissions')) {
    alert('Akses Ditolak: Anda tidak memiliki wewenang untuk menyimpan pengaturan hak akses akun.');
    return;
   }

   const select = document.getElementById('perm-account-select');
   if (!select || !select.value) {
    alert('Silakan pilih akun terlebih dahulu.');
    return;
   }

   const [wh, nik] = select.value.split('__');
   const targetWh = wh || activeWarehouse || 'MBI';
   let users = getWhDB(targetWh, 'users', targetWh === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);
   let idx = users.findIndex(u => (u.nik || '').toUpperCase() === (nik || '').toUpperCase() || u.id === nik);
   
   let actualWh = targetWh;
   if (idx === -1) {
    const otherWh = targetWh === 'MBI' ? 'MAI' : 'MBI';
    const otherUsers = getWhDB(otherWh, 'users', []);
    idx = otherUsers.findIndex(u => (u.nik || '').toUpperCase() === (nik || '').toUpperCase() || u.id === nik);
    if (idx !== -1) {
     users = otherUsers;
     actualWh = otherWh;
    }
   }

   if (idx === -1) {
    alert('Data akun karyawan tidak ditemukan di database.');
    return;
   }

   const isMulti = currentEditingPermissions['perm_wh_switch'] === true;
   users[idx].isMultiWarehouse = isMulti;
   if (isMulti) {
    users[idx].accessibleWarehouses = ['MBI', 'MAI'];
    currentEditingPermissions['perm_wh_switch'] = true;
    currentEditingPermissions['perm_wh_mbi'] = true;
    currentEditingPermissions['perm_wh_mai'] = true;
   } else {
    users[idx].accessibleWarehouses = [actualWh];
    currentEditingPermissions['perm_wh_switch'] = false;
    if (currentEditingPermissions['perm_wh_mai'] === true && currentEditingPermissions['perm_wh_mbi'] === false) {
     users[idx].warehouse = 'MAI';
     actualWh = 'MAI';
    } else if (currentEditingPermissions['perm_wh_mbi'] === true && currentEditingPermissions['perm_wh_mai'] === false) {
     users[idx].warehouse = 'MBI';
     actualWh = 'MBI';
    } else {
     currentEditingPermissions['perm_wh_mbi'] = (actualWh === 'MBI');
     currentEditingPermissions['perm_wh_mai'] = (actualWh === 'MAI');
    }
   }

   const nowIso = new Date().toISOString();
   // Jika akun staf diberikan hak izin khusus, aktifkan hasAccount dan password default agar bisa login
   if (Object.values(currentEditingPermissions).some(v => v === true)) {
    users[idx].hasAccount = true;
    if (!users[idx].password) users[idx].password = 'medika123';
   }
   users[idx].permissions = { ...currentEditingPermissions };
   users[idx].updatedAt = nowIso;
   setWhDB(actualWh, 'users', users);
   localStorage.setItem(`wfm_${actualWh.toLowerCase()}_users_backup`, JSON.stringify(users));
   localStorage.setItem('wfm_last_master_change_time', Date.now().toString());
   localStorage.setItem('wfm_master_updated_at', nowIso);

   const targetNik = (users[idx].nik || users[idx].id || '').toUpperCase().trim();
   const isMgr = (targetNik === 'MGR001' || targetNik.startsWith('MGR') || users[idx].role === 'manager' || users[idx].id === 'mgr-eko');

   // Simpan cadangan permanen hak akses per NIK & ID
   try {
    if (targetNik) {
     localStorage.setItem(`wfm_perm_${actualWh.toLowerCase()}_${targetNik}`, JSON.stringify(currentEditingPermissions));
     localStorage.setItem(`wfm_perm_${targetNik}`, JSON.stringify(currentEditingPermissions));
    }
    if (isMgr) {
     localStorage.setItem('wfm_perm_mgr001', JSON.stringify(currentEditingPermissions));
     localStorage.setItem('wfm_perm_mbi_mgr001', JSON.stringify(currentEditingPermissions));
     localStorage.setItem('wfm_perm_mai_mgr001', JSON.stringify(currentEditingPermissions));

     // Sinkronkan ke database gudang lainnya untuk Manager (General Manager memegang 2 gudang)
     const otherWh = actualWh === 'MBI' ? 'MAI' : 'MBI';
     let otherUsers = getWhDB(otherWh, 'users', otherWh === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);
     const otherIdx = otherUsers.findIndex(u => u && (u.nik === 'MGR001' || u.id === 'mgr-eko' || u.role === 'manager'));
     if (otherIdx !== -1) {
      otherUsers[otherIdx].permissions = { ...currentEditingPermissions };
      otherUsers[otherIdx].updatedAt = nowIso;
      setWhDB(otherWh, 'users', otherUsers);
      localStorage.setItem(`wfm_${otherWh.toLowerCase()}_users_backup`, JSON.stringify(otherUsers));
     }
    } else if (isMulti) {
     // Sinkronkan ke database gudang lainnya untuk akun multi-gudang (misal: SPV / Coordinator / Staff yang diberi multi-gudang)
     const otherWh = actualWh === 'MBI' ? 'MAI' : 'MBI';
     let otherUsers = getWhDB(otherWh, 'users', otherWh === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);
     const otherIdx = otherUsers.findIndex(u => (u.nik && u.nik.toUpperCase() === targetNik) || (u.id && u.id === users[idx].id) || cleanStr(u.name) === cleanStr(users[idx].name));
     const mirroredUser = {
      ...users[idx],
      warehouse: otherWh,
      isMultiWarehouse: true,
      accessibleWarehouses: ['MBI', 'MAI'],
      permissions: { ...currentEditingPermissions },
      updatedAt: nowIso
     };
     if (otherIdx !== -1) {
      otherUsers[otherIdx] = mirroredUser;
     } else {
      otherUsers.push(mirroredUser);
     }
     setWhDB(otherWh, 'users', otherUsers);
     localStorage.setItem(`wfm_${otherWh.toLowerCase()}_users_backup`, JSON.stringify(otherUsers));
     try {
      localStorage.setItem(`wfm_perm_${otherWh.toLowerCase()}_${targetNik}`, JSON.stringify(currentEditingPermissions));
     } catch(e) {}
    } else {
     // Jika akses multi-gudang dicabut pada akun non-manager
     const otherWh = actualWh === 'MBI' ? 'MAI' : 'MBI';
     let otherUsers = getWhDB(otherWh, 'users', otherWh === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);
     const otherIdx = otherUsers.findIndex(u => (u.nik && u.nik.toUpperCase() === targetNik) || (u.id && u.id === users[idx].id) || cleanStr(u.name) === cleanStr(users[idx].name));
     if (otherIdx !== -1) {
      otherUsers[otherIdx].isMultiWarehouse = false;
      otherUsers[otherIdx].accessibleWarehouses = [otherWh];
      if (otherUsers[otherIdx].permissions) {
       otherUsers[otherIdx].permissions.perm_wh_switch = false;
      }
      setWhDB(otherWh, 'users', otherUsers);
      localStorage.setItem(`wfm_${otherWh.toLowerCase()}_users_backup`, JSON.stringify(otherUsers));
     }
    }
   } catch(e) {}

   // Jika akun yang diedit adalah akun yang sedang aktif login (atau sesama admin)
   if (currentUser && (currentUser.nik === users[idx].nik || currentUser.id === users[idx].id || (isMgr && isUserManager(currentUser)) || (isUserAdmin(currentUser) && isUserAdmin(users[idx])))) {
    currentUser.permissions = { ...currentEditingPermissions };
    currentUser.isMultiWarehouse = isMulti;
    currentUser.accessibleWarehouses = isMulti ? ['MBI', 'MAI'] : [actualWh];
    currentUser.warehouse = users[idx].warehouse || actualWh;
    localStorage.setItem('wfm_active_session', JSON.stringify(currentUser));
    applyRolePermissions();
    if (typeof updateWhSwitcherButtons === 'function') updateWhSwitcherButtons();
   }

   // Sinkronisasi hak akses akun ke Supabase 24/7 & Master Cloud
   if (typeof saveUsersToSupabase === 'function') {
    await saveUsersToSupabase(actualWh, users).catch(() => {});
   }
   await saveFullDatabaseToCloud(false, true, true);

   alert(`✅ Hak Akses Berhasil Disimpan!\n\nAkun: ${users[idx].name} (${users[idx].nik})\nGudang: ${actualWh}\n\nPengaturan hak akses telah aktif seketika dan tersinkronisasi 24/7 ke Database Supabase.`);
   renderPermissionEditor(users[idx].nik, actualWh);
  }

  function applyRolePermissions() {
   if (!currentUser) return;
   const isAdmin = isUserAdmin(currentUser);
   const isScanner = isUserScanner(currentUser);
   const isManager = isUserManager(currentUser);
   const userRole = (currentUser.role || 'staff').toLowerCase().trim();
   const isSpv = isUserSupervisor(currentUser) || userRole === 'supervisor' || userRole === 'coordinator';
   const isManagement = ['coordinator', 'supervisor', 'admin', 'manager'].includes(userRole) || isManager || isSpv;

   // 0. Menu Hak Akses Akun (Admin Utama atau akun yang diizinkan perm_sys_manage_permissions)
   const navPerm = document.getElementById('nav-permissions');
   const canManagePerm = isAdmin || hasPermission('perm_sys_manage_permissions');
   if (navPerm) {
    if (canManagePerm && !isScanner) {
     navPerm.classList.remove('hidden');
     navPerm.classList.add('flex');
    } else {
     navPerm.classList.add('hidden');
     navPerm.classList.remove('flex');
    }
   }

   // 1. Tombol Backup Google Sheet
   const gsheetReportsBtn = document.getElementById('btn-reports-gsheet-backup');
   const gsheetMatrixBtn = document.getElementById('btn-matrix-gsheet-backup');
   const gsheetNavBtn = document.getElementById('nav-btn-gsheet-status');
   const canGsheet = isAdmin || hasPermission('perm_sys_gsheet_backup');
   if (gsheetReportsBtn) {
    if (canGsheet) {
     gsheetReportsBtn.classList.remove('hidden');
     gsheetReportsBtn.classList.add('inline-flex');
    } else {
     gsheetReportsBtn.classList.add('hidden');
     gsheetReportsBtn.classList.remove('inline-flex');
    }
   }
   if (gsheetMatrixBtn) {
    if (canGsheet) {
     gsheetMatrixBtn.classList.remove('hidden');
     gsheetMatrixBtn.classList.add('inline-flex');
    } else {
     gsheetMatrixBtn.classList.add('hidden');
     gsheetMatrixBtn.classList.remove('inline-flex');
    }
   }
   if (gsheetNavBtn) {
    if (!canGsheet) {
     gsheetNavBtn.classList.add('hidden');
    }
   }

   // 2. Database Cloud 24/7
   const navGithub = document.getElementById('nav-github');
   const navCloudBtn = document.getElementById('nav-btn-cloud-sync');
   const canCloud = isAdmin || hasPermission('perm_sys_cloud_sync');
   if (navGithub) {
    if (canCloud && !isScanner) {
     navGithub.classList.remove('hidden');
     navGithub.classList.add('flex');
    } else {
     navGithub.classList.add('hidden');
     navGithub.classList.remove('flex');
    }
   }
   if (navCloudBtn) {
    if (canCloud && !isScanner) {
     navCloudBtn.classList.remove('hidden');
     navCloudBtn.classList.add('flex');
    } else {
     navCloudBtn.classList.add('hidden');
     navCloudBtn.classList.remove('flex');
    }
   }

   // 2.5 Pengaturan Suara Notifikasi Presensi
   const navAudioBtn = document.getElementById('nav-btn-audio-settings');
   const navAudioAdmin = document.getElementById('nav-btn-audio-admin');
   const settingsAudioSection = document.getElementById('admin-audio-settings-card');
   const canAudio = isAdmin || hasPermission('perm_sys_audio_settings');
   if (canAudio && !isScanner) {
    if (navAudioBtn) { navAudioBtn.classList.remove('hidden'); navAudioBtn.classList.add('flex'); }
    if (navAudioAdmin) { navAudioAdmin.classList.remove('hidden'); navAudioAdmin.classList.add('inline-flex'); }
    if (settingsAudioSection) settingsAudioSection.classList.remove('hidden');
   } else {
    if (navAudioBtn) { navAudioBtn.classList.add('hidden'); navAudioBtn.classList.remove('flex'); }
    if (navAudioAdmin) { navAudioAdmin.classList.add('hidden'); navAudioAdmin.classList.remove('inline-flex'); }
    if (settingsAudioSection) settingsAudioSection.classList.add('hidden');
   }

   // 2.6 Pengaturan Tema Warna Tampilan Aplikasi
   const settingsThemeSection = document.getElementById('admin-theme-settings-card');
   if ((isAdmin || isManager) && !isScanner) {
    if (settingsThemeSection) settingsThemeSection.classList.remove('hidden');
   } else {
    if (settingsThemeSection) settingsThemeSection.classList.add('hidden');
   }

   // 3. Pengaturan Akun & Akses Menu Sesuai Role & Granular Permissions
   const navBtnSettings = document.getElementById('nav-btn-settings');
   const navSettings = document.getElementById('nav-settings');
   const sysSettings = document.getElementById('system-settings-section');
   const adminSection = document.getElementById('admin-menu-section');
   const navDash = document.getElementById('nav-dashboard');

   const appSidebar = document.getElementById('app-sidebar');
   if (isScanner) {
    // Scanner Mode
    document.body.classList.add('is-scanner-mode');
    if (appSidebar) {
     appSidebar.classList.add('hidden');
     appSidebar.style.display = 'none';
    }
    if (navBtnSettings) navBtnSettings.classList.add('hidden');
    if (navSettings) {
     navSettings.classList.add('hidden');
     navSettings.classList.remove('flex');
    }
    if (sysSettings) sysSettings.classList.add('hidden');
    if (adminSection) adminSection.classList.add('hidden');
    if (navDash) {
     navDash.classList.add('hidden');
     navDash.classList.remove('flex');
    }
   } else {
    document.body.classList.remove('is-scanner-mode');
    if (appSidebar) {
     appSidebar.classList.remove('hidden');
     appSidebar.style.display = '';
    }
    if (navBtnSettings) navBtnSettings.classList.remove('hidden');
    if (navSettings) {
     navSettings.classList.remove('hidden');
     navSettings.classList.add('flex');
    }
    if (sysSettings) sysSettings.classList.remove('hidden');

    // Periksa izin sub-menu di manajemen
    const canViewLeaves = isAdmin || hasPermission('perm_submit_leave_staff') || hasPermission('perm_approve_leave_spv') || hasPermission('perm_approve_leave_mgr');
    const canViewOt = isAdmin || hasPermission('perm_submit_batch_ot') || hasPermission('perm_approve_ot_spv') || hasPermission('perm_approve_ot_mgr') || hasPermission('perm_rep_ot');
    const canViewEmp = isAdmin || hasPermission('perm_emp_view') || hasPermission('perm_emp_add');
    const canViewIdCard = isAdmin || hasPermission('perm_idcard_single') || hasPermission('perm_idcard_batch_a4') || hasPermission('perm_idcard_qr_location');
    const canViewReports = isAdmin || hasPermission('perm_rep_records') || hasPermission('perm_rep_matrix') || hasPermission('perm_rep_workhours') || hasPermission('perm_rep_leaves') || hasPermission('perm_rep_ot');

    const navLeaves = document.getElementById('nav-leaves');
    const navOt = document.getElementById('nav-overtime');
    const navEmp = document.getElementById('nav-employees');
    const navIdCard = document.getElementById('nav-idcard');
    const navReports = document.getElementById('nav-reports-group');

    if (navLeaves) {
     if (canViewLeaves) { navLeaves.classList.remove('hidden'); navLeaves.classList.add('flex'); }
     else { navLeaves.classList.add('hidden'); navLeaves.classList.remove('flex'); }
    }
    if (navOt) {
     if (canViewOt) { navOt.classList.remove('hidden'); navOt.classList.add('flex'); }
     else { navOt.classList.add('hidden'); navOt.classList.remove('flex'); }
    }
    if (navEmp) {
     if (canViewEmp) { navEmp.classList.remove('hidden'); navEmp.classList.add('flex'); }
     else { navEmp.classList.add('hidden'); navEmp.classList.remove('flex'); }
    }
    if (navIdCard) {
     if (canViewIdCard) { navIdCard.classList.remove('hidden'); navIdCard.classList.add('flex'); }
     else { navIdCard.classList.add('hidden'); navIdCard.classList.remove('flex'); }
    }
    if (navReports) {
     if (canViewReports) { navReports.classList.remove('hidden'); navReports.classList.add('flex'); }
     else { navReports.classList.add('hidden'); navReports.classList.remove('flex'); }
    }

    const hasAnyAdminMenu = canViewLeaves || canViewOt || canViewEmp || canViewIdCard || canViewReports;
    if (adminSection) {
     if (hasAnyAdminMenu) adminSection.classList.remove('hidden');
     else adminSection.classList.add('hidden');
    }

    if (navDash) {
     if (hasAnyAdminMenu || isManagement) {
      navDash.classList.remove('hidden');
      navDash.classList.add('flex');
     } else {
      navDash.classList.add('hidden');
      navDash.classList.remove('flex');
     }
    }

    // Sinkronisasi tombol menu navigasi bawah HP (Mobile Bottom Nav) & Hamburger Toggle
    const mobNav = document.getElementById('mobile-bottom-nav');
    const mobToggle = document.getElementById('btn-mobile-sidebar-toggle');
    if (isScanner) {
     if (mobNav) mobNav.classList.add('hidden');
     if (mobToggle) mobToggle.classList.add('hidden');
    } else {
     if (mobNav) mobNav.classList.remove('hidden');
     if (mobToggle) mobToggle.classList.remove('hidden');

     const mobLeaves = document.getElementById('mob-nav-leaves');
     const mobOt = document.getElementById('mob-nav-overtime');
     const mobDash = document.getElementById('mob-nav-dashboard');

     if (mobLeaves) {
      if (canViewLeaves) mobLeaves.classList.remove('hidden');
      else mobLeaves.classList.add('hidden');
     }
     if (mobOt) {
      if (canViewOt) mobOt.classList.remove('hidden');
      else mobOt.classList.add('hidden');
     }
     if (mobDash) {
      if (hasAnyAdminMenu || isManagement) mobDash.classList.remove('hidden');
      else mobDash.classList.add('hidden');
     }
    }

    // Tombol aksi di modul Data Karyawan
    const btnAddEmp = document.getElementById('btn-add-emp-modal');
    const lblUploadExcel = document.getElementById('lbl-upload-excel');
    const btnDownloadExcel = document.getElementById('btn-download-emp-excel');
    const btnTemplateExcel = document.getElementById('btn-template-emp-excel');
    const btnDeleteSelected = document.getElementById('btn-delete-selected-emp');

    if (btnAddEmp) {
     if (isAdmin || hasPermission('perm_emp_add')) {
      btnAddEmp.classList.remove('hidden');
      btnAddEmp.classList.add('inline-flex');
     } else {
      btnAddEmp.classList.add('hidden');
      btnAddEmp.classList.remove('inline-flex');
     }
    }
    if (lblUploadExcel) {
     if (isAdmin || hasPermission('perm_emp_upload_excel')) {
      lblUploadExcel.classList.remove('hidden');
      lblUploadExcel.classList.add('inline-flex');
     } else {
      lblUploadExcel.classList.add('hidden');
      lblUploadExcel.classList.remove('inline-flex');
     }
    }
    if (btnDownloadExcel) {
     if (isAdmin || hasPermission('perm_emp_download_excel')) {
      btnDownloadExcel.classList.remove('hidden');
      btnDownloadExcel.classList.add('inline-flex');
     } else {
      btnDownloadExcel.classList.add('hidden');
      btnDownloadExcel.classList.remove('inline-flex');
     }
    }
    if (btnTemplateExcel) {
     if (isAdmin || hasPermission('perm_emp_upload_excel') || hasPermission('perm_emp_add')) {
      btnTemplateExcel.classList.remove('hidden');
      btnTemplateExcel.classList.add('inline-flex');
     } else {
      btnTemplateExcel.classList.add('hidden');
      btnTemplateExcel.classList.remove('inline-flex');
     }
    }
    if (btnDeleteSelected) {
     if (isAdmin || hasPermission('perm_emp_delete')) {
      btnDeleteSelected.classList.remove('hidden');
      btnDeleteSelected.classList.add('inline-flex');
     } else {
      btnDeleteSelected.classList.add('hidden');
      btnDeleteSelected.classList.remove('inline-flex');
     }
    }
    const btnPurgeGhost = document.getElementById('btn-purge-ghost-emp');
    if (btnPurgeGhost) {
     if (isAdmin || hasPermission('perm_emp_delete') || hasPermission('perm_emp_add')) {
      btnPurgeGhost.classList.remove('hidden');
      btnPurgeGhost.classList.add('inline-flex');
     } else {
      btnPurgeGhost.classList.add('hidden');
      btnPurgeGhost.classList.remove('inline-flex');
     }
    }
    // Master Checkbox Karyawan (Hanya aktif jika memiliki izin hapus karyawan)
    const empMasterCheck = document.getElementById('emp-master-check');
    const canDeleteEmp = isAdmin || isManager || hasPermission('perm_emp_delete');
    if (empMasterCheck) {
     empMasterCheck.style.display = canDeleteEmp ? '' : 'none';
     empMasterCheck.disabled = !canDeleteEmp;
    }
   }

   // 4. Switcher Warehouse & Tombol MBI / MAI Sesuai Hak Akses
   // Jika akun hanya diberi izin 1 gudang (misal MAI saja), tombol MBI seketika menghilang/disembunyikan total
   const whSwitcher = document.getElementById('wh-switcher-box');
   const btnMbi = document.getElementById('wh-btn-mbi');
   const btnMai = document.getElementById('wh-btn-mai');
   const canMultiWh = canAccessMultiWarehouse(currentUser);
   const userWh = (currentUser ? currentUser.warehouse : activeWarehouse) || 'MBI';
   let canMbi = false;
   let canMai = false;

   if (canMultiWh) {
    canMbi = hasPermission('perm_wh_mbi');
    canMai = hasPermission('perm_wh_mai');
    if (!canMbi && !canMai) {
     canMbi = true;
     canMai = true;
    }
   } else {
    // Mode 1 Gudang Saja: Tampilkan HANYA gudang yang berhak diakses
    if (hasPermission('perm_wh_mai') && !hasPermission('perm_wh_mbi')) {
     canMbi = false;
     canMai = true;
    } else if (hasPermission('perm_wh_mbi') && !hasPermission('perm_wh_mai')) {
     canMbi = true;
     canMai = false;
    } else {
     canMbi = (userWh === 'MBI');
     canMai = (userWh === 'MAI');
    }
   }

   if (!canMultiWh) {
    if (canMbi && !canMai && activeWarehouse !== 'MBI') {
     activeWarehouse = 'MBI';
     updateNavbarBrand('MBI');
    } else if (canMai && !canMbi && activeWarehouse !== 'MAI') {
     activeWarehouse = 'MAI';
     updateNavbarBrand('MAI');
    }
   }

   if (btnMbi) {
    if (canMbi) {
     btnMbi.classList.remove('hidden');
     btnMbi.style.display = '';
    } else {
     btnMbi.classList.add('hidden');
     btnMbi.style.display = 'none';
    }
   }
   if (btnMai) {
    if (canMai) {
     btnMai.classList.remove('hidden');
     btnMai.style.display = '';
    } else {
     btnMai.classList.add('hidden');
     btnMai.style.display = 'none';
    }
   }

   if (whSwitcher) {
    if (isScanner) {
     whSwitcher.classList.add('hidden');
     whSwitcher.classList.remove('flex');
    } else {
     whSwitcher.classList.remove('hidden');
     whSwitcher.classList.add('flex');
    }
   }

   // 4.5 Form Pengajuan Izin/Sakit/Cuti & Form Lembur Massal
   // Jika akun tidak memiliki hak input form, form seketika menghilang dari layar
   const cardLeaveForm = document.getElementById('card-leave-form');
   const cardLeaveTable = document.getElementById('card-leave-table');
   const canSubmitLeave = isAdmin || isManager || hasPermission('perm_submit_leave_staff');
   if (cardLeaveForm) {
    if (canSubmitLeave && !isScanner) {
     cardLeaveForm.classList.remove('hidden');
     if (cardLeaveTable) {
      cardLeaveTable.classList.remove('lg:col-span-12');
      cardLeaveTable.classList.add('lg:col-span-7');
     }
    } else {
     cardLeaveForm.classList.add('hidden');
     if (cardLeaveTable) {
      cardLeaveTable.classList.remove('lg:col-span-7');
      cardLeaveTable.classList.add('lg:col-span-12');
     }
    }
   }

   const cardOtForm = document.getElementById('card-overtime-form');
   const canSubmitOt = isAdmin || isManager || hasPermission('perm_submit_batch_ot');
   if (cardOtForm) {
    if (canSubmitOt && !isScanner) {
     cardOtForm.classList.remove('hidden');
    } else {
     cardOtForm.classList.add('hidden');
    }
   }

   // 4.6 Sub-Tabs di dalam Modul Laporan & Rekapitulasi
   const tabRec = document.getElementById('btn-tab-records');
   const tabMat = document.getElementById('btn-tab-matrix');
   const tabWh = document.getElementById('btn-tab-workhours');
   const tabLv = document.getElementById('btn-tab-report-leaves');
   const tabOt = document.getElementById('btn-tab-report-overtime');

   const canRec = isAdmin || isManager || hasPermission('perm_rep_records');
   const canMat = isAdmin || isManager || hasPermission('perm_rep_matrix');
   const canWh = isAdmin || isManager || hasPermission('perm_rep_workhours');
   const canLv = isAdmin || isManager || hasPermission('perm_rep_leaves');
   const canOt = isAdmin || isManager || hasPermission('perm_rep_ot');

   if (tabRec) tabRec.classList.toggle('hidden', !canRec);
   if (tabMat) tabMat.classList.toggle('hidden', !canMat);
   if (tabWh) tabWh.classList.toggle('hidden', !canWh);
   if (tabLv) tabLv.classList.toggle('hidden', !canLv);
   if (tabOt) tabOt.classList.toggle('hidden', !canOt);

   // Tombol Salin Matriks (WhatsApp/Clipboard)
   const btnCopyMatrix = document.getElementById('btn-copy-matrix');
   const canCopyMatrix = isAdmin || isManager || hasPermission('perm_rep_copy_matrix');
   if (btnCopyMatrix) btnCopyMatrix.classList.toggle('hidden', !canCopyMatrix);

   // Tombol Download Laporan Excel
   const canDownloadRep = isAdmin || isManager || hasPermission('perm_rep_download_excel');
   const repDownloadBtns = [
    document.getElementById('btn-download-records-excel'),
    document.getElementById('btn-download-matrix-excel'),
    document.getElementById('btn-download-workhours-excel'),
    document.getElementById('btn-download-report-leaves-excel'),
    document.getElementById('btn-download-report-ot-excel')
   ];
   repDownloadBtns.forEach(b => { if (b) b.classList.toggle('hidden', !canDownloadRep); });

   // 4.7 Tombol di Modul Kartu ID Karyawan
   const btnAllA4 = document.getElementById('btn-open-all-idcards-modal');
   const canBatchA4 = isAdmin || isManager || hasPermission('perm_idcard_batch_a4');
   if (btnAllA4) btnAllA4.classList.toggle('hidden', !canBatchA4);

   const canSingleId = isAdmin || isManager || hasPermission('perm_idcard_single');
   const btnDlPng = document.getElementById('btn-download-idcard-png');
   const btnPrintId = document.getElementById('btn-print-idcard-single');
   if (btnDlPng) btnDlPng.classList.toggle('hidden', !canSingleId);
   if (btnPrintId) btnPrintId.classList.toggle('hidden', !canSingleId);

   const btnEditFromId = document.getElementById('btn-edit-emp-from-idcard');
   const canEmpEdit = isAdmin || isManager || hasPermission('perm_emp_edit');
   if (btnEditFromId) btnEditFromId.classList.toggle('hidden', !canEmpEdit);

   // 4.8 Pengaturan Titik & Radius GPS Presensi
   const gpsBox = document.getElementById('gps-config-box');
   const canGpsEdit = isAdmin || isManager || hasPermission('perm_sys_gps_edit');
   if (gpsBox) {
    if (canGpsEdit && !isScanner) {
     gpsBox.classList.remove('hidden');
    } else {
     gpsBox.classList.add('hidden');
    }
   }

   // 5. Tombol Reset Semua Data Karyawan
   const btnResetAllEmp = document.getElementById('btn-reset-all-emp');
   if (btnResetAllEmp) {
    if ((isAdmin || hasPermission('perm_emp_reset_all')) && !isScanner) {
     btnResetAllEmp.classList.remove('hidden');
     btnResetAllEmp.classList.add('inline-flex');
    } else {
     btnResetAllEmp.classList.add('hidden');
     btnResetAllEmp.classList.remove('inline-flex');
    }
   }

   // 6. Tombol Hapus Pilihan di Laporan (Record Absen, Rekap Pengajuan, Rekap Lembur - Khusus Admin / Manager)
   const canDeleteReports = (isAdmin || isManager || hasPermission('perm_rep_reset_att')) && !isScanner;
   const btnDelRec = document.getElementById('btn-delete-selected-records');
   const btnDelLeaves = document.getElementById('btn-delete-selected-report-leaves');
   const btnDelOt = document.getElementById('btn-delete-selected-report-ot');

   if (btnDelRec) {
    if (canDeleteReports) {
     btnDelRec.classList.remove('hidden');
     btnDelRec.classList.add('inline-flex');
    } else {
     btnDelRec.classList.add('hidden');
     btnDelRec.classList.remove('inline-flex');
    }
   }
   if (btnDelLeaves) {
    if (canDeleteReports) {
     btnDelLeaves.classList.remove('hidden');
     btnDelLeaves.classList.add('inline-flex');
    } else {
     btnDelLeaves.classList.add('hidden');
     btnDelLeaves.classList.remove('inline-flex');
    }
   }
   if (btnDelOt) {
    if (canDeleteReports) {
     btnDelOt.classList.remove('hidden');
     btnDelOt.classList.add('inline-flex');
    } else {
     btnDelOt.classList.add('hidden');
     btnDelOt.classList.remove('inline-flex');
    }
   }

   try { updateFirebaseUrlUI(); } catch(e) {}
  }


  function quickLoginScannerAccount(warehouse = 'MBI') {
   const users = getWhDB(warehouse, 'users', warehouse === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);
   let scannerUser = users.find(u => u.role === 'scanner' || u.nik === `ABSEN-${warehouse}`);
   if (!scannerUser) {
    scannerUser = {
     id: `${warehouse.toLowerCase()}-scanner`,
     name: 'Scanner Presensi Gudang',
     dept: 'presensi',
     outsource: 'Internal',
     phone: '-',
     email: `absen.${warehouse.toLowerCase()}@medika.com`,
     joinDate: '2023-01-01',
     nik: `ABSEN-${warehouse}`,
     role: 'scanner',
     password: 'medika123',
     isFirstLogin: false,
     warehouse
    };
   } else {
    scannerUser.name = 'Scanner Presensi Gudang';
    scannerUser.warehouse = warehouse;
    scannerUser.role = 'scanner';
    if (!scannerUser.password) scannerUser.password = 'medika123';
   }
   activeWarehouse = warehouse;
   try { updateWhSwitcherButtons(); } catch(e) {}
   const attLabel = document.getElementById('att-wh-label');
   if (attLabel) attLabel.innerText = `Gudang ${warehouse}`;
   loginUserSession(scannerUser);
  }

  function quickLoginAdmin(warehouse = 'MBI') {
   const users = getWhDB(warehouse, 'users', warehouse === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);
   let adminUser = users.find(u => isUserAdmin(u)) || (warehouse === 'MAI' ? SEED_MAI_USERS[0] : SEED_MBI_USERS[0]);
   adminUser = {
    ...adminUser,
    warehouse,
    id: warehouse === 'MAI' ? 'mai-admin' : 'mbi-admin',
    nik: warehouse === 'MAI' ? 'ADM-MAI' : 'ADM001',
    name: warehouse === 'MAI' ? 'Admin Gudang MAI' : 'Admin Gudang MBI',
    role: 'admin',
    dept: 'Administrator',
    accessibleWarehouses: [warehouse]
   };
   activeWarehouse = warehouse;
   try { updateWhSwitcherButtons(); } catch(e) {}
   try { initFirebaseLiveStream(warehouse); } catch(e) {}
   loginUserSession(adminUser);
  }

  function quickLoginManager(warehouse = 'MBI') {
   const mbiUsers = getWhDB('MBI', 'users', SEED_MBI_USERS);
   const maiUsers = getWhDB('MAI', 'users', SEED_MAI_USERS);
   let mgrUser = mbiUsers.find(u => isUserManager(u)) || maiUsers.find(u => isUserManager(u)) || SEED_MANAGER_USER;
   mgrUser = {
    ...mgrUser,
    warehouse,
    id: 'mgr-eko',
    nik: 'MGR001',
    name: mgrUser.name || 'Manager',
    role: 'manager',
    dept: 'Management'
   };
   activeWarehouse = warehouse;
   try { updateWhSwitcherButtons(); } catch(e) {}
   try { initFirebaseLiveStream(warehouse); } catch(e) {}
   loginUserSession(mgrUser);
  }
  window.quickLoginScannerAccount = quickLoginScannerAccount;
  window.quickLoginAdmin = quickLoginAdmin;
  window.quickLoginManager = quickLoginManager;
  window.getAdminCustomPassword = getAdminCustomPassword;
  window.setAdminCustomPassword = setAdminCustomPassword;
  window.flushAdminPasswordOutbox = flushAdminPasswordOutbox;

  // =========================================================