// === WFM MEDIKA ID CARD GENERATOR ===
  // FITUR KARTU ID DIGITAL (CR80: 54mm x 85.6mm)
  // =========================================================
  function getQrCodeUrl(text) {
   return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(text)}&margin=1`;
  }

  function renderLocationQRCode() {
   const img = document.getElementById('img-qrcode-location');
   if (img) {
    img.src = getQrCodeUrl(OFFICIAL_WAREHOUSE_MAPS_URL);
   }
  }

  function populateDropdownEmployees(targetNik = null) {
   const users = getWhDB(activeWarehouse, 'users', activeWarehouse === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);
   const regularUsers = users.filter(u => !isManagementSystemAccount(u));
   regularUsers.sort((a, b) => {
    const nikA = (a?.nik || a?.id || '').toString().trim().toUpperCase();
    const nikB = (b?.nik || b?.id || '').toString().trim().toUpperCase();
    return nikA.localeCompare(nikB, undefined, { numeric: true, sensitivity: 'base' });
   });
   
   const idSelect = document.getElementById('idcard-select-emp');
   const prevSelected = (targetNik || (idSelect ? idSelect.value : '') || '').trim().toUpperCase();

   if (idSelect) {
    idSelect.innerHTML = '';
    if (regularUsers.length === 0) {
     const opt = document.createElement('option');
     opt.value = '';
     opt.innerText = `-- Belum Ada Karyawan di Gudang ${activeWarehouse} --`;
     idSelect.appendChild(opt);
    } else {
     regularUsers.forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.nik;
      const uDept = (u.dept || 'STAFF').trim().toUpperCase();
      opt.innerText = `${u.name} (${u.nik}) - ${uDept}`;
      if (prevSelected && (u.nik || '').toUpperCase() === prevSelected) {
       opt.selected = true;
      }
      idSelect.appendChild(opt);
     });

     // Pastikan ada yang terpilih jika belum
     if (!idSelect.value && regularUsers.length > 0) {
      idSelect.value = regularUsers[0].nik;
     }
    }
   }

   filterLeaveEmployeeDropdown(document.getElementById('leave-emp-search-input')?.value || '');
   renderSelectedIDCard(idSelect ? idSelect.value : null);
  }

  function filterLeaveEmployeeDropdown(query = '') {
   const users = getWhDB(activeWarehouse, 'users', activeWarehouse === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);
   const regularUsers = users.filter(u => !isManagementSystemAccount(u));
   regularUsers.sort((a, b) => {
    const nikA = (a?.nik || a?.id || '').toString().trim().toUpperCase();
    const nikB = (b?.nik || b?.id || '').toString().trim().toUpperCase();
    return nikA.localeCompare(nikB, undefined, { numeric: true, sensitivity: 'base' });
   });
   const leaveSelect = document.getElementById('leave-employee');
   if (!leaveSelect) return;

   const currentVal = leaveSelect.value;
   const q = query.toLowerCase().trim();
   const filtered = regularUsers.filter(u => u.status !== 'inactive' && (!q || (u.name && u.name.toLowerCase().includes(q)) || (u.nik && u.nik.toLowerCase().includes(q)) || (u.dept && u.dept.toLowerCase().includes(q))));

   leaveSelect.innerHTML = '';
   if (filtered.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.innerText = '-- Karyawan tidak ditemukan --';
    leaveSelect.appendChild(opt);
    return;
   }

   const hasCurrentInFiltered = currentVal && filtered.some(u => u.nik === currentVal);
   const hasSelfInFiltered = !currentVal && currentUser && filtered.some(u => u.nik === currentUser.nik);
   if (filtered.length > 1 || (!hasCurrentInFiltered && !hasSelfInFiltered)) {
    const ph = document.createElement('option');
    ph.value = '';
    ph.innerText = `-- Pilih Karyawan (${filtered.length}) --`;
    if (!hasCurrentInFiltered && !hasSelfInFiltered && !(q && filtered.length === 1)) {
     ph.selected = true;
    }
    leaveSelect.appendChild(ph);
   }

   filtered.forEach((u, idx) => {
    const opt = document.createElement('option');
    opt.value = u.nik;
    const uDept = (u.dept || 'STAFF').trim().toUpperCase();
    opt.innerText = `${u.name} (${u.nik}) - ${uDept}`;
    if (hasCurrentInFiltered && u.nik === currentVal) {
     opt.selected = true;
    } else if (hasSelfInFiltered && currentUser && u.nik === currentUser.nik) {
     opt.selected = true;
    } else if (q && filtered.length === 1 && idx === 0) {
     opt.selected = true;
    }
    leaveSelect.appendChild(opt);
   });
  }

  function renderSelectedIDCard(targetNik = null) {
   const select = document.getElementById('idcard-select-emp');
   if (targetNik && select) {
    select.value = targetNik;
   }
   const rawNik = (select ? select.value : '') || targetNik || '';
   const cleanNik = (rawNik || '').trim().toUpperCase();
   const users = getWhDB(activeWarehouse, 'users', activeWarehouse === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);
   const regularUsers = users.filter(u => !isManagementSystemAccount(u));
   
   let user = regularUsers.find(u => (u.nik || '').trim().toUpperCase() === cleanNik);
   if (!user && regularUsers.length > 0) {
    user = regularUsers[0];
    if (select) select.value = user.nik;
   }
   if (user) {
    const cardUser = { ...user, warehouse: activeWarehouse };
    renderIDCard(cardUser);
   } else {
    const emptyUser = {
     name: 'Belum Ada Karyawan',
     nik: `${activeWarehouse}26-001`,
     dept: 'Warehouse Staff',
     warehouse: activeWarehouse
    };
    renderIDCard(emptyUser);
   }
  }

  function getMBILogoHTML(height = 20) {
   return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 460 66" style="height: ${height}px; width: auto; max-width: 180px; display: block;" fill="none">
     <g transform="translate(6, 4) scale(0.28)">
      <!-- 1. Golden Yellow Head Circle -->
      <circle cx="100" cy="38" r="28" fill="#F7B200"/>
      <!-- 2. Cyan Right Capsule (+45 deg around 128, 114) -->
      <rect x="97" y="47" width="62" height="134" rx="31" fill="#24D3E3" transform="rotate(45 128 114)"/>
      <!-- 3. Pink Left Capsule (-45 deg around 72, 114, overlapping on top) -->
      <rect x="41" y="47" width="62" height="134" rx="31" fill="#EE1D78" transform="rotate(-45 72 114)"/>
     </g>
     <text x="70" y="44" font-family="'Plus Jakarta Sans', 'Segoe UI', Montserrat, Roboto, sans-serif" font-weight="800" font-size="31" fill="#0B4B8A" letter-spacing="-0.2px">Medika Bina Investama</text>
    </svg>
   `;
  }

  function getMAILogoHTML(height = 20) {
   return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 460 66" style="height: ${height}px; width: auto; max-width: 180px; display: block;" fill="none">
     <g transform="translate(6, 6) scale(0.54)">
      <rect x="8" y="36" width="56" height="28" rx="14" fill="#FDB913"/>
      <rect x="36" y="36" width="28" height="56" rx="14" fill="#FDB913"/>
      <path d="M 36,22 A 14,14 0 0,1 64,22 L 64,36 L 78,36 A 14,14 0 0,1 78,64 L 50,64 A 14,14 0 0,1 36,50 Z" fill="#E30638"/>
     </g>
     <text x="70" y="44" font-family="'Plus Jakarta Sans', 'Segoe UI', Montserrat, Roboto, sans-serif" font-weight="800" font-size="31" fill="#E30638" letter-spacing="-0.2px">Medika Akses Investama</text>
    </svg>
   `;
  }

  function renderIDCard(user) {
   if (!user) return;
   const deptText = (user.dept || 'STAFF').trim().toUpperCase();
   const nameText = user.name || 'NAMA KARYAWAN';
   const nikText = user.nik || '-';
   const whText = user.warehouse || activeWarehouse || 'MBI';

   const nameEl = document.getElementById('idcard-name');
   if (nameEl) nameEl.innerText = nameText;

   const deptEl = document.getElementById('idcard-dept');
   if (deptEl) deptEl.innerText = deptText;

   const nikEl = document.getElementById('idcard-nik');
   if (nikEl) nikEl.innerText = nikText;

   const whBadgeEl = document.getElementById('idcard-wh-badge');
   if (whBadgeEl) whBadgeEl.innerText = whText;

   const avatarInitial = document.getElementById('idcard-avatar-initial');
   if (avatarInitial) {
    avatarInitial.innerText = (user.name || 'U').charAt(0).toUpperCase();
   }

   const isMBI = whText === 'MBI';
   const headerEl = document.getElementById('idcard-header');
   if (headerEl) {
    headerEl.style.backgroundColor = isMBI ? '#0369a1' : '#7c3aed';
   }

   const subEl = document.getElementById('idcard-header-sub');
   if (subEl) {
    subEl.style.color = isMBI ? '#bae6fd' : '#fbcfe8';
   }

   const logoContainer = document.getElementById('idcard-header-logo-container');
   if (logoContainer) {
    logoContainer.innerHTML = isMBI ? getMBILogoHTML(20) : getMAILogoHTML(20);
   }

   const footerEl = document.getElementById('idcard-footer-text');
   if (footerEl) {
    footerEl.innerText = isMBI 
     ? 'OFFICIAL EMPLOYEE ID CARD • MEDIKA BINA INVESTAMA'
     : 'OFFICIAL EMPLOYEE ID CARD • MEDIKA AKSES INVESTAMA';
   }

   const img = document.getElementById('img-qrcode-emp');
   if (img && user.nik) {
    img.src = getQrCodeUrl(user.nik);
   }
  }

  function renderIDCardAndShow(nik) {
   switchView('idcard');
   populateDropdownEmployees(nik);
   const users = getWhDB(activeWarehouse, 'users', activeWarehouse === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);
   const targetUser = users.find(u => (u.nik || '').trim().toUpperCase() === (nik || '').trim().toUpperCase());
   if (targetUser) {
    const select = document.getElementById('idcard-select-emp');
    if (select) select.value = targetUser.nik;
    renderIDCard(targetUser);
   }
  }

  function printCard(type) {
   const printArea = document.getElementById('printable-area');
   if (type === 'idcard') {
    const idCardHtml = document.getElementById('printable-id-card').outerHTML;
    printArea.innerHTML = `<div style="display:flex; justify-content:center; align-items:center; min-height:80vh; padding:15mm 0;">${idCardHtml}</div>`;
   } else {
    const locCardHtml = document.getElementById('printable-location-card').outerHTML;
    printArea.innerHTML = `<div style="display:flex; justify-content:center; align-items:center; min-height:80vh; padding:15mm 0;">${locCardHtml}</div>`;
   }
   setTimeout(() => {
    window.print();
   }, 200);
  }

  // =========================================================
  // HIGH-PRECISION DIRECT HTML5 CANVAS ID CARD GENERATOR
  // (Super Cepat < 2ms per kartu, Zero-Clipping, Resolusi HD 640x1020)
  // =========================================================
  async function generateIDCardCanvas(user) {
   const canvas = document.createElement('canvas');
   const W = 640;
   const H = 1020;
   canvas.width = W;
   canvas.height = H;
   const ctx = canvas.getContext('2d');

   const isMBI = (user.warehouse || activeWarehouse) === 'MBI';
   const primaryColor = isMBI ? '#0284c7' : '#7c3aed';
   const darkColor = isMBI ? '#0369a1' : '#6d28d9';
   const lightBg = isMBI ? '#e0f2fe' : '#ede9fe';
   const badgeText = user.warehouse || activeWarehouse;

   // 1. Background Kartu Putih Bersih
   ctx.fillStyle = '#ffffff';
   ctx.beginPath();
   if (ctx.roundRect) ctx.roundRect(0, 0, W, H, 36);
   else ctx.rect(0, 0, W, H);
   ctx.fill();

   // Card Outer Border
   ctx.strokeStyle = '#0f172a';
   ctx.lineWidth = 5;
   ctx.beginPath();
   if (ctx.roundRect) ctx.roundRect(2.5, 2.5, W - 5, H - 5, 34);
   else ctx.rect(2.5, 2.5, W - 5, H - 5);
   ctx.stroke();

   // Clip area dalam kartu
   ctx.save();
   ctx.beginPath();
   if (ctx.roundRect) ctx.roundRect(0, 0, W, H, 36);
   else ctx.rect(0, 0, W, H);
   ctx.clip();

   // 2. Header Background (Gradient)
   const grad = ctx.createLinearGradient(0, 0, W, 130);
   grad.addColorStop(0, darkColor);
   grad.addColorStop(1, primaryColor);
   ctx.fillStyle = grad;
   ctx.fillRect(0, 0, W, 130);

   // Header Brand Subtitle
   ctx.fillStyle = isMBI ? '#bae6fd' : '#fbcfe8';
   ctx.font = 'bold 15px "Segoe UI", Roboto, sans-serif';
   ctx.textAlign = 'left';
   ctx.textBaseline = 'alphabetic';
   ctx.fillText('WORKFORCE MANAGEMENT', 32, 42);

   // Header Warehouse Badge Pill (Right side)
   const badgeW = 100;
   const badgeH = 48;
   const badgeX = W - 32 - badgeW;
   const badgeY = 56;
   ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
   ctx.beginPath();
   if (ctx.roundRect) ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 12);
   else ctx.rect(badgeX, badgeY, badgeW, badgeH);
   ctx.fill();
   ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
   ctx.lineWidth = 2;
   ctx.stroke();

   ctx.fillStyle = '#ffffff';
   ctx.font = '900 22px monospace, sans-serif';
   ctx.textAlign = 'center';
   ctx.textBaseline = 'middle';
   ctx.fillText(badgeText, badgeX + (badgeW / 2), badgeY + (badgeH / 2));

   // Header Company Logo Container (White Pill)
   const logoPillX = 32;
   const logoPillY = 56;
   const logoPillW = 340;
   const logoPillH = 48;

   ctx.fillStyle = '#ffffff';
   ctx.beginPath();
   if (ctx.roundRect) ctx.roundRect(logoPillX, logoPillY, logoPillW, logoPillH, 10);
   else ctx.rect(logoPillX, logoPillY, logoPillW, logoPillH);
   ctx.fill();

   // Shadow / subtle border on logo pill
   ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
   ctx.lineWidth = 1.5;
   ctx.stroke();

   // Draw SVG Logo into White Pill via 2D Canvas Vectors (Zero CORS, 100% Crisp)
   ctx.save();
   if (isMBI) {
    // Medika Bina Investama Logo (Icon Left: uploaded image object or calibrated vector; Text Right: Navy)
    ctx.translate(logoPillX + 12, logoPillY + 5);
    ctx.scale(0.58, 0.58);

    const logoImg = window.__mbiUploadedLogoImg;
    if (logoImg && logoImg.complete && logoImg.naturalWidth > 0) {
     // Draw authentic uploaded image file directly into the pill!
     ctx.drawImage(logoImg, 6, 10, 54, 54);
    } else {
     // Fallback vector drawing matching media_1790591977381.png
     ctx.save();
     ctx.translate(6, 6);
     ctx.scale(0.27, 0.27);

     // 1. Golden Yellow Head (Floating clearly above petals)
     ctx.fillStyle = '#F7B200';
     ctx.beginPath();
     ctx.arc(100, 38, 28, 0, Math.PI * 2);
     ctx.fill();

     // 2. Cyan Right Capsule (+45 deg around 128, 114)
     ctx.save();
     ctx.translate(128, 114);
     ctx.rotate(45 * Math.PI / 180);
     ctx.fillStyle = '#24D3E3';
     ctx.beginPath();
     if (ctx.roundRect) ctx.roundRect(-31, -67, 62, 134, 31);
     else ctx.rect(-31, -67, 62, 134);
     ctx.fill();
     ctx.restore();

     // 3. Pink Left Capsule (-45 deg around 72, 114, on top of cyan)
     ctx.save();
     ctx.translate(72, 114);
     ctx.rotate(-45 * Math.PI / 180);
     ctx.fillStyle = '#EE1D78';
     ctx.beginPath();
     if (ctx.roundRect) ctx.roundRect(-31, -67, 62, 134, 31);
     else ctx.rect(-31, -67, 62, 134);
     ctx.fill();
     ctx.restore();

     ctx.restore();
    }

    // Navy Brand Text
    ctx.fillStyle = '#0B4B8A';
    ctx.font = '800 30px "Plus Jakarta Sans", "Segoe UI", Montserrat, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('Medika Bina Investama', 70, 44);
   } else {
    // Medika Akses Investama Logo (Icon Left: Image 3 Heart Cross; Text Right: Crimson)
    ctx.translate(logoPillX + 12, logoPillY + 5);
    ctx.scale(0.58, 0.58);

    // Yellow Left Arm & Bottom Arm
    ctx.fillStyle = '#FDB913';
    ctx.beginPath();
    if (ctx.roundRect) {
     ctx.roundRect(8, 22, 28, 14, 7);
     ctx.roundRect(22, 22, 14, 28, 7);
    } else {
     ctx.rect(8, 22, 28, 14);
     ctx.rect(22, 22, 14, 28);
    }
    ctx.fill();

    // Crimson Red Top & Right with bottom-left rounded corner (Image 3)
    ctx.fillStyle = '#E30638';
    ctx.beginPath();
    if (ctx.roundRect) {
     ctx.roundRect(22, 8, 14, 28, 7);
     ctx.roundRect(22, 22, 28, 14, 7);
    } else {
     ctx.rect(22, 8, 14, 28);
     ctx.rect(22, 22, 28, 14);
    }
    ctx.fill();
    ctx.beginPath();
    ctx.arc(29, 29, 7, 0, Math.PI * 2);
    ctx.fill();

    // Crimson Brand Text
    ctx.fillStyle = '#E30638';
    ctx.font = '800 30px "Plus Jakarta Sans", "Segoe UI", Montserrat, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('Medika Akses Investama', 68, 44);
   }
   ctx.restore();

   // 3. Avatar Circle (Tengah Atas)
   const avatarX = W / 2;
   const avatarY = 210;
   const avatarR = 56;

   ctx.strokeStyle = primaryColor;
   ctx.lineWidth = 5;
   ctx.beginPath();
   ctx.arc(avatarX, avatarY, avatarR + 3, 0, Math.PI * 2);
   ctx.stroke();

   ctx.fillStyle = '#f0fdfa';
   ctx.beginPath();
   ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2);
   ctx.fill();

   ctx.fillStyle = darkColor;
   ctx.font = '900 52px "Segoe UI", Roboto, sans-serif';
   ctx.textAlign = 'center';
   ctx.textBaseline = 'middle';
   const initial = (user.name || 'U').charAt(0).toUpperCase();
   ctx.fillText(initial, avatarX, avatarY + 2);

   // 4. Employee Name
   ctx.fillStyle = '#0f172a';
   ctx.font = '900 30px "Segoe UI", Roboto, sans-serif';
   ctx.textBaseline = 'alphabetic';
   ctx.textAlign = 'center';
   let displayName = (user.name || 'NAMA KARYAWAN').toUpperCase();
   if (displayName.length > 22) {
    ctx.font = '900 24px "Segoe UI", Roboto, sans-serif';
   }
   ctx.fillText(displayName, W / 2, 320);

   // 5. Dept Badge + NIK Badge Pills Berdampingan
   const deptText = (user.dept || 'STAFF').toUpperCase();
   ctx.font = 'bold 20px "Segoe UI", Roboto, sans-serif';
   const deptMetrics = ctx.measureText(deptText);
   const deptPillW = Math.max(120, deptMetrics.width + 36);
   const deptPillH = 38;

   const nikText = user.nik || '-';
   ctx.font = 'bold 22px monospace, sans-serif';
   const nikMetrics = ctx.measureText(nikText);
   const nikPillW = Math.max(140, nikMetrics.width + 36);
   const nikPillH = 38;

   const gapBetweenPills = 14;
   const totalPillsW = deptPillW + gapBetweenPills + nikPillW;
   const startPillX = (W - totalPillsW) / 2;
   const pillsY = 345;

   // Draw Dept Pill
   ctx.fillStyle = lightBg;
   ctx.beginPath();
   if (ctx.roundRect) ctx.roundRect(startPillX, pillsY, deptPillW, deptPillH, 10);
   else ctx.rect(startPillX, pillsY, deptPillW, deptPillH);
   ctx.fill();
   ctx.strokeStyle = isMBI ? '#bae6fd' : '#ddd6fe';
   ctx.lineWidth = 1.5;
   ctx.stroke();

   ctx.fillStyle = primaryColor;
   ctx.font = '800 20px "Segoe UI", Roboto, sans-serif';
   ctx.textAlign = 'center';
   ctx.fillText(deptText, startPillX + (deptPillW / 2), pillsY + 26);

   // Draw NIK Pill
   const nikPillX = startPillX + deptPillW + gapBetweenPills;
   ctx.fillStyle = '#f8fafc';
   ctx.beginPath();
   if (ctx.roundRect) ctx.roundRect(nikPillX, pillsY, nikPillW, nikPillH, 10);
   else ctx.rect(nikPillX, pillsY, nikPillW, nikPillH);
   ctx.fill();
   ctx.strokeStyle = '#cbd5e1';
   ctx.lineWidth = 1.5;
   ctx.stroke();

   ctx.fillStyle = '#334155';
   ctx.font = '900 22px monospace, sans-serif';
   ctx.fillText(nikText, nikPillX + (nikPillW / 2), pillsY + 27);

   // 6. Decorative Divider
   const divY = 422;
   ctx.strokeStyle = '#e2e8f0';
   ctx.lineWidth = 2;
   ctx.beginPath();
   ctx.moveTo(35, divY);
   ctx.lineTo(210, divY);
   ctx.moveTo(430, divY);
   ctx.lineTo(605, divY);
   ctx.stroke();

   ctx.fillStyle = '#94a3b8';
   ctx.font = 'bold 15px "Segoe UI", Roboto, sans-serif';
   ctx.textAlign = 'center';
   ctx.fillText('BARCODE ABSENSI', W / 2, divY + 5);

   // 7. QR Code Box
   const qrBoxW = 400;
   const qrBoxH = 460;
   const qrBoxX = (W - qrBoxW) / 2;
   const qrBoxY = 455;

   ctx.fillStyle = '#f8fafc';
   ctx.beginPath();
   if (ctx.roundRect) ctx.roundRect(qrBoxX, qrBoxY, qrBoxW, qrBoxH, 24);
   else ctx.rect(qrBoxX, qrBoxY, qrBoxW, qrBoxH);
   ctx.fill();
   ctx.strokeStyle = '#e2e8f0';
   ctx.lineWidth = 2;
   ctx.stroke();

   // Load QR Code Image
   const qrSize = 340;
   const qrX = (W - qrSize) / 2;
   const qrY = qrBoxY + 22;

   ctx.fillStyle = '#ffffff';
   ctx.beginPath();
   if (ctx.roundRect) ctx.roundRect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 20, 16);
   else ctx.rect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 20);
   ctx.fill();
   ctx.strokeStyle = '#e2e8f0';
   ctx.lineWidth = 1;
   ctx.stroke();

   try {
    const qrImg = new Image();
    qrImg.crossOrigin = 'anonymous';
    await new Promise((resolve) => {
     qrImg.onload = () => resolve();
     qrImg.onerror = () => resolve();
     qrImg.src = getQrCodeUrl(user.nik);
    });
    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
   } catch (err) {
    console.error('Error drawing QR onto canvas:', err);
   }

   // QR Subtitle
   ctx.fillStyle = '#64748b';
   ctx.font = 'bold 18px "Segoe UI", Roboto, sans-serif';
   ctx.textAlign = 'center';
   ctx.fillText('Scan saat Masuk & Pulang Kerja', W / 2, qrBoxY + qrBoxH - 28);

   // 8. Footer Bar
   const footerH = 55;
   const footerY = H - footerH;
   ctx.fillStyle = '#f1f5f9';
   ctx.fillRect(0, footerY, W, footerH);
   ctx.strokeStyle = '#e2e8f0';
   ctx.lineWidth = 1.5;
   ctx.beginPath();
   ctx.moveTo(0, footerY);
   ctx.lineTo(W, footerY);
   ctx.stroke();

   ctx.fillStyle = '#64748b';
   ctx.font = 'bold 15px "Segoe UI", Roboto, sans-serif';
   ctx.textAlign = 'center';
   const companyFooter = isMBI ? 'MEDIKA BINA INVESTAMA' : 'MEDIKA AKSES INVESTAMA';
   ctx.fillText(`KARTU IDENTITAS RESMI • ${companyFooter}`, W / 2, footerY + 34);

   ctx.restore();

   return canvas;
  }

  async function generateLocationCardCanvas() {
   const canvas = document.createElement('canvas');
   const W = 640;
   const H = 1020;
   canvas.width = W;
   canvas.height = H;
   const ctx = canvas.getContext('2d');

   const primaryColor = '#d97706';
   const darkColor = '#b45309';

   // 1. Background Putih
   ctx.fillStyle = '#ffffff';
   ctx.beginPath();
   if (ctx.roundRect) ctx.roundRect(0, 0, W, H, 36);
   else ctx.rect(0, 0, W, H);
   ctx.fill();

   ctx.strokeStyle = '#b45309';
   ctx.lineWidth = 5;
   ctx.beginPath();
   if (ctx.roundRect) ctx.roundRect(2.5, 2.5, W - 5, H - 5, 34);
   else ctx.rect(2.5, 2.5, W - 5, H - 5);
   ctx.stroke();

   ctx.save();
   ctx.beginPath();
   if (ctx.roundRect) ctx.roundRect(0, 0, W, H, 36);
   else ctx.rect(0, 0, W, H);
   ctx.clip();

   // 2. Header
   const grad = ctx.createLinearGradient(0, 0, W, 130);
   grad.addColorStop(0, darkColor);
   grad.addColorStop(1, primaryColor);
   ctx.fillStyle = grad;
   ctx.fillRect(0, 0, W, 130);

   ctx.fillStyle = '#fde68a';
   ctx.font = 'bold 16px "Segoe UI", Roboto, sans-serif';
   ctx.textAlign = 'left';
   ctx.fillText('TITIK LOKASI RESMI', 32, 45);

   ctx.fillStyle = '#ffffff';
   ctx.font = '900 28px "Segoe UI", Roboto, sans-serif';
   ctx.fillText('GUDANG MEDIKA', 32, 85);

   const badgeW = 100;
   const badgeH = 44;
   const badgeX = W - 32 - badgeW;
   const badgeY = 43;
   ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
   ctx.beginPath();
   if (ctx.roundRect) ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 12);
   else ctx.rect(badgeX, badgeY, badgeW, badgeH);
   ctx.fill();
   ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
   ctx.lineWidth = 2;
   ctx.stroke();

   ctx.fillStyle = '#ffffff';
   ctx.font = '900 22px monospace, sans-serif';
   ctx.textAlign = 'center';
   ctx.fillText('RESMI', badgeX + (badgeW / 2), badgeY + 30);

   // 3. Location Icon
   const avatarX = W / 2;
   const avatarY = 210;
   const avatarR = 56;

   ctx.strokeStyle = '#f59e0b';
   ctx.lineWidth = 5;
   ctx.beginPath();
   ctx.arc(avatarX, avatarY, avatarR + 3, 0, Math.PI * 2);
   ctx.stroke();

   ctx.fillStyle = '#fef3c7';
   ctx.beginPath();
   ctx.arc(avatarX, avatarY, avatarR, 0, Math.PI * 2);
   ctx.fill();

   ctx.fillStyle = '#b45309';
   ctx.font = '50px sans-serif';
   ctx.textAlign = 'center';
   ctx.textBaseline = 'middle';
   ctx.fillText('Å¸â€œ ', avatarX, avatarY);

   // 4. Location Title
   ctx.fillStyle = '#0f172a';
   ctx.font = '900 28px "Segoe UI", Roboto, sans-serif';
   ctx.textBaseline = 'alphabetic';
   ctx.textAlign = 'center';
   ctx.fillText('QR CODE LOKASI GUDANG', W / 2, 320);

   // 5. Instruction Pill
   ctx.fillStyle = '#fef3c7';
   const pillW = 340;
   const pillH = 38;
   const pillX = (W - pillW) / 2;
   const pillsY = 345;
   ctx.beginPath();
   if (ctx.roundRect) ctx.roundRect(pillX, pillsY, pillW, pillH, 10);
   else ctx.rect(pillX, pillsY, pillW, pillH);
   ctx.fill();
   ctx.strokeStyle = '#fde68a';
   ctx.lineWidth = 1.5;
   ctx.stroke();

   ctx.fillStyle = '#b45309';
   ctx.font = 'bold 20px "Segoe UI", Roboto, sans-serif';
   ctx.fillText('Langkah 1: Scan Barcode Ini', W / 2, pillsY + 26);

   // 6. Decorative Divider
   const divY = 422;
   ctx.strokeStyle = '#fef08a';
   ctx.lineWidth = 2;
   ctx.beginPath();
   ctx.moveTo(35, divY);
   ctx.lineTo(180, divY);
   ctx.moveTo(460, divY);
   ctx.lineTo(605, divY);
   ctx.stroke();

   ctx.fillStyle = '#a16207';
   const cardEmpWh = currentCardEmployee?.warehouse || activeWarehouse || 'MBI';
   const cardWhCoords = getWarehouseCoords(cardEmpWh);
   const cardRadius = Number(cardWhCoords.radius) > 0 ? Number(cardWhCoords.radius) : 30;
   ctx.fillText(`VERIFIKASI GPS (${cardRadius} METER)`, W / 2, divY + 5);

   // 7. QR Box
   const qrBoxW = 400;
   const qrBoxH = 460;
   const qrBoxX = (W - qrBoxW) / 2;
   const qrBoxY = 455;

   ctx.fillStyle = '#fefce8';
   ctx.beginPath();
   if (ctx.roundRect) ctx.roundRect(qrBoxX, qrBoxY, qrBoxW, qrBoxH, 24);
   else ctx.rect(qrBoxX, qrBoxY, qrBoxW, qrBoxH);
   ctx.fill();
   ctx.strokeStyle = '#fef08a';
   ctx.lineWidth = 2;
   ctx.stroke();

   const qrSize = 340;
   const qrX = (W - qrSize) / 2;
   const qrY = qrBoxY + 22;

   ctx.fillStyle = '#ffffff';
   ctx.beginPath();
   if (ctx.roundRect) ctx.roundRect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 20, 16);
   else ctx.rect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 20);
   ctx.fill();
   ctx.strokeStyle = '#fef08a';
   ctx.lineWidth = 1;
   ctx.stroke();

   try {
    const qrImg = new Image();
    qrImg.crossOrigin = 'anonymous';
    await new Promise((resolve) => {
     qrImg.onload = () => resolve();
     qrImg.onerror = () => resolve();
     qrImg.src = getQrCodeUrl(OFFICIAL_WAREHOUSE_MAPS_URL);
    });
    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
   } catch (err) {
    console.error('Error drawing location QR:', err);
   }

   ctx.fillStyle = '#854d0e';
   ctx.font = 'bold 18px "Segoe UI", Roboto, sans-serif';
   ctx.textAlign = 'center';
   ctx.fillText('Pintu Masuk Gudang Medika', W / 2, qrBoxY + qrBoxH - 28);

   // 8. Footer
   const footerH = 55;
   const footerY = H - footerH;
   ctx.fillStyle = '#fefce8';
   ctx.fillRect(0, footerY, W, footerH);
   ctx.strokeStyle = '#fef08a';
   ctx.lineWidth = 1.5;
   ctx.beginPath();
   ctx.moveTo(0, footerY);
   ctx.lineTo(W, footerY);
   ctx.stroke();

   ctx.fillStyle = '#854d0e';
   ctx.font = 'bold 16px "Segoe UI", Roboto, sans-serif';
   ctx.textAlign = 'center';
   ctx.fillText('WAJIB DITEMPEL DI PINTU MASUK GUDANG', W / 2, footerY + 34);

   ctx.restore();

   return canvas;
  }

  async function downloadIDCardImage() {
   const select = document.getElementById('idcard-select-emp');
   const cleanNik = (select?.value || '').trim().toUpperCase();
   const users = getWhDB(activeWarehouse, 'users', activeWarehouse === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);
   const user = users.find(u => (u.nik || '').trim().toUpperCase() === cleanNik) || currentUser;
   if (!user) return;
   const filename = `ID_Card_${user.nik}_${user.name.replace(/\s+/g, '_')}.png`;

   try {
    const canvas = await generateIDCardCanvas(user);
    const a = document.createElement('a');
    a.download = filename;
    a.href = canvas.toDataURL('image/png');
    a.click();
   } catch (err) {
    console.error('Download card error:', err);
    window.print();
   }
  }

  async function downloadLocationQRCodeImage() {
   try {
    const canvas = await generateLocationCardCanvas();
    const a = document.createElement('a');
    a.download = `QR_Lokasi_Gudang_${activeWarehouse}.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
   } catch (err) {
    console.error('Download QR location error:', err);
    window.print();
   }
  }

  // =========================================================
  // CETAK & DOWNLOAD MASAL SEMUA ID CARD (CR80: 54mm x 85.6mm)
  // =========================================================
  function createSingleCR80CardHTML(user, isPrint = false, customId = '') {
   const isMBI = (user.warehouse || activeWarehouse) === 'MBI';
   const headerColor = isMBI ? '#0369a1' : '#7c3aed';
   const badgeText = user.warehouse || activeWarehouse;
   const qrUrl = getQrCodeUrl(user.nik);
   const idAttr = customId ? `id="${customId}"` : '';
   const displayName = (user.name && typeof isLikelyIdNotName === 'function' && !isLikelyIdNotName(user.name)) ? user.name : (user.nik ? `Karyawan (${user.nik})` : (user.name || 'Karyawan'));

   if (isPrint) {
    // Layout Khusus Cetak Lembar A4 (Unit Milimeter)
    return `
     <div class="cr80-print-card" style="width: 54mm; height: 85.6mm; max-width: 54mm; max-height: 85.6mm; box-sizing: border-box; border: 1px dashed #94a3b8; border-radius: 3.5mm; overflow: hidden; background: #ffffff; display: flex; flex-direction: column; justify-content: space-between; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; position: relative; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
      <div style="height: 12mm; background-color: ${headerColor}; color: #ffffff; display: flex; align-items: center; justify-content: space-between; padding: 1.5mm 2.5mm; box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
       <div style="text-align: left; display: flex; flex-direction: column; justify-content: center;">
        <span style="font-size: 4.5pt; font-weight: 800; letter-spacing: 0.08em; color: ${isMBI ? '#bae6fd' : '#fbcfe8'}; display: block; line-height: 1; margin-bottom: 0.8mm;">WORKFORCE MANAGEMENT</span>
        <div style="background: #ffffff; border-radius: 1mm; padding: 0.6mm 1.5mm; display: inline-flex; align-items: center; box-shadow: 0 0.5px 1.5px rgba(0,0,0,0.12); -webkit-print-color-adjust: exact; print-color-adjust: exact;">
         ${isMBI ? getMBILogoHTML(12) : getMAILogoHTML(12)}
        </div>
       </div>
       <div style="background-color: rgba(255, 255, 255, 0.25); border-radius: 1.5mm; padding: 0.8mm 2mm; display: inline-flex; align-items: center; justify-content: center; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
        <span style="font-size: 6.5pt; font-weight: 900; font-family: monospace; color: #ffffff; line-height: 1;">${badgeText}</span>
       </div>
      </div>

      <div style="flex: 1; padding: 1.5mm 2.5mm; display: flex; flex-direction: column; align-items: center; justify-content: space-evenly; text-align: center; box-sizing: border-box;">
       <div style="width: 7mm; height: 7mm; border-radius: 9999px; background-color: #f1f5f9; border: 0.3mm solid #cbd5e1; display: flex; align-items: center; justify-content: center; color: #334155; font-weight: 900; font-size: 7.5pt; line-height: 1; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
        ${(displayName || 'U').charAt(0).toUpperCase()}
       </div>

       <div style="width: 100%;">
        <div style="font-size: 7.5pt; font-weight: 900; color: #0f172a; line-height: 1.2; text-transform: uppercase;">
         ${displayName}
        </div>
        <div style="margin-top: 0.4mm;">
         <span style="font-size: 5.5pt; font-weight: 800; color: #0284c7; background-color: #e0f2fe; border-radius: 1mm; padding: 0.4mm 1.8mm; text-transform: uppercase; display: inline-block; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
          ${(user.dept || 'STAFF').trim().toUpperCase()}
         </span>
        </div>
        <div style="margin-top: 0.6mm;">
         <span style="font-size: 6.5pt; font-family: monospace; font-weight: 900; color: #0f172a; background-color: #f8fafc; border: 0.3mm solid #cbd5e1; border-radius: 9999px; padding: 0.4mm 2.2mm; display: inline-block; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
          ${user.nik}
         </span>
        </div>
       </div>

       <div style="padding: 1mm; background-color: #ffffff; border-radius: 2mm; border: 0.3mm solid #e2e8f0; display: flex; align-items: center; justify-content: center;">
        <img src="${qrUrl}" alt="QR Code ${user.nik}" crossorigin="anonymous" style="width: 25mm; height: 25mm; max-width: 25mm; max-height: 25mm; background-color: #ffffff; object-fit: contain; display: block;">
       </div>
      </div>

      <div style="height: 4.5mm; text-align: center; background-color: #f8fafc; border-top: 0.3mm solid #f1f5f9; display: flex; align-items: center; justify-content: center; -webkit-print-color-adjust: exact; print-color-adjust: exact;">
       <span style="font-size: 4.5pt; font-weight: 800; color: #64748b; letter-spacing: 0.05em; text-transform: uppercase;">Official Employee ID Card • ${isMBI ? 'Medika Bina Investama' : 'Medika Akses Investama'}</span>
      </div>
     </div>
    `;
   }

   // Layout Presisi Digital Screen & Image PNG Export (320px x 510px CR80 Ratio)
   return `
    <div ${idAttr} class="cr80-card-export" style="width: 320px; height: 510px; min-width: 320px; min-height: 510px; max-width: 320px; max-height: 510px; box-sizing: border-box; border: 2px solid #0f172a; border-radius: 18px; overflow: hidden; background: #ffffff; display: flex; flex-direction: column; justify-content: space-between; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; position: relative; box-shadow: 0 6px 16px rgba(0,0,0,0.1);">
     
     <!-- Card Header -->
     <div style="height: 66px; flex-shrink: 0; padding: 8px 14px; background-color: ${headerColor}; color: #ffffff; display: flex; align-items: center; justify-content: space-between; box-sizing: border-box;">
      <div style="text-align: left; display: flex; flex-direction: column; justify-content: center;">
       <span style="font-size: 7.5px; font-weight: 800; letter-spacing: 0.12em; color: ${isMBI ? '#bae6fd' : '#fbcfe8'}; display: block; line-height: 1; margin: 0 0 3px 0;">WORKFORCE MANAGEMENT</span>
       <div style="background: #ffffff; border-radius: 6px; padding: 2.5px 8px; display: inline-flex; align-items: center; box-shadow: 0 1px 3px rgba(0,0,0,0.12);">
        ${isMBI ? getMBILogoHTML(20) : getMAILogoHTML(20)}
       </div>
      </div>
      <div style="background-color: rgba(255, 255, 255, 0.25); border-radius: 8px; padding: 4px 10px; display: inline-flex; align-items: center; justify-content: center; border: 1px solid rgba(255, 255, 255, 0.4);">
       <span style="font-size: 11px; font-weight: 900; font-family: monospace; color: #ffffff; line-height: 1;">${badgeText}</span>
      </div>
     </div>

     <!-- Card Body -->
     <div style="flex: 1; padding: 14px 16px 8px; display: flex; flex-direction: column; align-items: center; text-align: center; box-sizing: border-box; background: #ffffff; gap: 8px;">
      
      <!-- Avatar Frame -->
      <div style="width: 60px; height: 60px; border-radius: 9999px; background-color: #f0fdfa; border: 3px solid #0284c7; box-shadow: 0 4px 10px rgba(0,0,0,0.08); display: flex; align-items: center; justify-content: center; color: #0369a1; font-weight: 900; font-size: 24px; line-height: 1; flex-shrink: 0;">
       ${(displayName || 'U').charAt(0).toUpperCase()}
      </div>

      <!-- Employee Details -->
      <div style="width: 100%;">
       <h4 style="font-size: 16px; font-weight: 900; color: #0f172a; line-height: 1.25; margin: 0; word-break: break-word; text-transform: uppercase; letter-spacing: 0.02em;">${displayName}</h4>
       
       <div style="display: flex; justify-content: center; align-items: center; gap: 6px; margin-top: 5px; flex-wrap: wrap;">
        <span style="font-size: 10.5px; font-weight: 800; color: #0284c7; background-color: #e0f2fe; border: 1px solid #bae6fd; border-radius: 6px; padding: 2px 10px; text-transform: uppercase; letter-spacing: 0.04em; display: inline-block;">
         ${(user.dept || 'STAFF').trim().toUpperCase()}
        </span>
        <span style="font-size: 11.5px; font-family: monospace; font-weight: 800; color: #334155; background-color: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; padding: 2px 10px; line-height: 1.2; display: inline-block;">
         ${user.nik}
        </span>
       </div>
      </div>

      <!-- Decorative Divider with Title -->
      <div style="display: flex; align-items: center; width: 100%; margin: 2px 0;">
       <div style="flex: 1; height: 1px; background-color: #e2e8f0;"></div>
       <span style="font-size: 8px; font-weight: 800; color: #94a3b8; padding: 0 8px; letter-spacing: 0.08em; text-transform: uppercase;">Barcode Absensi</span>
       <div style="flex: 1; height: 1px; background-color: #e2e8f0;"></div>
      </div>

      <!-- QR Code Box -->
      <div style="background-color: #f8fafc; border-radius: 14px; border: 1.5px solid #e2e8f0; padding: 8px; display: flex; flex-direction: column; align-items: center; box-shadow: 0 2px 6px rgba(0,0,0,0.04); flex-shrink: 0;">
       <img src="${qrUrl}" alt="QR Code ${user.nik}" crossorigin="anonymous" style="width: 145px; height: 145px; background-color: #ffffff; border-radius: 6px; padding: 3px; object-fit: contain; display: block;">
       <span style="font-size: 8.5px; font-weight: 700; color: #64748b; margin-top: 4px;">Scan saat Masuk & Pulang</span>
      </div>
     </div>

     <!-- Card Footer -->
     <div style="height: 28px; flex-shrink: 0; padding: 0 12px; text-align: center; background-color: #f8fafc; border-top: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: center; box-sizing: border-box;">
      <p style="font-size: 8px; font-weight: 800; color: #64748b; letter-spacing: 0.08em; margin: 0; line-height: 1; text-transform: uppercase;">Official Employee ID Card • ${isMBI ? 'Medika Bina Investama' : 'Medika Akses Investama'}</p>
     </div>
    </div>
   `;
  }

  function switchAllCardsTab(tab) {
   const btnIndiv = document.getElementById('tab-btn-individual');
   const btnA4 = document.getElementById('tab-btn-a4');
   const cIndiv = document.getElementById('all-idcards-individual-container');
   const cA4 = document.getElementById('all-idcards-preview-container');

   if (tab === 'individual') {
    btnIndiv.className = 'px-3.5 py-1.5 rounded-lg text-xs font-bold bg-white text-slate-900 shadow-xs transition flex items-center gap-1.5';
    btnA4.className = 'px-3.5 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:text-slate-900 transition flex items-center gap-1.5';
    cIndiv.classList.remove('hidden');
    cA4.classList.add('hidden');
   } else {
    btnA4.className = 'px-3.5 py-1.5 rounded-lg text-xs font-bold bg-white text-slate-900 shadow-xs transition flex items-center gap-1.5';
    btnIndiv.className = 'px-3.5 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:text-slate-900 transition flex items-center gap-1.5';
    cA4.classList.remove('hidden');
    cIndiv.classList.add('hidden');
   }
   lucide.createIcons();
  }

  function filterAllIDCardsModal(query = '') {
   const q = query.toLowerCase().trim();
   const cards = document.querySelectorAll('.individual-card-box');
   cards.forEach(card => {
    const text = card.getAttribute('data-search') || '';
    if (!q || text.includes(q)) {
     card.classList.remove('hidden');
    } else {
     card.classList.add('hidden');
    }
   });
  }

  function openAllIDCardsA4Modal() {
   if (!hasPermission('perm_idcard_batch_a4') && !isUserAdmin(currentUser) && !isUserManager(currentUser)) {
    alert('Akses Ditolak: Anda tidak memiliki izin untuk mencetak / mengunduh ID Card batch A4.');
    return;
   }
   const users = getWhDB(activeWarehouse, 'users', activeWarehouse === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS).filter(u => !isManagementSystemAccount(u));
   users.sort((a, b) => {
    const nikA = (a?.nik || a?.id || '').toString().trim().toUpperCase();
    const nikB = (b?.nik || b?.id || '').toString().trim().toUpperCase();
    return nikA.localeCompare(nikB, undefined, { numeric: true, sensitivity: 'base' });
   });
   if (!users || users.length === 0) {
    alert('Tidak ada data karyawan di Gudang ' + activeWarehouse);
    return;
   }

   const badgeEl = document.getElementById('all-idcards-badge');
   if (badgeEl) badgeEl.innerText = `Gudang ${activeWarehouse}`;

   const totalPages = Math.ceil(users.length / 9);
   const descEl = document.getElementById('all-idcards-desc');
   if (descEl) {
    descEl.innerText = `Terdapat ${users.length} Kartu Karyawan • Standar CR80 (54mm â€” 85.6mm) • Teks Nama, Departemen & Barcode Sangat Jelas`;
   }

   // 1. RENDER INDIVIDUAL CARDS (Per 1 Karyawan)
   const indivGrid = document.getElementById('individual-cards-grid');
   indivGrid.innerHTML = '';

   users.forEach(u => {
    const box = document.createElement('div');
    box.className = 'individual-card-box flex flex-col items-center gap-2.5 p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs hover:shadow-md transition';
    box.setAttribute('data-search', `${u.name.toLowerCase()} ${u.nik.toLowerCase()} ${(u.dept || '').toLowerCase()}`);

    const cardHtml = createSingleCR80CardHTML(u, false, `indiv-card-${u.nik}`);
    box.innerHTML = `
     ${cardHtml}
     <button type="button" onclick="downloadSingleUserCardPNG('${u.nik}')" class="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs">
      <i data-lucide="download" class="w-3.5 h-3.5 text-teal-400"></i>
      <span>Download PNG</span>
     </button>
    `;
    indivGrid.appendChild(box);
   });

   // 2. RENDER A4 SHEETS (Lembar A4)
   const a4Container = document.getElementById('all-idcards-preview-container');
   a4Container.innerHTML = '';

   for (let i = 0; i < users.length; i += 9) {
    const pageNum = Math.floor(i / 9) + 1;
    const pageUsers = users.slice(i, i + 9);

    const pageWrapper = document.createElement('div');
    pageWrapper.className = 'w-full flex flex-col items-center space-y-2';

    const pageLabel = document.createElement('div');
    pageLabel.className = 'text-xs font-extrabold text-slate-500 flex items-center justify-between w-full max-w-[198mm] px-1';
    pageLabel.innerHTML = `<span>Å¸â€œâ€ž Lembar A4 - Halaman ${pageNum} dari ${totalPages} (${pageUsers.length} Kartu)</span><span class="text-[10px] text-teal-700 bg-teal-50 px-2 py-0.5 rounded font-bold">Siap Cetak / Potong</span>`;
    pageWrapper.appendChild(pageLabel);

    const sheetDiv = document.createElement('div');
    sheetDiv.className = 'preview-a4-sheet a4-sheet-canvas-target';
    sheetDiv.id = `preview-sheet-${pageNum}`;
    
    let cardsHtml = '';
    pageUsers.forEach(u => {
     cardsHtml += createSingleCR80CardHTML(u, true);
    });
    sheetDiv.innerHTML = cardsHtml;
    pageWrapper.appendChild(sheetDiv);

    a4Container.appendChild(pageWrapper);
   }

   switchAllCardsTab('individual');
   document.getElementById('all-idcards-search').value = '';
   document.getElementById('all-idcards-modal').classList.remove('hidden');
   lucide.createIcons();
  }

  function closeAllIDCardsA4Modal() {
   document.getElementById('all-idcards-modal').classList.add('hidden');
  }

  async function downloadSingleUserCardPNG(nik) {
   if (!hasPermission('perm_idcard_single') && !isUserAdmin(currentUser) && !isUserManager(currentUser)) {
    alert('Akses Ditolak: Anda tidak memiliki izin untuk mengunduh ID Card perorangan.');
    return;
   }
   const cleanNik = (nik || '').trim().toUpperCase();
   const users = getWhDB(activeWarehouse, 'users', activeWarehouse === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);
   const user = users.find(u => (u.nik || '').trim().toUpperCase() === cleanNik);
   if (!user) return;

   try {
    const canvas = await generateIDCardCanvas(user);
    const filename = `ID_Card_${user.nik}_${user.name.replace(/\s+/g, '_')}.png`;
    const a = document.createElement('a');
    a.download = filename;
    a.href = canvas.toDataURL('image/png');
    a.click();
   } catch (err) {
    console.error('Download card error:', err);
   }
  }

  async function downloadAllIndividualCardsZIP() {
   if (!hasPermission('perm_idcard_batch_a4') && !isUserAdmin(currentUser) && !isUserManager(currentUser)) {
    alert('Akses Ditolak: Anda tidak memiliki izin untuk mengunduh ID Card massal (ZIP).');
    return;
   }
   const users = getWhDB(activeWarehouse, 'users', activeWarehouse === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS).filter(u => !isManagementSystemAccount(u));
   if (!users || users.length === 0) return;

   if (typeof JSZip === 'undefined') {
    alert('Komponen ZIP belum siap. Mengunduh kartu 1 per 1...');
    downloadAllIndividualCardsSequentially();
    return;
   }

   const btn = document.getElementById('btn-zip-all-idcards');
   const originalText = btn ? btn.innerHTML : '';
   if (btn) {
    btn.innerHTML = `<span class="inline-block animate-spin mr-1"> </span><span>Mengemas ZIP (${users.length} Kartu)...</span>`;
    btn.disabled = true;
   }

   try {
    const zip = new JSZip();
    const folder = zip.folder(`ID_Cards_${activeWarehouse}`);

    // Generate all ID cards concurrently in parallel for blazing-fast performance (1-2s total)
    await Promise.all(users.map(async (u) => {
     const canvas = await generateIDCardCanvas(u);
     const base64Data = canvas.toDataURL('image/png').replace(/^data:image\/(png|jpg);base64,/, '');
     const filename = `ID_Card_${u.nik}_${u.name.replace(/\s+/g, '_')}.png`;
     folder.file(filename, base64Data, { base64: true });
    }));

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const zipUrl = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = zipUrl;
    a.download = `Semua_ID_Card_Karyawan_Gudang_${activeWarehouse}.zip`;
    a.click();
    URL.revokeObjectURL(zipUrl);

    alert(`Å“â€¦ Sukses! File ZIP berisi ${users.length} ID Card Karyawan Gudang ${activeWarehouse} berhasil didownload.`);
   } catch (err) {
    console.error('Error generating ZIP:', err);
    alert('Gagal mengemas ZIP. Mengalihkan ke download 1 per 1...');
    downloadAllIndividualCardsSequentially();
   } finally {
    if (btn) {
     btn.innerHTML = originalText;
     btn.disabled = false;
    }
    lucide.createIcons();
   }
  }

  async function downloadAllIndividualCardsSequentially() {
   const users = getWhDB(activeWarehouse, 'users', activeWarehouse === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS).filter(u => !isManagementSystemAccount(u));
   if (!users || users.length === 0) return;

   let count = 0;
   for (let i = 0; i < users.length; i++) {
    const u = users[i];
    try {
     const canvas = await generateIDCardCanvas(u);
     const filename = `ID_Card_${u.nik}_${u.name.replace(/\s+/g, '_')}.png`;
     const a = document.createElement('a');
     a.download = filename;
     a.href = canvas.toDataURL('image/png');
     a.click();
     count++;
     await new Promise(r => setTimeout(r, 200));
    } catch (err) {
     console.error(`Error downloading ${u.nik}:`, err);
    }
   }
   alert(`Å“â€¦ Berhasil mendownload ${count} file kartu ID individual karyawan!`);
  }

  function printAllIDCardsA4() {
   const users = getWhDB(activeWarehouse, 'users', activeWarehouse === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS).filter(u => !isManagementSystemAccount(u));
   if (!users || users.length === 0) return;

   const printArea = document.getElementById('printable-area');
   let fullPrintHtml = '';

   for (let i = 0; i < users.length; i += 9) {
    const pageUsers = users.slice(i, i + 9);
    fullPrintHtml += `<div class="a4-sheet">`;
    pageUsers.forEach(u => {
     fullPrintHtml += createSingleCR80CardHTML(u, true);
    });
    fullPrintHtml += `</div>`;
   }

   printArea.innerHTML = fullPrintHtml;

   setTimeout(() => {
    window.print();
   }, 300);
  }

  let activeEmpFilterTab = 'all';

  function filterEmployeeStatusTab(tab) {
   activeEmpFilterTab = tab;
   const tabs = ['all', 'active', 'inactive'];
   tabs.forEach(t => {
    const btn = document.getElementById(`btn-emp-tab-${t}`);
    if (btn) {
     if (activeEmpFilterTab === t) {
      btn.className = 'px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-900 text-white shadow-2xs transition inline-flex items-center gap-1.5';
      const badge = btn.querySelector('span:last-child');
      if (badge) badge.className = 'px-1.5 py-0.2 rounded-full text-[10px] bg-slate-700 text-slate-200 font-bold';
     } else {
      btn.className = 'px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 transition inline-flex items-center gap-1.5';
      const badge = btn.querySelector('span:last-child');
      if (badge) badge.className = 'px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-700 font-bold';
     }
    }
   });
   renderEmployeeTable();
  }

  // =========================================================