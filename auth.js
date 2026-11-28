// === WFM MEDIKA AUTH & ACCESS CONTROL ===
  // SMART LOGIN DENGAN PENCARIAN FLEKSIBEL (NIK / NAMA / PHONE / EMAIL / USERNAME)
  // =========================================================
  function handleLogin(e) {
   if (e && typeof e.preventDefault === 'function') e.preventDefault();
   
   const alertEl = document.getElementById('auth-alert');
   if (alertEl) {
    alertEl.classList.add('hidden');
    alertEl.innerHTML = '';
   }

   try {
    const idInput = document.getElementById('login-identifier');
    const passInput = document.getElementById('login-password');
    const rawInputId = (idInput ? idInput.value : '').trim();
    const inputPass = (passInput ? passInput.value : '').trim();
    const cleanInput = cleanStr(rawInputId);

    if (!rawInputId) {
     if (alertEl) {
      alertEl.className = 'mx-6 mt-4 p-3.5 rounded-2xl text-xs bg-rose-50 text-rose-800 border border-rose-200 font-semibold text-center';
      alertEl.innerHTML = '<span>Silakan masukkan NIK atau Username Anda.</span>';
      alertEl.classList.remove('hidden');
     }
     return;
    }

    let selectedWh = document.querySelector('input[name="login-warehouse"]:checked')?.value || activeWarehouse || 'MBI';

    // Ambil user dari database lokal dan sertakan akun master cadangan
    const mbiUsers = getWhDB('MBI', 'users', SEED_MBI_USERS);
    const maiUsers = getWhDB('MAI', 'users', SEED_MAI_USERS);

    let latestMgrName = 'Manager';
    try {
     const session = JSON.parse(localStorage.getItem('wfm_active_session') || '{}');
     if (session && (session.role === 'manager' || session.id === 'mgr-eko' || session.nik === 'MGR001') && session.name) {
      latestMgrName = session.name;
     }
    } catch(e) {}

    const mgrMbi = mbiUsers.find(u => isUserManager(u)) || { ...SEED_MANAGER_USER, name: latestMgrName, warehouse: 'MBI' };
    const mgrMai = maiUsers.find(u => isUserManager(u)) || { ...SEED_MANAGER_USER, name: latestMgrName, warehouse: 'MAI' };
    const currentWhMgr = selectedWh === 'MAI' ? mgrMai : mgrMbi;

    // ISOLASI KETAT GUDANG:
    // Hanya mencari user pada gudang yang dipilih (selectedWh).
    // Akun gudang lain TIDAK BOLEH dicari atau diloginkan secara otomatis!
    const currentWhUsers = selectedWh === 'MAI' ? maiUsers : mbiUsers;
    const currentSeedUsers = selectedWh === 'MAI' ? SEED_MAI_USERS : SEED_MBI_USERS;
    const whUsers = [...currentWhUsers, ...currentSeedUsers, currentWhMgr];

    // Jika input adalah kata kunci akun scanner absen
    if (cleanInput === 'absen' || cleanInput === 'scanner' || cleanInput.startsWith('absen') || cleanInput.startsWith('scanner')) {
     const wh = (cleanInput.includes('mai')) ? 'MAI' : ((cleanInput.includes('mbi')) ? 'MBI' : selectedWh);
     if (wh !== selectedWh) {
      const r = document.querySelector(`input[name="login-warehouse"][value="${wh}"]`);
      if (r) { r.checked = true; updateLoginWhStyle(); }
     }
     quickLoginScannerAccount(wh);
     return;
    }

    let user = null;

    // 0. Keyword cepat admin (misal: 'admin', 'admin mbi', 'admin mai', 'administrator', 'adm001', 'admmai', 'adm-mai', 'mbi-admin', 'mai-admin', 'mbiadmin', 'maiadmin', 'adm')
    if (cleanInput === 'admin' || cleanInput === 'administrator' || cleanInput === 'adminmbi' || cleanInput === 'adminmai' || cleanInput === 'adm001' || cleanInput === 'admmai' || cleanInput === 'adm-mai' || cleanInput === 'admma' || cleanInput === 'adm' || cleanInput === 'mbiadmin' || cleanInput === 'maiadmin' || cleanInput.includes('admin') || cleanInput.startsWith('adm00')) {
     let targetWh = selectedWh;
     if (cleanInput.includes('mai') || cleanInput === 'adm-mai' || cleanInput === 'admmai' || cleanInput === 'maiadmin') {
      targetWh = 'MAI';
     } else if (cleanInput.includes('mbi') || cleanInput === 'adm001' || cleanInput === 'admmbi' || cleanInput === 'mbiadmin') {
      targetWh = 'MBI';
     }
     if (targetWh !== selectedWh) {
      selectedWh = targetWh;
      const r = document.querySelector(`input[name="login-warehouse"][value="${targetWh}"]`);
      if (r) { r.checked = true; updateLoginWhStyle(); }
     }
     const targetWhUsers = selectedWh === 'MAI' ? maiUsers : mbiUsers;
     const targetSeedUsers = selectedWh === 'MAI' ? SEED_MAI_USERS : SEED_MBI_USERS;

     // KUNCI MATI ADMIN SESUAI GUDANG TARGET:
     // Admin MBI HARUS mbi-admin (ADM001), Admin MAI HARUS mai-admin (ADM-MAI)
     const targetAdminId = selectedWh === 'MAI' ? 'mai-admin' : 'mbi-admin';
     const targetAdminNik = selectedWh === 'MAI' ? 'ADM-MAI' : 'ADM001';
     const targetAdminName = selectedWh === 'MAI' ? 'Admin Gudang MAI' : 'Admin Gudang MBI';

     const found = targetWhUsers.find(u => u && (u.id === targetAdminId || (u.nik && u.nik.toUpperCase() === targetAdminNik) || cleanStr(u.name) === cleanStr(targetAdminName))) ||
            targetSeedUsers[0];

     const fullAdminPerms = {
      perm_wh_mbi: (selectedWh === 'MBI'),
      perm_wh_mai: (selectedWh === 'MAI'),
      perm_wh_switch: false,
      perm_emp_add: true, perm_emp_edit: true, perm_emp_view: true, perm_emp_delete: true,
      perm_emp_reset_all: true, perm_emp_upload_excel: true, perm_emp_download_excel: true,
      perm_idcard_single: true, perm_idcard_batch_a4: true, perm_idcard_qr_location: true,
      perm_rep_records: true, perm_rep_matrix: true, perm_rep_workhours: true, perm_rep_leaves: true,
      perm_rep_ot: true, perm_rep_copy_matrix: true, perm_rep_download_excel: true, perm_rep_reset_att: true,
      perm_approve_leave_spv: true, perm_approve_leave_mgr: true, perm_approve_ot_spv: true, perm_approve_ot_mgr: true,
      perm_reject_submission: true, perm_submit_leave_staff: true, perm_submit_batch_ot: true,
      perm_sys_audio_settings: true, perm_sys_gps_edit: true, perm_sys_cloud_sync: true, perm_sys_gsheet_backup: true,
      perm_sys_manage_permissions: true
     };

     user = {
      ...targetSeedUsers[0],
      ...(found || {}),
      id: targetAdminId,
      nik: targetAdminNik,
      name: targetAdminName,
      warehouse: selectedWh,
      role: 'admin',
      dept: 'Administrator',
      status: 'active',
      isActive: true,
      accessibleWarehouses: [selectedWh],
      permissions: {
       ...fullAdminPerms,
       ...((found && found.permissions) ? found.permissions : {}),
       perm_wh_mbi: (selectedWh === 'MBI'),
       perm_wh_mai: (selectedWh === 'MAI'),
       perm_wh_switch: false
      }
     };
     if (selectedWh === 'MBI') {
      user.password = (found && found.password && found.password !== 'adminmai123') ? found.password : 'adminmbi123';
     } else {
      user.password = (found && found.password && found.password !== 'adminmbi123') ? found.password : 'adminmai123';
     }
    }

    // 0.5 Keyword cepat Manager (misal: 'manager', 'mgr', 'eko', 'managereko', 'mgr001', 'mgreko')
    if (!user && (
     cleanInput === 'eko' || cleanInput === 'manager' || cleanInput === 'mgr' ||
     cleanInput === 'managereko' || cleanInput === 'mgr001' || cleanInput === 'mgreko' ||
     cleanInput === 'managermbi' || cleanInput === 'managermai' ||
     cleanInput.includes('manager')
    )) {
     user = currentWhUsers.find(u => isUserManager(u)) || { ...SEED_MANAGER_USER, name: 'Manager', warehouse: selectedWh };
    }

    // 1. Exact match (NIK / Nama / Phone / ID / Email / Username / Barcode) dalam gudang terpilih
    if (!user) {
     user = whUsers.find(u => 
      u && (
       cleanStr(u.nik) === cleanInput || 
       cleanStr(u.name) === cleanInput ||
       cleanStr(u.id) === cleanInput ||
       (u.barcodeValue && cleanStr(u.barcodeValue) === cleanInput) ||
       (u.email && cleanStr(u.email) === cleanInput) ||
       (u.email && cleanStr(u.email.split('@')[0]) === cleanInput) ||
       (u.phone && cleanStr(u.phone) === cleanInput)
      )
     );
    }

    // 1.5 Match Akhiran NIK dalam gudang terpilih
    if (!user && cleanInput.length >= 1) {
     user = whUsers.find(u => {
      if (!u || !u.nik) return false;
      const uCleanNik = cleanStr(u.nik);
      return uCleanNik.endsWith(cleanInput) || uCleanNik === `${selectedWh.toLowerCase()}26${cleanInput.padStart(3, '0')}`;
     });
    }

    // 2. Partial word match dalam gudang terpilih
    if (!user && cleanInput.length >= 2) {
     user = whUsers.find(u => 
      u && (
       cleanStr(u.name).includes(cleanInput) || 
       cleanInput.includes(cleanStr(u.name)) ||
       (u.nik && cleanStr(u.nik).includes(cleanInput)) ||
       (u.id && cleanStr(u.id).includes(cleanInput)) ||
       (u.email && cleanStr(u.email).includes(cleanInput))
      )
     );
    }

    // 3. Multi-word individual match dalam gudang terpilih
    if (!user) {
     const words = rawInputId.toLowerCase().split(/\s+/).filter(w => w.length >= 2);
     if (words.length > 0) {
      user = whUsers.find(u => {
       if (!u || !u.name) return false;
       const uName = u.name.toLowerCase();
       return words.some(w => uName.includes(w));
      });
     }
    }

    // 4. Smart Cross-Warehouse Fallback: Jika tidak ditemukan di gudang aktif, cari di gudang lain dan otomatis alihkan
    if (!user) {
     const otherWh = selectedWh === 'MAI' ? 'MBI' : 'MAI';
     const otherWhUsers = selectedWh === 'MAI' ? mbiUsers : maiUsers;
     const existsInOther = otherWhUsers.find(u => 
      u && (
       cleanStr(u.nik) === cleanInput || 
       cleanStr(u.name) === cleanInput ||
       cleanStr(u.id) === cleanInput ||
       (u.barcodeValue && cleanStr(u.barcodeValue) === cleanInput) ||
       (u.email && cleanStr(u.email) === cleanInput)
      )
     );

     if (existsInOther && isUserAllowedToLogin(existsInOther)) {
      // JANGAN alihkan akun admin antar gudang secara otomatis
      if (!isUserAdmin(existsInOther)) {
       selectedWh = otherWh;
       const r = document.querySelector(`input[name="login-warehouse"][value="${otherWh}"]`);
       if (r) { r.checked = true; updateLoginWhStyle(); }
       user = existsInOther;
      }
     }
    }

    // Jika user tetap tidak ditemukan:
    if (!user) {
     if (alertEl) {
      alertEl.className = 'mx-6 mt-4 p-3.5 rounded-2xl text-xs bg-rose-50 text-rose-800 border border-rose-200 font-semibold text-center';
      alertEl.innerHTML = `<span>Akun / NIK <b>"${escapeHTML(rawInputId)}"</b> tidak ditemukan di sistem!</span><br><span class="text-[11px] font-normal text-slate-600">Pastikan NIK atau Nama yang Anda masukkan sudah terdaftar.</span>`;
      alertEl.classList.remove('hidden');
     }
     return;
    }

    // BLOKIR AKSES LOGIN HANYA JIKA BENAR-BENAR STAFF MURNI TANPA HAK LOGIN
    const isMgmtUser = isUserAllowedToLogin(user);
    if (!isMgmtUser) {
     if (alertEl) {
      alertEl.className = 'mx-6 mt-4 p-3.5 rounded-2xl text-xs bg-amber-50 text-amber-900 border border-amber-300 font-semibold text-center';
      alertEl.innerHTML = `<span>Akses Ditolak: Karyawan Staff <b>"${escapeHTML(user.name)}"</b> tidak memiliki hak akses login.</span><br><span class="text-[11px] font-normal text-slate-600">Hak akses login sistem diperuntukkan bagi <b>Coordinator, Supervisor, Manager, Admin, dan Scanner Presensi</b> (atau akun yang diberikan izin modul). Karyawan Staff melakukan absensi lewat Scanner Presensi Gudang.</span>`;
      alertEl.classList.remove('hidden');
     }
     return;
    }

    // Cek status aktif/nonaktif akun karyawan (kecuali akun manajemen sistem)
    if (!isManagementSystemAccount(user) && (user.status === 'inactive' || isNikInactiveRegistered(user.nik))) {
     if (alertEl) {
      alertEl.className = 'mx-6 mt-4 p-3.5 rounded-2xl text-xs bg-amber-50 text-amber-900 border border-amber-300 font-semibold text-center';
      alertEl.innerHTML = `<span>Akun <b>"${escapeHTML(user.name)}"</b> (NIK: ${escapeHTML(user.nik || user.id)}) berstatus <span class="text-rose-600 font-black">NONAKTIF</span>.</span><br><span class="text-[11px] font-normal text-slate-600">Silakan hubungi Tim HRD / Admin Gudang untuk mengaktifkan kembali akun Anda.</span>`;
      alertEl.classList.remove('hidden');
     }
     return;
    }

    // Sinkronisasi otomatis gudang akun (khusus akun non-admin yang terdaftar di gudang tunggal)
    if (user.warehouse && user.warehouse !== selectedWh && !isUserManager(user) && !canAccessMultiWarehouse(user) && !isUserAdmin(user)) {
     selectedWh = user.warehouse;
     const r = document.querySelector(`input[name="login-warehouse"][value="${user.warehouse}"]`);
     if (r) { r.checked = true; updateLoginWhStyle(); }
    }

    // Pastikan gudang user sesuai dengan pilihan aktif saat login
    user.warehouse = isUserManager(user) || canAccessMultiWarehouse(user) ? selectedWh : (user.warehouse || selectedWh);

    // VALIDASI PASSWORD KETAT & AMAN:
    let storedPass = (user.password || '').trim();
    if (!storedPass) {
     if (isUserAdmin(user)) {
      storedPass = (selectedWh === 'MAI') ? 'adminmai123' : 'adminmbi123';
     } else {
      storedPass = 'medika123';
     }
    }

    let isPasswordCorrect = false;

    // Input password wajib diisi untuk keamanan akun
    if (!inputPass) {
     if (alertEl) {
      alertEl.className = 'mx-6 mt-4 p-3.5 rounded-2xl text-xs bg-rose-50 text-rose-800 border border-rose-200 font-semibold text-center';
      alertEl.innerHTML = `<span>Kata sandi wajib diisi untuk login akun <b>${escapeHTML(user.name)}</b>!</span><br><span class="text-[11px] text-slate-600 font-normal">Silakan masukkan kata sandi akun Anda.</span>`;
      alertEl.classList.remove('hidden');
     }
     return;
    }

    const inputLower = inputPass.toLowerCase();
    const storedLower = storedPass.toLowerCase();

    // Verifikasi kata sandi standar
    if (inputPass === storedPass || inputLower === storedLower) {
     isPasswordCorrect = true;
    }

    // MULTI-FALLBACK KHUSUS AKUN ADMINISTRATOR:
    // Menjamin Admin MBI / MAI selalu dapat login dengan password bawaan, password kustom, password vault, atau password Supabase
    if (!isPasswordCorrect && (isUserAdmin(user) || user.role === 'admin' || user.id === 'mbi-admin' || user.id === 'mai-admin' || user.nik === 'ADM001' || user.nik === 'ADM-MAI')) {
     const vaultPwd = (typeof getAdminCustomPassword === 'function' ? getAdminCustomPassword(selectedWh) : '') || '';
     const vaultMbi = (typeof getAdminCustomPassword === 'function' ? getAdminCustomPassword('MBI') : '') || '';
     const vaultMai = (typeof getAdminCustomPassword === 'function' ? getAdminCustomPassword('MAI') : '') || '';
     const defaultAdminPass = selectedWh === 'MAI' ? 'adminmai123' : 'adminmbi123';
     const hasCustomVault = Boolean(vaultPwd && vaultPwd !== 'adminmbi123' && vaultPwd !== 'adminmai123');
     const candidatePasswords = hasCustomVault
      ? [vaultPwd, user.customPassword, user.custom_password, storedPass].filter(p => typeof p === 'string' && p.trim().length > 0 && p !== defaultAdminPass)
      : [
       storedPass,
       user.password,
       user.customPassword,
       user.custom_password,
       vaultPwd,
       vaultMbi,
       vaultMai,
       defaultAdminPass,
       'adminmbi123',
       'adminmai123',
       'password123',
       'admin123'
      ].filter(p => typeof p === 'string' && p.trim().length > 0);

     if (candidatePasswords.some(p => p === inputPass || p.toLowerCase() === inputLower)) {
      isPasswordCorrect = true;
     }
    }

    if (!isPasswordCorrect) {
     if (alertEl) {
      alertEl.className = 'mx-6 mt-4 p-3.5 rounded-2xl text-xs bg-rose-50 text-rose-800 border border-rose-200 font-semibold text-center';
      alertEl.innerHTML = `<span>Kata sandi untuk <b>${escapeHTML(user.name)}</b> salah!</span><br><span class="text-[11px] text-slate-600 font-normal">Silakan periksa kembali kata sandi akun Anda.</span>`;
      alertEl.classList.remove('hidden');
     }
     return;
    }

    loginUserSession(user);
   } catch (loginErr) {
    console.error('Login process error:', loginErr);
    if (alertEl) {
     alertEl.className = 'mx-6 mt-4 p-3.5 rounded-2xl text-xs bg-rose-50 text-rose-800 border border-rose-200 font-semibold text-center';
     alertEl.innerHTML = `<span>Terjadi kendala saat login: ${escapeHTML(loginErr.message || 'Silakan coba lagi.')}</span>`;
     alertEl.classList.remove('hidden');
    }
   }
  }

  function handleForceChangePassword(e) {
   e.preventDefault();
   const p1 = document.getElementById('new-pwd-1').value.trim();
   const p2 = document.getElementById('new-pwd-2').value.trim();

   const alertEl = document.getElementById('pwd-change-alert');
   if (p1.length < 6) {
    alertEl.innerText = 'Password baru minimal 6 karakter!';
    alertEl.classList.remove('hidden');
    return;
   }
   if (p1 !== p2) {
    alertEl.innerText = 'Konfirmasi password baru tidak cocok!';
    alertEl.classList.remove('hidden');
    return;
   }

   const warehouse = pendingUserForPasswordChange.warehouse || 'MBI';
   const users = getWhDB(warehouse, 'users', warehouse === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);
   const idx = users.findIndex(u => (pendingUserForPasswordChange.nik && u.nik === pendingUserForPasswordChange.nik) || (pendingUserForPasswordChange.id && u.id === pendingUserForPasswordChange.id));

   if (idx !== -1) {
    const nowIso = new Date().toISOString();
    delete users[idx].oldPassword;
    users[idx].previousPasswords = [];
    users[idx].password = p1;
    users[idx].isFirstLogin = false;
    users[idx].isPasswordChanged = true;
    users[idx].updatedAt = nowIso;
    if (isUserAdmin(users[idx]) && typeof setAdminCustomPassword === 'function') {
     setAdminCustomPassword(warehouse, p1);
    }
    setWhDB(warehouse, 'users', users);
    pendingUserForPasswordChange = users[idx];
    localStorage.setItem('wfm_last_master_change_time', Date.now().toString());
    localStorage.setItem('wfm_master_updated_at', nowIso);
    localStorage.setItem(`wfm_${warehouse.toLowerCase()}_master_updated_at`, nowIso);

    // Jika Admin atau Manager, sinkronkan juga ke warehouse lain
    if (isUserManager(pendingUserForPasswordChange) || isUserAdmin(pendingUserForPasswordChange)) {
     const otherWh = warehouse === 'MBI' ? 'MAI' : 'MBI';
     let otherUsers = getWhDB(otherWh, 'users', otherWh === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);
     const otherIdx = otherUsers.findIndex(u => (pendingUserForPasswordChange.nik && u.nik === pendingUserForPasswordChange.nik) || (pendingUserForPasswordChange.id && u.id === pendingUserForPasswordChange.id) || (isUserManager(pendingUserForPasswordChange) && isUserManager(u)));
     if (otherIdx !== -1) {
      delete otherUsers[otherIdx].oldPassword;
      otherUsers[otherIdx].previousPasswords = [];
      otherUsers[otherIdx].password = p1;
      otherUsers[otherIdx].isFirstLogin = false;
      otherUsers[otherIdx].isPasswordChanged = true;
      otherUsers[otherIdx].updatedAt = nowIso;
      setWhDB(otherWh, 'users', otherUsers);
     }
    }

    try {
     if (typeof saveUsersToSupabase === 'function') {
      const targetWh = (typeof warehouse !== 'undefined' ? warehouse : (pendingUserForPasswordChange?.warehouse || 'MBI'));
      saveUsersToSupabase(targetWh, users).catch(() => {});
      const targetUser = (typeof pendingUserForPasswordChange !== 'undefined' && pendingUserForPasswordChange ? pendingUserForPasswordChange : currentUser);
      if (isUserManager(targetUser) || isUserAdmin(targetUser)) {
       const otherWh = targetWh === 'MBI' ? 'MAI' : 'MBI';
       const otherUsers = getWhDB(otherWh, 'users', []);
       if (otherUsers.length > 0) saveUsersToSupabase(otherWh, otherUsers).catch(() => {});
      }
     }
    } catch (eSb) {}
    try { saveFullDatabaseToCloud(false, true, true); } catch(e) {}
   }

   document.getElementById('first-login-modal').classList.add('hidden');
   alert('Password pribadi berhasil disimpan! Selamat datang di WFM Medika.');
   loginUserSession(pendingUserForPasswordChange);
  }

  // =========================================================
  // LOOKUP MODAL (CARI NIK SENDIRI)
  // =========================================================
  function openAccountLookupModal() {
   migrateAllUsersNIK();
   document.getElementById('account-lookup-modal').classList.remove('hidden');
   document.getElementById('lookup-search-input').value = '';
   renderAccountLookupList();
   fetchFullDatabaseFromCloud(false).then(() => renderAccountLookupList());
   lucide.createIcons();
  }

  function closeAccountLookupModal() {
   document.getElementById('account-lookup-modal').classList.add('hidden');
  }

  function renderAccountLookupList() {
   const q = (document.getElementById('lookup-search-input')?.value || '').toLowerCase().trim();
   const selectedWhEl = document.querySelector('input[name="login-warehouse"]:checked');
   const selectedWh = selectedWhEl ? selectedWhEl.value : 'MBI';
   
   const currentWhUsers = getWhDB(selectedWh, 'users', selectedWh === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);

   // HANYA tampilkan akun yang berhak login (Coordinator, Supervisor, Manager, Admin, Scanner, atau akun dengan izin modul)
   const allowedAccounts = currentWhUsers.filter(u => {
    if (!u || !isUserAllowedToLogin(u)) return false;
    if (u.role !== 'staff') return true;
    if (u.permissions && Object.values(u.permissions).some(v => v === true)) return true;
    const sp = getSavedUserPerms(u.nik || u.id, u.warehouse);
    return sp && Object.values(sp).some(v => v === true);
   });

   allowedAccounts.sort((a, b) => {
    if (a.role === 'admin') return -1;
    if (b.role === 'admin') return 1;
    if (a.role === 'manager') return -1;
    if (b.role === 'manager') return 1;
    if (a.role === 'supervisor' && b.role !== 'supervisor') return -1;
    if (b.role === 'supervisor' && a.role !== 'supervisor') return 1;
    return (a.name || '').localeCompare(b.name || '');
   });

   const filtered = allowedAccounts.filter(u => 
    (u.name && u.name.toLowerCase().includes(q)) || 
    (u.nik && u.nik.toLowerCase().includes(q)) || 
    (u.role && u.role.toLowerCase().includes(q)) ||
    (u.dept && u.dept.toLowerCase().includes(q))
   );

   const container = document.getElementById('lookup-list-container');
   if (!container) return;
   container.innerHTML = '';

   if (filtered.length === 0) {
    container.innerHTML = `<div class="p-4 text-center text-xs text-slate-400">Tidak ada akun login di Gudang ${selectedWh} yang cocok.</div>`;
    return;
   }

   filtered.forEach(u => {
    const div = document.createElement('div');
    div.className = 'p-3 hover:bg-slate-50 flex items-center justify-between cursor-pointer transition border-b border-slate-100 last:border-b-0';
    div.onclick = () => {
     document.getElementById('login-identifier').value = u.nik || u.name;
     const pwdInput = document.getElementById('login-password');
     if (pwdInput) { pwdInput.value = ''; pwdInput.focus(); }
     closeAccountLookupModal();
    };
    const roleLabel = (u.role || 'Staff').toUpperCase();
    div.innerHTML = `
     <div>
      <span class="font-extrabold text-xs text-slate-900 block">${escapeHTML(u.name)}</span>
      <span class="font-mono text-[10px] text-slate-500">NIK: <b class="text-teal-700">${escapeHTML(u.nik || '-')}</b> &bull; <span class="uppercase font-bold text-slate-700">${roleLabel}</span> (Gudang ${selectedWh})</span>
     </div>
     <span class="px-2.5 py-1 bg-teal-50 text-teal-700 text-[10px] font-bold rounded-lg border border-teal-200">Gunakan</span>
    `;
    container.appendChild(div);
   });
  }

  function openDirectSyncModal() {
   if (!isUserAdmin(currentUser) && !hasPermission('perm_sys_cloud_sync')) {
    alert('Akses Ditolak: Fitur Database Cloud 24/7 hanya dapat diakses oleh Akun yang memiliki izin Database Cloud.');
    return;
   }
   document.getElementById('direct-sync-modal').classList.remove('hidden');
   lucide.createIcons();
  }

  function closeDirectSyncModal() {
   document.getElementById('direct-sync-modal').classList.add('hidden');
  }

  function copyAdminSyncCode() {
   const payload = {
    mbi_users: getWhDB('MBI', 'users', SEED_MBI_USERS),
    mai_users: getWhDB('MAI', 'users', SEED_MAI_USERS),
    mbi_attendance: getWhDB('MBI', 'attendance', SEED_MBI_ATTENDANCE),
    mai_attendance: getWhDB('MAI', 'attendance', SEED_MAI_ATTENDANCE),
    mbi_leaves: getWhDB('MBI', 'leaves', SEED_MBI_LEAVES),
    mai_leaves: getWhDB('MAI', 'leaves', []),
    mbi_overtime: getWhDB('MBI', 'overtime', SEED_MBI_OVERTIMES),
    mai_overtime: getWhDB('MAI', 'overtime', []),
    mbi_coords: getWarehouseCoords('MBI'),
    mai_coords: getWarehouseCoords('MAI'),
    updatedAt: new Date().toISOString()
   };

   const jsonStr = JSON.stringify(payload);
   const encoded = btoa(unescape(encodeURIComponent(jsonStr)));
   
   navigator.clipboard.writeText(encoded).then(() => {
    alert('Å¸â€œâ€¹ Kode Database Admin Berhasil Disalin!\n\nKirimkan kode ini ke WhatsApp / Chat, lalu buka di HP dan pilih "Tempel Kode" untuk mengaktifkan seluruh akun karyawan dan koordinat resmi seketika.');
   }).catch(() => {
    prompt('Salin teks kode database di bawah ini:', encoded);
   });
  }

  function applyAdminSyncCode() {
   const raw = document.getElementById('sync-code-input').value.trim();
   if (!raw) {
    alert('Silakan tempel kode database terlebih dahulu.');
    return;
   }

   try {
    let jsonStr = raw;
    if (!raw.startsWith('{')) {
     jsonStr = decodeURIComponent(escape(atob(raw)));
    }
    const db = JSON.parse(jsonStr);
    if (db.mbi_users) localStorage.setItem('wfm_mbi_users', JSON.stringify(db.mbi_users));
    if (db.mai_users) localStorage.setItem('wfm_mai_users', JSON.stringify(db.mai_users));
    if (db.mbi_attendance) localStorage.setItem('wfm_mbi_attendance', JSON.stringify(db.mbi_attendance));
    if (db.mai_attendance) localStorage.setItem('wfm_mai_attendance', JSON.stringify(db.mai_attendance));
    if (db.mbi_leaves) localStorage.setItem('wfm_mbi_leaves', JSON.stringify(db.mbi_leaves));
    if (db.mai_leaves) localStorage.setItem('wfm_mai_leaves', JSON.stringify(db.mai_leaves));
    if (db.mbi_overtime) localStorage.setItem('wfm_mbi_overtime', JSON.stringify(db.mbi_overtime));
    if (db.mai_overtime) localStorage.setItem('wfm_mai_overtime', JSON.stringify(db.mai_overtime));
    if (db.mbi_coords) localStorage.setItem('wfm_mbi_coords', JSON.stringify(db.mbi_coords));
    if (db.mai_coords) localStorage.setItem('wfm_mai_coords', JSON.stringify(db.mai_coords));

    renderAccountLookupList();
    renderEmployeeTable();
    populateDropdownEmployees();
    renderOvertimeEmployeeGrid();
    updateRegisteredCoordsDisplay();
    refreshAllDashboardData();
    closeDirectSyncModal();

    alert(`Å“â€¦ Sukses!\nData karyawan dan titik koordinat GPS dari Admin telah berhasil diterapkan ke HP ini.\nTotal: ${(db.mbi_users?.length || 0) + (db.mai_users?.length || 0)} akun aktif dan siap login!`);
   } catch (err) {
    alert('Kode database tidak valid: ' + err.message);
   }
  }

  // =========================================================
  // PENDAFTARAN AKUN (MANDIRI & OTOMATIS)
  // =========================================================
  function handleRegister(e) {
   e.preventDefault();
   const warehouse = document.querySelector('input[name="reg-warehouse"]:checked').value;
   const position = document.getElementById('reg-position').value;
   const name = document.getElementById('reg-name').value.trim();
   const dept = document.getElementById('reg-dept').value;
   const outsource = document.getElementById('reg-outsource').value.trim();
   const phone = document.getElementById('reg-phone').value.trim();
   const joinDate = document.getElementById('reg-joindate').value;

   const autoNik = generateUniqueNIK(warehouse, name);
   const defaultPass = 'medika123';

   const users = getWhDB(warehouse, 'users', warehouse === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);

   const newUser = {
    id: `${warehouse.toLowerCase()}-${Date.now()}`,
    name, dept, outsource, phone, joinDate, nik: autoNik, role: position, password: defaultPass, isFirstLogin: true, warehouse
   };

   users.push(newUser);
   setWhDB(warehouse, 'users', users);

   newlyCreatedUser = newUser;
   showAccountCreatedModal(newUser);
  }

  function showAccountCreatedModal(user) {
   document.getElementById('created-acc-name').innerText = user.name;
   document.getElementById('created-acc-nik').innerText = user.nik;
   document.getElementById('created-acc-wh').innerText = `Gudang ${user.warehouse}`;
   document.getElementById('created-acc-pass').innerText = user.password || 'medika123';
   document.getElementById('account-created-modal').classList.remove('hidden');
   lucide.createIcons();
  }

  function quickLoginCreatedAccount() {
   document.getElementById('account-created-modal').classList.add('hidden');
   if (newlyCreatedUser) {
    if (typeof showAuthTab === 'function') showAuthTab('login');
    const idInput = document.getElementById('login-identifier');
    const passInput = document.getElementById('login-password');
    if (idInput) idInput.value = newlyCreatedUser.nik;
    if (passInput) passInput.value = newlyCreatedUser.password || 'medika123';
    const whRadio = document.querySelector(`input[name="login-warehouse"][value="${newlyCreatedUser.warehouse}"]`);
    if (whRadio) {
     whRadio.checked = true;
     updateLoginWhStyle();
    }
   }
  }
  window.mainHandleLogin = handleLogin;
  window.handleLogin = handleLogin;
  window.loginUserSession = loginUserSession;

  function loginUserSession(user) {
   try {
    if (!user) return;
    // Selalu cari data karyawan paling mutakhir dari database agar nama hasil edit langsung sinkron
    const currentWh = user.warehouse || activeWarehouse || 'MBI';
    const allUsers = getWhDB(currentWh, 'users', currentWh === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);
    const latestUser = allUsers.find(u => (user.id && u.id === user.id) || (user.nik && u.nik === user.nik) || (user.name && cleanStr(u.name) === cleanStr(user.name))) || user;

    currentUser = { ...latestUser };
    if (isUserAdmin(user)) {
     currentUser.warehouse = currentWh;
     currentUser.accessibleWarehouses = [currentWh];
     const adminSeedPerms = currentWh === 'MAI' ? SEED_MAI_USERS[0].permissions : SEED_MBI_USERS[0].permissions;
     currentUser.permissions = {
      ...(adminSeedPerms || {}),
      ...(currentUser.permissions || {}),
      perm_wh_mbi: (currentWh === 'MBI'),
      perm_wh_mai: (currentWh === 'MAI'),
      perm_wh_switch: false
     };
    } else {
     currentUser.warehouse = currentUser.warehouse || currentWh || 'MBI';
    }
    activeWarehouse = currentUser.warehouse;
    try { updateWhSwitcherButtons(); } catch(e) {}

    // Pastikan hak akses tersimpan dimuat ke sesi secara lengkap
    const savedPerms = getSavedUserPerms(currentUser.nik || currentUser.id, currentUser.warehouse);
    if (savedPerms && typeof savedPerms === 'object') {
     currentUser.permissions = { ...(currentUser.permissions || {}), ...savedPerms };
    }
    if (isUserAdmin(currentUser)) {
     if (!currentUser.permissions) currentUser.permissions = {};
     currentUser.permissions.perm_wh_mbi = (currentUser.warehouse === 'MBI');
     currentUser.permissions.perm_wh_mai = (currentUser.warehouse === 'MAI');
     currentUser.permissions.perm_wh_switch = false;
    }

    try {
     localStorage.setItem('wfm_active_session', JSON.stringify(currentUser));
    } catch(e) {}

    const authContainer = document.getElementById('auth-container');
    const appContainer = document.getElementById('app-container');
    if (authContainer) {
     authContainer.classList.add('hidden');
     authContainer.classList.remove('flex');
     authContainer.style.display = 'none';
    }
    if (appContainer) {
     appContainer.classList.remove('hidden');
     appContainer.classList.add('flex');
     appContainer.style.display = 'flex';
    }

    if (isUserScanner(currentUser)) {
     currentUser.name = 'Scanner Presensi Gudang';
     const navName = document.getElementById('nav-user-name');
     const navDept = document.getElementById('nav-user-dept');
     if (navName) navName.innerText = 'Scanner Presensi Gudang';
     if (navDept) navDept.innerText = 'POS SCANNER PRESENSI';
    } else if (isUserManager(currentUser)) {
     const navName = document.getElementById('nav-user-name');
     const navDept = document.getElementById('nav-user-dept');
     if (navName) navName.innerText = currentUser.name || 'Manager';
     if (navDept) navDept.innerText = 'GENERAL MANAGER';
    } else {
     const navName = document.getElementById('nav-user-name');
     const navDept = document.getElementById('nav-user-dept');
     if (navName) navName.innerText = currentUser.name || 'User';
     if (navDept) navDept.innerText = `${(currentUser.dept || 'STAFF').toUpperCase()} - ${(currentUser.role || 'STAFF').toUpperCase()}`;
    }
    
    const whBadge = document.getElementById('user-warehouse-badge');
    if (whBadge) {
     whBadge.innerText = `GUDANG ${currentUser.warehouse}`;
     whBadge.className = 'px-2 py-0.5 text-[10px] font-bold rounded bg-slate-100 text-slate-800 border border-slate-200';
    }

    const roleBadge = document.getElementById('user-role-badge');
    if (roleBadge) roleBadge.innerText = (currentUser.role || 'STAFF').toUpperCase();

    const userRole = (currentUser.role || 'staff').toLowerCase();
    const isManagement = ['coordinator', 'supervisor', 'admin', 'manager'].includes(userRole) || isUserManager(currentUser) || isUserAdmin(currentUser) || isUserSupervisor(currentUser) || isUserCoordinator(currentUser);

    // Terapkan jam digital real-time & visibility hak akses seketika
    try { updateRealtimeDashboardDate(); if (!window._globalClockInterval) window._globalClockInterval = setInterval(updateRealtimeDashboardDate, 1000); } catch(e) {}
    try { applyRolePermissions(); } catch (e) { console.warn('applyRolePermissions error:', e); }
    try { updateNavbarBrand(currentUser.warehouse); } catch (e) { console.warn('updateNavbarBrand error:', e); }

    // Sinkronisasi hak akses tersimpan (fallback) jika belum ada di sesi
    if (!currentUser.permissions || Object.keys(currentUser.permissions).length === 0) {
     const savedPerms = getSavedUserPerms(currentUser.nik || currentUser.id, currentUser.warehouse);
     if (savedPerms && typeof savedPerms === 'object') {
      currentUser.permissions = savedPerms;
      try { localStorage.setItem('wfm_active_session', JSON.stringify(currentUser)); } catch(e) {}
      try { applyRolePermissions(); } catch(e) {}
     }
    }

    if (isUserScanner(currentUser)) {
     // Akun Scanner Absensi (MBI & MAI): ZERO EGRESS MODE (Hemat 99.9% Kuota)
     try { switchView('attendance'); } catch (e) {}
     try { renderScannerTodayRecords(); } catch (e) {}
     try { stopScanner(); } catch (e) {}
     const scanWh = (currentUser.warehouse || activeWarehouse || 'MBI').toUpperCase();
     (async () => {
      try {
       // HP Scanner HANYA tarik data hari ini (hanya 1-2 KB, BUKAN 2.5 MB riwayat lama!)
       const todayStr = (typeof getLocalDateString === 'function') ? getLocalDateString(new Date()) : '';
       if (typeof pullAttendanceFromSupabase === 'function' && todayStr) {
        await pullAttendanceFromSupabase(scanWh, todayStr);
       }
       window._cloudAttInitialSyncDone = window._cloudAttInitialSyncDone || {};
       window._cloudAttInitialSyncDone[scanWh] = true;
       renderScannerTodayRecords();
       if (typeof flushAttendanceOutbox === 'function') flushAttendanceOutbox();
      } catch(eScanSync) {
       console.warn('Scanner lightweight cloud sync notice:', eScanSync);
      }
     })();
    } else if (isManagement) {
     // Akun Management (Coordinator, Supervisor, Admin, Manager)
     try { updateWhSwitcherButtons(); } catch (e) {}
     try { initFirebaseLiveStream(currentUser.warehouse); } catch(e) {}
     try { switchView('dashboard'); } catch (e) {}

     // Sinkronisasi data menyeluruh untuk Akun Management di perangkat manapun
     const wh = (currentUser.warehouse || activeWarehouse || 'MBI').toUpperCase();
     (async () => {
      try {
       // 1. Tarik snapshot master, arsip, dan presensi hari ini dari Cloud Firestore (1x terpadu hemat kuota)
       await fetchFullDatabaseFromCloud(false, wh, false);

       // 2. Fallback arsip hanya jika riwayat lokal masih kosong / minim (< 50)
       const localAtt = getWhDB(wh, 'attendance', []);
       if (localAtt.length < 50) {
        await syncAttendanceArchiveFromCloud(wh, false);
       }

       // 4. Bersihkan status Miss Scan palsu pada record yang sudah punya jam pulang sah
       try { sanitizeAttendanceDatabase(wh); } catch(eSan) {}
       window._cloudAttInitialSyncDone = window._cloudAttInitialSyncDone || {};
       window._cloudAttInitialSyncDone[wh] = true;

       // 5. Segarkan ringkasan dashboard aktif (tanpa merender tabel berat yang tersembunyi)
       if (typeof refreshAllDashboardData === 'function') refreshAllDashboardData();
       if (typeof flushAttendanceOutbox === 'function') setTimeout(flushAttendanceOutbox, 3000);

       // Jika Manager, tarik snapshot gudang lainnya di latar belakang
       if (isUserManager(currentUser)) {
        const otherWh = wh === 'MBI' ? 'MAI' : 'MBI';
        fetchFullDatabaseFromCloud(false, otherWh, false).catch(() => {});
        window._cloudAttInitialSyncDone[otherWh] = true;
       }
      } catch(ePull) {
       console.warn('Cross-device management initial data pull notice:', ePull);
      }
     })();
    } else {
     // Akun Karyawan Biasa: ZERO EGRESS MODE (Hanya tarik data hari ini jika diperlukan)
     try { switchView('attendance'); } catch (e) {}
     const todayStr = (typeof getLocalDateString === 'function') ? getLocalDateString(new Date()) : '';
     if (typeof pullAttendanceFromSupabase === 'function' && todayStr) {
      pullAttendanceFromSupabase(currentUser.warehouse, todayStr).catch(() => {});
     }
    }

    try { resetVerificationState(); } catch (e) {}
    try { setAttendanceType('check_in'); } catch (e) {}
    try { updateRegisteredCoordsDisplay(); } catch (e) {}
    try { renderScannerTodayRecords(); } catch (e) {}
    
    try {
     if (typeof refreshAllDashboardData === 'function') refreshAllDashboardData();
     if (typeof safeCreateIcons === 'function') safeCreateIcons();
     else if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
    } catch (renderErr) {
     console.warn('Non-blocking render error after login:', renderErr);
    }

    // Jalankan pengawas inaktivitas 45 menit (Khusus Admin/Manager/Staff, Pos Scanner tetap 24 Jam)
    try { startInactivityTracker(); } catch (e) {}
   } catch (fatalErr) {
    console.error('Fatal login error:', fatalErr);
    const authContainer = document.getElementById('auth-container');
    const appContainer = document.getElementById('app-container');
    if (authContainer) {
     authContainer.classList.add('hidden');
     authContainer.classList.remove('flex');
     authContainer.style.display = 'none';
    }
    if (appContainer) {
     appContainer.classList.remove('hidden');
     appContainer.classList.add('flex');
     appContainer.style.display = 'flex';
    }
    try { switchView('dashboard'); } catch (e) {}
   }
  }

  // =========================================================
  // FITUR AUTO-LOGOUT 45 MENIT INACTIVITY (NON-SCANNER)
  // =========================================================
  const INACTIVITY_TIMEOUT_MS = 45 * 60 * 1000; // 45 Menit
  let inactivityTimer = null;
  let lastUserActivityTimestamp = Date.now();

  function recordUserInteraction() {
   lastUserActivityTimestamp = Date.now();
   try {
    localStorage.setItem('wfm_last_user_interaction', String(lastUserActivityTimestamp));
   } catch(e) {}
  }

  function startInactivityTracker() {
   stopInactivityTracker();
   if (!currentUser) {
    return;
   }
   recordUserInteraction();

   window.addEventListener('mousemove', recordUserInteraction, { passive: true });
   window.addEventListener('mousedown', recordUserInteraction, { passive: true });
   window.addEventListener('keydown', recordUserInteraction, { passive: true });
   window.addEventListener('touchstart', recordUserInteraction, { passive: true });
   window.addEventListener('scroll', recordUserInteraction, { passive: true });

   inactivityTimer = setInterval(() => {
    if (!currentUser) {
     stopInactivityTracker();
     return;
    }
    const lastSaved = parseInt(localStorage.getItem('wfm_last_user_interaction') || '0', 10);
    const lastActivity = Math.max(lastUserActivityTimestamp, isNaN(lastSaved) ? 0 : lastSaved);
    if (Date.now() - lastActivity >= INACTIVITY_TIMEOUT_MS) {
     console.warn('[Security Shield] Sesi login Admin/Manager otomatis berakhir karena tidak ada aktivitas selama 45 menit.');
     handleLogout();
    }
   }, 60000);
  }

  function stopInactivityTracker() {
   if (inactivityTimer) {
    clearInterval(inactivityTimer);
    inactivityTimer = null;
   }
   window.removeEventListener('mousemove', recordUserInteraction);
   window.removeEventListener('mousedown', recordUserInteraction);
   window.removeEventListener('keydown', recordUserInteraction);
   window.removeEventListener('touchstart', recordUserInteraction);
   window.removeEventListener('scroll', recordUserInteraction);
  }

  function handleLogout() {
   stopInactivityTracker();
   currentUser = null;
   try {
    localStorage.removeItem('wfm_active_session');
    localStorage.removeItem('wfm_last_user_interaction');
   } catch(e) {}
   const authContainer = document.getElementById('auth-container');
   const appContainer = document.getElementById('app-container');
   if (appContainer) {
    appContainer.classList.add('hidden');
    appContainer.classList.remove('flex');
    appContainer.style.display = 'none';
   }
   if (authContainer) {
    authContainer.classList.remove('hidden');
    authContainer.classList.add('flex');
    authContainer.style.display = 'flex';
   }
   try { stopScanner(); } catch(e) {}
  }

  function switchActiveWarehouse(wh) {
   const targetWh = (wh || 'MBI').toUpperCase();
   const canMulti = canAccessMultiWarehouse(currentUser);
   const userWh = (currentUser ? currentUser.warehouse : activeWarehouse) || 'MBI';
   let canTarget = false;
   if (canMulti) {
    canTarget = (targetWh === 'MBI') ? hasPermission('perm_wh_mbi') : hasPermission('perm_wh_mai');
    if (!hasPermission('perm_wh_mbi') && !hasPermission('perm_wh_mai')) canTarget = true;
   } else {
    if (targetWh === 'MBI') {
     canTarget = (hasPermission('perm_wh_mbi') && !hasPermission('perm_wh_mai')) || (userWh === 'MBI' && !hasPermission('perm_wh_mai'));
    } else {
     canTarget = (hasPermission('perm_wh_mai') && !hasPermission('perm_wh_mbi')) || (userWh === 'MAI' && !hasPermission('perm_wh_mbi'));
    }
   }
   if (!canTarget) {
    alert('Akses Ditolak: Akun Anda tidak memiliki izin untuk membuka Gudang ' + targetWh + '.');
    return;
   }
   activeWarehouse = targetWh;
   try { initFirebaseLiveStream(targetWh); } catch(e) {}
   try {
    if (typeof lastKnownFirestoreSignal !== 'undefined') lastKnownFirestoreSignal[targetWh] = '';
   } catch(e) {}
   updateNavbarBrand(targetWh);
   updateWhSwitcherButtons();
   refreshAllDashboardData();
   renderEmployeeTable();
   renderRecordsTable();
   populateMatrixOSDropdown(false);
   renderMatrixTable();
   renderLeavesTable();
   renderOvertimeTable();
   populateDropdownEmployees();
   renderOvertimeEmployeeGrid();
   populatePermissionAccountDropdown();
   latestCachedGPS = null;
   updateRegisteredCoordsDisplay();
   try { syncGPSCoordsFromFirestore(targetWh).then(() => updateRegisteredCoordsDisplay()).catch(() => {}); } catch(e) {}
   (async () => {
    try {
     await fetchFullDatabaseFromCloud(false, targetWh, true);
    } catch(eCloudSw) {}
    try {
     await syncAttendanceFromGoogleSheetMaster(false, targetWh);
    } catch(eGsSw) {}
    try { sanitizeAttendanceDatabase(targetWh); } catch(eSanSw) {}
    window._cloudAttInitialSyncDone = window._cloudAttInitialSyncDone || {};
    window._cloudAttInitialSyncDone[targetWh] = true;
    try {
     if (activeWarehouse === targetWh) {
      clearWhDBCache();
      renderAllLiveScreens();
      refreshAllDashboardData();
      renderEmployeeTable();
      renderRecordsTable();
      renderMatrixTable();
      renderLeavesTable();
      renderOvertimeTable();
     }
    } catch(eRenSw) {}
   })();
   resetVerificationState();
   try { updateFirebaseUrlUI(); } catch(e) {}
   lucide.createIcons();
  }

  function updateWhSwitcherButtons() {
   const isMBI = activeWarehouse === 'MBI';
   const btnMbi = document.getElementById('wh-btn-mbi');
   const btnMai = document.getElementById('wh-btn-mai');
   const whSwitcher = document.getElementById('wh-switcher-box');

   const canMulti = canAccessMultiWarehouse(currentUser);
   const userWh = (currentUser ? currentUser.warehouse : activeWarehouse) || 'MBI';
   let canMbi = false;
   let canMai = false;

   if (canMulti) {
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

   if (!canMulti) {
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
     btnMbi.className = isMBI ? 'px-3 py-1 rounded-lg text-xs font-bold bg-slate-900 text-white shadow-2xs' : 'px-3 py-1 rounded-lg text-xs font-bold text-slate-600 hover:text-slate-900';
     btnMbi.style.display = '';
    } else {
     btnMbi.className = 'hidden';
     btnMbi.style.display = 'none';
    }
   }

   if (btnMai) {
    if (canMai) {
     btnMai.className = !isMBI ? 'px-3 py-1 rounded-lg text-xs font-bold bg-slate-900 text-white shadow-2xs' : 'px-3 py-1 rounded-lg text-xs font-bold text-slate-600 hover:text-slate-900';
     btnMai.style.display = '';
    } else {
     btnMai.className = 'hidden';
     btnMai.style.display = 'none';
    }
   }

   if (whSwitcher) {
    if (isUserScanner(currentUser)) {
     whSwitcher.classList.add('hidden');
     whSwitcher.classList.remove('flex');
    } else {
     whSwitcher.classList.remove('hidden');
     whSwitcher.classList.add('flex');
    }
   }
   
   const dashLabel = document.getElementById('dash-wh-label');
   if (dashLabel) dashLabel.innerText = activeWarehouse;
   const statNote = document.getElementById('stat-wh-note');
   if (statNote) statNote.innerText = `Gudang ${activeWarehouse}`;
   const empTitle = document.getElementById('emp-wh-title');
   if (empTitle) empTitle.innerText = activeWarehouse;
   const attLabel = document.getElementById('att-wh-label');
   if (attLabel) attLabel.innerText = `Gudang ${activeWarehouse}`;
   const repTitle = document.getElementById('reports-wh-title');
   if (repTitle) repTitle.innerText = `Gudang ${activeWarehouse}`;
   const leaveLabel = document.getElementById('leave-wh-label');
   if (leaveLabel) leaveLabel.innerText = `Gudang ${activeWarehouse}`;
   const otLabel = document.getElementById('ot-wh-label');
   if (otLabel) otLabel.innerText = `Gudang ${activeWarehouse}`;
  }

  // =========================================================
  // FITUR MINIMIZE / COLLAPSIBLE SIDEBAR & CARDS
  // =========================================================
  function toggleSidebarCollapse() {
   const sidebar = document.getElementById('app-sidebar');
   if (!sidebar) return;
   sidebar.classList.toggle('is-collapsed');
   const isCollapsed = sidebar.classList.contains('is-collapsed');
   localStorage.setItem('wfm_sidebar_collapsed', isCollapsed ? 'true' : 'false');
   
   const toggleBtn = document.getElementById('btn-toggle-sidebar');
   if (toggleBtn) {
    toggleBtn.innerHTML = isCollapsed 
     ? '<i data-lucide="chevrons-right" class="w-4 h-4"></i>'
     : '<i data-lucide="chevrons-left" class="w-4 h-4"></i>';
   }
   lucide.createIcons();
  }

  function initSidebarState() {
   const saved = localStorage.getItem('wfm_sidebar_collapsed');
   const sidebar = document.getElementById('app-sidebar');
   const toggleBtn = document.getElementById('btn-toggle-sidebar');
   if (saved === 'true' && sidebar) {
    sidebar.classList.add('is-collapsed');
    if (toggleBtn) {
     toggleBtn.innerHTML = '<i data-lucide="chevrons-right" class="w-4 h-4 flex-shrink-0"></i>';
    }
   }
   lucide.createIcons();
  }

  function toggleFilterCard(bodyId, btnEl) {
   const body = document.getElementById(bodyId);
   if (!body) return;
   body.classList.toggle('hidden');
   const isHidden = body.classList.contains('hidden');
   
   const label = btnEl.querySelector('.card-toggle-text');
   const icon = btnEl.querySelector('.card-toggle-icon');
   if (label) {
    label.innerText = isHidden ? 'Buka Filter' : 'Sembunyikan Filter';
   }
   if (icon) {
    icon.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
   }
   lucide.createIcons();
  }

  function toggleMobileSidebar() {
   const sb = document.getElementById('app-sidebar');
   const bd = document.getElementById('mobile-sidebar-backdrop');
   if (!sb) return;
   const isOpen = sb.classList.contains('is-mobile-open');
   if (isOpen) {
    sb.classList.remove('is-mobile-open');
    if (bd) bd.classList.add('hidden');
   } else {
    sb.classList.add('is-mobile-open');
    if (bd) bd.classList.remove('hidden');
   }
  }
  window.toggleMobileSidebar = toggleMobileSidebar;

  function closeMobileSidebar() {
   const sb = document.getElementById('app-sidebar');
   const bd = document.getElementById('mobile-sidebar-backdrop');
   if (sb) sb.classList.remove('is-mobile-open');
   if (bd) bd.classList.add('hidden');
  }
  window.closeMobileSidebar = closeMobileSidebar;

  function switchView(viewName) {
   try {
    const isScanner = isUserScanner(currentUser);
    const isAdmin = isUserAdmin(currentUser);
    const isManager = isUserManager(currentUser);
    const userRole = (currentUser?.role || 'staff').toLowerCase().trim();
    const isSpv = isUserSupervisor(currentUser) || userRole === 'supervisor' || userRole === 'coordinator';
    const isManagement = ['coordinator', 'supervisor', 'admin', 'manager'].includes(userRole) || isManager || isSpv;
    
    if (isScanner) {
     viewName = 'attendance';
    } else if (viewName === 'permissions') {
     if (!isAdmin && !hasPermission('perm_sys_manage_permissions')) {
      alert('Akses Ditolak: Anda tidak memiliki izin untuk mengelola hak akses akun.');
      viewName = isManagement ? 'dashboard' : 'attendance';
     }
    } else if (viewName === 'github' || viewName === 'cloud') {
     if (!isAdmin && !hasPermission('perm_sys_cloud_sync')) {
      alert('Akses Ditolak: Fitur Database Cloud 24/7 hanya dapat diakses dengan izin Cloud Database.');
      viewName = isManagement ? 'dashboard' : 'attendance';
     }
    } else if (viewName === 'employees') {
     if (!isAdmin && !hasPermission('perm_emp_view') && !hasPermission('perm_emp_add')) {
      alert('Akses Ditolak: Anda tidak memiliki izin untuk membuka menu Data Karyawan.');
      viewName = isManagement ? 'dashboard' : 'attendance';
     }
    } else if (viewName === 'leaves') {
     if (!isAdmin && !hasPermission('perm_submit_leave_staff') && !hasPermission('perm_approve_leave_spv') && !hasPermission('perm_approve_leave_mgr')) {
      alert('Akses Ditolak: Anda tidak memiliki izin untuk mengakses Form Pengajuan Sakit/Cuti.');
      viewName = isManagement ? 'dashboard' : 'attendance';
     }
    } else if (viewName === 'overtime') {
     if (!isAdmin && !hasPermission('perm_submit_batch_ot') && !hasPermission('perm_approve_ot_spv') && !hasPermission('perm_approve_ot_mgr') && !hasPermission('perm_rep_ot')) {
      alert('Akses Ditolak: Anda tidak memiliki izin untuk mengakses menu Input & Rekap Lembur.');
      viewName = isManagement ? 'dashboard' : 'attendance';
     }
    } else if (viewName === 'reports-group') {
     if (!isAdmin && !hasPermission('perm_rep_records') && !hasPermission('perm_rep_matrix') && !hasPermission('perm_rep_workhours') && !hasPermission('perm_rep_leaves') && !hasPermission('perm_rep_ot')) {
      alert('Akses Ditolak: Anda tidak memiliki izin untuk mengakses Laporan & Rekap Absensi.');
      viewName = isManagement ? 'dashboard' : 'attendance';
     }
    } else if (viewName === 'idcard') {
     if (!isAdmin && !hasPermission('perm_idcard_single') && !hasPermission('perm_idcard_batch_a4') && !hasPermission('perm_idcard_qr_location')) {
      alert('Akses Ditolak: Anda tidak memiliki izin untuk mengakses menu Kartu ID Karyawan.');
      viewName = isManagement ? 'dashboard' : 'attendance';
     }
    } else if (!isManagement && viewName !== 'attendance' && viewName !== 'settings') {
     viewName = 'attendance';
    }

    // 1. Tampilkan Panel View Baru & Sembunyikan Panel Sebelumnya Seketika (0ms)
    const prevActivePanel = document.querySelector('.view-panel:not(.hidden)');
    if (prevActivePanel && prevActivePanel.id !== 'view-' + viewName) {
     prevActivePanel.classList.add('hidden');
    }
    const activeView = document.getElementById('view-' + viewName) || document.getElementById('view-dashboard') || document.getElementById('view-attendance');
    if (activeView) activeView.classList.remove('hidden');

    // 2. Perbarui Tombol Sidebar Aktif Secara Efisien (Hanya elemen yang berubah)
    document.querySelectorAll('.sidebar-link.is-active').forEach(el => {
     el.classList.remove('is-active');
     el.className = 'sidebar-link w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white transition flex items-center gap-2.5';
    });
    const activeNav = document.getElementById('nav-' + viewName);
    if (activeNav) {
     activeNav.classList.add('is-active');
     activeNav.className = 'sidebar-link is-active w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold text-white shadow-sm transition flex items-center gap-2.5';
    }

    // 3. Update Navigasi Bawah Layar HP (Mobile Bottom Nav) & Tutup Drawer Menu
    try {
     ['dashboard', 'attendance', 'leaves', 'overtime'].forEach(tab => {
      const btn = document.getElementById('mob-nav-' + tab);
      if (btn) {
       if (tab === viewName) {
        btn.className = 'flex flex-col items-center justify-center p-1.5 rounded-xl text-slate-900 transition flex-1 cursor-pointer font-bold';
       } else {
        btn.className = 'flex flex-col items-center justify-center p-1.5 rounded-xl text-slate-500 hover:text-slate-900 transition flex-1 cursor-pointer font-normal';
       }
      }
     });
     if (typeof closeMobileSidebar === 'function') closeMobileSidebar();
    } catch(e) {}

    // 4. Bebaskan Hardware Kamera Scanner di Latar Belakang (Non-blocking)
    if (viewName !== 'attendance') {
     try {
      if (typeof stopScanner === 'function') {
       setTimeout(() => { stopScanner().catch(() => {}); }, 0);
      }
     } catch(e) {}
    }

    // 5. Jadwalkan Komputasi Render Data Berat di Frame Berikutnya (60 FPS Smooth Navigation)
    const runViewRender = () => {
     try { applyRolePermissions(); } catch(e) {}

     if (viewName === 'permissions') {
      try { renderPermissionEditor(); } catch(e) {}
     } else if (viewName === 'attendance') {
      try {
       const attLabel = document.getElementById('att-wh-label');
       if (attLabel) attLabel.innerText = `Gudang ${activeWarehouse}`;
      } catch(e) {}
      try { setAttendanceType('check_in'); } catch(e) {}
      try { renderScannerTodayRecords(); } catch(e) {}
      try { switchScanMethod('camera'); } catch(e) {}
      try { updateRegisteredCoordsDisplay(); } catch(e) {}
      try { preloadGPSLocation(); } catch(e) {}
      try { resetVerificationState(); } catch(e) {}
     } else if (viewName === 'employees') {
      try { renderEmployeeTable(); } catch(e) {}
     } else if (viewName === 'reports-group') {
      try {
       const targetTab = activeReportTab || 'records';
       const curAtt = getWhDB(activeWarehouse, 'attendance', []);
       if (curAtt.length < 100 && typeof pullAttendanceFromFirestore === 'function') {
        pullAttendanceFromFirestore(activeWarehouse, false).then(() => {
         switchReportTab(targetTab);
        });
       } else {
        switchReportTab(targetTab);
       }
      } catch(e) {}
     } else if (viewName === 'leaves') {
      try { filterLeaveEmployeeDropdown(document.getElementById('leave-emp-search-input')?.value || ''); } catch(e) {}
      try { renderLeavesTable(); } catch(e) {}
     } else if (viewName === 'overtime') {
      try {
       renderOvertimeEmployeeGrid();
       renderOvertimeTable();
       calculateOvertimeNominal();
      } catch(e) {}
     } else if (viewName === 'idcard') {
      try {
       populateDropdownEmployees();
       renderSelectedIDCard();
       updateRegisteredCoordsDisplay();
      } catch(e) {}
     } else if (viewName === 'settings') {
      try { renderAccountSettingsForm(); } catch(e) {}
     } else if (viewName === 'github') {
      try { renderGitHubConfig(); } catch(e) {}
      try { updateFirebaseUrlUI(); } catch(e) {}
     } else if (viewName === 'dashboard') {
      try {
       const curAtt = getWhDB(activeWarehouse, 'attendance', []);
       if (curAtt.length === 0 && typeof pullAttendanceFromFirestore === 'function') {
        pullAttendanceFromFirestore(activeWarehouse, false).then(() => {
         refreshAllDashboardData();
        });
       } else {
        refreshAllDashboardData();
       }
      } catch(e) {}
     }

     try {
      if (typeof safeCreateIcons === 'function') safeCreateIcons({ root: activeView });
      else if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons({ root: activeView });
     } catch(e) {}
    };

    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
     requestAnimationFrame(runViewRender);
    } else {
     runViewRender();
    }
   } catch (err) {
    console.warn('switchView error:', err);
    const fallbackView = document.getElementById('view-' + viewName) || document.getElementById('view-dashboard') || document.getElementById('view-attendance');
    if (fallbackView) fallbackView.classList.remove('hidden');
   }
  }

  let _lastClockDay = -1;
  let _cachedDateStr = '';
  function updateRealtimeDashboardDate() {
   const now = new Date();
   const curDay = now.getDate();
   const dateEl = document.getElementById('dash-date-text');
   if (dateEl) {
    if (curDay !== _lastClockDay || !_cachedDateStr) {
     _lastClockDay = curDay;
     _cachedDateStr = now.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
     });
    }
    dateEl.innerText = _cachedDateStr;
   }
   const hh = String(now.getHours()).padStart(2, '0');
   const mm = String(now.getMinutes()).padStart(2, '0');
   const ss = String(now.getSeconds()).padStart(2, '0');
   const timeStr = `${hh}:${mm}:${ss} WIB`;

   const timeEl = document.getElementById('dash-time-text');
   if (timeEl) timeEl.innerText = timeStr;
   const liveClockEl = document.getElementById('live-clock');
   if (liveClockEl) liveClockEl.innerText = timeStr;
  }

  function navigateToPendingApproval(type) {
   const canApprove = hasPermission('perm_approve_leave_spv') || 
             hasPermission('perm_approve_leave_mgr') || 
             hasPermission('perm_approve_ot_spv') || 
             hasPermission('perm_approve_ot_mgr') || 
             (currentUser && (isUserAdmin(currentUser) || isUserManager(currentUser) || isUserSupervisor(currentUser)));

   if (!canApprove) {
    alert("Akses Ditolak: Anda tidak memiliki hak akses persetujuan (approval). Hubungi Administrator.");
    return;
   }

   if (type === 'cuti' || type === 'sakit') {
    switchView('leaves');
    if (typeof filterLeaveTypeTab === 'function') {
     filterLeaveTypeTab(type);
    }
    const searchInput = document.getElementById('leave-table-search');
    if (searchInput) searchInput.value = '';
    renderLeavesTable();

    setTimeout(() => {
     const tableCard = document.getElementById('leave-table-body')?.closest('.bg-white');
     if (tableCard) {
      tableCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
     }
    }, 120);
   } else if (type === 'overtime') {
    switchView('overtime');
    const filterStatus = document.getElementById('ot-filter-status');
    if (filterStatus) {
     filterStatus.value = 'pending_all';
    }
    const searchInput = document.getElementById('ot-filter-search');
    if (searchInput) searchInput.value = '';
    const filterStart = document.getElementById('ot-filter-start');
    if (filterStart) filterStart.value = '';
    const filterEnd = document.getElementById('ot-filter-end');
    if (filterEnd) filterEnd.value = '';
    renderOvertimeTable();

    setTimeout(() => {
     const tableCard = document.getElementById('ot-table-body')?.closest('.bg-white');
     if (tableCard) {
      tableCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
     }
    }, 120);
   }
  }

  let lastRecordsRenderTime = 0;
  function refreshAllDashboardData() {
   updateRealtimeDashboardDate();
   const todayStr = getLocalDateString(new Date());
   const users = getWhDB(activeWarehouse, 'users', activeWarehouse === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);
   const regularUsers = (users || []).filter(u => u && !isManagementSystemAccount(u));
   const attendances = getWhDB(activeWarehouse, 'attendance', activeWarehouse === 'MBI' ? SEED_MBI_ATTENDANCE : SEED_MAI_ATTENDANCE);
   const rawLeaves = getWhDB(activeWarehouse, 'leaves', activeWarehouse === 'MBI' ? SEED_MBI_LEAVES : []);
   const leaves = Array.isArray(rawLeaves) ? rawLeaves.filter(l => l && typeof l === 'object') : [];
   const rawOvertimes = getWhDB(activeWarehouse, 'overtime', activeWarehouse === 'MBI' ? SEED_MBI_OVERTIMES : []);
   const overtimes = Array.isArray(rawOvertimes) ? rawOvertimes.filter(o => o && typeof o === 'object') : [];

   const todayAtt = (attendances || []).filter(a => a && a.date === todayStr && !isAttendanceMarkedDeleted(a));
   const todayLeaves = leaves.filter(l => l && l.status === 'approved' && l.startDate <= todayStr && l.endDate >= todayStr);

   const statTotal = document.getElementById('stat-total-emp');
   if (statTotal) statTotal.innerText = `${regularUsers.length} Orang`;
   const statToday = document.getElementById('stat-today-att');
   if (statToday) statToday.innerText = `${todayAtt.length} Hadir`;

   const statTodaySub = document.getElementById('stat-today-att-sub');
   if (statTodaySub) {
    statTodaySub.innerText = `Gudang ${activeWarehouse} • Presensi Masuk Terverifikasi`;
   }
   const statLeave = document.getElementById('stat-today-leave');
   if (statLeave) statLeave.innerText = `${todayLeaves.length} Orang`;

   const canApproveSpvLeave = hasPermission('perm_approve_leave_spv');
   const canApproveMgrLeave = hasPermission('perm_approve_leave_mgr');
   const canApproveSpvOt = hasPermission('perm_approve_ot_spv');
   const canApproveMgrOt = hasPermission('perm_approve_ot_mgr');

   // 1. Pending Cuti
   let cutiCount = 0;
   let cutiNote = 'Perlu Review';
   if (canApproveMgrLeave) {
    const waitingMgr = leaves.filter(l => l.type === 'cuti' && l.status === 'pending_manager').length;
    const waitingSpv = leaves.filter(l => l.type === 'cuti' && l.status === 'pending').length;
    cutiCount = waitingMgr + waitingSpv;
    if (waitingMgr > 0) {
     cutiNote = `${waitingMgr} Siap Final Manager${waitingSpv > 0 ? ` (${waitingSpv} di SPV)` : ''}`;
    } else if (waitingSpv > 0) {
     cutiNote = `${waitingSpv} Menunggu SPV (Bisa Langsung)`;
    } else {
     cutiNote = 'Semua Selesai Disetujui';
    }
   } else if (canApproveSpvLeave) {
    cutiCount = leaves.filter(l => l.type === 'cuti' && l.status === 'pending').length;
    cutiNote = cutiCount > 0 ? 'Menunggu Persetujuan SPV' : 'Semua Selesai Direview';
   } else {
    cutiCount = leaves.filter(l => l.type === 'cuti' && (l.status === 'pending' || l.status === 'pending_manager')).length;
    cutiNote = cutiCount > 0 ? 'Dalam Proses Approval' : 'Semua Selesai Disetujui';
   }

   // 2. Pending Sakit
   let sakitCount = 0;
   let sakitNote = 'Perlu Review';
   if (canApproveMgrLeave) {
    const waitingMgr = leaves.filter(l => l.type === 'sakit' && l.status === 'pending_manager').length;
    const waitingSpv = leaves.filter(l => l.type === 'sakit' && l.status === 'pending').length;
    sakitCount = waitingMgr + waitingSpv;
    if (waitingMgr > 0) {
     sakitNote = `${waitingMgr} Siap Final Manager${waitingSpv > 0 ? ` (${waitingSpv} di SPV)` : ''}`;
    } else if (waitingSpv > 0) {
     sakitNote = `${waitingSpv} Menunggu SPV (Bisa Langsung)`;
    } else {
     sakitNote = 'Semua Selesai Disetujui';
    }
   } else if (canApproveSpvLeave) {
    sakitCount = leaves.filter(l => l.type === 'sakit' && l.status === 'pending').length;
    sakitNote = sakitCount > 0 ? 'Menunggu Persetujuan SPV' : 'Semua Selesai Direview';
   } else {
    sakitCount = leaves.filter(l => l.type === 'sakit' && (l.status === 'pending' || l.status === 'pending_manager')).length;
    sakitNote = sakitCount > 0 ? 'Dalam Proses Approval' : 'Semua Selesai Disetujui';
   }

   // 3. Pending Lembur
   let otCount = 0;
   let otNote = 'Perlu Review Upah';
   if (canApproveMgrOt) {
    const waitingMgr = overtimes.filter(o => o.status === 'pending_manager').length;
    const waitingSpv = overtimes.filter(o => o.status === 'pending').length;
    otCount = waitingMgr + waitingSpv;
    if (waitingMgr > 0) {
     otNote = `${waitingMgr} Siap Final Manager${waitingSpv > 0 ? ` (${waitingSpv} di SPV)` : ''}`;
    } else if (waitingSpv > 0) {
     otNote = `${waitingSpv} Menunggu SPV (Bisa Langsung)`;
    } else {
     otNote = 'Semua Selesai Disetujui';
    }
   } else if (canApproveSpvOt) {
    otCount = overtimes.filter(o => o.status === 'pending').length;
    otNote = otCount > 0 ? 'Menunggu Persetujuan SPV' : 'Semua Selesai Direview';
   } else {
    otCount = overtimes.filter(o => o.status === 'pending' || o.status === 'pending_manager').length;
    otNote = otCount > 0 ? 'Dalam Proses Approval' : 'Semua Selesai Disetujui';
   }

   // Render Cuti Elements
   const statCuti = document.getElementById('stat-pending-cuti');
   if (statCuti) statCuti.innerText = `${cutiCount} Pending`;
   const badgeCuti = document.getElementById('badge-pending-cuti');
   if (badgeCuti) {
    badgeCuti.innerText = `${cutiCount} Pending`;
    badgeCuti.className = cutiCount > 0 
     ? 'px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300'
     : 'px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-200 text-slate-700 border border-slate-300';
   }
   const noteCuti = document.getElementById('note-pending-cuti');
   if (noteCuti) noteCuti.innerText = cutiNote;
   const cardCuti = document.getElementById('card-pending-cuti');
   if (cardCuti) {
    cardCuti.classList.toggle('border-amber-300', cutiCount > 0);
    cardCuti.classList.toggle('bg-amber-50/40', cutiCount > 0);
   }

   // Render Sakit Elements
   const statSakit = document.getElementById('stat-pending-sakit');
   if (statSakit) statSakit.innerText = `${sakitCount} Pending`;
   const badgeSakit = document.getElementById('badge-pending-sakit');
   if (badgeSakit) {
    badgeSakit.innerText = `${sakitCount} Pending`;
    badgeSakit.className = sakitCount > 0 
     ? 'px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300'
     : 'px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-200 text-slate-700 border border-slate-300';
   }
   const noteSakit = document.getElementById('note-pending-sakit');
   if (noteSakit) noteSakit.innerText = sakitNote;
   const cardSakit = document.getElementById('card-pending-sakit');
   if (cardSakit) {
    cardSakit.classList.toggle('border-amber-300', sakitCount > 0);
    cardSakit.classList.toggle('bg-amber-50/40', sakitCount > 0);
   }

   // Render Lembur Elements
   const statOt = document.getElementById('stat-pending-ot');
   if (statOt) statOt.innerText = `${otCount} Pending`;
   const badgeOt = document.getElementById('badge-pending-ot');
   if (badgeOt) {
    badgeOt.innerText = `${otCount} Pending`;
    badgeOt.className = otCount > 0 
     ? 'px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300'
     : 'px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-200 text-slate-700 border border-slate-300';
   }
   const noteOt = document.getElementById('note-pending-ot');
   if (noteOt) noteOt.innerText = otNote;
   const cardOt = document.getElementById('card-pending-ot');
   if (cardOt) {
    cardOt.classList.toggle('border-amber-300', otCount > 0);
    cardOt.classList.toggle('bg-amber-50/40', otCount > 0);
   }

  }

  // =========================================================