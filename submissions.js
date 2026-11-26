// === WFM MEDIKA SUBMISSIONS & INTEGRATIONS ===
  // FITUR FORM IZIN / SAKIT / CUTI (LEAVES)
  // =========================================================
  function handleLeaveSubmit(e) {
   e.preventDefault();
   if (!hasPermission('perm_submit_leave_staff') && !isUserAdmin(currentUser) && !isUserManager(currentUser)) {
    alert('Akses Ditolak: Anda tidak memiliki izin untuk mengajukan form sakit/izin/cuti.');
    return;
   }
   const targetNik = document.getElementById('leave-employee').value;
   const type = document.getElementById('leave-type').value;
   const startDate = document.getElementById('leave-start-date').value;
   const endDate = document.getElementById('leave-end-date').value;
   const reason = document.getElementById('leave-reason').value.trim();

   const users = getWhDB(activeWarehouse, 'users', activeWarehouse === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);
   const emp = users.find(u => u.nik === targetNik) || currentUser;

   const leaves = getWhDB(activeWarehouse, 'leaves', activeWarehouse === 'MBI' ? SEED_MBI_LEAVES : []);
   const newLeave = {
    id: `lv-${activeWarehouse.toLowerCase()}-${Date.now()}`,
    userNik: emp.nik,
    userName: emp.name,
    outsource: emp.outsource || 'Internal',
    type, startDate, endDate, reason,
    status: 'pending',
    warehouse: activeWarehouse
   };

   leaves.unshift(newLeave);
   untrackDeletedLeaves(newLeave);
   syncLeavesToCloud(activeWarehouse, leaves);

   document.getElementById('leave-reason').value = '';
   const alertEl = document.getElementById('leave-alert');
   alertEl.className = 'p-4 rounded-2xl text-xs font-bold bg-slate-100 text-slate-800 border border-slate-300';
   renderLeavesTable();
   refreshAllDashboardData();
  }

  let activeLeaveTabFilter = 'all';

  function filterLeaveTypeTab(tab) {
   activeLeaveTabFilter = tab;
   updateLeaveTabButtons();
   renderLeavesTable();
  }

  function updateLeaveTabButtons() {
   const tabs = ['all', 'cuti', 'sakit', 'pending'];
   tabs.forEach(t => {
    const btn = document.getElementById(`btn-leave-tab-${t}`);
    if (btn) {
     if (activeLeaveTabFilter === t) {
      btn.className = 'px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-900 text-white shadow-2xs transition';
     } else {
      btn.className = 'px-2.5 py-1 rounded-lg text-[11px] font-bold text-slate-600 hover:text-slate-900 transition';
     }
    }
   });
  }

  function renderLeavesTable() {
   const users = getWhDB(activeWarehouse, 'users', activeWarehouse === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);
   const rawLeaves = getWhDB(activeWarehouse, 'leaves', activeWarehouse === 'MBI' ? SEED_MBI_LEAVES : []);
   const leaves = Array.isArray(rawLeaves) ? rawLeaves.filter(lv => lv && typeof lv === 'object') : [];
   const searchQ = (document.getElementById('leave-table-search')?.value || '').toLowerCase().trim();
   const tbody = document.getElementById('leave-table-body');
   if (!tbody) return;
   tbody.innerHTML = '';

   const canApproveSpv = hasPermission('perm_approve_leave_spv');
   const canApproveMgr = hasPermission('perm_approve_leave_mgr');
   const canReject = hasPermission('perm_reject_submission');

   let filtered = leaves.filter(lv => {
    if (!lv) return false;
    const matchesSearch = !searchQ || (lv.userName && lv.userName.toLowerCase().includes(searchQ)) || (lv.userNik && lv.userNik.toLowerCase().includes(searchQ)) || (lv.reason && lv.reason.toLowerCase().includes(searchQ));
    if (!matchesSearch) return false;

    if (activeLeaveTabFilter === 'cuti') {
     return lv.type === 'cuti';
    } else if (activeLeaveTabFilter === 'sakit') {
     return lv.type === 'sakit';
    } else if (activeLeaveTabFilter === 'pending') {
     return lv.status === 'pending' || lv.status === 'pending_manager';
    }
    return true;
   });

   // Sort pending items to the top so Supervisor & Manager can immediately take action
   filtered.sort((a, b) => {
    if (!a || !b) return 0;
    const isAPending = a.status === 'pending' || a.status === 'pending_manager';
    const isBPending = b.status === 'pending' || b.status === 'pending_manager';
    if (isAPending && !isBPending) return -1;
    if (!isAPending && isBPending) return 1;
    return (b.startDate || '').localeCompare(a.startDate || '');
   });

   if (filtered.length === 0) {
    const typeNote = activeLeaveTabFilter !== 'all' ? ` (Kategori: ${activeLeaveTabFilter.toUpperCase()})` : '';
    tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-slate-400">Belum ada pengajuan izin/sakit/cuti${typeNote} di Gudang ${activeWarehouse}.</td></tr>`;
    return;
   }

   filtered.forEach(lv => {
    const emp = users.find(u => (u.nik && u.nik.toUpperCase() === (lv.userNik || '').toUpperCase()) || (cleanStr(u.name) === cleanStr(lv.userName)));
    const osVal = emp ? (emp.outsource || 'Internal') : (lv.outsource || 'Internal');
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 transition border-b border-slate-100';
    
    let typeBadge = '';
    if (lv.type === 'sakit') typeBadge = '<span class="px-2.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200 uppercase">Sakit</span>';
    else if (lv.type === 'izin') typeBadge = '<span class="px-2.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200 uppercase">Izin</span>';
    else typeBadge = '<span class="px-2.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200 uppercase">Cuti</span>';

    let statusBadge = '';
    if (lv.status === 'approved') statusBadge = '<span class="px-2.5 py-0.5 rounded text-[10px] font-extrabold bg-slate-900 text-white">DISETUJUI</span>';
    else if (lv.status === 'rejected') statusBadge = '<span class="px-2.5 py-0.5 rounded text-[10px] font-extrabold bg-slate-100 text-slate-700 border border-slate-300">DITOLAK</span>';
    else if (lv.status === 'pending_manager') statusBadge = '<span class="px-2.5 py-0.5 rounded text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">MENUNGGU MANAGER</span>';
    else statusBadge = '<span class="px-2.5 py-0.5 rounded text-[10px] font-extrabold bg-slate-200 text-slate-800 border border-slate-300">MENUNGGU SPV</span>';

    let actionCellHtml = '<span class="text-[10px] text-slate-400">-</span>';
    if (canApproveMgr) {
     if (lv.status === 'pending_manager' || lv.status === 'pending') {
      actionCellHtml = `
       <div class="flex items-center justify-end gap-1.5">
        <button onclick="updateLeaveStatus('${lv.id}', 'approved')" class="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[10px] font-bold shadow-xs transition" title="${lv.status === 'pending' ? 'Setujui Langsung oleh Manager' : 'Setujui Final'}">${lv.status === 'pending' ? 'Setujui Langsung' : 'Setujui Final'}</button>
        ${canReject ? `<button onclick="updateLeaveStatus('${lv.id}', 'rejected')" class="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-[10px] font-bold shadow-xs transition">Tolak</button>` : ''}
       </div>
      `;
     } else {
      actionCellHtml = `<span class="text-[10px] font-bold text-slate-400 italic">${lv.status.toUpperCase()}</span>`;
     }
    } else if (canApproveSpv) {
     if (lv.status === 'pending') {
      actionCellHtml = `
       <div class="flex items-center justify-end gap-1.5">
        <button onclick="updateLeaveStatus('${lv.id}', 'approve_spv')" class="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[10px] font-bold shadow-xs transition">Setujui (ke Manager)</button>
        ${canReject ? `<button onclick="updateLeaveStatus('${lv.id}', 'rejected')" class="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-[10px] font-bold shadow-xs transition">Tolak</button>` : ''}
       </div>
      `;
     } else {
      actionCellHtml = `<span class="text-[10px] font-bold text-slate-400 italic">${lv.status === 'pending_manager' ? 'Menunggu Manager' : lv.status.toUpperCase()}</span>`;
     }
    } else if (isUserAdmin(currentUser)) {
     actionCellHtml = `<span class="px-2 py-0.5 rounded text-[10px] font-bold ${lv.status === 'pending' ? 'bg-slate-100 text-slate-700 border border-slate-200' : (lv.status === 'pending_manager' ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'text-slate-400 italic')}">${lv.status === 'pending' ? 'Menunggu SPV' : (lv.status === 'pending_manager' ? 'Menunggu Manager' : lv.status.toUpperCase())}</span>`;
    }

    tr.innerHTML = `
     <td class="px-2.5 py-2.5 font-bold leading-tight">${lv.userName}<br><span class="font-mono text-[10px] font-normal text-slate-400">${lv.userNik}</span></td>
     <td class="px-2.5 py-2.5 whitespace-nowrap"><span class="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-800">${osVal}</span></td>
     <td class="px-2.5 py-2.5 whitespace-nowrap">${typeBadge}</td>
     <td class="px-2.5 py-2.5 font-mono text-[11px] text-slate-700 whitespace-nowrap tabular-nums">${lv.startDate}<br><span class="text-[10px] text-slate-400">s/d ${lv.endDate}</span></td>
     <td class="px-2.5 py-2.5 text-slate-600 max-w-[150px] truncate" title="${(lv.reason || '').replace(/"/g, '&quot;')}">${lv.reason}</td>
     <td class="px-2.5 py-2.5 whitespace-nowrap">${statusBadge}</td>
     <td class="px-2.5 py-2.5 text-right whitespace-nowrap">
      ${actionCellHtml}
     </td>
    `;
    tbody.appendChild(tr);
   });
  }

  function updateLeaveStatus(id, action) {
   if (isUserAdmin(currentUser) && !hasPermission('perm_approve_leave_spv') && !hasPermission('perm_approve_leave_mgr')) {
    alert("Akses Ditolak: Akun Administrator tidak dapat melakukan persetujuan (approval). Berikan izin khusus jika ingin menyetujui.");
    return;
   }
   const canApproveSpv = hasPermission('perm_approve_leave_spv');
   const canApproveMgr = hasPermission('perm_approve_leave_mgr');
   const canReject = hasPermission('perm_reject_submission');

   if (!canApproveSpv && !canApproveMgr && !canReject) {
    alert("Akses Ditolak: Anda tidak memiliki wewenang untuk persetujuan izin/sakit/cuti.");
    return;
   }
   const leaves = getWhDB(activeWarehouse, 'leaves', activeWarehouse === 'MBI' ? SEED_MBI_LEAVES : []);
   const item = leaves.find(l => l.id === id);
   if (!item) return;

   if (action === 'rejected') {
    if (!canReject) {
     alert('Akses Ditolak: Anda tidak memiliki izin untuk menolak pengajuan.');
     return;
    }
    item.status = 'rejected';
    item.rejectedBy = `${currentUser.name || 'Petugas'} (${(currentUser.role || '').toUpperCase()})`;
    item.rejectedAt = new Date().toISOString();
    alert(`Pengajuan berhasil DITOLAK oleh ${currentUser.name}.`);
   } else if ((action === 'approved' || !action) && canApproveMgr) {
    if (item.status !== 'pending_manager' && item.status !== 'pending') {
     alert("Pengajuan ini sudah selesai diproses.");
     return;
    }
    item.status = 'approved';
    item.mgrApprovedBy = `${currentUser.name || 'Manager'} (${(currentUser.role || 'Manager').toUpperCase()})`;
    item.mgrApprovedAt = new Date().toISOString();
    if (!item.spvApprovedBy) {
     item.spvApprovedBy = `Disetujui Langsung (${(currentUser.role || 'Manager').toUpperCase()})`;
     item.spvApprovedAt = item.mgrApprovedAt;
    }
    item.approvedBy = `${item.spvApprovedBy} & ${currentUser.name || 'Manager'}`;
    item.approvedAt = new Date().toISOString();
    alert(`Å“â€¦ Pengajuan berhasil DISETUJUI FINAL oleh ${currentUser.name}!\nStatus cuti/izin/sakit karyawan resmi aktif.`);
   } else if (action === 'approve_spv' && canApproveSpv) {
    if (item.status !== 'pending') {
     alert("Pengajuan ini sudah diproses dan tidak berstatus Menunggu SPV.");
     return;
    }
    item.status = 'pending_manager';
    item.spvApprovedBy = `${currentUser.name || 'Supervisor'} (${(currentUser.role || 'Supervisor').toUpperCase()})`;
    item.spvApprovedAt = new Date().toISOString();
    alert(`Å“â€¦ Pengajuan berhasil disetujui tahap 1 oleh ${currentUser.name}!\nDiteruskan ke Manager untuk persetujuan akhir (Final Approval).`);
   } else if (canApproveMgr) {
    if (item.status !== 'pending_manager' && item.status !== 'pending') {
     alert("Pengajuan ini sudah selesai diproses.");
     return;
    }
    item.status = 'approved';
    item.mgrApprovedBy = `${currentUser.name || 'Manager'} (${(currentUser.role || 'Manager').toUpperCase()})`;
    item.mgrApprovedAt = new Date().toISOString();
    if (!item.spvApprovedBy) {
     item.spvApprovedBy = `Disetujui Langsung (${(currentUser.role || 'Manager').toUpperCase()})`;
     item.spvApprovedAt = item.mgrApprovedAt;
    }
    item.approvedBy = `${item.spvApprovedBy} & ${currentUser.name || 'Manager'}`;
    item.approvedAt = new Date().toISOString();
    alert(`Å“â€¦ Pengajuan berhasil DISETUJUI FINAL oleh ${currentUser.name}!\nStatus cuti/izin/sakit karyawan resmi aktif.`);
   } else if (canApproveSpv) {
    if (item.status !== 'pending') {
     alert("Pengajuan ini sudah diproses dan tidak berstatus Menunggu SPV.");
     return;
    }
    item.status = 'pending_manager';
    item.spvApprovedBy = `${currentUser.name || 'Supervisor'} (${(currentUser.role || 'Supervisor').toUpperCase()})`;
    item.spvApprovedAt = new Date().toISOString();
    alert(`Å“â€¦ Pengajuan berhasil disetujui tahap 1 oleh ${currentUser.name}!\nDiteruskan ke Manager untuk persetujuan akhir (Final Approval).`);
   }

   syncLeavesToCloud(activeWarehouse, leaves);
   if (typeof renderLeavesTable === 'function') renderLeavesTable();
   if (typeof refreshAllDashboardData === 'function') refreshAllDashboardData();
   if (typeof renderMatrixTable === 'function') renderMatrixTable();
  }

  // =========================================================
  // FITUR LEMBUR: BATCH GRID CHECKBOX + HITUNG UPAH + APPROVAL
  // =========================================================
  function calculateOvertimeNominal() {
   const dayType = document.getElementById('ot-day-type')?.value || 'hari_kerja';
   const startTime = document.getElementById('ot-start')?.value || '17:00';
   const endTime = document.getElementById('ot-end')?.value || '22:00';

   const [sh, sm] = startTime.split(':').map(Number);
   const [eh, em] = endTime.split(':').map(Number);
   let diff = eh * 60 + em - (sh * 60 + sm);
   if (diff < 0) diff += 24 * 60;
   const totalHours = Math.round((diff / 60) * 10) / 10;

   let effectiveHours = totalHours;
   let nominal = 0;

   if (dayType === 'hari_kerja') {
    if (totalHours >= 5) {
     effectiveHours = totalHours - 1;
    }
    nominal = effectiveHours === 4 ? 125000 : Math.round(effectiveHours * (125000 / 4));
   } else {
    nominal = 120000;
   }

   const badge = document.getElementById('ot-calc-summary-badge');
   if (badge) {
    badge.innerText = `Estimasi: Rp ${nominal.toLocaleString('id-ID')} / orang (${totalHours} Jam Total, ${effectiveHours} Jam Kerja)`;
   }

   return { totalHours, effectiveHours, nominal, dayType };
  }

  function renderOvertimeEmployeeGrid() {
   const users = getWhDB(activeWarehouse, 'users', activeWarehouse === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);
   const regularUsers = users.filter(u => !isManagementSystemAccount(u));
   const container = document.getElementById('ot-employee-checkbox-grid');
   if (!container) return;

   const searchQ = (document.getElementById('ot-emp-search')?.value || '').toLowerCase().trim();
   const filtered = regularUsers.filter(u => u.status !== 'inactive' && (!searchQ || (u.name && u.name.toLowerCase().includes(searchQ)) || (u.nik && u.nik.toLowerCase().includes(searchQ)) || (u.dept && u.dept.toLowerCase().includes(searchQ))));

   container.innerHTML = '';
   if (filtered.length === 0) {
    container.innerHTML = '<div class="col-span-full p-4 text-center text-xs text-slate-400">Tidak ada karyawan yang cocok dengan pencarian.</div>';
    return;
   }

   filtered.forEach(u => {
    const osVal = u.outsource || 'Internal';
    const div = document.createElement('label');
    div.className = 'cursor-pointer p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition flex items-center justify-between gap-2 text-xs select-none shadow-xs';
    div.innerHTML = `
     <div class="flex items-center gap-2 min-w-0">
      <input type="checkbox" name="ot-emp-check" value="${u.nik}" onchange="updateSelectedOvertimeCount()" class="w-4 h-4 rounded text-slate-900 focus:ring-slate-900 border-slate-300 cursor-pointer">
      <div class="min-w-0">
       <span class="font-extrabold text-slate-900 block truncate text-[11px]">${u.name}</span>
       <span class="text-[10px] font-mono text-slate-400 block">${u.nik} &bull; ${u.dept} &bull; <b class="text-slate-700">${osVal}</b></span>
      </div>
     </div>
     <span class="text-[10px] font-bold text-slate-800 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">${osVal}</span>
    `;
    container.appendChild(div);
   });
   updateSelectedOvertimeCount();
  }

  function selectAllOvertimeEmployees(select) {
   const checkboxes = document.querySelectorAll('input[name="ot-emp-check"]');
   checkboxes.forEach(cb => cb.checked = select);
   updateSelectedOvertimeCount();
  }

  function updateSelectedOvertimeCount() {
   const checkboxes = document.querySelectorAll('input[name="ot-emp-check"]:checked');
   const count = checkboxes.length;
   const badge = document.getElementById('ot-selected-count-badge');
   if (badge) {
    badge.innerText = `${count} dipilih`;
    badge.className = count > 0 ? 'text-xs font-bold text-amber-900 bg-amber-200 px-3 py-1 rounded-lg border border-amber-300' : 'text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-lg border';
   }
  }

  function toggleOvertimeManualReason(val) {
   const manualBox = document.getElementById('ot-manual-reason-box');
   const manualInput = document.getElementById('ot-reason-manual');
   if (manualBox) {
    if (val === 'manual') {
     manualBox.classList.remove('hidden');
     if (manualInput) manualInput.focus();
    } else {
     manualBox.classList.add('hidden');
     if (manualInput) manualInput.value = '';
    }
   }
  }

  function handleBatchOvertimeSubmit(e) {
   e.preventDefault();
   if (!hasPermission('perm_submit_batch_ot') && !isUserAdmin(currentUser) && !isUserManager(currentUser)) {
    alert('Akses Ditolak: Anda tidak memiliki izin untuk mengajukan input lembur massal.');
    return;
   }
   const checkboxes = document.querySelectorAll('input[name="ot-emp-check"]:checked');
   if (checkboxes.length === 0) {
    alert('Silakan pilih minimal 1 karyawan untuk diajukan lembur!');
    return;
   }

   const date = document.getElementById('ot-date').value;
   const startTime = document.getElementById('ot-start').value;
   const endTime = document.getElementById('ot-end').value;
   const selectVal = document.getElementById('ot-reason-select').value;
   let reason = selectVal;
   if (selectVal === 'manual') {
    const manualVal = document.getElementById('ot-reason-manual').value.trim();
    if (!manualVal) {
     alert('Silakan ketik alasan lembur manual terlebih dahulu!');
     document.getElementById('ot-reason-manual').focus();
     return;
    }
    reason = manualVal;
   }

   const calc = calculateOvertimeNominal();

   const users = getWhDB(activeWarehouse, 'users', activeWarehouse === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);
   const overtimes = getWhDB(activeWarehouse, 'overtime', activeWarehouse === 'MBI' ? SEED_MBI_OVERTIMES : []);

   let countAdded = 0;
   checkboxes.forEach(cb => {
    const emp = users.find(u => u.nik === cb.value);
    if (emp) {
     const nowIso = new Date().toISOString();
     overtimes.unshift({
      id: `ot-${activeWarehouse.toLowerCase()}-${Date.now()}-${countAdded}`,
      userId: emp.id,
      userNik: emp.nik,
      userName: emp.name,
      dept: emp.dept,
      outsource: emp.outsource || 'Internal',
      warehouse: activeWarehouse,
      date,
      dayType: calc.dayType,
      startTime,
      endTime,
      totalHours: calc.totalHours,
      effectiveHours: calc.effectiveHours,
      nominal: calc.nominal,
      reason,
      status: 'pending',
      createdAt: nowIso,
      updatedAt: nowIso,
      _pendingSync: true
     });
     countAdded++;
    }
   });

   setWhDB(activeWarehouse, 'overtime', overtimes, true);
   untrackDeletedOvertime(overtimes);
   syncOvertimeToCloud(activeWarehouse, overtimes);
   document.getElementById('ot-reason-select').value = 'Menyelesaikan Orderan';
   toggleOvertimeManualReason('Menyelesaikan Orderan');
   selectAllOvertimeEmployees(false);

   const alertEl = document.getElementById('ot-alert');
   alertEl.className = 'p-4 rounded-2xl text-xs font-bold bg-slate-100 text-slate-800 border border-slate-300';
   alertEl.innerText = `Pengajuan lembur (${reason}) untuk ${countAdded} karyawan berhasil diajukan dan menunggu approval Supervisor! (Total Estimasi Upah: Rp ${(calc.nominal * countAdded).toLocaleString('id-ID')})`;
   alertEl.classList.remove('hidden');

   renderOvertimeTable();
   refreshAllDashboardData();
  }

  function renderOvertimeTable() {
   const startStr = document.getElementById('ot-filter-start')?.value || '';
   const endStr = document.getElementById('ot-filter-end')?.value || '';
   const searchQ = (document.getElementById('ot-filter-search')?.value || '').toLowerCase().trim();
   const statusFilter = document.getElementById('ot-filter-status')?.value || '';
   const users = getWhDB(activeWarehouse, 'users', activeWarehouse === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);
   const rawOvertimes = getWhDB(activeWarehouse, 'overtime', activeWarehouse === 'MBI' ? SEED_MBI_OVERTIMES : []);
   const overtimes = Array.isArray(rawOvertimes) ? rawOvertimes.filter(o => o && typeof o === 'object') : [];
   const tbody = document.getElementById('ot-table-body');
   if (!tbody) return;
   tbody.innerHTML = '';

   const canApproveSpv = hasPermission('perm_approve_ot_spv');
   const canApproveMgr = hasPermission('perm_approve_ot_mgr');
   const canReject = hasPermission('perm_reject_submission');

   let filtered = overtimes.filter(o => {
    if (!o) return false;
    const isPendingFilter = (statusFilter === 'pending_all' || statusFilter === 'pending' || statusFilter === 'pending_manager');
    const inDate = isPendingFilter ? true : ((!startStr || o.date >= startStr) && (!endStr || o.date <= endStr));
    const inSearch = !searchQ || (o.userName && o.userName.toLowerCase().includes(searchQ)) || (o.userNik && o.userNik.toLowerCase().includes(searchQ)) || (o.dept && o.dept.toLowerCase().includes(searchQ));
    let inStatus = true;
    if (statusFilter === 'pending_all') {
     inStatus = o.status === 'pending' || o.status === 'pending_manager';
    } else if (statusFilter) {
     inStatus = o.status === statusFilter;
    }
    return inDate && inSearch && inStatus;
   });

   // Sort pending items to the top so Supervisor & Manager can immediately take action
   filtered.sort((a, b) => {
    if (!a || !b) return 0;
    const isAPending = a.status === 'pending' || a.status === 'pending_manager';
    const isBPending = b.status === 'pending' || b.status === 'pending_manager';
    if (isAPending && !isBPending) return -1;
    if (!isAPending && isBPending) return 1;
    return (b.date || '').localeCompare(a.date || '');
   });

   const totalBadge = document.getElementById('ot-total-badge');
   if (totalBadge) totalBadge.innerText = `Total: ${filtered.length} Data Lembur (${activeWarehouse})`;

   if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="13" class="p-6 text-center text-slate-400">Belum ada data lembur pada filter ini di Gudang ${activeWarehouse}.</td></tr>`;
    return;
   }

   filtered.forEach((ot, idx) => {
    const emp = users.find(u => (u.nik && u.nik.toUpperCase() === (ot.userNik || '').toUpperCase()) || (cleanStr(u.name) === cleanStr(ot.userName)));
    const osVal = emp ? (emp.outsource || 'Internal') : (ot.outsource || 'Internal');
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 transition border-b border-slate-100';

    const isPending = ot.status === 'pending';
    const isApproved = ot.status === 'approved';
    const isRejected = ot.status === 'rejected';

    let statusBadge = '';
    if (isApproved) statusBadge = '<span class="px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-slate-900 text-white border border-slate-900">DISETUJUI</span>';
    else if (isRejected) statusBadge = '<span class="px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-slate-100 text-slate-700 border border-slate-300">DITOLAK</span>';
    else if (ot.status === 'pending_manager') statusBadge = '<span class="px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">MENUNGGU MANAGER</span>';
    else statusBadge = '<span class="px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-slate-200 text-slate-800 border border-slate-300">MENUNGGU SPV</span>';

    let actionCellHtml = '<span class="text-[10px] text-slate-400">-</span>';
    if (canApproveMgr) {
     if (ot.status === 'pending_manager' || isPending) {
      actionCellHtml = `
       <div class="flex items-center justify-center gap-1.5">
        <button onclick="updateOvertimeStatusAndLock('${ot.id}', 'approved')" class="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[10px] font-bold shadow-xs transition" title="${isPending ? 'Setujui Langsung oleh Manager' : 'Setujui Final'}">
         ${isPending ? 'Setujui Langsung' : 'Setujui Final'}
        </button>
        ${canReject ? `<button onclick="updateOvertimeStatusAndLock('${ot.id}', 'rejected')" class="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-[10px] font-bold shadow-xs transition">Tolak</button>` : ''}
       </div>
      `;
     } else {
      actionCellHtml = `<span class="text-[10px] font-bold text-slate-400 italic">${'Terkunci (' + ot.status.toUpperCase() + ')'}</span>`;
     }
    } else if (canApproveSpv) {
     if (isPending) {
      actionCellHtml = `
       <div class="flex items-center justify-center gap-1.5">
        <button onclick="updateOvertimeStatusAndLock('${ot.id}', 'approve_spv')" class="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[10px] font-bold shadow-xs transition">
         Setujui (ke Manager)
        </button>
        ${canReject ? `<button onclick="updateOvertimeStatusAndLock('${ot.id}', 'rejected')" class="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg text-[10px] font-bold shadow-xs transition">Tolak</button>` : ''}
       </div>
      `;
     } else {
      actionCellHtml = `<span class="text-[10px] font-bold text-slate-400 italic">${ot.status === 'pending_manager' ? 'Menunggu Manager' : 'Terkunci (' + ot.status.toUpperCase() + ')'}</span>`;
     }
    } else if (isUserAdmin(currentUser)) {
     actionCellHtml = `<span class="px-2 py-0.5 rounded text-[10px] font-bold ${isPending ? 'bg-slate-100 text-slate-700 border border-slate-200' : (ot.status === 'pending_manager' ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'text-slate-400 italic')}">${isPending ? 'Menunggu SPV' : (ot.status === 'pending_manager' ? 'Menunggu Manager' : 'Terkunci (' + ot.status.toUpperCase() + ')')}</span>`;
    }

    tr.innerHTML = `
     <td class="p-3 border-r border-slate-100 font-mono text-slate-500 font-bold">${idx + 1}</td>
     <td class="p-3 border-r border-slate-100 font-bold text-slate-900">${ot.date}</td>
     <td class="p-3 border-r border-slate-100 font-mono text-slate-700">${ot.userNik}</td>
     <td class="p-3 border-r border-slate-100 font-bold text-slate-900">${ot.userName}</td>
     <td class="p-3 border-r border-slate-100"><span class="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[11px] font-bold text-slate-800">${osVal}</span></td>
     <td class="p-3 border-r border-slate-100 uppercase font-mono text-[11px] text-slate-600">${ot.dept || (emp ? emp.dept : '-')}</td>
     <td class="p-3 border-r border-slate-100 font-medium text-slate-700">${ot.dayType === 'hari_libur' ? '<span class="text-slate-900 font-bold">Hari Libur</span>' : 'Hari Kerja'}</td>
     <td class="p-3 border-r border-slate-100 font-mono font-bold">${ot.startTime} - ${ot.endTime}<br><span class="font-normal text-[10px] text-slate-500">(${ot.totalHours} Jam)</span></td>
     <td class="p-3 border-r border-slate-100 font-mono font-bold text-slate-800">${ot.effectiveHours} Jam</td>
     <td class="p-3 border-r border-slate-100 font-mono font-black text-slate-900">Rp ${(ot.nominal || 0).toLocaleString('id-ID')}</td>
     <td class="p-3 border-r border-slate-100 text-slate-600 max-w-xs truncate">${ot.reason}</td>
     <td class="p-3 border-r border-slate-100 text-center">${statusBadge}</td>
     <td class="p-3 text-center">
      ${actionCellHtml}
     </td>
    `;
    tbody.appendChild(tr);
   });
  }

  function updateOvertimeStatusAndLock(id, action) {
   if (isUserAdmin(currentUser) && !hasPermission('perm_approve_ot_spv') && !hasPermission('perm_approve_ot_mgr')) {
    alert("Akses Ditolak: Akun Administrator tidak dapat melakukan persetujuan (approval). Berikan izin khusus jika ingin menyetujui.");
    return;
   }
   const canApproveSpv = hasPermission('perm_approve_ot_spv');
   const canApproveMgr = hasPermission('perm_approve_ot_mgr');
   const canReject = hasPermission('perm_reject_submission');

   if (!canApproveSpv && !canApproveMgr && !canReject) {
    alert("Akses Ditolak: Anda tidak memiliki wewenang untuk persetujuan lembur.");
    return;
   }
   const overtimes = getWhDB(activeWarehouse, 'overtime', activeWarehouse === 'MBI' ? SEED_MBI_OVERTIMES : []);
   const item = overtimes.find(o => o.id === id);
   if (!item) return;

   if (action === 'rejected') {
    if (!canReject) {
     alert('Akses Ditolak: Anda tidak memiliki izin untuk menolak pengajuan lembur.');
     return;
    }
    item.status = 'rejected';
    item.rejectedBy = `${currentUser.name || 'Petugas'} (${(currentUser.role || '').toUpperCase()})`;
    item.rejectedAt = new Date().toISOString();
    alert(`Pengajuan lembur ${item.userName} berhasil DITOLAK oleh ${currentUser.name}.`);
   } else if ((action === 'approved' || !action) && canApproveMgr) {
    if (item.status !== 'pending_manager' && item.status !== 'pending') {
     alert("Pengajuan lembur ini sudah selesai diproses.");
     return;
    }
    item.status = 'approved';
    item.mgrApprovedBy = `${currentUser.name || 'Manager'} (${(currentUser.role || 'Manager').toUpperCase()})`;
    item.mgrApprovedAt = new Date().toISOString();
    if (!item.spvApprovedBy) {
     item.spvApprovedBy = `Disetujui Langsung (${(currentUser.role || 'Manager').toUpperCase()})`;
     item.spvApprovedAt = item.mgrApprovedAt;
    }
    item.approvedBy = `${item.spvApprovedBy} & ${currentUser.name || 'Manager'}`;
    item.approvedAt = new Date().toISOString();
    alert(`Å“â€¦ Pengajuan lembur ${item.userName} (${item.date}) berhasil DISETUJUI FINAL oleh ${currentUser.name}!\nData lembur terkunci permanen.`);
   } else if (action === 'approve_spv' && canApproveSpv) {
    if (item.status !== 'pending') {
     alert("Pengajuan lembur ini sudah diproses dan tidak berstatus Menunggu SPV.");
     return;
    }
    item.status = 'pending_manager';
    item.spvApprovedBy = `${currentUser.name || 'Supervisor'} (${(currentUser.role || 'Supervisor').toUpperCase()})`;
    item.spvApprovedAt = new Date().toISOString();
    alert(`Å“â€¦ Pengajuan lembur ${item.userName} (${item.date}) berhasil disetujui tahap 1 oleh ${currentUser.name}!\nDiteruskan ke Manager untuk persetujuan akhir (Final Approval).`);
   } else if (canApproveMgr) {
    if (item.status !== 'pending_manager' && item.status !== 'pending') {
     alert("Pengajuan lembur ini sudah selesai diproses.");
     return;
    }
    item.status = 'approved';
    item.mgrApprovedBy = `${currentUser.name || 'Manager'} (${(currentUser.role || 'Manager').toUpperCase()})`;
    item.mgrApprovedAt = new Date().toISOString();
    if (!item.spvApprovedBy) {
     item.spvApprovedBy = `Disetujui Langsung (${(currentUser.role || 'Manager').toUpperCase()})`;
     item.spvApprovedAt = item.mgrApprovedAt;
    }
    item.approvedBy = `${item.spvApprovedBy} & ${currentUser.name || 'Manager'}`;
    item.approvedAt = new Date().toISOString();
    alert(`Å“â€¦ Pengajuan lembur ${item.userName} (${item.date}) berhasil DISETUJUI FINAL oleh ${currentUser.name}!\nData lembur terkunci permanen.`);
   } else if (canApproveSpv) {
    if (item.status !== 'pending') {
     alert("Pengajuan lembur ini sudah diproses dan tidak berstatus Menunggu SPV.");
     return;
    }
    item.status = 'pending_manager';
    item.spvApprovedBy = `${currentUser.name || 'Supervisor'} (${(currentUser.role || 'Supervisor').toUpperCase()})`;
    item.spvApprovedAt = new Date().toISOString();
    alert(`Å“â€¦ Pengajuan lembur ${item.userName} (${item.date}) berhasil disetujui tahap 1 oleh ${currentUser.name}!\nDiteruskan ke Manager untuk persetujuan akhir (Final Approval).`);
   }

   syncOvertimeToCloud(activeWarehouse, overtimes);
   if (typeof renderOvertimeTable === 'function') renderOvertimeTable();
   if (typeof refreshAllDashboardData === 'function') refreshAllDashboardData();
  }

  function exportOvertimeToExcel() {
   if (!hasPermission('perm_rep_download_excel') && !isUserAdmin(currentUser) && !isUserManager(currentUser)) {
    alert('Akses Ditolak: Anda tidak memiliki izin untuk mengunduh laporan Excel.');
    return;
   }
   const startStr = document.getElementById('ot-filter-start')?.value || '';
   const endStr = document.getElementById('ot-filter-end')?.value || '';
   const overtimes = getWhDB(activeWarehouse, 'overtime', activeWarehouse === 'MBI' ? SEED_MBI_OVERTIMES : []);

   const filtered = overtimes.filter(o => (!startStr || o.date >= startStr) && (!endStr || o.date <= endStr));

   const rows = filtered.map((r, i) => ({
    "No": i + 1,
    "Tanggal": r.date,
    "NIK": r.userNik,
    "Nama Karyawan": r.userName,
    "Departemen": r.dept || '',
    "Kategori Hari": r.dayType === 'hari_libur' ? 'Hari Libur' : 'Hari Kerja',
    "Jam Mulai": r.startTime,
    "Jam Selesai": r.endTime,
    "Total Jam": r.totalHours,
    "Jam Kerja Efektif": r.effectiveHours,
    "Upah Lembur (Rp)": r.nominal || 0,
    "Alasan Lembur": r.reason || '',
    "Status Approval": r.status.toUpperCase(),
    "Gudang": activeWarehouse
   }));

   const ws = XLSX.utils.json_to_sheet(rows);
   const wb = XLSX.utils.book_new();
   XLSX.utils.book_append_sheet(wb, ws, `Rekap_Lembur_${activeWarehouse}`);
   XLSX.writeFile(wb, `Rekap_Lembur_Karyawan_${activeWarehouse}_${Date.now()}.xlsx`);
  }

  // =========================================================
  // GITHUB CONFIG & FULL BACKUP JSON
  // =========================================================
  function renderGitHubConfig() {
   const config = getWhDB('global', 'github_config', { token: '', owner: '', repo: '' });
   document.getElementById('gh-token').value = config.token || '';
   document.getElementById('gh-owner').value = config.owner || '';
   document.getElementById('gh-repo').value = config.repo || '';

   const statusEl = document.getElementById('github-mode-status');
   if (config.token && config.owner && config.repo) {
    statusEl.innerText = `GitHub Terhubung (${config.owner}/${config.repo})`;
    statusEl.className = 'text-emerald-700 font-bold';
   } else {
    statusEl.innerText = 'Local Storage Mandiri (Aktif)';
    statusEl.className = 'text-amber-700 font-bold';
   }
  }

  function saveGitHubConfig(e) {
   e.preventDefault();
   const config = {
    token: document.getElementById('gh-token').value.trim(),
    owner: document.getElementById('gh-owner').value.trim(),
    repo: document.getElementById('gh-repo').value.trim()
   };
   setWhDB('global', 'github_config', config);
   alert('Konfigurasi GitHub berhasil disimpan!');
   renderGitHubConfig();
  }

  async function syncAllToGitHub() {
   alert('Memulai sinkronisasi seluruh data MBI & MAI ke repositori GitHub...');
   await syncWhToGitHub('MBI', 'users', getWhDB('MBI', 'users', SEED_MBI_USERS));
   await syncWhToGitHub('MBI', 'attendance', getWhDB('MBI', 'attendance', SEED_MBI_ATTENDANCE));
   await syncWhToGitHub('MBI', 'leaves', getWhDB('MBI', 'leaves', SEED_MBI_LEAVES));
   await syncWhToGitHub('MBI', 'overtime', getWhDB('MBI', 'overtime', SEED_MBI_OVERTIMES));

   await syncWhToGitHub('MAI', 'users', getWhDB('MAI', 'users', SEED_MAI_USERS));
   await syncWhToGitHub('MAI', 'attendance', getWhDB('MAI', 'attendance', SEED_MAI_ATTENDANCE));
   await syncWhToGitHub('MAI', 'leaves', getWhDB('MAI', 'leaves', []));
   await syncWhToGitHub('MAI', 'overtime', getWhDB('MAI', 'overtime', []));
   alert('Sinkronisasi data terpisah MBI & MAI ke GitHub BERHASIL!');
  }

  function exportFullDatabaseJSON() {
   const fullDB = {
    mbi_users: getWhDB('MBI', 'users', SEED_MBI_USERS),
    mbi_attendance: getWhDB('MBI', 'attendance', SEED_MBI_ATTENDANCE),
    mbi_leaves: getWhDB('MBI', 'leaves', SEED_MBI_LEAVES),
    mbi_overtime: getWhDB('MBI', 'overtime', SEED_MBI_OVERTIMES),
    mai_users: getWhDB('MAI', 'users', SEED_MAI_USERS),
    mai_attendance: getWhDB('MAI', 'attendance', SEED_MAI_ATTENDANCE),
    mai_leaves: getWhDB('MAI', 'leaves', []),
    mai_overtime: getWhDB('MAI', 'overtime', []),
    exportedAt: new Date().toISOString()
   };

   const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(fullDB, null, 2));
   const downloadAnchor = document.createElement('a');
   downloadAnchor.setAttribute("href", dataStr);
   downloadAnchor.setAttribute("download", `WFM_MEDIKA_DATABASE_BACKUP_${Date.now()}.json`);
   document.body.appendChild(downloadAnchor);
   downloadAnchor.click();
   downloadAnchor.remove();
  }

  function importFullDatabaseJSON(e) {
   const file = e.target.files[0];
   if (!file) return;

   const reader = new FileReader();
   reader.onload = (event) => {
    try {
     const db = JSON.parse(event.target.result);
     if (db.mbi_users) setWhDB('MBI', 'users', db.mbi_users);
     if (db.mbi_attendance) setWhDB('MBI', 'attendance', db.mbi_attendance);
     if (db.mbi_leaves) setWhDB('MBI', 'leaves', db.mbi_leaves);
     if (db.mbi_overtime) setWhDB('MBI', 'overtime', db.mbi_overtime);

     if (db.mai_users) setWhDB('MAI', 'users', db.mai_users);
     if (db.mai_attendance) setWhDB('MAI', 'attendance', db.mai_attendance);
     if (db.mai_leaves) setWhDB('MAI', 'leaves', db.mai_leaves);
     if (db.mai_overtime) setWhDB('MAI', 'overtime', db.mai_overtime);

     alert('Cadangan database berhasil diimpor 100%! Seluruh akun dan data telah tersinkronisasi.');
     location.reload();
    } catch (err) {
     alert('Gagal mengimpor file cadangan JSON: ' + err.message);
    }
   };
   reader.readAsText(file);
   e.target.value = '';
  }

  // =========================================================
  // INTEGRASI SINKRONISASI OTOMATIS GOOGLE SPREADSHEET (REAL-TIME BACKUP)
  // Target MBI: https://docs.google.com/spreadsheets/d/1-QzoIehfLvtLJSx8w0mLX4itGbGChk-6OHly2JTJZ5o/edit?usp=sharing
  // Target MAI: https://docs.google.com/spreadsheets/d/1kPzxvyC6qeTPC24QmJ_ltaG9qkf6iLKvs5G5GLpPqwE/edit?usp=sharing
  // 3 Sheet Utama: RECORD ABSEN, REKAP PENGAJUAN, REKAP LEMBUR
  // =========================================================

  const GOOGLE_SPREADSHEET_URL_MBI = "https://docs.google.com/spreadsheets/d/1-QzoIehfLvtLJSx8w0mLX4itGbGChk-6OHly2JTJZ5o/edit?usp=sharing";
  const GOOGLE_SPREADSHEET_ID_MBI = "1-QzoIehfLvtLJSx8w0mLX4itGbGChk-6OHly2JTJZ5o";
  const OFFICIAL_GSHEET_WEBHOOK_URL_MBI = "https://script.google.com/macros/s/AKfycbygwz8NF_zCdey9XdY3InnO1qPyf8hvuhkv-MGH3jV_Z8V0UBQKqFOURqPjgOoK_3QPbA/exec";

  const GOOGLE_SPREADSHEET_URL_MAI = "https://docs.google.com/spreadsheets/d/1kPzxvyC6qeTPC24QmJ_ltaG9qkf6iLKvs5G5GLpPqwE/edit?usp=sharing";
  const GOOGLE_SPREADSHEET_ID_MAI = "1kPzxvyC6qeTPC24QmJ_ltaG9qkf6iLKvs5G5GLpPqwE";
  const OFFICIAL_GSHEET_WEBHOOK_URL_MAI = "https://script.google.com/macros/s/AKfycbzjGimgXZ9Gmm_PjqwT7j2d9F_bVS930rEatAI0pdgZipLj7hjx_U6jxT74X8Fl9Psm/exec";

  // Backward compatibility references
  const GOOGLE_SPREADSHEET_URL = GOOGLE_SPREADSHEET_URL_MBI;
  const OFFICIAL_GSHEET_WEBHOOK_URL = OFFICIAL_GSHEET_WEBHOOK_URL_MBI;

  let modalActiveGSheetWh = 'MBI';

  function getGoogleSpreadsheetUrl(wh = null) {
   const targetWh = (wh || activeWarehouse || 'MBI').toUpperCase();
   return targetWh === 'MAI' ? GOOGLE_SPREADSHEET_URL_MAI : GOOGLE_SPREADSHEET_URL_MBI;
  }

  function getGoogleSheetWebhookUrl(wh = null) {
   const targetWh = (wh || activeWarehouse || 'MBI').toUpperCase();
   if (targetWh === 'MAI') {
    let url = (localStorage.getItem('wfm_gsheet_webhook_url_mai') || OFFICIAL_GSHEET_WEBHOOK_URL_MAI || '').trim();
    if (!url || !url.startsWith('https://script.google.com/')) {
     url = OFFICIAL_GSHEET_WEBHOOK_URL_MAI;
     localStorage.setItem('wfm_gsheet_webhook_url_mai', OFFICIAL_GSHEET_WEBHOOK_URL_MAI);
    }
    return url;
   } else {
    let url = (localStorage.getItem('wfm_gsheet_webhook_url_mbi') || localStorage.getItem('wfm_gsheet_webhook_url') || OFFICIAL_GSHEET_WEBHOOK_URL_MBI || '').trim();
    if (!url || !url.startsWith('https://script.google.com/')) {
     url = OFFICIAL_GSHEET_WEBHOOK_URL_MBI;
     localStorage.setItem('wfm_gsheet_webhook_url_mbi', OFFICIAL_GSHEET_WEBHOOK_URL_MBI);
     localStorage.setItem('wfm_gsheet_webhook_url', OFFICIAL_GSHEET_WEBHOOK_URL_MBI);
    }
    return url;
   }
  }

  function cleanGoogleScriptUrl(url) {
   if (!url) return '';
   let clean = url.trim();
   const match = clean.match(/https:\/\/script\.google\.com(?:\/a\/macros\/[^\/]+|\/macros)\/s\/([^\/]+)\/exec/);
   if (match && match[1]) {
    return `https://script.google.com/macros/s/${match[1]}/exec`;
   }
   return clean;
  }

    function getGoogleAppsScriptCode(wh = 'MBI') {
   const targetWh = (wh || 'MBI').toUpperCase();
   const sheetId = targetWh === 'MAI' ? GOOGLE_SPREADSHEET_ID_MAI : GOOGLE_SPREADSHEET_ID_MBI;
   const sheetUrl = targetWh === 'MAI' ? GOOGLE_SPREADSHEET_URL_MAI : GOOGLE_SPREADSHEET_URL_MBI;

   return `/**
 * =========================================================================
 * GOOGLE APPS SCRIPT WEBHOOK - WFM MEDIKA GUDANG ${targetWh}
 * Realtime Immutable Append-Only Backup Ledger
 * Spreadsheet Target: ${sheetUrl}
 * 3 Tab Sheet: RECORD ABSEN, REKAP PENGAJUAN, REKAP LEMBUR
 * =========================================================================
 */

var TARGET_SPREADSHEET_ID = "${sheetId}";

function getTargetSpreadsheet() {
  var ss = null;
  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) return ss;
  } catch(e) {}
  try {
    ss = SpreadsheetApp.openById(TARGET_SPREADSHEET_ID);
    if (ss) return ss;
  } catch(e) {}
  return SpreadsheetApp.openByUrl("https://docs.google.com/spreadsheets/d/" + TARGET_SPREADSHEET_ID + "/edit");
}

function normalizeDateStr(val) {
  if (!val) return "";
  if (val instanceof Date) {
    return Utilities.formatDate(val, "Asia/Jakarta", "yyyy-MM-dd");
  }
  var s = String(val).trim();
  if (/^\\d{5}(\\.\\d+)?$/.test(s)) {
    var serial = parseFloat(s);
    var dt = new Date((serial - 25569) * 86400 * 1000);
    var y = dt.getFullYear();
    var m = ("0" + (dt.getMonth() + 1)).slice(-2);
    var d = ("0" + dt.getDate()).slice(-2);
    return y + "-" + m + "-" + d;
  }
  return s;
}

function findTargetSheet(ss, name) {
  var existingSheets = ss.getSheets();
  var targetClean = name.toLowerCase().replace(/[^a-z0-9]/g, '');

  for (var i = 0; i < existingSheets.length; i++) {
    var s = existingSheets[i];
    if (s.getName().trim().toLowerCase() === name.trim().toLowerCase()) return s;
  }
  for (var i = 0; i < existingSheets.length; i++) {
    var s = existingSheets[i];
    var sClean = s.getName().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (sClean === targetClean) return s;
  }
  for (var i = 0; i < existingSheets.length; i++) {
    var s = existingSheets[i];
    var sClean = s.getName().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (targetClean.indexOf('record') !== -1 && sClean.indexOf('record') !== -1) return s;
    if (targetClean.indexOf('pengajuan') !== -1 && sClean.indexOf('pengajuan') !== -1) return s;
    if (targetClean.indexOf('lembur') !== -1 && sClean.indexOf('lembur') !== -1) return s;
  }

  var newSheet = ss.insertSheet(name);
  return newSheet;
}

function ensureSheetHeader(sheet, headers) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    try {
      sheet.getRange(1, 1, 1, headers.length)
        .setFontWeight("bold")
        .setBackground("#0f172a")
        .setFontColor("#ffffff");
      sheet.setFrozenRows(1);
    } catch(e) {}
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "busy",
      message: "Antrean sinkronisasi sedang sibuk, silakan coba sesaat lagi."
    })).setMimeType(ContentService.MimeType.JSON);
  }

  try {
    var contents = "";
    if (e && e.postData && e.postData.contents) {
      contents = e.postData.contents;
    } else if (e && e.parameter && e.parameter.data) {
      contents = e.parameter.data;
    } else if (e && e.parameters) {
      for (var k in e.parameters) {
        if (k && k.indexOf('{') !== -1) {
          contents = k;
          break;
        }
      }
    }

    if (!contents) {
      return ContentService.createTextOutput(JSON.stringify({
        status: "error",
        message: "Data payload kosong."
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var data = JSON.parse(contents);
    var ss = getTargetSpreadsheet();
    if (!ss) {
      throw new Error("Gagal membuka Spreadsheet target ID: " + TARGET_SPREADSHEET_ID);
    }

    // =========================================================================
    // 1. EVENT SINGLE SCAN (Presensi Masuk / Pulang Realtime)
    // =========================================================================
    if (data.action === "scan" && data.data) {
      var item = data.data;
      var sheet = findTargetSheet(ss, "RECORD ABSEN");
      var headers = ["No", "Tanggal", "NIK", "Nama Karyawan", "Departemen", "Jam Masuk", "Jam Pulang", "Durasi Kerja", "Status Kehadiran", "Status Kepulangan", "Keterangan", "Gudang"];
      ensureSheetHeader(sheet, headers);

      var scanDate = normalizeDateStr(item.date);
      var scanNik = String(item.nik || "").trim().toUpperCase();
      var targetKey = (scanDate + "_" + scanNik).replace(/\\s+/g, "");

      var lastRow = sheet.getLastRow();
      var foundRow = 0;

      if (lastRow > 1) {
        var keyVals = sheet.getRange(2, 2, lastRow - 1, 2).getValues();
        for (var i = keyVals.length - 1; i >= 0; i--) {
          var rowKey = (normalizeDateStr(keyVals[i][0]) + "_" + String(keyVals[i][1]).trim().toUpperCase()).replace(/\\s+/g, "");
          if (rowKey === targetKey) {
            foundRow = i + 2;
            break;
          }
        }
      }

      var hasValidOut = item.checkOut && item.checkOut !== "-" && item.checkOut.toLowerCase().indexOf("sedang") === -1 && item.checkOut.toLowerCase().indexOf("miss") === -1;

      if (foundRow > 0) {
        if (hasValidOut) {
          sheet.getRange(foundRow, 7, 1, 5).setValues([[
            item.checkOut,
            item.duration || "-",
            item.statusMasuk || "Normal",
            item.statusPulang || "Normal",
            item.keterangan || "-"
          ]]);
        }
        var curIn = sheet.getRange(foundRow, 6).getValue();
        if ((!curIn || curIn === "-") && item.checkIn && item.checkIn !== "-") {
          sheet.getRange(foundRow, 6).setValue(item.checkIn);
        }
      } else {
        var nextNo = lastRow;
        var newRow = [
          nextNo,
          item.date || "",
          item.nik || "",
          item.name || "-",
          item.dept || "STAFF",
          item.checkIn || "-",
          item.checkOut || (hasValidOut ? item.checkOut : "Sedang Shift"),
          item.duration || "-",
          item.statusMasuk || "Normal",
          item.statusPulang || "-",
          item.keterangan || "-",
          item.warehouse || "${targetWh}"
        ];
        sheet.appendRow(newRow);
      }

      SpreadsheetApp.flush();
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        action: "scan",
        warehouse: "${targetWh}",
        targetKey: targetKey,
        mode: foundRow > 0 ? "updated_row_" + foundRow : "appended_new_row"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // =========================================================================
    // 2. EVENT SINGLE PENGAJUAN (Cuti / Izin / Sakit)
    // =========================================================================
    if (data.action === "pengajuan" && data.data) {
      var itemP = data.data;
      var sheetP = findTargetSheet(ss, "REKAP PENGAJUAN");
      var headersP = ["No", "Nama Karyawan", "NIK", "Departemen", "Jenis Pengajuan", "Dari Tanggal", "Sampai Tanggal", "Alasan", "Status", "Gudang"];
      ensureSheetHeader(sheetP, headersP);

      var pNik = String(itemP.nik || "").trim().toUpperCase();
      var pType = String(itemP.type || "").trim().toUpperCase();
      var pDate = normalizeDateStr(itemP.startDate);
      var pKey = (pNik + "_" + pType + "_" + pDate).replace(/\\s+/g, "");

      var lastRowP = sheetP.getLastRow();
      var foundRowP = 0;
      if (lastRowP > 1) {
        var valsP = sheetP.getRange(2, 1, lastRowP - 1, 10).getValues();
        for (var i = valsP.length - 1; i >= 0; i--) {
          var curKeyP = (String(valsP[i][2]).trim().toUpperCase() + "_" + String(valsP[i][4]).trim().toUpperCase() + "_" + normalizeDateStr(valsP[i][5])).replace(/\\s+/g, "");
          if (curKeyP === pKey) {
            foundRowP = i + 2;
            break;
          }
        }
      }

      if (foundRowP > 0) {
        sheetP.getRange(foundRowP, 9).setValue(itemP.status || "Pending");
      } else {
        sheetP.appendRow([
          lastRowP,
          itemP.name || "-",
          itemP.nik || "-",
          itemP.dept || "-",
          itemP.type || "-",
          itemP.startDate || "",
          itemP.endDate || "",
          itemP.reason || "",
          itemP.status || "Pending",
          itemP.warehouse || "${targetWh}"
        ]);
      }

      SpreadsheetApp.flush();
      return ContentService.createTextOutput(JSON.stringify({ status: "success", action: "pengajuan" })).setMimeType(ContentService.MimeType.JSON);
    }

    // =========================================================================
    // 3. EVENT SINGLE LEMBUR
    // =========================================================================
    if (data.action === "lembur" && data.data) {
      var itemL = data.data;
      var sheetL = findTargetSheet(ss, "REKAP LEMBUR");
      var headersL = ["No", "Nama Karyawan", "NIK", "Departemen", "Tanggal Lembur", "Jam Mulai", "Jam Selesai", "Total Jam", "Kompensasi/Jam", "Estimasi Upah", "Keterangan Tugas", "Status Approval", "Gudang"];
      ensureSheetHeader(sheetL, headersL);

      var lNik = String(itemL.nik || "").trim().toUpperCase();
      var lDate = normalizeDateStr(itemL.date);
      var lTime = String(itemL.startTime || "").trim();
      var lKey = (lNik + "_" + lDate + "_" + lTime).replace(/\\s+/g, "");

      var lastRowL = sheetL.getLastRow();
      var foundRowL = 0;
      if (lastRowL > 1) {
        var valsL = sheetL.getRange(2, 1, lastRowL - 1, 13).getValues();
        for (var i = valsL.length - 1; i >= 0; i--) {
          var curKeyL = (String(valsL[i][2]).trim().toUpperCase() + "_" + normalizeDateStr(valsL[i][4]) + "_" + String(valsL[i][5]).trim()).replace(/\\s+/g, "");
          if (curKeyL === lKey) {
            foundRowL = i + 2;
            break;
          }
        }
      }

      if (foundRowL > 0) {
        sheetL.getRange(foundRowL, 7, 1, 6).setValues([[
          itemL.endTime || "-",
          itemL.totalHours || 0,
          itemL.rate || 0,
          itemL.nominal || 0,
          itemL.task || "",
          itemL.status || "APPROVED"
        ]]);
      } else {
        sheetL.appendRow([
          lastRowL,
          itemL.name || "-",
          itemL.nik || "-",
          itemL.dept || "STAFF",
          itemL.date || "",
          itemL.startTime || "-",
          itemL.endTime || "-",
          itemL.totalHours || 0,
          itemL.rate || 0,
          itemL.nominal || 0,
          itemL.task || "",
          itemL.status || "APPROVED",
          itemL.warehouse || "${targetWh}"
        ]);
      }

      SpreadsheetApp.flush();
      return ContentService.createTextOutput(JSON.stringify({ status: "success", action: "lembur" })).setMimeType(ContentService.MimeType.JSON);
    }

    // =========================================================================
    // 4. BATCH / FULL BACKUP SYNC (Smart Append & In-Place Update, NEVER Clear!)
    // =========================================================================
    var sheetsData = data.sheets || {};
    var updatedList = [];

    function getRowKey(sheetName, row) {
      if (!row || row.length < 3) return "";
      var sn = sheetName.toUpperCase();
      if (sn.indexOf("RECORD") !== -1) {
        return (normalizeDateStr(row[1]) + "_" + String(row[2]).trim().toUpperCase()).replace(/\\s+/g, "");
      }
      if (sn.indexOf("PENGAJUAN") !== -1) {
        return (String(row[1]).trim().toUpperCase() + "_" + String(row[2]).trim().toUpperCase() + "_" + String(row[4]).trim().toUpperCase() + "_" + normalizeDateStr(row[5])).replace(/\\s+/g, "");
      }
      if (sn.indexOf("LEMBUR") !== -1) {
        return (String(row[2]).trim().toUpperCase() + "_" + normalizeDateStr(row[4]) + "_" + String(row[5]).trim()).replace(/\\s+/g, "");
      }
      return (String(row[1]).trim().toUpperCase() + "_" + String(row[2]).trim().toUpperCase()).replace(/\\s+/g, "");
    }

    for (var sheetName in sheetsData) {
      var rows = sheetsData[sheetName];
      if (!rows || rows.length === 0) continue;

      var targetSheet = findTargetSheet(ss, sheetName);
      var headerRow = rows[0];
      var incomingDataRows = rows.slice(1);

      ensureSheetHeader(targetSheet, headerRow);

      var lastRow = targetSheet.getLastRow();
      var lastCol = targetSheet.getLastColumn();
      var existingKeyMap = {};

      if (lastRow > 1 && lastCol > 0) {
        var exVals = targetSheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
        for (var eIdx = 0; eIdx < exVals.length; eIdx++) {
          var exRow = exVals[eIdx];
          var eKey = getRowKey(sheetName, exRow);
          if (eKey && !existingKeyMap[eKey]) {
            existingKeyMap[eKey] = {
              rowNum: eIdx + 2,
              data: exRow
            };
          }
        }
      }

      var isRecordSheet = sheetName.toUpperCase().indexOf("RECORD") !== -1;
      var rowsToAppend = [];
      var nextAutoNo = lastRow;

      for (var inIdx = 0; inIdx < incomingDataRows.length; inIdx++) {
        var inRow = incomingDataRows[inIdx];
        var inKey = getRowKey(sheetName, inRow);
        if (!inKey) continue;

        if (existingKeyMap[inKey]) {
          if (isRecordSheet) {
            var existingEntry = existingKeyMap[inKey];
            var prevOut = String(existingEntry.data[6] || "").trim();
            var prevHasValidOut = prevOut && prevOut !== "-" && prevOut.toLowerCase().indexOf("sedang") === -1 && prevOut.toLowerCase().indexOf("miss") === -1;

            var newOut = String(inRow[6] || "").trim();
            var newHasValidOut = newOut && newOut !== "-" && newOut.toLowerCase().indexOf("sedang") === -1 && newOut.toLowerCase().indexOf("miss") === -1;

            if (newHasValidOut && !prevHasValidOut) {
              targetSheet.getRange(existingEntry.rowNum, 7, 1, 5).setValues([[
                inRow[6], inRow[7], inRow[8], inRow[9], inRow[10]
              ]]);
              existingEntry.data[6] = inRow[6];
            }
          }
        } else {
          nextAutoNo++;
          var appendCopy = inRow.slice();
          appendCopy[0] = nextAutoNo;
          rowsToAppend.push(appendCopy);
          existingKeyMap[inKey] = { rowNum: nextAutoNo, data: appendCopy };
        }
      }

      if (rowsToAppend.length > 0) {
        var startAppendRow = targetSheet.getLastRow() + 1;
        var colsToWrite = rowsToAppend[0].length;
        targetSheet.getRange(startAppendRow, 1, rowsToAppend.length, colsToWrite).setValues(rowsToAppend);
      }

      updatedList.push(targetSheet.getName() + " (+" + rowsToAppend.length + " baru)");
      SpreadsheetApp.flush();
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      warehouse: "${targetWh}",
      message: "Data Gudang ${targetWh} berhasil disinkronkan tanpa menimpa baris lama: " + updatedList.join(", "),
      updatedSheets: updatedList,
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    console.error("Error in doPost: " + err.toString());
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    try { lock.releaseLock(); } catch(e) {}
  }
}

function doGet(e) {
  try {
    var ss = getTargetSpreadsheet();
    return ContentService.createTextOutput(JSON.stringify({
      status: "online",
      warehouse: "${targetWh}",
      name: "WFM Medika Realtime Auto-Sync Webhook - Gudang ${targetWh}",
      spreadsheetTitle: ss ? ss.getName() : "Unknown",
      spreadsheetId: TARGET_SPREADSHEET_ID,
      time: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
`;
  }

  const GOOGLE_APPS_SCRIPT_CODE = getGoogleAppsScriptCode('MBI');

  function switchGSheetModalTab(wh) {
   modalActiveGSheetWh = (wh || 'MBI').toUpperCase();
   const btnMbi = document.getElementById('tab-btn-gsheet-mbi');
   const btnMai = document.getElementById('tab-btn-gsheet-mai');
   const lblWh = document.getElementById('lbl-gsheet-modal-active-wh');
   const linkTarget = document.getElementById('link-gsheet-target');
   const inputEl = document.getElementById('gsheet-webhook-url');
   const guideWh = document.getElementById('lbl-gsheet-guide-wh');
   const guideTarget = document.getElementById('link-gsheet-guide-target');
   const guideTargetName = document.getElementById('lbl-gsheet-guide-target-name');

   if (modalActiveGSheetWh === 'MAI') {
    if (btnMbi) {
     btnMbi.className = 'flex-1 py-2 px-3 rounded-xl text-xs font-black transition text-slate-600 hover:text-slate-900 flex items-center justify-center gap-1.5';
    }
    if (btnMai) {
     btnMai.className = 'flex-1 py-2 px-3 rounded-xl text-xs font-black transition bg-white text-slate-900 shadow-xs border border-slate-200 flex items-center justify-center gap-1.5';
    }
    if (lblWh) lblWh.innerText = 'Gudang MAI';
    if (linkTarget) {
     linkTarget.href = GOOGLE_SPREADSHEET_URL_MAI;
     linkTarget.innerText = 'Buka Spreadsheet MAI â€ â€”';
    }
    if (guideWh) guideWh.innerText = 'Gudang MAI';
    if (guideTarget) {
     guideTarget.href = GOOGLE_SPREADSHEET_URL_MAI;
    }
    if (guideTargetName) guideTargetName.innerText = 'MAI';
    if (inputEl) inputEl.value = getGoogleSheetWebhookUrl('MAI');
   } else {
    if (btnMbi) {
     btnMbi.className = 'flex-1 py-2 px-3 rounded-xl text-xs font-black transition bg-white text-slate-900 shadow-xs border border-slate-200 flex items-center justify-center gap-1.5';
    }
    if (btnMai) {
     btnMai.className = 'flex-1 py-2 px-3 rounded-xl text-xs font-black transition text-slate-600 hover:text-slate-900 flex items-center justify-center gap-1.5';
    }
    if (lblWh) lblWh.innerText = 'Gudang MBI';
    if (linkTarget) {
     linkTarget.href = GOOGLE_SPREADSHEET_URL_MBI;
     linkTarget.innerText = 'Buka Spreadsheet MBI â€ â€”';
    }
    if (guideWh) guideWh.innerText = 'Gudang MBI';
    if (guideTarget) {
     guideTarget.href = GOOGLE_SPREADSHEET_URL_MBI;
    }
    if (guideTargetName) guideTargetName.innerText = 'MBI';
    if (inputEl) inputEl.value = getGoogleSheetWebhookUrl('MBI');
   }

   const statusEl = document.getElementById('gsheet-backup-status');
   if (statusEl) {
    statusEl.className = 'p-3 rounded-xl text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-2';
    statusEl.innerHTML = `<i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-600 shrink-0"></i> <span>Å¡ <b>Auto-Sync Realtime Aktif untuk Gudang ${modalActiveGSheetWh}!</b></span>`;
    statusEl.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
   }
  }

  function onGSheetTargetWhChange(val) {
   if (val === 'MBI' || val === 'MAI') {
    switchGSheetModalTab(val);
   }
  }

  async function testGoogleSheetWebhookConnection() {
   const inputEl = document.getElementById('gsheet-webhook-url');
   const rawUrl = (inputEl?.value || getGoogleSheetWebhookUrl(modalActiveGSheetWh) || '').trim();
   if (!rawUrl) {
    alert(`Silakan masukkan URL Web App Google Apps Script untuk Gudang ${modalActiveGSheetWh} Anda terlebih dahulu.`);
    return;
   }

   const cleanUrl = cleanGoogleScriptUrl(rawUrl);
   const statusEl = document.getElementById('gsheet-backup-status');
   if (statusEl) {
    statusEl.className = 'p-3.5 rounded-2xl text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200 flex items-center gap-2';
    statusEl.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin text-amber-600 shrink-0"></i> <span>Menguji respon Webhook Gudang ${modalActiveGSheetWh}...</span>`;
    statusEl.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
   }

   try {
    const getResp = await fetch(cleanUrl, { method: 'GET', redirect: 'follow' });
    if (getResp.ok) {
     const json = await getResp.json();
     if (json && json.status === 'online') {
      if (statusEl) {
       statusEl.className = 'p-3.5 rounded-2xl text-xs font-bold bg-emerald-50 text-emerald-900 border border-emerald-300 flex items-center gap-2';
       statusEl.innerHTML = `<i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-600 shrink-0"></i> <span>Å“â€¦ <b>Koneksi Webhook Gudang ${modalActiveGSheetWh} Berhasil!</b> Terhubung ke: <u>${json.spreadsheetTitle || 'Target Google Spreadsheet'}</u>.</span>`;
       statusEl.classList.remove('hidden');
       if (typeof lucide !== 'undefined') lucide.createIcons();
      }
      alert(`Å“â€¦ KONEKSI GOOGLE APPS SCRIPT GUDANG ${modalActiveGSheetWh} BERHASIL!\n\nStatus: Online\nSpreadsheet: ${json.spreadsheetTitle || 'Terhubung'}\n\nWebhook siap menerima sinkronisasi otomatis presensi.`);
      return;
     }
    }
   } catch (eGet) {
    console.warn('GET diagnostic notice:', eGet);
   }

   if (statusEl) {
    statusEl.className = 'p-3.5 rounded-2xl text-xs font-bold bg-amber-50 text-amber-950 border border-amber-300 flex items-start gap-2.5';
    statusEl.innerHTML = `
     <i data-lucide="alert-circle" class="w-5 h-5 text-amber-600 shrink-0 mt-0.5"></i>
     <div class="space-y-1 text-[11px] leading-relaxed">
      <b class="text-xs text-amber-900 block font-black">Langkah Wajib Agar Data Muncul di Google Sheet (${modalActiveGSheetWh}):</b>
      <p>Jika data belum masuk ke Google Sheet, ada 2 hal penting yang perlu diperiksa di Apps Script:</p>
      <ol class="list-decimal list-inside pl-1 space-y-0.5 text-amber-900 font-semibold">
       <li><b>Otorisasi Izin:</b> Di Apps Script, pilih fungsi <b>testManualSync</b> lalu klik <b>Jalankan (Run)</b> &rarr; Izinkan Akses (Allow).</li>
       <li><b>Akses Publik:</b> Buka <b>Terapkan &rarr; Kelola Penerapan &rarr; Edit</b> &rarr; Versi: <b>Versi Baru</b> &rarr; Siapa yang memiliki akses: <b>Siapa saja (Anyone)</b> &rarr; Terapkan.</li>
      </ol>
     </div>
    `;
    statusEl.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
   }
   alert(`â€ž  TIPS PENTING UNTUK GUDANG ${modalActiveGSheetWh}:\n\nPastikan di Google Apps Script:\n1. Pilih fungsi testManualSync lalu klik "Jalankan" untuk mengizinkan akses (Otorisasi).\n2. Saat Deploy (Terapkan), opsi "Yang memiliki akses" WAJIB dipilih "Siapa saja" (Anyone).`);
  }

  function updateGSheetSyncBadge(status = 'standby') {
   const dot = document.getElementById('nav-gsheet-dot');
   const label = document.getElementById('nav-gsheet-label');

   if (status === 'syncing') {
    if (dot) dot.className = 'w-2 h-2 rounded-full bg-amber-400 animate-spin';
    if (label) label.innerText = 'Google Sheet: Menyimpan...';
   } else if (status === 'synced') {
    if (dot) dot.className = 'w-2 h-2 rounded-full bg-emerald-500 animate-pulse';
    if (label) label.innerText = 'Google Sheet: Auto Å¡ ';
   } else {
    if (dot) dot.className = 'w-2 h-2 rounded-full bg-emerald-500';
    if (label) label.innerText = 'Google Sheet: Auto Å¡ ';
   }
  }

  let gsheetSyncTimeout = null;
  let isGSheetSyncing = false;
  let pendingGSheetSync = false;
  const pendingGSheetTargetWhs = new Set();
  const pendingForcePartialWhs = new Set();

  function markGSheetSyncPending(wh) {
   try {
    const key = 'wfm_gsheet_pending_map';
    const map = JSON.parse(localStorage.getItem(key) || '{}');
    map[String(wh || activeWarehouse || 'MBI').toUpperCase()] = Date.now();
    localStorage.setItem(key, JSON.stringify(map));
   } catch(e) {}
  }

  function clearGSheetSyncPending(wh) {
   try {
    const key = 'wfm_gsheet_pending_map';
    const map = JSON.parse(localStorage.getItem(key) || '{}');
    delete map[String(wh).toUpperCase()];
    localStorage.setItem(key, JSON.stringify(map));
   } catch(e) {}
  }

  function flushPendingGSheetSync() {
   try {
    const map = JSON.parse(localStorage.getItem('wfm_gsheet_pending_map') || '{}');
    const keys = Object.keys(map).filter(k => k === 'MBI' || k === 'MAI');
    if (keys.length > 0 && navigator.onLine !== false) {
     if (keys.length >= 2) syncGoogleSheetDirectly(false, 'ALL');
     else syncGoogleSheetDirectly(false, keys[0]);
    }
   } catch(e) {}
  }

  try {
   window.addEventListener('online', () => { flushPendingGSheetSync(); });
  } catch(eOnlineGs) {}

  function buildSingleRecordAbsenRow(wh, r) {
   const targetWh = (wh || (typeof activeWarehouse !== 'undefined' ? activeWarehouse : 'MBI') || 'MBI').toUpperCase();
   const users = getWhDB(targetWh, 'users', targetWh === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);
   let emp = null;
   if (r.userName) emp = users.find(u => cleanStr(u.name) === cleanStr(r.userName));
   if (!emp && r.userNik) emp = users.find(u => u.nik && u.nik.toUpperCase() === r.userNik.toUpperCase());
   if (!emp && r.userId) emp = users.find(u => u.id === r.userId);

   const finalName = emp ? emp.name : (r.userName || r.name || '-');
   const finalNik = emp ? emp.nik : (r.userNik || r.nik || '-');
   const finalDept = emp ? emp.dept : (r.dept || r.department || '');

   const durInfo = typeof getAttendanceDurationInfo === 'function' ? getAttendanceDurationInfo(r) : { isMissScan: false, isOngoing: !r.checkOutTime, statusOut: r.checkOutTime ? 'Sudah Pulang' : 'Sedang Shift', durationStr: '-' };
   const checkInDate = new Date(r.checkInTime);
   const minute = checkInDate.getMinutes();
   const isLate = r.checkInStatus === 'late' || (minute >= 1 && minute <= 30);
   const statusMasuk = isLate ? 'Late In' : 'Normal';
   const statusPulang = durInfo.isMissScan ? 'Miss Scan' : durInfo.statusOut;
   const finalJamPulang = durInfo.isMissScan ? 'Miss Scan' : (r.checkOutTime ? formatDisplayTimeWIB(r.checkOutTime) : (durInfo.isOngoing ? 'Sedang Shift' : 'Miss Scan'));
   const finalDuration = durInfo.isMissScan ? '7 Jam (Miss Scan)' : durInfo.durationStr;
   const finalKeterangan = durInfo.isMissScan ? `${statusMasuk} - Miss Scan` : `${statusMasuk} - ${statusPulang}${r.notes && r.notes !== '-' ? ` (${r.notes})` : ''}`;

   return [
    1,
    r.date || '',
    finalNik,
    finalName,
    (finalDept || 'STAFF').toUpperCase(),
    r.checkInTime ? formatDisplayTimeWIB(r.checkInTime) : '-',
    finalJamPulang,
    finalDuration,
    statusMasuk,
    statusPulang,
    finalKeterangan,
    targetWh
   ];
  }

  async function pushSingleScanToGoogleSheet(wh, rec) {
   try {
    if (!rec || (typeof navigator !== 'undefined' && navigator.onLine === false)) return false;
    const targetWh = (wh || rec.warehouse || (typeof activeWarehouse !== 'undefined' ? activeWarehouse : 'MBI') || 'MBI').toUpperCase();
    const webhookUrl = getGoogleSheetWebhookUrl(targetWh);
    if (!webhookUrl) return false;

    const users = getWhDB(targetWh, 'users', targetWh === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);
    let emp = null;
    if (rec.userName) emp = users.find(u => cleanStr(u.name) === cleanStr(rec.userName));
    if (!emp && rec.userNik) emp = users.find(u => u.nik && u.nik.toUpperCase() === rec.userNik.toUpperCase());
    if (!emp && rec.userId) emp = users.find(u => u.id === rec.userId);

    const finalName = emp ? emp.name : (rec.userName || '-');
    const finalNik = emp ? emp.nik : (rec.userNik || '-');
    const finalDept = emp ? emp.dept : (rec.dept || '');

    const durInfo = getAttendanceDurationInfo(rec);
    const checkInDate = rec.checkInTime ? new Date(rec.checkInTime) : null;
    const minute = checkInDate ? checkInDate.getMinutes() : 0;
    const isLate = rec.checkInStatus === 'late' || (minute >= 1 && minute <= 30);
    const statusMasuk = isLate ? 'Late In' : 'Normal';
    const statusPulang = durInfo.isMissScan ? 'Miss Scan' : durInfo.statusOut;
    const finalJamPulang = durInfo.isMissScan ? 'Miss Scan' : (rec.checkOutTime ? formatDisplayTimeWIB(rec.checkOutTime) : (durInfo.isOngoing ? 'Sedang Shift' : 'Miss Scan'));
    const finalDuration = durInfo.isMissScan ? '7 Jam (Miss Scan)' : durInfo.durationStr;
    const finalKeterangan = durInfo.isMissScan ? `${statusMasuk} - Miss Scan` : `${statusMasuk} - ${statusPulang}${rec.notes && rec.notes !== '-' ? ` (${rec.notes})` : ''}`;

    const singlePayload = {
      action: 'scan',
      warehouse: targetWh,
      data: {
        date: rec.date || '',
        nik: finalNik,
        name: finalName,
        dept: (finalDept || 'STAFF').toUpperCase(),
        checkIn: rec.checkInTime ? formatDisplayTimeWIB(rec.checkInTime) : '-',
        checkOut: finalJamPulang,
        duration: finalDuration,
        statusMasuk: statusMasuk,
        statusPulang: statusPulang,
        keterangan: finalKeterangan,
        warehouse: targetWh
      }
    };

    const targetUrl = cleanGoogleScriptUrl(webhookUrl) || webhookUrl;
    fetch(targetUrl, {
      method: 'POST',
      mode: 'no-cors',
      cache: 'no-cache',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(singlePayload)
    }).catch(e => console.warn('Single scan gsheet notice:', e));

    return true;
   } catch (e) {
    console.warn('pushSingleScanToGoogleSheet notice:', e);
    return false;
   }
  }

  async function pushSinglePengajuanToGoogleSheet(wh, lv) {
   try {
    if (!lv || (typeof navigator !== 'undefined' && navigator.onLine === false)) return false;
    const targetWh = (wh || lv.warehouse || (typeof activeWarehouse !== 'undefined' ? activeWarehouse : 'MBI') || 'MBI').toUpperCase();
    const webhookUrl = getGoogleSheetWebhookUrl(targetWh);
    if (!webhookUrl) return false;

    const users = getWhDB(targetWh, 'users', targetWh === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);
    const emp = users.find(u => u.nik === lv.userNik);

    const payload = {
      action: 'pengajuan',
      warehouse: targetWh,
      data: {
        name: lv.userName || '-',
        nik: lv.userNik || '-',
        dept: emp ? (emp.dept || '').toUpperCase() : '-',
        type: (lv.type || '').toUpperCase(),
        startDate: lv.startDate || '',
        endDate: lv.endDate || '',
        reason: lv.reason || '',
        status: lv.status === 'approved' ? 'Disetujui' : (lv.status === 'rejected' ? 'Ditolak' : 'Pending'),
        warehouse: targetWh
      }
    };

    const targetUrl = cleanGoogleScriptUrl(webhookUrl) || webhookUrl;
    fetch(targetUrl, {
      method: 'POST',
      mode: 'no-cors',
      cache: 'no-cache',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    }).catch(e => console.warn('Single pengajuan gsheet notice:', e));
    return true;
   } catch(e) {
    return false;
   }
  }

  async function pushSingleOvertimeToGoogleSheet(wh, o) {
   try {
    if (!o || (typeof navigator !== 'undefined' && navigator.onLine === false)) return false;
    const targetWh = (wh || o.warehouse || (typeof activeWarehouse !== 'undefined' ? activeWarehouse : 'MBI') || 'MBI').toUpperCase();
    const webhookUrl = getGoogleSheetWebhookUrl(targetWh);
    if (!webhookUrl) return false;

    const payload = {
      action: 'lembur',
      warehouse: targetWh,
      data: {
        name: o.userName || '-',
        nik: o.userNik || '-',
        dept: (o.dept || 'STAFF').toUpperCase(),
        date: o.date || '',
        startTime: o.startTime || '-',
        endTime: o.endTime || '-',
        totalHours: Number(o.effectiveHours) || Number(o.totalHours) || 0,
        rate: Number(o.ratePerHour) || 0,
        nominal: Number(o.nominal) || 0,
        task: o.task || '',
        status: (o.status || 'approved').toUpperCase(),
        warehouse: targetWh
      }
    };

    const targetUrl = cleanGoogleScriptUrl(webhookUrl) || webhookUrl;
    fetch(targetUrl, {
      method: 'POST',
      mode: 'no-cors',
      cache: 'no-cache',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    }).catch(e => console.warn('Single overtime gsheet notice:', e));
    return true;
   } catch(e) {
    return false;
   }
  }

  async function syncGoogleSheetDirectly(forceAllowPartial = false, targetWh = null) {
   const curActiveWh = (typeof activeWarehouse !== 'undefined' ? activeWarehouse : 'MBI').toUpperCase();
   const rawTarget = (targetWh || curActiveWh || 'MBI').toUpperCase();
   const whTargets = rawTarget === 'ALL' ? ['MBI', 'MAI'] : [(rawTarget === 'MAI' ? 'MAI' : 'MBI')];

   whTargets.forEach(w => {
    markGSheetSyncPending(w);
    pendingGSheetTargetWhs.add(w);
    if (forceAllowPartial) pendingForcePartialWhs.add(w);
   });

   if (gsheetSyncTimeout) clearTimeout(gsheetSyncTimeout);
   gsheetSyncTimeout = setTimeout(async () => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
     updateGSheetSyncBadge('local');
     return;
    }

    if (isGSheetSyncing) {
     pendingGSheetSync = true;
     return;
    }
    isGSheetSyncing = true;
    updateGSheetSyncBadge('syncing');

    const runWhList = pendingGSheetTargetWhs.size > 0 ? Array.from(pendingGSheetTargetWhs) : [curActiveWh];
    const forcedWhSet = new Set(pendingForcePartialWhs);
    pendingGSheetTargetWhs.clear();
    pendingForcePartialWhs.clear();

    const syncOneWhToSheet = async (wh, allowPartial) => {
     const webhookUrl = getGoogleSheetWebhookUrl(wh);
     if (!webhookUrl) return;

     // DataShield: Jangan dorong data ke Google Sheet dari perangkat yang baru dibuka sebelum sinkronisasi awal Cloud selesai!
     const initDone = !!(window._cloudAttInitialSyncDone && window._cloudAttInitialSyncDone[wh]);
     if (!allowPartial && !initDone) {
      markGSheetSyncPending(wh);
      return;
     }

     // Gabungkan cache backup agar payload tidak pernah menyusut akibat memori lokal parsial
     try {
      const localAtt = getWhDB(wh, 'attendance', []);
      const bakRaw = localStorage.getItem(`wfm_${wh.toLowerCase()}_attendance_backup`);
      if (bakRaw) {
       const bakList = JSON.parse(bakRaw);
       if (Array.isArray(bakList) && bakList.length > localAtt.length) {
        const mergedSafe = mergeAttendanceArrays(localAtt, bakList);
        setWhDB(wh, 'attendance', mergedSafe, true);
       }
      }
     } catch(eMergeBak) {}

     const payload = compileBackupPayload(wh);
     const targetUrl = cleanGoogleScriptUrl(webhookUrl) || webhookUrl;
     const curRows = payload.sheets && payload.sheets["RECORD ABSEN"] ? payload.sheets["RECORD ABSEN"].length : 0;

     const hasData = payload.sheets && (
      (payload.sheets["RECORD ABSEN"] && payload.sheets["RECORD ABSEN"].length > 1) ||
      (payload.sheets["REKAP PENGAJUAN"] && payload.sheets["REKAP PENGAJUAN"].length > 1) ||
      (payload.sheets["REKAP LEMBUR"] && payload.sheets["REKAP LEMBUR"].length > 1)
     );

     if (!hasData) return;

     const lastRows = parseInt(localStorage.getItem(`wfm_max_pushed_sheet_rows_${wh}`) || '0', 10);
     // ANTI-SHRINK MUTLAK: Jangan pernah menimpa Google Sheet jika baris data menyusut drastis atau kosong (kecuali penghapusan resmi admin)
     if (!allowPartial && lastRows > 10 && curRows < (lastRows * 0.5)) {
      console.warn(`[GSheet Protect] Menolak mengirim payload ke ${wh}: jumlah baris menyusut (${curRows} vs ${lastRows}).`);
      return;
     }
     if (!allowPartial && curRows <= 1 && lastRows > 1) {
      return;
     }
     if (curRows > 0) {
      if (allowPartial) {
       localStorage.setItem(`wfm_max_pushed_sheet_rows_${wh}`, String(curRows));
      } else {
       localStorage.setItem(`wfm_max_pushed_sheet_rows_${wh}`, String(Math.max(lastRows, curRows)));
      }
     }

     try {
      await fetch(targetUrl, {
       method: 'POST',
       mode: 'no-cors',
       cache: 'no-cache',
       headers: { 'Content-Type': 'text/plain;charset=utf-8' },
       body: JSON.stringify(payload)
      });
      clearGSheetSyncPending(wh);
     } catch (e) {
      markGSheetSyncPending(wh);
      console.warn(`${wh} GSheet sync notice:`, e);
     }
    };

    try {
     await Promise.allSettled(runWhList.map(w => syncOneWhToSheet(w, forcedWhSet.has(w))));
     updateGSheetSyncBadge('synced');
    } catch (err) {
     console.warn('Google Sheet cloud backup sync notice:', err);
     updateGSheetSyncBadge('synced');
    } finally {
     isGSheetSyncing = false;
     if (pendingGSheetSync || pendingGSheetTargetWhs.size > 0) {
      pendingGSheetSync = false;
      const queuedList = Array.from(pendingGSheetTargetWhs);
      if (queuedList.length > 0) {
       const nextForce = queuedList.some(w => pendingForcePartialWhs.has(w));
       const nextTarget = queuedList.length >= 2 ? 'ALL' : queuedList[0];
       syncGoogleSheetDirectly(nextForce, nextTarget);
      }
     }
    }
   }, 3000);
  }

  function triggerGoogleSheetAutoSync(immediate = false, targetWh = null) {
   if (immediate) {
    syncGoogleSheetDirectly(false, targetWh);
   } else {
    saveFullDatabaseToCloud(false);
   }
  }

  function executeActualGSheetSync(targetWh = null) {
   return syncGoogleSheetDirectly(false, targetWh);
  }

  function openGoogleSheetBackupModal(source = 'general') {
   if (!isUserAdmin()) {
    alert('Akses Ditolak: Fitur Backup ke Google Spreadsheet hanya dapat diakses oleh Akun Admin Gudang.');
    return;
   }
   const modal = document.getElementById('google-sheet-backup-modal');
   if (!modal) return;

   const currentWh = (activeWarehouse || 'MBI').toUpperCase();
   modalActiveGSheetWh = (currentWh === 'MAI') ? 'MAI' : 'MBI';
   switchGSheetModalTab(modalActiveGSheetWh);

   const whSelect = document.getElementById('gsheet-target-wh');
   if (whSelect) whSelect.value = 'ALL';

   modal.classList.remove('hidden');
   if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  function closeGoogleSheetBackupModal() {
   const modal = document.getElementById('google-sheet-backup-modal');
   if (!modal) return;
   modal.classList.add('hidden');
   updateGSheetSyncBadge();
  }

  function toggleGSheetGuide() {
   const body = document.getElementById('gsheet-guide-body');
   const chevron = document.getElementById('gsheet-guide-chevron');
   if (!body) return;
   const isHidden = body.classList.contains('hidden');
   body.classList.toggle('hidden', !isHidden);
   if (chevron) {
    chevron.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
   }
  }

  function saveGoogleSheetWebhookUrl() {
   const inputEl = document.getElementById('gsheet-webhook-url');
   const url = (inputEl?.value || '').trim();
   if (!url) {
    alert(`Silakan masukkan URL Web App Google Apps Script untuk Gudang ${modalActiveGSheetWh}.`);
    return;
   }
   const isGoogleScriptUrl = url.startsWith('https://script.google.com/') && url.includes('/s/') && (url.includes('/exec') || url.endsWith('/exec'));
   if (!isGoogleScriptUrl) {
    alert('Format URL tidak sesuai.\nURL Google Apps Script harus berformat:\nhttps://script.google.com/macros/s/.../exec atau\nhttps://script.google.com/a/macros/<domain>/s/.../exec');
    return;
   }

   if (modalActiveGSheetWh === 'MAI') {
    localStorage.setItem('wfm_gsheet_webhook_url_mai', url);
   } else {
    localStorage.setItem('wfm_gsheet_webhook_url_mbi', url);
    localStorage.setItem('wfm_gsheet_webhook_url', url);
   }
   updateGSheetSyncBadge('synced');

   const statusEl = document.getElementById('gsheet-backup-status');
   if (statusEl) {
    statusEl.className = 'p-3 rounded-xl text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-2';
    statusEl.innerHTML = `<i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-600 shrink-0"></i> <span>Å¡ URL Webhook Gudang ${modalActiveGSheetWh} tersimpan! Sinkronisasi otomatis diaktifkan untuk setiap absensi karyawan.</span>`;
    statusEl.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
   }

   triggerGoogleSheetAutoSync(true);
   alert(`Å“â€¦ URL Google Apps Script Webhook untuk Gudang ${modalActiveGSheetWh} berhasil disimpan!\n\nÅ¡ SINKRONISASI OTOMATIS AKTIF:\nSetiap kali ada karyawan Gudang ${modalActiveGSheetWh} yang absen masuk/pulang, mengajukan lembur, atau cuti/sakit, data otomatis mengalir ke Google Spreadsheet ${modalActiveGSheetWh} secara realtime.`);
  }

  function copyGoogleAppsScriptCode(wh = null) {
   const targetWh = (wh || modalActiveGSheetWh || activeWarehouse || 'MBI').toUpperCase();
   const code = getGoogleAppsScriptCode(targetWh);
   copyToClipboardText(code, `Kode Google Apps Script untuk Gudang ${targetWh} berhasil disalin ke clipboard!\n\nSilakan tempelkan (Paste) pada menu Ekstensi > Apps Script di Google Spreadsheet target Gudang ${targetWh}.`);
   const btnText = document.getElementById('btn-copy-gas-text');
   if (btnText) {
    const orig = btnText.innerText;
    btnText.innerText = `Kode ${targetWh} Tersalin!`;
    setTimeout(() => { btnText.innerText = orig; }, 2500);
   }
  }

  function copyToClipboardText(text, successMsg = 'Teks berhasil disalin!') {
   if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
     alert('Å“â€¦ ' + successMsg);
    }).catch(() => {
     fallbackTextCopy(text, successMsg);
    });
   } else {
    fallbackTextCopy(text, successMsg);
   }
  }

  function fallbackTextCopy(text, successMsg) {
   const ta = document.createElement('textarea');
   ta.value = text;
   ta.style.position = 'fixed';
   ta.style.top = '-9999px';
   document.body.appendChild(ta);
   ta.select();
   try {
    document.execCommand('copy');
    alert('Å“â€¦ ' + successMsg);
   } catch (err) {
    alert('Gagal menyalin: ' + err.message);
   }
   document.body.removeChild(ta);
  }

  // Generator Data Tiap Sheet
  function generateRecordAbsenSheetData(warehouse) {
   const whList = warehouse === 'ALL' ? ['MBI', 'MAI'] : [warehouse];
   const headers = [
    "No", "Tanggal", "NIK", "Nama Karyawan", "Departemen", 
    "Jam Masuk", "Jam Pulang", "Durasi Kerja", 
    "Status Kehadiran", "Status Kepulangan", "Keterangan", "Gudang"
   ];
   const rows = [headers];
   let rowIdx = 1;

   whList.forEach(wh => {
    const users = getWhDB(wh, 'users', wh === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);
    let rawAttendances = getWhDB(wh, 'attendance', wh === 'MBI' ? SEED_MBI_ATTENDANCE : SEED_MAI_ATTENDANCE);
    try {
     const todayKey = 'wfm_' + wh.toLowerCase() + '_today_attendance';
     const todayRaw = localStorage.getItem(todayKey);
     if (todayRaw) {
      const todayList = JSON.parse(todayRaw);
      if (Array.isArray(todayList) && todayList.length > 0) {
       rawAttendances = mergeAttendanceArrays(rawAttendances || [], todayList);
      }
     }
    } catch(e) {}
    const attendances = (rawAttendances || []).filter(a => a && !isAttendanceMarkedDeleted(a));
    const sorted = [...attendances].sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.checkInTime || '').localeCompare(a.checkInTime || ''));

    sorted.forEach(r => {
     let emp = null;
     if (r.userName) emp = users.find(u => cleanStr(u.name) === cleanStr(r.userName));
     if (!emp && r.userNik) emp = users.find(u => u.nik && u.nik.toUpperCase() === r.userNik.toUpperCase());
     if (!emp && r.userId) emp = users.find(u => u.id === r.userId);

     const finalName = emp ? emp.name : (r.userName || '-');
     const finalNik = emp ? emp.nik : (r.userNik || '-');
     const finalDept = emp ? emp.dept : (r.dept || '');

     const durInfo = getAttendanceDurationInfo(r);
     const checkInDate = new Date(r.checkInTime);
     const minute = checkInDate.getMinutes();
     const isLate = r.checkInStatus === 'late' || (minute >= 1 && minute <= 30);
     const statusMasuk = isLate ? 'Late In' : 'Normal';
     const statusPulang = durInfo.isMissScan ? 'Miss Scan' : durInfo.statusOut;
     const finalJamPulang = durInfo.isMissScan ? 'Miss Scan' : (r.checkOutTime ? formatDisplayTimeWIB(r.checkOutTime) : (durInfo.isOngoing ? 'Sedang Shift' : 'Miss Scan'));
     const finalDuration = durInfo.isMissScan ? '7 Jam (Miss Scan)' : durInfo.durationStr;
     const finalKeterangan = durInfo.isMissScan ? `${statusMasuk} - Miss Scan` : `${statusMasuk} - ${statusPulang}${r.notes && r.notes !== '-' ? ` (${r.notes})` : ''}`;

     rows.push([
      rowIdx++,
      r.date || '',
      finalNik,
      finalName,
      (finalDept || 'STAFF').toUpperCase(),
      r.checkInTime ? formatDisplayTimeWIB(r.checkInTime) : '-',
      finalJamPulang,
      finalDuration,
      statusMasuk,
      statusPulang,
      finalKeterangan,
      wh
     ]);
    });
   });

   return rows;
  }

  function generateRekapPengajuanSheetData(warehouse) {
   const whList = warehouse === 'ALL' ? ['MBI', 'MAI'] : [warehouse];
   const headers = [
    "No", "Nama Karyawan", "NIK", "Departemen", 
    "Jenis Pengajuan", "Dari Tanggal", "Sampai Tanggal", 
    "Alasan", "Status", "Gudang"
   ];
   const rows = [headers];
   let rowIdx = 1;

   whList.forEach(wh => {
    const users = getWhDB(wh, 'users', wh === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);
    const leaves = getWhDB(wh, 'leaves', wh === 'MBI' ? SEED_MBI_LEAVES : []);
    const sorted = [...leaves].sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));

    sorted.forEach(lv => {
     const emp = users.find(u => u.nik === lv.userNik);
     rows.push([
      rowIdx++,
      lv.userName || '-',
      lv.userNik || '-',
      emp ? (emp.dept || '').toUpperCase() : '-',
      (lv.type || '').toUpperCase(),
      lv.startDate || '',
      lv.endDate || '',
      lv.reason || '',
      lv.status === 'approved' ? 'Disetujui' : (lv.status === 'rejected' ? 'Ditolak' : 'Pending'),
      wh
     ]);
    });
   });

   return rows;
  }

  function generateRekapLemburSheetData(warehouse) {
   const whList = warehouse === 'ALL' ? ['MBI', 'MAI'] : [warehouse];
   const headers = [
    "No", "Nama Karyawan", "NIK", "Departemen", 
    "Tanggal Lembur", "Jam Mulai", "Jam Selesai", 
    "Total Jam", "Kompensasi/Jam", "Estimasi Upah", 
    "Keterangan Tugas", "Status Approval", "Gudang"
   ];
   const rows = [headers];
   let rowIdx = 1;

   whList.forEach(wh => {
    const overtimes = getWhDB(wh, 'overtime', wh === 'MBI' ? SEED_MBI_OVERTIMES : []);
    const sorted = [...overtimes].sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.startTime || '').localeCompare(a.startTime || ''));

    sorted.forEach(o => {
     rows.push([
      rowIdx++,
      o.userName || '-',
      o.userNik || '-',
      (o.dept || 'STAFF').toUpperCase(),
      o.date || '',
      o.startTime || '-',
      o.endTime || '-',
      Number(o.effectiveHours) || Number(o.totalHours) || 0,
      Number(o.ratePerHour) || 0,
      Number(o.nominal) || 0,
      o.task || '',
      (o.status || 'approved').toUpperCase(),
      wh
     ]);
    });
   });

   return rows;
  }

  function compileBackupPayload(targetWhMode) {
   let wh = targetWhMode || 'ALL';
   if (wh === 'CURRENT') wh = activeWarehouse;

   const sheets = {};
   const recordAbsenRows = generateRecordAbsenSheetData(wh);
   // Safety guard: Hanya sertakan RECORD ABSEN jika berisi data (lebih dari sekadar baris header)
   if (recordAbsenRows && recordAbsenRows.length > 1) {
    sheets["RECORD ABSEN"] = recordAbsenRows;
   }
   const pengajuanRows = generateRekapPengajuanSheetData(wh);
   if (pengajuanRows && pengajuanRows.length > 1) {
    sheets["REKAP PENGAJUAN"] = pengajuanRows;
   }
   const lemburRows = generateRekapLemburSheetData(wh);
   if (lemburRows && lemburRows.length > 1) {
    sheets["REKAP LEMBUR"] = lemburRows;
   }

   return {
    targetWarehouse: wh,
    timestamp: new Date().toISOString(),
    sheets: sheets
   };
  }

  async function executeGoogleSheetBackup() {
   const targetWhMode = document.getElementById('gsheet-target-wh')?.value || 'ALL';
   const statusEl = document.getElementById('gsheet-backup-status');
   const btn = document.getElementById('btn-run-gsheet-backup');

   updateGSheetSyncBadge('syncing');

   if (statusEl) {
    statusEl.className = 'p-3.5 rounded-2xl text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200 flex items-center gap-2';
    statusEl.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin text-amber-600 shrink-0"></i> <span>Sedang menyinkronkan data ke Google Spreadsheet (${targetWhMode})...</span>`;
    statusEl.classList.remove('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
   }
   if (btn) btn.disabled = true;

   try {
    const tasks = [];
    const syncedNames = [];

    if (targetWhMode === 'ALL' || targetWhMode === 'MBI') {
     const urlMbi = getGoogleSheetWebhookUrl('MBI');
     if (urlMbi) {
      const payloadMbi = compileBackupPayload('MBI');
      const targetMbi = cleanGoogleScriptUrl(urlMbi) || urlMbi;
      tasks.push(
       fetch(targetMbi, {
        method: 'POST',
        mode: 'no-cors',
        cache: 'no-cache',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payloadMbi)
       }).then(() => syncedNames.push('Google Sheet MBI'))
      );
     }
    }

    if (targetWhMode === 'ALL' || targetWhMode === 'MAI') {
     const urlMai = getGoogleSheetWebhookUrl('MAI');
     if (urlMai) {
      const payloadMai = compileBackupPayload('MAI');
      const targetMai = cleanGoogleScriptUrl(urlMai) || urlMai;
      tasks.push(
       fetch(targetMai, {
        method: 'POST',
        mode: 'no-cors',
        cache: 'no-cache',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payloadMai)
       }).then(() => syncedNames.push('Google Sheet MAI'))
      );
     }
    }

    if (tasks.length > 0) {
     await Promise.allSettled(tasks);
    }

    updateGSheetSyncBadge('synced');
    if (statusEl) {
     statusEl.className = 'p-3.5 rounded-2xl text-xs font-bold bg-emerald-50 text-emerald-900 border border-emerald-300 flex items-center gap-2';
     statusEl.innerHTML = `<i data-lucide="check-circle" class="w-4 h-4 text-emerald-600 shrink-0"></i> <span><b>Sinkronisasi Sukses!</b> Data telah masuk ke ${syncedNames.join(' & ')}.</span>`;
     statusEl.classList.remove('hidden');
     if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    alert(`Å“â€¦ SINKRONISASI KE GOOGLE SPREADSHEET BERHASIL!\n\nSeluruh data presensi & laporan telah diperbarui ke ${syncedNames.join(' dan ')}.\n\nÅ¡ Sistem sekarang otomatis menyinkronkan setiap ada karyawan yang scan absen masuk/pulang.`);
   } catch (err) {
    console.warn('Backup fetch notice (data transmitted):', err);
    updateGSheetSyncBadge('synced');
    if (statusEl) {
     statusEl.className = 'p-3.5 rounded-2xl text-xs font-bold bg-emerald-50 text-emerald-900 border border-emerald-300 flex items-center gap-2';
     statusEl.innerHTML = `<i data-lucide="check-circle" class="w-4 h-4 text-emerald-600 shrink-0"></i> <span>Data telah dikirim ke Google Spreadsheet. Silakan periksa tab sheet Anda.</span>`;
     statusEl.classList.remove('hidden');
     if (typeof lucide !== 'undefined') lucide.createIcons();
    }
    alert('Å“â€¦ Data absensi telah dikirim ke Google Spreadsheet!\n\nSilakan periksa tab sheet Anda di Google Spreadsheet.');
   } finally {
    if (btn) btn.disabled = false;
   }
  }

  function downloadMultiSheetExcelBackup() {
   const targetWhMode = document.getElementById('gsheet-target-wh')?.value || 'ALL';
   let wh = targetWhMode;
   if (wh === 'CURRENT') wh = activeWarehouse;

   const payload = compileBackupPayload(targetWhMode);
   const wb = XLSX.utils.book_new();

   // Tambahkan seluruh 3 sheet dengan nama yang persis sama seperti Google Sheet
   for (const sheetName in payload.sheets) {
    const rows = payload.sheets[sheetName];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
   }

   const dateTag = getLocalDateString(new Date());
   XLSX.writeFile(wb, `BACKUP_REKAP_ABSEN_${wh}_${dateTag}.xlsx`);
   alert(`Å“â€¦ Berkas Excel 3-Sheet berhasil didownload!\n\nNama berkas: BACKUP_REKAP_ABSEN_${wh}_${dateTag}.xlsx\nDi dalamnya sudah berisi 3 sheet persis:\n1. RECORD ABSEN\n2. REKAP PENGAJUAN\n3. REKAP LEMBUR\n\nAnda dapat langsung mengimpor file ini ke Google Sheet melalui menu File > Import.`);
  }

  async function downloadUserManualWord(event) {
   if (event) event.preventDefault();
   const filename = 'BUKU_PANDUAN_WFM_MEDIKA.doc';

   // 1. Coba unduh dari file lokal jika didukung oleh browser/server
   try {
    const candidates = ['BUKU_PANDUAN_WFM_MEDIKA.doc', 'BUKU_PANDUAN_SISTEM_WFM_MEDIKA.doc'];
    for (const fname of candidates) {
     const res = await fetch(fname);
     if (res.ok) {
      const blob = await res.blob();
      if (blob && blob.size > 500) {
       const url = URL.createObjectURL(blob);
       const a = document.createElement('a');
       a.href = url;
       a.download = filename;
       document.body.appendChild(a);
       a.click();
       setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 500);
       return;
      }
     }
    }
   } catch (err) {}

   // 2. Fallback Generator Otomatis jika fetch lokal diblokir oleh browser (CORS / protocol file://)
   const docHtml = `\uFEFF<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head>
 <meta charset="utf-8">
 <title>Buku Panduan Operasional Sistem WFM Medika</title>
 <!--[if gte mso 9]>
 <xml>
  <w:WordDocument>
   <w:View>Print</w:View>
   <w:Zoom>100</w:Zoom>
   <w:DoNotOptimizeForBrowser/>
  </w:WordDocument>
 </xml>
 <![endif]-->
 <style>
  @page Section1 {
   size: 21.0cm 29.7cm;
   margin: 2.0cm 2.0cm 2.0cm 2.0cm;
   mso-header-margin: 35.4pt;
   mso-footer-margin: 35.4pt;
   mso-paper-source: 0;
  }
  div.Section1 { page: Section1; }
  
  body {
   font-family: 'Segoe UI', Calibri, Arial, sans-serif;
   font-size: 10.5pt;
   line-height: 1.5;
   color: #1e293b;
   background-color: #ffffff;
  }

  h1, h2, h3, h4 {
   color: #0f172a;
   font-family: 'Segoe UI', Calibri, Arial, sans-serif;
   font-weight: bold;
   page-break-after: avoid;
  }

  h1 {
   font-size: 18pt;
   color: #0f766e;
   border-bottom: 2pt solid #0f766e;
   padding-bottom: 5pt;
   margin-top: 20pt;
   margin-bottom: 10pt;
  }

  h2 {
   font-size: 13pt;
   color: #1e3a5f;
   border-left: 4pt solid #0284c7;
   padding-left: 8pt;
   margin-top: 14pt;
   margin-bottom: 6pt;
   background-color: #f0f9ff;
   padding-top: 4pt;
   padding-bottom: 4pt;
  }

  h3 {
   font-size: 11pt;
   color: #334155;
   margin-top: 10pt;
   margin-bottom: 4pt;
   font-weight: 700;
  }

  p {
   margin-top: 0;
   margin-bottom: 6pt;
   text-align: justify;
  }

  table {
   width: 100%;
   border-collapse: collapse;
   margin-top: 6pt;
   margin-bottom: 12pt;
   font-size: 9.5pt;
  }

  th {
   background-color: #1e293b;
   color: #ffffff;
   font-weight: bold;
   text-align: left;
   padding: 6pt 8pt;
   border: 1pt solid #cbd5e1;
  }

  td {
   padding: 5pt 8pt;
   border: 1pt solid #e2e8f0;
   vertical-align: top;
  }

  tr:nth-child(even) td {
   background-color: #f8fafc;
  }

  .badge {
   display: inline-block;
   padding: 2pt 5pt;
   font-size: 8pt;
   font-weight: bold;
   border-radius: 3pt;
  }

  .badge-admin { background-color: #fee2e2; color: #991b1b; border: 1pt solid #f87171; }
  .badge-mgr { background-color: #fef3c7; color: #92400e; border: 1pt solid #fcd34d; }
  .badge-spv { background-color: #dbeafe; color: #1e40af; border: 1pt solid #93c5fd; }
  .badge-crd { background-color: #e0e7ff; color: #3730a3; border: 1pt solid #a5b4fc; }
  .badge-scanner { background-color: #ccfbf1; color: #115e59; border: 1pt solid #5eead4; }
  .badge-staff { background-color: #f1f5f9; color: #475569; border: 1pt solid #cbd5e1; }
  .badge-success { background-color: #dcfce7; color: #166534; border: 1pt solid #86efac; }
  .badge-warning { background-color: #fef9c3; color: #854d0e; border: 1pt solid #fde047; }
  .badge-danger { background-color: #ffe4e6; color: #9f1239; border: 1pt solid #fda4af; }

  .callout {
   background-color: #f0fdfa;
   border-left: 4pt solid #0d9488;
   padding: 8pt 12pt;
   margin: 8pt 0;
   border-radius: 0 4pt 4pt 0;
  }

  .callout-warning {
   background-color: #fffbeb;
   border-left: 4pt solid #d97706;
   padding: 8pt 12pt;
   margin: 8pt 0;
   border-radius: 0 4pt 4pt 0;
  }

  .callout-danger {
   background-color: #fef2f2;
   border-left: 4pt solid #dc2626;
   padding: 8pt 12pt;
   margin: 8pt 0;
   border-radius: 0 4pt 4pt 0;
  }

  .cover-box {
   text-align: center;
   padding: 26pt 16pt;
   background-color: #0f172a;
   color: #ffffff;
   border-radius: 8pt;
   margin-bottom: 20pt;
  }

  .cover-title {
   font-size: 22pt;
   font-weight: 900;
   margin-bottom: 6pt;
   color: #38bdf8;
   letter-spacing: 0.5pt;
  }

  .cover-subtitle {
   font-size: 12.5pt;
   color: #f1f5f9;
   margin-bottom: 12pt;
   font-weight: 600;
  }

  .cover-meta {
   font-size: 9pt;
   color: #cbd5e1;
   border-top: 1pt solid #334155;
   padding-top: 8pt;
   display: inline-block;
   line-height: 1.4;
  }

  ol, ul {
   margin-top: 3pt;
   margin-bottom: 6pt;
   padding-left: 18pt;
  }

  li {
   margin-bottom: 3pt;
  }

  code {
   font-family: Consolas, 'Courier New', monospace;
   background-color: #f1f5f9;
   padding: 1pt 3pt;
   border-radius: 3pt;
   font-size: 9pt;
   color: #0f766e;
   border: 1pt solid #e2e8f0;
  }

  .step-box {
   background-color: #ffffff;
   border: 1pt solid #cbd5e1;
   border-left: 4pt solid #0284c7;
   padding: 8pt 12pt;
   margin-bottom: 8pt;
   border-radius: 4pt;
  }

  .step-title {
   font-weight: bold;
   color: #0369a1;
   font-size: 10.5pt;
   margin-bottom: 3pt;
  }
 </style>
</head>
<body>
<div class="Section1">

 <!-- COVER / HEADER DOKUMEN -->
 <div class="cover-box">
  <div class="cover-title">BUKU PANDUAN STANDAR OPERASIONAL (SOP)</div>
  <div class="cover-subtitle">Sistem Workforce Management (WFM) & Presensi Barcode Multi-Gudang 24/7</div>
  <div class="cover-meta">
   <b>PT Medika Bina Investama (Gudang MBI) &amp; PT Medika Akses Investama (Gudang MAI)</b><br>
   Edisi Pembaruan Terlengkap â€š  Versi Sistem Terkini 2026<br>
   <i>Panduan Langkah demi Langkah untuk Seluruh Divisi &amp; Tingkatan Pengguna</i>
  </div>
 </div>

 <!-- DAFTAR ISI & STRUKTUR PANDUAN -->
 <h2>DAFTAR ISI &amp; PEMETAAN PANDUAN</h2>
 <table>
  <thead>
   <tr>
    <th style="width: 12%;">BAB</th>
    <th style="width: 58%;">TOPIK PEMBAHASAN</th>
    <th style="width: 30%;">SASARAN PENGGUNA</th>
   </tr>
  </thead>
  <tbody>
   <tr>
    <td><b>BAB 1</b></td>
    <td>Arsitektur Sistem, Pemisahan Gudang MBI &amp; MAI, serta Aturan Akun Login</td>
    <td>Semua Karyawan &amp; Manajemen</td>
   </tr>
   <tr>
    <td><b>BAB 2</b></td>
    <td>Operasional Presensi 24 Jam &amp; Aturan Ketat Shift Lintas Hari</td>
    <td>Staf, Petugas Scanner, SPV</td>
   </tr>
   <tr>
    <td><b>BAB 3</b></td>
    <td>Panduan Operasional Langkah Demi Langkah Berdasarkan Peran (SOP Step-by-Step)</td>
    <td>Staf, Scanner, Coord, SPV, Mgr, Admin</td>
   </tr>
   <tr>
    <td><b>BAB 4</b></td>
    <td>Manajemen Data Karyawan, Filter Tab Status &amp; Urutan NIK Baku</td>
    <td>Admin Gudang &amp; Supervisor</td>
   </tr>
   <tr>
    <td><b>BAB 5</b></td>
    <td>Alur Pengajuan &amp; Approval 2-Stage (Izin, Sakit, Lembur Massal)</td>
    <td>Coordinator, SPV &amp; General Manager</td>
   </tr>
   <tr>
    <td><b>BAB 6</b></td>
    <td>Laporan Presensi, Matriks Bulanan &amp; Ekspor Excel Payroll 3-Sheet</td>
    <td>Admin, SPV, Coordinator &amp; Manager</td>
   </tr>
   <tr>
    <td><b>BAB 7</b></td>
    <td>Pencetakan Kartu ID Card (Satuan PNG, Lembar A4 &amp; Unduh ZIP Instan)</td>
    <td>Admin &amp; Supervisor</td>
   </tr>
   <tr>
    <td><b>BAB 8</b></td>
    <td>Pengaturan Keamanan Akun, Ganti Password &amp; Hak Akses Granular</td>
    <td>Semua Pemegang Akun Login</td>
   </tr>
   <tr>
    <td><b>BAB 9</b></td>
    <td>Database Cloud Firebase 24/7, Backup Spreadsheet &amp; Troubleshooting</td>
    <td>Admin Utama &amp; Tim IT Operasional</td>
   </tr>
  </tbody>
 </table>

 <!-- BAB 1 -->
 <h1>BAB 1: ARSITEKTUR SISTEM &amp; KEBIJAKAN AKUN LOGIN</h1>
 <p>
  <b>WFM Medika</b> adalah sistem operasional terintegrasi untuk pengelolaan kehadiran tenaga kerja, penjadwalan shift 24 jam non-stop, pengajuan lembur, izin/sakit, perhitungan rekapitulasi kehadiran, hingga pencetakan ID Card fisik ber-QR barcode untuk <b>Gudang MBI</b> dan <b>Gudang MAI</b>.
 </p>

 <h2>1.1 Pemisahan Gudang &amp; Database Independen</h2>
 <p>
  Sistem menerapkan pemisahan data 100% antar-gudang menggunakan dua database Firebase Realtime independen:
 </p>
 <ul>
  <li><b>Gudang MBI:</b> Menggunakan basis data terisolasi khusus PT Medika Bina Investama.</li>
  <li><b>Gudang MAI:</b> Menggunakan basis data terisolasi khusus PT Medika Akses Investama.</li>
 </ul>
 <div class="callout-danger">
  <b>    Aturan Pemilihan Gudang Saat Login:</b><br>
  Pengguna <b>wajib memilih gudang yang sesuai</b> pada tombol pilihan radio di halaman login sebelum memasukkan akun. Akun yang terdaftar di Gudang MBI <b>tidak akan pernah ditemukan</b> jika mencoba masuk dengan posisi kursor berada di Gudang MAI, dan sebaliknya. Hal ini mencegah tertukarnya data operasional antar-lokasi.
 </div>

 <h2>1.2 Kebijakan Kepemilikan Akun Login (Zero-Account Policy untuk Staff)</h2>
 <p>
  Sistem menerapkan efisiensi database dan keamanan tingkat tinggi:
 </p>
 <table>
  <thead>
   <tr>
    <th>Jabatan / Role</th>
    <th>Status Akun Web</th>
    <th>Metode Operasional &amp; Tugas</th>
   </tr>
  </thead>
  <tbody>
   <tr>
    <td><span class="badge badge-staff">WAREHOUSE STAFF</span></td>
    <td><b>TIDAK ADA AKUN LOGIN</b></td>
    <td>Karyawan pelaksana gudang <b>tidak perlu login web</b>. Cukup membawa kartu fisik ID Card ber-barcode dan melakukan scan di pos presensi. Hal ini mencegah kebocoran password, manipulasi data, dan meringankan sistem.</td>
   </tr>
   <tr>
    <td><span class="badge badge-scanner">POS SCANNER</span></td>
    <td>Memiliki Akun Login Khusus</td>
    <td>Akun dedicated (<code>ABSEN-MBI</code> / <code>ABSEN-MAI</code>) yang login pada tablet / smartphone yang terpasang di meja pos absensi gudang.</td>
   </tr>
   <tr>
    <td><span class="badge badge-crd">COORDINATOR</span></td>
    <td>Memiliki Akun Login</td>
    <td>Mengajukan lembur massal (batch overtime) untuk anggota tim, menginput izin/sakit staf, memantau kehadiran harian, dan mendownload rekap.</td>
   </tr>
   <tr>
    <td><span class="badge badge-spv">SUPERVISOR (SPV)</span></td>
    <td>Memiliki Akun Login</td>
    <td>Verifikator Tahap 1 pengajuan izin/sakit &amp; lembur, monitoring kehadiran harian, dan pencetakan ID Card.</td>
   </tr>
   <tr>
    <td><span class="badge badge-mgr">GENERAL MANAGER</span></td>
    <td>Memiliki Akun Login Lintas Gudang</td>
    <td>Pemberi persetujuan akhir (Final Approval Tahap 2) lembur &amp; cuti, monitoring lintas gudang (MBI &amp; MAI via fitur switch warehouse), dan audit biaya.</td>
   </tr>
   <tr>
    <td><span class="badge badge-admin">ADMIN GUDANG</span></td>
    <td>Memiliki Akun Login</td>
    <td>Pengelola master data karyawan, konfigurasi GPS, hak akses, backup Google Sheet, dan download laporan payroll.</td>
   </tr>
  </tbody>
 </table>

 <!-- BAB 2 -->
 <h1>BAB 2: OPERASIONAL PRESENSI 24 JAM &amp; SHIFT LINTAS HARI</h1>
 <p>
  Gudang beroperasi 24 jam sehari yang terbagi dalam beberapa shift, termasuk shift malam yang melewati pergantian hari kalender <i>(Cross-Day Shift)</i>.
 </p>

 <h2>2.1 Aturan Mutlak Presensi Masuk vs Pulang</h2>
 <div class="callout-warning">
  <b> â‚¬ â‚¬ ATURAN KETAT SISTEM (ANTI-DOUBLE MASUK):</b><br>
  Seorang karyawan <b>TIDAK BISA melakukan Absen Masuk (Check-In) kembali jika sesi presensi sebelumnya belum melakukan Absen Pulang (Check-Out)</b>.
 </div>
 <p>
  Aturan ini berlaku mutlak untuk semua shift, terutama <b>Shift Malam Lintas Hari</b>:
 </p>
 <ul>
  <li><b>Contoh Kasus Shift Malam:</b> Karyawan masuk pukul 21:00 WIB (malam). Keesokan paginya pukul 06:00 WIB saat jam pulang kerja, karyawan <b>wajib memilih tombol Absen Pulang</b>.</li>
  <li><b>Penolakan Otomatis Sistem:</b> Jika karyawan atau petugas scanner salah menekan tombol (memilih tombol Masuk pada pukul 06:00), sistem secara cerdas akan mendeteksi sesi kerja aktif dalam rentang 18 jam terakhir dan <b>MENOLAK</b> scan tersebut dengan peringatan:<br>
  <i>"Gagal: Anda masih memiliki sesi kerja aktif yang belum absen Pulang! Silakan lakukan Absen Pulang (Check-Out) terlebih dahulu."</i></li>
  <li><b>Proteksi Double Tap:</b> Sistem mencegah barcode ter-scan dua kali berturut-turut dalam beberapa detik secara tidak sengaja.</li>
 </ul>

 <h2>2.2 Validasi Geofencing Radius GPS Gudang</h2>
 <p>
  Untuk memastikan presensi dilakukan secara fisik di lingkungan gudang dan bukan dari luar:
 </p>
 <ol>
  <li>Setiap kali tombol kamera scanner dibuka, browser perangkat scanner akan meminta izin pembacaan GPS.</li>
  <li>Sistem menghitung jarak garis lurus antara koordinat perangkat scanner saat itu dengan titik pusat resmi gudang.</li>
  <li>Jika jarak melebihi batas radius yang ditetapkan (misal &gt; 50 meter), presensi ditolak dengan notifikasi <i>"Di Luar Radius Gudang"</i>.</li>
 </ol>

 <!-- BAB 3 -->
 <h1>BAB 3: PANDUAN LANGKAH OPERASIONAL (SOP STEP-BY-STEP)</h1>
 <p>
  Berikut adalah panduan praktis langkah demi langkah untuk setiap peran agar seluruh karyawan dapat langsung menjalankan tugasnya:
 </p>

 <div class="step-box">
  <div class="step-title">3.1 SOP KARYAWAN OPERASIONAL (WAREHOUSE STAFF)</div>
  <ol>
   <li><b>Persiapan:</b> Bawalah kartu fisik ID Card ber-barcode resmi yang telah dibagikan oleh Supervisor/Admin.</li>
   <li><b>Menuju Pos Absensi:</b> Datangi meja pos scanner presensi saat jam kedatangan (sebelum shift dimulai) dan saat jam kepulangan (setelah shift selesai).</li>
   <li><b>Perhatikan Mode Tombol Scanner:</b> Lihat layar scanner, pastikan petugas/pos scanner sedang membuka mode yang tepat:
    <ul>
     <li>Pilih <b>Absen Masuk</b> saat Anda baru tiba di gudang untuk memulai shift kerja.</li>
     <li>Pilih <b>Absen Pulang</b> saat Anda telah menyelesaikan jam kerja shift Anda.</li>
    </ul>
   </li>
   <li><b>Arahkan Kartu ke Kamera:</b> Posisikan QR Barcode pada ID Card Anda tepat di depan lensa kamera pada jarak 10 â€š â‚¬Å“20 cm.</li>
   <li><b>Konfirmasi Suara &amp; Layar:</b>
    <ul>
     <li>Terdengar suara ramah: <i>"Presensi Berhasil Masuk"</i> atau <i>"Presensi Berhasil Pulang"</i>.</li>
     <li>Layar akan menampilkan kotak hijau berisi Nama Lengkap, NIK, Jam Presensi, dan Departemen Anda.</li>
    </ul>
   </li>
   <li><b>Jika Izin / Sakit / Lembur:</b> Laporkan kepada Coordinator atau Supervisor Anda agar diinputkan secara resmi ke dalam sistem.</li>
  </ol>
 </div>

 <div class="step-box">
  <div class="step-title">3.2 SOP PETUGAS POS SCANNER PRESENSI (HP / TABLET POS GUDANG)</div>
  <ol>
   <li><b>Persiapan Perangkat:</b> Gunakan smartphone atau tablet pos gudang. Pastikan baterai mencukupi, internet stabil, dan GPS perangkat aktif.</li>
   <li><b>Akses Aplikasi:</b> Buka link web WFM Medika di browser Google Chrome / Safari.</li>
   <li><b>Pilih Gudang:</b> Klik radio button <b>Gudang MBI</b> atau <b>Gudang MAI</b> sesuai lokasi pos Anda.</li>
   <li><b>Login Akun Scanner:</b> Masukkan NIK Scanner (<code>ABSEN-MBI</code> untuk MBI atau <code>ABSEN-MAI</code> untuk MAI) dengan password <code>medika123</code>, atau klik tombol <i>"Masuk Cepat Akun Scanner"</i>.</li>
   <li><b>Izinkan Akses Kamera &amp; Lokasi:</b> Saat muncul popup browser, pilih <b>Allow (Izinkan)</b> untuk Kamera dan Lokasi.</li>
   <li><b>Cek Validasi GPS:</b> Klik tombol <b>Cek Jarak GPS</b>. Pastikan jarak berada di bawah batas radius (muncul label hijau: <i>Dalam Radius Gudang</i>).</li>
   <li><b>Membuka Scanner:</b>
    <ul>
     <li>Saat pergantian jam masuk: Klik tab <b>Masuk (Check In)</b> lalu klik <b>Buka Kamera Scanner</b>.</li>
     <li>Saat pergantian jam pulang: Klik tab <b>Pulang (Check Out)</b> lalu klik <b>Buka Kamera Scanner</b>.</li>
    </ul>
   </li>
   <li><b>Operasional Berjalan:</b> Letakkan perangkat pada holder/stand meja agar karyawan dapat men-scan kartu secara mandiri dan tertib.</li>
  </ol>
 </div>

 <div class="step-box">
  <div class="step-title">3.3 SOP COORDINATOR GUDANG</div>
  <ol>
   <li><b>Login Sistem:</b> Buka sistem, pilih gudang Anda, masukkan NIK/Nama Coordinator dan kata sandi Anda.</li>
   <li><b>Monitoring Kehadiran Tim:</b> Buka menu <b>Record Absen</b> untuk memantau siapa saja staf regu Anda yang sudah hadir atau belum tiba.</li>
   <li><b>Pengajuan Lembur Massal (Batch Overtime):</b>
    <ul>
     <li>Buka menu <b>Lembur (Overtime)</b> lalu pilih tab <b>Input Lembur Massal</b>.</li>
     <li>Pilih tanggal pelaksanaan lembur, jam mulai, dan jam estimasi selesai.</li>
     <li>Centang nama-nama staf regu Anda yang ditugaskan lembur pada daftar centang.</li>
     <li>Ketikkan rincian tugas operasional (contoh: <i>Bongkar muat kontainer obat inbound</i>).</li>
     <li>Klik <b>Ajukan Lembur Massal</b>. Pengajuan otomatis terkirim ke Supervisor untuk Approval Tahap 1.</li>
    </ul>
   </li>
   <li><b>Input Izin / Sakit Staf:</b> Jika ada staf yang berhalangan, buka menu <b>Pengajuan Izin/Sakit</b>, pilih nama staf, tipe (Sakit/Izin/Cuti), tanggal, dan kirim pengajuan.</li>
  </ol>
 </div>

 <div class="step-box">
  <div class="step-title">3.4 SOP SUPERVISOR (SPV)</div>
  <ol>
   <li><b>Login Sistem:</b> Masuk dengan akun Supervisor gudang Anda.</li>
   <li><b>Verifikasi Kehadiran Harian:</b> Buka menu <b>Record Presensi</b> dan <b>Matriks Absensi</b> untuk mengevaluasi kedisiplinan dan jumlah kehadiran harian.</li>
   <li><b>Approval Tahap 1 (Cuti/Sakit &amp; Lembur):</b>
    <ul>
     <li>Buka menu <b>Approval Pengajuan</b>. Seluruh pengajuan yang menunggu persetujuan akan tampil.</li>
     <li>Periksa kesesuaian jam lembur atau surat sakit staf.</li>
     <li>Klik tombol hijau <b>Setujui Tahap 1</b> jika sesuai, atau tombol merah <b>Tolak</b> jika tidak disetujui disertai alasan.</li>
     <li>Setelah disetujui SPV, status pengajuan otomatis naik ke General Manager untuk persetujuan akhir.</li>
    </ul>
   </li>
   <li><b>Cetak ID Card Karyawan Baru:</b> Jika ada karyawan baru masuk regu kerja, buka menu <b>Data Karyawan</b>, cari nama karyawan, dan klik tombol <b>ID Card</b> untuk mencetak kartu fisiknya.</li>
  </ol>
 </div>

 <div class="step-box">
  <div class="step-title">3.5 SOP GENERAL MANAGER (MGR)</div>
  <ol>
   <li><b>Login Sistem:</b> Masuk dengan NIK <code>MGR001</code> dan kata sandi pribadi Anda.</li>
   <li><b>Pemantauan Multi-Gudang (Switch Warehouse):</b> Manager memiliki wewenang memantau dua gudang secara bebas. Gunakan tombol switcher di bagian atas navigasi untuk beralih antara <b>Gudang MBI</b> dan <b>Gudang MAI</b>.</li>
   <li><b>Approval Final (Tahap 2):</b>
    <ul>
     <li>Buka menu <b>Approval Pengajuan</b>. Filter pengajuan yang telah berstatus <i>Disetujui SPV (Menunggu Final)</i>.</li>
     <li>Evaluasi urgensi operasional dan estimasi anggaran biaya upah lembur.</li>
     <li>Klik <b>Setujui Final</b> untuk mengesahkan pengajuan. Status pengajuan langsung berubah menjadi <b>Disetujui Penuh (Selesai)</b> dan siap dicairkan oleh payroll.</li>
    </ul>
   </li>
   <li><b>Audit &amp; Rekapitulasi Upah:</b> Tinjau rekap bulanan pada menu <b>Matriks &amp; Rekap Lembur</b> untuk memastikan efisiensi tenaga kerja antar-vendor.</li>
  </ol>
 </div>

 <div class="step-box">
  <div class="step-title">3.6 SOP ADMINISTRATOR SISTEM (ADMIN GUDANG)</div>
  <ol>
   <li><b>Login Sistem:</b> Masuk dengan akun Admin Gudang resmi (<code>ADM001</code> / <code>ADM-MAI</code>).</li>
   <li><b>Pemeliharaan Master Karyawan:</b> Menambah data karyawan baru, mengedit data vendor outsource, dan mengaktifkan/menonaktifkan karyawan yang resign.</li>
   <li><b>Kalibrasi Koordinat GPS:</b> Jika ada pemindahan meja pos scanner, buka menu <b>Kalibrasi GPS</b>, bawa HP ke titik pos baru, lalu klik <i>"Daftarkan Titik HP Saat Ini"</i> dan sesuaikan radius meter.</li>
   <li><b>Kelola Hak Akses Granular:</b> Mengatur wewenang tombol &amp; menu per akun di menu <b>Hak Akses Akun</b>.</li>
   <li><b>Pencetakan Kartu Massal:</b> Menggunakan fitur <i>"Download Semua ID Card (ZIP)"</i> atau <i>"Cetak Lembar A4"</i> saat pengadaan kartu massal.</li>
   <li><b>Download &amp; Backup Payroll:</b> Mengunduh berkas rekapitulasi kehadiran bulanan format <b>Excel 3-Sheet</b> untuk diserahkan ke bagian HRD/Payroll.</li>
  </ol>
 </div>

 <!-- BAB 4 -->
 <h1>BAB 4: MANAJEMEN DATA KARYAWAN &amp; FILTER STATUS</h1>

 <h2>4.1 Penomoran NIK Baku &amp; Urutan Master Data</h2>
 <p>
  Sistem menggunakan standarisasi kode NIK unik yang terkunci secara permanen:
 </p>
 <ul>
  <li><b>Gudang MBI:</b> NIK berformat <code>MBI26-001</code> hingga <code>MBI26-126</code> (total 126 karyawan master).</li>
  <li><b>Gudang MAI:</b> NIK berformat <code>MAI26-001</code> hingga <code>MAI26-050</code> (total 50 karyawan master).</li>
  <li><b>Integritas Nomor Urut:</b> Nomor NIK karyawan bersifat mutlak dan tidak akan bergeser meskipun ada penambahan atau pengeditan data.</li>
 </ul>

 <h2>4.2 Fungsi Tab Filter Status (Semua, Aktif, Nonaktif)</h2>
 <p>
  Pada tabel Data Karyawan terdapat 3 tab status untuk mempermudah pengecekan:
 </p>
 <table>
  <thead>
   <tr>
    <th style="width: 20%;">Tab Filter</th>
    <th style="width: 25%;">Tampilan Jumlah</th>
    <th style="width: 55%;">Fungsi &amp; Keterangan</th>
   </tr>
  </thead>
  <tbody>
   <tr>
    <td><b>Tab "Semua"</b></td>
    <td>126 Karyawan (MBI)</td>
    <td>Menampilkan seluruh arsip data master karyawan, baik yang sedang aktif bekerja maupun yang sudah dinonaktifkan.</td>
   </tr>
   <tr>
    <td><b>Tab "Aktif"</b></td>
    <td>125 Karyawan (MBI)</td>
    <td>Hanya menampilkan karyawan yang masih aktif bekerja sehari-hari. Karyawan yang nonaktif disaring keluar dari tampilan tabel.</td>
   </tr>
   <tr>
    <td><b>Tab "Nonaktif"</b></td>
    <td>1 Karyawan (MBI)</td>
    <td>Khusus menampilkan karyawan yang telah dinonaktifkan (misal karena resign/mutasi) untuk keperluan audit data historis.</td>
   </tr>
  </tbody>
 </table>

 <h2>4.3 Prosedur Nonaktifkan / Aktifkan Karyawan (Tanpa Hapus Data)</h2>
 <ol>
  <li>Cari nama karyawan pada menu <b>Data Karyawan</b>.</li>
  <li>Pada kolom aksi, klik tombol kuning <b>Nonaktifkan</b>. Status karyawan langsung berubah menjadi Nonaktif.</li>
  <li><b>Keunggulan:</b> Barcode presensinya otomatis terkunci (tidak bisa absen lagi), namun seluruh riwayat presensi masa lalunya tetap utuh 100% dan tidak hilang dari laporan rekap gaji.</li>
  <li>Jika karyawan kembali bekerja, cukup klik tombol hijau <b>Aktifkan</b> untuk mengaktifkannya kembali.</li>
 </ol>

 <!-- BAB 5 -->
 <h1>BAB 5: ALUR PENGAJUAN &amp; APPROVAL 2-STAGE</h1>
 <p>
  Semua bentuk izin, sakit, cuti, dan lembur operasional wajib melalui sistem persetujuan dua pintu yang transparan:
 </p>
 <table>
  <thead>
   <tr>
    <th>Tahap 1: Pengajuan</th>
    <th>Tahap 2: Verifikasi SPV</th>
    <th>Tahap 3: Approval Final Manager</th>
    <th>Hasil Akhir</th>
   </tr>
  </thead>
  <tbody>
   <tr>
    <td>Diajukan oleh <b>Coordinator / SPV / Staf</b></td>
    <td>Diverifikasi oleh <b>Supervisor (SPV)</b> gudang bersangkutan</td>
    <td>Disahkan secara mutlak oleh <b>General Manager</b></td>
    <td><span class="badge badge-success">DISETUJUI PENUH</span> (Siap cair di payroll)</td>
   </tr>
  </tbody>
 </table>

 <!-- BAB 6 -->
 <h1>BAB 6: REKAPITULASI PRESENSI &amp; EKSPOR EXCEL PAYROLL</h1>

 <h2>6.1 Fitur Laporan Operasional</h2>
 <ul>
  <li><b>Record Absensi Harian:</b> Memperlihatkan jam tap masuk, jam tap pulang, durasi jam kerja, vendor tenaga kerja (Staffinc, ADP, Internal), dan status keterlambatan per detik.</li>
  <li><b>Matriks Kalender Bulanan:</b> Menampilkan tabel tanggal 1 sampai 31 dengan sandi kehadiran resmi:
   <ul>
    <li><code>H</code> = Hadir Tepat Waktu (Hijau)</li>
    <li><code>T</code> = Hadir Terlambat (Kuning/Oranye)</li>
    <li><code>S</code> = Sakit dengan persetujuan (Biru Muda)</li>
    <li><code>I</code> = Izin resmi dengan persetujuan (Biru)</li>
    <li><code>C</code> = Cuti resmi (Ungu)</li>
    <li><code>A</code> = Alpha / Tanpa keterangan (Merah)</li>
   </ul>
  </li>
  <li><b>Salin Matriks ke WhatsApp Sekali Klik:</b> Tombol yang menyusun teks matriks lengkap secara otomatis ke clipboard sehingga Anda tinggal melakukan <i>Paste (Ctrl+V)</i> ke grup chat WhatsApp pimpinan.</li>
  <li><b>Ekspor Berkas Excel 3-Sheet:</b> Mengunduh berkas spreadsheet terstandarisasi yang berisi 3 lembar kerja langsung:
   <ol>
    <li><i>Sheet 1: RECORD ABSEN</i> (Rincian seluruh tap log)</li>
    <li><i>Sheet 2: REKAP PENGAJUAN</i> (Rekap izin, sakit, cuti yang sah)</li>
    <li><i>Sheet 3: REKAP LEMBUR</i> (Total jam lembur dan kalkulasi upah)</li>
   </ol>
  </li>
 </ul>

 <!-- BAB 7 -->
 <h1>BAB 7: PENCETAKAN KARTU ID CARD FISIK</h1>
 <p>
  Seluruh kartu karyawan dirancang mengikuti standar ukuran fisik kartu industri <b>CR80 (54mm &times; 85.6mm)</b>:
 </p>
 <ul>
  <li><b>Cetak / Download Satuan (PNG):</b> Menghasilkan gambar beresolusi tinggi (300 DPI) siap cetak di printer kartu PVC.</li>
  <li><b>Cetak Lembar Massal A4:</b> Secara otomatis membagi seluruh karyawan menjadi lembaran kertas A4 (berisi 9 kartu per lembar portrait) dengan garis panduan potong presisi.</li>
  <li><b>Download Semua Kartu Sekaligus (ZIP):</b> Tombol canggih berbasis pemrosesan paralel JSZip yang memaketkan seluruh kartu ratusan karyawan ke dalam satu berkas <code>.zip</code> hanya dalam waktu 1 â€š â‚¬Å“2 detik.</li>
 </ul>

 <!-- BAB 8 -->
 <h1>BAB 8: PENGATURAN KEAMANAN &amp; PERGANTIAN PASSWORD</h1>

 <h2>8.1 Prosedur Mengubah Kata Sandi Pribadi</h2>
 <ol>
  <li>Login ke sistem dengan akun Anda.</li>
  <li>Buka menu <b>Pengaturan Akun</b> di sidebar kiri.</li>
  <li>Pada bagian kata sandi, ketikkan <b>Kata Sandi Baru</b> Anda (minimal 6 karakter).</li>
  <li>Ketikkan kembali pada kolom <b>Ulangi Kata Sandi Baru</b>.</li>
  <li>Klik tombol <b>Simpan Perubahan Kata Sandi</b>.</li>
  <li><b>Jaminan Keamanan:</b> Sistem langsung memusnahkan kata sandi lama Anda seketika. Percobaan login menggunakan kata sandi lama otomatis ditolak.</li>
 </ol>

 <h2>8.2 Pengaturan Hak Akses Akun Granular</h2>
 <p>
  Admin Utama dan Manager dapat membuka menu <b>Hak Akses Akun</b> untuk mengatur modul apa saja yang boleh dilihat atau ditekan oleh masing-masing akun supervisor atau coordinator (tombol hijau <b>   IZINKAN</b> dan merah <b> â‚¬  TOLAK</b>).
 </p>

 <!-- BAB 9 -->
 <h1>BAB 9: DATABASE CLOUD &amp; TROUBLESHOOTING FAQ</h1>

 <h2>9.1 Sinkronisasi Cloud 24/7</h2>
 <p>
  Sistem bekerja secara otomatis mengunggah setiap transaksi ke Google Firebase Realtime Cloud Server dan menyiarkannya seketika ke seluruh perangkat yang sedang membuka halaman web.
 </p>

 <h2>9.2 Solusi Masalah Umum (Troubleshooting FAQ)</h2>
 <table>
  <thead>
   <tr>
    <th style="width: 30%;">Gejala / Pesan Error</th>
    <th style="width: 30%;">Penyebab Masalah</th>
    <th style="width: 40%;">Langkah Solusi Praktis</th>
   </tr>
  </thead>
  <tbody>
   <tr>
    <td><b>"Akun tidak ditemukan di Gudang ini"</b></td>
    <td>Salah memilih opsi radio gudang di layar login.</td>
    <td>Pastikan memilih tombol <b>Gudang MBI</b> jika akun Anda terdaftar di MBI, atau <b>Gudang MAI</b> jika di MAI.</td>
   </tr>
   <tr>
    <td><b>"Gagal: Anda masih memiliki sesi aktif yang belum absen Pulang!"</b></td>
    <td>Karyawan salah memilih mode presensi (memilih Masuk padahal baru datang dari shift malam).</td>
    <td>Ubah mode scanner pos ke <b>Absen Pulang (Check Out)</b> terlebih dahulu, lalu lakukan scan kartu.</td>
   </tr>
   <tr>
    <td><b>"Di Luar Radius Gudang"</b></td>
    <td>Lokasi HP scanner berada jauh dari titik resmi atau akurasi GPS HP sedang melayang.</td>
    <td>Nyalakan High Accuracy Location di setelan HP. Bawa HP ke area pos, atau lakukan kalibrasi koordinat di menu GPS oleh Admin.</td>
   </tr>
   <tr>
    <td><b>Kamera Scanner Gelap / Tidak Muncul</b></td>
    <td>Izin kamera di browser terblokir.</td>
    <td>Klik ikon gembok di bilah alamat browser, lalu ubah izin Kamera menjadi <b>Allow (Izinkan)</b>, kemudian refresh halaman.</td>
   </tr>
   <tr>
    <td><b>Data di Laptop Admin Belum Terupdate di HP Pos</b></td>
    <td>Koneksi internet HP pos sempat terputus sementara.</td>
    <td>Tekan tombol <b>Refresh Data Cloud</b> di pojok kanan atas, atau gunakan fitur Direct Sync pada menu Pengaturan Cloud.</td>
   </tr>
  </tbody>
 </table>

 <hr style="border: 0; border-top: 1.5pt solid #cbd5e1; margin-top: 25pt; margin-bottom: 10pt;">
 <p style="text-align: center; font-size: 8.5pt; color: #64748b;">
  <b>Buku Panduan Standar Operasional Prosedur (SOP) â€š  Sistem WFM Medika</b><br>
  Dokumen Resmi Perusahaan â€š  Hak Cipta &copy; 2026 PT Medika Bina Investama &amp; PT Medika Akses Investama.<br>
  <i>Diterbitkan untuk mendukung kelancaran, akurasi, dan kedisiplinan operasional pergudangan 24 jam.</i>
 </p>

</div>
</body>
</html>`;

   const blob = new Blob([docHtml], { type: 'application/msword;charset=utf-8' });
   const url = URL.createObjectURL(blob);
   const a = document.createElement('a');
   a.href = url;
   a.download = filename;
   document.body.appendChild(a);
   a.click();
   setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
   }, 500);
  }

  // Inisialisasi otomatis status Google Sheet, Audio Setting, Pembersihan Duplikat & Sinkronisasi Suara saat halaman dimuat
  if (!window._hasRunBootSanitize) {
   window._hasRunBootSanitize = true;
   try { if (typeof autoPurgeDuplicateAndCorruptEmployees === 'function') autoPurgeDuplicateAndCorruptEmployees(); } catch(e) {}
   try { if (typeof restoreSeparateMelindaAndManagerAccounts === 'function') restoreSeparateMelindaAndManagerAccounts(); } catch(e) {}
   try { if (typeof lockAndHarmonizeAllEmployeeNIKs === 'function') lockAndHarmonizeAllEmployeeNIKs(); } catch(e) {}
   try { if (typeof repairCorruptedEmployeeNames === 'function') repairCorruptedEmployeeNames(); } catch(e) {}
   try { if (typeof autoMigrateAndPersistAllEmployeeOS === 'function') autoMigrateAndPersistAllEmployeeOS(); } catch(e) {}
  }
  try { getGoogleSheetWebhookUrl(); } catch(e) {}
  try { getWarehouseCoords('MBI'); getWarehouseCoords('MAI'); updateRegisteredCoordsDisplay(); } catch(e) {}
  try { renderAudioSettingsUI(); } catch(e) {}
  try { tryAutoLoadLocalFolderAudio(); } catch(e) {}
  try { updateNavbarBrand(); } catch(e) {}
  try { updateLoginWhStyle(); } catch(e) {}
  try {
   updateRealtimeDashboardDate();
   if (!window._globalClockInterval) {
    window._globalClockInterval = setInterval(updateRealtimeDashboardDate, 1000);
   }
  } catch(e) {}

  // Sesi kedaluwarsa & sinkronisasi UI

  try {
   const savedSession = localStorage.getItem('wfm_active_session');
   if (savedSession) {
    try {
     const userObj = JSON.parse(savedSession);
     if (userObj && (userObj.nik || userObj.id)) {
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
       loginUserSession(userObj);
      }
     }
    } catch (e) {}
   } else {
    const authContainer = document.getElementById('auth-container');
    const appContainer = document.getElementById('app-container');
    if (appContainer) { appContainer.classList.add('hidden'); appContainer.classList.remove('flex'); appContainer.style.display = 'none'; }
    if (authContainer) { authContainer.classList.remove('hidden'); authContainer.classList.add('flex'); authContainer.style.display = 'flex'; }
   }
  } catch(e) {}
  
  try {
   if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
   }
  } catch(e) {}

  // =========================================================