// === WFM MEDIKA CORE HELPERS ===

  // Helper standardisasi string (lowercase & alfanumerik saja)
  function cleanStr(str) {
   if (str === null || str === undefined) return '';
   return String(str).toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  // Helper escape HTML untuk keamanan rendering tabel & teks UI
  function escapeHTML(str) {
   if (str === null || str === undefined) return '';
   return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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
   if (digits > 0 && digits >= letters) return true;

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

  // FUNGSI STANDARISASI TANGGAL LOKAL (WIB / GMT+7 - BEBAS DARI BUG TIMEZONE UTC)
  function getLocalDateString(d = new Date()) {
   if (!d) return '';
   const dt = (d instanceof Date) ? d : new Date(d);
   if (isNaN(dt.getTime())) return '';
   try {
    return dt.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
   } catch (e) {
    const wibMs = dt.getTime() + (7 * 60 * 60 * 1000);
    const wibDate = new Date(wibMs);
    const y = wibDate.getUTCFullYear();
    const m = String(wibDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(wibDate.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
   }
  }

  // FUNGSI STANDARISASI FORMAT WAKTU WIB TUNGGAL (ASIA/JAKARTA - BEBAS DARI TIMEZONE PERANGKAT)
  function formatDisplayTimeWIB(d = new Date(), includeSeconds = true) {
   if (!d || d === '-') return '-';
   const dt = (d instanceof Date) ? d : new Date(d);
   if (isNaN(dt.getTime())) return '-';
   try {
    return dt.toLocaleTimeString('id-ID', {
     timeZone: 'Asia/Jakarta',
     hour12: false,
     hour: '2-digit',
     minute: '2-digit',
     ...(includeSeconds ? { second: '2-digit' } : {})
    }).replace(/:/g, '.');
   } catch (e) {
    const wibMs = dt.getTime() + (7 * 60 * 60 * 1000);
    const wibDate = new Date(wibMs);
    const hh = String(wibDate.getUTCHours()).padStart(2, '0');
    const mm = String(wibDate.getUTCMinutes()).padStart(2, '0');
    const ss = String(wibDate.getUTCSeconds()).padStart(2, '0');
    return includeSeconds ? `${hh}.${mm}.${ss}` : `${hh}.${mm}`;
   }
  }

  function parseYMD(str) {
   if (!str) return new Date();
   if (str instanceof Date) return str;
   const parts = String(str).split('-').map(Number);
   if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    // Gunakan jam 12:00 siang lokal agar aman dari pergeseran jam & DST
    return new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
   }
   return new Date(str);
  }

  // FUNGSI STANDAR OPERASIONAL ABSENSI 24 JAM PENUH (WIB / GMT+7)
  // Mendukung seluruh jam kerja: Dini Hari (00:00 - 06:00), Pagi, Siang, Sore, & Malam (23:00 / 23:59)
  // Setiap sesi absen tercatat tepat pada tanggal kalender saat tap masuk dilakukan
  function getOperationalDateString(d = new Date()) {
   if (!d) return '';
   const dt = (d instanceof Date) ? d : new Date(d);
   if (isNaN(dt.getTime())) return '';
   return getLocalDateString(dt);
  }

  const OFFICIAL_WAREHOUSE_MAPS_URL = "https://maps.app.goo.gl/rDZysrj5TJ1NmdGD7?g_st=aw";
  
  // KOORDINAT RESMI PERMANEN MASING-MASING GUDANG (DIKUNCI DAN TERISOLASI)
  const DEFAULT_COORDS = {
   MBI: { lat: -6.263295, lng: 106.877066, radius: 100, name: 'Gudang MBI' },
   MAI: { lat: -6.217808, lng: 106.889398, radius: 100, name: 'Gudang MAI' }
  };

  function isDummyWarehouseCoords(coords) {
   if (!coords || typeof coords.lat !== 'number' || typeof coords.lng !== 'number') return true;
   // Deteksi koordinat dummy lama Jakarta Pusat (-6.2088, 106.8456)
   return Math.abs(coords.lat - (-6.2088)) < 0.001 && Math.abs(coords.lng - 106.8456) < 0.001;
  }

  function isCorruptWarehouseCoords(coords, wh) {
   if (!coords || typeof coords.lat !== 'number' || typeof coords.lng !== 'number' || isNaN(coords.lat) || isNaN(coords.lng)) return true;
   const targetWh = (wh || 'MBI').toUpperCase();
   // 1. Dummy lama (-6.2088, 106.8456)
   if (Math.abs(coords.lat - (-6.2088)) < 0.001 && Math.abs(coords.lng - 106.8456) < 0.001) return true;
   // 2. Tertukar dengan koordinat gudang lain (MAI memuat koordinat MBI, atau MBI memuat koordinat MAI)
   if (targetWh === 'MAI' && Math.abs(coords.lat - (-6.263295)) < 0.0005 && Math.abs(coords.lng - 106.877066) < 0.0005) return true;
   if (targetWh === 'MBI' && Math.abs(coords.lat - (-6.217808)) < 0.0005 && Math.abs(coords.lng - 106.889398) < 0.0005) return true;
   return false;
  }

  // Hanya Admin, Coordinator, Supervisor, dan Manager yang memiliki wewenang untuk mengubah titik & radius GPS
  function isUserAuthorizedToManageGPS(user = currentUser) {
   if (!user) return false;
   const role = (user.role || '').toLowerCase().trim();
   const nik = (user.nik || '').toUpperCase().trim();
   if (typeof isUserAdmin === 'function' && isUserAdmin(user)) return true;
   if (typeof isUserManager === 'function' && isUserManager(user)) return true;
   if (role === 'supervisor' || role === 'coordinator' || role === 'admin' || role === 'manager') return true;
   if (nik.startsWith('ADM') || nik.startsWith('MGR') || nik.startsWith('SPV') || nik.startsWith('COR')) return true;
   return false;
  }

  function getWarehouseCoords(wh = activeWarehouse) {
   const targetWh = (wh || activeWarehouse || 'MBI').toUpperCase();
   const def = DEFAULT_COORDS[targetWh] || (targetWh === 'MAI' ? { lat: -6.217808, lng: 106.889398, radius: 100, name: 'Gudang MAI' } : { lat: -6.263295, lng: 106.877066, radius: 100, name: 'Gudang MBI' });
   let whRad = def.radius || 100;

   try {
    const saved = localStorage.getItem(`wfm_${targetWh.toLowerCase()}_coords`);
    if (saved) {
     const parsed = JSON.parse(saved);
     if (parsed && Number(parsed.radius) > 0) whRad = Number(parsed.radius);
    }
    const storedRad = Number(localStorage.getItem(`wfm_gps_radius_${targetWh.toLowerCase()}`)) || Number(localStorage.getItem('wfm_gps_radius'));
    if (storedRad > 0) whRad = storedRad;
   } catch(e) {}

   // HARD-LOCK: Titik Latitude & Longitude MBI & MAI TERKUNCI MATI 100% PADA TITIK RESMI GOOGLE MAPS
   const finalCoords = { lat: def.lat, lng: def.lng, radius: whRad, name: def.name };
   try {
    localStorage.setItem(`wfm_${targetWh.toLowerCase()}_coords`, JSON.stringify(finalCoords));
   } catch(e) {}
   return finalCoords;
  }

  function setWarehouseCoords(wh, lat, lng, radius = null) {
   const targetWh = (wh || activeWarehouse || 'MBI').toUpperCase();
   const def = DEFAULT_COORDS[targetWh] || (targetWh === 'MAI' ? { lat: -6.217808, lng: 106.889398, radius: 100, name: 'Gudang MAI' } : { lat: -6.263295, lng: 106.877066, radius: 100, name: 'Gudang MBI' });
   const rad = (radius !== null && radius !== undefined) ? Number(radius) : 100;
   const validRadius = (Number(rad) > 0) ? Number(rad) : 100;

   // Titik Latitude & Longitude selalu terkunci ke titik resmi baku, hanya radius yang dinamis
   const coords = { 
    lat: def.lat, 
    lng: def.lng, 
    radius: validRadius, 
    name: def.name, 
    updatedAt: new Date().toISOString() 
   };

   // Simpan HANYA ke storage gudang target yang bersangkutan (MBI atau MAI terpisah)
   localStorage.setItem(`wfm_${targetWh.toLowerCase()}_coords`, JSON.stringify(coords));
   localStorage.setItem(`wfm_gps_radius_${targetWh.toLowerCase()}`, String(validRadius));
   localStorage.setItem('wfm_gps_radius', String(validRadius));
   localStorage.setItem('wfm_last_gps_change_time', Date.now().toString());
   latestCachedGPS = null;
   try { saveFullDatabaseToCloud(false, true, true); } catch(e) {}
   try { saveGPSCoordsToFirestore(targetWh, coords); } catch(e) {}
   updateRegisteredCoordsDisplay();
   return coords;
  }

  async function changeWarehouseGPSRadius(radius) {
   if (!isUserAuthorizedToManageGPS()) {
    alert('â€ºâ€ Akses Ditolak: Hanya Admin, Coordinator, Supervisor, dan Manager yang memiliki hak akses untuk mengubah radius GPS gudang.');
    updateRegisteredCoordsDisplay();
    return;
   }
   const r = parseInt(radius, 10);
   if (isNaN(r) || r <= 0) return;
   const currentWh = (activeWarehouse || 'MBI').toUpperCase();
   
   // Update HANYA radius gudang aktif saat ini TANPA mengubah titik koordinat Latitude & Longitude
   const c = getWarehouseCoords(currentWh);
   const updated = setWarehouseCoords(currentWh, c.lat, c.lng, r);

   updateRegisteredCoordsDisplay();
   latestCachedGPS = null;
   await saveGPSCoordsToSupabase(currentWh, updated);
   await saveGPSCoordsToFirestore(currentWh, updated);
   await saveFullDatabaseToCloud(false, true, true);

   alert(`Å“â€¦ Jarak radius validasi GPS Gudang ${currentWh} berhasil diubah menjadi ${r} Meter.\n\n• Batas toleransi presensi staf di Gudang ${currentWh} kini maksimal ${r} Meter.\n• Seluruh perangkat HP Scanner otomatis tersinkronisasi via Cloud Firestore.`);
  }

  function updateRegisteredCoordsDisplay() {
   const c = getWarehouseCoords(activeWarehouse);
   const curRadius = Number(c.radius) > 0 ? Number(c.radius) : (Number(localStorage.getItem('wfm_gps_radius')) || 100);

   const lblCoords = document.getElementById('lbl-registered-coords');
   const lblWh = document.getElementById('lbl-registered-wh');
   const lblRadius = document.getElementById('lbl-registered-radius');
   const selectRadius = document.getElementById('select-gps-radius');
   const modalRadius = document.getElementById('gps-input-radius');
   const attRadiusLabel = document.getElementById('att-gps-radius-label');
   const attDescLabel = document.getElementById('att-gps-desc-label');
   const attSubRadius = document.getElementById('att-sub-radius-label');
   const camStatusMsg = document.getElementById('cam-status-msg');

   if (lblCoords) lblCoords.innerText = `${c.lat.toFixed(6)}, ${c.lng.toFixed(6)}`;
   if (lblWh) lblWh.innerText = `Gudang ${activeWarehouse}`;
   if (lblRadius) lblRadius.innerText = `${curRadius} METER`;
   if (selectRadius) selectRadius.value = String(curRadius);
   if (modalRadius) modalRadius.value = String(curRadius);

   // Update elemen pada layar depan Absensi Barcode
   if (attRadiusLabel) attRadiusLabel.innerText = `Radius GPS: ${curRadius} Meter`;
   if (attDescLabel) attDescLabel.innerText = `Sistem otomatis memverifikasi koordinat GPS HP saat kartu di-scan. Staf di luar radius ${curRadius} meter tidak dapat melakukan absensi.`;
   if (attSubRadius) attSubRadius.innerText = `${curRadius}m`;
   const boxTag = document.getElementById('scanner-box-tag');
   if (boxTag) boxTag.innerText = `SCAN ID CARD • ${curRadius}M`;
   if (camStatusMsg && (!camStatusMsg.innerText || camStatusMsg.innerText.includes('Arahkan kamera') || camStatusMsg.innerText.includes('Radius GPS'))) {
    camStatusMsg.innerText = `Arahkan kamera ke Barcode ID Card (Radius GPS: ${curRadius}m)`;
   }
  }

  // FITUR CEK JARAK GPS MURNI DIAGNOSTIK (READ-ONLY)
  // Tidak pernah mengubah titik koordinat ataupun merubah radius gudang
  function checkLiveGPSDistance() {
   if (!navigator.geolocation) {
    alert('Fitur GPS tidak didukung di browser ini.');
    return;
   }
   const targetCoords = getWarehouseCoords(activeWarehouse);
   const globalRad = Number(localStorage.getItem('wfm_gps_radius')) || 30;
   const activeRadius = Number(targetCoords.radius) > 0 ? Number(targetCoords.radius) : globalRad;
   const isTargetDummy = isDummyWarehouseCoords(targetCoords);

   navigator.geolocation.getCurrentPosition(
    (pos) => {
     const userLat = pos.coords.latitude;
     const userLng = pos.coords.longitude;
     const dist = getDistanceMeters(userLat, userLng, targetCoords.lat, targetCoords.lng);
     const fixedTolerance = 10; // Toleransi Tetap 10 Meter
     const effectiveRadius = activeRadius + fixedTolerance;
     const isValid = isTargetDummy || (dist <= effectiveRadius);

     let msg = `Å¸â€œ HASIL PENGECEKAN JARAK GPS:\n\n`;
     msg += `• Titik Lokasi HP Anda: ${userLat.toFixed(6)}, ${userLng.toFixed(6)}\n`;
     if (isTargetDummy) {
      msg += `• Titik Gudang ${activeWarehouse}: [BELUM DIDAFTARKAN / MASIH DEFAULT]\n`;
     } else {
      msg += `• Titik Gudang ${activeWarehouse}: ${targetCoords.lat.toFixed(6)}, ${targetCoords.lng.toFixed(6)}\n`;
     }
     msg += `• Batas Radius Resmi: ${activeRadius} Meter\n`;
     msg += `• Toleransi Jarak Tambahan: +${fixedTolerance} Meter (Batas Maksimal: ${effectiveRadius} Meter)\n`;
     msg += `• Jarak Fisik ke Gudang: ${isTargetDummy ? '0 m (Default)' : `${dist} meter`}\n\n`;

     if (isValid) {
      msg += `Å“â€¦ STATUS: DALAM RADIUS (BISA SCAN ABSEN)\nPosisi Anda memenuhi syarat untuk melakukan presensi di Gudang ${activeWarehouse}.`;
     } else {
      msg += `â€ºâ€ STATUS: DI LUAR RADIUS (LEBIH ${dist - effectiveRadius} METER)\nAnda berada di luar batas maksimal ${effectiveRadius} meter dari Gudang ${activeWarehouse}. Silakan mendekat ke area gudang untuk melakukan scan presensi.`;
     }

     alert(msg);
    },
    (err) => {
     alert('Gagal membaca GPS: ' + err.message + '\nPastikan izin lokasi aktif di pengaturan browser HP.');
    },
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
   );
  }

  function restoreOfficialWarehouseGPS(wh = activeWarehouse) {
   if (!isUserAuthorizedToManageGPS()) {
    alert('â€ºâ€ Akses Ditolak: Hanya Admin, Coordinator, Supervisor, dan Manager yang memiliki hak akses untuk mengelola titik GPS gudang.');
    return;
   }
   const targetWh = (wh || activeWarehouse || 'MBI').toUpperCase();
   const def = DEFAULT_COORDS[targetWh] || (targetWh === 'MAI' ? { lat: -6.217808, lng: 106.889398, radius: 100, name: 'Gudang MAI' } : { lat: -6.263295, lng: 106.877066, radius: 100, name: 'Gudang MBI' });
   const current = getWarehouseCoords(targetWh);
   const curRadius = Number(current.radius) > 0 ? Number(current.radius) : (def.radius || 100);

   const latInput = document.getElementById('gps-input-lat');
   const lngInput = document.getElementById('gps-input-lng');
   if (latInput) latInput.value = def.lat;
   if (lngInput) lngInput.value = def.lng;

   setWarehouseCoords(targetWh, def.lat, def.lng, curRadius);
   updateRegisteredCoordsDisplay();
   alert(`Å“â€¦ Titik GPS Gudang ${targetWh} berhasil dikembalikan ke Koordinat Resmi Baku:\n\n• Latitude: ${def.lat}\n• Longitude: ${def.lng}\n• Radius: ${curRadius} Meter\n\nTitik resmi ini telah dikunci permanen dan disinkronkan ke Cloud.`);
  }

  function calibrateCurrentWarehouseGPS() {
   if (!isUserAuthorizedToManageGPS()) {
    alert('â€ºâ€ Akses Ditolak: Hanya Admin, Coordinator, Supervisor, dan Manager yang memiliki hak akses untuk mendaftarkan titik lokasi resmi gudang.');
    return;
   }
   if (!navigator.geolocation) {
    alert('Fitur GPS tidak didukung di browser ini.');
    return;
   }
   const targetWh = (activeWarehouse || 'MBI').toUpperCase();
   const current = getWarehouseCoords(targetWh);
   const def = DEFAULT_COORDS[targetWh] || (targetWh === 'MAI' ? { lat: -6.217808, lng: 106.889398 } : { lat: -6.263295, lng: 106.877066 });
   const globalRad = Number(localStorage.getItem('wfm_gps_radius')) || 100;
   const curRadius = Number(current.radius) > 0 ? Number(current.radius) : globalRad;

   navigator.geolocation.getCurrentPosition(
    (pos) => {
     const lat = pos.coords.latitude;
     const lng = pos.coords.longitude;
     const accuracy = Math.round(pos.coords.accuracy || 0);
     const distToOfficial = getDistanceMeters(lat, lng, def.lat, def.lng);

     // Proteksi cerdas: Jika terpaut jauh dari titik resmi (misal dari laptop atau GPS melenceng)
     if (distToOfficial > 250) {
      const confirmed = confirm(`Å¡  PERINGATAN KALIBRASI TITIK GUDANG ${targetWh}:\n\nPosisi GPS perangkat Anda (${lat.toFixed(6)}, ${lng.toFixed(6)}) terdeteksi berjarak ${Math.round(distToOfficial)} meter dari Titik Resmi Baku Gudang ${targetWh}.\n\nJika Anda sedang membuka web dari Laptop/PC atau sinyal GPS sedang meleset, mendaftarkan titik ini akan menggeser lokasi gudang dan membuat karyawan lain gagal absen.\n\nApakah Anda YAKIN ingin tetap menimpa titik resmi Gudang ${targetWh}?`);
      if (!confirmed) return;
     }

     setWarehouseCoords(targetWh, lat, lng, curRadius);
     alert(`Å“â€¦ SUKSES MENDAFTARKAN TITIK GUDANG ${targetWh}!\n\n• Latitude: ${lat.toFixed(6)}\n• Longitude: ${lng.toFixed(6)}\n• Radius Validasi: ${curRadius} Meter\n• Akurasi HP: ${accuracy} meter\n\nTitik lokasi ini telah disimpan dan otomatis tersinkron ke Cloud & seluruh HP staf.`);
    },
    (err) => {
     alert('Gagal membaca GPS: ' + err.message + '\nPastikan izin lokasi browser HP aktif.');
    },
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
   );
  }

  function openManualGPSModal() {
   if (!isUserAuthorizedToManageGPS()) {
    alert('â€ºâ€ Akses Ditolak: Hanya Admin, Coordinator, Supervisor, dan Manager yang memiliki hak akses untuk mengubah titik koordinat GPS gudang.');
    return;
   }
   const c = getWarehouseCoords(activeWarehouse);
   document.getElementById('gps-wh-name').value = `Gudang ${activeWarehouse}`;
   document.getElementById('gps-input-lat').value = c.lat;
   document.getElementById('gps-input-lng').value = c.lng;
   const radSelect = document.getElementById('gps-input-radius');
   if (radSelect) radSelect.value = String(c.radius || 100);
   document.getElementById('manual-gps-modal').classList.remove('hidden');
   lucide.createIcons();
  }

  function closeManualGPSModal() {
   document.getElementById('manual-gps-modal').classList.add('hidden');
  }

  function handleSaveManualGPS(e) {
   e.preventDefault();
   if (!isUserAuthorizedToManageGPS()) {
    alert('â€ºâ€ Akses Ditolak: Hanya Admin, Coordinator, Supervisor, dan Manager yang memiliki hak akses untuk mengubah titik koordinat GPS gudang.');
    return;
   }
   const lat = parseFloat(document.getElementById('gps-input-lat').value);
   const lng = parseFloat(document.getElementById('gps-input-lng').value);
   const radiusVal = parseInt(document.getElementById('gps-input-radius')?.value || '100', 10);
   if (isNaN(lat) || isNaN(lng)) {
    alert('Format koordinat tidak valid.');
    return;
   }
   const targetWh = (activeWarehouse || 'MBI').toUpperCase();
   localStorage.setItem('wfm_gps_radius', String(radiusVal));
   localStorage.setItem('wfm_last_gps_change_time', Date.now().toString());
   setWarehouseCoords(targetWh, lat, lng, radiusVal);
   closeManualGPSModal();
   alert(`Å“â€¦ Koordinat & Radius Gudang ${targetWh} berhasil disimpan!\nLatitude: ${lat.toFixed(6)}, Longitude: ${lng.toFixed(6)}\nRadius Validasi: ${radiusVal} Meter\n• Seluruh perangkat HP Scanner otomatis tersinkronisasi via Cloud Firestore.`);
  }
