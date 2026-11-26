// === WFM MEDIKA CONFIG & FOUNDATION ===
  // SYSTEM APP VERSION CHECKER (OPSI 1: BERBASIS version.json HOSTING, 0 KUOTA FIRESTORE)
  // =========================================================
  const CURRENT_APP_VERSION = '20261125_v24';
  window.__WFM_VERSION_OUTDATED = false;
  let lastVersionCheckAt = 0;
  let isCheckingAppVersion = false;
  let snoozedUpdateInfo = { version: '', until: 0 };

  function parseAppVersionTuple(verStr) {
   if (!verStr || typeof verStr !== 'string') return null;
   const m = verStr.trim().match(/^(\d{8})(?:[_.-]?v?(\d+))?$/i);
   if (!m) return null;
   return [parseInt(m[1], 10) || 0, parseInt(m[2] || '1', 10) || 1];
  }

  function isNewerVersion(remoteVer, localVer = CURRENT_APP_VERSION) {
   const r = parseAppVersionTuple(remoteVer);
   const l = parseAppVersionTuple(localVer);
   if (!r || !l) return false;
   if (r[0] !== l[0]) return r[0] > l[0];
   return r[1] > l[1];
  }

  function hideAppUpdateBanner() {
   try {
    if (typeof document === 'undefined' || !document.getElementById) return;
    const el = document.getElementById('app-update-banner');
    if (el) el.remove();
   } catch(e) {}
  }

  function dismissAppUpdateBanner(ver) {
   snoozedUpdateInfo = { version: String(ver || ''), until: Date.now() + 15 * 60 * 1000 };
   hideAppUpdateBanner();
  }

  function applyAppUpdateAndReload(targetVer) {
   try {
    const u = new URL(window.location.href);
    u.searchParams.set('_v', String(targetVer || Date.now()));
    window.location.replace(u.toString());
   } catch(e) {
    try { window.location.reload(); } catch(e2) {}
   }
  }

  function showAppUpdateBanner(newVer, notes = '') {
   try {
    if (typeof document === 'undefined' || !document.body || typeof document.createElement !== 'function') return;
    const verStr = String(newVer || '').trim();
    if (!verStr || !isNewerVersion(verStr, CURRENT_APP_VERSION)) {
     hideAppUpdateBanner();
     return;
    }
    if (snoozedUpdateInfo.version === verStr && Date.now() < snoozedUpdateInfo.until) {
     return;
    }
    let banner = document.getElementById('app-update-banner');
    if (!banner) {
     banner = document.createElement('div');
     banner.id = 'app-update-banner';
     banner.className = 'fixed bottom-4 right-4 z-[9999] max-w-sm w-[calc(100vw-2rem)] bg-slate-900 text-white border border-slate-700 rounded-2xl shadow-2xl p-4';
     document.body.appendChild(banner);
    }
    const safeVer = typeof escapeHTML === 'function' ? escapeHTML(verStr) : verStr;
    const safeNotes = notes ? (typeof escapeHTML === 'function' ? escapeHTML(String(notes)) : String(notes)) : 'Perbaikan & pembaruan sinkronisasi terbaru siap dipakai.';
    banner.innerHTML = `
     <div class="flex items-start gap-3">
      <div class="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 flex items-center justify-center shrink-0 font-black text-xs">
       NEW
      </div>
      <div class="flex-1 min-w-0">
       <div class="flex items-center justify-between gap-2">
        <p class="text-xs font-black text-white tracking-wide">Pembaruan Sistem Tersedia</p>
        <span class="px-2 py-0.5 rounded-md bg-slate-800 text-emerald-300 font-mono text-[10px] font-bold">${safeVer}</span>
       </div>
       <p class="text-[11px] text-slate-300 mt-1 leading-relaxed">${safeNotes} Data lokal &amp; antrean absen tetap aman.</p>
       <div class="flex items-center gap-2 mt-3">
        <button type="button" onclick="applyAppUpdateAndReload('${safeVer}')" class="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[11px] transition shadow-xs">
         Muat Ulang Sekarang
        </button>
        <button type="button" onclick="dismissAppUpdateBanner('${safeVer}')" class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[11px] transition">
         Nanti
        </button>
       </div>
      </div>
     </div>`;
   } catch(e) {}
  }

  async function publishAppVersionToCloud() { return; }

  async function checkAppVersionUpdate(force = false) {
   try {
    if (typeof window === 'undefined' || !window.location || window.location.protocol === 'file:') return false;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
    if (typeof fetch !== 'function') return false;
    const now = Date.now();
    if (!force && (now - lastVersionCheckAt < 60000)) return false;
    if (isCheckingAppVersion) return false;
    isCheckingAppVersion = true;
    lastVersionCheckAt = now;

    const res = await fetch(`./version.json?_vt=${now}`, { cache: 'no-store' });
    if (!res || !res.ok) return false;
    const ctype = (res.headers && res.headers.get) ? (res.headers.get('content-type') || '') : '';
    if (ctype && !ctype.includes('json') && !ctype.includes('text/plain')) return false;
    const data = await res.json();
    const remoteVer = data && typeof data.version === 'string' ? data.version.trim() : '';
    if (!remoteVer) return false;

    if (isNewerVersion(remoteVer, CURRENT_APP_VERSION)) {
     window.__WFM_VERSION_OUTDATED = true;
     showAppUpdateBanner(remoteVer, data.notes || '');
     return true;
    } else {
     window.__WFM_VERSION_OUTDATED = false;
     hideAppUpdateBanner();
     return false;
    }
   } catch(e) {
    return false;
   } finally {
    isCheckingAppVersion = false;
   }
  }

  // =========================================================
  // MASTER DATA KARYAWAN: TOMBSTONE TRACKING & STRICT SORTING ENGINE
  // Mencegah data terhapus bangkit kembali (anti-zombie) & sorting join date akurat
  // =========================================================
  function getDeletedUserKeys() {
   const setKeys = new Set([
    'agus setiawan', 'agussetiawan',
    'budi santoso', 'budisantoso'
   ]);
   try {
    const raw = localStorage.getItem('wfm_deleted_user_keys');
    if (raw) {
     const arr = JSON.parse(raw);
     if (Array.isArray(arr)) {
      arr.forEach(k => {
       if (k) setKeys.add(String(k).trim().toLowerCase());
      });
     }
    }
   } catch (e) {}
   // SINGLE SOURCE OF TRUTH: Lindungi seluruh karyawan sah SEED master agar tidak pernah masuk daftar terhapus
   const allSeeds = (typeof SEED_MBI_USERS !== 'undefined' ? SEED_MBI_USERS : []).concat(typeof SEED_MAI_USERS !== 'undefined' ? SEED_MAI_USERS : []);
   let hadForbidden = false;
   allSeeds.forEach(s => {
    if (!s) return;
    const keysToRemove = [
     s.nik, s.barcodeValue, s.id, s.name,
     cleanStr(s.nik), cleanStr(s.name), cleanStr(s.id)
    ];
    keysToRemove.forEach(k => {
     if (k) {
      const lk = String(k).trim().toLowerCase();
      if (setKeys.has(lk)) { setKeys.delete(lk); hadForbidden = true; }
     }
    });
   });
   if (hadForbidden) {
    try {
     localStorage.setItem('wfm_deleted_user_keys', JSON.stringify(Array.from(setKeys)));
    } catch (e) {}
   }
   return setKeys;
  }

  function saveDeletedUserKeys(setKeys) {
   try {
    const arr = Array.from(setKeys);
    localStorage.setItem('wfm_deleted_user_keys', JSON.stringify(arr));
   } catch (e) {}
  }

  function trackDeletedUsers(usersOrNiks) {
   if (!usersOrNiks) return;
   const keys = getDeletedUserKeys();
   const list = Array.isArray(usersOrNiks) ? usersOrNiks : [usersOrNiks];
   list.forEach(item => {
    if (!item) return;
    if (typeof item === 'string') {
     keys.add(cleanStr(item));
     keys.add(item.trim().toLowerCase());
    } else if (typeof item === 'object') {
     if (item.name) {
      keys.add(cleanStr(item.name));
      keys.add(item.name.trim().toLowerCase());
     }
     if (item.id) {
      keys.add(cleanStr(item.id));
      keys.add(item.id.trim().toLowerCase());
     }
     if (item.nik) {
      keys.add(cleanStr(item.nik));
      keys.add(item.nik.trim().toLowerCase());
     }
    }
   });
   saveDeletedUserKeys(keys);
  }

  function markDeletedUser(userOrKey) {
   if (!userOrKey) return;
   trackDeletedUsers(userOrKey);
  }

  function unmarkDeletedUser(nameOrNik) {
   if (!nameOrNik) return;
   const keys = getDeletedUserKeys();
   const str = String(nameOrNik).trim();
   const c = cleanStr(str);
   const raw = str.toLowerCase();
   // Agus Setiawan dan Budi Santoso dilarang keras di-unmark agar tidak pernah bangkit kembali
   if (raw === 'agus setiawan' || c === 'agussetiawan' || raw === 'budi santoso' || c === 'budisantoso') return;
   keys.delete(c);
   keys.delete(raw);
   saveDeletedUserKeys(keys);
  }

  function sanitizeDeletedUserKeysWithActiveUsers() {
   // Dijaga agar tombstone (daftar karyawan yang dihapus) tidak pernah terhapus secara otomatis
   // Pembatalan status hapus hanya dapat dilakukan secara eksplisit saat admin menambah karyawan baru via unmarkDeletedUser()
   return;
  }

  function isUserMarkedDeleted(user, deletedKeys = null) {
   if (!user) return false;
   const keys = deletedKeys || getDeletedUserKeys();
   const rawName = (user.name || '').trim().toLowerCase();
   const cName = cleanStr(user.name);
   const rawNik = (user.nik || '').trim().toLowerCase();
   const cNik = cleanStr(user.nik);
   const rawId = (user.id || '').trim().toLowerCase();
   const cId = cleanStr(user.id);

   // KUNCI MATI PERMANEN: Agus Setiawan & Budi Santoso (Akun demo fiktif bawaan)
   if (rawName === 'agus setiawan' || cName === 'agussetiawan') return true;
   if (rawName === 'budi santoso' || cName === 'budisantoso') return true;

   // Cek apakah karyawan ini ada dalam daftar tombstone yang dihapus permanen oleh Admin
   if (keys && keys.size > 0) {
    if (rawNik && keys.has(rawNik)) return true;
    if (cNik && keys.has(cNik)) return true;
    if (rawName && keys.has(rawName)) return true;
    if (cName && keys.has(cName)) return true;
    if (rawId && keys.has(rawId)) return true;
    if (cId && keys.has(cId)) return true;
   }

   return false;
  }

  // =========================================================
  // RECORD ABSENSI: TOMBSTONE TRACKING ENGINE
  // Mencegah record absen yang dihapus bangkit kembali dari Cloud & sinkronisasi Google Sheet
  // =========================================================
  function getDeletedAttendanceIds() {
   // Otomatis bersihkan tombstone kadaluwarsa agar seluruh data resmi Supabase pulih utuh
   if (!localStorage.getItem('wfm_v13_cleaned_tombstones')) {
    try {
     localStorage.removeItem('wfm_deleted_attendance_ids');
     localStorage.setItem('wfm_v13_cleaned_tombstones', 'true');
    } catch(e) {}
   }
   const setKeys = new Set();
   try {
    const raw = localStorage.getItem('wfm_deleted_attendance_ids');
    if (raw) {
     const arr = JSON.parse(raw);
     if (Array.isArray(arr)) {
      arr.forEach(k => {
       if (k) setKeys.add(String(k).trim().toLowerCase());
      });
     }
    }
   } catch (e) {}
   return setKeys;
  }

  function saveDeletedAttendanceIds(setKeys) {
   try {
    const arr = Array.from(setKeys);
    localStorage.setItem('wfm_deleted_attendance_ids', JSON.stringify(arr));
   } catch (e) {}
  }

  function getAttendanceCompositeKey(item) {
   if (!item) return '';
   const nik = (item.userNik || item.nik || '').toUpperCase().trim();
   const date = (item.date || '').trim();
   const checkIn = (item.checkInTime || '').trim();
   if (!nik && !date && !checkIn) return '';
   return `${nik}_${date}_${checkIn}`.toLowerCase();
  }

  function getAttendanceMinuteKey(item) {
   if (!item) return '';
   const nik = (item.userNik || item.nik || '').toUpperCase().trim();
   const date = (item.date || '').trim();
   if (!nik || !date || !item.checkInTime) return '';
   try {
    const dt = new Date(item.checkInTime);
    if (isNaN(dt.getTime())) return '';
    const hhmm = dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' });
    return `${nik}__${date}__${hhmm}`.toLowerCase();
   } catch (e) {
    return '';
   }
  }

  function trackDeletedAttendance(itemsOrIds) {
   if (!itemsOrIds) return;
   const keys = getDeletedAttendanceIds();
   const list = Array.isArray(itemsOrIds) ? itemsOrIds : [itemsOrIds];
   list.forEach(item => {
    if (!item) return;
    if (typeof item === 'string') {
     keys.add(item.trim().toLowerCase());
    } else if (typeof item === 'object') {
     if (item.id) keys.add(String(item.id).trim().toLowerCase());
     if (item._firestoreDocId) keys.add(String(item._firestoreDocId).trim().toLowerCase());
     const compKey = getAttendanceCompositeKey(item);
     if (compKey) keys.add(compKey);
     const minKey = getAttendanceMinuteKey(item);
     if (minKey) keys.add(minKey);
    }
   });
   saveDeletedAttendanceIds(keys);
  }

  function untrackDeletedAttendance(itemsOrIds) {
   if (!itemsOrIds) return;
   const keys = getDeletedAttendanceIds();
   if (keys.size === 0) return;
   const list = Array.isArray(itemsOrIds) ? itemsOrIds : [itemsOrIds];
   let changed = false;
   list.forEach(item => {
    if (!item) return;
    if (typeof item === 'string') {
     if (keys.delete(item.trim().toLowerCase())) changed = true;
    } else if (typeof item === 'object') {
     if (item.id && keys.delete(String(item.id).trim().toLowerCase())) changed = true;
     if (item._firestoreDocId && keys.delete(String(item._firestoreDocId).trim().toLowerCase())) changed = true;
     const compKey = getAttendanceCompositeKey(item);
     if (compKey && keys.delete(compKey)) changed = true;
     const minKey = getAttendanceMinuteKey(item);
     if (minKey && keys.delete(minKey)) changed = true;
    }
   });
   if (changed) saveDeletedAttendanceIds(keys);
  }

  function isAttendanceMarkedDeleted(item, deletedIds = null) {
   if (!item) return false;
   if (item.__userDeletedExplicitly === true) return true;
   const delSet = deletedIds || getDeletedAttendanceIds();
   if (delSet && delSet.size > 0) {
    if (item.id && delSet.has(String(item.id).trim().toLowerCase())) return true;
    if (item._firestoreDocId && delSet.has(String(item._firestoreDocId).trim().toLowerCase())) return true;
   }
   return false;
  }

  // =========================================================
  // REKAP PENGAJUAN (CUTI/SAKIT): TOMBSTONE TRACKING ENGINE
  // =========================================================
  function getDeletedLeaveIds() {
   const setKeys = new Set();
   try {
    const raw = localStorage.getItem('wfm_deleted_leave_ids');
    if (raw) {
     const arr = JSON.parse(raw);
     if (Array.isArray(arr)) arr.forEach(k => { if (k) setKeys.add(String(k).trim().toLowerCase()); });
    }
   } catch (e) {}
   return setKeys;
  }

  function saveDeletedLeaveIds(setKeys) {
   try {
    localStorage.setItem('wfm_deleted_leave_ids', JSON.stringify(Array.from(setKeys)));
   } catch (e) {}
  }

  function trackDeletedLeaves(itemsOrIds) {
   if (!itemsOrIds) return;
   const keys = getDeletedLeaveIds();
   const list = Array.isArray(itemsOrIds) ? itemsOrIds : [itemsOrIds];
   list.forEach(item => {
    if (!item) return;
    if (typeof item === 'string') {
     keys.add(item.trim().toLowerCase());
    } else if (typeof item === 'object') {
     if (item.id) keys.add(String(item.id).trim().toLowerCase());
     const compKey = `${(item.userNik || '').toUpperCase()}_${item.startDate || ''}_${item.type || ''}`.toLowerCase();
     keys.add(compKey);
    }
   });
   saveDeletedLeaveIds(keys);
  }

  function isLeaveMarkedDeleted(item) {
   if (!item) return false;
   const keys = getDeletedLeaveIds();
   if (keys.size === 0) return false;
   if (item.id && keys.has(String(item.id).trim().toLowerCase())) return true;
   const compKey = `${(item.userNik || '').toUpperCase()}_${item.startDate || ''}_${item.type || ''}`.toLowerCase();
   if (keys.has(compKey)) return true;
   return false;
  }

  function untrackDeletedLeaves(itemsOrIds) {
   if (!itemsOrIds) return;
   const keys = getDeletedLeaveIds();
   if (keys.size === 0) return;
   const list = Array.isArray(itemsOrIds) ? itemsOrIds : [itemsOrIds];
   let removed = false;
   list.forEach(item => {
    if (!item) return;
    if (typeof item === 'string') {
     if (keys.delete(item.trim().toLowerCase())) removed = true;
    } else if (typeof item === 'object') {
     if (item.id && keys.delete(String(item.id).trim().toLowerCase())) removed = true;
     const compKey = `${(item.userNik || '').toUpperCase()}_${item.startDate || ''}_${item.type || ''}`.toLowerCase();
     if (keys.delete(compKey)) removed = true;
    }
   });
   if (removed) saveDeletedLeaveIds(keys);
  }

  // =========================================================
  // REKAP LEMBUR: TOMBSTONE TRACKING ENGINE
  // =========================================================
  function getDeletedOvertimeIds() {
   const setKeys = new Set();
   try {
    const raw = localStorage.getItem('wfm_deleted_overtime_ids');
    if (raw) {
     const arr = JSON.parse(raw);
     if (Array.isArray(arr)) arr.forEach(k => { if (k) setKeys.add(String(k).trim().toLowerCase()); });
    }
   } catch (e) {}
   return setKeys;
  }

  function saveDeletedOvertimeIds(setKeys) {
   try {
    localStorage.setItem('wfm_deleted_overtime_ids', JSON.stringify(Array.from(setKeys)));
   } catch (e) {}
  }

  function trackDeletedOvertime(itemsOrIds) {
   if (!itemsOrIds) return;
   const keys = getDeletedOvertimeIds();
   const list = Array.isArray(itemsOrIds) ? itemsOrIds : [itemsOrIds];
   list.forEach(item => {
    if (!item) return;
    if (typeof item === 'string') {
     keys.add(item.trim().toLowerCase());
    } else if (typeof item === 'object') {
     if (item.id) keys.add(String(item.id).trim().toLowerCase());
     const compKey = `${(item.userNik || '').toUpperCase()}_${item.date || ''}_${item.startTime || ''}`.toLowerCase();
     keys.add(compKey);
    }
   });
   saveDeletedOvertimeIds(keys);
  }

  function untrackDeletedOvertime(itemsOrIds) {
   if (!itemsOrIds) return;
   const keys = getDeletedOvertimeIds();
   if (keys.size === 0) return;
   const list = Array.isArray(itemsOrIds) ? itemsOrIds : [itemsOrIds];
   let removed = false;
   list.forEach(item => {
    if (!item) return;
    if (typeof item === 'string') {
     if (keys.delete(item.trim().toLowerCase())) removed = true;
    } else if (typeof item === 'object') {
     if (item.id && keys.delete(String(item.id).trim().toLowerCase())) removed = true;
     const compKey = `${(item.userNik || '').toUpperCase()}_${item.date || ''}_${item.startTime || ''}`.toLowerCase();
     if (keys.delete(compKey)) removed = true;
    }
   });
   if (removed) saveDeletedOvertimeIds(keys);
  }

  function isOvertimeMarkedDeleted(item) {
   if (!item) return false;
   const keys = getDeletedOvertimeIds();
   if (keys.size === 0) return false;
   if (item.id && keys.has(String(item.id).trim().toLowerCase())) return true;
   const compKey = `${(item.userNik || '').toUpperCase()}_${item.date || ''}_${item.startTime || ''}`.toLowerCase();
   if (keys.has(compKey)) return true;
   return false;
  }

  function getSortableJoinDate(val) {
   if (!val) return '9999-99-99';
   const s = String(val).trim();
   if (!s || s === '-' || s === ' - ' || s === '--' || s.toLowerCase() === 'n/a' || s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined' || s.startsWith('0000')) {
    return '9999-99-99';
   }
   const formatted = typeof formatExcelDate === 'function' ? formatExcelDate(s) : s;
   if (/^\d{4}-\d{2}-\d{2}$/.test(formatted)) {
    const y = parseInt(formatted.substring(0, 4), 10);
    if (y >= 1970 && y <= 2099) return formatted;
   }
   return '9999-99-99';
  }

  function getSavedUserPerms(nik, wh = null) {
   if (!nik) return null;
   try {
    const cleanNik = String(nik).trim().toUpperCase();
    const targetWh = (wh || activeWarehouse || 'MBI').toLowerCase();
    const isMgr = (cleanNik === 'MGR001' || cleanNik.startsWith('MGR') || cleanNik === 'MGR-EKO');
    const raw = localStorage.getItem(`wfm_perm_${targetWh}_${cleanNik}`) ||
          localStorage.getItem(`wfm_perm_${cleanNik}`) ||
          (isMgr ? (localStorage.getItem('wfm_perm_mgr001') || localStorage.getItem('wfm_perm_mbi_mgr001') || localStorage.getItem('wfm_perm_mai_mgr001')) : null);
    if (raw) return JSON.parse(raw);
   } catch(e) {}
   return null;
  }

  function deduplicateUserList(users, warehouse = 'MBI') {
   if (!Array.isArray(users)) return [];
    users = enforceNikIntegrity(users, warehouse === 'MBI' ? (typeof SEED_MBI_USERS !== 'undefined' ? SEED_MBI_USERS : []) : (typeof SEED_MAI_USERS !== 'undefined' ? SEED_MAI_USERS : []));
   const seenNames = new Set();
   const seenIds = new Set();
   const seenNiks = new Set();
   const cleanList = [];

   // 1. Tempatkan Admin Utama Sistem di awal (Khusus gudang masing-masing)
   const targetAdminId = warehouse === 'MBI' ? 'mbi-admin' : 'mai-admin';
   const targetAdminNik = warehouse === 'MBI' ? 'ADM001' : 'ADM-MAI';
   const targetAdminName = warehouse === 'MBI' ? 'Admin Gudang MBI' : 'Admin Gudang MAI';
   const seedAdmin = (warehouse === 'MBI' ? { ...SEED_MBI_USERS[0] } : { ...SEED_MAI_USERS[0] });

   const foundAdmin = users.find(u => u && (
    u.id === targetAdminId || 
    (u.nik && u.nik.toUpperCase() === targetAdminNik) || 
    cleanStr(u.name) === cleanStr(targetAdminName) ||
    (u.warehouse === warehouse && isUserAdmin(u) && !u.id.includes(warehouse === 'MBI' ? 'mai' : 'mbi'))
   ));

   const admin = foundAdmin ? { ...foundAdmin } : { ...seedAdmin };
   admin.id = targetAdminId;
   admin.nik = targetAdminNik;
   admin.warehouse = warehouse;
   admin.dept = 'Administrator';
   admin.role = 'admin';
   admin.hasAccount = true;
   admin.barcodeValue = admin.nik;
   admin.name = targetAdminName;
   admin.accessibleWarehouses = [warehouse];
   if (foundAdmin && foundAdmin.phone) admin.phone = foundAdmin.phone;
   if (foundAdmin && foundAdmin.email) admin.email = foundAdmin.email;
   if (warehouse === 'MBI') {
    admin.password = (foundAdmin && foundAdmin.password && foundAdmin.password !== 'adminmai123') ? foundAdmin.password : (seedAdmin.password || 'adminmbi123');
   } else {
    admin.password = (foundAdmin && foundAdmin.password && foundAdmin.password !== 'adminmbi123') ? foundAdmin.password : (seedAdmin.password || 'adminmai123');
   }
   admin.permissions = {
    ...(foundAdmin && foundAdmin.permissions ? foundAdmin.permissions : seedAdmin.permissions),
    perm_wh_mbi: (warehouse === 'MBI'),
    perm_wh_mai: (warehouse === 'MAI'),
    perm_wh_switch: false
   };
   cleanList.push(admin);
   seenNames.add(cleanStr(admin.name));
   if (admin.id) seenIds.add(admin.id);
   seenNiks.add(admin.nik.toUpperCase());

   // 2. Tempatkan Akun Dedicated Scanner Absen
   const scanner = users.find(u => (u.id === `${warehouse.toLowerCase()}-scanner`) || (u.nik && u.nik === `ABSEN-${warehouse}`) || (u.role === 'scanner' && cleanStr(u.name).includes('scanner'))) || (warehouse === 'MBI' ? { ...SEED_MBI_USERS[1] } : { ...SEED_MAI_USERS[1] });
   if (scanner) {
    scanner.id = `${warehouse.toLowerCase()}-scanner`;
    scanner.nik = `ABSEN-${warehouse}`;
    scanner.dept = 'presensi';
    scanner.name = 'Scanner Presensi Gudang';
    scanner.warehouse = warehouse;
    scanner.accessibleWarehouses = [warehouse];
    scanner.role = 'scanner';
    scanner.hasAccount = true;
    scanner.barcodeValue = scanner.nik;
    scanner.permissions = {
     perm_wh_mbi: (warehouse === 'MBI'),
     perm_wh_mai: (warehouse === 'MAI'),
     perm_wh_switch: false
    };
    cleanList.push(scanner);
    seenNames.add(cleanStr(scanner.name));
    if (scanner.id) seenIds.add(scanner.id);
    seenNiks.add(scanner.nik.toUpperCase());
   }

   // 2.5 Tempatkan Akun Dedicated Manager (Bisa Buka 2 Gudang, Approver Final, Tanpa ID Card)
   let foundManager = users.find(u => u && (u.id === 'mgr-eko' || (u.nik && u.nik.toUpperCase() === 'MGR001') || (u.role === 'manager' && (u.id === 'mgr-eko' || u.nik === 'MGR001'))));
   let manager = foundManager ? { ...foundManager } : { ...SEED_MANAGER_USER, name: 'Manager', warehouse };
   manager.id = 'mgr-eko';
   manager.nik = 'MGR001';
   manager.name = (foundManager && foundManager.name && foundManager.name.trim() !== '') ? foundManager.name : 'Manager';
   manager.dept = 'Management';
   manager.role = 'manager';
   manager.hasAccount = true;
   manager.barcodeValue = manager.nik;
   if (foundManager && foundManager.phone) manager.phone = foundManager.phone;
   if (foundManager && foundManager.email) manager.email = foundManager.email;
   if (foundManager && foundManager.password) manager.password = foundManager.password;
   if (!manager.password) manager.password = 'medika123';
   if (!manager.permissions) {
    manager.permissions = getSavedUserPerms('MGR001', warehouse);
   }
   cleanList.push(manager);
   seenNames.add(cleanStr(manager.name));
   if (manager.id) seenIds.add(manager.id);
   seenNiks.add(manager.nik.toUpperCase());

   // 3. Filter calon karyawan reguler (bukan akun khusus sistem bawaan di atas, bukan tombstone terhapus)
   const deletedKeys = getDeletedUserKeys();
   let regularCandidates = users.filter(u => {
    if (!u || typeof u !== 'object') return false;
    if (isUserMarkedDeleted(u, deletedKeys)) return false;
    if (u.id === 'mbi-admin' || u.id === 'mai-admin' || u.nik === 'ADM001' || u.nik === 'ADM-MAI') return false;
    if (u.id === 'mbi-scanner' || u.id === 'mai-scanner' || (u.nik && u.nik.startsWith('ABSEN-'))) return false;
    if (u.id === 'mgr-eko' || u.nik === 'MGR001') return false;
    if (u.nik && (u.nik === 'SPV-MBI' || u.nik === 'SPV-MAI')) return false;
    if (u.id === 'mbi-spv' || u.id === 'mai-spv') return false;

    // ISOLASI KETAT GUDANG: Buang akun dari gudang lain agar data karyawan 100% rapi & tidak bercampur
    const uNik = (u.nik || '').toUpperCase().trim();
    const uWh = (u.warehouse || '').toUpperCase().trim();
    const uId = (u.id || '').toLowerCase().trim();

    if (warehouse === 'MBI') {
     if (uWh === 'MAI') return false;
     if (uNik.startsWith('MAI')) return false;
     if (uId.startsWith('mai-')) return false;
     if (cleanStr(u.name) === 'admingudangmai') return false;
    } else if (warehouse === 'MAI') {
     if (uWh === 'MBI') return false;
     if (uNik.startsWith('MBI')) return false;
     if (uId.startsWith('mbi-')) return false;
     if (cleanStr(u.name) === 'admingudangmbi') return false;
    }

    return true;
   });

   // Cek apakah ada kandidat yang memiliki nama manusia sah -> Jika ya, buang SEMUA akun ghost yang namanya berupa kode ID
   const hasValidHumanCandidates = regularCandidates.some(u => isLikelyHumanName(u.name) && !isLikelyIdNotName(u.name));
   if (hasValidHumanCandidates) {
    regularCandidates = regularCandidates.filter(u => isLikelyHumanName(u.name) && !isLikelyIdNotName(u.name));
   }

   // Urutan karyawan 100% DIPERTAHANKAN sesuai urutan asli baris Excel / input
   // TANPA pengurutan berdasarkan join date atau NIK agar sistem mengikuti Excel asli

   // Kumpulkan seluruh karyawan reguler tanpa duplikasi NIK atau ID
   const regularEmployees = [];
   regularCandidates.forEach(u => {
    // Lewati jika baris benar-benar kosong tanpa nama dan tanpa NIK
    if ((!u.name || u.name.trim() === '') && (!u.nik || u.nik.trim() === '')) {
     return;
    }

    const normName = cleanStr(u.name);
    const normNik = (u.nik && typeof u.nik === 'string') ? u.nik.trim().toUpperCase() : '';

    // Saring duplikasi nama manusia HANYA jika NIK sama persis atau tidak ada NIK
    if (normName && seenNames.has(normName) && (!normNik || seenNiks.has(normNik))) {
     const existing = regularEmployees.find(e => cleanStr(e.name) === normName);
     if (existing) {
      if ((!existing.phone || existing.phone === '-') && u.phone && u.phone !== '-') existing.phone = u.phone;
      if (!existing.email && u.email) existing.email = u.email;
      if ((!existing.joinDate || existing.joinDate === '-') && u.joinDate && u.joinDate !== '-') existing.joinDate = u.joinDate;
      if (u.permissions && typeof u.permissions === 'object') {
       existing.permissions = { ...(existing.permissions || {}), ...u.permissions };
      }
      if (u.status === 'inactive' || existing.status === 'inactive' || u.isActive === false || existing.isActive === false) {
       const uTime = u.updatedAt ? new Date(u.updatedAt).getTime() : 0;
       const exTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
       if (uTime > exTime) {
        existing.status = u.status || (u.isActive === false ? 'inactive' : 'active');
        existing.isActive = (existing.status !== 'inactive');
        existing.updatedAt = u.updatedAt;
       } else if (exTime > uTime) {
        // Keep existing status
       } else {
        existing.status = 'inactive';
        existing.isActive = false;
       }
      }
     }
     return; // DUPLIKAT IDENTIK -> MERGE & SKIP
    }

    // Saring duplikasi NIK / ID Karyawan HANYA JIKA nama sama atau salah satunya bukan nama manusia
    const isGalangMbi = warehouse === 'MBI' && (cleanStr(u.name) === 'galangerdiansyah' || (u.name && u.name.toUpperCase().includes('GALANG') && u.name.toUpperCase().includes('ERDIANSYAH')));
    if (isGalangMbi) {
     u.nik = 'MBI26-011';
     u.barcodeValue = 'MBI26-011';
    } else if (normNik && seenNiks.has(normNik)) {
     const existing = regularEmployees.find(e => (e.nik && e.nik.toUpperCase() === normNik) || (e.id && e.id === u.id));
     if (existing && (cleanStr(existing.name) === normName || !isLikelyHumanName(u.name))) {
      if ((!existing.phone || existing.phone === '-') && u.phone && u.phone !== '-') existing.phone = u.phone;
      if (!existing.email && u.email) existing.email = u.email;
      if ((!existing.joinDate || existing.joinDate === '-') && u.joinDate && u.joinDate !== '-') existing.joinDate = u.joinDate;
      if (u.permissions && typeof u.permissions === 'object') {
       existing.permissions = { ...(existing.permissions || {}), ...u.permissions };
      }
      if (u.status === 'inactive' || existing.status === 'inactive' || u.isActive === false || existing.isActive === false) {
       const uTime = u.updatedAt ? new Date(u.updatedAt).getTime() : 0;
       const exTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
       if (uTime > exTime) {
        existing.status = u.status || (u.isActive === false ? 'inactive' : 'active');
        existing.isActive = (existing.status !== 'inactive');
        existing.updatedAt = u.updatedAt;
       } else if (exTime > uTime) {
        // Keep existing status
       } else {
        existing.status = 'inactive';
        existing.isActive = false;
       }
      }
      return; // DUPLIKAT NIK & NAMA SAMA -> MERGE & SKIP
     }
     // JIKA NIK SAMA TAPI VARIASI NAMA, PERBARUI DATA RECORD DAN JANGAN DIKOSONGKAN NIK-NYA
     if (existing) {
      if ((!existing.phone || existing.phone === '-') && u.phone && u.phone !== '-') existing.phone = u.phone;
      if (!existing.email && u.email) existing.email = u.email;
      if ((!existing.joinDate || existing.joinDate === '-') && u.joinDate && u.joinDate !== '-') existing.joinDate = u.joinDate;
      return;
     }
    }

    // Saring duplikasi ID System
    if (u.id && seenIds.has(u.id)) {
     return;
    }

    if (normName) seenNames.add(normName);
    if (normNik) seenNiks.add(normNik);
    if (u.id) seenIds.add(u.id);

    // Pastikan hak akses tersimpan tetap terikat pada karyawan
    if (!u.permissions) {
     const sp = getSavedUserPerms(u.nik || u.id, warehouse);
     if (sp && typeof sp === 'object') u.permissions = sp;
    }

    // Penyesuaian peran dan departemen karyawan
    const uRole = (u.role || 'staff').toLowerCase().trim();
    const uDept = (u.dept || '').toLowerCase().trim();

    const isAdmin = uRole === 'admin' || uDept.includes('admin') || uDept.includes('administrator');
    const isSpv = uRole.includes('supervisor') || uRole === 'spv' || uDept.includes('supervisor') || uDept === 'spv';
    const isCoord = uRole.includes('coordinator') || uRole.includes('koordinator') || uRole.includes('cordinator') || uDept.includes('coordinator') || uDept.includes('koordinator') || uDept.includes('cordinator');

    if (isAdmin) {
     u.dept = 'Administrator';
     u.role = 'admin';
     u.hasAccount = true;
     if (!u.password) u.password = 'medika123';
    } else if (isSpv) {
     u.dept = 'Supervisor';
     u.role = 'supervisor';
     u.hasAccount = true;
     if (!u.password) u.password = 'medika123';
    } else if (isCoord) {
     u.dept = 'Coordinator';
     u.role = 'coordinator';
     u.hasAccount = true;
     if (!u.password) u.password = 'medika123';
    } else {
     u.dept = u.dept || 'Warehouse Staff';
     u.role = 'staff';
     const hasCustomPerms = (u.permissions && typeof u.permissions === 'object' && Object.values(u.permissions).some(v => v === true)) ||
                 (getSavedUserPerms(u.nik || u.id, warehouse) && Object.values(getSavedUserPerms(u.nik || u.id, warehouse)).some(v => v === true));
     if (hasCustomPerms) {
      u.hasAccount = true;
      if (!u.password) u.password = 'medika123';
     } else {
      u.hasAccount = false;
      u.password = '';
     }
    }

    if (u.joinDate && /^\d{4,5}(\.\d+)?$/.test(String(u.joinDate).trim())) {
     u.joinDate = typeof formatExcelDate === 'function' ? formatExcelDate(u.joinDate) : u.joinDate;
    }

    // Pastikan status aktif/nonaktif tervalidasi dengan benar
    u.status = (u.status === 'inactive' || u.isActive === false) ? 'inactive' : 'active';
    u.isActive = (u.status === 'active');

    regularEmployees.push(u);
   });

   // 4. Kunci & standarisasi NIK (TETAPKAN NIK ASLI MILIK KARYAWAN SECARA MUTLAK)
   const year = new Date().getFullYear().toString().slice(-2);
   const prefix = `${warehouse.toUpperCase()}${year}-`;
   const assignedNiks = new Set([admin.nik.toUpperCase()]);
   if (scanner && scanner.nik) assignedNiks.add(scanner.nik.toUpperCase());
   if (manager && manager.nik) assignedNiks.add(manager.nik.toUpperCase());

   // Hitung nomor urut NIK tertinggi yang pernah ada
   let maxNum = 0;
   regularEmployees.forEach(u => {
    if (!u || !u.nik || typeof u.nik !== 'string' || u.nik.trim() === '') return;
    const cleanU = u.nik.trim().toUpperCase();
    if (cleanU.startsWith(prefix)) {
     const numPart = parseInt(cleanU.replace(prefix, ''), 10);
     if (!isNaN(numPart) && numPart > maxNum) {
      maxNum = numPart;
     }
    } else if (/^\d+$/.test(cleanU)) {
     const numPart = parseInt(cleanU, 10);
     if (!isNaN(numPart) && numPart > maxNum) {
      maxNum = numPart;
     }
    }
   });

   // Tetapkan ID secara berurutan: NILAI NIK ASLI DIPERTAHANKAN 100% MUTLAK
   regularEmployees.forEach((u) => {
    const cClean = cleanStr(u.name);
    if (warehouse === 'MBI' && cClean === 'ogisaputra') {
     u.nik = 'MBI26-009';
     u.barcodeValue = 'MBI26-009';
     assignedNiks.add('MBI26-009');
     cleanList.push(u);
     return;
    }
    if (warehouse === 'MBI' && cClean === 'yonno') {
     u.nik = 'MBI26-010';
     u.barcodeValue = 'MBI26-010';
     assignedNiks.add('MBI26-010');
     cleanList.push(u);
     return;
    }
    const isGalang = warehouse === 'MBI' && (cClean === 'galangerdiansyah' || (u.name && u.name.toUpperCase().includes('GALANG') && u.name.toUpperCase().includes('ERDIANSYAH')));
    if (isGalang) {
     u.nik = 'MBI26-011';
     u.barcodeValue = 'MBI26-011';
     assignedNiks.add('MBI26-011');
     cleanList.push(u);
     return;
    }
    const isDhio = warehouse === 'MBI' && (cClean === 'dhiobaguscandraarguna' || cClean.includes('dhiobagus') || cClean.includes('dhio'));
    if (isDhio) {
     u.nik = 'MBI26-117';
     u.barcodeValue = 'MBI26-117';
     assignedNiks.add('MBI26-117');
     cleanList.push(u);
     return;
    }
    const isDinarya = warehouse === 'MBI' && (cClean === 'dinarya' || cClean.includes('dinarya'));
    if (isDinarya) {
     u.nik = 'MBI26-118';
     u.barcodeValue = 'MBI26-118';
     assignedNiks.add('MBI26-118');
     cleanList.push(u);
     return;
    }
    const isMelinda = warehouse === 'MBI' && (cClean === 'melindagitawismaya' || cClean.includes('melinda'));
    if (isMelinda) {
     u.nik = 'MBI26-122';
     u.barcodeValue = 'MBI26-122';
     assignedNiks.add('MBI26-122');
     cleanList.push(u);
     return;
    }

    if (warehouse === 'MAI') {
     if (cClean === 'akmal' || cClean.includes('akmal')) {
      u.nik = 'MAI26-034';
      u.barcodeValue = 'MAI26-034';
      assignedNiks.add('MAI26-034');
      cleanList.push(u);
      return;
     }
     if (cClean === 'achmadvikih' || cClean.includes('vikih')) {
      u.nik = 'MAI26-035';
      u.barcodeValue = 'MAI26-035';
      assignedNiks.add('MAI26-035');
      cleanList.push(u);
      return;
     }
     if (cClean === 'mohamadyuliandi' || cClean.includes('yuliandi')) {
      u.nik = 'MAI26-041';
      u.barcodeValue = 'MAI26-041';
      assignedNiks.add('MAI26-041');
      cleanList.push(u);
      return;
     }
     if (cClean === 'nirwanfadlipulungan' || cClean.includes('nirwan')) {
      u.nik = 'MAI26-042';
      u.barcodeValue = 'MAI26-042';
      assignedNiks.add('MAI26-042');
      cleanList.push(u);
      return;
     }
    }

    let rawNik = (u.nik && typeof u.nik === 'string') ? u.nik.trim().toUpperCase() : '';
    if (rawNik && /^\d+$/.test(rawNik)) {
     rawNik = `${prefix}${String(rawNik).padStart(3, '0')}`;
    }
    if (rawNik) {
     assignedNiks.add(rawNik);
     u.nik = rawNik;
     u.barcodeValue = rawNik;
    } else {
     // HANYA JIKA NIK KOSONG -> buat ID otomatis berurutan dari nomor paling akhir (+1)
     maxNum++;
     let newNik = `${prefix}${String(maxNum).padStart(3, '0')}`;
     while (assignedNiks.has(newNik)) {
      maxNum++;
      newNik = `${prefix}${String(maxNum).padStart(3, '0')}`;
     }
     assignedNiks.add(newNik);
     u.nik = newNik;
     u.barcodeValue = newNik;
    }
    cleanList.push(u);
   });

   const systemAccounts = cleanList.filter(u => isManagementSystemAccount(u));
   const sortedRegular = cleanList.filter(u => !isManagementSystemAccount(u));
   sortedRegular.sort((a, b) => {
    const nikA = (a?.nik || a?.id || '').toString().trim().toUpperCase();
    const nikB = (b?.nik || b?.id || '').toString().trim().toUpperCase();
    return nikA.localeCompare(nikB, undefined, { numeric: true, sensitivity: 'base' });
   });

   const finalAll = [...systemAccounts, ...sortedRegular];
   finalAll.forEach(u => {
    if (!u) return;
    delete u.oldPassword;
    u.previousPasswords = [];
   });
   return finalAll;
  }

  // Pemisahan otomatis & permanen data karyawan MBI dan MAI agar tidak saling bercampur
  function separateAndCleanWarehouseData() {
   try {
    const rawMbi = localStorage.getItem('wfm_mbi_users');
    const rawMai = localStorage.getItem('wfm_mai_users');
    let mbiList = rawMbi ? JSON.parse(rawMbi) : [...SEED_MBI_USERS];
    let maiList = rawMai ? JSON.parse(rawMai) : [...SEED_MAI_USERS];
    if (!Array.isArray(mbiList)) mbiList = [...SEED_MBI_USERS];
    if (!Array.isArray(maiList)) maiList = [...SEED_MAI_USERS];

    let hasMoved = false;

    // 1. Pindahkan karyawan MAI yang tersasar masuk ke MBI
    const foreignInMbi = mbiList.filter(u => {
     if (!u || isManagementSystemAccount(u)) return false;
     const uWh = (u.warehouse || '').toUpperCase().trim();
     const uNik = (u.nik || '').toUpperCase().trim();
     const uId = (u.id || '').toLowerCase().trim();
     return uWh === 'MAI' || uNik.startsWith('MAI') || uId.startsWith('mai-') || cleanStr(u.name) === 'admingudangmai';
    });

    if (foreignInMbi.length > 0) {
     foreignInMbi.forEach(fu => {
      const fuNik = (fu.nik || '').toUpperCase().trim();
      const fuName = cleanStr(fu.name);
      const existsInMai = maiList.some(mu => (fuNik && mu.nik && mu.nik.toUpperCase().trim() === fuNik) || (fuName && cleanStr(mu.name) === fuName));
      if (!existsInMai) {
       const toAdd = { ...fu, warehouse: 'MAI' };
       maiList.push(toAdd);
      }
     });
     mbiList = mbiList.filter(u => {
      if (!u || isManagementSystemAccount(u)) return true;
      const uWh = (u.warehouse || '').toUpperCase().trim();
      const uNik = (u.nik || '').toUpperCase().trim();
      const uId = (u.id || '').toLowerCase().trim();
      return !(uWh === 'MAI' || uNik.startsWith('MAI') || uId.startsWith('mai-') || cleanStr(u.name) === 'admingudangmai');
     });
     hasMoved = true;
    }

    // 2. Pindahkan karyawan MBI yang tersasar masuk ke MAI (jika ada)
    const foreignInMai = maiList.filter(u => {
     if (!u || isManagementSystemAccount(u)) return false;
     const uWh = (u.warehouse || '').toUpperCase().trim();
     const uNik = (u.nik || '').toUpperCase().trim();
     const uId = (u.id || '').toLowerCase().trim();
     return uWh === 'MBI' || uNik.startsWith('MBI') || uId.startsWith('mbi-') || cleanStr(u.name) === 'admingudangmbi';
    });

    if (foreignInMai.length > 0) {
     foreignInMai.forEach(fu => {
      const fuNik = (fu.nik || '').toUpperCase().trim();
      const fuName = cleanStr(fu.name);
      const existsInMbi = mbiList.some(mu => (fuNik && mu.nik && mu.nik.toUpperCase().trim() === fuNik) || (fuName && cleanStr(mu.name) === fuName));
      if (!existsInMbi) {
       const toAdd = { ...fu, warehouse: 'MBI' };
       mbiList.push(toAdd);
      }
     });
     maiList = maiList.filter(u => {
      if (!u || isManagementSystemAccount(u)) return true;
      const uWh = (u.warehouse || '').toUpperCase().trim();
      const uNik = (u.nik || '').toUpperCase().trim();
      const uId = (u.id || '').toLowerCase().trim();
      return !(uWh === 'MBI' || uNik.startsWith('MBI') || uId.startsWith('mbi-') || cleanStr(u.name) === 'admingudangmbi');
     });
     hasMoved = true;
    }

    const cleanMbi = deduplicateUserList(mbiList, 'MBI');
    const cleanMai = deduplicateUserList(maiList, 'MAI');

    if (hasMoved || cleanMbi.length !== mbiList.length || cleanMai.length !== maiList.length) {
     localStorage.setItem('wfm_mbi_users', JSON.stringify(cleanMbi));
     localStorage.setItem('wfm_mbi_users_backup', JSON.stringify(cleanMbi));
     localStorage.setItem('wfm_mai_users', JSON.stringify(cleanMai));
     localStorage.setItem('wfm_mai_users_backup', JSON.stringify(cleanMai));
     clearWhDBCache();
     console.log(`[WarehouseSeparation] Data berhasil dipisahkan! MBI: ${cleanMbi.length} akun, MAI: ${cleanMai.length} akun.`);
    }

    // 3. Pindahkan absensi MAI yang tersasar masuk ke database MBI (misal saat scan tanggal 1-4 Nov)
    try {
     const rawMbiAtt = localStorage.getItem('wfm_mbi_attendance');
     if (rawMbiAtt) {
      let mbiAttList = JSON.parse(rawMbiAtt);
      if (Array.isArray(mbiAttList) && mbiAttList.length > 0) {
       const maiAttForeign = mbiAttList.filter(a => {
        if (!a) return false;
        const uNik = (a.userNik || '').toUpperCase().trim();
        const uWh = (a.warehouse || '').toUpperCase().trim();
        const uId = (a.userId || '').toLowerCase().trim();
        return uWh === 'MAI' || uNik.startsWith('MAI') || uId.startsWith('mai-');
       });
       if (maiAttForeign.length > 0) {
        const rawMaiAtt = localStorage.getItem('wfm_mai_attendance');
        let maiAttList = rawMaiAtt ? JSON.parse(rawMaiAtt) : [];
        maiAttForeign.forEach(fa => {
         fa.warehouse = 'MAI';
         if (!fa.id) fa.id = `att-mai-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        });
        maiAttList = mergeAttendanceArrays(maiAttList, maiAttForeign);
        localStorage.setItem('wfm_mai_attendance', JSON.stringify(maiAttList));
        mbiAttList = mbiAttList.filter(a => {
         if (!a) return false;
         const uNik = (a.userNik || '').toUpperCase().trim();
         const uWh = (a.warehouse || '').toUpperCase().trim();
         const uId = (a.userId || '').toLowerCase().trim();
         return !(uWh === 'MAI' || uNik.startsWith('MAI') || uId.startsWith('mai-'));
        });
        localStorage.setItem('wfm_mbi_attendance', JSON.stringify(mbiAttList));
        whDBCache.set('wfm_mai_attendance', maiAttList);
        whDBCache.set('wfm_mbi_attendance', mbiAttList);
        console.log(`[AttendanceSeparation] Berhasil memindahkan ${maiAttForeign.length} rekor absen MAI yang tersimpan di MBI.`);
       }
      }
     }
    } catch (eAttSep) {}
   } catch (err) {
    console.warn('[WarehouseSeparation Error]:', err);
   }
  }

  // Pembersihan otomatis data karyawan duplikat dan data ghost (nama berupa ID)
  function autoPurgeDuplicateAndCorruptEmployees(showAlert = false, shouldRerender = true) {
   try {
    separateAndCleanWarehouseData();
    let totalCleaned = 0;
    ['MBI', 'MAI'].forEach(wh => {
     const storageKey = `wfm_${wh.toLowerCase()}_users`;
     const raw = localStorage.getItem(storageKey);
     if (!raw) return;
     let users = JSON.parse(raw);
     if (!Array.isArray(users) || users.length <= 2) return;

     const cleaned = deduplicateUserList(users, wh);
     if (cleaned.length !== users.length) {
      const diff = users.length - cleaned.length;
      totalCleaned += diff;
      console.log(`[AutoPurge] Berhasil membersihkan ${diff} data duplikat/ghost di Gudang ${wh}. Dari ${users.length} menjadi ${cleaned.length} akun.`);
      localStorage.setItem(storageKey, JSON.stringify(cleaned));
      localStorage.setItem(`wfm_${wh.toLowerCase()}_users_backup`, JSON.stringify(cleaned));
      localStorage.setItem('wfm_last_master_change_time', Date.now().toString());
      localStorage.setItem('wfm_master_updated_at', new Date().toISOString());
     }
    });

    if (totalCleaned > 0 && shouldRerender) {
     clearWhDBCache();
     if (typeof renderEmployeeTable === 'function') renderEmployeeTable();
     if (typeof refreshAllDashboardData === 'function') refreshAllDashboardData();
    }

    if (showAlert) {
     if (totalCleaned > 0) {
      alert(`Å“â€¦ Pembersihan Berhasil!\n\nSebanyak ${totalCleaned} akun duplikat / beda gudang berhasil dirapikan secara permanen.\nData Gudang MBI dan MAI kini 100% terpisah rapi.`);
     } else {
      alert('â€ž  Data Karyawan Bersih!\n\nData karyawan Gudang MBI dan MAI sudah 100% terpisah rapi.');
     }
    }
   } catch (e) {
    console.warn('AutoPurge error:', e);
   }
  }

  // Memastikan akun Manager (MGR001) dan akun Melinda adalah 2 akun terpisah dan independen
  function restoreSeparateMelindaAndManagerAccounts() {
   try {
    let hasChanges = false;
    ['MBI', 'MAI'].forEach(wh => {
     const storageKey = `wfm_${wh.toLowerCase()}_users`;
     const raw = localStorage.getItem(storageKey);
     if (!raw) return;
     let users = JSON.parse(raw);
     if (!Array.isArray(users)) return;

     let hasMelindaAsManager = false;
     let hasRegularMelinda = false;

     users.forEach(u => {
      if (!u || !u.name) return;
      const cName = cleanStr(u.name);
      if (cName.includes('melinda')) {
       if (u.id === 'mgr-eko' || u.nik === 'MGR001' || u.role === 'manager') {
        hasMelindaAsManager = true;
       } else {
        hasRegularMelinda = true;
       }
      }
     });

     if (hasMelindaAsManager && !hasRegularMelinda) {
      const mgrItem = users.find(u => u && cleanStr(u.name).includes('melinda'));
      const melindaUser = {
       id: `${wh.toLowerCase()}-melinda-${Date.now()}`,
       name: mgrItem ? mgrItem.name : 'Melinda Gita Wismaya',
       dept: 'Coordinator',
       outsource: (mgrItem && mgrItem.outsource) ? mgrItem.outsource : 'Internal',
       phone: (mgrItem && mgrItem.phone && mgrItem.phone !== '081200000001') ? mgrItem.phone : '-',
       email: (mgrItem && mgrItem.email && !mgrItem.email.includes('eko') && !mgrItem.email.includes('manager')) ? mgrItem.email : '',
       joinDate: (mgrItem && mgrItem.joinDate) ? mgrItem.joinDate : '-',
       nik: wh === 'MBI' ? 'MBI26-122' : '',
       barcodeValue: wh === 'MBI' ? 'MBI26-122' : '',
       role: 'coordinator',
       hasAccount: true,
       password: 'medika123',
       isFirstLogin: false,
       warehouse: wh
      };

      users = users.map(u => {
       if (u && (u.id === 'mgr-eko' || u.nik === 'MGR001' || cleanStr(u.name).includes('melinda'))) {
        return {
         id: 'mgr-eko',
         name: 'Manager',
         dept: 'Management',
         outsource: 'Internal',
         phone: '081200000001',
         email: 'manager@medika.com',
         joinDate: '2023-01-01',
         nik: 'MGR001',
         role: 'manager',
         password: 'medika123',
         isFirstLogin: false,
         hasAccount: true,
         permissions: u.permissions || getSavedUserPerms('MGR001', wh) || undefined,
         warehouse: wh
        };
       }
       return u;
      });

      users.push(melindaUser);

      const cleaned = deduplicateUserList(users, wh);
      localStorage.setItem(storageKey, JSON.stringify(cleaned));
      localStorage.setItem(`wfm_${wh.toLowerCase()}_users_backup`, JSON.stringify(cleaned));
      hasChanges = true;
     }
    });

    if (hasChanges) {
     try {
      const activeSession = JSON.parse(localStorage.getItem('wfm_active_session') || '{}');
      if (activeSession && activeSession.id === 'mgr-eko' && cleanStr(activeSession.name) === 'melinda') {
       activeSession.name = 'Manager';
       localStorage.setItem('wfm_active_session', JSON.stringify(activeSession));
      }
     } catch(e) {}
     localStorage.setItem('wfm_last_master_change_time', Date.now().toString());
     localStorage.setItem('wfm_master_updated_at', new Date().toISOString());
     if (typeof renderEmployeeTable === 'function') renderEmployeeTable();
     if (typeof refreshAllDashboardData === 'function') refreshAllDashboardData();
    }
   } catch (e) {
    console.warn('restoreSeparateMelindaAndManagerAccounts error:', e);
   }
  }

  // =========================================================================
  // =========================================================================
  // SISTEM PATEN NIK & NAMA KARYAWAN 100% MUTLAK (IMMUTABLE 1-TO-1 MAPPING)
  // Menjamin SELURUH KARYAWAN di kedua gudang (MBI & MAI) memiliki NIK & Nama
  // yang terpaut 1-to-1, tidak bisa tertukar, bertabrakan, atau terbalik selamanya.
  // =========================================================================
  function realignAllAttendanceRecordsWithMaster(warehouse = null) {
   const warehouses = warehouse ? [warehouse] : ['MBI', 'MAI'];
   let totalRealigned = 0;

   warehouses.forEach(wh => {
    const userKey = `wfm_${wh.toLowerCase()}_users`;
    const attKey = `wfm_${wh.toLowerCase()}_attendance`;
    const otKey = `wfm_${wh.toLowerCase()}_overtime`;
    const lvKey = `wfm_${wh.toLowerCase()}_leaves`;

    const rawUsers = localStorage.getItem(userKey);
    if (!rawUsers) return;
    let users = JSON.parse(rawUsers);
    if (!Array.isArray(users) || users.length === 0) return;

    // Buat lookup map cepat dan terpercaya dari master data karyawan
    const nikToUserMap = new Map();
    const nameToUserMap = new Map();
    const idToUserMap = new Map();

    users.forEach(u => {
     if (!u) return;
     if (u.nik) nikToUserMap.set(String(u.nik).trim().toUpperCase(), u);
     if (u.name && !isLikelyIdNotName(u.name)) nameToUserMap.set(cleanStr(u.name), u);
     if (u.id) idToUserMap.set(String(u.id).trim(), u);
    });

    // 1. Harmonisasi & Perbaikan Otomatis Riwayat Presensi (Attendance)
    const rawAtt = localStorage.getItem(attKey);
    if (rawAtt) {
     try {
      let atts = JSON.parse(rawAtt);
      if (Array.isArray(atts)) {
       let attChanged = false;
       atts.forEach(a => {
        if (!a) return;

        // KUNCI PATEN RECORD KHUSUS 13 & 14 OKTOBER AGAR TIDAK GANDA / TERTUKAR ANTARA DHIO & DINARYA:
        if (a.id === 'att-mbi-1791851756150') {
         a.userId = 'mbi-1790828522744-115-i7t3';
         a.userNik = 'MBI26-117';
         a.userName = 'DHIO BAGUS CANDRA ARGUNA';
         a.dept = 'Warehouse Staff';
         a.outsource = 'Staffinc';
         a.warehouse = 'MBI';
         a.date = '2026-10-13';
         a.checkInTime = '2026-10-13T00:35:56.140Z';
         a.checkOutTime = null;
         a.notes = 'Miss Scan';
         attChanged = true;
         return;
        }
        if (a.id === 'att-mbi-1791938295676') {
         a.userId = 'mbi-1790828522744-115-i7t3';
         a.userNik = 'MBI26-117';
         a.userName = 'DHIO BAGUS CANDRA ARGUNA';
         a.dept = 'Warehouse Staff';
         a.outsource = 'Staffinc';
         a.warehouse = 'MBI';
         a.date = '2026-10-14';
         a.checkInTime = '2026-10-14T00:38:15.661Z';
         a.checkOutTime = '2026-10-14T08:11:50.708Z';
         a.notes = '';
         attChanged = true;
         return;
        }
        if (a.id === 'att-mbi-1791902256042') {
         a.userId = 'mbi-1790828522744-116-dxyq';
         a.userNik = 'MBI26-118';
         a.userName = 'DINARYA';
         a.dept = 'Warehouse Staff';
         a.outsource = 'Staffinc';
         a.warehouse = 'MBI';
         a.date = '2026-10-13';
         a.checkInTime = '2026-10-13T14:37:36.035Z';
         a.checkOutTime = '2026-10-13T23:03:52.885Z';
         a.notes = '';
         attChanged = true;
         return;
        }
        if (a.id === 'att-mbi-1791988509635') {
         a.userId = 'mbi-1790828522744-116-dxyq';
         a.userNik = 'MBI26-118';
         a.userName = 'DINARYA';
         a.dept = 'Warehouse Staff';
         a.outsource = 'Staffinc';
         a.warehouse = 'MBI';
         a.date = '2026-10-14';
         a.checkInTime = '2026-10-14T14:35:09.629Z';
         a.checkOutTime = '2026-10-14T23:07:13.016Z';
         a.notes = '';
         attChanged = true;
         return;
        }
        if (a.id === 'att-mbi-1791619172172') {
         a.userId = 'mbi-1790828522744-115-i7t3';
         a.userNik = 'MBI26-117';
         a.userName = 'DHIO BAGUS CANDRA ARGUNA';
         a.dept = 'Warehouse Staff';
         a.outsource = 'Staffinc';
         a.warehouse = 'MBI';
         a.date = '2026-10-10';
         a.checkInTime = '2026-10-10T07:59:32.156Z';
         a.checkOutTime = '2026-10-10T15:11:43.903Z';
         a.notes = '';
         attChanged = true;
         return;
        }
        if (a.id === 'att-mbi-1791643945285') {
         a.userId = 'mbi-1790828522744-116-dxyq';
         a.userNik = 'MBI26-118';
         a.userName = 'DINARYA';
         a.dept = 'Warehouse Staff';
         a.outsource = 'Staffinc';
         a.warehouse = 'MBI';
         a.date = '2026-10-10';
         a.checkInTime = '2026-10-10T14:52:25.279Z';
         a.checkOutTime = '2026-10-11T00:21:24.583Z';
         a.notes = '';
         attChanged = true;
         return;
        }
        if (a.checkInTime && (a.checkInTime.includes('T00:35:56') || a.checkInTime.includes('T00:38:15'))) {
         a.userId = 'mbi-1790828522744-115-i7t3';
         a.userNik = 'MBI26-117';
         a.userName = 'DHIO BAGUS CANDRA ARGUNA';
         a.dept = 'Warehouse Staff';
         a.outsource = 'Staffinc';
         a.warehouse = 'MBI';
         if (a.checkInTime.includes('2026-10-13')) {
          a.date = '2026-10-13';
          a.checkOutTime = null;
          a.notes = 'Miss Scan';
         } else {
          a.date = '2026-10-14';
          a.checkOutTime = '2026-10-14T08:11:50.708Z';
         }
         attChanged = true;
         return;
        }

        const aNik = (a.userNik || '').toString().trim().toUpperCase();
        const aName = (a.userName || '').toString().trim();
        const aId = (a.userId || '').toString().trim();

        let matchedMaster = null;
        // Prioritas 1: ID Sistem karyawan (permanen, tidak pernah berubah)
        if (aId && idToUserMap.has(aId)) {
         matchedMaster = idToUserMap.get(aId);
        }
        // Prioritas 2: NIK (Barcode ID Card)
        else if (aNik && nikToUserMap.has(aNik)) {
         matchedMaster = nikToUserMap.get(aNik);
        }
        // Prioritas 3: Fallback nama hanya jika ID dan NIK tidak dikenal
        else if (aName && !isLikelyIdNotName(aName) && nameToUserMap.has(cleanStr(aName))) {
         matchedMaster = nameToUserMap.get(cleanStr(aName));
        }

        if (matchedMaster) {
         // Jika matched dari NIK, NIK asli SELALU dipertahankan mutlak dan tidak boleh bergeser
         const targetNik = matchedMaster.nik || a.userNik;
         // Proteksi akun sistem non-absen bawaan (Hanya Admin dan Scanner yang tidak tap presensi)
         const nonAttendingNiks = new Set(['ADM001', 'ADM-MAI', 'ABSEN-MBI', 'ABSEN-MAI']);
         if (nonAttendingNiks.has(targetNik)) {
          trackDeletedAttendance(a);
          a.__isDeletedGhost = true;
          attChanged = true;
          return;
         }

         const targetName = matchedMaster.name;
         const targetDept = matchedMaster.dept || a.dept || 'Warehouse Staff';
         const targetOs = matchedMaster.outsource || a.outsource || 'Internal';
         const targetId = matchedMaster.id || a.userId;

         if (a.userName !== targetName || a.userNik !== targetNik || a.userId !== targetId || a.dept !== targetDept || a.outsource !== targetOs) {
          a.userName = targetName;
          a.userNik = targetNik;
          a.userId = targetId;
          a.dept = targetDept;
          a.outsource = targetOs;
          attChanged = true;
          totalRealigned++;
         }
        }
       });

       atts = atts.filter(a => a && !a.__isDeletedGhost);

       // Pembersihan Otomatis Duplikat Absen Pada Tanggal yang Sama (Sinkronkan Record & Matriks 100%):
       const seenEmpDates = new Map();
       const uniqueAtts = [];
       atts.forEach(item => {
        if (!item || isAttendanceMarkedDeleted(item)) return;
        const empKey = (item.userNik || item.userName || item.userId || '').toUpperCase().trim();
        const dKey = item.date;
        if (!empKey || !dKey) {
         uniqueAtts.push(item);
         return;
        }
        const composite = `${empKey}__${dKey}`;
        if (!seenEmpDates.has(composite)) {
         seenEmpDates.set(composite, item);
         uniqueAtts.push(item);
        } else {
         const existing = seenEmpDates.get(composite);
         if (item.checkInTime && (!existing.checkInTime || item.checkInTime < existing.checkInTime)) {
          existing.checkInTime = item.checkInTime;
         }
         if (item.checkOutTime && (!existing.checkOutTime || item.checkOutTime > existing.checkOutTime)) {
          existing.checkOutTime = item.checkOutTime;
         }
         trackDeletedAttendance(item);
         attChanged = true;
         totalRealigned++;
        }
       });
       atts = uniqueAtts;

       if (attChanged) {
        localStorage.setItem(attKey, JSON.stringify(atts));
       }
      }
     } catch(e) {}
    }

    // 2. Harmonisasi & Perbaikan Otomatis Riwayat Lembur (Overtime)
    const rawOt = localStorage.getItem(otKey);
    if (rawOt) {
     try {
      let ots = JSON.parse(rawOt);
      if (Array.isArray(ots)) {
       let otChanged = false;
       ots.forEach(o => {
        if (!o) return;
        const oNik = (o.userNik || '').toString().trim().toUpperCase();
        const oName = (o.userName || '').toString().trim();
        const oId = (o.userId || '').toString().trim();

        let matchedMaster = null;
        if (oNik && nikToUserMap.has(oNik)) matchedMaster = nikToUserMap.get(oNik);
        else if (oName && !isLikelyIdNotName(oName) && nameToUserMap.has(cleanStr(oName))) matchedMaster = nameToUserMap.get(cleanStr(oName));
        else if (oId && idToUserMap.has(oId)) matchedMaster = idToUserMap.get(oId);

        if (matchedMaster) {
         if (o.userName !== matchedMaster.name || o.userNik !== matchedMaster.nik || o.userId !== matchedMaster.id) {
          o.userName = matchedMaster.name;
          o.userNik = matchedMaster.nik;
          o.userId = matchedMaster.id;
          otChanged = true;
         }
        }
       });
       if (otChanged) {
        localStorage.setItem(otKey, JSON.stringify(ots));
       }
      }
     } catch(e) {}
    }

    // 3. Harmonisasi & Perbaikan Otomatis Riwayat Cuti / Sakit (Leaves)
    const rawLv = localStorage.getItem(lvKey);
    if (rawLv) {
     try {
      let lvs = JSON.parse(rawLv);
      if (Array.isArray(lvs)) {
       let lvChanged = false;
       lvs.forEach(l => {
        if (!l) return;
        const lNik = (l.userNik || '').toString().trim().toUpperCase();
        const lName = (l.userName || '').toString().trim();
        const lId = (l.userId || '').toString().trim();

        let matchedMaster = null;
        if (lNik && nikToUserMap.has(lNik)) matchedMaster = nikToUserMap.get(lNik);
        else if (lName && !isLikelyIdNotName(lName) && nameToUserMap.has(cleanStr(lName))) matchedMaster = nameToUserMap.get(cleanStr(lName));
        else if (lId && idToUserMap.has(lId)) matchedMaster = idToUserMap.get(lId);

        if (matchedMaster) {
         if (l.userName !== matchedMaster.name || l.userNik !== matchedMaster.nik || l.userId !== matchedMaster.id) {
          l.userName = matchedMaster.name;
          l.userNik = matchedMaster.nik;
          l.userId = matchedMaster.id;
          lvChanged = true;
         }
        }
       });
       if (lvChanged) {
        localStorage.setItem(lvKey, JSON.stringify(lvs));
       }
      }
     } catch(e) {}
    }
   });

   return totalRealigned;
  }

  function lockAndHarmonizeAllEmployeeNIKs() {
   try {
    let hasAnyChanges = false;
    ['MBI', 'MAI'].forEach(wh => {
     const userKey = `wfm_${wh.toLowerCase()}_users`;
     const backupKey = `wfm_${wh.toLowerCase()}_users_backup`;

     const rawUsers = localStorage.getItem(userKey);
     if (!rawUsers) return;
     let users = JSON.parse(rawUsers);
     if (!Array.isArray(users) || users.length === 0) return;

     const year = new Date().getFullYear().toString().slice(-2);
     const prefix = `${wh.toUpperCase()}${year}-`;

     // Standardisasi format jika ada NIK angka murni (e.g. 1 -> MBI26-001)
     let whChanged = false;
     users.forEach(u => {
      if (!u || isManagementSystemAccount(u)) return;
      const cName = cleanStr(u.name);
      // Kunci Urutan Baku Excel MBI: No. 9 Ogi, No. 10 Yonno, No. 11 Galang
      if (wh === 'MBI' && cName === 'ogisaputra') {
       if (u.nik !== 'MBI26-009' || u.barcodeValue !== 'MBI26-009') {
        u.nik = 'MBI26-009';
        u.barcodeValue = 'MBI26-009';
        whChanged = true;
       }
       return;
      }
      if (wh === 'MBI' && cName === 'yonno') {
       if (u.nik !== 'MBI26-010' || u.barcodeValue !== 'MBI26-010') {
        u.nik = 'MBI26-010';
        u.barcodeValue = 'MBI26-010';
        whChanged = true;
       }
       return;
      }
      if (wh === 'MBI' && (cName === 'galangerdiansyah' || (u.name && u.name.toUpperCase().includes('GALANG') && u.name.toUpperCase().includes('ERDIANSYAH')))) {
       if (u.nik !== 'MBI26-011' || u.barcodeValue !== 'MBI26-011') {
        u.nik = 'MBI26-011';
        u.barcodeValue = 'MBI26-011';
        whChanged = true;
       }
       return;
      }
      if (wh === 'MBI' && (cName === 'melindagitawismaya' || cName.includes('melinda'))) {
       if (u.nik !== 'MBI26-122' || u.barcodeValue !== 'MBI26-122') {
        u.nik = 'MBI26-122';
        u.barcodeValue = 'MBI26-122';
        whChanged = true;
       }
       return;
      }
      if (wh === 'MBI' && (cName === 'dhiobaguscandraarguna' || cName.includes('dhiobagus') || cName.includes('dhio'))) {
       if (u.nik !== 'MBI26-117' || u.barcodeValue !== 'MBI26-117') {
        u.nik = 'MBI26-117';
        u.barcodeValue = 'MBI26-117';
        whChanged = true;
       }
       return;
      }
      if (wh === 'MBI' && (cName === 'dinarya' || cName.includes('dinarya'))) {
       if (u.nik !== 'MBI26-118' || u.barcodeValue !== 'MBI26-118') {
        u.nik = 'MBI26-118';
        u.barcodeValue = 'MBI26-118';
        whChanged = true;
       }
       return;
      }

      // Kunci Urutan Baku Excel MAI: No. 34 Akmal, No. 35 Achmad vikih, No. 41 Mohamad Yuliandi, No. 42 Nirwan Fadli Pulungan
      if (wh === 'MAI') {
       if (cName === 'akmal' || cName.includes('akmal')) {
        if (u.nik !== 'MAI26-034' || u.barcodeValue !== 'MAI26-034') {
         u.nik = 'MAI26-034';
         u.barcodeValue = 'MAI26-034';
         whChanged = true;
        }
        return;
       }
       if (cName === 'achmadvikih' || cName.includes('vikih')) {
        if (u.nik !== 'MAI26-035' || u.barcodeValue !== 'MAI26-035') {
         u.nik = 'MAI26-035';
         u.barcodeValue = 'MAI26-035';
         whChanged = true;
        }
        return;
       }
       if (cName === 'mohamadyuliandi' || cName.includes('yuliandi')) {
        if (u.nik !== 'MAI26-041' || u.barcodeValue !== 'MAI26-041') {
         u.nik = 'MAI26-041';
         u.barcodeValue = 'MAI26-041';
         whChanged = true;
        }
        return;
       }
       if (cName === 'nirwanfadlipulungan' || cName.includes('nirwan')) {
        if (u.nik !== 'MAI26-042' || u.barcodeValue !== 'MAI26-042') {
         u.nik = 'MAI26-042';
         u.barcodeValue = 'MAI26-042';
         whChanged = true;
        }
        return;
       }
      }

      if (!u.nik) return;
      const cNik = String(u.nik).trim().toUpperCase();
      if (/^\d+$/.test(cNik)) {
       u.nik = `${prefix}${String(cNik).padStart(3, '0')}`;
       u.barcodeValue = u.nik;
       whChanged = true;
      }
     });

     // PENGURUTAN TETAP & STABIL MENURUT NIK ASCENDING PADA PENYIMPANAN MASTER:
     const sysUsers = users.filter(u => isManagementSystemAccount(u));
     const regUsers = users.filter(u => !isManagementSystemAccount(u));
     regUsers.sort((a, b) => {
      const nikA = (a?.nik || a?.id || '').toString().trim().toUpperCase();
      const nikB = (b?.nik || b?.id || '').toString().trim().toUpperCase();
      return nikA.localeCompare(nikB, undefined, { numeric: true, sensitivity: 'base' });
     });
     users = [...sysUsers, ...regUsers];

     if (whChanged) {
      hasAnyChanges = true;
      localStorage.setItem(userKey, JSON.stringify(users));
      localStorage.setItem(backupKey, JSON.stringify(users));
     }
    });

    // Jalankan kaskade penyelarasan riwayat absensi, lembur & cuti
    const realignedCount = realignAllAttendanceRecordsWithMaster();
    if (realignedCount > 0) hasAnyChanges = true;

    if (hasAnyChanges) {
     localStorage.setItem('wfm_last_master_change_time', Date.now().toString());
     localStorage.setItem('wfm_master_updated_at', new Date().toISOString());
    }
   } catch(e) {
    console.warn('lockAndHarmonizeAllEmployeeNIKs error:', e);
   }
  }

  // Alias compatibility
  function repairDinaryaAndFirmanNIKCollision() {
   lockAndHarmonizeAllEmployeeNIKs();
  }

  function harmonizeAndResequenceAllNIKs() {
   lockAndHarmonizeAllEmployeeNIKs();
  }

  function sanitizeAttendanceDatabase(warehouse) {
   const storageKey = `wfm_${warehouse.toLowerCase()}_attendance`;
   const usersKey = `wfm_${warehouse.toLowerCase()}_users`;
   try {
    const data = localStorage.getItem(storageKey);
    if (!data) return [];
    let attendances = JSON.parse(data);
    if (!Array.isArray(attendances)) return [];

    const deletedAttKeys = getDeletedAttendanceIds();
    const origLen = attendances.length;
    attendances = attendances.filter(a => a && !isAttendanceMarkedDeleted(a, deletedAttKeys));
    let hasChanges = (attendances.length !== origLen);
    const rawUsers = localStorage.getItem(usersKey);
    const users = rawUsers ? JSON.parse(rawUsers) : (warehouse === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);

    const todayLocalDate = getLocalDateString(new Date());

    // 1. Normalisasi user & tanggal lokal
    attendances.forEach(a => {
     if (!a) return;
     if (a.checkInTime) {
      const correctDate = getLocalDateString(new Date(a.checkInTime));
      if (correctDate && a.date !== correctDate) {
       a.date = correctDate;
       hasChanges = true;
      }
     }

     // Standarisasi Miss Scan: Jangan inject jam pulang buatan pada sesi yang tidak tap pulang
     if (a.notes && (a.notes.includes('Selesai Otomatis') || a.notes.includes('Auto-Close Miss Scan'))) {
      a.checkOutTime = null;
      a.notes = 'Miss Scan';
      hasChanges = true;
     }

     // Auto-heal: Jika sudah punya jam pulang yang sah, bersihkan flag Miss Scan usang di catatan/status
     if (hasValidCheckOut(a)) {
      if (cleanStaleMissScanFlags(a)) {
       hasChanges = true;
      }
     }

     // Jika sesi belum lewat 18 jam (masih aktif, seperti shift malam lintas hari/lembur), bersihkan flag Miss Scan palsu
     if (!hasValidCheckOut(a) && a.checkInTime) {
      const inMs = parseSafeTimeMs(a.checkInTime, a.date) || new Date(a.checkInTime).getTime();
      const elapsedMs = (!isNaN(inMs) && inMs > 0) ? (Date.now() - inMs) : 0;
      if (elapsedMs >= 0 && elapsedMs < MAX_SHIFT_MS) {
       if (a.notes && a.notes.includes('Miss Scan')) {
        a.notes = a.notes.replace(/Miss Scan/gi, '').replace(/\(\s*\)/g, '').replace(/\|\s*\|/g, '|').trim();
        if (a.notes === '|' || a.notes === '-') a.notes = '';
        hasChanges = true;
       }
       if (a.checkInStatus === 'miss_scan') {
        a.checkInStatus = 'on_time';
        hasChanges = true;
       }
      }
     }

     // Cari user master: ID sistem (permanen) -> NIK -> nama (fallback). Riwayat TIDAK PERNAH dihapus karena status karyawan.
      let matchedUser = null;
      if (a.userId) {
       matchedUser = users.find(u => u.id === a.userId);
      }
      if (!matchedUser && a.userNik) {
       matchedUser = users.find(u => u.nik && u.nik.toUpperCase() === a.userNik.toUpperCase());
      }
      if (!matchedUser && a.userName && !isLikelyIdNotName(a.userName)) {
       matchedUser = users.find(u => cleanStr(u.name) === cleanStr(a.userName));
      }

      if (matchedUser) {
       const userOS = matchedUser.outsource || 'Internal';
      if (a.userName !== matchedUser.name || a.userNik !== matchedUser.nik || a.userId !== matchedUser.id || a.dept !== matchedUser.dept || a.outsource !== userOS) {
       a.userName = matchedUser.name;
       a.userNik = matchedUser.nik;
       a.userId = matchedUser.id;
       a.dept = matchedUser.dept;
       a.outsource = userOS;
       hasChanges = true;
      }
     }
    });

    attendances = attendances.filter(a => a && !a.__isDeletedGhost);

    // 2. DEDUP: Gabungkan absensi ganda pada karyawan yang sama di hari yang sama
    const groupedByDayUser = new Map();
    attendances.forEach(a => {
     if (!a) return;
     const userKey = (a.userNik || a.userId || a.userName || '').toUpperCase().trim();
     const dayKey = `${userKey}__${a.date || ''}`;
     if (!groupedByDayUser.has(dayKey)) {
      groupedByDayUser.set(dayKey, [a]);
     } else {
      groupedByDayUser.get(dayKey).push(a);
     }
    });

    const dedupedList = [];
    groupedByDayUser.forEach((group, key) => {
     if (group.length === 1) {
      dedupedList.push(group[0]);
     } else {
      // Urutkan berdasarkan waktu check-in paling awal
      group.sort((x, y) => {
       const tx = x.checkInTime ? new Date(x.checkInTime).getTime() : 0;
       const ty = y.checkInTime ? new Date(y.checkInTime).getTime() : 0;
       return tx - ty;
      });
      // Ambil data check-in pertama sebagai dasar
      const primary = { ...group[0] };
      // Cari checkOutTime paling valid (terakhir) di antara rekaman
       const outRecords = group.filter(x => x.checkOutTime && x.checkOutTime !== '-' && x.checkOutTime !== '');
       if (outRecords.length > 0) {
        outRecords.sort((x, y) => new Date(y.checkOutTime).getTime() - new Date(x.checkOutTime).getTime());
        primary.checkOutTime = outRecords[0].checkOutTime;
        if (primary.notes && primary.notes.includes('Miss Scan')) {
         primary.notes = primary.notes.replace(/Miss Scan/gi, '').replace(/\(\s*\)/g, '').replace(/\|\s*\|/g, '|').trim();
         if (primary.notes === '|' || primary.notes === '-') primary.notes = '';
        }
       } else if (group.length >= 2) {
        const lastRec = group[group.length - 1];
        const tFirst = new Date(primary.checkInTime).getTime();
        const tLast = new Date(lastRec.checkInTime).getTime();
        const diffMs = tLast - tFirst;
        if (diffMs >= 3.5 * 3600 * 1000 && diffMs <= 14 * 3600 * 1000) {
         primary.checkOutTime = lastRec.checkInTime;
         if (primary.notes && primary.notes.includes('Miss Scan')) {
          primary.notes = primary.notes.replace(/Miss Scan/gi, '').replace(/\(\s*\)/g, '').replace(/\|\s*\|/g, '|').trim();
          if (primary.notes === '|' || primary.notes === '-') primary.notes = '';
         }
         if (primary.checkInStatus === 'miss_scan') {
          primary.checkInStatus = 'on_time';
         }
        }
       }
      const mergedNotes = group.map(x => (x.notes || '').trim()).filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i).join(' | ');
      if (mergedNotes) primary.notes = mergedNotes;
      dedupedList.push(primary);
      hasChanges = true;
     }
    });

    // 3. AUTO-HEAL PRESENSI SHIFT LINTAS HARI GANDA:
    // Jika karyawan masuk malam (misal 21:35 tgl D, out null) dan tap masuk lagi pagi (misal 06:01 tgl D+1, out null)
    // di mana selisih jam masuknya antara 4 s.d 14 jam (terjadi karena salah pilih tombol Masuk padahal mau Pulang):
    // Satukan menjadi 1 record shift lengkap (in tgl D, out jam tap pagi)!
    const userChronological = new Map();
    dedupedList.forEach(a => {
     if (!a) return;
     const userKey = (a.userNik || a.userId || a.userName || '').toUpperCase().trim();
     if (!userChronological.has(userKey)) userChronological.set(userKey, []);
     userChronological.get(userKey).push(a);
    });

    const healedAtts = [];
    const discardedIds = new Set();

    userChronological.forEach(list => {
     list.sort((x, y) => {
      const tx = x.checkInTime ? new Date(x.checkInTime).getTime() : 0;
      const ty = y.checkInTime ? new Date(y.checkInTime).getTime() : 0;
      return tx - ty;
     });

     for (let i = 0; i < list.length; i++) {
      const cur = list[i];
      if (discardedIds.has(cur.id)) continue;

      const next = list[i + 1];
      if (next && cur.checkInTime && !cur.checkOutTime && next.checkInTime && !next.checkOutTime) {
       const tCur = new Date(cur.checkInTime).getTime();
       const tNext = new Date(next.checkInTime).getTime();
       const diffMs = tNext - tCur;
       if (diffMs >= 4 * 3600 * 1000 && diffMs <= 14 * 3600 * 1000) {
        cur.checkOutTime = next.checkInTime;
        discardedIds.add(next.id);
        const delSet = getDeletedAttendanceIds();
        delSet.add(next.id);
        saveDeletedAttendanceIds(delSet);
        hasChanges = true;
       }
      }
      healedAtts.push(cur);
     }
    });

    healedAtts.forEach(a => {
     if (a && hasValidCheckOut(a) && cleanStaleMissScanFlags(a)) {
      hasChanges = true;
     }
    });

    attendances = healedAtts;

    if (hasChanges) {
     localStorage.setItem(storageKey, JSON.stringify(attendances));
    }
    return attendances;
   } catch (e) {
    return [];
   }
  }

  function repairAndSanitizeAttendanceRecords() {
   ['MBI', 'MAI'].forEach(wh => {
    sanitizeAttendanceDatabase(wh);
   });
  }

  const whDBCache = new Map();
  function clearWhDBCache(targetKey = null) {
   if (targetKey) {
    whDBCache.delete(targetKey);
   } else {
    whDBCache.clear();
   }
  }

  let lucideDebounceTimer = null;
  function safeCreateIcons(options = null) {
   if (typeof lucide === 'undefined' || !lucide.createIcons) return;
   if (options && options.root) {
    try { lucide.createIcons(options); return; } catch(e) {}
   }
   if (lucideDebounceTimer) clearTimeout(lucideDebounceTimer);
   lucideDebounceTimer = setTimeout(() => {
    try { lucide.createIcons(); } catch(e) {}
   }, 50);
  }

  function enforceNikIntegrity(list, seedList) {
   // NIK milik sebuah karyawan (berdasarkan ID sistem permanen) TIDAK BOLEH berubah / tertukar.
   const seedById = new Map();
   (seedList || []).forEach(s => { if (s && s.id && s.nik) seedById.set(String(s.id).trim(), s); });
   const out = [];
   (list || []).forEach(u => {
    if (!u) return;
    const s = u.id ? seedById.get(String(u.id).trim()) : null;
    if (s && String(u.nik || '').toUpperCase().trim() !== String(s.nik).toUpperCase().trim()) {
     u = { ...u, nik: s.nik, barcodeValue: s.nik };
    }
    out.push(u);
   });
   return out;
  }

  function getInactiveRegistry(warehouse) {
   try {
    const raw = localStorage.getItem(`wfm_${String(warehouse || 'MBI').toLowerCase()}_inactive_registry`);
    if (!raw) return { loaded: false, set: new Set() };
    const o = JSON.parse(raw);
    return { loaded: true, set: new Set((o && Array.isArray(o.niks) ? o.niks : []).map(n => String(n).toUpperCase().trim())) };
   } catch (e) {
    return { loaded: false, set: new Set() };
   }
  }

  function isNikInactiveRegistered(nik) {
   if (!nik) return false;
   const n = String(nik).toUpperCase().trim();
   return getInactiveRegistry('MBI').set.has(n) || getInactiveRegistry('MAI').set.has(n);
  }

  function applyInactiveRegistryToList(list, warehouse) {
   // Daftar nonaktif di Cloud adalah SATU-SATUNYA sumber kebenaran status aktif/nonaktif.
   const reg = getInactiveRegistry(warehouse);
   if (!reg.loaded || !Array.isArray(list)) return list;
   list.forEach(u => {
    if (!u || !u.nik || (typeof isManagementSystemAccount === 'function' && isManagementSystemAccount(u))) return;
    const inactive = reg.set.has(String(u.nik).toUpperCase().trim());
    u.status = inactive ? 'inactive' : 'active';
    u.isActive = !inactive;
   });
   return list;
  }

  async function publishInactiveRegistryToCloud(warehouse, usersList) {
   const wh = String(warehouse || 'MBI').toUpperCase();
   const users = Array.isArray(usersList) ? usersList : getWhDB(wh, 'users', wh === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);
   const niks = users
    .filter(u => u && u.nik && !(typeof isManagementSystemAccount === 'function' && isManagementSystemAccount(u)) && (u.status === 'inactive' || u.isActive === false))
    .map(u => String(u.nik).toUpperCase().trim());
   const updatedAt = new Date().toISOString();
   try { localStorage.setItem(`wfm_${wh.toLowerCase()}_inactive_registry`, JSON.stringify({ niks, updatedAt })); } catch (e) {}
   try { await saveDocToFirestore(wh, '_metadata', 'inactive_registry', { warehouse: wh, niks, updatedAt }); } catch (e) { console.warn('publishInactiveRegistry notice:', e); }
  }

  async function pullInactiveRegistryFromCloud(warehouse) {
   const wh = String(warehouse || 'MBI').toUpperCase();
   try {
    const doc = await getDocFromFirestore(wh, '_metadata', 'inactive_registry');
    if (doc && Array.isArray(doc.niks)) {
     let localUpdatedMs = 0;
     try {
      const localRegRaw = localStorage.getItem(`wfm_${wh.toLowerCase()}_inactive_registry`);
      if (localRegRaw) {
       const parsed = JSON.parse(localRegRaw);
       if (parsed && parsed.updatedAt) localUpdatedMs = new Date(parsed.updatedAt).getTime() || 0;
      }
     } catch(eRegParse) {}
     const cloudUpdatedMs = doc.updatedAt ? (new Date(doc.updatedAt).getTime() || 0) : 0;
     if (localUpdatedMs > 0 && cloudUpdatedMs > 0 && localUpdatedMs > cloudUpdatedMs) {
      return false;
     }
     localStorage.setItem(`wfm_${wh.toLowerCase()}_inactive_registry`, JSON.stringify({ niks: doc.niks, updatedAt: doc.updatedAt || '' }));
     clearWhDBCache();
     const users = getWhDB(wh, 'users', wh === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);
     try {
      localStorage.setItem(`wfm_${wh.toLowerCase()}_users`, JSON.stringify(users));
      localStorage.setItem(`wfm_${wh.toLowerCase()}_users_backup`, JSON.stringify(users));
     } catch (e) {}
     clearWhDBCache();
     return true;
    }
   } catch (e) { console.warn('pullInactiveRegistry notice:', e); }
   return false;
  }

  function buildEmployeeIdentityIndex(users) {
   const byId = new Map(), byNik = new Map(), byName = new Map();
   (users || []).forEach(u => {
    if (!u) return;
    if (u.id) byId.set(String(u.id).trim(), u);
    if (u.nik) byNik.set(String(u.nik).trim().toUpperCase(), u);
    if (u.name && !isLikelyIdNotName(u.name)) {
     const k = cleanStr(u.name);
     if (!byName.has(k)) byName.set(k, u);
    }
   });
   return { byId, byNik, byName };
  }

  function resolveRecordOwner(rec, idx) {
   // Satu identitas tunggal: ID sistem (permanen) -> NIK -> nama (fallback terakhir). TIDAK PERNAH menandai 2 karyawan sekaligus.
   if (!rec || !idx) return null;
   const rid = rec.userId ? String(rec.userId).trim() : '';
   if (rid && idx.byId.has(rid)) return idx.byId.get(rid);
   const rnik = rec.userNik ? String(rec.userNik).trim().toUpperCase() : '';
   if (rnik && idx.byNik.has(rnik)) return idx.byNik.get(rnik);
   const rname = rec.userName ? cleanStr(rec.userName) : '';
   if (rname && !isLikelyIdNotName(rec.userName) && idx.byName.has(rname)) return idx.byName.get(rname);
   return null;
  }

  function matrixKeyForUser(u) {
   if (!u) return '';
   if (u.id && String(u.id).startsWith('ORPH:')) return String(u.id);
   return (u.nik ? String(u.nik).toUpperCase().trim() : '') || cleanStr(u.name) || String(u.id || '');
  }

  function matrixOrphanKey(rec) {
   const n = rec && rec.userNik ? String(rec.userNik).toUpperCase().trim() : '';
   return 'ORPH:' + (n || cleanStr((rec && rec.userName) || ''));
  }

  function buildMatrixAttendanceSet(attendances, idx) {
   const set = new Set();
   (attendances || []).forEach(a => {
    if (!a || isAttendanceMarkedDeleted(a)) return;
    let opDate = (a.date && /^\d{4}-\d{2}-\d{2}$/.test(a.date)) ? a.date : '';
    if (!opDate && a.checkInTime) opDate = getLocalDateString(new Date(a.checkInTime));
    if (!opDate) return;
    const owner = resolveRecordOwner(a, idx);
    const key = owner ? matrixKeyForUser(owner) : matrixOrphanKey(a);
    if (key) set.add(`${key}__${opDate}`);
   });
   return set;
  }

  function buildMatrixLeaveMap(leaves, idx) {
   const map = new Map();
   (leaves || []).forEach(l => {
    if (!l || l.status !== 'approved' || !l.startDate || !l.endDate) return;
    const owner = resolveRecordOwner(l, idx);
    const key = owner ? matrixKeyForUser(owner) : matrixOrphanKey(l);
    if (!key) return;
    getDatesInRange(l.startDate, l.endDate).forEach(ld => {
     map.set(`${key}__${getLocalDateString(ld)}`, l.type);
    });
   });
   return map;
  }

  function ensureMasterBaseline(userList, warehouse) {
   const wh = (warehouse || 'MBI').toUpperCase();
   const seedList = wh === 'MBI' ? (typeof SEED_MBI_USERS !== 'undefined' ? SEED_MBI_USERS : []) : (typeof SEED_MAI_USERS !== 'undefined' ? SEED_MAI_USERS : []);
   const reg = getInactiveRegistry(wh);
   const list = enforceNikIntegrity(userList || [], seedList);
   const userMap = new Map();
   const noNikUsers = [];
   list.forEach(u => {
    if (!u) return;
    if (u.nik) userMap.set(String(u.nik).toUpperCase().trim(), u);
    else noNikUsers.push(u);
   });
   const baselineDelKeys = typeof getDeletedUserKeys === 'function' ? getDeletedUserKeys() : null;
   seedList.forEach(s => {
    if (!s || !s.nik) return;
    if (baselineDelKeys && typeof isUserMarkedDeleted === 'function' && isUserMarkedDeleted(s, baselineDelKeys)) return;
    const sNik = String(s.nik).toUpperCase().trim();
    if (!userMap.has(sNik)) {
     const copy = { ...s };
     if (reg.loaded && reg.set.has(sNik)) { copy.status = 'inactive'; copy.isActive = false; }
     userMap.set(sNik, copy);
    } else {
     const ex = userMap.get(sNik);
     if (s.outsource && s.outsource !== 'Internal' && (!ex.outsource || ex.outsource === 'Internal')) {
      ex.outsource = s.outsource;
     }
     if (s.name && (!ex.name || isLikelyIdNotName(ex.name))) {
      ex.name = s.name;
     }
     if (s.role && !ex.role) ex.role = s.role;
     if (s.dept && (!ex.dept || ex.dept === 'Staff')) ex.dept = s.dept;
    }
   });
   const out = deduplicateUserList(Array.from(userMap.values()).concat(noNikUsers), wh);
   applyInactiveRegistryToList(out, wh);
   return out;
  }

  // =========================================================
  // BRANKAS MANDIRI KATA SANDI ADMIN (Lokal Kebal Limit & Sinkronisasi Outbox Cloud)
  // =========================================================
  function getAdminCustomPassword(wh = 'MBI') {
   try {
    const targetWh = (wh || (typeof activeWarehouse !== 'undefined' ? activeWarehouse : 'MBI') || 'MBI').toUpperCase();
    const vaultKey = `wfm_vault_admin_pwd_${targetWh.toLowerCase()}`;
    const val = localStorage.getItem(vaultKey);
    if (val && val.trim()) return val.trim();

    // Auto-adopsi jika tersimpan di memori pengguna lokal yang bukan password bawaan
    const users = getWhDB(targetWh, 'users', []);
    const admin = users.find(u => u && (u.role === 'admin' || (u.nik && (u.nik === 'ADM001' || u.nik === 'ADM-MAI'))));
    if (admin && admin.password && admin.password.trim() && admin.password !== 'adminmbi123' && admin.password !== 'adminmai123') {
     localStorage.setItem(vaultKey, admin.password.trim());
     return admin.password.trim();
    }
    return null;
   } catch(e) { return null; }
  }

  function setAdminCustomPassword(wh, pwd) {
   try {
    if (!pwd || typeof pwd !== 'string' || !pwd.trim()) return;
    const targetWh = (wh || (typeof activeWarehouse !== 'undefined' ? activeWarehouse : 'MBI') || 'MBI').toUpperCase();
    const cleanPwd = pwd.trim();
    localStorage.setItem(`wfm_vault_admin_pwd_${targetWh.toLowerCase()}`, cleanPwd);

    // Kunci juga di objek pengguna memori aktif
    const users = getWhDB(targetWh, 'users', targetWh === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);
    const adminIdx = users.findIndex(u => u && (u.role === 'admin' || (u.nik && (u.nik === 'ADM001' || u.nik === 'ADM-MAI'))));
    if (adminIdx !== -1) {
     users[adminIdx].password = cleanPwd;
     users[adminIdx].isPasswordChanged = true;
     users[adminIdx].updatedAt = new Date().toISOString();
     setWhDB(targetWh, 'users', users, true);
    }
    queueAdminPasswordCloudSync(targetWh, cleanPwd);
   } catch(e) {}
  }

  function queueAdminPasswordCloudSync(wh, pwd) {
   try {
    const targetWh = (wh || (typeof activeWarehouse !== 'undefined' ? activeWarehouse : 'MBI') || 'MBI').toUpperCase();
    const nik = targetWh === 'MAI' ? 'ADM-MAI' : 'ADM001';
    const entry = { wh: targetWh, nik, pwd, updatedAt: new Date().toISOString() };
    let list = [];
    try { list = JSON.parse(localStorage.getItem('wfm_admin_pwd_outbox') || '[]'); } catch(e) {}
    list = list.filter(item => item.wh !== targetWh);
    list.push(entry);
    localStorage.setItem('wfm_admin_pwd_outbox', JSON.stringify(list));
    flushAdminPasswordOutbox().catch(() => {});
   } catch(e) {}
  }

  async function flushAdminPasswordOutbox() {
   try {
    let list = [];
    try { list = JSON.parse(localStorage.getItem('wfm_admin_pwd_outbox') || '[]'); } catch(e) { return; }
    if (!list.length) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    const remaining = [];
    for (const item of list) {
     if (typeof isFirestoreSuspended === 'function' && isFirestoreSuspended(item.wh)) {
      remaining.push(item);
      continue;
     }
     try {
      const ok = await saveDocToFirestore(item.wh, 'users', item.nik, {
       id: item.wh === 'MAI' ? 'mai-admin' : 'mbi-admin',
       nik: item.nik,
       name: item.wh === 'MAI' ? 'Admin Gudang MAI' : 'Admin Gudang MBI',
       role: 'admin',
       warehouse: item.wh,
       password: item.pwd,
       updatedAt: item.updatedAt
      });
      if (!ok) {
       remaining.push(item);
      } else {
       if (typeof saveMasterSnapshotToFirestore === 'function') {
        saveMasterSnapshotToFirestore(item.wh, true).catch(() => {});
       }
      }
     } catch(err) {
      remaining.push(item);
     }
    }
    localStorage.setItem('wfm_admin_pwd_outbox', JSON.stringify(remaining));
   } catch(e) {}
  }

  function getWhDB(warehouse, key, defaultVal) {
   const storageKey = `wfm_${warehouse.toLowerCase()}_${key}`;
   if (whDBCache.has(storageKey)) {
    return whDBCache.get(storageKey);
   }
   const data = localStorage.getItem(storageKey);
   if (data !== null) {
    try {
     const parsed = JSON.parse(data);
     let result = parsed;
     if (key === 'users' && Array.isArray(parsed)) {
      let cleaned = deduplicateUserList(parsed, warehouse);
      const minCount = warehouse === 'MBI' ? 130 : 54;
      if (cleaned.length < minCount) {
       cleaned = ensureMasterBaseline(cleaned, warehouse);
       try { localStorage.setItem(storageKey, JSON.stringify(cleaned)); } catch(e) {}
      }
      if (cleaned.length === 0) {
       try {
        const bkp = localStorage.getItem(`wfm_${warehouse.toLowerCase()}_users_backup`);
        if (bkp) {
         const bkpList = JSON.parse(bkp);
         if (Array.isArray(bkpList) && bkpList.length > 0) cleaned = deduplicateUserList(bkpList, warehouse);
        }
       } catch(eBkp) {}
       if (cleaned.length === 0 && defaultVal && Array.isArray(defaultVal) && defaultVal.length > 0) {
        cleaned = deduplicateUserList(defaultVal, warehouse);
       }
      }
      if (cleaned.length !== parsed.length) {
       localStorage.setItem(storageKey, JSON.stringify(cleaned));
      }
      applyInactiveRegistryToList(cleaned, warehouse);
      result = cleaned;
     } else if ((key === 'leaves' || key === 'overtime' || key === 'attendance') && Array.isArray(parsed)) {
      result = parsed.filter(item => item && typeof item === 'object');
      if (result.length === 0) {
       try {
        const bkp = localStorage.getItem(`wfm_${warehouse.toLowerCase()}_${key}_backup`);
        if (bkp) {
         const bkpList = JSON.parse(bkp);
         if (Array.isArray(bkpList) && bkpList.length > 0) result = bkpList.filter(item => item && typeof item === 'object');
        }
       } catch(eBkp) {}
       if (result.length === 0 && defaultVal && Array.isArray(defaultVal) && defaultVal.length > 0) {
        result = defaultVal.filter(item => item && typeof item === 'object');
       }
      }
     }
     whDBCache.set(storageKey, result);
     return result;
    } catch(e) {
     const fallback = defaultVal !== undefined ? defaultVal : [];
     whDBCache.set(storageKey, fallback);
     return fallback;
    }
   }

   // Jika data memang belum pernah ada di storage
   const cleanedDefault = key === 'users' && Array.isArray(defaultVal) 
    ? deduplicateUserList(defaultVal, warehouse) 
    : ((key === 'leaves' || key === 'overtime' || key === 'attendance') && Array.isArray(defaultVal)
     ? defaultVal.filter(item => item && typeof item === 'object')
     : (defaultVal !== undefined ? defaultVal : []));
   localStorage.setItem(storageKey, JSON.stringify(cleanedDefault));
   whDBCache.set(storageKey, cleanedDefault);
   return cleanedDefault;
  }

  let isApplyingFromCloud = false;

  function setWhDB(warehouse, key, val, skipCloudSave = false) {
   try {
    const targetWh = (warehouse || (typeof activeWarehouse !== 'undefined' ? activeWarehouse : 'MBI') || 'MBI').toLowerCase();
    const storageKey = `wfm_${targetWh}_${key}`;
    whDBCache.set(storageKey, val);
    localStorage.setItem(storageKey, JSON.stringify(val));
    if (isApplyingFromCloud || skipCloudSave) return;
    if (key === 'users') {
     localStorage.setItem('wfm_last_master_change_time', Date.now().toString());
     if (typeof sanitizeDeletedUserKeysWithActiveUsers === 'function') {
      sanitizeDeletedUserKeysWithActiveUsers();
     }
     if (typeof saveFullDatabaseToCloud === 'function') {
      saveFullDatabaseToCloud(false, false, true);
     }
    } else {
     if (typeof saveFullDatabaseToCloud === 'function') {
      saveFullDatabaseToCloud();
     }
    }
    if (typeof triggerGoogleSheetAutoSync === 'function') {
     triggerGoogleSheetAutoSync();
    }
   } catch(e) {
    console.error('setWhDB error:', e);
   }
  }

  // =========================================================
// Expose to window for maximum cross-module compatibility
if (typeof window !== 'undefined') {
  window.CURRENT_APP_VERSION = typeof CURRENT_APP_VERSION !== 'undefined' ? CURRENT_APP_VERSION : '';
}
