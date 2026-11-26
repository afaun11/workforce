// === WFM MEDIKA APP BOOTSTRAP ===
  // SUPABASE BOOT ENGINE: AUTO-MIGRASI DATA LOKAL & REALTIME POLLER
  // Menjamin seluruh riwayat presensi masuk/pulang, antrean outbox,
  // dan data karyawan otomatis berpindah ke Supabase
  // =========================================================
  try {
   // Tarik ringkas data presensi hari ini secara instan saat awal buka
   try {
    const todayStr = (typeof getLocalDateString === 'function') ? getLocalDateString(new Date()) : '';
    if (typeof pullAttendanceFromSupabase === 'function' && todayStr) {
     const initWh = (typeof activeWarehouse !== 'undefined' ? activeWarehouse : 'MBI') || 'MBI';
     pullAttendanceFromSupabase(initWh, todayStr).then(() => {
      if (typeof renderScannerTodayRecords === 'function') renderScannerTodayRecords();
     }).catch(() => {});
    }
   } catch(eInitPull) {}
  } catch(eInitSb) {}


  // =========================================================
  // GLOBAL DATE & TIME PICKER TRIGGER
  // Otomatis memunculkan popup kalender & waktu saat kotak input diklik di mana saja
  // Mendukung Chrome, Edge, Safari, Opera, dan Browser HP (Android & iOS)
  // =========================================================
  document.addEventListener('click', function(e) {
   const el = e.target;
   if (!el) return;
   if (el.tagName === 'INPUT' && (el.type === 'date' || el.type === 'time' || el.type === 'month' || el.type === 'datetime-local')) {
    if (typeof el.showPicker === 'function') {
     try {
      el.showPicker();
     } catch (err) {}
    }
   } else if (el.tagName === 'LABEL') {
    const forId = el.getAttribute('for');
    if (forId) {
     const inputEl = document.getElementById(forId);
     if (inputEl && (inputEl.type === 'date' || inputEl.type === 'time' || inputEl.type === 'month' || inputEl.type === 'datetime-local')) {
      if (typeof inputEl.showPicker === 'function') {
       try { inputEl.showPicker(); } catch (err) {}
      }
     }
    }
   }
  });

  document.addEventListener('focusin', function(e) {
   const el = e.target;
   if (el && el.tagName === 'INPUT' && (el.type === 'date' || el.type === 'time' || el.type === 'month' || el.type === 'datetime-local')) {
    if (typeof el.showPicker === 'function') {
     try {
      el.showPicker();
     } catch (err) {}
    }
   }
  });
 