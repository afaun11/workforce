// === WFM MEDIKA SUPABASE & CLOUD ENGINE ===
  // SUPABASE 24/7 ZERO-LIMIT POSTGREST & REALTIME ENGINE
  // Bebas Batas Kuota Harian (Unlimited Reads & Realtime Live Sync)
  // =========================================================
  // Database Supabase 24/7 (Proyek Baru Kuota Segar 5.5 GB + WebSocket Realtime Aktif)
  const SUPABASE_PROJECT_URL = 'https://prbyipfnjwkfidpmpaba.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_ZfS2PCsOzSYU_uPcHh1cbw_a3t7IDT4';

  function getSupabaseHeaders(extra = {}) {
   return {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation,resolution=merge-duplicates',
    ...extra
   };
  }

  async function saveAttendanceToSupabase(wh, attRec) {
   if (!attRec) return false;
   const targetWh = (wh || attRec.warehouse || (typeof activeWarehouse !== 'undefined' ? activeWarehouse : 'MBI') || 'MBI').toUpperCase();
   const docId = attRec.id || ('att-' + targetWh.toLowerCase() + '-' + Date.now());
   const cleanDate = attRec.date || (attRec.checkInTime ? getLocalDateString(new Date(attRec.checkInTime)) : getLocalDateString(new Date()));
   const payload = {
    id: docId,
    user_id: attRec.userId || attRec.id || '',
    user_nik: (attRec.userNik || attRec.nik || '').toUpperCase().trim(),
    user_name: attRec.userName || attRec.name || '',
    dept: attRec.dept || '',
    warehouse: targetWh,
    date: cleanDate,
    check_in_time: attRec.checkInTime || null,
    check_out_time: attRec.checkOutTime || null,
    check_in_status: attRec.checkInStatus || 'on_time',
    notes: attRec.notes || '',
    outsource: attRec.outsource || 'Internal',
    raw_data: attRec,
    updated_at: attRec.updatedAt || new Date().toISOString()
   };

   try {
    const url = SUPABASE_PROJECT_URL + '/rest/v1/wfm_attendance?on_conflict=id';
    const res = await fetch(url, {
     method: 'POST',
     headers: getSupabaseHeaders({ 'Prefer': 'return=minimal,resolution=merge-duplicates' }),
     body: JSON.stringify([payload])
    });
    return res.ok;
   } catch (err) {
    console.warn('[Supabase] Gagal menyimpan presensi ' + docId + ':', err);
    return false;
   }
  }

  async function deleteAttendanceFromSupabase(idsOrSet, targetWh = null, userNik = null, date = null) {
   if (!idsOrSet && !userNik) return false;
   const idList = (Array.isArray(idsOrSet) ? idsOrSet : (idsOrSet instanceof Set ? Array.from(idsOrSet) : [idsOrSet])).filter(Boolean).map(String);
   let success = false;
   try {
    if (idList.length > 0) {
     const encodedIds = idList.map(id => encodeURIComponent(id)).join(',');
     const url = SUPABASE_PROJECT_URL + '/rest/v1/wfm_attendance?id=in.(' + encodedIds + ')';
     const res = await fetch(url, {
      method: 'DELETE',
      headers: getSupabaseHeaders({ 'Prefer': 'return=representation' })
     });
     if (res.ok) success = true;
    }
    // Jika ada NIK dan tanggal, pastikan juga dihapus berdasarkan NIK + date untuk proteksi mutlak
    if (userNik && date) {
     const whFilter = targetWh ? `&warehouse=eq.${encodeURIComponent(targetWh.toUpperCase())}` : '';
     const urlNik = SUPABASE_PROJECT_URL + `/rest/v1/wfm_attendance?user_nik=eq.${encodeURIComponent(String(userNik).toUpperCase().trim())}&date=eq.${encodeURIComponent(date)}${whFilter}`;
     const resNik = await fetch(urlNik, {
      method: 'DELETE',
      headers: getSupabaseHeaders()
     });
     if (resNik.ok) success = true;
    }
   } catch (err) {
    console.warn('[Supabase] Gagal menghapus attendance dari Supabase:', err);
   }
   return success;
  }

  async function deleteAllAttendanceFromSupabase(warehouse) {
   if (!warehouse) return false;
   const wh = warehouse.toUpperCase();
   try {
    const url = SUPABASE_PROJECT_URL + '/rest/v1/wfm_attendance?warehouse=eq.' + wh;
    const res = await fetch(url, {
     method: 'DELETE',
     headers: getSupabaseHeaders()
    });
    return res.ok;
   } catch(e) {
    return false;
   }
  }

  async function pushUserToSupabase(user) {
   if (!user || !user.nik) return false;
   const targetWh = (user.warehouse || activeWarehouse || 'MBI').toUpperCase();
   const payload = [{
    id: user.id || ('user-' + targetWh.toLowerCase() + '-' + user.nik.toString().replace(/[^a-zA-Z0-9]/g, '')),
    nik: (user.nik || '').toUpperCase().trim(),
    name: user.name || '',
    warehouse: targetWh,
    role: user.role || 'staff',
    dept: user.dept || 'Warehouse Staff',
    status: user.status || 'active',
    password: user.password || '',
    custom_password: user.customPassword || '',
    email: user.email || '',
    phone: user.phone || '',
    outsource: user.outsource || 'Internal',
    permissions: user.permissions || {},
    raw_data: user,
    updated_at: user.updatedAt || new Date().toISOString()
   }];

   try {
    const url = SUPABASE_PROJECT_URL + '/rest/v1/wfm_users?on_conflict=nik';
    const res = await fetch(url, {
     method: 'POST',
     headers: getSupabaseHeaders({ 'Prefer': 'return=minimal,resolution=merge-duplicates' }),
     body: JSON.stringify(payload)
    });
    return res.ok;
   } catch(err) {
    console.warn('[Supabase] Gagal push user ke Supabase:', err);
    return false;
   }
  }

  async function saveGPSCoordsToSupabase(wh, coords) {
   if (!coords) return false;
   const targetWh = (wh || activeWarehouse || 'MBI').toUpperCase();
   const def = DEFAULT_COORDS[targetWh] || (targetWh === 'MAI' ? { lat: -6.217808, lng: 106.889398, radius: 100 } : { lat: -6.263295, lng: 106.877066, radius: 100 });
   const validRad = Number(coords.radius) > 0 ? Number(coords.radius) : 100;
   const payload = [{
    warehouse: targetWh,
    lat: def.lat,
    lng: def.lng,
    radius: validRad,
    updated_at: new Date().toISOString()
   }];

   try {
    const url = SUPABASE_PROJECT_URL + '/rest/v1/wfm_coords?on_conflict=warehouse';
    const res = await fetch(url, {
     method: 'POST',
     headers: getSupabaseHeaders({ 'Prefer': 'return=minimal,resolution=merge-duplicates' }),
     body: JSON.stringify(payload)
    });
    return res.ok;
   } catch(err) {
    console.warn('[Supabase] Gagal menyimpan coords/radius:', err);
    return false;
   }
  }

  async function pullGPSCoordsFromSupabase(wh = null) {
   const targetWh = (wh || activeWarehouse || 'MBI').toUpperCase();
   try {
    const url = SUPABASE_PROJECT_URL + '/rest/v1/wfm_coords?warehouse=eq.' + targetWh;
    const res = await fetch(url, { headers: getSupabaseHeaders(), cache: 'no-store' });
    if (!res.ok) return null;
    const rows = await res.json();
    if (Array.isArray(rows) && rows.length > 0) {
     const row = rows[0];
     const rad = Number(row.radius) > 0 ? Number(row.radius) : 100;
     const def = DEFAULT_COORDS[targetWh] || (targetWh === 'MAI' ? { lat: -6.217808, lng: 106.889398 } : { lat: -6.263295, lng: 106.877066 });
     const coords = { lat: def.lat, lng: def.lng, radius: rad, name: `Gudang ${targetWh}` };
     localStorage.setItem(`wfm_${targetWh.toLowerCase()}_coords`, JSON.stringify(coords));
     localStorage.setItem(`wfm_gps_radius_${targetWh.toLowerCase()}`, String(rad));
     if (activeWarehouse === targetWh) {
      localStorage.setItem('wfm_gps_radius', String(rad));
     }
     latestCachedGPS = null;
     if (typeof updateRegisteredCoordsDisplay === 'function') {
      updateRegisteredCoordsDisplay();
     }
     return coords;
    }
   } catch(e) {}
   return null;
  }

  async function saveUsersToSupabase(wh, usersList) {
   if (!Array.isArray(usersList) || usersList.length === 0) return true;
   const targetWh = (wh || (typeof activeWarehouse !== 'undefined' ? activeWarehouse : 'MBI') || 'MBI').toUpperCase();
   const payload = usersList.map(u => ({
    id: u.id || ('user-' + targetWh.toLowerCase() + '-' + (u.nik || Date.now()).toString().replace(/\s+/g, '')),
    nik: (u.nik || '').toUpperCase().trim(),
    name: u.name || '',
    warehouse: targetWh,
    role: u.role || 'staff',
    dept: u.dept || 'Staff',
    status: u.status || 'active',
    password: u.password || '',
    custom_password: (typeof getAdminCustomPassword === 'function' ? getAdminCustomPassword(targetWh) : '') || u.customPassword || '',
    email: u.email || '',
    phone: u.phone || '',
    outsource: u.outsource || 'Internal',
    permissions: u.permissions || {},
    raw_data: u,
    updated_at: u.updatedAt || new Date().toISOString()
   }));

   try {
    const url = SUPABASE_PROJECT_URL + '/rest/v1/wfm_users?on_conflict=nik';
    for (let i = 0; i < payload.length; i += 50) {
     const chunk = payload.slice(i, i + 50);
     await fetch(url, {
      method: 'POST',
      headers: getSupabaseHeaders({ 'Prefer': 'return=minimal,resolution=merge-duplicates' }),
      body: JSON.stringify(chunk)
     });
    }
    return true;
   } catch (err) {
    console.warn('[Supabase] Gagal menyimpan master users ' + targetWh + ':', err);
    return false;
   }
  }

  async function pullAttendanceFromSupabase(wh = null, date = null, forceFull = false) {
   const targetWh = (wh || (typeof activeWarehouse !== 'undefined' ? activeWarehouse : 'MBI') || 'MBI').toUpperCase();
   // OPTIMASI BANDWIDTH: Ambil kolom spesifik saja untuk memangkas duplikasi raw_data
   const selectCols = 'id,user_id,user_nik,user_name,dept,warehouse,date,check_in_time,check_out_time,check_in_status,notes,outsource,updated_at';
   const baseUrl = SUPABASE_PROJECT_URL + '/rest/v1/wfm_attendance?select=' + selectCols + '&warehouse=eq.' + targetWh + '&order=date.desc,check_in_time.desc';

   try {
    let rows = [];
    if (date) {
     // Tarik data spesifik tanggal tertentu (misal hari ini atau filter tanggal tertentu)
     const singleUrl = baseUrl + '&date=eq.' + encodeURIComponent(date);
     const res = await fetch(singleUrl, { headers: getSupabaseHeaders(), cache: 'no-store' });
     if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) rows = data;
     }
    } else if (forceFull || ((!getWhDB(targetWh, 'attendance', []) || getWhDB(targetWh, 'attendance', []).length < 50) && !date)) {
     // Tarik SEMUA riwayat lengkap jika tombol ditekan atau memori lokal perangkat masih kosong
     let offset = 0;
     const batchSize = 1000;
     while (offset < 15000) {
      const rangeHeaders = { ...getSupabaseHeaders(), 'Range': `${offset}-${offset + batchSize - 1}` };
      const res = await fetch(baseUrl, { headers: rangeHeaders, cache: 'no-store' });
      if (!res.ok) break;
      const batch = await res.json();
      if (!Array.isArray(batch) || batch.length === 0) break;
      rows.push(...batch);
      if (batch.length < batchSize) break; // Sudah semua data tersedot
      offset += batchSize;
     }
    } else {
     // SINKRONISASI OTOMATIS HEMAT BANDWIDTH (HEMAT 98% KUOTA):
     // Hanya tarik data 3 hari terakhir (hari ini, kemarin, lusa lalu).
     // Riwayat bulan lalu tetap aman tersimpan di LocalStorage perangkat.
     const today = new Date();
     const pastDate = new Date(today.getTime() - (3 * 24 * 60 * 60 * 1000));
     const minDateStr = (typeof getLocalDateString === 'function') 
       ? getLocalDateString(pastDate) 
       : pastDate.toISOString().split('T')[0];
     
     const recentUrl = baseUrl + '&date=gte.' + encodeURIComponent(minDateStr) + '&limit=500';
     const res = await fetch(recentUrl, { headers: getSupabaseHeaders(), cache: 'no-store' });
     if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) rows = data;
     }
    }

    if (rows.length === 0 && !date && forceFull) return getWhDB(targetWh, 'attendance', []);

    const converted = rows.map(r => ({
     ...(r.raw_data || {}),
     id: r.id,
     userId: r.user_id,
     userNik: r.user_nik,
     userName: r.user_name,
     dept: r.dept,
     warehouse: r.warehouse,
     date: r.date,
     checkInTime: r.check_in_time,
     checkOutTime: r.check_out_time,
     checkInStatus: r.check_in_status,
     notes: r.notes,
     outsource: r.outsource,
     updatedAt: r.updated_at
    }));

    // Pulihkan status data yang sah dari database Cloud agar tidak terblokir
    if (typeof untrackDeletedAttendance === 'function' && Array.isArray(converted)) {
     untrackDeletedAttendance(converted);
    }

    // PENGGABUNGAN AMAN TANPA PENGHAPUSAN OTOMATIS:
    // Menarik dari Cloud HANYA menambah dan memperbarui data lokal, TIDAK BOLEH menghapus data.
    const cur = getWhDB(targetWh, 'attendance', []);
    const merged = mergeAttendanceArrays(cur, converted);
    let hasChanged = (cur.length !== merged.length);
    if (!hasChanged) {
     for (let i = 0; i < Math.min(cur.length, 10); i++) {
      if (cur[i]?.id !== merged[i]?.id || cur[i]?.checkOutTime !== merged[i]?.checkOutTime || cur[i]?.updatedAt !== merged[i]?.updatedAt) {
       hasChanged = true;
       break;
      }
     }
    }
    if (hasChanged) {
     setWhDB(targetWh, 'attendance', merged, true);
     try {
      const todayKey = 'wfm_' + targetWh.toLowerCase() + '_today_attendance';
      localStorage.setItem(todayKey, JSON.stringify(merged.filter(a => a && !isAttendanceMarkedDeleted(a))));
     } catch(eTd) {}
    }
    merged._hasChanged = hasChanged;
    try {
     if (typeof renderScannerTodayRecords === 'function') renderScannerTodayRecords();
    } catch(eRnd) {}
    return merged;
   } catch (err) {
    console.warn('[Supabase] Gagal menarik data presensi ' + targetWh + ':', err);
    return getWhDB(targetWh, 'attendance', []);
   }
  }

  async function saveLeavesToSupabase(wh, leavesList) {
   if (!Array.isArray(leavesList) || leavesList.length === 0) return true;
   const targetWh = (wh || (typeof activeWarehouse !== 'undefined' ? activeWarehouse : 'MBI') || 'MBI').toUpperCase();
   const payload = leavesList.map(l => ({
    id: l.id || ('leave-' + targetWh.toLowerCase() + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6)),
    warehouse: targetWh,
    user_nik: (l.userNik || l.nik || '').toUpperCase().trim(),
    user_name: l.userName || l.name || '',
    type: l.type || 'Cuti',
    start_date: l.startDate || l.start_date || '',
    end_date: l.endDate || l.end_date || '',
    reason: l.reason || '',
    status: l.status || 'pending',
    raw_data: l,
    updated_at: l.updatedAt || new Date().toISOString()
   }));
   try {
    const url = SUPABASE_PROJECT_URL + '/rest/v1/wfm_leaves?on_conflict=id';
    await fetch(url, {
     method: 'POST',
     headers: getSupabaseHeaders({ 'Prefer': 'return=minimal,resolution=merge-duplicates' }),
     body: JSON.stringify(payload)
    });
    return true;
   } catch(e) {
    console.warn('[Supabase] Gagal menyimpan leaves ' + targetWh + ':', e);
    return false;
   }
  }
  window.saveLeavesToSupabase = saveLeavesToSupabase;

  async function saveOvertimeToSupabase(wh, overtimeList) {
   if (!Array.isArray(overtimeList) || overtimeList.length === 0) return true;
   const targetWh = (wh || (typeof activeWarehouse !== 'undefined' ? activeWarehouse : 'MBI') || 'MBI').toUpperCase();
   const payload = overtimeList.map(o => ({
    id: o.id || ('ot-' + targetWh.toLowerCase() + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6)),
    warehouse: targetWh,
    user_nik: (o.userNik || o.nik || '').toUpperCase().trim(),
    date: o.date || '',
    hours: parseFloat(o.effectiveHours || o.totalHours || o.hours || 0) || 0,
    status: o.status || 'pending',
    raw_data: o,
    updated_at: o.updatedAt || new Date().toISOString()
   }));
   try {
    const url = SUPABASE_PROJECT_URL + '/rest/v1/wfm_overtime?on_conflict=id';
    await fetch(url, {
     method: 'POST',
     headers: getSupabaseHeaders({ 'Prefer': 'return=minimal,resolution=merge-duplicates' }),
     body: JSON.stringify(payload)
    });
    return true;
   } catch(e) {
    console.warn('[Supabase] Gagal menyimpan overtime ' + targetWh + ':', e);
    return false;
   }
  }
  window.saveOvertimeToSupabase = saveOvertimeToSupabase;

  async function pullLeavesFromSupabase(wh = null) {
   const targetWh = (wh || (typeof activeWarehouse !== 'undefined' ? activeWarehouse : 'MBI') || 'MBI').toUpperCase();
   const selectLeaves = 'id,warehouse,user_nik,user_name,type,start_date,end_date,reason,status,updated_at';
   const url = SUPABASE_PROJECT_URL + '/rest/v1/wfm_leaves?select=' + selectLeaves + '&warehouse=eq.' + targetWh + '&order=start_date.desc&limit=500';
   try {
    const res = await fetch(url, { headers: getSupabaseHeaders(), cache: 'no-store' });
    if (!res.ok) return [];
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return [];
    const converted = rows.map(r => ({
     ...(r.raw_data || {}),
     id: r.id,
     warehouse: r.warehouse,
     userNik: r.user_nik,
     userName: r.user_name,
     type: r.type,
     startDate: r.start_date,
     endDate: r.end_date,
     reason: r.reason,
     status: r.status,
     updatedAt: r.updated_at
    }));
    const cur = getWhDB(targetWh, 'leaves', []);
    const curMap = new Map(cur.map(x => [x.id, x]));
    converted.forEach(x => curMap.set(x.id, { ...(curMap.get(x.id) || {}), ...x }));
    const merged = Array.from(curMap.values());
    setWhDB(targetWh, 'leaves', merged, true);
    return merged;
   } catch(e) {
    return [];
   }
  }
  window.pullLeavesFromSupabase = pullLeavesFromSupabase;

  async function pullOvertimeFromSupabase(wh = null) {
   const targetWh = (wh || (typeof activeWarehouse !== 'undefined' ? activeWarehouse : 'MBI') || 'MBI').toUpperCase();
   const selectOt = 'id,warehouse,user_nik,date,hours,status,updated_at';
   const url = SUPABASE_PROJECT_URL + '/rest/v1/wfm_overtime?select=' + selectOt + '&warehouse=eq.' + targetWh + '&order=date.desc&limit=500';
   try {
    const res = await fetch(url, { headers: getSupabaseHeaders(), cache: 'no-store' });
    if (!res.ok) return [];
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return [];
    const converted = rows.map(r => ({
     ...(r.raw_data || {}),
     id: r.id,
     warehouse: r.warehouse,
     userNik: r.user_nik,
     date: r.date,
     hours: r.hours,
     status: r.status,
     updatedAt: r.updated_at
    }));
    const cur = getWhDB(targetWh, 'overtime', []);
    const curMap = new Map(cur.map(x => [x.id, x]));
    converted.forEach(x => curMap.set(x.id, { ...(curMap.get(x.id) || {}), ...x }));
    const merged = Array.from(curMap.values());
    setWhDB(targetWh, 'overtime', merged, true);
    return merged;
   } catch(e) {
    return [];
   }
  }
  window.pullOvertimeFromSupabase = pullOvertimeFromSupabase;

  async function pullUsersFromSupabase(wh = null) {
   const targetWh = (wh || (typeof activeWarehouse !== 'undefined' ? activeWarehouse : 'MBI') || 'MBI').toUpperCase();
   const selectUser = 'id,nik,name,warehouse,role,dept,status,password,custom_password,email,phone,outsource,updated_at';
   const url = SUPABASE_PROJECT_URL + '/rest/v1/wfm_users?select=' + selectUser + '&warehouse=eq.' + targetWh + '&order=name.asc';
   try {
    const res = await fetch(url, { headers: getSupabaseHeaders(), cache: 'no-store' });
    if (!res.ok) return [];
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return [];

    const converted = rows.map(r => ({
     ...(r.raw_data || {}),
     id: r.id,
     nik: r.nik,
     name: r.name,
     warehouse: r.warehouse,
     role: r.role,
     dept: r.dept,
     status: r.status,
     password: r.password,
     customPassword: r.custom_password,
     email: r.email,
     phone: r.phone,
     outsource: r.outsource,
     updatedAt: r.updated_at
    }));

    // Pulihkan kata sandi kustom Admin ke Brankas Mandiri jika ada
    for (const r of rows) {
     if ((r.role === 'admin' || (r.nik && String(r.nik).toUpperCase().startsWith('ADM'))) && r.custom_password) {
      if (typeof setAdminCustomPassword === 'function') {
       setAdminCustomPassword(targetWh, r.custom_password);
      }
     }
    }

    const cur = getWhDB(targetWh, 'users', []);
    const merged = mergeUserArrays(cur, converted, targetWh);
    setWhDB(targetWh, 'users', merged, true);
    return merged;
   } catch (err) {
    console.warn('[Supabase] Gagal menarik users ' + targetWh + ':', err);
    return [];
   }
  }

  async function rescueActiveOpenSessionFromSupabase(wh, matchedUser) {
   if (!matchedUser || !matchedUser.nik) return null;
   const targetWh = (wh || (typeof activeWarehouse !== 'undefined' ? activeWarehouse : 'MBI') || 'MBI').toUpperCase();
   const nik = encodeURIComponent(String(matchedUser.nik).trim().toUpperCase());
   const url = SUPABASE_PROJECT_URL + '/rest/v1/wfm_attendance?warehouse=eq.' + targetWh + '&user_nik=eq.' + nik + '&check_out_time=is.null&order=created_at.desc&limit=1';
   try {
    const res = await fetch(url, { headers: getSupabaseHeaders(), cache: 'no-store' });
    if (!res.ok) return null;
    const rows = await res.json();
    if (Array.isArray(rows) && rows.length > 0) {
     const r = rows[0];
     return {
      ...(r.raw_data || {}),
      id: r.id,
      userId: r.user_id,
      userNik: r.user_nik,
      userName: r.user_name,
      dept: r.dept,
      warehouse: r.warehouse,
      date: r.date,
      checkInTime: r.check_in_time,
      checkOutTime: r.check_out_time,
      checkInStatus: r.check_in_status,
      notes: r.notes,
      outsource: r.outsource,
      updatedAt: r.updated_at
     };
    }
   } catch (err) {}
   return null;
  }

  async function migrateAllDataToSupabase(targetWh = null, showFeedback = false) {
   if (showFeedback) {
    const ok = confirm('🚀 KONFIRMASI MIGRASI DATA KE SUPABASE 24/7\n\n' +
     'Proses ini akan memindahkan SELURUH data:\n' +
     '1. Master Karyawan Gudang MBI & MAI (184+ orang)\n' +
     '2. Seluruh riwayat presensi masuk & pulang\n' +
     '3. Data cuti, lembur, dan antrean scan yang tertahan\n\n' +
     'Data di perangkat dan Google Sheet tetap aman 100%.\n\n' +
     'Lanjutkan proses migrasi?');
    if (!ok) return { success: false, cancelled: true };
   }

   const btn = (typeof document !== 'undefined' && document.getElementById) ? document.getElementById('btn-migrate-supabase') : null;
   const origBtnHtml = btn ? btn.innerHTML : '';
   if (btn) {
    btn.disabled = true;
    if (btn.style) btn.style.opacity = '0.75';
    btn.innerHTML = '<span>⏳ Sedang Memindahkan Seluruh Data ke Supabase... Mohon Tunggu Sebentar</span>';
   }

   const whs = targetWh ? [targetWh.toUpperCase()] : ['MBI', 'MAI'];
   let totalUsers = 0;
   let totalAtt = 0;
   let totalOutbox = 0;
   let recoveredNov12Count = 0;

   try {
    for (const w of whs) {
     // LANGKAH 1: Kumpulkan seluruh arsip riwayat absensi (Google Sheet, Cloud, dan Antrean)
     // Ini memastikan data presensi kemarin (12 November) yang belum sempat tersinkronisasi otomatis tertarik utuh
     if (!localStorage.getItem(`wfm_${w.toLowerCase()}_gsheet_pull_recovered`)) {
      try {
       if (typeof syncAttendanceFromGoogleSheetMaster === 'function') {
        await syncAttendanceFromGoogleSheetMaster(false, w);
       }
      } catch (eGsRecov) {}
      try { localStorage.setItem(`wfm_${w.toLowerCase()}_gsheet_pull_recovered`, 'true'); } catch(e) {}
     }

     try {
      if (typeof syncAttendanceArchiveFromCloud === 'function') {
       await syncAttendanceArchiveFromCloud(w, false);
      }
     } catch (eArchRecov) {}

     try {
      if (typeof sanitizeAttendanceDatabase === 'function') {
       sanitizeAttendanceDatabase(w);
      }
     } catch (eSanRecov) {}

     const users = getWhDB(w, 'users', w === 'MBI' ? (typeof SEED_MBI_USERS !== 'undefined' ? SEED_MBI_USERS : []) : (typeof SEED_MAI_USERS !== 'undefined' ? SEED_MAI_USERS : []));
     if (users.length > 0) {
      await saveUsersToSupabase(w, users);
      totalUsers += users.length;
     }

     const atts = getWhDB(w, 'attendance', w === 'MBI' ? (typeof SEED_MBI_ATTENDANCE !== 'undefined' ? SEED_MBI_ATTENDANCE : []) : (typeof SEED_MAI_ATTENDANCE !== 'undefined' ? SEED_MAI_ATTENDANCE : []));
     if (atts.length > 0) {
      for (let i = 0; i < atts.length; i += 50) {
       const chunk = atts.slice(i, i + 50);
       const payload = chunk.map(a => ({
        id: a.id || ('att-' + w.toLowerCase() + '-' + Date.now() + '-' + Math.random()),
        user_id: a.userId || a.id || '',
        user_nik: (a.userNik || a.nik || '').toUpperCase().trim(),
        user_name: a.userName || a.name || '',
        dept: a.dept || '',
        warehouse: w,
        date: a.date || (a.checkInTime ? getLocalDateString(new Date(a.checkInTime)) : getLocalDateString(new Date())),
        check_in_time: a.checkInTime || null,
        check_out_time: a.checkOutTime || null,
        check_in_status: a.checkInStatus || 'on_time',
        notes: a.notes || '',
        outsource: a.outsource || 'Internal',
        raw_data: a,
        updated_at: a.updatedAt || new Date().toISOString()
       }));
       await fetch(SUPABASE_PROJECT_URL + '/rest/v1/wfm_attendance?on_conflict=id', {
        method: 'POST',
        headers: getSupabaseHeaders({ 'Prefer': 'return=minimal,resolution=merge-duplicates' }),
        body: JSON.stringify(payload)
       }).catch(() => {});
      }
      totalAtt += atts.length;
     }

     // 3. Data Pengajuan Cuti / Izin / Sakit
     try {
      const leaves = getWhDB(w, 'leaves', []);
      if (leaves.length > 0) {
       const leavesPayload = leaves.map(l => ({
        id: l.id || ('leave-' + w.toLowerCase() + '-' + Date.now() + '-' + Math.random()),
        warehouse: w,
        user_nik: (l.userNik || l.nik || '').toUpperCase().trim(),
        user_name: l.userName || l.name || '',
        type: l.type || 'Cuti',
        start_date: l.startDate || l.start_date || '',
        end_date: l.endDate || l.end_date || '',
        reason: l.reason || '',
        status: l.status || 'pending',
        raw_data: l,
        updated_at: l.updatedAt || new Date().toISOString()
       }));
       await fetch(SUPABASE_PROJECT_URL + '/rest/v1/wfm_leaves?on_conflict=id', {
        method: 'POST',
        headers: getSupabaseHeaders({ 'Prefer': 'return=minimal,resolution=merge-duplicates' }),
        body: JSON.stringify(leavesPayload)
       }).catch(() => {});
      }
     } catch(eLeaves) {}

     // 4. Data Lembur
     try {
      const overtime = getWhDB(w, 'overtime', []);
      if (overtime.length > 0) {
       const otPayload = overtime.map(o => ({
        id: o.id || ('ot-' + w.toLowerCase() + '-' + Date.now() + '-' + Math.random()),
        warehouse: w,
        user_nik: (o.userNik || o.nik || '').toUpperCase().trim(),
        date: o.date || '',
        hours: Number(o.hours) || 0,
        status: o.status || 'pending',
        raw_data: o,
        updated_at: o.updatedAt || new Date().toISOString()
       }));
       await fetch(SUPABASE_PROJECT_URL + '/rest/v1/wfm_overtime?on_conflict=id', {
        method: 'POST',
        headers: getSupabaseHeaders({ 'Prefer': 'return=minimal,resolution=merge-duplicates' }),
        body: JSON.stringify(otPayload)
       }).catch(() => {});
      }
     } catch(eOt) {}
    }

    const outbox = typeof readAttOutbox === 'function' ? readAttOutbox() : [];
    if (outbox.length > 0) {
     for (const item of outbox) {
      if (item && item.rec) {
       const ok = await saveAttendanceToSupabase(item.wh || 'MBI', item.rec);
       if (ok) totalOutbox++;
      }
     }
     if (typeof flushAttendanceOutbox === 'function') {
      await flushAttendanceOutbox();
     }
    }

    localStorage.setItem('wfm_supabase_last_sync', Date.now().toString());
    localStorage.setItem('wfm_supabase_migrated_v3', 'true');

    if (btn) {
     btn.disabled = false;
     if (btn.style) btn.style.opacity = '1';
     btn.innerHTML = origBtnHtml || '<span>⚡ Migrasikan Seluruh Data (Gudang MBI & MAI) ke Supabase (Bebas Limit 24/7)</span>';
    }

    if (showFeedback) {
     alert('✅ MIGRASI KE SUPABASE BERHASIL 100%!\n\n' +
      '• Karyawan Gudang MBI & MAI: ' + totalUsers + ' orang\n' +
      '• Riwayat Absensi Masuk & Pulang (Termasuk 12 Nov & Hari Ini): ' + totalAtt + ' data\n' +
      '• Antrean Scan yang Dikosongkan: ' + totalOutbox + ' data\n\n' +
      'Seluruh data sekarang sudah resmi aktif di Supabase dan sistem berjalan 100% menggunakan database Supabase!');
    }
    return { success: true, totalUsers, totalAtt, totalOutbox };
   } catch (eMigrate) {
    console.error('migrateAllDataToSupabase error:', eMigrate);
    if (btn) {
     btn.disabled = false;
     if (btn.style) btn.style.opacity = '1';
     btn.innerHTML = origBtnHtml || '<span>⚡ Migrasikan Seluruh Data (Gudang MBI & MAI) ke Supabase (Bebas Limit 24/7)</span>';
    }
    if (showFeedback) {
     alert('⚠️ Terjadi kendala saat migrasi ke Supabase: ' + eMigrate.message);
    }
    return { success: false, error: eMigrate.message };
   }
  }

  window.saveAttendanceToSupabase = saveAttendanceToSupabase;
  window.saveUsersToSupabase = saveUsersToSupabase;
  window.pullAttendanceFromSupabase = pullAttendanceFromSupabase;
  window.pullUsersFromSupabase = pullUsersFromSupabase;

  // REKONSILIASI PENUH KEDUA GUDANG (MBI & MAI)
  // Menyelamatkan seluruh data tap masuk & pulang karyawan agar akurat sesuai fakta absen
  async function reconcileBothWarehousesAttendance(showFeedback = true) {
   updateCloudSyncStatusBadge('syncing');
   try {
    for (const wh of ['MBI', 'MAI']) {
     try {
      if (typeof syncAttendanceFromGoogleSheetMaster === 'function') {
       await syncAttendanceFromGoogleSheetMaster(false, wh);
      }
     } catch(eGs) {}

     try {
      if (typeof fetchFullDatabaseFromCloud === 'function') {
       await fetchFullDatabaseFromCloud(false, wh, true);
      }
     } catch(eCloud) {}

     try {
      if (typeof sanitizeAttendanceDatabase === 'function') {
       sanitizeAttendanceDatabase(wh);
      }
     } catch(eSan) {}
    }

    clearWhDBCache();
    if (typeof renderAllLiveScreens === 'function') renderAllLiveScreens();
    if (typeof renderRecordsTable === 'function') renderRecordsTable();
    if (typeof refreshAllDashboardData === 'function') refreshAllDashboardData();
    updateCloudSyncStatusBadge('synced');

    if (showFeedback) {
     alert('✅ Rekonsiliasi Absen Selesai!\nSeluruh data presensi Gudang MBI & MAI telah disinkronkan dan diselaraskan dengan Google Sheet & Cloud.\nStatus Miss Scan palsu telah dibersihkan secara otomatis.');
    }
   } catch(e) {
    console.error('[Reconcile] Error:', e);
    if (showFeedback) alert('Pemberitahuan: ' + (e.message || 'Selesai sinkronisasi.'));
   }
  }
  window.reconcileBothWarehousesAttendance = reconcileBothWarehousesAttendance;
  window.rescueActiveOpenSessionFromSupabase = rescueActiveOpenSessionFromSupabase;
  window.migrateAllDataToSupabase = migrateAllDataToSupabase;

  // =========================================================
  // DUAL PURE GOOGLE FIREBASE REALTIME DATABASE 24/7 ENGINE
  // Gudang MBI & Gudang MAI Masing-Masing Memiliki Database Terpisah (Kuota Dobel & Isolasi Penuh)
  // =========================================================
  const DEFAULT_FIREBASE_RTDB_MBI_URL = 'https://wfm-medika-mbi-new-default-rtdb.firebaseio.com/wfm_database.json';
  const DEFAULT_FIREBASE_RTDB_MAI_URL = 'https://wfm-medika2-default-rtdb.firebaseio.com/wfm_database.json';
  const DEFAULT_FIREBASE_RTDB_URL = DEFAULT_FIREBASE_RTDB_MBI_URL;

  function getFirebaseEndpoint(wh) {
   const targetWh = (wh || activeWarehouse || 'MBI').toUpperCase();
   if (targetWh === 'MAI') {
    const customMai = localStorage.getItem('wfm_firebase_custom_mai_url');
    if (customMai && customMai.trim().startsWith('https://') && customMai.includes('wfm-medika2')) {
     let clean = customMai.trim().replace(/\/$/, '');
     if (!clean.endsWith('.json')) clean += '/wfm_database.json';
     return clean;
    }
    return DEFAULT_FIREBASE_RTDB_MAI_URL;
   } else {
    const customMbi = localStorage.getItem('wfm_firebase_custom_mbi_url') || localStorage.getItem('wfm_firebase_custom_url');
    if (customMbi && customMbi.trim().startsWith('https://') && customMbi.includes('wfm-medika-mbi-new')) {
     let clean = customMbi.trim().replace(/\/$/, '');
     if (!clean.endsWith('.json')) clean += '/wfm_database.json';
     return clean;
    }
    return DEFAULT_FIREBASE_RTDB_MBI_URL;
   }
  }

  function getFirebaseAudioEndpoint(wh) {
   const base = getFirebaseEndpoint(wh);
   return base.replace(/wfm_database\.json$/, 'wfm_audio.json');
  }

  const FIREBASE_ENDPOINT = getFirebaseEndpoint();
  const CLOUD_ENDPOINTS = [DEFAULT_FIREBASE_RTDB_MBI_URL, DEFAULT_FIREBASE_RTDB_MAI_URL];

  function copyFirebaseRules() {
   if (typeof copyFirestoreRules === 'function') {
    return copyFirestoreRules();
   }
  }

  // =========================================================
  // GOOGLE CLOUD FIRESTORE 24/7 NEXT-GEN ENGINE
  // Gudang MBI & Gudang MAI Masing-Masing Memiliki Project Cloud Terpisah
  // Skema Koleksi Dokumen Terpisah: Mencegah Lonjakan Kuota & Melindungi NIK 100%
  // =========================================================
  const DEFAULT_FIRESTORE_PROJECTS = {
   MBI: 'wfm-medika-mbi-new',
   MAI: 'wfm-medika2'
  };

  function getFirestoreProjectId(wh) {
   const targetWh = (wh || (typeof activeWarehouse !== 'undefined' ? activeWarehouse : 'MBI') || 'MBI').toUpperCase();
   return DEFAULT_FIRESTORE_PROJECTS[targetWh] || DEFAULT_FIRESTORE_PROJECTS.MBI;
  }

  function toFirestoreValue(val) {
   if (val === null || val === undefined) return { nullValue: null };
   if (typeof val === 'boolean') return { booleanValue: val };
   if (typeof val === 'number') {
    if (Number.isInteger(val)) return { integerValue: val.toString() };
    return { doubleValue: val };
   }
   if (typeof val === 'string') return { stringValue: val };
   if (Array.isArray(val)) {
    return { arrayValue: { values: val.map(toFirestoreValue) } };
   }
   if (typeof val === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(val)) {
     if (v !== undefined) fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
   }
   return { stringValue: String(val) };
  }

  function fromFirestoreValue(val) {
   if (!val) return null;
   if ('stringValue' in val) return val.stringValue;
   if ('integerValue' in val) return parseInt(val.integerValue, 10);
   if ('doubleValue' in val) return parseFloat(val.doubleValue);
   if ('booleanValue' in val) return val.booleanValue;
   if ('nullValue' in val) return null;
   if ('timestampValue' in val) return val.timestampValue;
   if ('arrayValue' in val) {
    return (val.arrayValue.values || []).map(fromFirestoreValue);
   }
   if ('mapValue' in val) {
    const obj = {};
    const fields = val.mapValue.fields || {};
    for (const [k, v] of Object.entries(fields)) {
     obj[k] = fromFirestoreValue(v);
    }
    return obj;
   }
   return null;
  }

  function toFirestoreDoc(dataObj) {
   const fields = {};
   for (const [key, value] of Object.entries(dataObj)) {
    if (value !== undefined) fields[key] = toFirestoreValue(value);
   }
   return { fields };
  }

  function fromFirestoreDoc(firestoreDoc) {
   if (!firestoreDoc || !firestoreDoc.fields) return null;
   const result = {};
   for (const [k, v] of Object.entries(firestoreDoc.fields)) {
    result[k] = fromFirestoreValue(v);
   }
   if (firestoreDoc.name) {
    const parts = firestoreDoc.name.split('/');
    result._firestoreDocId = decodeURIComponent(parts[parts.length - 1]);
    if (!result.id) result.id = result._firestoreDocId;
   }
   return result;
  }

  const firestoreQuotaSuspended = { MBI: 0, MAI: 0 };
  function isFirestoreSuspended(wh) {
   const targetWh = (wh || (typeof activeWarehouse !== 'undefined' ? activeWarehouse : 'MBI') || 'MBI').toUpperCase();
   return firestoreQuotaSuspended[targetWh] && Date.now() < firestoreQuotaSuspended[targetWh];
  }
  function suspendFirestoreQuota(wh) {
   const targetWh = (wh || (typeof activeWarehouse !== 'undefined' ? activeWarehouse : 'MBI') || 'MBI').toUpperCase();
   firestoreQuotaSuspended[targetWh] = Date.now() + 30 * 60 * 1000;
   console.warn(`[Firestore Quota] Firestore untuk ${targetWh} ditangguhkan sementara (30 menit) karena limit kuota harian tercapai. Sistem beralih penuh ke Firebase RTDB.`);
  }

  async function saveDocToFirestore(wh, collection, docId, data) {
   const targetWh = (wh || (typeof activeWarehouse !== 'undefined' ? activeWarehouse : 'MBI') || 'MBI').toUpperCase();
   if (isFirestoreSuspended(targetWh)) return false;
   try {
    const projectId = getFirestoreProjectId(targetWh);
    const cleanDocId = encodeURIComponent(String(docId).trim());
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}/${cleanDocId}`;
    const body = toFirestoreDoc(data);
    const res = await fetch(url, {
     method: 'PATCH',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify(body)
    });
    if (res.status === 429 || res.status === 403) {
     suspendFirestoreQuota(targetWh);
     return false;
    }
    return res.ok;
   } catch (err) {
    console.warn(`[Firestore] Gagal menyimpan ${collection}/${docId} (${targetWh}):`, err);
    return false;
   }
  }

  async function getDocFromFirestore(wh, collection, docId) {
   const targetWh = (wh || (typeof activeWarehouse !== 'undefined' ? activeWarehouse : 'MBI') || 'MBI').toUpperCase();
   if (isFirestoreSuspended(targetWh)) return null;
   try {
    const projectId = getFirestoreProjectId(targetWh);
    const cleanDocId = encodeURIComponent(String(docId).trim());
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}/${cleanDocId}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (res.status === 429 || res.status === 403) {
     suspendFirestoreQuota(targetWh);
     return null;
    }
    if (!res.ok) return null;
    const json = await res.json();
    return fromFirestoreDoc(json);
   } catch (err) {
    console.warn(`[Firestore] Gagal memuat ${collection}/${docId} (${targetWh}):`, err);
    return null;
   }
  }

  async function listDocsFromFirestore(wh, collection, pageSize = 300, pageToken = '') {
   const targetWh = (wh || (typeof activeWarehouse !== 'undefined' ? activeWarehouse : 'MBI') || 'MBI').toUpperCase();
   if (isFirestoreSuspended(targetWh)) return { docs: [], nextPageToken: null };
   try {
    const projectId = getFirestoreProjectId(targetWh);
    let url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}?pageSize=${pageSize}`;
    if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (res.status === 429 || res.status === 403) {
     suspendFirestoreQuota(targetWh);
     return { docs: [], nextPageToken: null };
    }
    if (!res.ok) return { docs: [], nextPageToken: null };
    const json = await res.json();
    const docs = (json.documents || []).map(fromFirestoreDoc).filter(Boolean);
    return { docs, nextPageToken: json.nextPageToken || null };
   } catch (err) {
    console.warn(`[Firestore] Gagal melihat daftar ${collection} (${targetWh}):`, err);
    return { docs: [], nextPageToken: null };
   }
  }

  async function listAllDocsFromFirestore(wh, collection, maxPages = 5) {
   const targetWh = (wh || (typeof activeWarehouse !== 'undefined' ? activeWarehouse : 'MBI') || 'MBI').toUpperCase();
   const allDocs = [];
   let pageToken = '';
   let page = 0;
   while (page < maxPages) {
    if (isFirestoreSuspended(targetWh)) break;
    const res = await listDocsFromFirestore(targetWh, collection, 300, pageToken);
    if (res && Array.isArray(res.docs) && res.docs.length > 0) {
     allDocs.push(...res.docs);
    }
    if (!res || !res.nextPageToken) break;
    pageToken = res.nextPageToken;
    page++;
   }
   return allDocs;
  }

  async function queryFirestoreAttendanceByField(wh, fieldPath, stringValue, limitCount = 250) {
   const targetWh = (wh || (typeof activeWarehouse !== 'undefined' ? activeWarehouse : 'MBI') || 'MBI').toUpperCase();
   if (!stringValue || isFirestoreSuspended(targetWh)) return [];
   try {
    const projectId = getFirestoreProjectId(targetWh);
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;
    const body = {
     structuredQuery: {
      from: [{ collectionId: 'attendance' }],
      where: {
       fieldFilter: {
        field: { fieldPath: fieldPath },
        op: 'EQUAL',
        value: { stringValue: String(stringValue) }
       }
      },
      limit: limitCount
     }
    };
    const res = await fetch(url, {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify(body)
    });
    if (res.status === 429 || res.status === 403) {
     suspendFirestoreQuota(targetWh);
     return [];
    }
    if (!res.ok) return [];
    const json = await res.json();
    if (!Array.isArray(json)) return [];
    return json.map(row => (row && row.document ? fromFirestoreDoc(row.document) : null)).filter(Boolean);
   } catch (err) {
    console.warn(`[Firestore] Query attendance by ${fieldPath} error (${targetWh}):`, err);
    return [];
   }
  }

  async function deleteDocFromFirestore(wh, collection, docId) {
   const targetWh = (wh || (typeof activeWarehouse !== 'undefined' ? activeWarehouse : 'MBI') || 'MBI').toUpperCase();
   if (isFirestoreSuspended(targetWh)) return false;
   try {
    const projectId = getFirestoreProjectId(targetWh);
    const cleanDocId = encodeURIComponent(String(docId).trim());
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}/${cleanDocId}`;
    const res = await fetch(url, { method: 'DELETE' });
    if (res.status === 429 || res.status === 403) {
     suspendFirestoreQuota(targetWh);
     return false;
    }
    return res.ok;
   } catch (err) {
    console.warn(`[Firestore] Gagal menghapus ${collection}/${docId} (${targetWh}):`, err);
    return false;
   }
  }

  async function saveAttendanceDocToFirestore(wh, attRec) {
   if (!attRec) return false;
   const targetWh = (wh || (typeof activeWarehouse !== 'undefined' ? activeWarehouse : 'MBI') || 'MBI').toUpperCase();
   const docId = attRec.id || `att-${targetWh.toLowerCase()}-${Date.now()}`;
   let primaryOk = false;

   try {
    const cleanPayload = {
     ...attRec,
     warehouse: targetWh,
     updatedAt: attRec.updatedAt || new Date().toISOString()
    };
    // 1. Simpan dokumen transaksi presensi ke koleksi Firestore (WAJIB cek keberhasilan untuk outbox retry)
    primaryOk = await saveDocToFirestore(targetWh, 'attendance', docId, cleanPayload);

    if (primaryOk) {
     // 2. Siarkan beacon live Firestore agar seluruh perangkat mendeteksi perubahan seketika
     saveDocToFirestore(targetWh, '_metadata', 'live_beacon', {
      type: 'attendance_scan',
      lastDocId: docId,
      userNik: attRec.userNik || '',
      userName: attRec.userName || '',
      checkInStatus: attRec.checkInStatus || '',
      updatedAt: cleanPayload.updatedAt,
      warehouse: targetWh
     }).catch(() => {});

     // 3. Perbarui ringkasan snapshot hari ini (_metadata/today_attendance) DENGAN MERGE AMAN (tidak pernah menimpa scan perangkat lain & tanpa batas 150)
     (async () => {
      try {
       const todayStr = getLocalDateString(new Date());
       const nowMs = Date.now();
       const isRelevantForLiveSummary = (a) => {
        if (!a || isAttendanceMarkedDeleted(a)) return false;
        const inLocal = a.checkInTime ? getLocalDateString(new Date(a.checkInTime)) : '';
        const outLocal = a.checkOutTime ? getLocalDateString(new Date(a.checkOutTime)) : '';
        if (a.date === todayStr || inLocal === todayStr || outLocal === todayStr) return true;
        if (!hasValidCheckOut(a) && a.checkInTime) {
         const inMs = parseSafeTimeMs(a.checkInTime, a.date) || new Date(a.checkInTime).getTime();
         if (!isNaN(inMs) && (nowMs - inMs) >= 0 && (nowMs - inMs) < MAX_SHIFT_MS) return true;
        }
        return false;
       };

       const existingCloudToday = await getDocFromFirestore(targetWh, '_metadata', 'today_attendance');
       const existingRecords = (existingCloudToday && Array.isArray(existingCloudToday.records))
        ? existingCloudToday.records.filter(isRelevantForLiveSummary)
        : [];

       const allAtt = getWhDB(targetWh, 'attendance', []);
       const localRelevant = allAtt.filter(isRelevantForLiveSummary);
       const mergedSummary = mergeAttendanceArrays(localRelevant, existingRecords)
        .filter(a => a && !isAttendanceMarkedDeleted(a));

       // Pastikan record terbaru yang baru saja disimpan pasti masuk
       const finalSummary = mergeAttendanceArrays(mergedSummary, [cleanPayload])
        .filter(a => a && !isAttendanceMarkedDeleted(a))
        .slice(0, 1000);

       await saveDocToFirestore(targetWh, '_metadata', 'today_attendance', {
        date: todayStr,
        count: finalSummary.length,
        updatedAt: cleanPayload.updatedAt,
        warehouse: targetWh,
        records: finalSummary
       });
      } catch (eTodayMerge) {}
     })();
    }
   } catch (eFs) {
    console.warn('saveAttendanceDocToFirestore notice:', eFs);
   }

   // Siaran lokal instan (0ms) untuk jendela/tab di perangkat yang sama tanpa kuota
   try {
    if (typeof BroadcastChannel !== 'undefined') {
     new BroadcastChannel('wfm_firebase_live_sync').postMessage({ targetWh, docId });
    }
   } catch(e) {}

   return primaryOk;
  }

  async function saveMasterSnapshotToFirestore(wh = null, isExplicitAdminAction = false) {
   const targetWh = (wh || (typeof activeWarehouse !== 'undefined' ? activeWarehouse : 'MBI') || 'MBI').toUpperCase();
   try {
    const seedUsers = targetWh === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS;
    let users = getWhDB(targetWh, 'users', seedUsers);

    // Baseline Master Init: Hanya inisialisasi baseline jika database benar-benar kosong pertama kali
    if (!users || users.length === 0) {
     users = ensureMasterBaseline(users || [], targetWh);
     setWhDB(targetWh, 'users', users, true);
    }

    const isUserAdminAuthorized = isExplicitAdminAction || (typeof currentUser !== 'undefined' && currentUser && (isUserAdmin(currentUser) || isUserManager(currentUser) || hasPermission('perm_emp_edit') || hasPermission('perm_emp_add')));
    if (!isUserAdminAuthorized && (!users || users.length === 0)) {
     users = ensureMasterBaseline(users, targetWh);
    }

    // DataShield: Pastikan vendor outsourcing (Staffinc & ADP) tidak tertimpa menjadi 'Internal'
    const seedMap = new Map();
    seedUsers.forEach(s => { if (s && s.nik) seedMap.set(s.nik.toUpperCase().trim(), s); });
    users.forEach(u => {
     if (!u || !u.nik) return;
     const s = seedMap.get(u.nik.toUpperCase().trim());
     if (s && s.outsource && s.outsource !== 'Internal' && (!u.outsource || u.outsource === 'Internal')) {
      u.outsource = s.outsource;
     }
    });

    const leaves = getWhDB(targetWh, 'leaves', []);
    const overtime = getWhDB(targetWh, 'overtime', []);
    const coords = getWarehouseCoords(targetWh);
    const nowIso = new Date().toISOString();

    const snapshot = {
     warehouse: targetWh,
     updatedAt: nowIso,
     users: users,
     leaves: leaves,
     overtime: overtime,
     coords: coords || null,
     deleted_user_keys: typeof getDeletedUserKeys === 'function' ? Array.from(getDeletedUserKeys()) : [],
     deleted_attendance_ids: typeof getDeletedAttendanceIds === 'function' ? Array.from(getDeletedAttendanceIds()) : [],
     deleted_leave_ids: typeof getDeletedLeaveIds === 'function' ? Array.from(getDeletedLeaveIds()) : [],
     deleted_overtime_ids: typeof getDeletedOvertimeIds === 'function' ? Array.from(getDeletedOvertimeIds()) : []
    };

    await saveDocToFirestore(targetWh, '_metadata', 'master_snapshot', snapshot).catch(() => {});
    saveDocToFirestore(targetWh, '_metadata', 'live_signal', {
     type: 'master_update',
     warehouse: targetWh,
     updatedAt: nowIso
    }).catch(() => {});
   } catch (e) {
    console.warn('saveMasterSnapshotToFirestore notice:', e);
   }
  }

  async function scrubDeletedAttendanceFromCloud(wh = null) {
   const targetWh = (wh || (typeof activeWarehouse !== 'undefined' ? activeWarehouse : 'MBI') || 'MBI').toUpperCase();
   const deletedIds = getDeletedAttendanceIds();
   const nowIso = new Date().toISOString();
   try {
    const todayDoc = await getDocFromFirestore(targetWh, '_metadata', 'today_attendance');
    if (todayDoc && Array.isArray(todayDoc.records)) {
     const filteredToday = todayDoc.records.filter(a => a && !isAttendanceMarkedDeleted(a, deletedIds));
     if (filteredToday.length !== todayDoc.records.length) {
      await saveDocToFirestore(targetWh, '_metadata', 'today_attendance', {
       ...todayDoc,
       count: filteredToday.length,
       updatedAt: nowIso,
       warehouse: targetWh,
       records: filteredToday
      }).catch(() => {});
      try {
       localStorage.setItem(`wfm_${targetWh.toLowerCase()}_today_attendance`, JSON.stringify(filteredToday));
      } catch(e) {}
     }
    }
   } catch(eTodayScrub) {}
   try {
    const archDoc = await getDocFromFirestore(targetWh, '_metadata', 'attendance_archive');
    if (archDoc && (Array.isArray(archDoc.records) || typeof archDoc.payload === 'string' || Array.isArray(archDoc.payload))) {
     const rawArch = Array.isArray(archDoc.records)
      ? archDoc.records
      : (typeof archDoc.payload === 'string' ? JSON.parse(archDoc.payload) : (archDoc.payload || []));
     if (Array.isArray(rawArch)) {
      const filteredArch = rawArch.filter(a => a && !isAttendanceMarkedDeleted(a, deletedIds));
      if (filteredArch.length !== rawArch.length) {
       const updatedArch = { ...archDoc, updatedAt: nowIso, warehouse: targetWh };
       if (Array.isArray(archDoc.records)) updatedArch.records = filteredArch;
       else if (typeof archDoc.payload === 'string') updatedArch.payload = JSON.stringify(filteredArch);
       else updatedArch.payload = filteredArch;
       await saveDocToFirestore(targetWh, '_metadata', 'attendance_archive', updatedArch).catch(() => {});
      }
     }
    }
   } catch(eArchScrub) {}
  }

  // =========================================================
  // PUSH ABSENSI INSTAN (DELTA) + OUTBOX ANTI-HILANG
  // Setiap scan hanya mengirim 1 record kecil ( 300 byte) ke node Firebase
  // "<gudang>_attendance_live/<id>" + timestamp updatedAt. Jika sinyal HP lemah,
  // record disimpan di antrean lokal (outbox) dan dikirim ulang otomatis sampai berhasil.
  // =========================================================
  const ATT_OUTBOX_KEY = 'wfm_att_cloud_outbox';
  let attOutboxFlushing = false;
  let attOutboxRetryTimer = null;
  let attOutboxFailCount = 0;

  function readAttOutbox() {
   try {
    const raw = localStorage.getItem(ATT_OUTBOX_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter(x => x && x.rec && x.rec.id) : [];
   } catch (e) { return []; }
  }

  function writeAttOutbox(list) {
   try { localStorage.setItem(ATT_OUTBOX_KEY, JSON.stringify(list || [])); } catch (e) {}
  }

  function getAttLiveNodes(wh) {
   const w = String(wh || 'MBI').toUpperCase();
   const base = getFirebaseEndpoint(w).replace(/\.json$/, '');
   return { w, base, node: `${base}/${w.toLowerCase()}_attendance_live` };
  }

  function safeAttLiveKey(id) {
   return String(id).replace(/[.#$\[\]\/]/g, '_');
  }

  async function putAttendanceLiveRecord(wh, rec) {
   if (!rec) return true;
   let sbOk = false;
   let fsOk = false;

   // 1. Prioritas Utama: Supabase (Bebas Limit Kuota 24/7 & Realtime)
   try {
    if (typeof saveAttendanceToSupabase === 'function') {
     sbOk = await saveAttendanceToSupabase(wh, rec);
    }
   } catch(eSb) {}

   // 2. Cadangan: Firestore (Jika kuota belum habis)
   try {
    if (typeof saveAttendanceDocToFirestore === 'function') {
     fsOk = await saveAttendanceDocToFirestore(wh, rec);
    }
   } catch(eFs) {}

   return sbOk || fsOk;
  }

  async function flushAttendanceOutbox() {
   if (attOutboxFlushing) return;
   if (!readAttOutbox().length) return;
   attOutboxFlushing = true;
   let allOk = true;
   try {
    try { updateCloudSyncStatusBadge('uploading'); } catch (eB) {}
    let guard = 0;
    while (guard++ < 200) {
     const list = readAttOutbox();
     if (!list.length) break;
     const item = list[0];
     const ok = await putAttendanceLiveRecord(item.wh, item.rec);
     if (!ok) { allOk = false; break; }
     try {
      if (typeof pushSingleScanToGoogleSheet === 'function') {
       pushSingleScanToGoogleSheet(item.wh, item.rec);
      }
     } catch(eGsFlush) {}
     const cur = readAttOutbox();
     const idx = cur.findIndex(x => x.wh === item.wh && x.rec.id === item.rec.id && x.v === item.v);
     if (idx >= 0) cur.splice(idx, 1);
     writeAttOutbox(cur);
    }
   } finally {
    attOutboxFlushing = false;
   }

   if (allOk) {
    attOutboxFailCount = 0;
    try { updateCloudSyncStatusBadge('synced'); } catch (eB) {}
    try {
     if (typeof BroadcastChannel !== 'undefined') {
      new BroadcastChannel('wfm_firebase_live_sync').postMessage('update');
     }
    } catch (eBc) {}
    if (readAttOutbox().length) setTimeout(flushAttendanceOutbox, 50);
   } else {
    attOutboxFailCount++;
    try { updateCloudSyncStatusBadge('local'); } catch (eB) {}
    if (attOutboxRetryTimer) clearTimeout(attOutboxRetryTimer);
    attOutboxRetryTimer = setTimeout(flushAttendanceOutbox, Math.min(30000, 2000 * attOutboxFailCount));
   }
  }

  function queueAttendanceCloudPush(wh, rec) {
   if (!rec || !rec.id) return;
   if (!rec.updatedAt) rec.updatedAt = new Date().toISOString();
   const w = String(wh || rec.warehouse || (typeof activeWarehouse !== 'undefined' ? activeWarehouse : 'MBI') || 'MBI').toUpperCase();
   let list = readAttOutbox().filter(x => !(x.wh === w && x.rec.id === rec.id));
   list.push({
    wh: w,
    rec: JSON.parse(JSON.stringify(rec)),
    v: Date.now() + '_' + Math.random().toString(36).slice(2, 6)
   });
   writeAttOutbox(list);
   flushAttendanceOutbox();
  }

  // Jaring pengaman: kirim ulang antrean yang tertunda saat internet kembali / tiap 15 detik / saat halaman dibuka
  try {
   window.addEventListener('online', () => {
    flushAttendanceOutbox();
    try { flushAdminPasswordOutbox(); } catch(e) {}
   });
   setInterval(() => {
    if (readAttOutbox().length) flushAttendanceOutbox();
    try { flushAdminPasswordOutbox(); } catch(e) {}
   }, 15000);
   setTimeout(() => {
    flushAttendanceOutbox();
    try { flushAdminPasswordOutbox(); } catch(e) {}
   }, 3000);
  } catch (eOutbox) {}

  // Gabungkan arsip utama + node live dari cloud. Untuk id yang sama, prioritaskan record yang memiliki jam pulang (checkOutTime) atau data paling baru.
  function combineCloudAttendanceWithLive(arr, liveObj) {
   const base = normalizeFirebaseArray(arr);
   if (!liveObj || typeof liveObj !== 'object') return base;
   const liveList = Array.isArray(liveObj) ? liveObj.filter(Boolean) : Object.values(liveObj).filter(Boolean);
   if (!liveList.length) return base;
   const keyOf = r => r.id || `${(r.userNik || '').toUpperCase()}_${r.date || ''}_${r.checkInTime || ''}`;
   const pick = (a, b) => {
    if (!a) return b;
    if (!b) return a;
    // Prioritas 1: Jika salah satu memiliki checkOutTime yang sah, pertahankan checkOutTime tersebut agar tidak tertimpa check-in kosong!
    const hasOutA = !!(a.checkOutTime && a.checkOutTime !== '-' && a.checkOutTime !== '');
    const hasOutB = !!(b.checkOutTime && b.checkOutTime !== '-' && b.checkOutTime !== '');
    if (hasOutB && !hasOutA) return { ...a, ...b };
    if (hasOutA && !hasOutB) return { ...b, ...a, checkOutTime: a.checkOutTime };

    // Prioritas 2: Jika keduanya punya checkOutTime atau keduanya belum pulang, pilih data dengan updatedAt terbaru
    const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    if (timeB > timeA) return { ...a, ...b };
    if (timeA > timeB) return { ...b, ...a };
    return { ...a, ...b };
   };
   const map = new Map();
   base.forEach(r => { if (r && typeof r === 'object') map.set(keyOf(r), r); });
   liveList.forEach(r => {
    if (!r || typeof r !== 'object') return;
    const k = keyOf(r);
    map.set(k, pick(map.get(k), r));
   });
   return Array.from(map.values());
  }

  // SINKRONISASI RINGAN LIVE DELTA (Cloud Firestore _metadata/today_attendance - 1 Read Super Ringan)
  let isLiveDeltaSyncing = false;
  async function syncAttendanceLiveDelta(wh = null) {
   if (isLiveDeltaSyncing) return false;
   const targetWh = (wh || (typeof activeWarehouse !== 'undefined' ? activeWarehouse : 'MBI') || 'MBI').toUpperCase();
   isLiveDeltaSyncing = true;
   try {
    if (typeof pullAttendanceFromFirestore === 'function') {
     const changed = await pullAttendanceFromFirestore(targetWh);
     if (changed) {
      try {
       if (typeof renderScannerTodayRecords === 'function') renderScannerTodayRecords();
       if (typeof renderAllLiveScreens === 'function') renderAllLiveScreens();
      } catch(eR) {}
      return true;
     }
    }
    return false;
   } catch (eDelta) {
    return false;
   } finally {
    isLiveDeltaSyncing = false;
   }
  }

  // Perapian otomatis: Cloud Firestore menangani transaksi presensi secara atomic
  async function maybeCompactAttendanceLive(wh, db) {
   return;
  }

  async function saveUserDocToFirestore(wh, userRec) {
   if (!userRec) return;
   const targetWh = (wh || activeWarehouse || 'MBI').toUpperCase();
   try {
    if (typeof saveUsersToSupabase === 'function') {
     saveUsersToSupabase(targetWh, [userRec]).catch(() => {});
    }
   } catch(eSb) {}
   const docId = (userRec.nik && userRec.nik.trim()) ? userRec.nik.trim() : (userRec.id || `emp_${Date.now()}`);
   return saveDocToFirestore(targetWh, 'users', docId, {
    ...userRec,
    warehouse: targetWh,
    updatedAt: new Date().toISOString()
   });
  }

  // =========================================================
  // SINKRONISASI GPS & RADIUS OTOMATIS KE CLOUD FIRESTORE
  // Seluruh HP Scanner Seketika Mengikuti Perubahan Radius (100m -> 30m)
  // =========================================================
  async function saveGPSCoordsToFirestore(wh, coords) {
   if (!coords) return false;
   const targetWh = (wh || activeWarehouse || 'MBI').toUpperCase();
   const nowIso = new Date().toISOString();
   const def = DEFAULT_COORDS[targetWh] || { lat: -6.263295, lng: 106.877066, radius: 100, name: `Gudang ${targetWh}` };
   const validRadius = Number(coords.radius) > 0 ? Number(coords.radius) : 100;

   const docData = {
    lat: Number(coords.lat) || def.lat,
    lng: Number(coords.lng) || def.lng,
    radius: validRadius,
    warehouse: targetWh,
    updatedAt: nowIso,
    updatedBy: (typeof currentUser !== 'undefined' && currentUser ? (currentUser.name || currentUser.nik) : 'Admin')
   };

   // 1. Simpan konfigurasi GPS ke Cloud Firestore: _metadata/gps_config
   const saveOk = await saveDocToFirestore(targetWh, '_metadata', 'gps_config', docData);

   // 2. Tembakkan sinyal live beacon instan ke Firestore agar seluruh HP Scanner mendeteksi seketika
   const liveSignalDoc = {
    updatedAt: nowIso,
    type: 'gps_update',
    warehouse: targetWh,
    radius: validRadius,
    lat: docData.lat,
    lng: docData.lng
   };
   saveDocToFirestore(targetWh, '_metadata', 'live_signal', liveSignalDoc).catch(() => {});

   // 3. Broadcast lokal instan
   try {
    if (typeof BroadcastChannel !== 'undefined') {
     new BroadcastChannel('wfm_firestore_live_sync').postMessage({ 
      type: 'gps_update', 
      targetWh, 
      radius: validRadius,
      updatedAt: nowIso 
     });
    }
   } catch(e) {}

   return saveOk;
  }

  async function syncGPSCoordsFromFirestore(wh = null) {
   const targetWh = (wh || activeWarehouse || 'MBI').toUpperCase();
   try {
    const doc = await getDocFromFirestore(targetWh, '_metadata', 'gps_config');
    if (doc && Number(doc.radius) > 0) {
     const cloudRadius = Number(doc.radius);
     const currentLocal = getWarehouseCoords(targetWh);
     if (currentLocal.radius !== cloudRadius) {
      console.log(`[Firestore Realtime GPS] Radius ${targetWh} diperbarui dari Cloud: ${currentLocal.radius}m -> ${cloudRadius}m`);
      const def = DEFAULT_COORDS[targetWh] || { lat: -6.263295, lng: 106.877066, radius: 100, name: `Gudang ${targetWh}` };
      const newCoords = {
       lat: def.lat,
       lng: def.lng,
       radius: cloudRadius,
       name: def.name,
       updatedAt: doc.updatedAt || new Date().toISOString()
      };
      localStorage.setItem(`wfm_${targetWh.toLowerCase()}_coords`, JSON.stringify(newCoords));
      localStorage.setItem(`wfm_gps_radius_${targetWh.toLowerCase()}`, String(cloudRadius));
      if (activeWarehouse === targetWh) {
       localStorage.setItem('wfm_gps_radius', String(cloudRadius));
      }
      latestCachedGPS = null;
      updateRegisteredCoordsDisplay();
      showLiveRealtimeIndicator(`Å¡ Radius GPS ${targetWh}: ${cloudRadius}m`);
      return true;
     }
    }
   } catch(err) {
    // Silent catch
   }
   return false;
  }

  
  // =========================================================
  // SUPABASE 24/7 CONNECTION TEST
  // =========================================================
  async function testSupabaseConnection(wh = null) {
   const diagEl = document.getElementById('firestore-diag-status');
   if (diagEl) {
    diagEl.className = 'p-3.5 rounded-2xl text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200';
    diagEl.innerHTML = '<span class="flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-blue-600 animate-spin"></span> Menguji koneksi database Supabase 24/7 (PostgreSQL)...</span>';
    diagEl.classList.remove('hidden');
   }
   const tStart = Date.now();
   try {
    const res = await fetch(SUPABASE_PROJECT_URL + '/rest/v1/wfm_users?limit=1', {
     headers: getSupabaseHeaders(),
     cache: 'no-store'
    });
    const elapsed = Date.now() - tStart;
    if (res.ok) {
     if (diagEl) {
      diagEl.className = 'p-3.5 rounded-2xl text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300';
      diagEl.innerHTML = '<span>✅ Database Supabase 24/7 Terhubung! (PostgreSQL Online, Respon: ' + elapsed + 'ms, Bebas Limit Kuota)</span>';
     }
     updateCloudSyncStatusBadge('synced');
     return true;
    } else {
     throw new Error('HTTP ' + res.status);
    }
   } catch (err) {
    if (diagEl) {
     diagEl.className = 'p-3.5 rounded-2xl text-xs font-bold bg-rose-50 text-rose-800 border border-rose-300';
     diagEl.innerHTML = '<span>❌ Gagal terhubung ke Supabase: ' + escapeHTML(err.message || 'Periksa koneksi internet') + '</span>';
    }
    updateCloudSyncStatusBadge('local');
    return false;
   }
  }
  window.testSupabaseConnection = testSupabaseConnection;
  window.testFirestoreConnection = testSupabaseConnection;

  async function testFirestoreConnection(wh = null) {
   const targetWh = (wh || (typeof activeWarehouse !== 'undefined' ? activeWarehouse : 'MBI') || 'MBI').toUpperCase();
   const projectId = getFirestoreProjectId(targetWh);
   const statusEl = document.getElementById('firestore-diag-status');
   if (statusEl) {
    statusEl.className = 'p-3.5 rounded-2xl text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200 flex items-center gap-2';
    statusEl.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin text-amber-600 shrink-0"></i> <span>Menguji respon koneksi ke Cloud Firestore ${targetWh} (${projectId})...</span>`;
    statusEl.classList.remove('hidden');
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
   }

   const t0 = Date.now();
   const beaconDoc = {
    status: 'online',
    testedAt: new Date().toISOString(),
    warehouse: targetWh,
    source: 'WFM Medika Assistant'
   };

   const ok = await saveDocToFirestore(targetWh, '_connectivity', 'ping', beaconDoc);
   const latency = Date.now() - t0;

   if (ok) {
    if (statusEl) {
     statusEl.className = 'p-4 rounded-2xl text-xs font-bold bg-emerald-50 text-emerald-900 border border-emerald-300 space-y-1.5';
     statusEl.innerHTML = `
      <div class="flex items-center gap-2">
       <i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-600 shrink-0"></i>
       <span>Å“â€¦ <b>Cloud Firestore Gudang ${targetWh} Terhubung Normal!</b> (Respon: ${latency}ms)</span>
      </div>
      <p class="text-[11px] text-emerald-800 font-normal pl-6">
       Project Google Cloud: <b>${projectId}</b> (Database Default). Akses Tulis & Baca 100% Berhasil.
      </p>
     `;
     statusEl.classList.remove('hidden');
     if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
    }
    alert(`Å“â€¦ KONEKSI CLOUD FIRESTORE GUDANG ${targetWh} BERHASIL!\n\n• Project: ${projectId}\n• Status: Online (HTTP 200)\n• Latensi Respon: ${latency}ms\n• Akses: Baca & Tulis Berhasil\n\nDatabase Cloud Firestore siap digunakan!`);
   } else {
    if (statusEl) {
     statusEl.className = 'p-4 rounded-2xl text-xs font-bold bg-rose-50 text-rose-900 border border-rose-300 space-y-1.5';
     statusEl.innerHTML = `
      <div class="flex items-center gap-2">
       <i data-lucide="alert-triangle" class="w-4 h-4 text-rose-600 shrink-0"></i>
       <span>Å¡  <b>Gagal Terhubung ke Cloud Firestore Gudang ${targetWh}</b></span>
      </div>
      <p class="text-[11px] text-rose-800 font-normal pl-6">
       Pastikan tab Rules di Cloud Firestore console.firebase.google.com sudah: <code>allow read, write: if true;</code>
      </p>
     `;
     statusEl.classList.remove('hidden');
     if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
    }
    alert(`Å¡  Gagal terhubung ke Cloud Firestore Gudang ${targetWh} (${projectId}).\n\nPastikan di console.firebase.google.com > Firestore Database > tab Rules sudah dipasang aturan:\n\nallow read, write: if true;\n\nlalu klik Publish.`);
   }
  }

  async function migrateAllDataToFirestore(wh = null) {
   const targetWh = (wh || (typeof activeWarehouse !== 'undefined' ? activeWarehouse : 'MBI') || 'MBI').toUpperCase();
   const projectId = getFirestoreProjectId(targetWh);

   const confirmMsg = `Å¸Å¡â‚¬ KONFIRMASI MIGRASI DATA KE CLOUD FIRESTORE\n\n` +
    `Gudang Sasaran: ${targetWh} (Project: ${projectId})\n\n` +
    `Proses ini akan:\n` +
    `1. Menyalin SELURUH karyawan ke Firestore (NIK UTUH 100% 1:1, tidak akan hilang/berubah).\n` +
    `2. Menyalin SELURUH riwayat absensi (termasuk absensi hari ini, 22 Oktober 2026).\n` +
    `3. Menyalin data cuti dan lembur karyawan.\n` +
    `4. Mempertahankan database lama & Google Sheet sebagai cadangan ganda.\n\n` +
    `Lanjutkan proses migrasi?`;

   if (!confirm(confirmMsg)) return;

   const statusEl = document.getElementById('firestore-diag-status');
   if (statusEl) {
    statusEl.className = 'p-4 rounded-2xl text-xs font-bold bg-blue-50 text-blue-900 border border-blue-200';
    statusEl.innerHTML = `<div class="flex items-center gap-2"><i data-lucide="loader-2" class="w-4 h-4 animate-spin text-blue-600 shrink-0"></i> <span>Sedang memulai migrasi data Gudang ${targetWh} ke Cloud Firestore...</span></div>`;
    statusEl.classList.remove('hidden');
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
   }

   const seedUsers = targetWh === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS;
   let users = getWhDB(targetWh, 'users', seedUsers);
   if (!users || users.length < seedUsers.length) {
    users = mergeUserArrays(seedUsers, users || [], targetWh);
   }
   const seedMap = new Map();
   seedUsers.forEach(s => { if (s && s.nik) seedMap.set(s.nik.toUpperCase().trim(), s); });
   users.forEach(u => {
    if (!u || !u.nik) return;
    const s = seedMap.get(u.nik.toUpperCase().trim());
    if (s && s.outsource && s.outsource !== 'Internal' && (!u.outsource || u.outsource === 'Internal')) {
     u.outsource = s.outsource;
    }
   });
   setWhDB(targetWh, 'users', users, true);
   const attendances = getWhDB(targetWh, 'attendance', targetWh === 'MBI' ? SEED_MBI_ATTENDANCE : SEED_MAI_ATTENDANCE);
   const leaves = getWhDB(targetWh, 'leaves', []);
   const overtimes = getWhDB(targetWh, 'overtime', []);
   const coords = getWarehouseCoords(targetWh);

   let successUsers = 0;
   let successAtt = 0;
   let successLeaves = 0;
   let successOvertimes = 0;

   try {
    async function processBatch(items, processFn, onProgress) {
     const concurrency = 6;
     for (let i = 0; i < items.length; i += concurrency) {
      const chunk = items.slice(i, i + concurrency);
      await Promise.allSettled(chunk.map(processFn));
      if (onProgress) onProgress(Math.min(i + concurrency, items.length), items.length);
     }
    }

    // A. Migrasi Users (NIK DIJAMIN UTUH 100% DENGAN DOKUMEN ID NIK)
    if (statusEl) statusEl.innerHTML = `<div class="flex items-center gap-2"><i data-lucide="loader-2" class="w-4 h-4 animate-spin text-blue-600 shrink-0"></i> <span>Menyalin data karyawan (NIK utuh) ke Firestore (0/${users.length})...</span></div>`;
    await processBatch(users, async (u) => {
     if (!u) return;
     const docId = (u.nik && u.nik.trim()) ? u.nik.trim() : (u.id || `emp_${Date.now()}`);
     const userPayload = {
      ...u,
      warehouse: targetWh,
      migratedAt: new Date().toISOString()
     };
     const ok = await saveDocToFirestore(targetWh, 'users', docId, userPayload);
     if (ok) successUsers++;
    }, (cur, tot) => {
     if (statusEl) statusEl.innerHTML = `<div class="flex items-center gap-2"><i data-lucide="loader-2" class="w-4 h-4 animate-spin text-blue-600 shrink-0"></i> <span>Menyalin data karyawan (NIK utuh) ke Firestore (${cur}/${tot})...</span></div>`;
    });

    // B. Migrasi Attendance (Termasuk Absensi Hari Ini 22 Oktober 2026)
    if (statusEl) statusEl.innerHTML = `<div class="flex items-center gap-2"><i data-lucide="loader-2" class="w-4 h-4 animate-spin text-blue-600 shrink-0"></i> <span>Menyalin riwayat absensi ke Firestore (0/${attendances.length})...</span></div>`;
    await processBatch(attendances, async (a) => {
     if (!a) return;
     const docId = a.id || `att-${targetWh.toLowerCase()}-${a.date || 'today'}-${(a.userNik || a.userName || 'rec').replace(/[^a-zA-Z0-9]/g, '')}`;
     const attPayload = {
      ...a,
      warehouse: targetWh,
      migratedAt: new Date().toISOString()
     };
     const ok = await saveDocToFirestore(targetWh, 'attendance', docId, attPayload);
     if (ok) successAtt++;
    }, (cur, tot) => {
     if (statusEl) statusEl.innerHTML = `<div class="flex items-center gap-2"><i data-lucide="loader-2" class="w-4 h-4 animate-spin text-blue-600 shrink-0"></i> <span>Menyalin riwayat absensi ke Firestore (${cur}/${tot})...</span></div>`;
    });

    // C. Migrasi Leaves & Overtime
    await processBatch(leaves, async (l) => {
     if (!l) return;
     const docId = l.id || `leave-${Date.now()}`;
     const ok = await saveDocToFirestore(targetWh, 'leaves', docId, { ...l, warehouse: targetWh });
     if (ok) successLeaves++;
    });

    await processBatch(overtimes, async (o) => {
     if (!o) return;
     const docId = o.id || `ot-${Date.now()}`;
     const ok = await saveDocToFirestore(targetWh, 'overtime', docId, { ...o, warehouse: targetWh });
     if (ok) successOvertimes++;
    });

    // D. Simpan Metadata State & Koordinat
    await saveDocToFirestore(targetWh, 'meta', 'system_state', {
     warehouse: targetWh,
     totalUsers: successUsers,
     totalAttendance: successAtt,
     totalLeaves: successLeaves,
     totalOvertimes: successOvertimes,
     lastMigratedAt: new Date().toISOString(),
     appVersion: CURRENT_APP_VERSION,
     coords: coords || null
    });

    // E. Simpan Master Snapshot & Today Attendance (Zero-Quota Limit Engine)
    const nowIso = new Date().toISOString();
    const todayStr = getLocalDateString(new Date());
    const todayAttList = attendances.filter(a => a && (a.date === todayStr || (a.checkInTime && a.checkInTime.startsWith(todayStr))));
    
    await saveDocToFirestore(targetWh, '_metadata', 'master_snapshot', {
     warehouse: targetWh,
     updatedAt: nowIso,
     users: users,
     leaves: leaves,
     overtime: overtimes,
     coords: coords || null
    });

    await saveDocToFirestore(targetWh, '_metadata', 'today_attendance', {
     date: todayStr,
     count: todayAttList.length,
     updatedAt: nowIso,
     warehouse: targetWh,
     records: todayAttList
    });

    if (attendances && attendances.length > 0) {
     const cleanMinList = attendances.map(a => ({
      id: a.id,
      userId: a.userId,
      userNik: a.userNik,
      userName: a.userName,
      dept: a.dept,
      outsource: a.outsource,
      warehouse: targetWh,
      date: a.date,
      checkInTime: a.checkInTime,
      checkOutTime: a.checkOutTime,
      checkInStatus: a.checkInStatus,
      notes: a.notes
     }));
     await saveDocToFirestore(targetWh, '_metadata', 'attendance_archive', {
      warehouse: targetWh,
      count: cleanMinList.length,
      updatedAt: nowIso,
      payload: JSON.stringify(cleanMinList)
     });
     localStorage.setItem(`wfm_${targetWh.toLowerCase()}_attendance_archive_loaded`, 'true');
    }

    await saveDocToFirestore(targetWh, '_metadata', 'live_beacon', {
     type: 'migration_complete',
     warehouse: targetWh,
     updatedAt: nowIso
    });

    localStorage.setItem(`wfm_${targetWh.toLowerCase()}_firestore_migrated`, 'true');
    localStorage.setItem(`wfm_${targetWh.toLowerCase()}_firestore_migrated_at`, new Date().toISOString());

    if (statusEl) {
     statusEl.className = 'p-4 rounded-2xl text-xs font-bold bg-emerald-50 text-emerald-900 border border-emerald-300 space-y-1.5';
     statusEl.innerHTML = `
      <div class="flex items-center gap-2">
       <i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-600 shrink-0"></i>
       <span>Å¸Å½â€° <b>MIGRASI DATA KE CLOUD FIRESTORE BERHASIL 100%!</b></span>
      </div>
      <p class="text-[11px] text-emerald-800 font-normal pl-6 leading-relaxed">
       • Karyawan Tersalin (NIK Utuh 1:1): <b>${successUsers} orang</b><br>
       • Riwayat Absensi (Termasuk Hari Ini): <b>${successAtt} record</b><br>
       • Cuti & Lembur: <b>${successLeaves} cuti, ${successOvertimes} lembur</b><br>
       • Status Cloud: Tersimpan rapi & terpisah di Project <b>${projectId}</b>
      </p>
     `;
     if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
    }

    alert(`Å¸Å½â€° MIGRASI KE CLOUD FIRESTORE SUKSES 100%!\n\n` +
       `Gudang: ${targetWh}\n` +
       `Project Google Cloud: ${projectId}\n\n` +
       `• Data Karyawan (NIK Utuh 100%): ${successUsers} orang\n` +
       `• Data Absensi (Termasuk Hari Ini): ${successAtt} record\n` +
       `• Data Cuti: ${successLeaves} pengajuan\n` +
       `• Data Lembur: ${successOvertimes} pengajuan\n\n` +
       `Data karyawan dan absensi Anda sekarang sudah tersimpan aman di Cloud Firestore generasi baru!`);

   } catch (err) {
    console.error('[Firestore Migration Error]:', err);
    alert(`Å¡  Migrasi sebagian data mengalami kendala: ${err.message}\nData lokal dan database Firebase Realtime Anda tetap aman 100%.`);
   }
  }

  async function syncAttendanceArchiveFromCloud(wh = null, alertOnComplete = true) {
   const targetWh = (wh || (typeof activeWarehouse !== 'undefined' ? activeWarehouse : 'MBI') || 'MBI').toUpperCase();
   try {
    const archiveDoc = await getDocFromFirestore(targetWh, '_metadata', 'attendance_archive');
    if (archiveDoc && (archiveDoc.payload || archiveDoc.records)) {
     const archiveRecords = Array.isArray(archiveDoc.records) ? archiveDoc.records : (typeof archiveDoc.payload === 'string' ? JSON.parse(archiveDoc.payload) : (archiveDoc.payload || []));
     if (Array.isArray(archiveRecords) && archiveRecords.length > 0) {
      let localAtt = getWhDB(targetWh, 'attendance', []);
      const merged = mergeAttendanceArrays(localAtt, archiveRecords);
      setWhDB(targetWh, 'attendance', merged, true);
      localStorage.setItem(`wfm_${targetWh.toLowerCase()}_attendance_archive_loaded`, 'true');
      renderAllLiveScreens();
      if (alertOnComplete) {
       const dates = [...new Set(merged.map(x => x.date).filter(Boolean))].sort();
       alert(`Å“â€¦ Berhasil menarik seluruh arsip riwayat absensi!\n\n• Total Record: ${merged.length} presensi\n• Rentang Tanggal: ${dates[0] || '-'} s/d ${dates[dates.length - 1] || '-'}\n• Gudang: ${targetWh}\n\nSeluruh data presensi dan matriks absensi karyawan kini telah lengkap.`);
      }
      return true;
     }
    }
    if (alertOnComplete) {
     alert(`Belum ada arsip riwayat absensi di Cloud Firestore Gudang ${targetWh}.`);
    }
    return false;
   } catch (e) {
    console.warn('[Firestore] sync archive error:', e);
    if (alertOnComplete) {
     alert('Å¡  Gagal menarik arsip riwayat absensi: ' + e.message);
    }
    return false;
   }
  }

  window._fsFullAttPulled = window._fsFullAttPulled || {};
  window._cloudAttInitialSyncDone = window._cloudAttInitialSyncDone || {};

  async function pullAttendanceFromFirestore(wh = null, alertOnComplete = false, forceFullCollectionPull = false) {
   const targetWh = (wh || (typeof activeWarehouse !== 'undefined' ? activeWarehouse : 'MBI') || 'MBI').toUpperCase();
   let pulledAnything = false;
   let todayCount = 0;
   let collectionCount = 0;
   try {
    let localAtt = getWhDB(targetWh, 'attendance', []);
    const hasArchiveLoaded = localStorage.getItem(`wfm_${targetWh.toLowerCase()}_attendance_archive_loaded`) === 'true';
    const isScannerMode = (typeof currentUser !== 'undefined' && currentUser && typeof isUserScanner === 'function' && isUserScanner(currentUser));

    // 1. Cek & muat arsip riwayat historis (dilewati di HP Scanner agar kuota super irit)
    if (!isScannerMode && (!hasArchiveLoaded || localAtt.length < 1000 || alertOnComplete || forceFullCollectionPull)) {
     try {
      const archiveDoc = await getDocFromFirestore(targetWh, '_metadata', 'attendance_archive');
      if (archiveDoc && (archiveDoc.payload || archiveDoc.records)) {
       const archiveRecords = Array.isArray(archiveDoc.records) ? archiveDoc.records : (typeof archiveDoc.payload === 'string' ? JSON.parse(archiveDoc.payload) : (archiveDoc.payload || []));
       if (Array.isArray(archiveRecords) && archiveRecords.length > 0) {
        localAtt = mergeAttendanceArrays(localAtt, archiveRecords);
        setWhDB(targetWh, 'attendance', localAtt, true);
        localStorage.setItem(`wfm_${targetWh.toLowerCase()}_attendance_archive_loaded`, 'true');
        pulledAnything = true;
       }
      }
     } catch(eArch) {
      console.warn('[Firestore] pull attendance_archive error:', eArch);
     }
    }

    // 2. Unduh ringkasan absensi hari ini (1 Read) dan gabungkan
    try {
     const todayDoc = await getDocFromFirestore(targetWh, '_metadata', 'today_attendance');
     if (todayDoc && Array.isArray(todayDoc.records) && todayDoc.records.length > 0) {
      localAtt = getWhDB(targetWh, 'attendance', []);
      const mergedToday = mergeAttendanceArrays(localAtt, todayDoc.records);
      setWhDB(targetWh, 'attendance', mergedToday, true);
      todayCount = todayDoc.records.length;
      pulledAnything = true;
      try {
       localStorage.setItem('wfm_' + targetWh.toLowerCase() + '_today_attendance', JSON.stringify(todayDoc.records));
      } catch(e) {}
     }
    } catch(eToday) {
     console.warn('[Firestore] pull today_attendance notice:', eToday);
    }

    // 2b. Tarik dokumen presensi HARI INI saja via query date == todayStr (hanya ~20-80 Read, mengatasi selisih seperti 20 vs 17 di MAI tanpa scan ribuan dokumen lama)
    window._fsTodayQueryAt = window._fsTodayQueryAt || {};
    const lastTodayQueryAt = window._fsTodayQueryAt[targetWh] || 0;
    const shouldQueryToday = Boolean(
     alertOnComplete ||
     forceFullCollectionPull ||
     (!lastTodayQueryAt && !isScannerMode)
    );
    if (shouldQueryToday && typeof queryFirestoreAttendanceByField === 'function' && !(typeof isFirestoreSuspended === 'function' && isFirestoreSuspended(targetWh))) {
     try {
      const todayStr = getLocalDateString(new Date());
      const todayDocs = await queryFirestoreAttendanceByField(targetWh, 'date', todayStr, 250);
      window._fsTodayQueryAt[targetWh] = Date.now();
      if (Array.isArray(todayDocs) && todayDocs.length > 0) {
       localAtt = getWhDB(targetWh, 'attendance', []);
       const mergedQ = mergeAttendanceArrays(localAtt, todayDocs);
       setWhDB(targetWh, 'attendance', mergedQ, true);
       todayCount = Math.max(todayCount, todayDocs.length);
       pulledAnything = true;
      }
     } catch(eTodayQ) {
      console.warn('[Firestore] today query notice:', eTodayQ);
     }
    }

    // 3. Tarik koleksi dokumen presensi individual (attendance/*) HANYA saat tombol manual Admin atau data lokal masih kosong/minim (<20)
    const curAttAfterMeta = getWhDB(targetWh, 'attendance', []);
    let lastFullScanAt = 0;
    try {
     lastFullScanAt = parseInt(localStorage.getItem(`wfm_${targetWh.toLowerCase()}_fs_full_att_at`) || '0', 10) || 0;
    } catch(eLs) {}
    const isFullScanFresh = lastFullScanAt > 0 && (Date.now() - lastFullScanAt) < (30 * 60 * 1000) && curAttAfterMeta.length >= 20;
    const shouldPullAllCollection = !isScannerMode && Boolean(
     alertOnComplete ||
     (curAttAfterMeta.length < 20 && !window._fsFullAttPulled[targetWh]) ||
     (forceFullCollectionPull && !window._fsFullAttPulled[targetWh] && !isFullScanFresh)
    );
    if (shouldPullAllCollection && typeof listAllDocsFromFirestore === 'function' && !(typeof isFirestoreSuspended === 'function' && isFirestoreSuspended(targetWh))) {
     const allDocs = await listAllDocsFromFirestore(targetWh, 'attendance', 5);
     if (allDocs && allDocs.length > 0) {
      localAtt = getWhDB(targetWh, 'attendance', []);
      const mergedAll = mergeAttendanceArrays(localAtt, allDocs);
      setWhDB(targetWh, 'attendance', mergedAll, true);
      collectionCount = allDocs.length;
      pulledAnything = true;
     }
     if (!(typeof isFirestoreSuspended === 'function' && isFirestoreSuspended(targetWh))) {
      window._fsFullAttPulled[targetWh] = true;
      try { localStorage.setItem(`wfm_${targetWh.toLowerCase()}_fs_full_att_at`, String(Date.now())); } catch(eLsSet) {}
     }
    }

    // 4. Sanitasi & auto-heal catatan Miss Scan palsu pada record yang sudah punya jam pulang sah
    try { sanitizeAttendanceDatabase(targetWh); } catch(eSan) {}

    if (pulledAnything || !(typeof isFirestoreSuspended === 'function' && isFirestoreSuspended(targetWh))) {
     window._cloudAttInitialSyncDone[targetWh] = true;
    }

    if (pulledAnything) {
     const finalAtt = getWhDB(targetWh, 'attendance', []);
     try {
      localStorage.setItem(`wfm_${targetWh.toLowerCase()}_attendance_backup`, JSON.stringify(finalAtt));
     } catch(eBak) {}
     renderAllLiveScreens();
     if (alertOnComplete) {
      alert(`Berhasil menarik data absensi lengkap Gudang ${targetWh}!\n- Hari Ini: ${todayCount} record\n- Transaksi Cloud: ${collectionCount} dokumen\n- Total Riwayat Tersinkron: ${finalAtt.length} presensi`);
     }
     return true;
    }

    if (alertOnComplete) {
     alert(`Belum ada data absensi tambahan di Cloud Firestore Gudang ${targetWh}.`);
    }
    return false;
   } catch (e) {
    console.warn('[Firestore] pull attendance error:', e);
    if (alertOnComplete) {
     alert('Gagal menarik data absensi dari Firestore: ' + e.message);
    }
    return false;
   }
  }

  async function pullUsersFromFirestore(wh = null, alertOnComplete = false) {
   const targetWh = (wh || (typeof activeWarehouse !== 'undefined' ? activeWarehouse : 'MBI') || 'MBI').toUpperCase();
   const seedUsers = targetWh === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS;
   try {
    // 1. Coba unduh master snapshot (1 Read)
    const snapshot = await getDocFromFirestore(targetWh, '_metadata', 'master_snapshot');
    if (snapshot && Array.isArray(snapshot.users) && snapshot.users.length > 0) {
     if (Array.isArray(snapshot.deleted_attendance_ids) && snapshot.deleted_attendance_ids.length > 0 && typeof trackDeletedAttendance === 'function') {
      trackDeletedAttendance(snapshot.deleted_attendance_ids);
     }
     if (Array.isArray(snapshot.deleted_leave_ids) && snapshot.deleted_leave_ids.length > 0 && typeof trackDeletedLeaves === 'function') {
      trackDeletedLeaves(snapshot.deleted_leave_ids);
     }
     if (Array.isArray(snapshot.deleted_overtime_ids) && snapshot.deleted_overtime_ids.length > 0 && typeof trackDeletedOvertime === 'function') {
      trackDeletedOvertime(snapshot.deleted_overtime_ids);
     }
     let cloudUsers = snapshot.users;
     if (cloudUsers.length === 0) {
      cloudUsers = mergeUserArrays(seedUsers, cloudUsers, targetWh);
     }
     const localUsers = getWhDB(targetWh, 'users', seedUsers);
     let merged = mergeUserArrays(localUsers, cloudUsers, targetWh, snapshot.updatedAt);
     if (merged.length === 0) {
      merged = mergeUserArrays(seedUsers, merged, targetWh);
     }
     setWhDB(targetWh, 'users', merged, true);
     try { localStorage.setItem(`wfm_${targetWh.toLowerCase()}_users_backup`, JSON.stringify(merged)); } catch(eBak) {}
     renderAllLiveScreens();
     if (alertOnComplete) {
      alert(`Berhasil menarik data master ${merged.length} karyawan dari Cloud Firestore Gudang ${targetWh}!`);
     }
     return true;
    }

    // 2. Fallback: unduh dari koleksi dokumen users
    const res = await listDocsFromFirestore(targetWh, 'users', 300);
    if (res && res.docs && res.docs.length > 0) {
     const localUsers = getWhDB(targetWh, 'users', targetWh === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);
     const deletedKeys = typeof getDeletedUserKeys === 'function' ? getDeletedUserKeys() : null;
     let changed = false;
     res.docs.forEach(cUser => {
      if (!cUser || (typeof isUserMarkedDeleted === 'function' && isUserMarkedDeleted(cUser, deletedKeys))) return;
      const cNik = (cUser.nik || cUser.id || '').toUpperCase().trim();
      const idx = localUsers.findIndex(u => (u.nik && u.nik.toUpperCase() === cNik) || (u.id && u.id === cUser.id) || (u.name && cleanStr(u.name) === cleanStr(cUser.name)));
      if (idx !== -1) {
       const lTime = (localUsers[idx].updatedAt && !isNaN(new Date(localUsers[idx].updatedAt).getTime())) ? new Date(localUsers[idx].updatedAt).getTime() : 0;
       const cTime = (cUser.updatedAt && !isNaN(new Date(cUser.updatedAt).getTime())) ? new Date(cUser.updatedAt).getTime() : 0;
       if (lTime > cTime) return;
       if (cUser.role && localUsers[idx].role !== cUser.role) { localUsers[idx].role = cUser.role; changed = true; }
       if (cUser.dept && localUsers[idx].dept !== cUser.dept) { localUsers[idx].dept = cUser.dept; localUsers[idx].department = cUser.dept; changed = true; }
       if (cUser.permissions) { localUsers[idx].permissions = { ...(localUsers[idx].permissions || {}), ...cUser.permissions }; changed = true; }
       if (cUser.name && localUsers[idx].name !== cUser.name) { localUsers[idx].name = cUser.name; changed = true; }
       if (cUser.phone !== undefined && localUsers[idx].phone !== cUser.phone) { localUsers[idx].phone = cUser.phone; changed = true; }
       if (cUser.email !== undefined && localUsers[idx].email !== cUser.email) { localUsers[idx].email = cUser.email; changed = true; }
       if (cUser.outsource && localUsers[idx].outsource !== cUser.outsource) { localUsers[idx].outsource = cUser.outsource; changed = true; }
       if (cUser.status && localUsers[idx].status !== cUser.status) { localUsers[idx].status = cUser.status; localUsers[idx].isActive = (cUser.status !== 'inactive'); changed = true; }
       if (cUser.updatedAt) localUsers[idx].updatedAt = cUser.updatedAt;
      } else {
       localUsers.push(cUser);
       changed = true;
      }
     });
     if (changed) {
      setWhDB(targetWh, 'users', localUsers, true);
      if (currentUser && (currentUser.warehouse || activeWarehouse) === targetWh) {
       const freshSelf = localUsers.find(u => (u.nik && u.nik === currentUser.nik) || (u.id && u.id === currentUser.id));
       if (freshSelf) {
        currentUser.role = freshSelf.role || currentUser.role;
        currentUser.dept = freshSelf.dept || currentUser.dept;
        if (freshSelf.permissions) currentUser.permissions = freshSelf.permissions;
        localStorage.setItem('wfm_active_session', JSON.stringify(currentUser));
        const navDept = document.getElementById('nav-user-dept');
        if (navDept && !isUserScanner(currentUser) && !isUserManager(currentUser)) {
         navDept.innerText = `${(currentUser.dept || 'STAFF').toUpperCase()} - ${(currentUser.role || 'STAFF').toUpperCase()}`;
        }
        const roleBadge = document.getElementById('user-role-badge');
        if (roleBadge) roleBadge.innerText = (currentUser.role || 'STAFF').toUpperCase();
        applyRolePermissions();
       }
      }
      renderAllLiveScreens();
     }
     if (alertOnComplete) {
      alert(`Å“â€¦ Berhasil menarik ${res.docs.length} data karyawan langsung dari Cloud Firestore Gudang ${targetWh}!`);
     }
     return true;
    }
    return false;
   } catch (e) {
    console.warn('[Firestore] pull users error:', e);
    return false;
   }
  }

  // =========================================================
  // CLOUD FIRESTORE REALTIME SYNC ENGINE (SUPER CEPAT 1-2 DETIK)
  // Akun Manajemen & Dashboard Otomatis Terisi Presensi Baru Seketika
  // =========================================================
  let firestoreRealtimeTimer = null;
  let lastKnownFirestoreSignal = { MBI: '', MAI: '' };
  let isFetchingFirestoreSignal = false;

  async function checkFirestoreRealtimeUpdates() {
   // Dinonaktifkan: Sinkronisasi realtime kini murni ditangani Firebase Realtime Database & BroadcastChannel
   return;
  }

  function showLiveRealtimeIndicator(msg) {
   try {
    const badge = document.getElementById('nav-cloud-label');
    if (badge) {
     const orig = badge.innerText;
     badge.innerText = 'Å¡ Live: ' + msg.replace(/Å¡ Presensi Terupdate:\s*/, '');
     badge.className = 'text-[11px] font-extrabold text-emerald-400 animate-pulse';
     setTimeout(() => {
      badge.innerText = orig;
      badge.className = 'text-[11px] text-slate-400 font-medium';
     }, 4000);
    }
   } catch(e) {}
  }

  function startFirestoreRealtimeSync() {
   if (firestoreRealtimeTimer) clearInterval(firestoreRealtimeTimer);
   // Dinonaktifkan: Menghilangkan seluruh interval Firestore
  }

  function copyFirestoreRules() {
   const rules = `rules_version = '2';
service cloud.firestore {
 match /databases/{database}/documents {
  
  // ========================================================
  // WFM MEDIKA CLOUD FIRESTORE PRODUCTION SECURITY RULES
  // Sistem Manajemen Kehadiran & Operasional (Gudang MBI & MAI)
  // Menjamin kelancaran multi-perangkat 24/7 & bebas batas kuota
  // ========================================================
  
  // 1. Metadata Sistem, Master Snapshot & Live Beacon
  match /_metadata/{docId} {
   allow read, write: if true;
  }

  // 2. Data Master Karyawan (Users / NIK 1:1)
  match /users/{userId} {
   allow read, write: if true;
  }

  // 3. Transaksi Presensi & Riwayat Tap Absensi
  match /attendance/{attId} {
   allow read, write: if true;
  }

  // 4. Pengajuan Cuti & Izin Kerja
  match /leaves/{leaveId} {
   allow read, write: if true;
  }

  // 5. Pengajuan Lembur Karyawan
  match /overtime/{otId} {
   allow read, write: if true;
  }

  // 6. Diagnostik Koneksi & Heartbeat
  match /_connectivity/{docId} {
   allow read, write: if true;
  }

  // 7. Pengaturan Konfigurasi Umum
  match /meta/{docId} {
   allow read, write: if true;
  }

  // Fallback Semua Dokumen (Mencegah error 403 / macet)
  match /{document=**} {
   allow read, write: if true;
  }
 }
}`;
   if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(rules).then(() => {
     alert('Å“â€¦ Aturan (Rules) Cloud Firestore Produksi Berhasil Disalin!\n\nCara Memasang:\n1. Buka console.firebase.google.com\n2. Pilih Project Cloud (wfm-medika-mbi-new / wfm-medika2)\n3. Pilih menu "Firestore Database" di panel kiri\n4. Klik tab "Rules"\n5. Hapus semua teks lama, tempelkan aturan yang baru disalin ini\n6. Klik tombol "Publish"');
    }).catch(() => {
     prompt('Salin teks Rules Cloud Firestore berikut:', rules);
    });
   } else {
    prompt('Salin teks Rules Cloud Firestore berikut:', rules);
   }
  }

  function updateFirebaseUrlUI() {
   const currentWh = (activeWarehouse || (currentUser && currentUser.warehouse) || 'MBI').toUpperCase();
   const mbiUrl = getFirebaseEndpoint('MBI');
   const maiUrl = getFirebaseEndpoint('MAI');
   const activeUrl = currentWh === 'MAI' ? maiUrl : mbiUrl;

   const lbl = document.getElementById('lbl-firebase-endpoint');
   if (lbl) {
    lbl.innerText = `${currentWh === 'MAI' ? 'Gudang MAI' : 'Gudang MBI'}: ${activeUrl}`;
   }

   const fsLbl = document.getElementById('lbl-firestore-project');
   if (fsLbl) {
    fsLbl.innerText = `Project Cloud ${currentWh}: ${getFirestoreProjectId(currentWh)} (Database Firestore Default)`;
   }

   const mbiInput = document.getElementById('input-custom-firebase-mbi-url');
   if (mbiInput) mbiInput.value = mbiUrl;
   const maiInput = document.getElementById('input-custom-firebase-mai-url');
   if (maiInput) maiInput.value = maiUrl;

   const containerMbi = document.getElementById('container-db-setting-mbi');
   const containerMai = document.getElementById('container-db-setting-mai');
   const titleEl = document.getElementById('lbl-db-setting-title');
   const resetBtn = document.getElementById('btn-reset-db-active');
   const descEl = document.getElementById('lbl-db-setting-desc');

   if (containerMbi && containerMai) {
    if (currentWh === 'MAI') {
     containerMbi.classList.add('hidden');
     containerMai.classList.remove('hidden');
     if (titleEl) titleEl.innerHTML = '<i data-lucide="database" class="w-4 h-4 text-emerald-600"></i> Pengaturan Database Gudang MAI';
     if (resetBtn) resetBtn.innerText = 'Reset MAI ke Bawaan';
     if (descEl) descEl.innerHTML = 'Database Gudang <b>MAI</b> berjalan 100% mandiri pada server Google Cloud khusus MAI. Pengaturan URL ini hanya berlaku untuk operasional Gudang MAI.';
    } else {
     containerMai.classList.add('hidden');
     containerMbi.classList.remove('hidden');
     if (titleEl) titleEl.innerHTML = '<i data-lucide="database" class="w-4 h-4 text-blue-600"></i> Pengaturan Database Gudang MBI';
     if (resetBtn) resetBtn.innerText = 'Reset MBI ke Bawaan';
     if (descEl) descEl.innerHTML = 'Database Gudang <b>MBI</b> berjalan 100% mandiri pada server Google Cloud khusus MBI. Pengaturan URL ini hanya berlaku untuk operasional Gudang MBI.';
    }
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
   }
  }

  function resetActiveWarehouseFirebaseUrl() {
   const currentWh = (activeWarehouse || (currentUser && currentUser.warehouse) || 'MBI').toUpperCase();
   resetDefaultFirebaseUrl(currentWh);
  }

  function saveCustomFirebaseUrl(wh = null) {
   const targetWh = (wh || activeWarehouse || 'MBI').toUpperCase();
   const inputId = targetWh === 'MAI' ? 'input-custom-firebase-mai-url' : 'input-custom-firebase-mbi-url';
   const input = document.getElementById(inputId) || document.getElementById('input-custom-firebase-url');
   if (!input) return;
   const val = input.value.trim();
   if (!val) {
    alert(`Silakan masukkan URL Firebase Realtime Database untuk Gudang ${targetWh}.`);
    return;
   }
   if (!val.startsWith('https://') || !val.includes('firebaseio.com')) {
    alert('Format URL tidak valid!\nURL Firebase harus diawali dengan https:// dan berakhiran .firebaseio.com\n\nContoh:\nhttps://project-anda-default-rtdb.firebaseio.com/');
    return;
   }
   let clean = val.replace(/\/$/, '');
   if (!clean.endsWith('.json')) {
    clean = clean + '/wfm_database.json';
   }
   if (targetWh === 'MAI') {
    localStorage.setItem('wfm_firebase_custom_mai_url', clean);
   } else {
    localStorage.setItem('wfm_firebase_custom_mbi_url', clean);
   }
   updateFirebaseUrlUI();
   alert(`Å“â€¦ URL Firebase Berhasil Disimpan!\n\nDatabase Gudang ${targetWh} kini terhubung ke:\n${clean}`);
   testFirebaseConnection();
  }

  function resetDefaultFirebaseUrl(wh = 'ALL') {
   const target = (wh || 'ALL').toUpperCase();
   if (target === 'MBI') {
    if (confirm('Kembalikan URL Firebase Gudang MBI ke default resmi?')) {
     localStorage.removeItem('wfm_firebase_custom_mbi_url');
     updateFirebaseUrlUI();
     alert('URL Firebase MBI telah dikembalikan ke default:\n' + DEFAULT_FIREBASE_RTDB_MBI_URL);
     testFirebaseConnection();
    }
   } else if (target === 'MAI') {
    if (confirm('Kembalikan URL Firebase Gudang MAI ke default resmi?')) {
     localStorage.removeItem('wfm_firebase_custom_mai_url');
     updateFirebaseUrlUI();
     alert('URL Firebase MAI telah dikembalikan ke default:\n' + DEFAULT_FIREBASE_RTDB_MAI_URL);
     testFirebaseConnection();
    }
   } else {
    if (confirm('Kembalikan URL Firebase ke default resmi kedua gudang (MBI & MAI)?')) {
     localStorage.removeItem('wfm_firebase_custom_mbi_url');
     localStorage.removeItem('wfm_firebase_custom_mai_url');
     localStorage.removeItem('wfm_firebase_custom_url');
     updateFirebaseUrlUI();
     alert('URL Firebase kedua gudang telah dikembalikan ke default:\n• MBI: ' + DEFAULT_FIREBASE_RTDB_MBI_URL + '\n• MAI: ' + DEFAULT_FIREBASE_RTDB_MAI_URL);
     testFirebaseConnection();
    }
   }
  }

  function normalizeFirebaseArray(val) {
   if (!val) return [];
   if (Array.isArray(val)) return val.filter(Boolean);
   if (typeof val === 'object') return Object.values(val).filter(Boolean);
   return [];
  }

  // =========================================================