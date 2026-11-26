// === WFM MEDIKA REPORTS & ATTENDANCE RECORDS ===
  // FITUR LAPORAN ABSENSI (RECORD + MATRIKS + REKAP JAM & LEMBUR)
  // =========================================================
  function switchReportTab(tabName) {
   const isAdmin = isUserAdmin(currentUser);
   const isManager = isUserManager(currentUser);
   const canRec = isAdmin || isManager || hasPermission('perm_rep_records');
   const canMat = isAdmin || isManager || hasPermission('perm_rep_matrix');
   const canWh = isAdmin || isManager || hasPermission('perm_rep_workhours');
   const canLv = isAdmin || isManager || hasPermission('perm_rep_leaves');
   const canOt = isAdmin || isManager || hasPermission('perm_rep_ot');

   // Auto-fallback jika tab yang dipilih tidak memiliki izin
   if (tabName === 'records' && !canRec) {
    if (canMat) tabName = 'matrix';
    else if (canWh) tabName = 'workhours';
    else if (canLv) tabName = 'leaves';
    else if (canOt) tabName = 'overtime';
   }

   activeReportTab = tabName;
   const isRecord = tabName === 'records' && canRec;
   const isMatrix = tabName === 'matrix' && canMat;
   const isWorkHours = tabName === 'workhours' && canWh;
   const isLeaves = tabName === 'leaves' && canLv;
   const isOvertime = tabName === 'overtime' && canOt;

   document.getElementById('tab-content-records').classList.toggle('hidden', !isRecord);
   document.getElementById('tab-content-matrix').classList.toggle('hidden', !isMatrix);
   const tabWhEl = document.getElementById('tab-content-workhours');
   if (tabWhEl) tabWhEl.classList.toggle('hidden', !isWorkHours);
   document.getElementById('tab-content-report-leaves').classList.toggle('hidden', !isLeaves);
   const tabOtEl = document.getElementById('tab-content-report-overtime');
   if (tabOtEl) tabOtEl.classList.toggle('hidden', !isOvertime);

   const btnRec = document.getElementById('btn-tab-records');
   if (btnRec) {
    btnRec.className = isRecord 
     ? 'px-4 py-2 rounded-xl text-xs font-bold bg-white text-slate-900 shadow-sm transition' 
     : 'px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 transition';
    if (!canRec) btnRec.classList.add('hidden');
   }

   const btnMat = document.getElementById('btn-tab-matrix');
   if (btnMat) {
    btnMat.className = isMatrix 
     ? 'px-4 py-2 rounded-xl text-xs font-bold bg-white text-slate-900 shadow-sm transition' 
     : 'px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 transition';
    if (!canMat) btnMat.classList.add('hidden');
   }

   const btnWhEl = document.getElementById('btn-tab-workhours');
   if (btnWhEl) {
    btnWhEl.className = isWorkHours 
     ? 'px-4 py-2 rounded-xl text-xs font-bold bg-white text-slate-900 shadow-sm transition' 
     : 'px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 transition';
    if (!canWh) btnWhEl.classList.add('hidden');
   }

   const btnLvEl = document.getElementById('btn-tab-report-leaves');
   if (btnLvEl) {
    btnLvEl.className = isLeaves 
     ? 'px-4 py-2 rounded-xl text-xs font-bold bg-white text-slate-900 shadow-sm transition' 
     : 'px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 transition';
    if (!canLv) btnLvEl.classList.add('hidden');
   }

   const btnOtEl = document.getElementById('btn-tab-report-overtime');
   if (btnOtEl) {
    btnOtEl.className = isOvertime 
     ? 'px-4 py-2 rounded-xl text-xs font-bold bg-white text-slate-900 shadow-sm transition' 
     : 'px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 transition';
    if (!canOt) btnOtEl.classList.add('hidden');
   }

   if (isRecord) {
    renderRecordsTable();
    try {
     syncAttendanceLiveDelta(activeWarehouse).then(changed => {
      if (changed) renderRecordsTable();
     });
    } catch(e) {}
   }
   else if (isMatrix) {
    populateMatrixOSDropdown(true);
    renderMatrixTable();
   }
   else if (isWorkHours) renderWorkHoursReport();
   else if (isLeaves) renderReportLeavesTable();
   else if (isOvertime) renderReportOvertimeTable();
   applyRolePermissions();
   if (typeof safeCreateIcons === 'function') safeCreateIcons();
   else if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
  }

  function initWorkHoursDateRange() {
   const startInput = document.getElementById('workhours-start-date');
   const endInput = document.getElementById('workhours-end-date');
   const today = new Date();
   if (endInput && !endInput.value) {
    endInput.value = getLocalDateString(today);
   }
   if (startInput && !startInput.value) {
    const past7 = new Date();
    past7.setDate(past7.getDate() - 6);
    startInput.value = getLocalDateString(past7);
   }
  }

  function calculateWorkHoursData() {
   initWorkHoursDateRange();
   let startStr = document.getElementById('workhours-start-date')?.value || '';
   let endStr = document.getElementById('workhours-end-date')?.value || '';
   if (startStr && endStr && startStr > endStr) {
    const tmp = startStr;
    startStr = endStr;
    endStr = tmp;
    const sInput = document.getElementById('workhours-start-date');
    const eInput = document.getElementById('workhours-end-date');
    if (sInput && eInput) {
     sInput.value = startStr;
     eInput.value = endStr;
    }
   }
   const searchQ = (document.getElementById('workhours-search-input')?.value || '').toLowerCase().trim();

   const users = getWhDB(activeWarehouse, 'users', activeWarehouse === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);
   const regularUsers = users.filter(u => !isManagementSystemAccount(u));
   const attendances = getWhDB(activeWarehouse, 'attendance', []);

   // Standar Depnaker: 40 jam kerja per 7 hari (minggu)
   let targetHours = 40.0;
   if (startStr && endStr) {
    const d1 = parseYMD(startStr);
    const d2 = parseYMD(endStr);
    const diffDays = Math.max(1, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1);
    const weeks = Math.max(1, diffDays / 7);
    targetHours = Math.round(weeks * 40 * 10) / 10;
   }

   const reportData = [];
   let totalActiveEmployees = 0;
   let totalWorkHoursAll = 0;
   let totalMinutesAllEmployees = 0;
   let achievedTargetCount = 0;

   // Optimasi O(N + A): Indexing lookup cepat untuk user dan mapping presensi dalam 1 kali pass
   const nikToEmp = new Map();
   const nameToEmp = new Map();
   const idToEmp = new Map();
   const empAttsMap = new Map();

   regularUsers.forEach(emp => {
    empAttsMap.set(emp, []);
    if (emp.nik) nikToEmp.set(emp.nik.toUpperCase(), emp);
    if (emp.name) nameToEmp.set(cleanStr(emp.name), emp);
    if (emp.id) idToEmp.set(emp.id, emp);
   });

   // Filter tanggal & mapping ke karyawan dalam O(A)
   attendances.forEach(a => {
    if (!a || !a.date) return;
    if ((startStr && a.date < startStr) || (endStr && a.date > endStr)) return;

    const emp = (a.userNik && nikToEmp.get(a.userNik.toUpperCase())) ||
          (a.userName && nameToEmp.get(cleanStr(a.userName))) ||
          (a.userId && idToEmp.get(a.userId));
    if (emp && empAttsMap.has(emp)) {
     empAttsMap.get(emp).push(a);
    }
   });

   regularUsers.forEach(emp => {
    if (searchQ) {
     const matchName = emp.name && emp.name.toLowerCase().includes(searchQ);
     const matchNik = emp.nik && emp.nik.toLowerCase().includes(searchQ);
     const matchDept = emp.dept && emp.dept.toLowerCase().includes(searchQ);
     if (!matchName && !matchNik && !matchDept) return;
    }

    // Ambil Presensi dalam Rentang Tanggal yang sudah di-grouping instan O(1)
    const empAtts = empAttsMap.get(emp) || [];

    // Grouping per tanggal (mengambil in paling awal dan out paling akhir jika ada duplikasi)
    const dateMap = {};
    empAtts.forEach(a => {
     if (!dateMap[a.date]) {
      dateMap[a.date] = { checkInTime: a.checkInTime, checkOutTime: a.checkOutTime, date: a.date, notes: a.notes, status: a.status };
     } else {
      if (a.checkInTime && (!dateMap[a.date].checkInTime || new Date(a.checkInTime) < new Date(dateMap[a.date].checkInTime))) {
       dateMap[a.date].checkInTime = a.checkInTime;
      }
      if (a.checkOutTime && (!dateMap[a.date].checkOutTime || new Date(a.checkOutTime) > new Date(dateMap[a.date].checkOutTime))) {
       dateMap[a.date].checkOutTime = a.checkOutTime;
      }
      if (a.notes && !dateMap[a.date].notes) dateMap[a.date].notes = a.notes;
     }
    });
    const uniqueDates = Object.keys(dateMap);
    const daysPresent = uniqueDates.length;
    if (daysPresent > 0) totalActiveEmployees++;

    let totalEffectiveMinutes = 0;
    uniqueDates.forEach(d => {
     const item = dateMap[d];
     const durInfo = getAttendanceDurationInfo(item);
     totalEffectiveMinutes += durInfo.effectiveMinutes;
    });

    // Hitung Jam & Menit Presisi
    const effectiveHours = Math.floor(totalEffectiveMinutes / 60);
    const effectiveMins = totalEffectiveMinutes % 60;
    const formattedWorkHours = `${effectiveHours} Jam ${effectiveMins} Mnt`;
    const totalEffectiveHours = Math.round((totalEffectiveMinutes / 60) * 10) / 10;

    // Perhitungan Target & Selisih Presisi (Jam & Menit)
    const targetMinutes = Math.round(targetHours * 60);
    const diffMinutes = totalEffectiveMinutes - targetMinutes;
    const diffSign = diffMinutes >= 0 ? '+' : '-';
    const absDiff = Math.abs(diffMinutes);
    const diffHrs = Math.floor(absDiff / 60);
    const diffMins = absDiff % 60;
    const formattedDiff = `${diffSign}${diffHrs} Jam ${diffMins} Mnt`;
    const diffFromTarget = Math.round((diffMinutes / 60) * 10) / 10;
    const isTargetAchieved = totalEffectiveMinutes >= targetMinutes;

    if (daysPresent > 0) {
     totalWorkHoursAll += totalEffectiveHours;
     totalMinutesAllEmployees += totalEffectiveMinutes;
     if (isTargetAchieved) achievedTargetCount++;
    }

    reportData.push({
     nik: emp.nik,
     name: emp.name,
     outsource: emp.outsource || 'Internal',
     dept: (emp.dept || 'STAFF').toUpperCase(),
     daysPresent,
     totalEffectiveMinutes,
     totalEffectiveHours,
     formattedWorkHours,
     targetHours,
     targetMinutes,
     diffMinutes,
     diffFromTarget,
     formattedDiff,
     isTargetAchieved
    });
   });

   const avgMinutes = totalActiveEmployees > 0 
    ? Math.round(totalMinutesAllEmployees / totalActiveEmployees) 
    : 0;
   const formattedAvg = `${Math.floor(avgMinutes / 60)} Jam ${avgMinutes % 60} Mnt`;
   const avgHours = totalActiveEmployees > 0 
    ? Math.round((totalWorkHoursAll / totalActiveEmployees) * 10) / 10 
    : 0;

   return {
    startStr,
    endStr,
    targetHours,
    reportData,
    totalActiveEmployees,
    avgHours,
    avgMinutes,
    formattedAvg,
    achievedTargetCount
   };
  }

  function renderWorkHoursReport() {
   const {
    reportData,
    totalActiveEmployees,
    avgHours,
    formattedAvg,
    achievedTargetCount
   } = calculateWorkHoursData();

   // Update KPI Cards Ringkasan Monitoring Jam Kerja
   const kpiEmp = document.getElementById('kpi-wh-active-emp');
   const kpiAvg = document.getElementById('kpi-wh-avg-hours');
   const kpiAchieved = document.getElementById('kpi-wh-achieved-emp');
   if (kpiEmp) kpiEmp.innerText = `${totalActiveEmployees} Orang`;
   if (kpiAvg) kpiAvg.innerHTML = `<span class="text-sm sm:text-base font-black text-slate-900">${formattedAvg}</span> <span class="text-[10px] font-bold text-slate-500 font-mono">(${avgHours} Jam)</span>`;
   if (kpiAchieved) kpiAchieved.innerText = `${achievedTargetCount} Orang`;

   const tbody = document.getElementById('workhours-table-body');
   if (!tbody) return;
   tbody.innerHTML = '';

   if (reportData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="p-8 text-center text-slate-400 font-medium">Tidak ada data karyawan yang cocok dengan filter pencarian.</td></tr>`;
    return;
   }

   reportData.forEach((row, idx) => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 transition border-b border-slate-100';

    const statusBadge = row.isTargetAchieved
     ? `<span class="px-2 py-1 rounded-lg text-[10px] font-black bg-slate-900 text-white whitespace-nowrap">Tercapai (${row.formattedDiff})</span>`
     : `<span class="px-2 py-1 rounded-lg text-[10px] font-black bg-slate-100 text-slate-800 border border-slate-300 whitespace-nowrap">Kurang (${row.formattedDiff})</span>`;

    tr.innerHTML = `
     <td class="p-3.5 text-center font-mono text-slate-400 font-bold border-r border-slate-100">${idx + 1}</td>
     <td class="p-3.5 font-extrabold text-slate-900 border-r border-slate-100">
      <div class="flex items-center gap-2.5">
       <div class="w-7 h-7 rounded-lg bg-slate-900 text-white font-black text-xs flex items-center justify-center shrink-0">
        ${(row.name || 'K').charAt(0).toUpperCase()}
       </div>
       <span class="truncate">${row.name}</span>
      </div>
     </td>
     <td class="p-3.5 font-mono font-bold text-slate-700 border-r border-slate-100">${row.nik}</td>
     <td class="p-3.5 border-r border-slate-100"><span class="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[11px] font-bold text-slate-800">${row.outsource}</span></td>
     <td class="p-3.5 font-semibold text-slate-600 uppercase text-[11px] border-r border-slate-100">${row.dept}</td>
     <td class="p-3.5 text-center font-bold text-slate-800 border-r border-slate-100 font-mono">${row.daysPresent} Hari</td>
     <td class="p-3.5 text-center font-mono font-black text-slate-900 border-r border-slate-100 bg-slate-50/50">
      <div class="text-xs font-black text-slate-900 font-mono">${row.formattedWorkHours}</div>
      <div class="text-[10px] text-slate-500 font-bold font-mono">(${row.totalEffectiveHours} Jam)</div>
     </td>
     <td class="p-3.5 text-center font-mono text-slate-500 border-r border-slate-100 font-bold">${row.targetHours} Jam</td>
     <td class="p-3.5 text-center font-mono font-bold text-slate-800 border-r border-slate-100">
      <div class="text-xs font-bold font-mono">${row.formattedDiff}</div>
      <div class="text-[10px] font-semibold font-mono text-slate-500">(${row.diffFromTarget >= 0 ? '+' : ''}${row.diffFromTarget} Jam)</div>
     </td>
     <td class="p-3.5 text-center">${statusBadge}</td>
    `;
    tbody.appendChild(tr);
   });
   lucide.createIcons();
  }

  function exportWorkHoursToExcel() {
   if (!hasPermission('perm_rep_download_excel') && !isUserAdmin(currentUser) && !isUserManager(currentUser)) {
    alert('Akses Ditolak: Anda tidak memiliki izin untuk mengunduh laporan ke Excel.');
    return;
   }
   const {
    startStr,
    endStr,
    reportData
   } = calculateWorkHoursData();

   if (reportData.length === 0) {
    alert('Tidak ada data rekap jam kerja untuk diexport.');
    return;
   }

   const rows = [
    [`REKAP MONITORING JAM KERJA KARYAWAN - GUDANG ${activeWarehouse}`],
    [`Periode: ${startStr || 'Awal'} s/d ${endStr || 'Akhir'} • Standar Kerja: 40 Jam / Minggu (Sehari 8 Jam Shift Terhitung 7 Jam Efektif, Potongan 1 Jam Istirahat)`],
    [],
    [
     'No',
     'NIK',
     'Nama Karyawan',
     'Outsourcing',
     'Departemen',
     'Hari Hadir (Hari)',
     'Total Jam Kerja (Jam & Menit)',
     'Total Jam Desimal (Jam)',
     'Target Mingguan (Jam)',
     'Selisih Jam Kerja',
     'Status Capaian Jam'
    ]
   ];

   reportData.forEach((r, idx) => {
    rows.push([
     idx + 1,
     r.nik,
     r.name,
     r.outsource || 'Internal',
     r.dept,
     r.daysPresent,
     r.formattedWorkHours,
     r.totalEffectiveHours,
     r.targetHours,
     r.formattedDiff,
     r.isTargetAchieved ? 'Tercapai (>= Target)' : 'Kurang (< Target)'
    ]);
   });

   const ws = XLSX.utils.aoa_to_sheet(rows);
   ws['!cols'] = [
    { wch: 6 },
    { wch: 14 },
    { wch: 26 },
    { wch: 15 },
    { wch: 15 },
    { wch: 14 },
    { wch: 22 },
    { wch: 18 },
    { wch: 20 },
    { wch: 20 },
    { wch: 22 }
   ];

   const wb = XLSX.utils.book_new();
   XLSX.utils.book_append_sheet(wb, ws, `Rekap_Jam_${activeWarehouse}`);
   XLSX.writeFile(wb, `Rekap_Jam_Kerja_${activeWarehouse}_${startStr || 'Awal'}_sd_${endStr || 'Akhir'}.xlsx`);
  }

  // Alias compatibility
  function renderWorkHoursAndOvertimeReport() {
   renderWorkHoursReport();
  }
  function exportWorkHoursAndOvertimeToExcel() {
   exportWorkHoursToExcel();
  }

  window.selectedReportLeaveIds = window.selectedReportLeaveIds || new Set();

  function handleReportLeaveCheckChange(cb) {
   if (!window.selectedReportLeaveIds) window.selectedReportLeaveIds = new Set();
   if (cb.checked) {
    window.selectedReportLeaveIds.add(cb.value);
   } else {
    window.selectedReportLeaveIds.delete(cb.value);
   }
   updateSelectedReportLeavesCount();
  }

  function toggleSelectAllReportLeaves(isChecked) {
   if (!window.selectedReportLeaveIds) window.selectedReportLeaveIds = new Set();
   const checkboxes = document.querySelectorAll('input[name="report-leaves-row-check"]');
   checkboxes.forEach(cb => {
    cb.checked = isChecked;
    if (isChecked) {
     window.selectedReportLeaveIds.add(cb.value);
    } else {
     window.selectedReportLeaveIds.delete(cb.value);
    }
   });
   updateSelectedReportLeavesCount();
  }

  function updateSelectedReportLeavesCount() {
   if (!window.selectedReportLeaveIds) window.selectedReportLeaveIds = new Set();
   const count = window.selectedReportLeaveIds.size;
   const badge = document.getElementById('count-selected-report-leaves-badge');
   const btnDelete = document.getElementById('btn-delete-selected-report-leaves');
   if (badge) badge.innerText = count;
   if (btnDelete) {
    btnDelete.classList.toggle('opacity-50', count === 0);
    btnDelete.classList.toggle('pointer-events-none', count === 0);
   }
   const masterCheck = document.getElementById('check-all-report-leaves');
   if (masterCheck) {
    const pageCbs = document.querySelectorAll('input[name="report-leaves-row-check"]');
    if (pageCbs.length > 0) {
     masterCheck.checked = Array.from(pageCbs).every(cb => cb.checked);
    } else {
     masterCheck.checked = false;
    }
   }
  }

  async function deleteSelectedReportLeaves() {
   if (!isUserAdmin(currentUser) && !isUserManager(currentUser) && !hasPermission('perm_rep_reset_att')) {
    alert('Akses Ditolak: Anda tidak memiliki izin Admin untuk menghapus data pengajuan.');
    return;
   }
   if (!window.selectedReportLeaveIds || window.selectedReportLeaveIds.size === 0) {
    alert('Pilih minimal 1 data pengajuan dengan mencentang kotak di tabel.');
    return;
   }
   const count = window.selectedReportLeaveIds.size;
   if (!confirm(`Å¡  PERINGATAN HAPUS MASAL:\nApakah Anda yakin ingin MENGHAPUS ${count} data pengajuan terpilih secara permanen?\n\nData yang dihapus akan dibersihkan dari penyimpanan lokal, Cloud Database (Firebase), dan Google Spreadsheet.`)) {
    return;
   }

   const selectedIds = Array.from(window.selectedReportLeaveIds);

   // Catat tombstone agar tidak pernah bangkit lagi
   trackDeletedLeaves(selectedIds);

   // Filter dari kedua gudang lokal
   const remainingMbi = [];
   const remainingMai = [];
   ['MBI', 'MAI'].forEach(wh => {
    let list = getWhDB(wh, 'leaves', []);
    const filtered = list.filter(lv => {
     if (!lv) return false;
     const k1 = lv.id;
     const k2 = `${(lv.userNik || '').toUpperCase()}_${lv.startDate || ''}_${lv.type || ''}`.toLowerCase();
     if ((k1 && selectedIds.includes(k1)) || (k2 && selectedIds.includes(k2)) || isLeaveMarkedDeleted(lv)) {
      return false;
     }
     return true;
    });
    setWhDB(wh, 'leaves', filtered);
    if (wh === 'MBI') remainingMbi.push(...filtered);
    else remainingMai.push(...filtered);
   });

   // Sinkronkan ke Cloud Firestore
   await saveFullDatabaseToCloud(false, true, true);

   if (typeof triggerGoogleSheetAutoSync === 'function') {
    triggerGoogleSheetAutoSync(true);
   }
   try { if (typeof BroadcastChannel !== 'undefined') new BroadcastChannel('wfm_firebase_live_sync').postMessage('update'); } catch(e) {}

   window.selectedReportLeaveIds.clear();
   updateSelectedReportLeavesCount();
   renderReportLeavesTable();
   if (typeof renderLeavesTable === 'function') renderLeavesTable();
   refreshAllDashboardData();
   alert(`Å“â€¦ Berhasil menghapus ${count} data pengajuan secara permanen dari sistem dan Cloud.`);
  }

  function renderReportLeavesTable() {
   const startStr = document.getElementById('report-leave-start')?.value || '';
   const endStr = document.getElementById('report-leave-end')?.value || '';
   const typeFilter = document.getElementById('report-leave-type-filter')?.value || '';
   const statusFilter = document.getElementById('report-leave-status-filter')?.value || '';
   const searchQ = (document.getElementById('report-leave-search')?.value || '').toLowerCase().trim();

   const users = getWhDB(activeWarehouse, 'users', activeWarehouse === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);
   const rawLeaves = getWhDB(activeWarehouse, 'leaves', activeWarehouse === 'MBI' ? SEED_MBI_LEAVES : []);
   const leaves = Array.isArray(rawLeaves) ? rawLeaves.filter(lv => lv && typeof lv === 'object') : [];

   const filtered = leaves.filter(lv => {
    if (!lv) return false;
    const inDate = (!startStr || lv.startDate >= startStr || lv.endDate >= startStr) && (!endStr || lv.startDate <= endStr || lv.endDate <= endStr);
    const inType = !typeFilter || lv.type === typeFilter;
    const inStatus = !statusFilter || lv.status === statusFilter;
    const inSearch = !searchQ || (lv.userName && lv.userName.toLowerCase().includes(searchQ)) || (lv.userNik && lv.userNik.toLowerCase().includes(searchQ)) || (lv.reason && lv.reason.toLowerCase().includes(searchQ));
    return inDate && inType && inStatus && inSearch;
   });

   const tbody = document.getElementById('report-leaves-table-body');
   if (!tbody) return;
   tbody.innerHTML = '';

   if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="p-6 text-center text-slate-400 font-medium">Tidak ada data pengajuan pada filter ini.</td></tr>`;
    updateSelectedReportLeavesCount();
    return;
   }

   filtered.forEach((lv, idx) => {
    const emp = users.find(u => (u.nik && u.nik.toUpperCase() === (lv.userNik || '').toUpperCase()) || (cleanStr(u.name) === cleanStr(lv.userName)));
    const osVal = emp ? (emp.outsource || 'Internal') : (lv.outsource || 'Internal');
    const leaveId = lv.id || `${(lv.userNik || '').toUpperCase()}_${lv.startDate || ''}_${lv.type || ''}`.toLowerCase();
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 transition border-b border-slate-100';

    let typeBadge = '';
    if (lv.type === 'sakit') typeBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200 uppercase">Sakit</span>';
    else if (lv.type === 'izin') typeBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200 uppercase">Izin</span>';
    else typeBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-200 uppercase">Cuti</span>';

    let statusBadge = '';
    if (lv.status === 'approved') statusBadge = '<span class="px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-slate-900 text-white">DISETUJUI</span>';
    else if (lv.status === 'rejected') statusBadge = '<span class="px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-slate-100 text-slate-700 border border-slate-300">DITOLAK</span>';
    else if (lv.status === 'pending_manager') statusBadge = '<span class="px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">MENUNGGU MANAGER</span>';
    else statusBadge = '<span class="px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-slate-200 text-slate-800 border border-slate-300">MENUNGGU SPV</span>';

    const isChecked = window.selectedReportLeaveIds && window.selectedReportLeaveIds.has(leaveId);

    tr.innerHTML = `
     <td class="p-3 text-center border-r border-slate-100">
      <input type="checkbox" name="report-leaves-row-check" value="${leaveId}" ${isChecked ? 'checked' : ''} onchange="handleReportLeaveCheckChange(this)" onclick="event.stopPropagation()" class="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300 cursor-pointer">
     </td>
     <td class="p-3.5 border-r border-slate-100 font-mono text-slate-500 font-bold">${idx + 1}</td>
     <td class="p-3.5 border-r border-slate-100 font-bold text-slate-900">${lv.userName}</td>
     <td class="p-3.5 border-r border-slate-100 font-mono text-slate-700">${lv.userNik}</td>
     <td class="p-3.5 border-r border-slate-100"><span class="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[11px] font-bold text-slate-800">${osVal}</span></td>
     <td class="p-3.5 border-r border-slate-100 uppercase font-mono text-[11px] text-slate-600">${emp ? emp.dept : '-'}</td>
     <td class="p-3.5 border-r border-slate-100">${typeBadge}</td>
     <td class="p-3.5 border-r border-slate-100 font-mono text-slate-800">${lv.startDate} s/d ${lv.endDate}</td>
     <td class="p-3.5 border-r border-slate-100 text-slate-700 max-w-xs truncate">${lv.reason}</td>
     <td class="p-3.5 text-center">${statusBadge}</td>
    `;
    tbody.appendChild(tr);
   });
  }

  function exportReportLeavesToExcel() {
   if (!hasPermission('perm_rep_download_excel') && !isUserAdmin(currentUser) && !isUserManager(currentUser)) {
    alert('Akses Ditolak: Anda tidak memiliki izin untuk mengunduh laporan ke Excel.');
    return;
   }
   const startStr = document.getElementById('report-leave-start')?.value || '';
   const endStr = document.getElementById('report-leave-end')?.value || '';
   const typeFilter = document.getElementById('report-leave-type-filter')?.value || '';
   const statusFilter = document.getElementById('report-leave-status-filter')?.value || '';
   const searchQ = (document.getElementById('report-leave-search')?.value || '').toLowerCase().trim();

   const users = getWhDB(activeWarehouse, 'users', activeWarehouse === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);
   const leaves = getWhDB(activeWarehouse, 'leaves', activeWarehouse === 'MBI' ? SEED_MBI_LEAVES : []);

   const filtered = leaves.filter(lv => {
    const inDate = (!startStr || lv.startDate >= startStr || lv.endDate >= startStr) && (!endStr || lv.startDate <= endStr || lv.endDate <= endStr);
    const inType = !typeFilter || lv.type === typeFilter;
    const inStatus = !statusFilter || lv.status === statusFilter;
    const inSearch = !searchQ || (lv.userName && lv.userName.toLowerCase().includes(searchQ)) || (lv.userNik && lv.userNik.toLowerCase().includes(searchQ)) || (lv.reason && lv.reason.toLowerCase().includes(searchQ));
    return inDate && inType && inStatus && inSearch;
   });

   // Urutkan tanggal pengajuan terbaru di atas
   filtered.sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));

   const rows = filtered.map((lv, i) => {
    const emp = users.find(u => (u.nik && u.nik.toUpperCase() === (lv.userNik || '').toUpperCase()) || (cleanStr(u.name) === cleanStr(lv.userName)));
    const osVal = emp ? (emp.outsource || 'Internal') : (lv.outsource || 'Internal');
    let statusLabel = 'Menunggu SPV';
    if (lv.status === 'approved') statusLabel = 'Disetujui';
    else if (lv.status === 'rejected') statusLabel = 'Ditolak';
    else if (lv.status === 'pending_manager') statusLabel = 'Menunggu Manager';

    return {
     "No": i + 1,
     "Nama Karyawan": lv.userName,
     "NIK": lv.userNik,
     "Outsourcing": osVal,
     "Departemen": emp ? emp.dept : '',
     "Jenis Pengajuan": lv.type.toUpperCase(),
     "Dari Tanggal": lv.startDate,
     "Sampai Tanggal": lv.endDate,
     "Alasan": lv.reason,
     "Status": statusLabel,
     "Gudang": activeWarehouse
    };
   });

   const ws = XLSX.utils.json_to_sheet(rows);
   const wb = XLSX.utils.book_new();
   XLSX.utils.book_append_sheet(wb, ws, `Rekap_Pengajuan_${activeWarehouse}`);
   XLSX.writeFile(wb, `Rekap_Pengajuan_${activeWarehouse}_${startStr || 'all'}_sd_${endStr || 'all'}.xlsx`);
  }

  window.selectedReportOtIds = window.selectedReportOtIds || new Set();

  function handleReportOtCheckChange(cb) {
   if (!window.selectedReportOtIds) window.selectedReportOtIds = new Set();
   if (cb.checked) {
    window.selectedReportOtIds.add(cb.value);
   } else {
    window.selectedReportOtIds.delete(cb.value);
   }
   updateSelectedReportOvertimeCount();
  }

  function toggleSelectAllReportOvertime(isChecked) {
   if (!window.selectedReportOtIds) window.selectedReportOtIds = new Set();
   const checkboxes = document.querySelectorAll('input[name="report-ot-row-check"]');
   checkboxes.forEach(cb => {
    cb.checked = isChecked;
    if (isChecked) {
     window.selectedReportOtIds.add(cb.value);
    } else {
     window.selectedReportOtIds.delete(cb.value);
    }
   });
   updateSelectedReportOvertimeCount();
  }

  function updateSelectedReportOvertimeCount() {
   if (!window.selectedReportOtIds) window.selectedReportOtIds = new Set();
   const count = window.selectedReportOtIds.size;
   const badge = document.getElementById('count-selected-report-ot-badge');
   const btnDelete = document.getElementById('btn-delete-selected-report-ot');
   if (badge) badge.innerText = count;
   if (btnDelete) {
    btnDelete.classList.toggle('opacity-50', count === 0);
    btnDelete.classList.toggle('pointer-events-none', count === 0);
   }
   const masterCheck = document.getElementById('check-all-report-ot');
   if (masterCheck) {
    const pageCbs = document.querySelectorAll('input[name="report-ot-row-check"]');
    if (pageCbs.length > 0) {
     masterCheck.checked = Array.from(pageCbs).every(cb => cb.checked);
    } else {
     masterCheck.checked = false;
    }
   }
  }

  async function deleteSelectedReportOvertime() {
   if (!isUserAdmin(currentUser) && !isUserManager(currentUser) && !hasPermission('perm_rep_reset_att')) {
    alert('Akses Ditolak: Anda tidak memiliki izin Admin untuk menghapus data lembur.');
    return;
   }
   if (!window.selectedReportOtIds || window.selectedReportOtIds.size === 0) {
    alert('Pilih minimal 1 data lembur dengan mencentang kotak di tabel.');
    return;
   }
   const count = window.selectedReportOtIds.size;
   if (!confirm(`Å¡  PERINGATAN HAPUS MASAL:\nApakah Anda yakin ingin MENGHAPUS ${count} data lembur terpilih secara permanen?\n\nData yang dihapus akan dibersihkan dari penyimpanan lokal, Cloud Database (Firebase), dan Google Spreadsheet.`)) {
    return;
   }

   const selectedIds = Array.from(window.selectedReportOtIds);

   // Catat tombstone agar tidak pernah bangkit lagi
   trackDeletedOvertime(selectedIds);

   // Filter dari kedua gudang lokal
   const remainingMbi = [];
   const remainingMai = [];
   ['MBI', 'MAI'].forEach(wh => {
    let list = getWhDB(wh, 'overtime', []);
    const filtered = list.filter(o => {
     if (!o) return false;
     const k1 = o.id;
     const k2 = `${(o.userNik || '').toUpperCase()}_${o.date || ''}_${o.startTime || ''}`.toLowerCase();
     if ((k1 && selectedIds.includes(k1)) || (k2 && selectedIds.includes(k2)) || isOvertimeMarkedDeleted(o)) {
      return false;
     }
     return true;
    });
    setWhDB(wh, 'overtime', filtered);
    if (wh === 'MBI') remainingMbi.push(...filtered);
    else remainingMai.push(...filtered);
   });

   // Sinkronkan ke Cloud Firestore
   await saveFullDatabaseToCloud(false, true, true);

   if (typeof triggerGoogleSheetAutoSync === 'function') {
    triggerGoogleSheetAutoSync(true);
   }
   try { if (typeof BroadcastChannel !== 'undefined') new BroadcastChannel('wfm_firebase_live_sync').postMessage('update'); } catch(e) {}

   window.selectedReportOtIds.clear();
   updateSelectedReportOvertimeCount();
   renderReportOvertimeTable();
   if (typeof renderOvertimeTable === 'function') renderOvertimeTable();
   refreshAllDashboardData();
   alert(`Å“â€¦ Berhasil menghapus ${count} data lembur secara permanen dari sistem dan Cloud.`);
  }

  function renderReportOvertimeTable() {
   const startStr = document.getElementById('report-ot-start')?.value || '';
   const endStr = document.getElementById('report-ot-end')?.value || '';
   const statusFilter = document.getElementById('report-ot-status-filter')?.value || '';
   const searchQ = (document.getElementById('report-ot-search')?.value || '').toLowerCase().trim();

   const rawOvertimes = getWhDB(activeWarehouse, 'overtime', activeWarehouse === 'MBI' ? SEED_MBI_OVERTIMES : []);
   const overtimes = Array.isArray(rawOvertimes) ? rawOvertimes.filter(o => o && typeof o === 'object') : [];
   const filtered = overtimes.filter(o => {
    if (!o) return false;
    const inDate = (!startStr || o.date >= startStr) && (!endStr || o.date <= endStr);
    const inStatus = !statusFilter || o.status === statusFilter;
    const inSearch = !searchQ || (o.userName && o.userName.toLowerCase().includes(searchQ)) || (o.userNik && o.userNik.toLowerCase().includes(searchQ)) || (o.dept && o.dept.toLowerCase().includes(searchQ));
    return inDate && inStatus && inSearch;
   });

   // Urutkan lembur: Tanggal terbaru di atas, lalu jam mulai
   filtered.sort((a, b) => {
    if (!a || !b) return 0;
    if (a.date !== b.date) return (b.date || '').localeCompare(a.date || '');
    return (a.startTime || '').localeCompare(b.startTime || '');
   });

   let totalNominal = 0;
   filtered.forEach(o => {
    if (o.status === 'approved' || !statusFilter) {
     totalNominal += (o.nominal || 0);
    }
   });

   const badge = document.getElementById('report-ot-total-nominal-badge');
   if (badge) {
    badge.innerText = `Total Estimasi Biaya: Rp ${totalNominal.toLocaleString('id-ID')} (${filtered.length} Data)`;
   }

   const tbody = document.getElementById('report-overtime-table-body');
   if (!tbody) return;
   tbody.innerHTML = '';

   if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="13" class="p-6 text-center text-slate-400 font-medium">Tidak ada data lembur pada filter periode ini.</td></tr>`;
    updateSelectedReportOvertimeCount();
    return;
   }

   const users = getWhDB(activeWarehouse, 'users', activeWarehouse === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);

   filtered.forEach((ot, idx) => {
    const emp = users.find(u => (u.nik && u.nik.toUpperCase() === (ot.userNik || '').toUpperCase()) || (cleanStr(u.name) === cleanStr(ot.userName)));
    const osVal = emp ? (emp.outsource || 'Internal') : (ot.outsource || 'Internal');
    const otId = ot.id || `${(ot.userNik || '').toUpperCase()}_${ot.date || ''}_${ot.startTime || ''}`.toLowerCase();
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 transition border-b border-slate-100';

    let statusBadge = '';
    if (ot.status === 'approved') statusBadge = '<span class="px-2.5 py-0.5 rounded text-[10px] font-bold bg-slate-900 text-white">DISETUJUI</span>';
    else if (ot.status === 'rejected') statusBadge = '<span class="px-2.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">DITOLAK</span>';
    else if (ot.status === 'pending_manager') statusBadge = '<span class="px-2.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">MENUNGGU MANAGER</span>';
    else statusBadge = '<span class="px-2.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-800 border border-slate-300">MENUNGGU SPV</span>';

    const isChecked = window.selectedReportOtIds && window.selectedReportOtIds.has(otId);

    tr.innerHTML = `
     <td class="p-3 text-center border-r border-slate-100">
      <input type="checkbox" name="report-ot-row-check" value="${otId}" ${isChecked ? 'checked' : ''} onchange="handleReportOtCheckChange(this)" onclick="event.stopPropagation()" class="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300 cursor-pointer">
     </td>
     <td class="p-3.5 border-r border-slate-100 font-mono text-slate-500 font-bold">${idx + 1}</td>
     <td class="p-3.5 border-r border-slate-100 font-bold text-slate-900">${ot.date}</td>
     <td class="p-3.5 border-r border-slate-100 font-mono text-slate-700">${ot.userNik}</td>
     <td class="p-3.5 border-r border-slate-100 font-bold text-slate-900">${ot.userName}</td>
     <td class="p-3.5 border-r border-slate-100"><span class="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[11px] font-bold text-slate-800">${osVal}</span></td>
     <td class="p-3.5 border-r border-slate-100 uppercase font-mono text-[11px] text-slate-600">${ot.dept || (emp ? emp.dept : '-')}</td>
     <td class="p-3.5 border-r border-slate-100 font-medium text-slate-700">${ot.dayType === 'hari_libur' ? '<span class="text-slate-900 font-bold">Hari Libur</span>' : 'Hari Kerja'}</td>
     <td class="p-3.5 border-r border-slate-100 font-mono font-bold">${ot.startTime} - ${ot.endTime}<br><span class="font-normal text-[10px] text-slate-500">(${ot.totalHours} Jam)</span></td>
     <td class="p-3.5 border-r border-slate-100 font-mono font-bold text-slate-800">${ot.effectiveHours} Jam</td>
     <td class="p-3.5 border-r border-slate-100 font-mono font-black text-slate-900">Rp ${(ot.nominal || 0).toLocaleString('id-ID')}</td>
     <td class="p-3.5 border-r border-slate-100 text-slate-600 max-w-xs truncate">${ot.reason}</td>
     <td class="p-3.5 text-center">${statusBadge}</td>
    `;
    tbody.appendChild(tr);
   });
  }

  function exportReportOvertimeToExcel() {
   const startStr = document.getElementById('report-ot-start')?.value || '';
   const endStr = document.getElementById('report-ot-end')?.value || '';
   const statusFilter = document.getElementById('report-ot-status-filter')?.value || '';
   const searchQ = (document.getElementById('report-ot-search')?.value || '').toLowerCase().trim();

   const users = getWhDB(activeWarehouse, 'users', activeWarehouse === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);
   const overtimes = getWhDB(activeWarehouse, 'overtime', activeWarehouse === 'MBI' ? SEED_MBI_OVERTIMES : []);
   const filtered = overtimes.filter(o => {
    const inDate = (!startStr || o.date >= startStr) && (!endStr || o.date <= endStr);
    const inStatus = !statusFilter || o.status === statusFilter;
    const inSearch = !searchQ || (o.userName && o.userName.toLowerCase().includes(searchQ)) || (o.userNik && o.userNik.toLowerCase().includes(searchQ)) || (o.dept && o.dept.toLowerCase().includes(searchQ));
    return inDate && inStatus && inSearch;
   });

   if (filtered.length === 0) {
    alert('Tidak ada data lembur yang sesuai dengan filter untuk diekspor.');
    return;
   }

   // Urutkan lembur: Tanggal terbaru di atas, lalu jam mulai
   filtered.sort((a, b) => {
    if (a.date !== b.date) return (b.date || '').localeCompare(a.date || '');
    return (a.startTime || '').localeCompare(b.startTime || '');
   });

   const rows = filtered.map((r, i) => {
    const emp = users.find(u => (u.nik && u.nik.toUpperCase() === (r.userNik || '').toUpperCase()) || (cleanStr(u.name) === cleanStr(r.userName)));
    const osVal = emp ? (emp.outsource || 'Internal') : (r.outsource || 'Internal');
    let statusLabel = 'Menunggu SPV';
    if (r.status === 'approved') statusLabel = 'Disetujui';
    else if (r.status === 'rejected') statusLabel = 'Ditolak';
    else if (r.status === 'pending_manager') statusLabel = 'Menunggu Manager';

    return {
     "No": i + 1,
     "Tanggal": r.date,
     "NIK": r.userNik,
     "Nama Karyawan": r.userName,
     "Outsourcing": osVal,
     "Departemen": r.dept || (emp ? emp.dept : ''),
     "Kategori Hari": r.dayType === 'hari_libur' ? 'Hari Libur' : 'Hari Kerja',
     "Jam Mulai": r.startTime,
     "Jam Selesai": r.endTime,
     "Total Jam": r.totalHours,
     "Jam Kerja Efektif": r.effectiveHours,
     "Upah Lembur (Rp)": r.nominal || 0,
     "Alasan Lembur": r.reason || '',
     "Status Approval": statusLabel,
     "Gudang": activeWarehouse
    };
   });

   const ws = XLSX.utils.json_to_sheet(rows);
   const wb = XLSX.utils.book_new();
   XLSX.utils.book_append_sheet(wb, ws, `Rekap_Lembur_${activeWarehouse}`);
   XLSX.writeFile(wb, `Rekap_Lembur_Karyawan_${activeWarehouse}_${startStr || 'all'}_sd_${endStr || 'all'}.xlsx`);
  }

  function exportOvertimeToExcel() {
   exportReportOvertimeToExcel();
  }

  // =========================================================
  // STATE PAGINASI RECORD ABSENSI (RINGAN, CEPAT & JANGKA PANJANG)
  // =========================================================
  let recordsCurrentPage = 1;
  let recordsPageSize = 50;

  function changeRecordsPageSize(val) {
   recordsPageSize = val === 'all' ? 999999 : parseInt(val, 10);
   recordsCurrentPage = 1;
   renderRecordsTable();
  }

  function setRecordsPage(page) {
   recordsCurrentPage = page;
   renderRecordsTable();
  }

  function setRecordFilterQuick(mode) {
   const sInput = document.getElementById('record-start-date');
   const eInput = document.getElementById('record-end-date');
   const now = new Date();
   const realToday = getLocalDateString(now);
   const opToday = getOperationalDateString(now);
   if (!sInput || !eInput) return;

   if (mode === 'today') {
    sInput.value = opToday < realToday ? opToday : realToday;
    eInput.value = realToday;
   } else if (mode === 'month') {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    sInput.value = `${y}-${m}-01`;
    eInput.value = realToday;
   } else if (mode === 'all') {
    sInput.value = '';
    eInput.value = '';
   }
   renderRecordsTable(true);
  }

  function renderRecordsTable(resetPage = false) {
   lastRecordsRenderTime = Date.now();
   if (resetPage) recordsCurrentPage = 1;
   let startStr = document.getElementById('record-start-date')?.value || '';
   let endStr = document.getElementById('record-end-date')?.value || '';
   
   // Auto-swap jika tanggal terbalik (start > end) agar data TIDAK HILANG
   if (startStr && endStr && startStr > endStr) {
    const tmp = startStr;
    startStr = endStr;
    endStr = tmp;
    const sInput = document.getElementById('record-start-date');
    const eInput = document.getElementById('record-end-date');
    if (sInput && eInput) {
     sInput.value = startStr;
     eInput.value = endStr;
    }
   }

   const currentWh = (activeWarehouse || (currentUser && currentUser.warehouse) || 'MBI').toUpperCase();

   // SINKRONISASI OTOMATIS BACKGROUND (TANPA TOMBOL MANUAL):
   // Jika admin membuka tanggal tertentu (misal 2026-11-13), otomatis sedot data resmi dari Cloud
   // dan pastikan Google Sheet langsung tersinkronkan utuh tanpa ada yang hilang
   if (startStr && startStr === endStr && !window[`_autoPulled_${currentWh}_${startStr}`]) {
    window[`_autoPulled_${currentWh}_${startStr}`] = true;
    pullAttendanceFromSupabase(currentWh, startStr).then(() => {
     renderRecordsTable();
     if (typeof triggerGoogleSheetAutoSync === 'function') {
      triggerGoogleSheetAutoSync(true, currentWh);
     }
    });
   }

   const searchQ = (document.getElementById('record-search-input')?.value || '').toLowerCase().trim();
   const sortOrder = document.getElementById('record-sort-order')?.value || 'time_desc';

   const users = getWhDB(currentWh, 'users', currentWh === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);
   const attendances = getWhDB(currentWh, 'attendance', currentWh === 'MBI' ? SEED_MBI_ATTENDANCE : SEED_MAI_ATTENDANCE).map(a => ({ ...a, warehouse: a.warehouse || currentWh }));

   // Mapping O(1) Outsource untuk pencarian instan
   const userOSMap = new Map();
   users.forEach(u => {
    if (!u) return;
    if (u.nik) userOSMap.set(u.nik.toUpperCase(), (u.outsource || 'Internal').toLowerCase());
    if (u.name) userOSMap.set(cleanStr(u.name), (u.outsource || 'Internal').toLowerCase());
    if (u.id) userOSMap.set(u.id, (u.outsource || 'Internal').toLowerCase());
   });

   const filtered = attendances.filter(a => {
    if (!a || isAttendanceMarkedDeleted(a)) return false;
    const checkInLocalDate = a.checkInTime ? getLocalDateString(new Date(a.checkInTime)) : '';
    const inDate = (!startStr || a.date >= startStr || (checkInLocalDate && checkInLocalDate >= startStr)) && 
            (!endStr || a.date <= endStr || (checkInLocalDate && checkInLocalDate <= endStr));
    const uOS = (a.userNik && userOSMap.get(a.userNik.toUpperCase())) ||
          (a.userName && userOSMap.get(cleanStr(a.userName))) ||
          (a.userId && userOSMap.get(a.userId)) ||
          (a.outsource && a.outsource.toLowerCase()) || '';
    const inSearch = !searchQ || 
             (a.userName && a.userName.toLowerCase().includes(searchQ)) || 
             (a.userNik && a.userNik.toLowerCase().includes(searchQ)) ||
             (a.dept && a.dept.toLowerCase().includes(searchQ)) ||
             (a.warehouse && a.warehouse.toLowerCase().includes(searchQ)) ||
             (uOS && uOS.includes(searchQ));
    return inDate && inSearch;
   });

   // Hitung Statistik Mini Dashboard Realtime dari Hasil Filter
   const totalHadir = filtered.length;
   let totalLate = 0;
   let totalNormal = 0;
   let totalMissScan = 0;

   filtered.forEach(a => {
    const checkInDate = new Date(a.checkInTime);
    const minute = checkInDate.getMinutes();
    const isLate = a.checkInStatus === 'late' || (minute >= 1 && minute <= 30);
    if (isLate) totalLate++;
    else totalNormal++;
    if (!a.checkOutTime) {
     const info = getAttendanceDurationInfo(a);
     if (info.isMissScan) totalMissScan++;
    }
   });

   const normalPct = totalHadir > 0 ? Math.round((totalNormal / totalHadir) * 100) : 0;
   const latePct = totalHadir > 0 ? Math.round((totalLate / totalHadir) * 100) : 0;
   const missScanPct = totalHadir > 0 ? Math.round((totalMissScan / totalHadir) * 100) : 0;

   const elMiniTotal = document.getElementById('record-mini-total-hadir');
   const elMiniNormal = document.getElementById('record-mini-absen-normal');
   const elMiniNormalPct = document.getElementById('record-mini-normal-pct');
   const elMiniLate = document.getElementById('record-mini-late-in');
   const elMiniLatePct = document.getElementById('record-mini-late-pct');
   const elMiniMissScan = document.getElementById('record-mini-miss-scan');
   const elMiniMissScanSub = document.getElementById('record-mini-miss-scan-sub');
   const elMiniPeriod = document.getElementById('record-mini-period-label');

   if (elMiniTotal) elMiniTotal.innerText = `${totalHadir}`;
   if (elMiniNormal) elMiniNormal.innerText = `${totalNormal}`;
   if (elMiniNormalPct) elMiniNormalPct.innerText = `${normalPct}% Tepat Waktu`;
   if (elMiniLate) elMiniLate.innerText = `${totalLate}`;
   if (elMiniLatePct) elMiniLatePct.innerText = `${latePct}% Terlambat`;
   if (elMiniMissScan) elMiniMissScan.innerText = `${totalMissScan}`;
   if (elMiniMissScanSub) elMiniMissScanSub.innerText = `${missScanPct}% Belum Tap Pulang`;

   if (elMiniPeriod) {
    if (startStr && endStr) {
     elMiniPeriod.innerText = `${startStr} s/d ${endStr}`;
    } else if (startStr) {
     elMiniPeriod.innerText = `Mulai ${startStr}`;
    } else if (endStr) {
     elMiniPeriod.innerText = `Hingga ${endStr}`;
    } else {
     elMiniPeriod.innerText = `Semua rentang (Gudang ${currentWh})`;
    }
   }

   // PENGURUTAN RAPI & KRONOLOGIS (DEFAULT: WAKTU SCAN MASUK TERBARU DI PALING ATAS):
   filtered.sort((a, b) => {
    if (sortOrder === 'time_desc') {
     if (a.date !== b.date) return (b.date || '').localeCompare(a.date || '');
     const inA = a.checkInTime ? new Date(a.checkInTime).getTime() : 0;
     const inB = b.checkInTime ? new Date(b.checkInTime).getTime() : 0;
     return inB - inA;
    } else if (sortOrder === 'time_asc') {
     if (a.date !== b.date) return (a.date || '').localeCompare(b.date || '');
     const timeA = a.checkInTime ? new Date(a.checkInTime).getTime() : 0;
     const timeB = b.checkInTime ? new Date(b.checkInTime).getTime() : 0;
     return timeA - timeB;
    } else if (sortOrder === 'name_asc') {
     const c = (a.userName || '').localeCompare(b.userName || '');
     if (c !== 0) return c;
     return (b.date || '').localeCompare(a.date || '');
    } else if (sortOrder === 'name_desc') {
     const c = (b.userName || '').localeCompare(a.userName || '');
     if (c !== 0) return c;
     return (b.date || '').localeCompare(a.date || '');
    } else if (sortOrder === 'nik_asc') {
     const c = (a.userNik || '').localeCompare(b.userNik || '', undefined, { numeric: true });
     if (c !== 0) return c;
     return (b.date || '').localeCompare(a.date || '');
    }
    return 0;
   });

   // Hitung Paginasi Responsif
   const totalFiltered = filtered.length;
   const totalPages = recordsPageSize >= 999999 ? 1 : Math.max(1, Math.ceil(totalFiltered / recordsPageSize));
   if (recordsCurrentPage > totalPages) recordsCurrentPage = totalPages;
   if (recordsCurrentPage < 1) recordsCurrentPage = 1;

   const startIndex = (recordsCurrentPage - 1) * (recordsPageSize >= 999999 ? totalFiltered : recordsPageSize);
   const endIndex = recordsPageSize >= 999999 ? totalFiltered : Math.min(startIndex + recordsPageSize, totalFiltered);
   const pageRecords = recordsPageSize >= 999999 ? filtered : filtered.slice(startIndex, endIndex);

   // Update Label & Kontrol Paginasi
   const elPageInfo = document.getElementById('records-page-info');
   const elPageControls = document.getElementById('records-pagination-controls');

   if (elPageInfo) {
    if (totalFiltered === 0) {
     elPageInfo.innerText = 'Menampilkan 0 dari 0 data';
    } else {
     elPageInfo.innerText = `Menampilkan ${startIndex + 1} - ${endIndex} dari ${totalFiltered} data`;
    }
   }

   if (elPageControls) {
    if (totalPages <= 1) {
     elPageControls.innerHTML = '';
    } else {
     let controlsHTML = '';
     const prevDisabled = recordsCurrentPage === 1;
     controlsHTML += `<button onclick="setRecordsPage(${recordsCurrentPage - 1})" ${prevDisabled ? 'disabled' : ''} class="px-2.5 py-1 rounded-lg border text-xs font-semibold ${prevDisabled ? 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed' : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300 shadow-2xs transition'}">Prev</button>`;

     const startP = Math.max(1, recordsCurrentPage - 2);
     const endP = Math.min(totalPages, recordsCurrentPage + 2);

     if (startP > 1) {
      controlsHTML += `<button onclick="setRecordsPage(1)" class="w-7 h-7 rounded-lg border text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border-slate-300 transition">1</button>`;
      if (startP > 2) controlsHTML += `<span class="px-1 text-slate-400">...</span>`;
     }

     for (let p = startP; p <= endP; p++) {
      const isActive = p === recordsCurrentPage;
      controlsHTML += `<button onclick="setRecordsPage(${p})" class="w-7 h-7 rounded-lg border text-xs font-bold ${isActive ? 'bg-slate-900 text-white border-slate-900' : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300 shadow-2xs transition'}">${p}</button>`;
     }

     if (endP < totalPages) {
      if (endP < totalPages - 1) controlsHTML += `<span class="px-1 text-slate-400">...</span>`;
      controlsHTML += `<button onclick="setRecordsPage(${totalPages})" class="w-7 h-7 rounded-lg border text-xs font-semibold bg-white hover:bg-slate-50 text-slate-700 border-slate-300 transition">${totalPages}</button>`;
     }

     const nextDisabled = recordsCurrentPage === totalPages;
     controlsHTML += `<button onclick="setRecordsPage(${recordsCurrentPage + 1})" ${nextDisabled ? 'disabled' : ''} class="px-2.5 py-1 rounded-lg border text-xs font-semibold ${nextDisabled ? 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed' : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300 shadow-2xs transition'}">Next</button>`;

     elPageControls.innerHTML = controlsHTML;
    }
   }

   const tbody = document.getElementById('records-table-body');
   if (!tbody) return;

   if (totalFiltered === 0) {
    tbody.innerHTML = `<tr><td colspan="13" class="p-8 text-center text-xs text-slate-400 font-medium bg-white">Tidak ada record absensi pada rentang tanggal ini.</td></tr>`;
    updateSelectedRecordsCount();
    return;
   }

   // Optimasi O(1) Lookup Karyawan
   const usersByName = new Map();
   const usersByNik = new Map();
   const usersById = new Map();
   users.forEach(u => {
    if (u.name) usersByName.set(cleanStr(u.name), u);
    if (u.nik) usersByNik.set(u.nik.toUpperCase(), u);
    if (u.id) usersById.set(u.id, u);
   });

   const rowsHTML = [];
   pageRecords.forEach((rec, idx) => {
    const globalIdx = startIndex + idx;
    const emp = (rec.userName && usersByName.get(cleanStr(rec.userName))) ||
          (rec.userNik && usersByNik.get(rec.userNik.toUpperCase())) ||
          (rec.userId && usersById.get(rec.userId));

    const finalName = emp ? emp.name : (rec.userName || '-');
    const finalNik = emp ? emp.nik : (rec.userNik || '-');
    const finalOutsource = emp ? (emp.outsource || 'Internal') : (rec.outsource || 'Internal');
    const finalDept = emp ? emp.dept : (rec.dept || '-');
    const recWh = rec.warehouse || (emp ? emp.warehouse : activeWarehouse) || 'MBI';
    const recId = rec.id || getAttendanceCompositeKey(rec);
    
    // Hitung Durasi Jam Kerja & Status Miss Scan (16 jam 25 menit)
    const durInfo = getAttendanceDurationInfo(rec);
    const durationStr = durInfo.durationStr;

    // Status Masuk (Normal / Late In) & Status Pulang (Sudah Pulang / Miss Scan / Sedang Shift)
    const checkInDate = new Date(rec.checkInTime);
    const minute = checkInDate.getMinutes();
    const isLate = rec.checkInStatus === 'late' || (minute >= 1 && minute <= 30);
    
    const lateBadge = isLate 
     ? '<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-800 border border-slate-200 shadow-2xs whitespace-nowrap"><span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span>Late In</span>' 
     : '<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-slate-50 text-slate-800 border border-slate-200 shadow-2xs whitespace-nowrap"><span class="w-1.5 h-1.5 rounded-full bg-slate-900"></span>Normal</span>';
    
    let outBadge = '';
    if (rec.checkOutTime) {
     outBadge = '<span class="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-slate-50 text-slate-700 border border-slate-200 shadow-2xs whitespace-nowrap">Sudah Pulang</span>';
    } else if (durInfo.isMissScan) {
     outBadge = '<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200 shadow-2xs whitespace-nowrap"><span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>Miss Scan</span>';
    } else {
     outBadge = '<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200 shadow-2xs whitespace-nowrap"><span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>Sedang Shift</span>';
    }

    const notesHtml = (rec.notes && rec.notes !== 'Tepat Waktu' && rec.notes !== 'Terlambat' && rec.notes !== '-')
     ? `<div class="text-[10px] text-slate-500 font-medium italic mt-1"><span class="truncate max-w-[200px]">${rec.notes}</span></div>`
     : '';

    const whBadgeClass = recWh === 'MAI' ? 'bg-amber-50 text-amber-900 border-amber-200' : 'bg-sky-50 text-sky-900 border-sky-200';
    const isChecked = window.selectedRecordIds && window.selectedRecordIds.has(recId);

    rowsHTML.push(`
     <tr class="hover:bg-slate-50 transition border-b border-slate-100">
      <td class="p-3 text-center border-r border-slate-100">
       <input type="checkbox" name="record-row-check" value="${recId}" data-wh="${recWh}" ${isChecked ? 'checked' : ''} onchange="handleRecordCheckChange(this)" onclick="event.stopPropagation()" class="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300 cursor-pointer">
      </td>
      <td class="p-3.5 border-r border-slate-100 font-mono text-slate-500 font-bold">${globalIdx + 1}</td>
      <td class="p-3.5 border-r border-slate-100 font-bold text-slate-900 whitespace-nowrap">${rec.date}</td>
      <td class="p-3.5 border-r border-slate-100 text-center whitespace-nowrap">
       <span class="px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${whBadgeClass} font-mono">${recWh}</span>
      </td>
      <td class="p-3.5 border-r border-slate-100 font-mono text-slate-700 font-bold whitespace-nowrap">${finalNik}</td>
      <td class="p-3.5 border-r border-slate-100 font-bold text-slate-900">${finalName}</td>
      <td class="p-3.5 border-r border-slate-100 font-semibold text-slate-700 whitespace-nowrap text-[11px]">${finalOutsource}</td>
      <td class="p-3.5 border-r border-slate-100 uppercase font-mono text-[11px] text-slate-600">${finalDept}</td>
      <td class="p-3.5 border-r border-slate-100 font-mono text-slate-800 font-semibold whitespace-nowrap">${formatDisplayTimeWIB(rec.checkInTime)} WIB</td>
      <td class="p-3.5 border-r border-slate-100 font-mono text-slate-700 whitespace-nowrap">${rec.checkOutTime ? formatDisplayTimeWIB(rec.checkOutTime) + ' WIB' : (durInfo.isMissScan ? '<span class="text-rose-600 font-bold italic text-[11px]">Miss Scan (-)</span>' : '<span class="text-amber-600 font-medium italic text-[11px]">Sedang Shift</span>')}</td>
      <td class="p-3.5 border-r border-slate-100 font-mono font-semibold text-slate-800 whitespace-nowrap">${durInfo.isMissScan ? '<span class="font-bold text-slate-900 font-mono">7 Jam</span> <span class="text-[10px] text-rose-600 font-semibold">(Miss Scan)</span>' : durationStr}</td>
      <td class="p-3.5 border-r border-slate-100">
       <div class="flex flex-col gap-1 items-start">
        <div class="flex items-center gap-1.5 flex-wrap">
         ${lateBadge}
         ${outBadge}
        </div>
        ${notesHtml}
       </div>
      </td>
      <td class="p-3.5 text-right whitespace-nowrap">
       <div class="inline-flex items-center gap-1.5 justify-end">
        <button onclick="openEditAttendanceModal('${rec.id || ''}', '${recWh}')" title="Koreksi Data Absen Ini" class="px-2.5 py-1 text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-[11px] font-bold transition inline-flex items-center gap-1 shadow-2xs">
         <i data-lucide="edit-3" class="w-3 h-3 text-slate-500"></i>
         <span>Koreksi</span>
        </button>
        <button onclick="deleteSingleAttendanceRecord('${rec.id || ''}', '${recWh}')" title="Hapus Record Absen Ini" class="px-2.5 py-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-lg text-[11px] font-semibold transition">
         Hapus
        </button>
       </div>
      </td>
     </tr>
    `);
   });

   tbody.innerHTML = rowsHTML.join('');
   if (typeof safeCreateIcons === 'function') safeCreateIcons({ root: tbody });
   else if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
   updateSelectedRecordsCount();
  }

  window.selectedRecordIds = window.selectedRecordIds || new Set();

  function handleRecordCheckChange(cb) {
   if (!window.selectedRecordIds) window.selectedRecordIds = new Set();
   if (cb.checked) {
    window.selectedRecordIds.add(cb.value);
   } else {
    window.selectedRecordIds.delete(cb.value);
   }
   updateSelectedRecordsCount();
  }

  function toggleSelectAllRecords(isChecked) {
   if (!window.selectedRecordIds) window.selectedRecordIds = new Set();
   const checkboxes = document.querySelectorAll('input[name="record-row-check"]');
   checkboxes.forEach(cb => {
    cb.checked = isChecked;
    if (isChecked) {
     window.selectedRecordIds.add(cb.value);
    } else {
     window.selectedRecordIds.delete(cb.value);
    }
   });
   updateSelectedRecordsCount();
  }

  function updateSelectedRecordsCount() {
   if (!window.selectedRecordIds) window.selectedRecordIds = new Set();
   const count = window.selectedRecordIds.size;
   const badge = document.getElementById('count-selected-records-badge');
   const btnDelete = document.getElementById('btn-delete-selected-records');
   if (badge) badge.innerText = count;
   if (btnDelete) {
    btnDelete.classList.toggle('opacity-50', count === 0);
    btnDelete.classList.toggle('pointer-events-none', count === 0);
   }
   const masterCheck = document.getElementById('check-all-records');
   if (masterCheck) {
    const pageCbs = document.querySelectorAll('input[name="record-row-check"]');
    if (pageCbs.length > 0) {
     masterCheck.checked = Array.from(pageCbs).every(cb => cb.checked);
    } else {
     masterCheck.checked = false;
    }
   }
  }

  async function deleteSelectedRecords() {
   if (!isUserAdmin(currentUser) && !isUserManager(currentUser) && !hasPermission('perm_rep_reset_att')) {
    alert('Akses Ditolak: Anda tidak memiliki izin Admin untuk menghapus record absen.');
    return;
   }
   if (!window.selectedRecordIds || window.selectedRecordIds.size === 0) {
    alert('Pilih minimal 1 catatan presensi dengan mencentang kotak di tabel.');
    return;
   }
   const count = window.selectedRecordIds.size;
   if (!confirm(`Å¡  PERINGATAN HAPUS MASAL:\nApakah Anda yakin ingin MENGHAPUS ${count} record presensi terpilih secara permanen?\n\nData yang dihapus akan dibersihkan dari penyimpanan lokal, Cloud Database (Firebase), dan Google Spreadsheet.`)) {
    return;
   }

   const selectedIds = Array.from(window.selectedRecordIds);

   // Catat ke tombstone & kumpulkan semua doc ID Firestore yang terkait
   trackDeletedAttendance(selectedIds);
   const docIdsToDelete = new Set(selectedIds.filter(Boolean).map(String));

   // Filter dari gudang lokal dan cadangan backup + today_attendance serta catat gudang yang benar-benar terhapus
   const touchedDeleteWhs = new Set();
   ['MBI', 'MAI'].forEach(w => {
    const wLower = w.toLowerCase();
    let list = getWhDB(w, 'attendance', []);
    const filtered = list.filter(a => {
     if (!a) return false;
     const kId = a.id ? String(a.id).trim().toLowerCase() : '';
     const kComp = getAttendanceCompositeKey(a);
     if (selectedIds.some(sel => {
      const s = String(sel).trim().toLowerCase();
      return (kId && kId === s) || (kComp && kComp === s);
     })) {
      trackDeletedAttendance(a);
      touchedDeleteWhs.add(w);
      if (a.id) docIdsToDelete.add(String(a.id));
      if (a._firestoreDocId) docIdsToDelete.add(String(a._firestoreDocId));
      return false;
     }
     if (isAttendanceMarkedDeleted(a)) {
      touchedDeleteWhs.add(w);
      if (a.id) docIdsToDelete.add(String(a.id));
      if (a._firestoreDocId) docIdsToDelete.add(String(a._firestoreDocId));
      return false;
     }
     return true;
    });
    setWhDB(w, 'attendance', filtered, true);
    try { localStorage.setItem(`wfm_${wLower}_attendance_backup`, JSON.stringify(filtered)); } catch(eBak) {}
    try {
     const tdRaw = localStorage.getItem(`wfm_${wLower}_today_attendance`);
     if (tdRaw) {
      const tdList = JSON.parse(tdRaw);
      if (Array.isArray(tdList)) {
       localStorage.setItem(`wfm_${wLower}_today_attendance`, JSON.stringify(tdList.filter(a => a && !isAttendanceMarkedDeleted(a))));
      }
     }
    } catch(eTd) {}
   });

   // Hapus dokumen fisik langsung dari Cloud Firestore attendance collection + scrub snapshot hari ini/arsip
   try {
    const delPromises = [];
    docIdsToDelete.forEach(sId => {
     delPromises.push(deleteDocFromFirestore('MBI', 'attendance', sId).catch(() => {}));
     delPromises.push(deleteDocFromFirestore('MAI', 'attendance', sId).catch(() => {}));
    });
    await Promise.allSettled(delPromises);
    await Promise.allSettled([
     scrubDeletedAttendanceFromCloud('MBI'),
     scrubDeletedAttendanceFromCloud('MAI')
    ]);
   } catch(eAttDoc) {}

   // HAPUS FISIK LANGSUNG DARI DATABASE SUPABASE (SSOT UTAMA)
   try {
    if (typeof deleteAttendanceFromSupabase === 'function') {
     await deleteAttendanceFromSupabase(Array.from(docIdsToDelete), touchedDeleteWhs.size === 1 ? Array.from(touchedDeleteWhs)[0] : null);
    }
   } catch(eSbBulk) {
    console.warn('[Supabase] Gagal bulk delete attendance:', eSbBulk);
   }

   // Bersihkan dari outbox offline jika ada
   try {
    if (typeof readAttOutbox === 'function') {
     let ob = readAttOutbox().filter(x => !(x.rec && docIdsToDelete.has(String(x.rec.id))));
     localStorage.setItem('wfm_attendance_outbox', JSON.stringify(ob));
    }
   } catch(eOb) {}

   // Sinkronkan ke Cloud Firestore (termasuk tombstone deleted_attendance_ids)
   await saveFullDatabaseToCloud(false, true, true, null, false, true);

   const bulkDelSyncTarget = touchedDeleteWhs.size > 1 ? 'ALL' : (touchedDeleteWhs.size === 1 ? Array.from(touchedDeleteWhs)[0] : activeWarehouse);
   if (typeof syncGoogleSheetDirectly === 'function') {
    syncGoogleSheetDirectly(true, bulkDelSyncTarget);
   } else if (typeof triggerGoogleSheetAutoSync === 'function') {
    triggerGoogleSheetAutoSync(true, bulkDelSyncTarget);
   }
   try { if (typeof BroadcastChannel !== 'undefined') new BroadcastChannel('wfm_firebase_live_sync').postMessage('update'); } catch(e) {}

   window.selectedRecordIds.clear();
   updateSelectedRecordsCount();
   renderRecordsTable();
   refreshAllDashboardData();
   renderMatrixTable();
   renderScannerTodayRecords();
   alert(`Å“â€¦ Berhasil menghapus ${count} catatan presensi secara permanen dari sistem dan Cloud.`);
  }

  async function deleteSingleAttendanceRecord(id, targetWh = activeWarehouse) {
   if (!id) return;
   if (!confirm('Apakah Anda yakin ingin menghapus catatan presensi ini secara permanen?\n\nCatatan ini akan langsung dihapus dari memori lokal, Google Firebase Cloud, dan Google Spreadsheet.')) return;
   const wh = targetWh || activeWarehouse || 'MBI';
   const attendances = getWhDB(wh, 'attendance', []);
   const toDelete = attendances.find(a => a && (a.id === id || getAttendanceCompositeKey(a) === String(id).toLowerCase()));
   
   // Catat ke tombstone agar tidak pernah bangkit lagi dari Cloud/Sheet
   const docIdsToDelete = new Set();
   if (id) docIdsToDelete.add(String(id));
   let userNikToDelete = '';
   let dateToDelete = '';
   if (toDelete) {
    trackDeletedAttendance(toDelete);
    if (toDelete.id) docIdsToDelete.add(String(toDelete.id));
    if (toDelete._firestoreDocId) docIdsToDelete.add(String(toDelete._firestoreDocId));
    userNikToDelete = toDelete.userNik || toDelete.nik || '';
    dateToDelete = toDelete.date || '';
   } else {
    trackDeletedAttendance(id);
   }

   // Bersihkan dari kedua gudang beserta cadangan backup & today_attendance
   ['MBI', 'MAI'].forEach(w => {
    const wLower = w.toLowerCase();
    let list = getWhDB(w, 'attendance', []);
    const filtered = list.filter(a => a && !isAttendanceMarkedDeleted(a));
    setWhDB(w, 'attendance', filtered, true);
    try { localStorage.setItem(`wfm_${wLower}_attendance_backup`, JSON.stringify(filtered)); } catch(eBak) {}
    try {
     const tdRaw = localStorage.getItem(`wfm_${wLower}_today_attendance`);
     if (tdRaw) {
      const tdList = JSON.parse(tdRaw);
      if (Array.isArray(tdList)) {
       localStorage.setItem(`wfm_${wLower}_today_attendance`, JSON.stringify(tdList.filter(a => a && !isAttendanceMarkedDeleted(a))));
      }
     }
    } catch(eTd) {}
   });

   // Hapus dokumen fisik langsung dari Cloud Firestore attendance collection & bersihkan today/archive snapshot
   try {
    const delPromises = [];
    docIdsToDelete.forEach(dId => {
     delPromises.push(deleteDocFromFirestore('MBI', 'attendance', dId).catch(() => {}));
     delPromises.push(deleteDocFromFirestore('MAI', 'attendance', dId).catch(() => {}));
    });
    await Promise.allSettled(delPromises);
    await Promise.allSettled([
     scrubDeletedAttendanceFromCloud('MBI'),
     scrubDeletedAttendanceFromCloud('MAI')
    ]);
   } catch(eAttDoc) {}

   // HAPUS FISIK LANGSUNG DARI DATABASE SUPABASE (SSOT UTAMA)
   try {
    if (typeof deleteAttendanceFromSupabase === 'function') {
     await deleteAttendanceFromSupabase(Array.from(docIdsToDelete), wh, userNikToDelete, dateToDelete);
    }
   } catch(eSbDel) {
    console.warn('[Supabase] Gagal delete single attendance:', eSbDel);
   }

   // Bersihkan dari outbox offline jika ada
   try {
    if (typeof readAttOutbox === 'function') {
     let ob = readAttOutbox().filter(x => !(x.rec && (docIdsToDelete.has(String(x.rec.id)) || (x.rec.userNik && String(x.rec.userNik).toUpperCase() === String(userNikToDelete).toUpperCase() && x.rec.date === dateToDelete))));
     localStorage.setItem('wfm_attendance_outbox', JSON.stringify(ob));
    }
   } catch(eOb) {}

   // Sinkronkan ke Cloud Firestore (beserta tombstone deleted_attendance_ids)
   await saveFullDatabaseToCloud(false, true, true, null, false, true);

   // Langsung update Google Spreadsheet hanya untuk gudang terkait
   if (typeof syncGoogleSheetDirectly === 'function') {
    syncGoogleSheetDirectly(true, wh);
   } else if (typeof triggerGoogleSheetAutoSync === 'function') {
    triggerGoogleSheetAutoSync(true, wh);
   }
   try { if (typeof BroadcastChannel !== 'undefined') new BroadcastChannel('wfm_firebase_live_sync').postMessage('update'); } catch(e) {}

   if (window.selectedRecordIds) {
    window.selectedRecordIds.delete(id);
    updateSelectedRecordsCount();
   }
   renderRecordsTable();
   refreshAllDashboardData();
   renderMatrixTable();
   renderScannerTodayRecords();
   alert('Å“â€¦ Catatan presensi berhasil dihapus secara permanen dari sistem, Cloud, dan Google Spreadsheet.');
  }

  // =========================================================
  // FITUR INPUT ABSENSI MANUAL OLEH ADMIN
  // =========================================================
  function populateManualAttendanceEmployees(targetWh) {
   const wh = (targetWh || activeWarehouse || 'MBI').toUpperCase();
   const empSelect = document.getElementById('man-att-emp');
   if (!empSelect) return;

   const rawUsers = getWhDB(wh, 'users', wh === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS) || [];
   const userMap = new Map();

   rawUsers.forEach(u => {
    if (!u || !u.nik) return;
    const cleanRole = (u.role || '').toLowerCase();
    if (cleanRole === 'admin' || cleanRole === 'manager' || cleanRole === 'superadmin') return;
    if (isUserMarkedDeleted(u)) return;

    const cleanNik = u.nik.trim().toUpperCase();
    if (!userMap.has(cleanNik)) {
     userMap.set(cleanNik, {
      nik: cleanNik,
      name: (u.name || cleanNik).trim(),
      dept: u.dept || u.department || 'OPERASIONAL',
      outsource: u.outsource || 'Internal',
      warehouse: wh,
      id: u.id || `emp-${cleanNik.toLowerCase()}`
     });
    }
   });

   const sortedUsers = Array.from(userMap.values()).sort((a, b) => a.name.localeCompare(b.name));

   if (sortedUsers.length === 0) {
    empSelect.innerHTML = `<option value="">(Tidak ada karyawan aktif di Gudang ${wh})</option>`;
   } else {
    empSelect.innerHTML = sortedUsers.map(u => 
     `<option value="${u.nik}">${u.name} (${u.nik}) - [${wh}] ${u.dept}</option>`
    ).join('');
   }
  }

  function openManualAttendanceModal() {
   if (!isUserAdmin(currentUser) && !isUserManager(currentUser) && !hasPermission('perm_att_edit')) {
    alert('Akses Ditolak: Anda tidak memiliki izin untuk menginput presensi manual.');
    return;
   }
   const modal = document.getElementById('modal-manual-attendance');
   if (!modal) return;

   const whSelect = document.getElementById('man-att-wh');
   const dateInput = document.getElementById('man-att-date');
   const inTimeInput = document.getElementById('man-att-in-time');
   const outTimeInput = document.getElementById('man-att-out-time');
   const inStatusSelect = document.getElementById('man-att-in-status');
   const crossDaySelect = document.getElementById('man-att-cross-day');
   const notesInput = document.getElementById('man-att-notes');

   // Ambil gudang yang sedang aktif dibuka saat ini (MBI / MAI)
   const currentWh = (activeWarehouse || 'MBI').toUpperCase();
   if (whSelect) whSelect.value = currentWh;

   // Isi dropdown karyawan HANYA untuk gudang yang sedang dibuka
   populateManualAttendanceEmployees(currentWh);

   // Default tanggal hari ini (WIB)
   const todayWib = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
   if (dateInput) dateInput.value = todayWib;
   if (inTimeInput) inTimeInput.value = '08:00:00';
   if (outTimeInput) outTimeInput.value = '17:00:00';
   if (inStatusSelect) inStatusSelect.value = 'on_time';
   if (crossDaySelect) crossDaySelect.value = 'no';
   if (notesInput) notesInput.value = 'Input Manual Admin';

   modal.classList.remove('hidden');
   if (window.lucide) lucide.createIcons();
  }

  function closeManualAttendanceModal() {
   const modal = document.getElementById('modal-manual-attendance');
   if (modal) modal.classList.add('hidden');
  }

  async function handleSaveManualAttendance(event) {
   if (event) event.preventDefault();
   const wh = (document.getElementById('man-att-wh')?.value || activeWarehouse || 'MBI').toUpperCase();
   const nik = (document.getElementById('man-att-emp')?.value || '').trim().toUpperCase();
   const date = document.getElementById('man-att-date')?.value || '';
   const inTime = document.getElementById('man-att-in-time')?.value || '';
   const outTime = document.getElementById('man-att-out-time')?.value || '';
   const inStatus = document.getElementById('man-att-in-status')?.value || 'on_time';
   const crossDay = document.getElementById('man-att-cross-day')?.value || 'no';
   const notes = (document.getElementById('man-att-notes')?.value || '').trim();

   if (!nik || !date || !inTime) {
    alert('Harap lengkapi Karyawan, Tanggal, dan Jam Masuk!');
    return;
   }

   const users = getWhDB(wh, 'users', wh === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);
   let emp = users.find(u => u && (u.nik || '').toUpperCase() === nik);
   if (!emp) {
    const otherWh = wh === 'MBI' ? 'MAI' : 'MBI';
    const otherUsers = getWhDB(otherWh, 'users', []);
    emp = otherUsers.find(u => u && (u.nik || '').toUpperCase() === nik);
   }

   // Format ISO String Check-In (WIB +07:00)
   const cleanInTime = inTime.length === 5 ? inTime + ':00' : inTime;
   const inIso = new Date(`${date}T${cleanInTime}+07:00`).toISOString();

   // Format ISO String Check-Out (WIB +07:00)
   let outIso = null;
   if (outTime) {
    let outDateStr = date;
    if (crossDay === 'yes') {
     const d = new Date(`${date}T12:00:00Z`);
     d.setDate(d.getDate() + 1);
     outDateStr = d.toISOString().split('T')[0];
    }
    const cleanOutTime = outTime.length === 5 ? outTime + ':00' : outTime;
    outIso = new Date(`${outDateStr}T${cleanOutTime}+07:00`).toISOString();
   }

   const recId = `att-${wh.toLowerCase()}-${Date.now()}`;
   const empDept = (emp && (emp.dept || emp.department)) ? (emp.dept || emp.department) : 'Warehouse Staff';
   const empName = (emp && emp.name) ? emp.name : nik;
   const empOutsource = (emp && emp.outsource) ? emp.outsource : 'Internal';
   const empUserId = (emp && emp.id) ? emp.id : `emp-${nik.toLowerCase()}`;

   const newRec = {
    id: recId,
    userId: empUserId,
    userNik: nik,
    userName: empName,
    name: empName,
    nik: nik,
    dept: empDept,
    department: empDept,
    outsource: empOutsource,
    warehouse: wh,
    date: date,
    checkInTime: inIso,
    checkOutTime: outIso,
    checkInStatus: inStatus,
    status: inStatus,
    notes: notes || 'Input Manual Admin',
    manualInput: true,
    updatedAt: new Date().toISOString()
   };

   if (typeof untrackDeletedAttendance === 'function') {
    untrackDeletedAttendance(newRec);
   }
   const attendances = getWhDB(wh, 'attendance', []);
   attendances.unshift(newRec);
   setWhDB(wh, 'attendance', attendances, true);
   try { localStorage.setItem(`wfm_${wh.toLowerCase()}_attendance_backup`, JSON.stringify(attendances)); } catch(eBak) {}

   if (outIso) cleanStaleMissScanFlags(newRec);
   // Sinkronisasi permanen ke Supabase 24/7, Cloud & Google Sheet
   if (typeof saveAttendanceToSupabase === 'function') {
    await saveAttendanceToSupabase(wh, newRec).catch(() => {});
   }
   await syncAttendanceToCloud(wh, attendances, newRec);
   if (typeof saveAttendanceDocToFirestore === 'function') {
    await saveAttendanceDocToFirestore(wh, newRec).catch(() => {});
   }
   if (typeof syncGoogleSheetDirectly === 'function') {
    syncGoogleSheetDirectly(true, wh);
   }

   closeManualAttendanceModal();
   renderRecordsTable(true);
   refreshAllDashboardData();
   renderMatrixTable();
   alert(`Å“â€¦ Berhasil menambahkan presensi manual untuk ${newRec.userName} pada tanggal ${date}!`);
  }

  // =========================================================
  // FITUR KOREKSI / EDIT DATA ABSENSI OLEH ADMIN
  // =========================================================
  function openEditAttendanceModal(id, targetWh) {
   if (!isUserAdmin(currentUser) && !isUserManager(currentUser) && !hasPermission('perm_att_edit')) {
    alert('Akses Ditolak: Anda tidak memiliki izin untuk mengoreksi data presensi.');
    return;
   }
   const modal = document.getElementById('modal-edit-attendance');
   if (!modal) return;

   const wh = targetWh || activeWarehouse || 'MBI';
   let attendances = getWhDB(wh, 'attendance', []);
   let rec = attendances.find(a => a && (a.id === id || getAttendanceCompositeKey(a) === String(id).toLowerCase()));
   
   if (!rec) {
    const otherWh = wh === 'MBI' ? 'MAI' : 'MBI';
    const otherList = getWhDB(otherWh, 'attendance', []);
    rec = otherList.find(a => a && (a.id === id || getAttendanceCompositeKey(a) === String(id).toLowerCase()));
   }

   if (!rec) {
    alert('Data presensi tidak ditemukan.');
    return;
   }

   const finalWh = rec.warehouse || wh;
   document.getElementById('edit-att-id').value = rec.id || '';
   document.getElementById('edit-att-wh').value = finalWh;

   const empName = rec.userName || rec.name || 'Karyawan';
   const empNik = rec.userNik || rec.nik || '-';

   document.getElementById('edit-att-name-display').innerText = empName;
   document.getElementById('edit-att-nik-display').innerText = `NIK: ${empNik}`;
   const whBadge = document.getElementById('edit-att-wh-badge');
   if (whBadge) {
    whBadge.innerText = finalWh;
    whBadge.className = `px-2 py-0.5 rounded text-[10px] font-extrabold font-mono ${finalWh === 'MAI' ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800'}`;
   }

   document.getElementById('edit-att-date').value = rec.date || '';

   // Format jam masuk lokal (HH:mm:ss WIB)
   if (rec.checkInTime) {
    const inDate = new Date(rec.checkInTime);
    const inTimeStr = inDate.toLocaleTimeString('en-GB', { hour12: false, timeZone: 'Asia/Jakarta' });
    document.getElementById('edit-att-in-time').value = inTimeStr;
   } else {
    document.getElementById('edit-att-in-time').value = '';
   }

   // Format jam pulang lokal (HH:mm:ss WIB)
   if (rec.checkOutTime) {
    const outDate = new Date(rec.checkOutTime);
    const inDate = rec.checkInTime ? new Date(rec.checkInTime) : null;
    const outTimeStr = outDate.toLocaleTimeString('en-GB', { hour12: false, timeZone: 'Asia/Jakarta' });
    document.getElementById('edit-att-out-time').value = outTimeStr;

    // Cek shift malam lintas hari (tanggal check-out berbeda dengan check-in)
    const inDayStr = inDate ? inDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }) : rec.date;
    const outDayStr = outDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
    document.getElementById('edit-att-cross-day').value = (inDayStr !== outDayStr) ? 'yes' : 'no';
   } else {
    document.getElementById('edit-att-out-time').value = '';
    document.getElementById('edit-att-cross-day').value = 'no';
   }

   document.getElementById('edit-att-in-status').value = (rec.checkInStatus === 'late' || rec.status === 'late') ? 'late' : 'on_time';
   document.getElementById('edit-att-notes').value = rec.notes || '';

   modal.classList.remove('hidden');
   if (window.lucide) lucide.createIcons();
  }

  function closeEditAttendanceModal() {
   const modal = document.getElementById('modal-edit-attendance');
   if (modal) modal.classList.add('hidden');
  }

  async function handleSaveEditAttendance(event) {
   if (event) event.preventDefault();
   const id = document.getElementById('edit-att-id')?.value || '';
   const wh = document.getElementById('edit-att-wh')?.value || activeWarehouse || 'MBI';
   const date = document.getElementById('edit-att-date')?.value || '';
   const inTime = document.getElementById('edit-att-in-time')?.value || '';
   const outTime = document.getElementById('edit-att-out-time')?.value || '';
   const inStatus = document.getElementById('edit-att-in-status')?.value || 'on_time';
   const crossDay = document.getElementById('edit-att-cross-day')?.value || 'no';
   const notes = (document.getElementById('edit-att-notes')?.value || '').trim();

   if (!id || !date || !inTime) {
    alert('Harap lengkapi Tanggal dan Jam Masuk!');
    return;
   }

   let attendances = getWhDB(wh, 'attendance', []);
   let idx = attendances.findIndex(a => a && (a.id === id || getAttendanceCompositeKey(a) === String(id).toLowerCase()));
   let targetWh = wh;

   if (idx === -1) {
    const otherWh = wh === 'MBI' ? 'MAI' : 'MBI';
    const otherList = getWhDB(otherWh, 'attendance', []);
    const oIdx = otherList.findIndex(a => a && (a.id === id || getAttendanceCompositeKey(a) === String(id).toLowerCase()));
    if (oIdx !== -1) {
     attendances = otherList;
     idx = oIdx;
     targetWh = otherWh;
    }
   }

   if (idx === -1) {
    alert('Data presensi tidak ditemukan untuk diperbarui.');
    return;
   }

   // Format ISO String Check-In (WIB +07:00)
   const cleanInTime = inTime.length === 5 ? inTime + ':00' : inTime;
   const inIso = new Date(`${date}T${cleanInTime}+07:00`).toISOString();

   // Format ISO String Check-Out (WIB +07:00)
   let outIso = null;
   if (outTime) {
    let outDateStr = date;
    if (crossDay === 'yes') {
     const d = new Date(`${date}T12:00:00Z`);
     d.setDate(d.getDate() + 1);
     outDateStr = d.toISOString().split('T')[0];
    }
    const cleanOutTime = outTime.length === 5 ? outTime + ':00' : outTime;
    outIso = new Date(`${outDateStr}T${cleanOutTime}+07:00`).toISOString();
   }

   const existingRec = attendances[idx];
   existingRec.date = date;
   existingRec.checkInTime = inIso;
   existingRec.checkOutTime = outIso;
   existingRec.checkInStatus = inStatus;
   existingRec.status = inStatus;
   existingRec.notes = notes || 'Koreksi Admin';
   existingRec.updatedAt = new Date().toISOString();
   existingRec.correctedByAdmin = true;
   if (outIso) {
    cleanStaleMissScanFlags(existingRec);
   }
   if (typeof untrackDeletedAttendance === 'function') {
    untrackDeletedAttendance(existingRec);
   }

   attendances[idx] = existingRec;
   setWhDB(targetWh, 'attendance', attendances, true);
   try { localStorage.setItem(`wfm_${targetWh.toLowerCase()}_attendance_backup`, JSON.stringify(attendances)); } catch(eBak) {}

   // Sinkronisasi permanen ke Supabase 24/7, Cloud & Google Sheet
   if (typeof saveAttendanceToSupabase === 'function') {
    await saveAttendanceToSupabase(targetWh, existingRec).catch(() => {});
   }
   await syncAttendanceToCloud(targetWh, attendances, existingRec);
   if (typeof saveAttendanceDocToFirestore === 'function') {
    await saveAttendanceDocToFirestore(targetWh, existingRec).catch(() => {});
    if (existingRec._firestoreDocId && existingRec._firestoreDocId !== existingRec.id && typeof saveDocToFirestore === 'function') {
     await saveDocToFirestore(targetWh, 'attendance', existingRec._firestoreDocId, { ...existingRec, warehouse: targetWh }).catch(() => {});
    }
   }
   if (typeof syncGoogleSheetDirectly === 'function') {
    syncGoogleSheetDirectly(true, targetWh);
   }

   closeEditAttendanceModal();
   renderRecordsTable(true);
   refreshAllDashboardData();
   renderMatrixTable();
   alert(`Å“â€¦ Data presensi berhasil diperbarui dan disinkronkan ke Cloud & Google Sheet!`);
  }

  function exportRecordsToExcel() {
   if (!hasPermission('perm_rep_download_excel') && !isUserAdmin(currentUser) && !isUserManager(currentUser)) {
    alert('Akses Ditolak: Anda tidak memiliki izin untuk mengunduh laporan ke Excel.');
    return;
   }
   let startStr = document.getElementById('record-start-date')?.value || '';
   let endStr = document.getElementById('record-end-date')?.value || '';
   if (startStr && endStr && startStr > endStr) {
    const tmp = startStr;
    startStr = endStr;
    endStr = tmp;
   }
   const searchQ = (document.getElementById('record-search-input')?.value || '').toLowerCase().trim();
   const sortOrder = document.getElementById('record-sort-order')?.value || 'time_desc';

   const users = getWhDB(currentWh, 'users', currentWh === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);
   const attendances = getWhDB(currentWh, 'attendance', currentWh === 'MBI' ? SEED_MBI_ATTENDANCE : SEED_MAI_ATTENDANCE).map(a => ({ ...a, warehouse: a.warehouse || currentWh }));

   // Mapping O(1) Outsource untuk pencarian instan
   const userOSMap = new Map();
   users.forEach(u => {
    if (!u) return;
    if (u.nik) userOSMap.set(u.nik.toUpperCase(), (u.outsource || 'Internal').toLowerCase());
    if (u.name) userOSMap.set(cleanStr(u.name), (u.outsource || 'Internal').toLowerCase());
    if (u.id) userOSMap.set(u.id, (u.outsource || 'Internal').toLowerCase());
   });

   const filtered = attendances.filter(a => {
    if (!a || isAttendanceMarkedDeleted(a)) return false;
    const checkInLocalDate = a.checkInTime ? getLocalDateString(new Date(a.checkInTime)) : '';
    const inDate = (!startStr || a.date >= startStr || (checkInLocalDate && checkInLocalDate >= startStr)) && 
            (!endStr || a.date <= endStr || (checkInLocalDate && checkInLocalDate <= endStr));
    const uOS = (a.userNik && userOSMap.get(a.userNik.toUpperCase())) ||
          (a.userName && userOSMap.get(cleanStr(a.userName))) ||
          (a.userId && userOSMap.get(a.userId)) ||
          (a.outsource && a.outsource.toLowerCase()) || '';
    const inSearch = !searchQ || 
             (a.userName && a.userName.toLowerCase().includes(searchQ)) || 
             (a.userNik && a.userNik.toLowerCase().includes(searchQ)) ||
             (a.dept && a.dept.toLowerCase().includes(searchQ)) ||
             (a.warehouse && a.warehouse.toLowerCase().includes(searchQ)) ||
             (uOS && uOS.includes(searchQ));
    return inDate && inSearch;
   });

   if (filtered.length === 0) {
    alert('Tidak ada data record presensi yang cocok dengan pencarian / filter untuk diekspor ke Excel.');
    return;
   }

   // PENGURUTAN RAPI & KRONOLOGIS UNTUK FILE EXCEL (DEFAULT: WAKTU SCAN MASUK TERBARU DI ATAS):
   filtered.sort((a, b) => {
    if (sortOrder === 'time_desc') {
     if (a.date !== b.date) return (b.date || '').localeCompare(a.date || '');
     const inA = a.checkInTime ? new Date(a.checkInTime).getTime() : 0;
     const inB = b.checkInTime ? new Date(b.checkInTime).getTime() : 0;
     return inB - inA;
    } else if (sortOrder === 'time_asc') {
     if (a.date !== b.date) return (a.date || '').localeCompare(b.date || '');
     const timeA = a.checkInTime ? new Date(a.checkInTime).getTime() : 0;
     const timeB = b.checkInTime ? new Date(b.checkInTime).getTime() : 0;
     return timeA - timeB;
    } else if (sortOrder === 'name_asc') {
     const c = (a.userName || '').localeCompare(b.userName || '');
     if (c !== 0) return c;
     return (b.date || '').localeCompare(a.date || '');
    } else if (sortOrder === 'name_desc') {
     const c = (b.userName || '').localeCompare(a.userName || '');
     if (c !== 0) return c;
     return (b.date || '').localeCompare(a.date || '');
    } else if (sortOrder === 'nik_asc') {
     const c = (a.userNik || '').localeCompare(b.userNik || '', undefined, { numeric: true });
     if (c !== 0) return c;
     return (b.date || '').localeCompare(a.date || '');
    }
    return 0;
   });

   const rows = filtered.map((r, i) => {
    let emp = null;
    if (r.userName) emp = users.find(u => cleanStr(u.name) === cleanStr(r.userName));
    if (!emp && r.userNik) emp = users.find(u => u.nik && u.nik.toUpperCase() === r.userNik.toUpperCase());
    if (!emp && r.userId) emp = users.find(u => u.id === r.userId);

    const finalName = emp ? emp.name : (r.userName || '-');
    const finalNik = emp ? emp.nik : (r.userNik || '-');
    const finalOutsource = emp ? (emp.outsource || 'Internal') : (r.outsource || 'Internal');
    const finalDept = emp ? emp.dept : (r.dept || '');
    const recWh = r.warehouse || (emp ? emp.warehouse : activeWarehouse) || 'MBI';

    const durInfo = getAttendanceDurationInfo(r);
    const checkInDate = new Date(r.checkInTime);
    const minute = checkInDate.getMinutes();
    const isLate = r.checkInStatus === 'late' || (minute >= 1 && minute <= 30);
    const statusMasuk = isLate ? 'Late In' : 'Normal';
    const statusPulang = durInfo.isMissScan ? 'Miss Scan' : durInfo.statusOut;
    const jamPulangStr = durInfo.isMissScan 
     ? 'Miss Scan' 
     : (r.checkOutTime ? formatDisplayTimeWIB(r.checkOutTime) : (durInfo.isOngoing ? 'Sedang Shift' : 'Miss Scan'));

    return {
     "No": i + 1,
     "Tanggal": r.date,
     "Gudang": recWh,
     "NIK": finalNik,
     "Nama Karyawan": finalName,
     "Outsourcing": finalOutsource,
     "Departemen": finalDept,
     "Jam Masuk": r.checkInTime ? formatDisplayTimeWIB(r.checkInTime) : '-',
     "Jam Pulang": jamPulangStr,
     "Durasi Kerja": durInfo.durationStr,
     "Status Kehadiran": statusMasuk,
     "Status Kepulangan": statusPulang,
     "Keterangan": `${statusMasuk} - ${statusPulang}${r.notes && r.notes !== '-' ? ` (${r.notes})` : ''}`
    };
   });

   const ws = XLSX.utils.json_to_sheet(rows);
   const wb = XLSX.utils.book_new();
   const sheetName = `Record_Absen_${currentWh}`;
   XLSX.utils.book_append_sheet(wb, ws, sheetName);
   const searchTag = searchQ ? `_${searchQ.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
   const periodTag = (startStr || endStr) ? `_${startStr || 'awal'}_sd_${endStr || 'akhir'}` : '_semua';
   XLSX.writeFile(wb, `${sheetName}${searchTag}${periodTag}.xlsx`);
  }

  function getDatesInRange(startDateStr, endDateStr) {
   let dStart = parseYMD(startDateStr);
   let dEnd = parseYMD(endDateStr);
   if (dStart > dEnd) {
    const tmp = dStart;
    dStart = dEnd;
    dEnd = tmp;
   }
   const dates = [];
   let cur = new Date(dStart.getTime());
   while (cur <= dEnd) {
    dates.push(new Date(cur.getTime()));
    cur.setDate(cur.getDate() + 1);
   }
   return dates;
  }

  const DAY_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

  function isMatrixEligibleUser(u) {
   if (!u || typeof u !== 'object') return false;
   if (typeof isManagementSystemAccount === 'function' && isManagementSystemAccount(u)) return false;
   const name = (u.name || '').trim();
   if (!name) return false;
   if (typeof isUserMarkedDeleted === 'function' && isUserMarkedDeleted(u)) return false;
    if (u.status === 'inactive' || u.isActive === false || (typeof isNikInactiveRegistered === 'function' && isNikInactiveRegistered(u.nik))) return false;
   const role = (u.role || '').toLowerCase().trim();
   const nik = (u.nik || '').toUpperCase().trim();
   const dept = (u.dept || '').toLowerCase().trim();
   if (role === 'admin' || role === 'scanner' || role === 'manager') return false;
   if (nik.startsWith('ADM') || nik.startsWith('ABSEN') || nik === 'MGR001') return false;
   if (dept === 'administrator' || dept === 'presensi' || dept === 'management') return false;
   return true;
  }

  function normalizeOSName(os) {
   if (!os || typeof os !== 'string') return 'Internal';
   const clean = cleanStr(os);
   if (!clean || clean === 'internal' || clean === 'medika' || clean === '-' || clean === 'nonos' || clean === 'null' || clean === 'undefined') return 'Internal';
   if (clean.includes('adp')) return 'ADP';
   if (clean.includes('staffinc') || clean.includes('staffing')) return 'Staffinc';
   return 'Internal';
  }

  function isMatchOS(userOS, selectedOS) {
   if (!selectedOS || selectedOS === 'ALL') return true;
   return normalizeOSName(userOS).toLowerCase() === normalizeOSName(selectedOS).toLowerCase();
  }

  // Fungsi Auto-Sanitasi & Penyimpanan Vendor OS Karyawan ke Database & Cloud (Hanya 3 OS: ADP, Staffinc, Internal)
  function autoMigrateAndPersistAllEmployeeOS() {
   const warehouses = ['MBI', 'MAI'];
   let anyChanged = false;

   warehouses.forEach(wh => {
    try {
     const storageKey = `wfm_${wh.toLowerCase()}_users`;
     const backupKey = `wfm_${wh.toLowerCase()}_users_backup`;
     const seedUsers = wh === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS;
     let users = getWhDB(wh, 'users', seedUsers);
     let whChanged = false;

     // Jika jumlah karyawan lokal berkurang dibanding master seed (129 MBI / 54 MAI), padukan kembali
     if (!users || users.length < seedUsers.length) {
      users = mergeUserArrays(seedUsers, users || [], wh);
      whChanged = true;
     }

     const seedMap = new Map();
     seedUsers.forEach(s => { if (s && s.nik) seedMap.set(s.nik.toUpperCase().trim(), s); });

     users.forEach(u => {
      if (!u) return;
      const seedMatch = u.nik ? seedMap.get(u.nik.toUpperCase().trim()) : null;
      let rawOs = u.outsource;
      if ((!rawOs || rawOs === 'Internal') && seedMatch && seedMatch.outsource && seedMatch.outsource !== 'Internal') {
       rawOs = seedMatch.outsource;
      }
      const targetOS = isManagementSystemAccount(u) ? 'Internal' : normalizeOSName(rawOs || 'Internal');
      if (u.outsource !== targetOS) {
       u.outsource = targetOS;
       whChanged = true;
      }
     });

     if (whChanged) {
      localStorage.setItem(storageKey, JSON.stringify(users));
      localStorage.setItem(backupKey, JSON.stringify(users));
      anyChanged = true;
     }
    } catch(e) {
     console.warn('autoMigrateAndPersistAllEmployeeOS error in ' + wh, e);
    }
   });

   if (anyChanged) {
    const nowIso = new Date().toISOString();
    localStorage.setItem('wfm_last_master_change_time', Date.now().toString());
    localStorage.setItem('wfm_master_updated_at', nowIso);
    if (typeof saveFullDatabaseToCloud === 'function') {
     saveFullDatabaseToCloud(false, true, true);
    }
   }
  }

  // Mendapatkan seluruh daftar karyawan untuk matriks presensi (Harmonisasi Users DB + Riwayat Absensi + Riwayat Cuti)
  function getMatrixEmployees(warehouse = activeWarehouse || 'MBI') {
   const users = getWhDB(warehouse, 'users', warehouse === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);
   const attendances = getWhDB(warehouse, 'attendance', warehouse === 'MBI' ? SEED_MBI_ATTENDANCE : SEED_MAI_ATTENDANCE);
   const leaves = getWhDB(warehouse, 'leaves', warehouse === 'MBI' ? SEED_MBI_LEAVES : []);

   const empMap = new Map();
   const seenNiks = new Set();
   const seenNames = new Set();

   // 1. Masukkan seluruh karyawan reguler dari database master
   users.forEach(u => {
    if (!u || !isMatrixEligibleUser(u)) return;
    const nikKey = u.nik ? u.nik.toUpperCase().trim() : '';
    const nameKey = cleanStr(u.name);
    const key = nikKey || nameKey || u.id;
    if (!key) return;

    const empObj = {
     id: u.id || `emp-${Date.now()}-${Math.random()}`,
     nik: u.nik || '',
     name: u.name || '',
     dept: u.dept || 'Staff',
     role: u.role || 'staff',
     outsource: normalizeOSName(u.outsource || 'Internal'),
     warehouse: u.warehouse || warehouse
    };

    empMap.set(key, empObj);
    if (nikKey) seenNiks.add(nikKey);
    if (nameKey) seenNames.add(nameKey);
   });

   // 2. Hubungkan data kehadiran ke karyawan MASTER lewat identitas tunggal (ID -> NIK -> Nama).
    //    Karyawan nonaktif TIDAK dimunculkan kembali hanya karena punya riwayat absen.
    const identityIdx = buildEmployeeIdentityIndex(users);
    attendances.forEach(a => {
     if (!a || isAttendanceMarkedDeleted(a)) return;
     const aNik = a.userNik ? a.userNik.toUpperCase().trim() : '';
     const aName = a.userName ? a.userName.trim() : '';
     const aCleanName = cleanStr(aName);
     const aOS = a.outsource ? a.outsource.trim() : '';

     if (!aName && !aNik) return;
     if (aNik.startsWith('ADM') || aNik.startsWith('ABSEN') || aNik === 'MGR001') return;
     if (aCleanName === 'admingudangmbi' || aCleanName === 'admingudangmai' || aCleanName === 'scannerpresensigudang' || aCleanName === 'eko') return;

     const owner = resolveRecordOwner(a, identityIdx);
     if (owner) {
      const matchedEmp = empMap.get(matrixKeyForUser(owner));
      if (matchedEmp && (!matchedEmp.outsource || matchedEmp.outsource === '-' || matchedEmp.outsource === 'Internal') && aOS && aOS !== '-' && aOS !== 'Internal') {
       matchedEmp.outsource = normalizeOSName(aOS);
      }
      return;
     }

     // Rekaman yatim (tidak ada di master sama sekali)
     const orphanKey = matrixOrphanKey(a);
     if (!empMap.has(orphanKey)) {
      empMap.set(orphanKey, {
       id: orphanKey,
       nik: a.userNik || '',
       name: a.userName || `Karyawan (${a.userNik || '-'})`,
       dept: a.dept || 'Warehouse Staff',
       role: 'staff',
       outsource: normalizeOSName(aOS || 'Internal'),
       warehouse
      });
     }
    });

    const matrixList = Array.from(empMap.values());
   matrixList.sort((a, b) => {
    const nikA = (a.nik || a.id || '').toUpperCase().trim();
    const nikB = (b.nik || b.id || '').toUpperCase().trim();
    return nikA.localeCompare(nikB, undefined, { numeric: true, sensitivity: 'base' });
   });
   return matrixList;
  }

  function initMatrixDateRange(forceReset = false) {
   const sInput = document.getElementById('matrix-start-date');
   const eInput = document.getElementById('matrix-end-date');
   if (!sInput || !eInput) return;

   const targetWh = activeWarehouse || 'MBI';
   const attendances = getWhDB(targetWh, 'attendance', targetWh === 'MBI' ? SEED_MBI_ATTENDANCE : SEED_MAI_ATTENDANCE);
   const validDates = [];

   attendances.forEach(a => {
    if (!a) return;
    if (a.date && /^\d{4}-\d{2}-\d{2}$/.test(a.date)) validDates.push(a.date);
    if (a.checkInTime) {
     const locD = getLocalDateString(new Date(a.checkInTime));
     if (locD && /^\d{4}-\d{2}-\d{2}$/.test(locD)) validDates.push(locD);
    }
   });

   validDates.sort();

   const now = new Date();
   const todayStr = getLocalDateString(now);

   if (forceReset || !eInput.value) {
    if (validDates.length > 0) {
     const latestAtt = validDates[validDates.length - 1];
     // Jika absensi terbaru ada di masa lalu (misal bulan kemarin), prioritaskan tanggal absensi tersebut
     eInput.value = (latestAtt > todayStr) ? latestAtt : (latestAtt.substring(0, 7) === todayStr.substring(0, 7) ? todayStr : latestAtt);
    } else {
     eInput.value = todayStr;
    }
   }

   if (forceReset || !sInput.value) {
    const refEnd = parseYMD(eInput.value || todayStr);
    // Default mulai tanggal 1 di bulan yang sama dengan tanggal akhir
    const firstDayOfMonth = new Date(refEnd.getFullYear(), refEnd.getMonth(), 1, 12, 0, 0);
    sInput.value = getLocalDateString(firstDayOfMonth);
   }
  }

  function populateMatrixOSDropdown(preserveSelection = true) {
   const select = document.getElementById('matrix-filter-os');
   if (!select) return;
   const currentVal = (select.value || 'ALL').trim();
   const targetWh = activeWarehouse || 'MBI';
   const eligibleUsers = getMatrixEmployees(targetWh);

   const vendors = ['ADP', 'Staffinc', 'Internal'];
   const osCounts = { 'ADP': 0, 'Staffinc': 0, 'Internal': 0 };

   eligibleUsers.forEach(u => {
    const norm = normalizeOSName(u.outsource);
    if (osCounts.hasOwnProperty(norm)) {
     osCounts[norm] += 1;
    } else {
     osCounts['Internal'] += 1;
    }
   });

   let optionsHtml = `<option value="ALL">Semua OS / Vendor (${eligibleUsers.length} Karyawan)</option>`;
   vendors.forEach(v => {
    optionsHtml += `<option value="${v}">${v} (${osCounts[v]} Karyawan)</option>`;
   });

   const targetSelectVal = preserveSelection ? currentVal : 'ALL';
   select.innerHTML = optionsHtml;
   
   const match = Array.from(select.options).find(o => 
    o.value.toUpperCase() === targetSelectVal.toUpperCase()
   );
   if (match) {
    select.value = match.value;
   } else {
    select.value = 'ALL';
   }
  }

  function renderMatrixTable() {
   try {
    initMatrixDateRange();
    const sInput = document.getElementById('matrix-start-date');
    const eInput = document.getElementById('matrix-end-date');
    let startStr = sInput?.value;
    let endStr = eInput?.value;
    if (!startStr || !endStr) return;

    if (startStr > endStr) {
     const tmp = startStr;
     startStr = endStr;
     endStr = tmp;
     if (sInput) sInput.value = startStr;
     if (eInput) eInput.value = endStr;
    }

    const selectOS = document.getElementById('matrix-filter-os');
    const selectedOS = (selectOS?.value || 'ALL').trim();

    const dateList = getDatesInRange(startStr, endStr);
    const dateKeys = dateList.map(d => getLocalDateString(d));
    const allMatrixUsers = getMatrixEmployees(activeWarehouse);
    const attendances = getWhDB(activeWarehouse, 'attendance', activeWarehouse === 'MBI' ? SEED_MBI_ATTENDANCE : SEED_MAI_ATTENDANCE);
    const leaves = getWhDB(activeWarehouse, 'leaves', activeWarehouse === 'MBI' ? SEED_MBI_LEAVES : []);

    const thead = document.getElementById('matrix-thead');
    const tbody = document.getElementById('matrix-tbody');
    if (!thead || !tbody) return;

    // Kelompokkan Tanggal berdasarkan Bulan (contoh: 19-31 Agustus, 1-20 September)
    const monthGroups = [];
    dateList.forEach(d => {
     const monthKey = d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
     let group = monthGroups.find(g => g.name === monthKey);
     if (!group) {
      group = { name: monthKey, dates: [] };
      monthGroups.push(group);
     }
     group.dates.push(d);
    });

    let headerHTML = `
     <tr class="border-b border-slate-300">
      <th rowspan="2" class="matrix-col-no p-2 border-r border-b border-slate-300 text-slate-800 font-black text-center">No</th>
      <th rowspan="2" class="matrix-col-name p-2 border-r border-b border-slate-300 text-slate-800 font-black text-left">Nama Karyawan</th>
      <th rowspan="2" class="matrix-col-os p-2 border-r border-b border-slate-300 text-slate-800 font-black text-center">Outsourcing</th>
    `;

    monthGroups.forEach((g, gIdx) => {
     const bgClass = gIdx % 2 === 0 ? 'bg-slate-200 text-slate-900' : 'bg-slate-100 text-slate-800';
     headerHTML += `<th colspan="${g.dates.length}" class="p-2 border-r border-b border-slate-300 font-extrabold uppercase text-xs tracking-wider ${bgClass}">${g.name}</th>`;
    });

    headerHTML += `
      <th rowspan="2" class="p-2 border-b border-slate-300 min-w-[90px] bg-slate-200 text-slate-900 font-black">Total Hadir</th>
     </tr>
     <tr class="border-b border-slate-300 text-[10px]">
    `;

    dateList.forEach(d => {
     const dayNum = d.getDate();
     const dayName = DAY_NAMES[d.getDay()];
     headerHTML += `<th class="p-1 border-r border-b border-slate-300 min-w-[32px] font-bold bg-slate-100">${dayNum}<br><span class="font-normal text-[9px] text-slate-600">${dayName}</span></th>`;
    });
    headerHTML += `</tr>`;
    thead.innerHTML = headerHTML;

    // Indeks kehadiran & cuti berbasis IDENTITAS TUNGGAL karyawan (1 rekaman = 1 karyawan = 1 tanggal)
    const matrixIdentityIdx = buildEmployeeIdentityIndex(getWhDB(activeWarehouse, 'users', activeWarehouse === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS));
    const attSet = buildMatrixAttendanceSet(attendances, matrixIdentityIdx);
    const leaveMap = buildMatrixLeaveMap(leaves, matrixIdentityIdx);

    // Filter karyawan sesuai OS yang dipilih (misal ADP, Staffinc, Internal, dll.)
    let regularUsers = allMatrixUsers;
    if (selectedOS !== 'ALL') {
     regularUsers = regularUsers.filter(u => isMatchOS(u.outsource, selectedOS));
    }

    const rowsHTML = [];

    if (regularUsers.length === 0) {
     const totalCols = 4 + dateList.length;
     if (allMatrixUsers.length === 0) {
      rowsHTML.push(`<tr><td colspan="${totalCols}" class="p-8 text-center text-xs text-slate-500 bg-slate-50 font-medium">Belum ada data karyawan di Gudang ${activeWarehouse}. Silakan tambahkan data karyawan melalui menu Data Karyawan.</td></tr>`);
     } else {
      rowsHTML.push(`
       <tr>
        <td colspan="${totalCols}" class="p-8 text-center text-xs text-slate-600 bg-slate-50 font-medium">
         <div class="space-y-2">
          <p>Tidak ditemukan karyawan dengan Vendor OS <b>"${escapeHTML(selectedOS)}"</b> di Gudang ${activeWarehouse} (Tersedia ${allMatrixUsers.length} karyawan di vendor lain).</p>
          <div>
           <button type="button" onclick="document.getElementById('matrix-filter-os').value='ALL'; renderMatrixTable();" class="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-xs inline-flex items-center">
            Tampilkan Semua Vendor (${allMatrixUsers.length} Karyawan)
           </button>
          </div>
         </div>
        </td>
       </tr>
      `);
     }
    } else {
     regularUsers.forEach((user, uIdx) => {
      let totalHariKerja = 0;
      const osVal = user.outsource || 'Internal';
      const nikDisplay = user.nik ? `<span class="text-[10px] text-slate-400 font-mono">(${user.nik})</span>` : '';
      let rowHTML = `
       <tr class="group hover:bg-slate-50 transition border-b border-slate-200">
        <td class="matrix-col-no p-2 border-r border-b border-slate-200 font-mono text-slate-500 font-bold text-center">${uIdx + 1}</td>
        <td class="matrix-col-name p-2 border-r border-b border-slate-200 text-left font-bold text-slate-900"><div class="truncate" title="${escapeHTML(user.name)}">${escapeHTML(user.name)} ${nikDisplay}</div></td>
        <td class="matrix-col-os p-2 border-r border-b border-slate-200 text-center"><span class="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[10px] font-bold text-slate-800">${escapeHTML(osVal)}</span></td>
      `;

      const uNik = user.nik ? user.nik.toUpperCase() : '';
      const uCleanName = user.name ? cleanStr(user.name) : '';
      const uId = user.id || '';

      dateKeys.forEach(dStr => {
       const isAtt = attSet.has(`${matrixKeyForUser(user)}__${dStr}`);

       if (isAtt) {
        totalHariKerja += 1;
        rowHTML += `<td class="p-1 border-r border-b border-slate-200 font-black text-slate-900 bg-slate-50">1</td>`;
       } else {
        const leaveType = leaveMap.get(`${matrixKeyForUser(user)}__${dStr}`);
        if (leaveType === 'sakit') {
         rowHTML += `<td class="p-1 border-r border-b border-slate-200 font-black text-slate-800 bg-slate-100">S</td>`;
        } else if (leaveType === 'izin') {
         rowHTML += `<td class="p-1 border-r border-b border-slate-200"></td>`;
        } else if (leaveType) {
         rowHTML += `<td class="p-1 border-r border-b border-slate-200 font-black text-slate-800 bg-slate-100">AL</td>`;
        } else {
         rowHTML += `<td class="p-1 border-r border-b border-slate-200 text-slate-300 font-bold">-</td>`;
        }
       }
      });

      rowHTML += `<td class="p-2 border-b border-slate-200 font-black text-slate-900 bg-slate-100">${totalHariKerja}</td></tr>`;
      rowsHTML.push(rowHTML);
     });
    }

    tbody.innerHTML = rowsHTML.join('');
   } catch (err) {
    console.error('Error in renderMatrixTable:', err);
   }
  }

  // =========================================================
  // FITUR COPY TABEL MATRIKS KE CLIPBOARD
  // =========================================================
  function copyMatrixTable() {
   if (!hasPermission('perm_rep_copy_matrix') && !isUserAdmin(currentUser) && !isUserManager(currentUser)) {
    alert('Akses Ditolak: Anda tidak memiliki izin untuk menyalin data matriks ke clipboard.');
    return;
   }
   let startStr = document.getElementById('matrix-start-date')?.value;
   let endStr = document.getElementById('matrix-end-date')?.value;
   if (!startStr || !endStr) {
    alert('Silakan tentukan rentang tanggal matriks terlebih dahulu.');
    return;
   }
   if (startStr > endStr) {
    const tmp = startStr;
    startStr = endStr;
    endStr = tmp;
   }

   // Pastikan tabel sudah ter-render terbaru
   renderMatrixTable();

   const selectedOS = (document.getElementById('matrix-filter-os')?.value || 'ALL').trim();
   const dateList = getDatesInRange(startStr, endStr);
   const dateKeys = dateList.map(d => getLocalDateString(d));
   const allMatrixUsers = getMatrixEmployees(activeWarehouse);
   let regularUsers = allMatrixUsers;
   if (selectedOS !== 'ALL') {
    regularUsers = regularUsers.filter(u => isMatchOS(u.outsource, selectedOS));
   }
   const attendances = getWhDB(activeWarehouse, 'attendance', activeWarehouse === 'MBI' ? SEED_MBI_ATTENDANCE : SEED_MAI_ATTENDANCE);
   const leaves = getWhDB(activeWarehouse, 'leaves', activeWarehouse === 'MBI' ? SEED_MBI_LEAVES : []);

   const copyIdentityIdx = buildEmployeeIdentityIndex(getWhDB(activeWarehouse, 'users', activeWarehouse === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS));
    const attSet = buildMatrixAttendanceSet(attendances, copyIdentityIdx);
    const leaveMap = buildMatrixLeaveMap(leaves, copyIdentityIdx);

    // 1. Format TSV (Tab-Separated Values) - Nomor, Nama Karyawan, NIK, dan Outsourcing
   const headerRow = ['No', 'Nama Karyawan', 'NIK', 'Outsourcing'];
   dateList.forEach(d => {
    const dayNum = d.getDate();
    const dayName = DAY_NAMES[d.getDay()];
    headerRow.push(`${dayNum} (${dayName})`);
   });
   headerRow.push('Total Hadir');

   const tsvRows = [headerRow.join('\t')];

   regularUsers.forEach((user, uIdx) => {
    let totalHariKerja = 0;
    const osVal = user.outsource || 'Internal';
    const row = [uIdx + 1, user.name, user.nik, osVal];
    const uNik = user.nik ? user.nik.toUpperCase() : '';
    const uCleanName = user.name ? cleanStr(user.name) : '';
    const uId = user.id || '';

    dateKeys.forEach(dStr => {
     const isAtt = attSet.has(`${matrixKeyForUser(user)}__${dStr}`);

     if (isAtt) {
      totalHariKerja += 1;
      row.push('1');
     } else {
      const leaveType = leaveMap.get(`${matrixKeyForUser(user)}__${dStr}`);
      if (leaveType === 'sakit') {
       row.push('S');
      } else if (leaveType === 'izin') {
       row.push('');
      } else if (leaveType) {
       row.push('AL');
      } else {
       row.push('-');
      }
     }
    });

    row.push(totalHariKerja);
    tsvRows.push(row.join('\t'));
   });

   const tsvString = tsvRows.join('\n');

   // 2. Format HTML Table untuk rich paste (Excel / Spreadsheet / Word)
   const tableEl = document.getElementById('table-matrix-display');
   const htmlString = tableEl ? tableEl.outerHTML : '';

   const notifySuccess = () => {
    const btnText = document.getElementById('btn-copy-matrix-text');
    const btn = document.getElementById('btn-copy-matrix');
    if (btnText && btn) {
     const origText = btnText.innerText;
     btnText.innerText = 'Tersalin!';
     btn.className = 'h-9 px-4 bg-slate-900 text-white text-xs font-bold rounded-xl transition shadow-xs inline-flex items-center';

     setTimeout(() => {
      btnText.innerText = origText;
      btn.className = 'h-9 px-4 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-xs font-bold rounded-xl transition shadow-xs inline-flex items-center';
     }, 2000);
    }
    alert('Å“â€¦ Seluruh data matriks presensi berhasil disalin ke clipboard!\n\nAnda dapat langsung menempelkannya (Ctrl + V / Paste) ke Excel, Google Sheets, atau aplikasi chat.');
   };

   const fallbackCopy = (text) => {
    if (navigator.clipboard && navigator.clipboard.writeText) {
     navigator.clipboard.writeText(text).then(notifySuccess).catch(() => execFallback(text));
    } else {
     execFallback(text);
    }
   };

   const execFallback = (text) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.top = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
     document.execCommand('copy');
     notifySuccess();
    } catch (err) {
     alert('Gagal menyalin matriks ke clipboard otomatis. Silakan gunakan tombol Download Excel.');
    }
    document.body.removeChild(ta);
   };

   if (navigator.clipboard && window.ClipboardItem) {
    const clipboardObj = {
     'text/plain': new Blob([tsvString], { type: 'text/plain' })
    };
    if (htmlString) {
     clipboardObj['text/html'] = new Blob([htmlString], { type: 'text/html' });
    }
    navigator.clipboard.write([new ClipboardItem(clipboardObj)]).then(notifySuccess).catch(() => {
     fallbackCopy(tsvString);
    });
   } else {
    fallbackCopy(tsvString);
   }
  }

  function exportMatrixToExcel() {
   if (!hasPermission('perm_rep_download_excel') && !isUserAdmin(currentUser) && !isUserManager(currentUser)) {
    alert('Akses Ditolak: Anda tidak memiliki izin untuk mengunduh laporan ke Excel.');
    return;
   }
   let startStr = document.getElementById('matrix-start-date')?.value;
   let endStr = document.getElementById('matrix-end-date')?.value;
   if (!startStr || !endStr) return;
   if (startStr > endStr) {
    const tmp = startStr;
    startStr = endStr;
    endStr = tmp;
   }
   const selectedOS = (document.getElementById('matrix-filter-os')?.value || 'ALL').trim();
   const dateList = getDatesInRange(startStr, endStr);
   const allMatrixUsers = getMatrixEmployees(activeWarehouse);
   let regularUsers = allMatrixUsers;
   if (selectedOS !== 'ALL') {
    regularUsers = regularUsers.filter(u => isMatchOS(u.outsource, selectedOS));
   }
   const attendances = getWhDB(activeWarehouse, 'attendance', activeWarehouse === 'MBI' ? SEED_MBI_ATTENDANCE : SEED_MAI_ATTENDANCE);
   const leaves = getWhDB(activeWarehouse, 'leaves', activeWarehouse === 'MBI' ? SEED_MBI_LEAVES : []);

   // Kelompokkan Tanggal berdasarkan Bulan
   const monthGroups = [];
   dateList.forEach(d => {
    const monthKey = d.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    let group = monthGroups.find(g => g.name === monthKey);
    if (!group) {
     group = { name: monthKey, dates: [] };
     monthGroups.push(group);
    }
    group.dates.push(d);
   });

   // Row 1: Header Bulan
   const row1 = ["No", "Nama Karyawan", "NIK", "Outsourcing"];
   const merges = [
    { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } }, // No
    { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } }, // Nama Karyawan
    { s: { r: 0, c: 2 }, e: { r: 1, c: 2 } }, // NIK
    { s: { r: 0, c: 3 }, e: { r: 1, c: 3 } } // Outsourcing
   ];

   let currentCol = 4;
   monthGroups.forEach(g => {
    row1.push(g.name.toUpperCase());
    for (let i = 1; i < g.dates.length; i++) {
     row1.push("");
    }
    if (g.dates.length > 1) {
     merges.push({ s: { r: 0, c: currentCol }, e: { r: 0, c: currentCol + g.dates.length - 1 } });
    }
    currentCol += g.dates.length;
   });

   row1.push("Total Hadir (H)", "Total Sakit (S)", "Total Cuti (AL)", "Total Hari Hadir");
   for (let s = 0; s < 4; s++) {
    merges.push({ s: { r: 0, c: currentCol + s }, e: { r: 1, c: currentCol + s } });
   }

   // Row 2: Header Tanggal & Hari
   const row2 = ["", "", "", ""];
   dateList.forEach(d => {
    row2.push(`${d.getDate()} (${DAY_NAMES[d.getDay()]})`);
   });
   row2.push("", "", "", "");

   const matrixData = [row1, row2];

   regularUsers.forEach((user, uIdx) => {
    let totalHadir = 0;
    let totalSakit = 0;
    let totalCuti = 0;
    const osVal = user.outsource || 'Internal';

    const row = [uIdx + 1, user.name, user.nik, osVal];
    dateList.forEach(d => {
     const dStr = getLocalDateString(d);
     const att = attendances.find(a => {
      if (!a) return false;
      const isUser = (a.userName && cleanStr(a.userName) === cleanStr(user.name)) || 
              (a.userNik && a.userNik.toUpperCase() === user.nik.toUpperCase()) || 
              (a.userId && a.userId === user.id);
      if (!isUser) return false;
      const localCheckIn = a.checkInTime ? getLocalDateString(new Date(a.checkInTime)) : '';
      return a.date === dStr || localCheckIn === dStr;
     });
     const approvedLeave = leaves.find(l => {
      if (!l || l.status !== 'approved') return false;
      const isUser = (l.userName && cleanStr(l.userName) === cleanStr(user.name)) || 
              (l.userNik && l.userNik.toUpperCase() === user.nik.toUpperCase()) || 
              (l.userId && l.userId === user.id);
      return isUser && l.startDate <= dStr && l.endDate >= dStr;
     });

     if (att) {
      totalHadir += 1;
      row.push(1);
     } else if (approvedLeave) {
      if (approvedLeave.type === 'sakit') {
       totalSakit += 1;
       row.push("S");
      } else if (approvedLeave.type === 'izin') {
       row.push(""); // Dikosongkan jika izin sesuai arahan
      } else {
       totalCuti += 1;
       row.push("AL");
      }
     } else {
      row.push("-");
     }
    });

    row.push(totalHadir, totalSakit, totalCuti, totalHadir);
    matrixData.push(row);
   });

   const ws = XLSX.utils.aoa_to_sheet(matrixData);
   ws['!merges'] = merges;

   const wb = XLSX.utils.book_new();
   const osTag = selectedOS && selectedOS !== 'ALL' ? `_${selectedOS.replace(/[^a-zA-Z0-9]/g, '_')}` : '';
   XLSX.utils.book_append_sheet(wb, ws, `Matriks_${activeWarehouse}`);
   XLSX.writeFile(wb, `Rekap_Absen_Matriks_${activeWarehouse}${osTag}_${startStr}_sd_${endStr}.xlsx`);
  }

  // =========================================================