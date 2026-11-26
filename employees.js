// === WFM MEDIKA EMPLOYEE MANAGEMENT ===
  // FITUR DATA KARYAWAN (SESUAI GAMBAR 1) + STATUS AKTIF/NONAKTIF & EXCEL
  // =========================================================
  function renderEmployeeTable() {
   try {
    if (typeof autoPurgeDuplicateAndCorruptEmployees === 'function') autoPurgeDuplicateAndCorruptEmployees();
    const curWh = activeWarehouse || 'MBI';
    let users = getWhDB(curWh, 'users', curWh === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);
    const regularUsers = users.filter(u => !isManagementSystemAccount(u));
    
    // Update live counters in status tabs
    const totalCount = regularUsers.length;
    const activeCount = regularUsers.filter(u => u.status !== 'inactive').length;
    const inactiveCount = regularUsers.filter(u => u.status === 'inactive').length;

    const badgeAll = document.getElementById('tab-count-all');
    const badgeAct = document.getElementById('tab-count-active');
    const badgeInact = document.getElementById('tab-count-inactive');
    if (badgeAll) badgeAll.innerText = totalCount;
    if (badgeAct) badgeAct.innerText = activeCount;
    if (badgeInact) badgeInact.innerText = inactiveCount;

    // PENGURUTAN TETAP & STABIL (STRICT FIXED NIK ASCENDING):
    // Memastikan nomor urut 1, 2, 3... selalu urut dan tidak pernah berubah
    regularUsers.sort((a, b) => {
     const nikA = (a?.nik || a?.id || '').toString().trim().toUpperCase();
     const nikB = (b?.nik || b?.id || '').toString().trim().toUpperCase();
     return nikA.localeCompare(nikB, undefined, { numeric: true, sensitivity: 'base' });
    });

    const query = (document.getElementById('emp-search-input')?.value || '').toLowerCase();
    const filtered = regularUsers.filter(u => {
     const isAct = (u.status !== 'inactive');
     if (activeEmpFilterTab === 'active' && !isAct) return false;
     if (activeEmpFilterTab === 'inactive' && isAct) return false;
     return (u.name && u.name.toLowerCase().includes(query)) || (u.dept && u.dept.toLowerCase().includes(query)) || (u.nik && u.nik.toLowerCase().includes(query)) || (u.email && u.email.toLowerCase().includes(query));
    });

    const tbody = document.getElementById('emp-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    const totalBadge = document.getElementById('emp-total-badge');
    if (totalBadge) totalBadge.innerText = `Total: ${filtered.length} Karyawan (${activeWarehouse})`;

    if (!window.selectedEmployeeNiks) window.selectedEmployeeNiks = new Set();
    updateSelectedEmployeesCount();

    if (filtered.length === 0) {
     tbody.innerHTML = `<tr><td colspan="11" class="p-6 text-center text-slate-400 font-medium">Belum ada data karyawan ${activeEmpFilterTab !== 'all' ? `berstatus ${activeEmpFilterTab === 'active' ? 'Aktif' : 'Nonaktif'}` : ''} di Gudang ${activeWarehouse}.</td></tr>`;
     return;
    }

    const isAdmin = isUserAdmin(currentUser);
    const isManager = isUserManager(currentUser);
    const canEditEmp = isAdmin || isManager || hasPermission('perm_emp_edit');
    const canIdCardSingle = isAdmin || isManager || hasPermission('perm_idcard_single');
    const canDeleteEmp = isAdmin || isManager || hasPermission('perm_emp_delete');

    filtered.forEach((emp, idx) => {
     try {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50 transition border-b border-slate-100';

      const cleanEmpNik = (emp?.nik || '').toString().trim().toUpperCase();
      const isChecked = window.selectedEmployeeNiks && window.selectedEmployeeNiks.has(cleanEmpNik);

      const roleStr = (emp.role || 'staff').toLowerCase().trim();
      const roleBadgeClass = (roleStr === 'supervisor' || roleStr === 'admin') 
       ? 'bg-slate-900 text-white' 
       : (roleStr === 'coordinator' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700 border border-slate-200');

      const displayName = (emp.name && !isLikelyIdNotName(emp.name)) ? emp.name : `Karyawan (${emp.nik})`;
      const osVal = (typeof escapeHTML === 'function') ? escapeHTML(emp.outsource || 'Internal') : (emp.outsource || 'Internal');
      const isAct = (emp.status !== 'inactive');
      const statusBadge = isAct 
       ? '<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-2xs whitespace-nowrap"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>Aktif</span>' 
       : '<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200/80 shadow-2xs whitespace-nowrap"><span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>Nonaktif</span>';

      const toggleStatusBtn = isAct
       ? `<button onclick="toggleEmployeeStatus('${emp.nik}', 'inactive')" title="Nonaktifkan Karyawan" class="h-7 px-2 bg-white hover:bg-amber-50 text-amber-700 hover:border-amber-300 border border-slate-200 rounded-lg text-[11px] font-bold transition shadow-2xs inline-flex items-center gap-1">
         <i data-lucide="user-x" class="w-3 h-3 text-amber-600"></i>
         <span>Nonaktifkan</span>
        </button>`
       : `<button onclick="toggleEmployeeStatus('${emp.nik}', 'active')" title="Aktifkan Kembali Karyawan" class="h-7 px-2 bg-white hover:bg-emerald-50 text-emerald-700 hover:border-emerald-300 border border-slate-200 rounded-lg text-[11px] font-bold transition shadow-2xs inline-flex items-center gap-1">
         <i data-lucide="user-check" class="w-3 h-3 text-emerald-600"></i>
         <span>Aktifkan</span>
        </button>`;

      const checkColHtml = canDeleteEmp
       ? `<input type="checkbox" name="emp-row-check" value="${emp.nik}" ${isChecked ? 'checked' : ''} onchange="toggleEmployeeRowSelection('${emp.nik}', this.checked)" class="w-4 h-4 rounded text-slate-900 focus:ring-slate-900 border-slate-300 cursor-pointer">`
       : `<span class="text-slate-300 font-mono text-xs">-</span>`;

      let actionButtonsHtml = '';
      if (canEditEmp) {
       actionButtonsHtml += `
        <button onclick="openEditEmployeeModal('${emp.nik}')" title="Edit Data Karyawan" class="h-7 px-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-bold transition shadow-2xs inline-flex items-center gap-1">
         <i data-lucide="edit-3" class="w-3 h-3 text-slate-500"></i>
         <span>Edit</span>
        </button>
       `;
      }
      if (canIdCardSingle) {
       actionButtonsHtml += `
        <button onclick="renderIDCardAndShow('${emp.nik}')" title="Cetak ID Card Barcode" class="h-7 px-2 bg-white hover:bg-blue-50 text-blue-700 hover:border-blue-200 border border-slate-200 rounded-lg text-[11px] font-bold transition shadow-2xs inline-flex items-center gap-1">
         <i data-lucide="credit-card" class="w-3 h-3 text-blue-500"></i>
         <span>ID Card</span>
        </button>
       `;
      }
      if (canEditEmp) {
       actionButtonsHtml += toggleStatusBtn;
      }
      if (canDeleteEmp) {
       actionButtonsHtml += `
        <button onclick="deleteSingleEmployee('${emp.nik}')" title="Hapus Karyawan" class="h-7 w-7 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 hover:border-rose-200 rounded-lg transition shadow-2xs inline-flex items-center justify-center">
         <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
        </button>
       `;
      }
      if (!actionButtonsHtml) {
       actionButtonsHtml = `<span class="text-[11px] text-slate-400 font-medium italic">Lihat Saja</span>`;
      }

      tr.innerHTML = `
       <td class="p-3 border-r border-slate-100 text-center">
        ${checkColHtml}
       </td>
       <td class="p-3 border-r border-slate-100 font-mono text-slate-500 font-bold text-center">${idx + 1}</td>
       <td class="p-3 border-r border-slate-100 font-bold text-slate-900">${displayName}<br><span class="text-[10px] font-mono text-slate-400">NIK: ${emp.nik}</span></td>
       <td class="p-3 border-r border-slate-100 font-medium text-slate-700 uppercase font-mono text-[11px]">${emp.dept}</td>
       <td class="p-3 border-r border-slate-100"><span class="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[11px] font-bold text-slate-800">${osVal}</span></td>
       <td class="p-3 border-r border-slate-100 font-mono text-slate-700">${emp.phone || '-'}</td>
       <td class="p-3 border-r border-slate-100 font-mono text-[11px] text-slate-600">${emp.email || '-'}</td>
       <td class="p-3 border-r border-slate-100 font-semibold text-slate-800">${emp.joinDate || '-'}</td>
       <td class="p-3 border-r border-slate-100">
        <span class="px-2.5 py-0.5 rounded text-[10px] font-bold ${roleBadgeClass}">${(emp.role || 'staff').toUpperCase()}</span>
       </td>
       <td class="p-3 border-r border-slate-100 text-center">
        ${statusBadge}
       </td>
       <td class="p-3 text-right">
        <div class="inline-flex items-center justify-end gap-1 whitespace-nowrap">
         ${actionButtonsHtml}
        </div>
       </td>
      `;
      tbody.appendChild(tr);
     } catch (rowErr) {
      console.error('Error rendering employee row:', emp, rowErr);
     }
    });
    if (typeof safeCreateIcons === 'function') safeCreateIcons({ root: tbody });
    else if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
   } catch (err) {
    console.error('Error in renderEmployeeTable:', err);
   }
  }

  async function toggleEmployeeStatus(nik, newStatus) {
   if (!hasPermission('perm_emp_edit') && !isUserAdmin(currentUser) && !isUserManager(currentUser)) {
    alert('Akses Ditolak: Anda tidak memiliki izin untuk mengubah status karyawan.');
    return;
   }
   const cleanNik = (nik || '').trim().toUpperCase();
   const targetWh = activeWarehouse || 'MBI';
   let users = getWhDB(targetWh, 'users', targetWh === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);
   let user = users.find(u => (u.nik || '').toUpperCase() === cleanNik || u.id === nik || cleanStr(u.name) === cleanStr(nik));
   let actualWh = targetWh;

   if (!user) {
    const otherWh = targetWh === 'MBI' ? 'MAI' : 'MBI';
    const otherUsers = getWhDB(otherWh, 'users', []);
    user = otherUsers.find(u => (u.nik || '').toUpperCase() === cleanNik || u.id === nik || cleanStr(u.name) === cleanStr(nik));
    if (user) {
     users = otherUsers;
     actualWh = otherWh;
    }
   }

   if (!user) {
    alert('Data karyawan tidak ditemukan.');
    return;
   }

   if (isManagementSystemAccount(user)) {
    alert('Akun Administrator dan Pos Scanner Utama dilindungi dan tidak dapat dinonaktifkan.');
    return;
   }

   const isActivating = (newStatus === 'active');
   const actionText = isActivating ? 'MENGAKTIFKAN KEMBALI' : 'MENONAKTIFKAN';
   const promptText = `Apakah Anda yakin ingin ${actionText} akun karyawan:\n\n• Nama: ${user.name}\n• NIK: ${user.nik}\n• Gudang: ${actualWh}\n\n${isActivating ? 'Karyawan akan dapat melakukan scan presensi & login kembali.' : 'Karyawan tidak akan dapat scan presensi atau login, namun seluruh riwayat absensi masa lalu tetap tersimpan aman.'}`;

   if (!confirm(promptText)) return;

   user.status = isActivating ? 'active' : 'inactive';
   user.isActive = isActivating;
   user.updatedAt = new Date().toISOString();

   setWhDB(actualWh, 'users', users, true);
   localStorage.setItem(`wfm_${actualWh.toLowerCase()}_users_backup`, JSON.stringify(users));
   const nowIso = new Date().toISOString();
   localStorage.setItem('wfm_last_master_change_time', Date.now().toString());
   localStorage.setItem('wfm_master_updated_at', nowIso);

   await publishInactiveRegistryToCloud(actualWh, users);
   if (typeof saveUserDocToFirestore === 'function') {
    await saveUserDocToFirestore(actualWh, user).catch(() => {});
   }
   await saveFullDatabaseToCloud(false, true, true, actualWh);

   renderEmployeeTable();
   populateDropdownEmployees();
   renderOvertimeEmployeeGrid();
   refreshAllDashboardData();
   renderRecordsTable();
   renderMatrixTable();

   alert(`Å“â€¦ Berhasil ${isActivating ? 'mengaktifkan kembali' : 'menonaktifkan'} karyawan "${user.name}" (${user.nik}).`);
  }

  async function deactivateSelectedEmployees(newStatus = 'inactive') {
   if (!hasPermission('perm_emp_edit') && !isUserAdmin(currentUser) && !isUserManager(currentUser)) {
    alert('Akses Ditolak: Anda tidak memiliki izin untuk mengubah status karyawan.');
    return;
   }
   if (!window.selectedEmployeeNiks || window.selectedEmployeeNiks.size === 0) {
    alert('Pilih minimal 1 karyawan dengan mencentang kotak di tabel.');
    return;
   }

   const selectedNiks = new Set(window.selectedEmployeeNiks);
   const isActivating = (newStatus === 'active');
   const actionText = isActivating ? 'MENGAKTIFKAN KEMBALI' : 'MENONAKTIFKAN';

   if (!confirm(`Apakah Anda yakin ingin ${actionText} ${selectedNiks.size} karyawan terpilih?`)) {
    return;
   }

   const targetWh = activeWarehouse || 'MBI';
   let users = getWhDB(targetWh, 'users', targetWh === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);

   let changedCount = 0;
   users.forEach(u => {
    if (u && u.nik && selectedNiks.has(u.nik.toUpperCase().trim()) && !isManagementSystemAccount(u)) {
     u.status = isActivating ? 'active' : 'inactive';
     u.isActive = isActivating;
     u.updatedAt = new Date().toISOString();
     changedCount++;
    }
   });

   setWhDB(targetWh, 'users', users, true);
   localStorage.setItem(`wfm_${targetWh.toLowerCase()}_users_backup`, JSON.stringify(users));
   const nowIso = new Date().toISOString();
   localStorage.setItem('wfm_last_master_change_time', Date.now().toString());
   localStorage.setItem('wfm_master_updated_at', nowIso);

   await publishInactiveRegistryToCloud(targetWh, users);
   if (typeof saveUserDocToFirestore === 'function') {
    const touched = users.filter(u => u && u.nik && selectedNiks.has(u.nik.toUpperCase().trim()) && !isManagementSystemAccount(u));
    await Promise.allSettled(touched.map(u => saveUserDocToFirestore(targetWh, u)));
   }
   await saveFullDatabaseToCloud(false, true, true, targetWh, true);

   window.selectedEmployeeNiks.clear();
   renderEmployeeTable();
   populateDropdownEmployees();
   renderOvertimeEmployeeGrid();
   refreshAllDashboardData();
   renderRecordsTable();
   renderMatrixTable();

   alert(`Å“â€¦ Berhasil ${isActivating ? 'mengaktifkan kembali' : 'menonaktifkan'} ${changedCount} karyawan terpilih.`);
  }

  function toggleDeptDropdown(type) {
   const menuEl = document.getElementById(type === 'edit' ? 'edit-dept-menu' : 'add-dept-menu');
   const chevronEl = document.getElementById(type === 'edit' ? 'edit-dept-chevron' : 'add-dept-chevron');
   if (!menuEl) return;

   const otherMenu = document.getElementById(type === 'edit' ? 'add-dept-menu' : 'edit-dept-menu');
   const otherChevron = document.getElementById(type === 'edit' ? 'add-dept-chevron' : 'edit-dept-chevron');
   if (otherMenu) otherMenu.classList.add('hidden');
   if (otherChevron) otherChevron.classList.remove('rotate-180');

   const isHidden = menuEl.classList.contains('hidden');
   if (isHidden) {
    menuEl.classList.remove('hidden');
    if (chevronEl) chevronEl.classList.add('rotate-180');
    const activeItem = menuEl.querySelector('.active-dept-item');
    if (activeItem) {
     activeItem.scrollIntoView({ block: 'nearest' });
    }
   } else {
    menuEl.classList.add('hidden');
    if (chevronEl) chevronEl.classList.remove('rotate-180');
   }
   lucide.createIcons();
  }

  function handleModalPositionChange(type, roleVal) {
   if (roleVal === 'supervisor') {
    syncDepartmentDropdownOptions(type, 'supervisor');
   } else if (roleVal === 'coordinator') {
    syncDepartmentDropdownOptions(type, 'coordinator');
   } else {
    syncDepartmentDropdownOptions(type, 'warehouse staff');
   }
   if (type === 'edit') updateEditEmployeeRoleNotice(roleVal);
   else updateAddEmployeeRoleNotice(roleVal);
  }

  function selectDeptItem(type, val, formattedName) {
   const inputEl = document.getElementById(type === 'edit' ? 'edit-emp-dept' : 'm-emp-dept');
   const labelEl = document.getElementById(type === 'edit' ? 'edit-dept-label' : 'add-dept-label');
   const menuEl = document.getElementById(type === 'edit' ? 'edit-dept-menu' : 'add-dept-menu');
   const chevronEl = document.getElementById(type === 'edit' ? 'edit-dept-chevron' : 'add-dept-chevron');

   if (inputEl) inputEl.value = val;
   if (labelEl) labelEl.innerText = formattedName;
   if (menuEl) menuEl.classList.add('hidden');
   if (chevronEl) chevronEl.classList.remove('rotate-180');

   syncDepartmentDropdownOptions(type, val);

   // Sinkronkan pilihan posisi di modal sesuai departemen
   const posSelect = document.getElementById(type === 'edit' ? 'edit-emp-position' : 'm-emp-position');
   if (posSelect) {
    if (val === 'supervisor') posSelect.value = 'supervisor';
    else if (val === 'coordinator') posSelect.value = 'coordinator';
    else posSelect.value = 'staff';
    if (type === 'edit') updateEditEmployeeRoleNotice(posSelect.value);
    else updateAddEmployeeRoleNotice(posSelect.value);
   }
  }

  function syncDepartmentDropdownOptions(typeOrId, targetDept = '') {
   const type = (typeOrId === 'edit' || typeOrId === 'edit-emp-dept') ? 'edit' : 'add';
   const inputEl = document.getElementById(type === 'edit' ? 'edit-emp-dept' : 'm-emp-dept');
   const labelEl = document.getElementById(type === 'edit' ? 'edit-dept-label' : 'add-dept-label');
   const menuEl = document.getElementById(type === 'edit' ? 'edit-dept-menu' : 'add-dept-menu');

   // Pilihan departemen fix hanya 3 opsi sesuai instruksi
   const baseDepts = [
    "warehouse staff",
    "coordinator",
    "supervisor"
   ];

   const rawVal = (targetDept || (inputEl ? inputEl.value : '') || 'warehouse staff').toString().trim().toLowerCase();
   let activeVal = 'warehouse staff';
   if (rawVal.includes('supervisor') || rawVal === 'spv') {
    activeVal = 'supervisor';
   } else if (rawVal.includes('coordinator') || rawVal.includes('koordinator') || rawVal.includes('cordinator')) {
    activeVal = 'coordinator';
   } else {
    activeVal = 'warehouse staff';
   }

   const activeFormatted = activeVal.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

   if (inputEl) inputEl.value = activeVal;
   if (labelEl) labelEl.innerText = activeFormatted;

   if (menuEl) {
    menuEl.innerHTML = '';
    baseDepts.forEach(d => {
     const isSelected = (d === activeVal);
     const formatted = d.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
     const item = document.createElement('div');
     item.className = `px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition flex items-center justify-between ${isSelected ? 'bg-slate-900 text-white font-bold active-dept-item' : 'hover:bg-slate-100 text-slate-700'}`;
     item.innerHTML = `<span>${formatted}</span>`;
     item.onclick = (e) => {
      e.stopPropagation();
      selectDeptItem(type, d, formatted);
     };
     menuEl.appendChild(item);
    });
    if (window.lucide) lucide.createIcons();
   }
  }

  function handleOutsourceSelectChange(type) {}
  function handleOutsourceCustomInput(type, val) {}

  function openEditEmployeeModal(nik) {
   if (!hasPermission('perm_emp_edit') && !isUserAdmin(currentUser) && !isUserManager(currentUser)) {
    alert('Akses Ditolak: Anda tidak memiliki izin untuk mengedit data karyawan.');
    return;
   }
   const cleanNik = (nik || '').trim().toUpperCase();
   let users = getWhDB(activeWarehouse, 'users', activeWarehouse === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);
   let user = users.find(u => (u.nik || '').trim().toUpperCase() === cleanNik || u.id === nik || cleanStr(u.name) === cleanStr(nik));
   if (!user) {
    const otherWh = activeWarehouse === 'MBI' ? 'MAI' : 'MBI';
    const otherUsers = getWhDB(otherWh, 'users', []);
    user = otherUsers.find(u => (u.nik || '').trim().toUpperCase() === cleanNik || u.id === nik || cleanStr(u.name) === cleanStr(nik));
   }
   if (!user) {
    alert('Karyawan tidak ditemukan.');
    return;
   }

   const userWh = user.warehouse || activeWarehouse;
   if (!user.id) {
    user.id = `${userWh.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    try {
     const targetList = (userWh === activeWarehouse) ? users : getWhDB(userWh, 'users', []);
     const uIdx = targetList.findIndex(u => (u.nik && u.nik === user.nik) || (u.name && cleanStr(u.name) === cleanStr(user.name)));
     if (uIdx !== -1) {
      targetList[uIdx].id = user.id;
      localStorage.setItem(`wfm_${userWh.toLowerCase()}_users`, JSON.stringify(targetList));
      localStorage.setItem(`wfm_${userWh.toLowerCase()}_users_backup`, JSON.stringify(targetList));
     }
    } catch(e) {}
   }

   document.getElementById('edit-emp-id').value = user.id || '';
   const oldNikInput = document.getElementById('edit-emp-old-nik');
   if (oldNikInput) oldNikInput.value = user.nik || '';
   const oldNameInput = document.getElementById('edit-emp-old-name');
   if (oldNameInput) oldNameInput.value = user.name || '';
   document.getElementById('edit-emp-wh').value = userWh;
   document.getElementById('edit-emp-name').value = user.name || '';
   document.getElementById('edit-emp-nik').value = user.nik || '';
   document.getElementById('edit-emp-position').value = user.role || 'staff';
   
   syncDepartmentDropdownOptions('edit', user.dept || '');

   const normOS = normalizeOSName(user.outsource || 'Internal');
   const editOS = document.getElementById('edit-emp-outsource');
   if (editOS) editOS.value = normOS;

   document.getElementById('edit-emp-phone').value = user.phone || '';
   if (document.getElementById('edit-emp-email')) document.getElementById('edit-emp-email').value = user.email || '';
   document.getElementById('edit-emp-joindate').value = user.joinDate || '';
   document.getElementById('edit-emp-pass').value = '';

   document.getElementById('edit-emp-modal').classList.remove('hidden');
   lucide.createIcons();
  }

  function openEditEmployeeModalFromIDCard() {
   const select = document.getElementById('idcard-select-emp');
   const nik = select ? select.value : '';
   if (!nik) {
    alert('Silakan pilih karyawan terlebih dahulu.');
    return;
   }
   openEditEmployeeModal(nik);
  }

  function closeEditEmployeeModal() {
   const editMenu = document.getElementById('edit-dept-menu');
   const editChevron = document.getElementById('edit-dept-chevron');
   if (editMenu) editMenu.classList.add('hidden');
   if (editChevron) editChevron.classList.remove('rotate-180');
   document.getElementById('edit-emp-modal').classList.add('hidden');
  }

  function handleOvertimePresetChange(val) {
   const reasonInput = document.getElementById('ot-reason');
   if (!reasonInput) return;
   if (val === 'other' || !val) {
    reasonInput.value = '';
    reasonInput.focus();
   } else {
    reasonInput.value = val;
   }
  }

  async function handleSaveEditEmployee(e) {
   e.preventDefault();
   if (!hasPermission('perm_emp_edit') && !isUserAdmin(currentUser) && !isUserManager(currentUser)) {
    alert('Akses Ditolak: Anda tidak memiliki izin untuk mengedit data karyawan.');
    return;
   }
   const id = (document.getElementById('edit-emp-id')?.value || '').trim();
   const oldNikVal = (document.getElementById('edit-emp-old-nik')?.value || '').trim().toUpperCase();
   const oldNameVal = (document.getElementById('edit-emp-old-name')?.value || '').trim();
   const name = document.getElementById('edit-emp-name').value.trim();
   const nik = document.getElementById('edit-emp-nik').value.trim().toUpperCase();
   const role = document.getElementById('edit-emp-position').value;
   const deptInput = document.getElementById('edit-emp-dept');
   const rawDept = ((deptInput ? deptInput.value : '') || document.getElementById('edit-dept-label')?.innerText || 'warehouse staff').trim().toLowerCase();
   const targetWh = (document.getElementById('edit-emp-wh')?.value || activeWarehouse || 'MBI').toUpperCase();
   
   let finalDept = 'Warehouse Staff';
   let finalRole = role;
   if (role === 'supervisor' || rawDept.includes('supervisor') || rawDept === 'spv') {
    finalDept = 'Supervisor';
    finalRole = 'supervisor';
   } else if (role === 'coordinator' || rawDept.includes('coordinator') || rawDept.includes('koordinator') || rawDept.includes('cordinator')) {
    finalDept = 'Coordinator';
    finalRole = 'coordinator';
   } else if (role === 'admin') {
    finalDept = 'Administrator';
    finalRole = 'admin';
   } else {
    const rawDeptVal = (deptInput ? deptInput.value : '') || '';
    finalDept = (rawDeptVal && rawDeptVal.toLowerCase() !== 'warehouse staff') 
     ? rawDeptVal.trim() 
     : 'Warehouse Staff';
    finalRole = 'staff';
   }

   const outsource = document.getElementById('edit-emp-outsource').value.trim();
   const phone = document.getElementById('edit-emp-phone').value.trim();
   const email = document.getElementById('edit-emp-email') ? document.getElementById('edit-emp-email').value.trim() : '';
   const joinDate = document.getElementById('edit-emp-joindate').value;
   const customPass = document.getElementById('edit-emp-pass').value.trim();

   unmarkDeletedUser(name);
   if (oldNameVal) unmarkDeletedUser(oldNameVal);
   if (oldNikVal) unmarkDeletedUser(oldNikVal);
   if (nik) unmarkDeletedUser(nik);
   if (id) unmarkDeletedUser(id);

   const nowIso = new Date().toISOString();
   localStorage.setItem('wfm_last_master_change_time', Date.now().toString());
   localStorage.setItem('wfm_master_updated_at', nowIso);

   let users = getWhDB(targetWh, 'users', targetWh === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);
   let idx = users.findIndex(u => 
    (id && u.id && u.id === id) || 
    (oldNikVal && (u.nik || '').toUpperCase() === oldNikVal) || 
    (oldNameVal && cleanStr(u.name) === cleanStr(oldNameVal)) ||
    (name && cleanStr(u.name) === cleanStr(name)) ||
    (nik && (u.nik || '').toUpperCase() === nik)
   );

   let currentWh = targetWh;
   if (idx === -1) {
    const otherWh = targetWh === 'MBI' ? 'MAI' : 'MBI';
    const otherUsers = getWhDB(otherWh, 'users', []);
    const otherIdx = otherUsers.findIndex(u => 
     (id && u.id && u.id === id) || 
     (oldNikVal && (u.nik || '').toUpperCase() === oldNikVal) || 
     (oldNameVal && cleanStr(u.name) === cleanStr(oldNameVal)) ||
     (name && cleanStr(u.name) === cleanStr(name)) ||
     (nik && (u.nik || '').toUpperCase() === nik)
    );
    if (otherIdx !== -1) {
     users = otherUsers;
     idx = otherIdx;
     currentWh = otherWh;
    }
   }

   if (idx !== -1) {
    // Cek apakah NIK baru sudah dipakai karyawan lain di gudang ini
    const duplicateUser = users.find((u, i) => i !== idx && !isManagementSystemAccount(u) && (u.nik || '').toUpperCase() === nik);
    if (duplicateUser) {
     alert(`Å¡  NIK "${nik}" sudah digunakan oleh karyawan: ${duplicateUser.name}.\nSilakan gunakan NIK yang berbeda agar tidak terjadi duplikasi NIK.`);
     return;
    }

    const oldNik = users[idx].nik || oldNikVal;
    const oldName = users[idx].name || oldNameVal;
    const oldDept = users[idx].dept;
    const finalId = users[idx].id || id || `${currentWh.toLowerCase()}-${Date.now()}`;

    unmarkDeletedUser(name);
    if (oldName) unmarkDeletedUser(oldName);
    if (nik) unmarkDeletedUser(nik);
    if (oldNik) unmarkDeletedUser(oldNik);
    if (finalId) unmarkDeletedUser(finalId);

    const wasInactive = !isManagementSystemAccount(users[idx]) && (users[idx].status === 'inactive' || users[idx].isActive === false);
    const isManagementRole = (finalRole === 'supervisor' || finalRole === 'coordinator' || finalRole === 'admin');
    users[idx].id = finalId;
    users[idx].name = name;
    users[idx].nik = nik;
    users[idx].barcodeValue = nik;
    users[idx].role = finalRole;
    users[idx].dept = finalDept;
    users[idx].department = finalDept;
    users[idx].outsource = outsource;
    users[idx].phone = phone;
    users[idx].email = email;
    users[idx].joinDate = joinDate;
    users[idx].warehouse = currentWh;
    users[idx].updatedAt = nowIso;
    if (!wasInactive) {
     delete users[idx].resignedAt;
     delete users[idx].isInactive;
     delete users[idx].isResign;
     users[idx].status = 'active';
     users[idx].isActive = true;
    } else {
     users[idx].status = 'inactive';
     users[idx].isActive = false;
    }
    
    // 1. Tangani Akun Login & Password
    if (isManagementRole) {
     users[idx].hasAccount = true;
     if (customPass) {
      delete users[idx].oldPassword;
      users[idx].previousPasswords = [];
      users[idx].password = customPass;
      users[idx].isFirstLogin = false;
      users[idx].isPasswordChanged = true;
     } else if (!users[idx].password) {
      users[idx].password = 'medika123';
      users[idx].isFirstLogin = true;
     }
    } else {
     users[idx].hasAccount = false;
     users[idx].password = '';
    }

    // 2. PERTAHANKAN STATUS MULTI-GUDANG (Pengaturan Multi-Gudang DIKELOLA DI MENU HAK AKSES AKUN)
    const isMultiWh = !!(users[idx].isMultiWarehouse || users[idx].warehouse === 'ALL' || (users[idx].permissions && users[idx].permissions.perm_wh_switch) || canAccessMultiWarehouse(users[idx]));
    users[idx].isMultiWarehouse = isMultiWh;
    if (isMultiWh) {
     users[idx].accessibleWarehouses = ['MBI', 'MAI'];
    } else {
     users[idx].accessibleWarehouses = [currentWh];
    }

    // 3. SINKRONISASI OTOMATIS HAK AKSES SESUAI ROLE BARU
    // Jika jabatan diubah (misal: Coordinator -> Supervisor), otomatis akun mendapatkan seluruh kewenangan role tersebut
    const freshPerms = getDefaultPermissions(users[idx]);
    users[idx].permissions = { ...(users[idx].permissions || {}), ...freshPerms };
    
    if (finalRole === 'supervisor') {
     users[idx].permissions.perm_approve_leave_spv = true;
     users[idx].permissions.perm_approve_ot_spv = true;
     users[idx].permissions.perm_reject_submission = true;
     users[idx].permissions.perm_submit_batch_ot = true;
     users[idx].permissions.perm_submit_leave_staff = true;
     users[idx].permissions.perm_emp_view = true;
     users[idx].permissions.perm_emp_add = true;
     users[idx].permissions.perm_emp_edit = true;
     users[idx].permissions.perm_emp_download_excel = true;
     users[idx].permissions.perm_rep_records = true;
     users[idx].permissions.perm_rep_matrix = true;
     users[idx].permissions.perm_rep_workhours = true;
     users[idx].permissions.perm_rep_leaves = true;
     users[idx].permissions.perm_rep_ot = true;
     users[idx].permissions.perm_rep_copy_matrix = true;
     users[idx].permissions.perm_rep_download_excel = true;
     users[idx].permissions.perm_idcard_single = true;
     users[idx].permissions.perm_idcard_batch_a4 = true;
     users[idx].permissions.perm_idcard_qr_location = true;
     users[idx].permissions.perm_sys_manage_permissions = true;
     users[idx].permissions.perm_approve_leave_mgr = false;
     users[idx].permissions.perm_approve_ot_mgr = false;
    } else if (finalRole === 'coordinator') {
     users[idx].permissions.perm_approve_leave_spv = false;
     users[idx].permissions.perm_approve_ot_spv = false;
     users[idx].permissions.perm_approve_leave_mgr = false;
     users[idx].permissions.perm_approve_ot_mgr = false;
     users[idx].permissions.perm_reject_submission = false;
     users[idx].permissions.perm_submit_batch_ot = true;
     users[idx].permissions.perm_submit_leave_staff = true;
     users[idx].permissions.perm_emp_view = true;
     users[idx].permissions.perm_rep_records = true;
     users[idx].permissions.perm_rep_matrix = true;
     users[idx].permissions.perm_rep_workhours = true;
     users[idx].permissions.perm_rep_leaves = true;
     users[idx].permissions.perm_rep_ot = true;
    }

    if (isMultiWh) {
     users[idx].permissions.perm_wh_switch = true;
     users[idx].permissions.perm_wh_mbi = true;
     users[idx].permissions.perm_wh_mai = true;
    }

    const targetNikKey = (users[idx].nik || users[idx].id || '').toUpperCase().trim();
    try {
     if (targetNikKey) {
      localStorage.setItem(`wfm_perm_${currentWh.toLowerCase()}_${targetNikKey}`, JSON.stringify(users[idx].permissions));
      localStorage.setItem(`wfm_perm_${targetNikKey}`, JSON.stringify(users[idx].permissions));
     }
    } catch(e) {}

    // 4. SINKRONISASI KE GUDANG LAIN JIKA AKUN ADALAH MULTI-GUDANG
    if (isMultiWh) {
     const otherWh = currentWh === 'MBI' ? 'MAI' : 'MBI';
     let otherUsers = getWhDB(otherWh, 'users', otherWh === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);
     const oIdx = otherUsers.findIndex(u => (u.nik && u.nik.toUpperCase() === targetNikKey) || (u.id && u.id === users[idx].id) || cleanStr(u.name) === cleanStr(users[idx].name));
     const mirroredUser = {
      ...users[idx],
      warehouse: otherWh,
      isMultiWarehouse: true,
      accessibleWarehouses: ['MBI', 'MAI'],
      permissions: { ...users[idx].permissions },
      updatedAt: nowIso
     };
     if (oIdx !== -1) {
      otherUsers[oIdx] = mirroredUser;
     } else {
      otherUsers.push(mirroredUser);
     }
     setWhDB(otherWh, 'users', otherUsers);
     localStorage.setItem(`wfm_${otherWh.toLowerCase()}_users_backup`, JSON.stringify(otherUsers));
     try {
      localStorage.setItem(`wfm_perm_${otherWh.toLowerCase()}_${targetNikKey}`, JSON.stringify(users[idx].permissions));
     } catch(e) {}
    }

    // Jika akun yang sedang login adalah user ini, perbarui sesi aktif langsung
    if (currentUser && ((currentUser.id && currentUser.id === users[idx].id) || (currentUser.nik && currentUser.nik === users[idx].nik))) {
     currentUser = { ...currentUser, ...users[idx] };
     try {
      localStorage.setItem('wfm_active_session', JSON.stringify(currentUser));
      if (typeof applyNavigationPermissions === 'function') applyNavigationPermissions();
      if (typeof updateWhSwitcherButtons === 'function') updateWhSwitcherButtons();
     } catch(e) {}
    }

    // SIMPAN KE DATABASE LOKAL, CACHE MEMORI & CADANGAN BACKUP
    const storageKey = `wfm_${currentWh.toLowerCase()}_users`;
    whDBCache.set(storageKey, users);
    localStorage.setItem(storageKey, JSON.stringify(users));
    localStorage.setItem(`wfm_${currentWh.toLowerCase()}_users_backup`, JSON.stringify(users));

    if (typeof sanitizeDeletedUserKeysWithActiveUsers === 'function') {
     sanitizeDeletedUserKeysWithActiveUsers();
    }

    // Update riwayat absensi, cuti & lembur jika NIK, Nama, atau Departemen berubah
    if (oldNik !== nik || oldName !== name || oldDept !== finalDept) {
     let att = getWhDB(currentWh, 'attendance', []);
     let attChanged = false;
     att.forEach(a => {
      if (a.userNik === oldNik || a.userNik === nik || (finalId && a.userId === finalId) || (oldName && cleanStr(a.userName) === cleanStr(oldName))) {
       a.userNik = nik;
       a.userName = name;
       a.userId = finalId;
       a.dept = finalDept;
       attChanged = true;
      }
     });
     if (attChanged) localStorage.setItem(`wfm_${currentWh.toLowerCase()}_attendance`, JSON.stringify(att));

     let lvs = getWhDB(currentWh, 'leaves', []);
     let lvsChanged = false;
     lvs.forEach(l => {
      if (l.userNik === oldNik || l.userNik === nik || (finalId && l.userId === finalId) || (oldName && cleanStr(l.userName) === cleanStr(oldName))) {
       l.userNik = nik;
       l.userName = name;
       l.userId = finalId;
       lvsChanged = true;
      }
     });
     if (lvsChanged) localStorage.setItem(`wfm_${currentWh.toLowerCase()}_leaves`, JSON.stringify(lvs));

     let ots = getWhDB(currentWh, 'overtime', []);
     let otsChanged = false;
     ots.forEach(o => {
      if (o.userNik === oldNik || o.userNik === nik || (finalId && o.userId === finalId) || (oldName && cleanStr(o.userName) === cleanStr(oldName))) {
       o.userNik = nik;
       o.userName = name;
       o.userId = finalId;
       o.dept = finalDept;
       otsChanged = true;
      }
     });
     if (otsChanged) localStorage.setItem(`wfm_${currentWh.toLowerCase()}_overtime`, JSON.stringify(ots));
    }

    // Simpan langsung ke Firebase Cloud 24/7 seketika (Master Force Upload + dokumen individu + registry)
    if (typeof publishInactiveRegistryToCloud === 'function') {
     await publishInactiveRegistryToCloud(currentWh, users);
    }
    if (typeof saveUserDocToFirestore === 'function') {
     await saveUserDocToFirestore(currentWh, users[idx]).catch(() => {});
     if (oldNik && oldNik !== nik && typeof deleteDocFromFirestore === 'function') {
      await deleteDocFromFirestore(currentWh, 'users', oldNik).catch(() => {});
     }
    }
    if (typeof pushUserToSupabase === 'function') {
     await pushUserToSupabase(users[idx]);
     if (isMultiWh && typeof mirroredUser !== 'undefined') {
      await pushUserToSupabase(mirroredUser);
     }
    }
    await saveFullDatabaseToCloud(false, true, true, currentWh);

    // Jika user yang diedit adalah akun yang sedang aktif/login, update sesi dan navbar seketika!
    const isEditingCurrent = currentUser && (
     currentUser.id === finalId || 
     currentUser.nik === oldNik || 
     currentUser.nik === nik ||
     (currentUser.role === 'admin' && (users[idx].role === 'admin' && users[idx].id === currentUser.id))
    );

    if (isEditingCurrent) {
     currentUser.name = name;
     currentUser.nik = nik;
     currentUser.role = finalRole;
     currentUser.dept = finalDept;
     currentUser.outsource = outsource;
     currentUser.phone = phone;
     currentUser.email = email;
     currentUser.joinDate = joinDate;
     currentUser.status = 'active';
     currentUser.isActive = true;
     if (customPass) currentUser.password = customPass;

     localStorage.setItem('wfm_active_session', JSON.stringify(currentUser));
     
     // Langsung perbarui DOM Top Navbar seketika!
     const navName = document.getElementById('nav-user-name');
     if (navName) navName.innerText = name;
     const navDept = document.getElementById('nav-user-dept');
     if (navDept) navDept.innerText = `${finalDept.toUpperCase()} - ${finalRole.toUpperCase()}`;
     const roleBadge = document.getElementById('user-role-badge');
     if (roleBadge) roleBadge.innerText = finalRole.toUpperCase();
    }

    if (activeWarehouse !== currentWh) {
     activeWarehouse = currentWh;
     if (typeof updateNavbarBrand === 'function') updateNavbarBrand(currentWh);
     const mbiRadio = document.getElementById('radio-mbi');
     const maiRadio = document.getElementById('radio-mai');
     if (currentWh === 'MBI' && mbiRadio) mbiRadio.checked = true;
     if (currentWh === 'MAI' && maiRadio) maiRadio.checked = true;
    }

    closeEditEmployeeModal();
    try { renderEmployeeTable(); } catch (e) {}
    try { populateDropdownEmployees(nik); } catch (e) {}
    try { renderSelectedIDCard(nik); } catch (e) {}
    try { renderOvertimeEmployeeGrid(); } catch (e) {}
    try { refreshAllDashboardData(); } catch (e) {}
    try { renderAccountLookupList(); } catch (e) {}
    try { renderRecordsTable(); } catch (e) {}
    try { populateMatrixOSDropdown(true); renderMatrixTable(); } catch (e) {}
    alert(`Å“â€¦ Perubahan Data Berhasil Disimpan!\n\n• Nama: ${name}\n• NIK: ${nik}\n• Departemen (Bagian): ${finalDept.toUpperCase()}\n\nData karyawan telah otomatis diperbarui dan tersimpan permanen di sistem & Cloud.`);
   } else {
    alert('Å¡  Karyawan tidak ditemukan di database. Pastikan data karyawan sudah terdaftar.');
   }
  }

  async function deleteSingleEmployee(nik) {
   if (!hasPermission('perm_emp_delete') && !isUserAdmin(currentUser) && !isUserManager(currentUser)) {
    alert('Akses Ditolak: Anda tidak memiliki izin untuk menghapus data karyawan.');
    return;
   }
   if (!nik) return;
   const targetWh = activeWarehouse || 'MBI';
   let mbiUsers = getWhDB('MBI', 'users', SEED_MBI_USERS);
   let maiUsers = getWhDB('MAI', 'users', SEED_MAI_USERS);
   let allUsers = [...mbiUsers, ...maiUsers];
   let user = allUsers.find(u => u && u.nik && (u.nik || '').toUpperCase().trim() === (nik || '').toUpperCase().trim());
   if (!user) {
    user = allUsers.find(u => u && u.id && String(u.id).trim() === String(nik).trim());
   }

   if (!user) {
    alert('Data karyawan tidak ditemukan.');
    return;
   }

   if (isManagementSystemAccount(user)) {
    alert('Akun Administrator dan Pos Scanner Utama tidak dapat dihapus.');
    return;
   }

   const wh = user.warehouse || targetWh;
   if (!confirm(`Hapus data karyawan "${user.name}" (${user.nik})?\nData akan dihapus permanen dari Gudang ${wh} dan Database Cloud Firebase.`)) {
    return;
   }

   // 1. Daftarkan kunci kematian (tombstone)
   markDeletedUser(user.name);
   if (user.nik) markDeletedUser(user.nik);
   if (user.id) markDeletedUser(user.id);

   const isMatch = (u) => {
    if (!u) return false;
    if (isManagementSystemAccount(u)) return false;
    if (user.nik && u.nik && String(u.nik).trim().toUpperCase() === String(user.nik).trim().toUpperCase()) return true;
    if (user.id && u.id && String(u.id).trim() === String(user.id).trim()) return true;
    if (user.name && u.name && cleanStr(u.name) === cleanStr(user.name)) return true;
    return false;
   };

   // 2. Bersihkan dari memori lokal (MBI & MAI) dan cadangan backup
   const newMbi = mbiUsers.filter(u => !isMatch(u));
   const newMai = maiUsers.filter(u => !isMatch(u));
   setWhDB('MBI', 'users', newMbi, true);
   setWhDB('MAI', 'users', newMai, true);
   localStorage.setItem('wfm_mbi_users_backup', JSON.stringify(newMbi));
   localStorage.setItem('wfm_mai_users_backup', JSON.stringify(newMai));

   // 3. Bersihkan dari permanent name-to-nik registry
   try {
    const permRaw = localStorage.getItem('wfm_permanent_nik_name_registry');
    if (permRaw) {
     const permObj = JSON.parse(permRaw);
     const cName = cleanStr(user.name);
     delete permObj[`MBI_${cName}`];
     delete permObj[`MAI_${cName}`];
     localStorage.setItem('wfm_permanent_nik_name_registry', JSON.stringify(permObj));
    }
   } catch(e) {}

   const nowIso = new Date().toISOString();
   localStorage.setItem('wfm_last_master_change_time', Date.now().toString());
   localStorage.setItem('wfm_master_updated_at', nowIso);
   localStorage.setItem(`wfm_${wh.toLowerCase()}_master_updated_at`, nowIso);

   // 4. Hapus dokumen fisik langsung dari Cloud Firestore users collection
   try {
    if (user.nik) {
     deleteDocFromFirestore('MBI', 'users', user.nik).catch(() => {});
     deleteDocFromFirestore('MAI', 'users', user.nik).catch(() => {});
    }
    if (user.id && user.id !== user.nik) {
     deleteDocFromFirestore('MBI', 'users', user.id).catch(() => {});
     deleteDocFromFirestore('MAI', 'users', user.id).catch(() => {});
    }
   } catch(eDoc) {}

   // 5. Langsung kirim pembaruan bersih ke Firebase Cloud Realtime Database (Atomic PUT)
   await saveFullDatabaseToCloud(false, true, true, wh, true);
   if (window.selectedEmployeeNiks) window.selectedEmployeeNiks.delete(String(user.nik).toUpperCase().trim());
   updateSelectedEmployeesCount();

   renderEmployeeTable();
   populateDropdownEmployees();
   renderOvertimeEmployeeGrid();
   refreshAllDashboardData();
   renderRecordsTable();
   renderMatrixTable();
   alert(`Å“â€¦ Karyawan "${user.name}" (${user.nik}) berhasil dihapus permanen dari sistem dan Cloud Database.`);
  }

  window.selectedEmployeeNiks = window.selectedEmployeeNiks || new Set();

  function toggleEmployeeRowSelection(nik, isChecked) {
   if (!window.selectedEmployeeNiks) window.selectedEmployeeNiks = new Set();
   const cleanNik = String(nik).toUpperCase().trim();
   if (isChecked) {
    window.selectedEmployeeNiks.add(cleanNik);
   } else {
    window.selectedEmployeeNiks.delete(cleanNik);
   }
   updateSelectedEmployeesCount();
  }

  function toggleSelectAllEmployees(isChecked) {
   if (!window.selectedEmployeeNiks) window.selectedEmployeeNiks = new Set();
   const checkboxes = document.querySelectorAll('input[name="emp-row-check"]');
   checkboxes.forEach(cb => {
    cb.checked = isChecked;
    const cleanNik = String(cb.value).toUpperCase().trim();
    if (isChecked) {
     window.selectedEmployeeNiks.add(cleanNik);
    } else {
     window.selectedEmployeeNiks.delete(cleanNik);
    }
   });
   updateSelectedEmployeesCount();
  }

  function updateSelectedEmployeesCount() {
   if (!window.selectedEmployeeNiks) window.selectedEmployeeNiks = new Set();
   const count = window.selectedEmployeeNiks.size;
   const badge = document.getElementById('count-selected-emp-badge');
   const btnDelete = document.getElementById('btn-delete-selected-emp');
   const btnDeact = document.getElementById('btn-deact-selected-emp');
   const btnAct = document.getElementById('btn-act-selected-emp');
   if (badge) badge.innerText = count;
   if (btnDelete) {
    btnDelete.classList.toggle('opacity-50', count === 0);
    btnDelete.classList.toggle('pointer-events-none', count === 0);
   }
   if (btnDeact) {
    btnDeact.classList.toggle('opacity-50', count === 0);
    btnDeact.classList.toggle('pointer-events-none', count === 0);
   }
   if (btnAct) {
    btnAct.classList.toggle('opacity-50', count === 0);
    btnAct.classList.toggle('pointer-events-none', count === 0);
   }

   const masterCheck = document.getElementById('emp-master-check');
   const allRowChecks = document.querySelectorAll('input[name="emp-row-check"]');
   if (masterCheck && allRowChecks.length > 0) {
    masterCheck.checked = Array.from(allRowChecks).every(cb => cb.checked);
   } else if (masterCheck && allRowChecks.length === 0) {
    masterCheck.checked = false;
   }
  }

  async function deleteSelectedEmployees() {
   if (!hasPermission('perm_emp_delete') && !isUserAdmin(currentUser) && !isUserManager(currentUser)) {
    alert('Akses Ditolak: Anda tidak memiliki izin untuk menghapus data karyawan.');
    return;
   }
   if (!window.selectedEmployeeNiks || window.selectedEmployeeNiks.size === 0) {
    alert('Pilih minimal 1 karyawan dengan mencentang kotak di tabel.');
    return;
   }

   const selectedNiks = new Set(window.selectedEmployeeNiks);
   if (!confirm(`Å¡  PERINGATAN HAPUS MASAL:\nApakah Anda yakin ingin MENGHAPUS PERMANEN ${selectedNiks.size} karyawan terpilih?\n\nData karyawan akan langsung dibersihkan permanen dari sistem dan Cloud Database.`)) {
    return;
   }

   let mbiUsers = getWhDB('MBI', 'users', SEED_MBI_USERS);
   let maiUsers = getWhDB('MAI', 'users', SEED_MAI_USERS);
   const allUsers = [...mbiUsers, ...maiUsers];
   
   allUsers.forEach(u => {
    if (u && u.nik && selectedNiks.has(u.nik.toUpperCase().trim()) && !isManagementSystemAccount(u)) {
     markDeletedUser(u.name);
     if (u.nik) markDeletedUser(u.nik);
     if (u.id) markDeletedUser(u.id);
    }
   });

   const isSelected = (u) => {
    if (!u || isManagementSystemAccount(u)) return false;
    if (u.nik && selectedNiks.has(u.nik.toUpperCase().trim())) return true;
    return false;
   };

   const newMbi = mbiUsers.filter(u => !isSelected(u));
   const newMai = maiUsers.filter(u => !isSelected(u));
   setWhDB('MBI', 'users', newMbi, true);
   setWhDB('MAI', 'users', newMai, true);
   localStorage.setItem('wfm_mbi_users_backup', JSON.stringify(newMbi));
   localStorage.setItem('wfm_mai_users_backup', JSON.stringify(newMai));

   try {
    const permRaw = localStorage.getItem('wfm_permanent_nik_name_registry');
    if (permRaw) {
     const permObj = JSON.parse(permRaw);
     allUsers.forEach(u => {
      if (u && isSelected(u)) {
       const cName = cleanStr(u.name);
       delete permObj[`MBI_${cName}`];
       delete permObj[`MAI_${cName}`];
      }
     });
     localStorage.setItem('wfm_permanent_nik_name_registry', JSON.stringify(permObj));
    }
   } catch(e) {}

   const nowIso = new Date().toISOString();
   localStorage.setItem('wfm_last_master_change_time', Date.now().toString());
   localStorage.setItem('wfm_master_updated_at', nowIso);
   await saveFullDatabaseToCloud(false, true, true, null, true);
   try {
    selectedNiks.forEach(nik => {
     deleteDocFromFirestore('MBI', 'users', nik);
     deleteDocFromFirestore('MAI', 'users', nik);
    });
   } catch(e) {}

   window.selectedEmployeeNiks.clear();
   renderEmployeeTable();
   populateDropdownEmployees();
   renderOvertimeEmployeeGrid();
   refreshAllDashboardData();
   renderRecordsTable();
   renderMatrixTable();
   alert(`Å“â€¦ Berhasil menghapus ${selectedNiks.size} karyawan secara permanen dari sistem dan Cloud Database.`);
  }

  async function deleteAllEmployees() {
   if (!hasPermission('perm_emp_reset_all') && !isUserAdmin(currentUser) && !isUserManager(currentUser)) {
    alert('Akses Ditolak: Fitur Reset Semua Data Karyawan hanya dapat dilakukan dengan izin khusus Reset Data Karyawan.');
    return;
   }
   const targetWh = activeWarehouse || 'MBI';
   if (!confirm(`Å¡  PERINGATAN HAPUS TOTAL:\nApakah Anda yakin ingin MENGOSONGKAN SELURUH DATA KARYAWAN di Gudang ${targetWh}?\n\n(Akun Admin dan Akun Dedicated Scanner akan tetap dipertahankan untuk mengelola sistem). Data di Google Firebase Cloud akan langsung diperbarui bersih.`)) {
    return;
   }

   try {
    localStorage.removeItem('wfm_deleted_user_keys');
   } catch(e) {}

   const users = getWhDB(targetWh, 'users', targetWh === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);
   const preserved = users.filter(u => isManagementSystemAccount(u));
   setWhDB(targetWh, 'users', preserved);
   localStorage.setItem(`wfm_${targetWh.toLowerCase()}_users_backup`, JSON.stringify(preserved));
   const nowIso = new Date().toISOString();
   localStorage.setItem('wfm_last_master_change_time', Date.now().toString());
   localStorage.setItem('wfm_master_updated_at', nowIso);
   harmonizeAndResequenceAllNIKs();
   await saveFullDatabaseToCloud(false, true, true, targetWh, true, false);

   renderEmployeeTable();
   populateDropdownEmployees();
   renderOvertimeEmployeeGrid();
   refreshAllDashboardData();
   renderRecordsTable();
   renderMatrixTable();
   alert(`Å“â€¦ Seluruh data karyawan di Gudang ${targetWh} telah berhasil dikosongkan secara permanen.\n\nMemori lokal dan Firebase Cloud telah bersih. Anda dapat langsung mengunggah file Excel baru.`);
  }

  async function deleteAllAttendanceRecords() {
   if (!hasPermission('perm_rep_reset_att') && !isUserAdmin(currentUser) && !isUserManager(currentUser)) {
    alert('Akses Ditolak: Fitur Reset Riwayat Absensi hanya dapat dilakukan dengan izin khusus Reset Riwayat Absensi.');
    return;
   }
   const targetWh = activeWarehouse || 'MBI';
   if (!confirm(`Å¡  PERINGATAN RESET ABSENSI:\nApakah Anda yakin ingin MERESET & MENGHAPUS SEMUA RIWAYAT ABSENSI di Gudang ${targetWh}?\n\nSemua data jam masuk dan jam pulang akan dikosongkan secara permanen baik di perangkat, Google Firebase Cloud, maupun Google Spreadsheet.`)) {
    return;
   }

   // Tandai semua record yang ada sebagai terhapus (tombstone) agar tidak pernah bangkit lagi
   const existing = getWhDB(targetWh, 'attendance', []);
   trackDeletedAttendance(existing);

   // Kosongkan attendance di database lokal
   setWhDB(targetWh, 'attendance', []);

   // Kosongkan seluruh presensi di Supabase Database (SSOT Utama)
   try {
    if (typeof deleteAllAttendanceFromSupabase === 'function') {
     await deleteAllAttendanceFromSupabase(targetWh);
    }
   } catch(eSbReset) {}
   
   // Kirim langsung payload bersih ke Firebase
   await saveFullDatabaseToCloud(false, true, false, targetWh, false, true);

   // Langsung sinkronkan ke Google Sheet agar tab RECORD ABSEN bersih
   if (typeof triggerGoogleSheetAutoSync === 'function') {
    triggerGoogleSheetAutoSync(true);
   }
   try { if (typeof BroadcastChannel !== 'undefined') new BroadcastChannel('wfm_firebase_live_sync').postMessage('update'); } catch(e) {}

   renderRecordsTable();
   renderMatrixTable();
   renderScannerTodayRecords();
   refreshAllDashboardData();
   alert(`Å“â€¦ Seluruh data riwayat absensi di Gudang ${targetWh} telah berhasil direset dan dihapus secara permanen dari sistem, Cloud, dan Google Spreadsheet.`);
  }

  function openChangePasswordSettingModal() {
   switchView('settings');
  }

  function closeChangePasswordSettingModal() {
   const m = document.getElementById('change-password-modal') || document.getElementById('change-pwd-modal');
   if (m) m.classList.add('hidden');
  }

  function handleSaveSelfPassword(e) {
   e.preventDefault();
   const p1 = document.getElementById('self-new-pwd-1').value.trim();
   const p2 = document.getElementById('self-new-pwd-2').value.trim();
   const alertEl = document.getElementById('setting-pwd-alert');

   if (p1.length < 6) {
    alertEl.innerText = 'Password minimal 6 karakter!';
    alertEl.classList.remove('hidden');
    return;
   }
   if (p1 !== p2) {
    alertEl.innerText = 'Password baru dan konfirmasi tidak cocok!';
    alertEl.classList.remove('hidden');
    return;
   }

   if (!currentUser) return;

   const wh = currentUser.warehouse || activeWarehouse;
   let users = getWhDB(wh, 'users', wh === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);
   const idx = users.findIndex(u => u.nik === currentUser.nik || u.id === currentUser.id);

   if (idx !== -1) {
    const nowIso = new Date().toISOString();
    users[idx].password = p1;
    users[idx].isFirstLogin = false;
    users[idx].updatedAt = nowIso;
    currentUser.password = p1;
    currentUser.isFirstLogin = false;
    currentUser.updatedAt = nowIso;
    setWhDB(wh, 'users', users);
    localStorage.setItem('wfm_last_master_change_time', Date.now().toString());
    localStorage.setItem('wfm_master_updated_at', nowIso);
    localStorage.setItem(`wfm_${wh.toLowerCase()}_master_updated_at`, nowIso);
    localStorage.setItem('wfm_active_session', JSON.stringify(currentUser));

    // Jika Admin atau Manager, sinkronkan juga ke warehouse lain
    if (isUserManager(currentUser) || isUserAdmin(currentUser)) {
     const otherWh = wh === 'MBI' ? 'MAI' : 'MBI';
     let otherUsers = getWhDB(otherWh, 'users', otherWh === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);
     const otherIdx = otherUsers.findIndex(u => u.nik === currentUser.nik || u.id === currentUser.id || (isUserManager(currentUser) && isUserManager(u)));
     if (otherIdx !== -1) {
      otherUsers[otherIdx].password = p1;
      otherUsers[otherIdx].isFirstLogin = false;
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
    closeChangePasswordSettingModal();
    alert('Kata sandi akun Anda berhasil diubah!\nUntuk login berikutnya, wajib gunakan kata sandi baru ini.');
   }
  }

  function openAddEmployeeModal() {
   if (!hasPermission('perm_emp_add') && !isUserAdmin(currentUser) && !isUserManager(currentUser)) {
    alert('Akses Ditolak: Anda tidak memiliki izin untuk menambah data karyawan baru.');
    return;
   }
   document.getElementById('modal-emp-wh').innerText = activeWarehouse;
   document.getElementById('m-emp-joindate').value = getLocalDateString(new Date());
   document.getElementById('m-emp-nik').value = '';
   if (document.getElementById('m-emp-email')) document.getElementById('m-emp-email').value = '';

   const addOS = document.getElementById('m-emp-outsource');
   if (addOS) addOS.value = 'Internal';

   syncDepartmentDropdownOptions('add', 'warehouse staff');
   const addMultiWh = document.getElementById('m-emp-multiwh');
   if (addMultiWh) addMultiWh.checked = false;
   document.getElementById('add-emp-modal').classList.remove('hidden');
   lucide.createIcons();
  }

  function closeAddEmployeeModal() {
   const addMenu = document.getElementById('add-dept-menu');
   const addChevron = document.getElementById('add-dept-chevron');
   if (addMenu) addMenu.classList.add('hidden');
   if (addChevron) addChevron.classList.remove('rotate-180');
   document.getElementById('add-emp-modal').classList.add('hidden');
  }

  function generateUniqueNIK(warehouse = 'MBI', name = '') {
   const wh = warehouse || activeWarehouse || 'MBI';
   const year = new Date().getFullYear().toString().slice(-2);
   const prefix = `${wh.toUpperCase()}${year}-`;
   const users = getWhDB(wh, 'users', wh === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);
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

  async function handleManualAddEmployee(e) {
   e.preventDefault();
   if (!hasPermission('perm_emp_add') && !isUserAdmin(currentUser) && !isUserManager(currentUser)) {
    alert('Akses Ditolak: Anda tidak memiliki izin untuk menambah data karyawan baru.');
    return;
   }
   const name = document.getElementById('m-emp-name').value.trim();
   const customNik = document.getElementById('m-emp-nik').value.trim();
   const rawDept = (document.getElementById('m-emp-dept').value || document.getElementById('add-dept-label')?.innerText || 'warehouse staff').toLowerCase();
   const outsource = document.getElementById('m-emp-outsource').value.trim();
   const phone = document.getElementById('m-emp-phone').value.trim();
   const email = document.getElementById('m-emp-email') ? document.getElementById('m-emp-email').value.trim() : '';
   const joinDate = document.getElementById('m-emp-joindate').value;
   const role = document.getElementById('m-emp-position').value;
   
   let finalDept = 'Warehouse Staff';
   let finalRole = role;
   let isManagementRole = false;

   if (role === 'supervisor' || rawDept.includes('supervisor') || rawDept === 'spv') {
    finalDept = 'Supervisor';
    finalRole = 'supervisor';
    isManagementRole = true;
   } else if (role === 'coordinator' || rawDept.includes('coordinator') || rawDept.includes('koordinator') || rawDept.includes('cordinator')) {
    finalDept = 'Coordinator';
    finalRole = 'coordinator';
    isManagementRole = true;
   } else {
    finalDept = 'Warehouse Staff';
    finalRole = 'staff';
    isManagementRole = false;
   }

   if (customNik) {
    const existingUsersList = getWhDB(activeWarehouse, 'users', activeWarehouse === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);
    const dupNikUser = existingUsersList.find(u => (u.nik || '').trim().toUpperCase() === customNik.toUpperCase());
    if (dupNikUser) {
     alert(`Å¡  NIK "${customNik.toUpperCase()}" sudah digunakan oleh karyawan: ${dupNikUser.name}.\nSilakan kosongkan kolom NIK agar sistem membuatkan NIK otomatis yang unik, atau gunakan NIK yang berbeda.`);
     return;
    }
   }

   const autoNik = customNik ? customNik.toUpperCase() : generateUniqueNIK(activeWarehouse, name);

   unmarkDeletedUser(name);
   if (autoNik) unmarkDeletedUser(autoNik);
   if (typeof sanitizeDeletedUserKeysWithActiveUsers === 'function') {
    sanitizeDeletedUserKeysWithActiveUsers();
   }
   const nowIso = new Date().toISOString();
   localStorage.setItem('wfm_last_master_change_time', Date.now().toString());
   localStorage.setItem('wfm_master_updated_at', nowIso);

   const users = getWhDB(activeWarehouse, 'users', activeWarehouse === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);
   const isMultiWhChecked = document.getElementById('m-emp-multiwh')?.checked || false;
   const newEmp = { 
    id: `${activeWarehouse.toLowerCase()}-${Date.now()}`, 
    name, 
    dept: finalDept, 
    outsource, 
    phone, 
    email, 
    joinDate, 
    nik: autoNik, 
    barcodeValue: autoNik, 
    role: finalRole, 
    password: isManagementRole ? 'medika123' : '', 
    isFirstLogin: isManagementRole, 
    hasAccount: isManagementRole, 
    warehouse: activeWarehouse,
    isMultiWarehouse: isMultiWhChecked,
    accessibleWarehouses: isMultiWhChecked ? ['MBI', 'MAI'] : [activeWarehouse],
    updatedAt: nowIso
   };

   if (isManagementRole) {
    const freshPerms = getDefaultPermissions(newEmp);
    newEmp.permissions = { ...freshPerms };
    if (isMultiWhChecked) {
     newEmp.permissions.perm_wh_switch = true;
     newEmp.permissions.perm_wh_mbi = true;
     newEmp.permissions.perm_wh_mai = true;
    }
    if (finalRole === 'supervisor') {
     newEmp.permissions.perm_approve_leave_spv = true;
     newEmp.permissions.perm_approve_ot_spv = true;
     newEmp.permissions.perm_reject_submission = true;
    }
    try {
     saveUserPerms(newEmp.nik || newEmp.id, newEmp.permissions, newEmp.warehouse);
    } catch(e) {}
   }
   
   users.push(newEmp);
   setWhDB(activeWarehouse, 'users', users);
   localStorage.setItem(`wfm_${activeWarehouse.toLowerCase()}_users_backup`, JSON.stringify(users));
   harmonizeAndResequenceAllNIKs();
   await saveFullDatabaseToCloud(false, true, true);

   // Cari NIK aktual karyawan setelah pendaftaran
   const updatedUsers = getWhDB(activeWarehouse, 'users', []);
   const matchedUser = updatedUsers.find(u => u.name === name) || newEmp;
   const finalEffectiveNik = matchedUser.nik;
   if (typeof saveUserDocToFirestore === 'function') {
    saveUserDocToFirestore(activeWarehouse, matchedUser);
   }
   if (typeof pushUserToSupabase === 'function') {
    await pushUserToSupabase(matchedUser);
   }

   closeAddEmployeeModal();
   renderEmployeeTable();
   populateDropdownEmployees(finalEffectiveNik);
   renderSelectedIDCard(finalEffectiveNik);
   renderOvertimeEmployeeGrid();
   refreshAllDashboardData();
   try { renderRecordsTable(); } catch (e) {}
   try { populateMatrixOSDropdown(true); renderMatrixTable(); } catch (e) {}
   
   if (isManagementRole) {
    alert(`Å“â€¦ Karyawan ${name} (${finalEffectiveNik}) berhasil ditambahkan dengan jabatan ${finalRole.toUpperCase()}!\nAkun login sistem telah dibuat otomatis (Password: medika123).`);
   } else {
    alert(`Å“â€¦ Data karyawan ${name} (${finalEffectiveNik}) berhasil ditambahkan dengan Departemen WAREHOUSE STAFF!\nKartu ID Card & Barcode siap digunakan untuk absensi.`);
   }
  }

  function updateAddEmployeeRoleNotice(role) {
   const noteEl = document.getElementById('add-emp-role-note');
   if (!noteEl) return;
   if (role === 'supervisor') {
    noteEl.className = 'p-2.5 rounded-xl bg-amber-50 text-amber-900 text-[11px] leading-relaxed border border-amber-200';
    noteEl.innerHTML = 'Å¸â€˜â€˜ <b>Supervisor:</b> Karyawan akan dibuatkan akun login mandiri (Password: <code>medika123</code>) dan berwenang menyetujui (approve/reject) pengajuan izin & lembur.';
   } else if (role === 'coordinator') {
    noteEl.className = 'p-2.5 rounded-xl bg-sky-50 text-sky-900 text-[11px] leading-relaxed border border-sky-200';
    noteEl.innerHTML = 'Å¡ <b>Coordinator:</b> Karyawan akan dibuatkan akun login mandiri (Password: <code>medika123</code>) untuk mengakses dashboard, input lembur, dan data karyawan.';
   } else {
    noteEl.className = 'p-2.5 rounded-xl bg-slate-100 text-slate-700 text-[11px] leading-relaxed border border-slate-200';
    noteEl.innerHTML = 'â€ž  <b>Karyawan Biasa:</b> Ditambahkan sebagai data master presensi ID Card (tidak memiliki akun login).';
   }
  }

  function updateEditEmployeeRoleNotice(role) {
   const noteEl = document.getElementById('edit-emp-role-note');
   if (!noteEl) return;
   if (role === 'supervisor') {
    noteEl.className = 'p-2.5 rounded-xl bg-amber-50 text-amber-900 text-[11px] leading-relaxed border border-amber-200';
    noteEl.innerHTML = 'Å¸â€˜â€˜ <b>Supervisor:</b> Karyawan memiliki akun login mandiri dan hak akses approval izin & lembur.';
   } else if (role === 'coordinator') {
    noteEl.className = 'p-2.5 rounded-xl bg-sky-50 text-sky-900 text-[11px] leading-relaxed border border-sky-200';
    noteEl.innerHTML = 'Å¡ <b>Coordinator:</b> Karyawan memiliki akun login mandiri untuk mengelola operasional.';
   } else if (role === 'admin') {
    noteEl.className = 'p-2.5 rounded-xl bg-rose-50 text-rose-900 text-[11px] leading-relaxed border border-rose-200';
    noteEl.innerHTML = 'Å¸â€º  <b>Admin:</b> Akun Administrator pengelola penuh master data & backup cloud.';
   } else {
    noteEl.className = 'p-2.5 rounded-xl bg-slate-100 text-slate-700 text-[11px] leading-relaxed border border-slate-200';
    noteEl.innerHTML = 'â€ž  <b>Karyawan Biasa:</b> Terdaftar sebagai data master presensi ID Card (tidak memiliki akun login).';
   }
  }

  function downloadAccountsExcel() {
   if (!hasPermission('perm_emp_export_excel') && !isUserAdmin(currentUser) && !isUserManager(currentUser)) {
    alert('Akses Ditolak: Anda tidak memiliki izin untuk mengunduh data karyawan ke Excel.');
    return;
   }
   if (typeof repairCorruptedEmployeeNames === 'function') repairCorruptedEmployeeNames();
   const users = getWhDB(activeWarehouse, 'users', activeWarehouse === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);
   const regularUsers = users.filter(u => !isManagementSystemAccount(u));
   const exportData = regularUsers.map((u, idx) => ({
    "No": idx + 1,
    "ID Karyawan": u.nik || '',
    "Nama Karyawan": u.name || '',
    "Departemen": u.dept || 'Warehouse Staff',
    "Outsource": u.outsource || '-',
    "Posisi / Role": (u.role || 'staff').toUpperCase(),
    "Status Akun": (u.role === 'supervisor' || u.role === 'coordinator') ? 'Memiliki Akun Login' : 'Data Presensi (Tanpa Akun)',
    "No Telepon": u.phone || '-',
    "Email": u.email || '-',
    "Join Date": u.joinDate || '-',
    "Gudang": u.warehouse || activeWarehouse,
    "ID System": u.id || ''
   }));

   const ws = XLSX.utils.json_to_sheet(exportData);
   const wb = XLSX.utils.book_new();
   XLSX.utils.book_append_sheet(wb, ws, `Data_Karyawan_${activeWarehouse}`);
   XLSX.writeFile(wb, `Data_Karyawan_${activeWarehouse}.xlsx`);
  }

  function downloadEmployeeTemplate() {
   if (!hasPermission('perm_emp_import_excel') && !isUserAdmin(currentUser) && !isUserManager(currentUser)) {
    alert('Akses Ditolak: Anda tidak memiliki izin untuk mengunduh template Excel karyawan.');
    return;
   }
   const year = new Date().getFullYear().toString().slice(-2);
   const prefix = `${activeWarehouse.toUpperCase()}${year}-`;
   const templateData = [
    { "No": 1, "ID Karyawan": `${prefix}001`, "Nama Karyawan": "Afuani Huyan", "Departemen": "Warehouse Staff", "Outsource": "ADP", "No Telpon": "08123456789", "Email": "afuani@medika.com", "JOIN DATE": "2023-01-15", "Posisi": "staff" },
    { "No": 2, "ID Karyawan": `${prefix}002`, "Nama Karyawan": "Bambang Wijaya", "Departemen": "Warehouse Staff", "Outsource": "Staffinc", "No Telpon": "08129876543", "Email": "bambang@medika.com", "JOIN DATE": "2023-02-01", "Posisi": "staff" },
    { "No": 3, "ID Karyawan": `${prefix}003`, "Nama Karyawan": "Citra Lestari", "Departemen": "Coordinator", "Outsource": "Internal", "No Telpon": "08129876544", "Email": "citra@medika.com", "JOIN DATE": "2022-06-10", "Posisi": "coordinator" },
    { "No": 4, "ID Karyawan": `${prefix}004`, "Nama Karyawan": "Dedi Kurniawan", "Departemen": "Supervisor", "Outsource": "Internal", "No Telpon": "08129876545", "Email": "dedi@medika.com", "JOIN DATE": "2021-03-05", "Posisi": "supervisor" }
   ];

   const ws = XLSX.utils.json_to_sheet(templateData);
   const wb = XLSX.utils.book_new();
   XLSX.utils.book_append_sheet(wb, ws, "Template_Karyawan");
   XLSX.writeFile(wb, `Template_Data_Karyawan_${activeWarehouse}.xlsx`);
  }

  function exportEmployeesExcel() {
   if (!hasPermission('perm_emp_export_excel') && !isUserAdmin(currentUser) && !isUserManager(currentUser)) {
    alert('Akses Ditolak: Anda tidak memiliki izin untuk mengunduh data karyawan ke Excel.');
    return;
   }
   if (typeof repairCorruptedEmployeeNames === 'function') repairCorruptedEmployeeNames();
   const users = getWhDB(activeWarehouse, 'users', activeWarehouse === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);
   const regularUsers = users.filter(u => !isManagementSystemAccount(u));
   const exportData = regularUsers.map((u, idx) => ({
    "No": idx + 1,
    "ID Karyawan": u.nik || '',
    "Nama Karyawan": u.name || '',
    "Departemen": u.dept || 'Warehouse Staff',
    "Outsource": u.outsource || '-',
    "No Telpon": u.phone || '-',
    "Email": u.email || '-',
    "JOIN DATE": u.joinDate || '-',
    "Posisi": u.role || 'staff',
    "Gudang": u.warehouse || activeWarehouse,
    "ID System": u.id || ''
   }));

   const ws = XLSX.utils.json_to_sheet(exportData);
   const wb = XLSX.utils.book_new();
   XLSX.utils.book_append_sheet(wb, ws, `Karyawan_${activeWarehouse}`);
   XLSX.writeFile(wb, `Data_Karyawan_${activeWarehouse}_${Date.now()}.xlsx`);
  }

  function formatExcelDate(val) {
   if (!val) return '-';
   const strVal = String(val).trim();
   if (!strVal || strVal === '-' || strVal === ' - ' || strVal === '--' || strVal.toLowerCase() === 'n/a' || strVal.toLowerCase() === 'null') {
    return '-';
   }
   // Jika angka serial Excel seperti 45200 atau 46225
   if (/^\d{4,5}(\.\d+)?$/.test(strVal)) {
    const serial = parseFloat(strVal);
    const utcDays = Math.floor(serial - 25569);
    const dateInfo = new Date(utcDays * 86400 * 1000);
    const yyyy = dateInfo.getUTCFullYear();
    const mm = String(dateInfo.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(dateInfo.getUTCDate()).padStart(2, '0');
    if (yyyy >= 1970 && yyyy <= 2099) {
     return `${yyyy}-${mm}-${dd}`;
    }
    return '-';
   }
   // Jika format tanggal standar YYYY-MM-DD
   if (/^\d{4}-\d{2}-\d{2}$/.test(strVal)) {
    const yyyy = parseInt(strVal.substring(0, 4), 10);
    if (yyyy >= 1970 && yyyy <= 2099) return strVal;
    return '-';
   }
   // Jika format DD/MM/YYYY atau DD-MM-YYYY
   if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(strVal)) {
    const parts = strVal.split(/[\/\-]/);
    const dd = String(parts[0]).padStart(2, '0');
    const mm = String(parts[1]).padStart(2, '0');
    const yyyy = parts[2];
    const numY = parseInt(yyyy, 10);
    if (numY >= 1970 && numY <= 2099) {
     return `${yyyy}-${mm}-${dd}`;
    }
    return '-';
   }
   return strVal;
  }

  function cleanExcelPhone(val, name, dept) {
   if (!val || val === '-' || val === name || val === dept) return '-';
   const str = String(val).trim();
   // Validasi: nomor telepon wajib memiliki minimal 5 digit angka
   const digits = str.replace(/\D/g, '');
   if (digits.length < 5) return '-';
   return str;
  }

  // Helper penentu apakah sebuah string adalah kode ID / NIK / Angka (BUKAN nama manusia)
  function isLikelyIdNotName(str) {
   if (!str || typeof str !== 'string') return false;
   const s = str.trim();
   if (!s || s === '-' || s === '--' || s.length < 1) return false;

   // 1. Pola murni angka / digit (e.g. "1", "01", "001", "12345", dsb.)
   if (/^\d+$/.test(s)) return true;

   // 2. Pola angka dengan strip atau titik (e.g. "26-001", "01-002", "26.001", "1.01")
   if (/^\d+[\-._]\d+$/.test(s)) return true;

   // 3. Pola kode ID/NIK resmi sistem: MBI26-001, MAI26-012, ADM001, ABSEN-MBI, MGR001, SPV-MBI
   // Mendukung pemisah strip, underscore, titik, atau spasi (e.g. "MBI 001", "MBI26-001", "MBI.26.001", "MBI26-064")
   if (/^(MBI|MAI|ADM|ABSEN|MGR|SPV)[\s\-._]?[0-9A-Z\-._]+$/i.test(s)) return true;

   // 4. Pola umum kode ID/NIK: prefix huruf 1-8 karakter diikuti angka/strip/spasi (e.g. ID001, ID 01, ID-1, EMP-102, K-01, K1, NIK123, NIP01, MEDIKA-01)
   if (/^[A-Z]{1,8}[\s\-._]?[0-9]{1,}[0-9A-Z\-._]*$/i.test(s)) return true;

   // 5. Pola string yang diawali kata Karyawan diikuti kode/angka: e.g. "Karyawan MBI26-001", "Karyawan 01", "Karyawan Baru"
   if (/^karyawan\s+(baru|[0-9A-Z\-._]+)$/i.test(s)) return true;

   // 6. Pola barcode/kode alfanumerik yang didominasi angka dan karakter non-huruf
   const letters = (s.match(/[a-zA-Z]/g) || []).length;
   const digits = (s.match(/[0-9]/g) || []).length;
   if (digits > 0 && digits >= letters) return true; // Jika digit >= huruf, pasti ID/kode

   return false;
  }

  // Helper penentu apakah sebuah string adalah nama manusia yang sah
  function isLikelyHumanName(str) {
   if (!str || typeof str !== 'string') return false;
   const s = str.trim();
   if (!s || s.length < 2 || s === '-' || s === '--') return false;

   // Jika cocok dengan pola ID/kode di atas -> BUKAN nama
   if (isLikelyIdNotName(s)) return false;

   // Nama manusia tidak boleh mengandung angka (0-9)
   if (/\d/.test(s)) return false;

   // Nama manusia tidak boleh berupa email atau url
   if (s.includes('@') || s.includes('http') || s.includes('.com')) return false;

   // Nama manusia harus memiliki setidaknya 1 huruf vokal (a, i, u, e, o)
   if (!/[aiueoAIUEO]/.test(s)) return false;

   // Nama manusia tidak boleh berupa role atau departemen sistem
   const lower = s.toLowerCase();
   const blacklistedTerms = [
    'warehouse staff', 'coordinator', 'supervisor', 'administrator', 'admin',
    'scanner', 'manager', 'presensi', 'internal', 'outsource', 'staff',
    'laki-laki', 'perempuan', 'pria', 'wanita', 'aktif', 'active',
    'picker', 'packer', 'checker', 'driver', 'inbound', 'return', 'dispatch'
   ];
   if (blacklistedTerms.includes(lower)) return false;

   // Nama manusia hanya terdiri dari huruf alfabet, spasi, tanda petik, koma, tanda kurung, dan titik (e.g. M. Budi, S.T., Siti (Staff))
   if (!/^[a-zA-Z\s'.,()\/-]+$/.test(s)) return false;

   return true;
  }

  // Pemulihan darurat otomatis jika nama karyawan sempat rusak / terisi NIK/ID dari upload lama
  function repairCorruptedEmployeeNames() {
   ['MBI', 'MAI'].forEach(wh => {
    const storageKey = `wfm_${wh.toLowerCase()}_users`;
    const backupKey = `wfm_${wh.toLowerCase()}_users_backup`;
    const raw = localStorage.getItem(storageKey);
    if (!raw) return;
    try {
     let users = JSON.parse(raw);
     if (!Array.isArray(users) || users.length === 0) return;

     const att = getWhDB(wh, 'attendance', []);
     const ots = getWhDB(wh, 'overtime', []);
     const lvs = getWhDB(wh, 'leaves', []);
     const seedUsers = wh === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS;

     // Baca data backup jika tersedia
     let backupUsers = [];
     try {
      const bRaw = localStorage.getItem(backupKey);
      if (bRaw) backupUsers = JSON.parse(bRaw);
     } catch(e) {}

     // Hanya saring akun demo fiktif bawaan (Agus Setiawan & Budi Santoso), jangan membuang karyawan aktif!
     const origLen = users.length;
     users = users.filter(u => {
      if (!u) return false;
      const rName = (u.name || '').trim().toLowerCase();
      const cName = cleanStr(u.name);
      if (rName === 'agus setiawan' || cName === 'agussetiawan') return false;
      if (rName === 'budi santoso' || cName === 'budisantoso') return false;
      return true;
     });
     let changed = (users.length !== origLen);
     users.forEach(u => {
      if (!u || isManagementSystemAccount(u)) return;
      const rName = (u.name || '').trim().toLowerCase();
      const cName = cleanStr(u.name);
      if (rName === 'agus setiawan' || cName === 'agussetiawan' || rName === 'budi santoso' || cName === 'budisantoso') return;
      const isCorrupt = isLikelyIdNotName(u.name) || (u.nik && cleanStr(u.name) === cleanStr(u.nik));
      if (isCorrupt) {
       let realName = '';

       // 1. Cek dari backup lokal
       if (Array.isArray(backupUsers)) {
        const foundBackup = backupUsers.find(b => (b.id && b.id === u.id) || (b.nik && b.nik === u.nik));
        if (foundBackup && isLikelyHumanName(foundBackup.name)) {
         realName = foundBackup.name;
        }
       }

       // 2. Cek dari riwayat presensi
       if (!realName) {
        const foundAtt = att.find(a => (a.userNik === u.nik || (u.id && a.userId === u.id)) && isLikelyHumanName(a.userName));
        if (foundAtt) realName = foundAtt.userName;
       }

       // 3. Cek dari riwayat lembur
       if (!realName) {
        const foundOt = ots.find(o => (o.userNik === u.nik || (u.id && o.userId === u.id)) && isLikelyHumanName(o.userName));
        if (foundOt) realName = foundOt.userName;
       }

       // 4. Cek dari riwayat cuti / izin
       if (!realName) {
        const foundLv = lvs.find(l => (l.userNik === u.nik || (u.id && l.userId === u.id)) && isLikelyHumanName(l.userName));
        if (foundLv) realName = foundLv.userName;
       }

       // 5. Cek dari data master bawaan (seed)
       if (!realName) {
        const foundSeed = seedUsers.find(s => s.nik === u.nik || (u.id && s.id === u.id));
        if (foundSeed && isLikelyHumanName(foundSeed.name)) realName = foundSeed.name;
       }

       if (realName) {
        console.log(`[AutoRepair] Memulihkan nama karyawan ${u.nik}: "${u.name}" -> "${realName}"`);
        u.name = realName;
        changed = true;

        // Sinkronkan ke riwayat presensi, lembur, dan izin jika ada catatan yang terisi ID
        let attFix = false;
        att.forEach(a => {
         if ((a.userNik === u.nik || (u.id && a.userId === u.id)) && isLikelyIdNotName(a.userName)) {
          a.userName = realName;
          attFix = true;
         }
        });
        if (attFix) localStorage.setItem(`wfm_${wh.toLowerCase()}_attendance`, JSON.stringify(att));

        let otsFix = false;
        ots.forEach(o => {
         if ((o.userNik === u.nik || (u.id && o.userId === u.id)) && isLikelyIdNotName(o.userName)) {
          o.userName = realName;
          otsFix = true;
         }
        });
        if (otsFix) localStorage.setItem(`wfm_${wh.toLowerCase()}_overtime`, JSON.stringify(ots));

        let lvsFix = false;
        lvs.forEach(l => {
         if ((l.userNik === u.nik || (u.id && l.userId === u.id)) && isLikelyIdNotName(l.userName)) {
          l.userName = realName;
          lvsFix = true;
         }
        });
        if (lvsFix) localStorage.setItem(`wfm_${wh.toLowerCase()}_leaves`, JSON.stringify(lvs));
       }
      }
     });

     if (changed) {
      localStorage.setItem(storageKey, JSON.stringify(users));
      localStorage.setItem(backupKey, JSON.stringify(users));
      const nowIso = new Date().toISOString();
      localStorage.setItem('wfm_last_master_change_time', Date.now().toString());
      localStorage.setItem('wfm_master_updated_at', nowIso);
      if (typeof saveFullDatabaseToCloud === 'function') {
       saveFullDatabaseToCloud(false, true, true);
      }
     }
    } catch(e) {}
   });
  }

  // Helper pencari nilai kolom fleksibel pada baris Excel (Prioritas: Exact Match Dulu, Baru Partial Match)
  function getExcelVal(row, keywords, defaultVal = '', excludeKeywords = []) {
   if (!row || typeof row !== 'object') return defaultVal;
   const keys = Object.keys(row);

   // TAHAP 1: EXACT MATCH (Cocok persis 100% agar tidak ada kolom yang tertukar)
   for (const k of keys) {
    if (k === '_rawCells') continue;
    const cleanK = k.trim().toLowerCase();
    if (excludeKeywords.length > 0 && excludeKeywords.some(ex => cleanK.includes(ex.toLowerCase()))) {
     continue;
    }
    for (const kw of keywords) {
     const cleanKw = kw.toLowerCase().trim();
     if (cleanK === cleanKw) {
      const val = row[k];
      if (val !== undefined && val !== null && String(val).trim() !== '') {
       return String(val).trim();
      }
     }
    }
   }

   // TAHAP 2: PARTIAL MATCH (Hanya jika tidak ada kolom exact match)
   for (const k of keys) {
    if (k === '_rawCells') continue;
    const cleanK = k.trim().toLowerCase();
    if (excludeKeywords.length > 0 && excludeKeywords.some(ex => cleanK.includes(ex.toLowerCase()))) {
     continue;
    }
    for (const kw of keywords) {
     const cleanKw = kw.toLowerCase().trim();
     if (cleanK.includes(cleanKw)) {
      const val = row[k];
      if (val !== undefined && val !== null && String(val).trim() !== '') {
       return String(val).trim();
      }
     }
    }
   }
   return defaultVal;
  }

  // =========================================================
  // IMPORT EXCEL SUPER ROBUST (SEMUA BARIS DIJAMIN TERSIMPAN & NIK OTOMATIS DIBUAT DARI KODE UNIK)
  // =========================================================
  function handleExcelUpload(e) {
   const file = e.target.files[0];
   if (!file) return;

   if (typeof repairCorruptedEmployeeNames === 'function') {
    repairCorruptedEmployeeNames();
   }

   const reader = new FileReader();
   reader.onload = async (event) => {
    try {
     const data = new Uint8Array(event.target.result);
     const workbook = XLSX.read(data, { type: 'array' });
     if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
      alert('File Excel kosong atau tidak terbaca.');
      return;
     }

     // SMART MULTI-SHEET DETECTION:
     // Cari sheet terbaik yang berisi data karyawan (prioritas kecocokan gudang aktif)
     let bestSheetName = workbook.SheetNames[0];
     let bestSheetData = null;
     let bestHeaderScore = -1;
     let bestHeaderRowIdx = -1;

     for (const sName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sName];
      if (!sheet) continue;
      const sData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      if (!sData || !Array.isArray(sData) || sData.length === 0) continue;

      let hRowIdx = -1;
      let maxScore = -1;
      for (let i = 0; i < Math.min(sData.length, 20); i++) {
       const rowArr = sData[i];
       if (!Array.isArray(rowArr)) continue;
       const nonBlankCells = rowArr.filter(c => c !== undefined && c !== null && String(c).trim() !== '');
       if (nonBlankCells.length < 2) continue;

       let score = 0;
       const rowStr = rowArr.map(c => String(c).toLowerCase().trim()).join(' ');
       if (rowStr.includes('nama') || rowStr.includes('name')) score += 12;
       if (rowStr.includes('nik') || rowStr.includes('id karyawan') || rowStr.includes('nomor induk') || rowStr.includes('no induk') || rowStr.includes('nip') || rowStr.includes('id system')) score += 10;
       if (rowStr.includes('dept') || rowStr.includes('departemen') || rowStr.includes('bagian')) score += 5;
       if (rowStr.includes('outsource') || rowStr.includes('vendor')) score += 4;
       if (rowStr.includes('posisi') || rowStr.includes('jabatan') || rowStr.includes('role')) score += 4;
       if (rowStr.includes('telepon') || rowStr.includes('phone') || rowStr.includes('telp') || rowStr.includes('hp')) score += 4;
       if (rowStr.includes('email') || rowStr.includes('surel')) score += 4;
       if (rowStr.includes('join') || rowStr.includes('masuk')) score += 4;
       if (rowStr.includes('gudang') || rowStr.includes('warehouse')) score += 4;

       if (score > maxScore) {
        maxScore = score;
        hRowIdx = i;
       }
      }

      let sheetScore = maxScore;
      const sLower = sName.toLowerCase();
      const curWh = (activeWarehouse || 'MBI').toLowerCase();
      if (sLower.includes(curWh)) sheetScore += 20;
      if (sLower.includes('karyawan') || sLower.includes('employee')) sheetScore += 10;

      if (sheetScore > bestHeaderScore && maxScore >= 5) {
       bestHeaderScore = sheetScore;
       bestSheetName = sName;
       bestSheetData = sData;
       bestHeaderRowIdx = hRowIdx;
      }
     }

     if (!bestSheetData || bestSheetData.length === 0) {
      bestSheetName = workbook.SheetNames[0];
      bestSheetData = XLSX.utils.sheet_to_json(workbook.Sheets[bestSheetName], { header: 1, defval: '' });
     }

     const rawSheetData = bestSheetData;
     if (!rawSheetData || rawSheetData.length === 0) {
      alert('File Excel kosong atau tidak terbaca.');
      return;
     }

     let headerRowIdx = bestHeaderRowIdx;
     if (headerRowIdx < 0) {
      for (let i = 0; i < Math.min(rawSheetData.length, 15); i++) {
       const rowArr = rawSheetData[i];
       if (!Array.isArray(rowArr)) continue;
       const rowStr = rowArr.map(c => String(c).toLowerCase().trim()).join(' ');
       if ((rowStr.includes('nama') || rowStr.includes('name')) && (rowStr.includes('nik') || rowStr.includes('id') || rowStr.includes('dept'))) {
        headerRowIdx = i;
        break;
       }
      }
     }

     const rawHeaders = headerRowIdx >= 0 ? (rawSheetData[headerRowIdx] || []) : [];
     const headers = rawHeaders.map(h => String(h || '').trim().toLowerCase());

     // =========================================================
     // DETERMINISTIC COLUMN MAPPING
     // Memetakan indeks kolom secara presisi dan pasti, tidak akan tertukar
     // =========================================================
     let colIdx_idSystem = -1;
     let colIdx_nik = -1;
     let colIdx_no = -1;
     let colIdx_name = -1;
     let colIdx_dept = -1;
     let colIdx_outsource = -1;
     let colIdx_role = -1;
     let colIdx_phone = -1;
     let colIdx_email = -1;
     let colIdx_joinDate = -1;
     let colIdx_warehouse = -1;

     // Tahap 1: Deteksi berdasarkan teks header
     headers.forEach((h, colIdx) => {
      if (!h) return;
      // 1. ID System
      if (h.includes('id system') || h.includes('idsystem') || h.includes('id database') || h.includes('user id') || h.includes('userid')) {
       colIdx_idSystem = colIdx;
       return;
      }
      // 2. NIK / ID Karyawan (WAJIB TIDAK MENGANDUNG KATA 'NAMA' ATAU 'NAME')
      if ((h === 'nik' || h === 'id' || h === 'nip' || h.includes('nik karyawan') || h.includes('id karyawan') || h.includes('employee id') || h.includes('emp id') || h.includes('id_karyawan') || h.includes('nik/id') || h.includes('id/nik') || h === 'no id' || h === 'kode' || h.includes('nomor induk') || h.includes('no induk') || h.includes('no. induk') || h.includes('kode karyawan') || h.includes('barcode') || h.includes('id pegawai') || h.includes('no karyawan') || h.includes('nomor karyawan') || h.includes('no. karyawan') || h.includes('no pegawai') || h.includes('nomor pegawai')) && !h.includes('nama') && !h.includes('name')) {
       colIdx_nik = colIdx;
       return;
      }
      // 2.5 Kolom No Urut / Nomor (No, No., No Urut, Nomor) sebagai nomor NIK
      if (h === 'no' || h === 'no.' || h === 'nomor' || h === 'no urut' || h === 'no. urut' || h === '#' || h === 'urut') {
       colIdx_no = colIdx;
       return;
      }
      // 3. Nama Karyawan (WAJIB TIDAK MENGANDUNG KATA 'SYSTEM' ATAU 'DATABASE')
      if ((h.includes('nama') || h.includes('name')) && !h.includes('system') && !h.includes('database')) {
       colIdx_name = colIdx;
       return;
      }
      // 4. Departemen
      if (h.includes('dept') || h.includes('departemen') || h.includes('bagian') || h.includes('divisi') || h.includes('unit')) {
       colIdx_dept = colIdx;
       return;
      }
      // 5. Outsource
      if (h.includes('outsource') || h.includes('vendor') || h.includes('perusahaan') || h.includes('instansi') || h.includes('pt') || h.includes('cv')) {
       colIdx_outsource = colIdx;
       return;
      }
      // 6. Role / Posisi
      if (h.includes('posisi') || h.includes('jabatan') || h.includes('role')) {
       colIdx_role = colIdx;
       return;
      }
      // 7. Telepon
      if (h.includes('telp') || h.includes('telepon') || h.includes('phone') || h.includes('hp') || h.includes('wa') || h.includes('kontak') || h.includes('mobile')) {
       colIdx_phone = colIdx;
       return;
      }
      // 8. Email
      if (h.includes('email') || h.includes('surel') || h.includes('mail')) {
       colIdx_email = colIdx;
       return;
      }
      // 9. Join Date
      if (h.includes('join') || h.includes('masuk') || h.includes('gabung') || h.includes('tgl masuk') || h.includes('tanggal masuk')) {
       colIdx_joinDate = colIdx;
       return;
      }
      // 10. Gudang
      if (h.includes('gudang') || h.includes('warehouse')) {
       colIdx_warehouse = colIdx;
       return;
      }
     });

     // Jika kolom NIK belum ada, gunakan kolom No / Nomor Urut sebagai NIK
     if (colIdx_nik === -1 && colIdx_no !== -1) {
      colIdx_nik = colIdx_no;
     }

     // Tahap 2: Fallback Cerdas jika nama atau NIK belum terdeteksi (sampling isi sel baris data asli)
     const startSample = headerRowIdx >= 0 ? headerRowIdx + 1 : 0;
     const endSample = Math.min(rawSheetData.length, startSample + 10);
     
     if (colIdx_name === -1 || colIdx_nik === -1) {
      const colHumanNameVotes = {};
      const colIdVotes = {};

      for (let r = startSample; r < endSample; r++) {
       const rowArr = rawSheetData[r];
       if (!Array.isArray(rowArr)) continue;
       rowArr.forEach((cell, cIdx) => {
        if (cell === undefined || cell === null) return;
        const str = String(cell).trim();
        if (!str || str === '-') return;
        if (isLikelyHumanName(str)) {
         colHumanNameVotes[cIdx] = (colHumanNameVotes[cIdx] || 0) + 1;
        }
        if (isLikelyIdNotName(str)) {
         colIdVotes[cIdx] = (colIdVotes[cIdx] || 0) + 1;
        }
       });
      }

      if (colIdx_name === -1) {
       let maxVotes = 0;
       Object.keys(colHumanNameVotes).forEach(cIdx => {
        const votes = colHumanNameVotes[cIdx];
        const colInt = parseInt(cIdx, 10);
        if (votes > maxVotes && colInt !== colIdx_nik) {
         maxVotes = votes;
         colIdx_name = colInt;
        }
       });
      }

      if (colIdx_nik === -1) {
       let maxVotes = 0;
       Object.keys(colIdVotes).forEach(cIdx => {
        const votes = colIdVotes[cIdx];
        const colInt = parseInt(cIdx, 10);
        if (votes > maxVotes && colInt !== colIdx_name && colInt !== colIdx_idSystem) {
         maxVotes = votes;
         colIdx_nik = colInt;
        }
       });
      }
     }

     // Tahap 3: Ekstraksi seluruh baris data karyawan
     const dataStartIdx = headerRowIdx >= 0 ? headerRowIdx + 1 : 0;
     const parsedRows = [];
     const seenInExcel = new Set();
     let targetWh = activeWarehouse || 'MBI';
     const sLower = (bestSheetName || '').toLowerCase();
     if (sLower.includes('mai') && !sLower.includes('mbi')) targetWh = 'MAI';
     else if (sLower.includes('mbi') && !sLower.includes('mai')) targetWh = 'MBI';
     let existingUsers = getWhDB(targetWh, 'users', targetWh === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);

     for (let i = dataStartIdx; i < rawSheetData.length; i++) {
      const rowArr = rawSheetData[i];
      if (!rowArr || !Array.isArray(rowArr) || rowArr.length === 0) continue;
      const hasData = rowArr.some(c => c !== undefined && c !== null && String(c).trim() !== '');
      if (!hasData) continue;

      // 1. Ambil ID System (jika ada dari hasil download aplikasi)
      let idSystem = '';
      if (colIdx_idSystem !== -1 && rowArr[colIdx_idSystem] !== undefined && rowArr[colIdx_idSystem] !== null) {
       idSystem = String(rowArr[colIdx_idSystem]).trim();
      }

      // 2. Ambil NIK / ID Karyawan
      let rawNik = '';
      if (colIdx_nik !== -1 && rowArr[colIdx_nik] !== undefined && rowArr[colIdx_nik] !== null) {
       const strNik = String(rowArr[colIdx_nik]).trim().toUpperCase();
       if (strNik !== '-' && strNik !== '--' && strNik !== 'N/A' && strNik !== 'NULL') {
        rawNik = strNik;
       }
      }
      // Fallback: Jika NIK kosong pada baris ini, periksa kolom No / No. Urut
      if (!rawNik && colIdx_no !== -1 && rowArr[colIdx_no] !== undefined && rowArr[colIdx_no] !== null) {
       const strNo = String(rowArr[colIdx_no]).trim();
       if (strNo !== '-' && strNo !== '--' && strNo !== 'N/A' && strNo !== 'NULL' && /^\d+$/.test(strNo)) {
        rawNik = strNo;
       }
      }

      // 3. Ambil Nama Karyawan
      let name = '';
      if (colIdx_name !== -1 && rowArr[colIdx_name] !== undefined && rowArr[colIdx_name] !== null) {
       name = String(rowArr[colIdx_name]).trim();
      }

      // PERISAI 1: Jika kolom nama ternyata berisi kode ID / angka
      if (isLikelyIdNotName(name)) {
       if (!rawNik) rawNik = name.toUpperCase();
       name = '';
      }

      // PERISAI 2: Jika nama masih kosong atau belum memenuhi standar nama manusia
      // Cari dari seluruh sel baris Excel yang memenuhi kriteria nama manusia sah
      if (!name || !isLikelyHumanName(name)) {
       for (let c = 0; c < rowArr.length; c++) {
        if (c === colIdx_nik || c === colIdx_idSystem) continue;
        const strCell = String(rowArr[c] || '').trim();
        if (isLikelyHumanName(strCell)) {
         name = strCell;
         break;
        }
       }
      }

      // PERISAI 3: Jika masih kosong, coba pulihkan dari user lama di sistem berdasarkan NIK lama atau ID
      if (!name || !isLikelyHumanName(name)) {
       const prevUser = existingUsers.find(u => 
        (idSystem && u.id === idSystem) || 
        (rawNik && (u.nik || '').toUpperCase() === rawNik)
       );
       if (prevUser && prevUser.name && isLikelyHumanName(prevUser.name)) {
        name = prevUser.name;
       }
      }

      // Lewati baris kosong tanpa nama dan tanpa NIK
      if (!name && !rawNik && !idSystem) continue;

      // Cegah duplikasi baris ganda yang identik di file Excel itu sendiri
      const excelKey = idSystem || rawNik || cleanStr(name);
      if (seenInExcel.has(excelKey)) continue;
      seenInExcel.add(excelKey);

      // Departemen & Posisi
      let rawDept = colIdx_dept !== -1 ? String(rowArr[colIdx_dept] || '').trim().toLowerCase() : '';
      let rawRole = colIdx_role !== -1 ? String(rowArr[colIdx_role] || '').trim().toLowerCase() : 'staff';
      if (!rawRole) rawRole = 'staff';

      let finalDept = 'Warehouse Staff';
      let finalRole = 'staff';
      let hasAccount = false;

      const isSpv = rawDept.includes('supervisor') || rawDept === 'spv' || rawRole.includes('supervisor') || rawRole === 'spv';
      const isCoord = rawDept.includes('coordinator') || rawDept.includes('koordinator') || rawDept.includes('cordinator') || rawRole.includes('coordinator') || rawRole.includes('koordinator') || rawRole.includes('cordinator');

      if (isSpv) {
       finalDept = 'Supervisor';
       finalRole = 'supervisor';
       hasAccount = true;
      } else if (isCoord) {
       finalDept = 'Coordinator';
       finalRole = 'coordinator';
       hasAccount = true;
      } else {
       finalDept = 'Warehouse Staff';
       finalRole = 'staff';
       hasAccount = false;
      }

      // Outsource (Hanya ADP, Staffinc, Internal)
      let rawOutsource = colIdx_outsource !== -1 ? String(rowArr[colIdx_outsource] || '').trim() : 'Internal';
      let finalOutsource = normalizeOSName(rawOutsource);

      // No Telepon
      let rawPhone = colIdx_phone !== -1 ? String(rowArr[colIdx_phone] || '').trim() : '-';
      let phone = cleanExcelPhone(rawPhone, name, finalDept);

      // Email
      let rawEmail = colIdx_email !== -1 ? String(rowArr[colIdx_email] || '').trim() : '';
      let email = (rawEmail && rawEmail !== '-' && rawEmail.includes('@')) ? rawEmail : '';

      // Join Date
      let rawJoin = colIdx_joinDate !== -1 ? String(rowArr[colIdx_joinDate] || '').trim() : '-';
      let joinDate = formatExcelDate(rawJoin);

      parsedRows.push({
       idSystem,
       name,
       rawNik,
       dept: finalDept,
       role: finalRole,
       hasAccount,
       password: hasAccount ? 'medika123' : '',
       isFirstLogin: hasAccount,
       outsource: finalOutsource,
       phone,
       email,
       joinDate
      });
     }

     if (parsedRows.length === 0) {
      alert('Tidak ada baris data karyawan yang ditemukan pada file Excel.');
      return;
     }

     let replaceMode = true;
     if (parsedRows.length >= 10) {
      const proceed = confirm(
       `Å¸â€œÅ  Ditemukan ${parsedRows.length} data karyawan pada file Excel.\n\n` +
       `Sinkronkan data ini ke Gudang ${targetWh}?\n\n` +
       `• Karyawan yang cocok akan otomatis diperbarui datanya (nama, NIK/ID, departemen, dsb).\n` +
       `• Karyawan baru dari Excel akan otomatis ditambahkan.\n` +
       `• Total data karyawan aktif akan disinkronkan tepat berjumlah ${parsedRows.length} orang.\n` +
       `• Riwayat absensi, lembur, dan izin tetap aman tersimpan.\n\n` +
       `Klik [OK] untuk Memproses, atau [Cancel] untuk Batal.`
      );
      if (!proceed) return;
      replaceMode = true;
     } else {
      const isAddMode = confirm(
       `Å¸â€œÅ  Ditemukan ${parsedRows.length} data karyawan pada file Excel.\n\n` +
       `• Klik [OK] untuk MENAMBAH / GABUNG ke daftar karyawan Gudang ${targetWh} saat ini.\n` +
       `• Klik [Cancel] untuk MENGGANTI TOTAL seluruh data karyawan dengan file ini saja.`
      );
      replaceMode = !isAddMode;
     }

     // Bersihkan data existingUsers dari data ghost / nama kode ID sebelum diproses
     existingUsers = existingUsers.filter(u => {
      if (isManagementSystemAccount(u)) return true;
      if (isLikelyIdNotName(u.name) || !isLikelyHumanName(u.name)) return false;
      return true;
     });

     // Pisahkan akun pengelola sistem (Admin, Scanner, Manager)
     const managementAccounts = existingUsers.filter(u => isManagementSystemAccount(u));
     
     try {
      localStorage.removeItem('wfm_deleted_user_keys');
     } catch(e) {}

     const year = new Date().getFullYear().toString().slice(-2);
     const prefix = `${targetWh.toUpperCase()}${year}-`;

     // Urutan karyawan dari baris file Excel 100% DIPERTAHANKAN sesuai dokumen Excel asli
     // TANPA pengurutan join date agar sistem mengikuti apa yang ada di Excel

     // Hitung nomor urut NIK tertinggi yang pernah ada
     let maxSeqNum = 0;
     const checkMax = (n) => {
      if (!n || typeof n !== 'string') return;
      const cleanN = n.toUpperCase().trim();
      if (cleanN.startsWith(prefix)) {
       const numPart = parseInt(cleanN.replace(prefix, ''), 10);
       if (!isNaN(numPart) && numPart > maxSeqNum) {
        maxSeqNum = numPart;
       }
      } else if (/^\d+$/.test(cleanN)) {
       const numPart = parseInt(cleanN, 10);
       if (!isNaN(numPart) && numPart > maxSeqNum) {
        maxSeqNum = numPart;
       }
      }
     };
     existingUsers.forEach(u => checkMax(u.nik));
     parsedRows.forEach(r => checkMax(r.rawNik));

     const assignedNiks = new Set();
     managementAccounts.forEach(m => {
      if (m.nik) assignedNiks.add(m.nik.toUpperCase().trim());
     });

     const nowIso = new Date().toISOString();
     const nikChangeMap = {};
     const nameChangeMap = {};
     const matchedExistingIds = new Set();
     const updatedRegularUsers = [];
     let countUpdated = 0;
     let countAdded = 0;

     parsedRows.forEach((item, idx) => {
      // 1. CARI DATA KARYAWAN LAMA YANG COCOK DI DATABASE SISTEM
      // 1. CARI DATA KARYAWAN LAMA YANG COCOK DI DATABASE SISTEM
      // Prioritas pencocokan identitas:
      // a. Cocok ID System (jika ada hasil download dari sistem)
      // b. Cocok Nama Manusia (Nama adalah identitas mutlak orang tersebut agar NIK tidak tertukar)
      // c. Cocok NIK dari Excel (Hanya jika nama lama adalah placeholder/ID, bukan orang berbeda)
      let match = null;
      if (item.idSystem) {
       match = existingUsers.find(u => !isManagementSystemAccount(u) && u.id === item.idSystem);
      }
      if (!match && item.name && isLikelyHumanName(item.name)) {
       match = existingUsers.find(u => !isManagementSystemAccount(u) && cleanStr(u.name) === cleanStr(item.name));
      }
      if (!match && item.rawNik) {
       const itemNikUpper = item.rawNik.toUpperCase().trim();
       match = existingUsers.find(u => {
        if (isManagementSystemAccount(u)) return false;
        const uNikUpper = (u.nik || '').toUpperCase().trim();
        // Hanya cocokkan ke NIK lama jika nama lama di sistem bukan nama manusia yang berbeda (misal nama rusak / placeholder)
        if (uNikUpper === itemNikUpper || cleanStr(u.nik) === cleanStr(item.rawNik)) {
         if (!isLikelyHumanName(u.name) || isLikelyIdNotName(u.name)) return true;
        }
        return false;
       });
      }

      // 2. TENTUKAN NIK FINAL:
      // Data karyawan yang sudah ada ID-nya di Excel dijadikan NILAI MUTLAK milik karyawan tersebut!
      let finalNik = '';
      const cItemName = cleanStr(item.name);
      if (targetWh === 'MBI' && cItemName === 'ogisaputra') {
       finalNik = 'MBI26-009';
      } else if (targetWh === 'MBI' && cItemName === 'yonno') {
       finalNik = 'MBI26-010';
      } else if (targetWh === 'MBI' && (cItemName === 'galangerdiansyah' || (item.name && item.name.toUpperCase().includes('GALANG') && item.name.toUpperCase().includes('ERDIANSYAH')))) {
       finalNik = 'MBI26-011';
      } else if (targetWh === 'MBI' && (cItemName === 'melindagitawismaya' || cItemName.includes('melinda'))) {
       finalNik = 'MBI26-122';
      } else if (targetWh === 'MAI' && (cItemName === 'akmal' || cItemName.includes('akmal'))) {
       finalNik = 'MAI26-034';
      } else if (targetWh === 'MAI' && (cItemName === 'achmadvikih' || cItemName.includes('vikih'))) {
       finalNik = 'MAI26-035';
      } else if (targetWh === 'MAI' && (cItemName === 'mohamadyuliandi' || cItemName.includes('yuliandi'))) {
       finalNik = 'MAI26-041';
      } else if (targetWh === 'MAI' && (cItemName === 'nirwanfadlipulungan' || cItemName.includes('nirwan'))) {
       finalNik = 'MAI26-042';
      } else if (item.rawNik && item.rawNik.trim() !== '') {
       let n = item.rawNik.trim();
       // Format jika angka murni (e.g. 1 -> MBI26-001, 64 -> MBI26-064)
       if (/^\d+$/.test(n)) {
        n = `${prefix}${String(n).padStart(3, '0')}`;
       }
       finalNik = n.toUpperCase();
      } else if (match && match.nik && match.nik.trim() !== '') {
       finalNik = match.nik.toUpperCase().trim();
      }

      if (finalNik) {
       // NIK DARI EXCEL ADALAH NILAI MUTLAK:
       // Buka penanda terhapus agar ID dari karyawan yang pernah resign/dihapus dapat digunakan kembali
       unmarkDeletedUser(finalNik);
       assignedNiks.add(finalNik);
      } else {
       // HANYA JIKA NIK KOSONG di Excel / Admin:
       // Sistem membuatkan ID otomatis secara berurutan mulai dari nilai ID paling akhir (+1)
       maxSeqNum++;
       let candidate = `${prefix}${String(maxSeqNum).padStart(3, '0')}`;
       while (assignedNiks.has(candidate.toUpperCase())) {
        maxSeqNum++;
        candidate = `${prefix}${String(maxSeqNum).padStart(3, '0')}`;
       }
       finalNik = candidate;
       assignedNiks.add(finalNik.toUpperCase());
      }

      // 3. JIKA MATCH KARYAWAN DITEMUKAN: UPDATE DATA KARYAWAN LAMA
      if (match) {
       matchedExistingIds.add(match.id);
       unmarkDeletedUser(match.name);
       if (match.nik) unmarkDeletedUser(match.nik);
       if (match.id) unmarkDeletedUser(match.id);
       if (item.name) unmarkDeletedUser(item.name);
       if (finalNik) unmarkDeletedUser(finalNik);
       const oldNik = (match.nik || '').toUpperCase();
       const oldName = cleanStr(match.name);

       // Catat perubahan NIK untuk kaskade ke attendance, overtime, leaves
       if (oldNik && oldNik !== finalNik) {
        nikChangeMap[oldNik] = finalNik;
        if (assignedNiks.has(oldNik) && oldNik !== finalNik) {
         assignedNiks.delete(oldNik);
        }
       }

       // Update nama karyawan lama HANYA jika item.name adalah nama manusia yang sah!
       if (item.name && isLikelyHumanName(item.name)) {
        if (oldName && oldName !== cleanStr(item.name)) {
         nameChangeMap[oldName] = item.name;
        }
        match.name = item.name;
       }

       match.nik = finalNik;
       match.barcodeValue = finalNik;
       match.dept = item.dept;
       match.role = item.role;
       match.hasAccount = item.hasAccount;
       if (item.hasAccount && !match.password) {
        match.password = 'medika123';
        match.isFirstLogin = true;
       } else if (!item.hasAccount) {
        match.password = '';
       }
       match.outsource = item.outsource;
       match.phone = item.phone;
       match.email = item.email;
       match.joinDate = item.joinDate;
       match.warehouse = targetWh;
       match.updatedAt = nowIso;

       updatedRegularUsers.push(match);
       countUpdated++;
      } else {
       // 4. KARYAWAN BARU YANG BELUM ADA DI DATABASE
       let safeName = item.name;
       if (!safeName || isLikelyIdNotName(safeName) || !isLikelyHumanName(safeName)) {
        safeName = finalNik ? `Karyawan Baru (${finalNik})` : 'Karyawan Baru';
       } else {
        unmarkDeletedUser(safeName);
       }
       if (finalNik) unmarkDeletedUser(finalNik);

       const newId = item.idSystem || `${targetWh.toLowerCase()}-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`;
       const newUser = {
        id: newId,
        name: safeName,
        nik: finalNik,
        barcodeValue: finalNik,
        dept: item.dept,
        role: item.role,
        hasAccount: item.hasAccount,
        password: item.hasAccount ? 'medika123' : '',
        isFirstLogin: item.hasAccount,
        outsource: item.outsource,
        phone: item.phone,
        email: item.email,
        joinDate: item.joinDate,
        warehouse: targetWh,
        updatedAt: nowIso
       };
       updatedRegularUsers.push(newUser);
       countAdded++;
      }
     });

     // Jika mode gabung (bukan replace total), pertahankan karyawan lama yang tidak tercantum di file Excel
     if (!replaceMode) {
      existingUsers.forEach(u => {
       if (!isManagementSystemAccount(u) && !matchedExistingIds.has(u.id)) {
        if (!isLikelyHumanName(u.name) || isLikelyIdNotName(u.name)) return;
        if (!updatedRegularUsers.some(reg => reg.id === u.id || cleanStr(reg.name) === cleanStr(u.name) || (reg.nik && reg.nik.toUpperCase() === (u.nik || '').toUpperCase()))) {
         updatedRegularUsers.push(u);
        }
       }
      });
     }

     // Sinkronkan riwayat absensi, cuti & lembur jika ada perubahan NIK atau Nama
     const hasNikChanges = Object.keys(nikChangeMap).length > 0;
     const hasNameChanges = Object.keys(nameChangeMap).length > 0;
     if (hasNikChanges || hasNameChanges) {
      let att = getWhDB(targetWh, 'attendance', []);
      let attChanged = false;
      att.forEach(a => {
       const curNik = (a.userNik || '').toUpperCase();
       const normName = cleanStr(a.userName);
       if (nikChangeMap[curNik]) {
        a.userNik = nikChangeMap[curNik];
        attChanged = true;
       }
       if (nameChangeMap[normName]) {
        a.userName = nameChangeMap[normName];
        attChanged = true;
       }
      });
      if (attChanged) localStorage.setItem(`wfm_${targetWh.toLowerCase()}_attendance`, JSON.stringify(att));

      let lvs = getWhDB(targetWh, 'leaves', []);
      let lvsChanged = false;
      lvs.forEach(l => {
       const curNik = (l.userNik || '').toUpperCase();
       const normName = cleanStr(l.userName);
       if (nikChangeMap[curNik]) {
        l.userNik = nikChangeMap[curNik];
        lvsChanged = true;
       }
       if (nameChangeMap[normName]) {
        l.userName = nameChangeMap[normName];
        lvsChanged = true;
       }
      });
      if (lvsChanged) localStorage.setItem(`wfm_${targetWh.toLowerCase()}_leaves`, JSON.stringify(lvs));

      let ots = getWhDB(targetWh, 'overtime', []);
      let otsChanged = false;
      ots.forEach(o => {
       const curNik = (o.userNik || '').toUpperCase();
       const normName = cleanStr(o.userName);
       if (nikChangeMap[curNik]) {
        o.userNik = nikChangeMap[curNik];
        otsChanged = true;
       }
       if (nameChangeMap[normName]) {
        o.userName = nameChangeMap[normName];
        otsChanged = true;
       }
      });
      if (otsChanged) localStorage.setItem(`wfm_${targetWh.toLowerCase()}_overtime`, JSON.stringify(ots));
     }

     // Susun daftar user akhir dan bersihkan duplikat
     const finalCleanUsers = deduplicateUserList([...managementAccounts, ...updatedRegularUsers], targetWh);
     const storageKey = `wfm_${targetWh.toLowerCase()}_users`;
     localStorage.setItem(storageKey, JSON.stringify(finalCleanUsers));
     localStorage.setItem(`wfm_${targetWh.toLowerCase()}_users_backup`, JSON.stringify(finalCleanUsers));
     localStorage.setItem('wfm_last_master_change_time', Date.now().toString());
     localStorage.setItem('wfm_master_updated_at', nowIso);

     // Bersihkan & bangun ulang permanent registry khusus untuk gudang ini dari file baru
     try {
      const permRaw = localStorage.getItem('wfm_permanent_nik_name_registry');
      const permObj = permRaw ? JSON.parse(permRaw) : {};
      Object.keys(permObj).forEach(k => {
       if (k.startsWith(`${targetWh}_`)) delete permObj[k];
      });
      finalCleanUsers.forEach(u => {
       if (u && u.name && u.nik && !isLikelyIdNotName(u.name)) {
        permObj[`${targetWh}_${cleanStr(u.name)}`] = u.nik.toUpperCase().trim();
       }
      });
      localStorage.setItem('wfm_permanent_nik_name_registry', JSON.stringify(permObj));
     } catch(e) {}

     // KASKADE PENYELARASAN MENYELURUH: Sesuaikan seluruh log riwayat absensi, lembur, dan cuti
     // agar NIK yang sempat tertukar namanya otomatis mengikuti data dari file Excel yang baru di-upload!
     const realignedCount = realignAllAttendanceRecordsWithMaster(targetWh);

     if (typeof sanitizeDeletedUserKeysWithActiveUsers === 'function') {
      sanitizeDeletedUserKeysWithActiveUsers();
     }

     // Unggah seketika ke Cloud Firebase dengan FORCE MASTER UPLOAD (tanpa pre-merge dengan data lama Cloud)
     await saveFullDatabaseToCloud(false, true, true);

     try { renderEmployeeTable(); } catch (e) { console.warn('renderEmployeeTable err:', e); }
     try { populateDropdownEmployees(); } catch (e) { console.warn('populateDropdownEmployees err:', e); }
     try { renderOvertimeEmployeeGrid(); } catch (e) { console.warn('renderOvertimeEmployeeGrid err:', e); }
     try { refreshAllDashboardData(); } catch (e) { console.warn('refreshAllDashboardData err:', e); }
     try { renderAccountLookupList(); } catch (e) { console.warn('renderAccountLookupList err:', e); }

     const totalActive = finalCleanUsers.filter(u => !isManagementSystemAccount(u)).length;
     alert(
      `Å“â€¦ BERHASIL IMPORT & UPDATE DATA KARYAWAN DARI EXCEL!\n\n` +
      `• Data Diperbarui (Updated): ${countUpdated} orang\n` +
      `• Data Ditambahkan (New): ${countAdded} orang\n` +
      `• Total Karyawan Aktif: ${totalActive} orang\n` +
      `• Riwayat Absen Diselaraskan: ${realignedCount} catatan diperbaiki otomatis\n` +
      `• Sinkronisasi Cloud: Tersimpan Permanen 24/7 di Firebase (Data Bersih)\n\n` +
      `Sistem kini 100% mengikuti susunan file Excel Anda dan tidak ada lagi NIK ganda.`
     );
    } catch (err) {
     console.error('Excel parse error:', err);
     alert('Gagal membaca file Excel: ' + (err.message || err));
    } finally {
     e.target.value = '';
     const empInput = document.getElementById('emp-excel-file');
     if (empInput) empInput.value = '';
     const excelInput = document.getElementById('excel-file-input');
     if (excelInput) excelInput.value = '';
    }
   };
   reader.readAsArrayBuffer(file);
  }

  // =========================================================
  // FITUR PENGATURAN AKUN & PROFIL (GANTI NAMA, TELP, EMAIL, PASSWORD)
  // =========================================================
  function renderAccountSettingsForm() {
   if (!currentUser) return;
   const wh = currentUser.warehouse || activeWarehouse || 'MBI';
   const users = getWhDB(wh, 'users', wh === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);
   const freshUser = users.find(u => u.id === currentUser.id || u.nik === currentUser.nik) || currentUser;

   const nikEl = document.getElementById('setting-nik');
   if (nikEl) nikEl.value = freshUser.nik || '';

   const nameEl = document.getElementById('setting-name');
   if (nameEl) nameEl.value = freshUser.name || '';

   const phoneEl = document.getElementById('setting-phone');
   if (phoneEl) phoneEl.value = freshUser.phone || '';

   const emailEl = document.getElementById('setting-email');
   if (emailEl) emailEl.value = freshUser.email || '';

   const p1El = document.getElementById('setting-pwd-1');
   if (p1El) p1El.value = '';

   const p2El = document.getElementById('setting-pwd-2');
   if (p2El) p2El.value = '';

   const avatarEl = document.getElementById('settings-avatar');
   if (avatarEl) avatarEl.innerText = (freshUser.name || 'U').charAt(0).toUpperCase();

   const headName = document.getElementById('settings-header-name');
   if (headName) headName.innerText = freshUser.name || 'User';

   const headNik = document.getElementById('settings-header-nik');
   if (headNik) headNik.innerText = `NIK: ${freshUser.nik || '-'}`;

   const whBadge = document.getElementById('settings-wh-badge');
   if (whBadge) whBadge.innerText = `Gudang ${freshUser.warehouse || activeWarehouse}`;

   const roleBadge = document.getElementById('settings-role-badge');
   if (roleBadge) roleBadge.innerText = (freshUser.role || 'staff').toUpperCase();

   const deptBadge = document.getElementById('settings-dept-badge');
   if (deptBadge) deptBadge.innerText = (freshUser.dept || 'Staff').toUpperCase();

   const alertEl = document.getElementById('settings-alert');
   if (alertEl) alertEl.classList.add('hidden');

   // Highlight kartu font pilihan yang sedang aktif
   try {
    const currentFont = localStorage.getItem('wfm_app_font') || 'plus-jakarta';
    applyWebFont(currentFont, false);
   } catch (e) {}

   // Highlight kartu tema pilihan yang sedang aktif
   try {
    const currentTheme = localStorage.getItem('wfm_app_theme') || 'navy';
    applyAppTheme(currentTheme, false);
   } catch (e) {}

   lucide.createIcons();
  }

  async function handleSaveAccountSettings(e) {
   e.preventDefault();
   if (!currentUser) return;

   const newName = document.getElementById('setting-name').value.trim();
   const newPhone = document.getElementById('setting-phone').value.trim();
   const newEmail = document.getElementById('setting-email').value.trim();
   const p1 = document.getElementById('setting-pwd-1').value.trim();
   const p2 = document.getElementById('setting-pwd-2').value.trim();
   const alertEl = document.getElementById('settings-alert');

   if (!newName) {
    if (alertEl) {
     alertEl.className = 'p-4 rounded-2xl text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200';
     alertEl.innerText = 'Nama lengkap karyawan tidak boleh kosong!';
     alertEl.classList.remove('hidden');
    }
    return;
   }

   if (p1 || p2) {
    if (p1.length < 6) {
     if (alertEl) {
      alertEl.className = 'p-4 rounded-2xl text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200';
      alertEl.innerText = 'Kata sandi baru minimal 6 karakter!';
      alertEl.classList.remove('hidden');
     }
     return;
    }
    if (p1 !== p2) {
     if (alertEl) {
      alertEl.className = 'p-4 rounded-2xl text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200';
      alertEl.innerText = 'Konfirmasi kata sandi baru tidak cocok!';
      alertEl.classList.remove('hidden');
     }
     return;
    }
   }

   const wh = currentUser.warehouse || activeWarehouse || 'MBI';
   let users = getWhDB(wh, 'users', wh === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);
   const idx = users.findIndex(u => u.id === currentUser.id || u.nik === currentUser.nik || (isUserManager(currentUser) && isUserManager(u)));

   if (idx !== -1) {
    const oldName = users[idx].name;
    const oldNik = users[idx].nik;
    const nowIso = new Date().toISOString();

    unmarkDeletedUser(newName);
    if (oldName) unmarkDeletedUser(oldName);
    if (oldNik) unmarkDeletedUser(oldNik);

    users[idx].name = newName;
    users[idx].phone = newPhone;
    users[idx].email = newEmail;
    users[idx].updatedAt = nowIso;
    if (p1) {
     delete users[idx].oldPassword;
     users[idx].previousPasswords = [];
     users[idx].password = p1;
     users[idx].isFirstLogin = false;
     users[idx].isPasswordChanged = true;
     if (isUserAdmin(users[idx]) && typeof setAdminCustomPassword === 'function') {
      setAdminCustomPassword(wh, p1);
     }
    }

    // Update currentUser session
    currentUser.name = newName;
    currentUser.phone = newPhone;
    currentUser.email = newEmail;
    currentUser.updatedAt = nowIso;
    if (p1) {
     delete currentUser.oldPassword;
     currentUser.previousPasswords = [];
     currentUser.password = p1;
     currentUser.isFirstLogin = false;
     currentUser.isPasswordChanged = true;
    }

    setWhDB(wh, 'users', users);

    // Jika Manager atau Admin, sinkronkan juga perubahan nama/profil ke gudang lainnya
    if (isUserManager(currentUser) || isUserAdmin(currentUser)) {
     const otherWh = wh === 'MBI' ? 'MAI' : 'MBI';
     let otherUsers = getWhDB(otherWh, 'users', otherWh === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);
     const otherIdx = otherUsers.findIndex(u => u.id === currentUser.id || u.nik === currentUser.nik || (isUserManager(currentUser) && isUserManager(u)));
     if (otherIdx !== -1) {
      otherUsers[otherIdx].name = newName;
      otherUsers[otherIdx].phone = newPhone;
      otherUsers[otherIdx].email = newEmail;
      otherUsers[otherIdx].updatedAt = nowIso;
      if (p1) {
       delete otherUsers[otherIdx].oldPassword;
       otherUsers[otherIdx].previousPasswords = [];
       otherUsers[otherIdx].password = p1;
       otherUsers[otherIdx].isFirstLogin = false;
       otherUsers[otherIdx].isPasswordChanged = true;
      }
      setWhDB(otherWh, 'users', otherUsers);
     } else if (isUserManager(currentUser)) {
      otherUsers.push({
       ...users[idx],
       warehouse: otherWh,
       updatedAt: nowIso
      });
      setWhDB(otherWh, 'users', otherUsers);
     }
    }

    // Kunci timestamp perubahan master data agar tidak tertimpa cloud lama
    localStorage.setItem('wfm_last_master_change_time', Date.now().toString());
    localStorage.setItem('wfm_master_updated_at', nowIso);
    localStorage.setItem(`wfm_${wh.toLowerCase()}_master_updated_at`, nowIso);
    localStorage.setItem('wfm_active_session', JSON.stringify(currentUser));

    // Jika nama berubah, sinkronkan ke riwayat absensi, leaves, overtime
    if (oldName !== newName) {
     let att = getWhDB(wh, 'attendance', []);
     let attChanged = false;
     att.forEach(a => {
      if (a.userNik === oldNik || a.userId === currentUser.id || a.userName === oldName) {
       a.userName = newName;
       attChanged = true;
      }
     });
     if (attChanged) setWhDB(wh, 'attendance', att);

     let lvs = getWhDB(wh, 'leaves', []);
     let lvsChanged = false;
     lvs.forEach(l => {
      if (l.userNik === oldNik || l.userName === oldName) {
       l.userName = newName;
       lvsChanged = true;
      }
     });
     if (lvsChanged) setWhDB(wh, 'leaves', lvs);

     let ots = getWhDB(wh, 'overtime', []);
     let otsChanged = false;
     ots.forEach(o => {
      if (o.userNik === oldNik || o.userId === currentUser.id || o.userName === oldName) {
       o.userName = newName;
       otsChanged = true;
      }
     });
     if (otsChanged) setWhDB(wh, 'overtime', ots);
    }

    // Simpan langsung ke Supabase 24/7 & Master Cloud
    try {
     if (typeof saveUsersToSupabase === 'function') {
      await saveUsersToSupabase(wh, users).catch(() => {});
      if (isUserManager(currentUser) || isUserAdmin(currentUser)) {
       const otherWh = wh === 'MBI' ? 'MAI' : 'MBI';
       const otherUsers = getWhDB(otherWh, 'users', []);
       if (otherUsers.length > 0) await saveUsersToSupabase(otherWh, otherUsers).catch(() => {});
      }
     }
    } catch (eSb) {}
    await saveFullDatabaseToCloud(false, true, true);

    // Update DOM Top Navbar
    const navName = document.getElementById('nav-user-name');
    if (navName) navName.innerText = newName;

    // Re-render
    renderAccountSettingsForm();
    renderEmployeeTable();
    populateDropdownEmployees();
    renderOvertimeEmployeeGrid();
    populatePermissionAccountDropdown();
    refreshAllDashboardData();
    renderAccountLookupList();

    if (alertEl) {
     alertEl.className = 'p-4 rounded-2xl text-xs font-bold bg-slate-100 text-slate-800 border border-slate-300';
     alertEl.innerText = 'Perubahan akun & data karyawan berhasil disimpan! Data kata sandi terbaru otomatis diperbarui di sistem.';
     alertEl.classList.remove('hidden');
    }
    alert('Pengaturan akun berhasil disimpan!\nData profil dan kata sandi terbaru Anda telah tersinkronisasi.');
   }
  }

  // =========================================================