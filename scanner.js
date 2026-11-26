// === WFM MEDIKA SCANNER & VERIFICATION ===
  // HITUNG JARAK GPS
  // =========================================================
  function getDistanceMeters(lat1, lon1, lat2, lon2) {
   const R = 6371e3;
   const phi1 = lat1 * Math.PI / 180;
   const phi2 = lat2 * Math.PI / 180;
   const deltaPhi = (lat2 - lat1) * Math.PI / 180;
   const deltaLambda = (lon2 - lon1) * Math.PI / 180;

   const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
        Math.cos(phi1) * Math.cos(phi2) *
        Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
   const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
   return Math.round(R * c);
  }

  let latestCachedGPS = null;
  let isGPSFetching = false;

  function preloadGPSLocation(targetWh = null) {
   if (!navigator.geolocation || isGPSFetching) return;
   isGPSFetching = true;
   const whToUse = targetWh || activeWarehouse || 'MBI';
   const targetCoords = getWarehouseCoords(whToUse);
   const globalRad = Number(localStorage.getItem('wfm_gps_radius')) || 100;
   const maxRadius = Number(targetCoords.radius) > 0 ? Number(targetCoords.radius) : globalRad;

   navigator.geolocation.getCurrentPosition(
    (pos) => {
     isGPSFetching = false;
     const userLat = pos.coords.latitude;
     const userLng = pos.coords.longitude;
     const accuracy = Math.round(pos.coords.accuracy || 0);

     const rawDistActive = getDistanceMeters(userLat, userLng, targetCoords.lat, targetCoords.lng);
     const effectiveAllowedRadius = maxRadius; // Strict: Mengikuti jarak radius yang dipilih tanpa toleransi berlebih
     const isValid = (rawDistActive <= effectiveAllowedRadius);

     if (isValid) {
      latestCachedGPS = {
       valid: true,
       distance: rawDistActive,
       maxRadius: maxRadius,
       effectiveAllowedRadius: effectiveAllowedRadius,
       accuracy: accuracy,
       lat: userLat,
       lng: userLng,
       wh: whToUse,
       timestamp: Date.now(),
       error: null
      };
     } else {
      latestCachedGPS = null;
     }
    },
    (err) => {
     isGPSFetching = false;
     console.warn('GPS preload error:', err);
    },
    { enableHighAccuracy: true, timeout: 5000, maximumAge: 15000 }
   );
  }

  function verifyGPSLocation(targetWh = null) {
   return new Promise((resolve) => {
    const whToUse = targetWh || activeWarehouse || 'MBI';
    const now = Date.now();
    const targetCoords = getWarehouseCoords(whToUse);
    const globalRad = Number(localStorage.getItem('wfm_gps_radius')) || 100;
    const maxRadius = Number(targetCoords.radius) > 0 ? Number(targetCoords.radius) : globalRad;
    const effectiveAllowedRadius = maxRadius; // Strict: Batas mutlak sesuai radius gudang resmi

    // Reset cache jika radius telah berubah
    if (latestCachedGPS && latestCachedGPS.maxRadius !== maxRadius) {
     latestCachedGPS = null;
    }

    // 1. Jika ada cache GPS yang VALID dan radiusnya COCOK serta masih hangat (< 15 detik), gunakan
    if (latestCachedGPS && 
      latestCachedGPS.valid && 
      latestCachedGPS.wh === whToUse && 
      latestCachedGPS.maxRadius === maxRadius &&
      latestCachedGPS.distance <= effectiveAllowedRadius &&
      (now - latestCachedGPS.timestamp < 15000)) {
     // Lakukan background refresh tanpa memblokir proses scan
     setTimeout(() => preloadGPSLocation(whToUse), 100);
     resolve(latestCachedGPS);
     return;
    }

    // Jika radius berubah atau cache sudah tidak cocok/basi, reset cache seketika
    latestCachedGPS = null;

    if (!navigator.geolocation) {
     resolve({ valid: false, error: 'Browser ini tidak mendukung fitur GPS Geolocation.' });
     return;
    }

    navigator.geolocation.getCurrentPosition(
     (pos) => {
      const userLat = pos.coords.latitude;
      const userLng = pos.coords.longitude;
      const accuracy = Math.round(pos.coords.accuracy || 0);

      const rawDistActive = getDistanceMeters(userLat, userLng, targetCoords.lat, targetCoords.lng);
      const isValid = (rawDistActive <= effectiveAllowedRadius);

      const res = {
       valid: isValid,
       distance: rawDistActive,
       maxRadius: maxRadius,
       effectiveAllowedRadius: effectiveAllowedRadius,
       accuracy: accuracy,
       lat: userLat,
       lng: userLng,
       wh: whToUse,
       timestamp: Date.now(),
       error: isValid ? null : `Gagal Absen: Posisi Anda berada di luar radius resmi Gudang ${whToUse}! Jarak Anda ke titik gudang: ${rawDistActive} meter (Batas toleransi maksimal: ${effectiveAllowedRadius} meter). Dekatkan HP ke area Gudang ${whToUse} untuk melakukan presensi.`
      };

      if (isValid) {
       latestCachedGPS = res;
      } else {
       latestCachedGPS = null; // Jangan cache kegagalan!
      }
      resolve(res);
     },
     (err) => {
      console.warn('GPS reading error:', err);
      latestCachedGPS = null;
      let errMsg = 'GPS lokasi HP wajib diaktifkan saat ingin absen!';
      if (err.code === 1) errMsg = 'Izin GPS ditolak. Klik ikon gembok / setelan di URL browser dan Izinkan Akses Lokasi (GPS).';
      else if (err.code === 2) errMsg = 'Sinyal GPS tidak ditemukan. Pastikan Lokasi HP aktif dalam mode Akurasi Tinggi.';
      else if (err.code === 3) errMsg = 'Permintaan GPS timeout. Silakan coba scan kembali.';
      resolve({ valid: false, error: errMsg });
     },
     { enableHighAccuracy: true, timeout: 5000, maximumAge: 15000 }
    );
   });
  }

  // =========================================================
  // 2-STEP VERIFICATION
  // =========================================================
  function resetVerificationState() {
   const boxBorder = document.getElementById('scanner-box-border');
   const boxTag = document.getElementById('scanner-box-tag');
   const statusMsg = document.getElementById('cam-status-msg');
   const curCoords = getWarehouseCoords(activeWarehouse);
   const curRad = Number(curCoords.radius) > 0 ? Number(curCoords.radius) : (Number(localStorage.getItem('wfm_gps_radius')) || 30);

   if (statusMsg) statusMsg.innerText = `Arahkan kamera ke Barcode ID Card (Radius GPS: ${curRad}m)`;
   if (boxBorder) boxBorder.className = 'w-48 h-48 border-2 border-slate-400 border-dashed rounded-2xl animate-pulse flex items-center justify-center';
   if (boxTag) {
    boxTag.className = 'text-[10px] text-slate-300 bg-slate-900/90 px-2 py-0.5 rounded font-mono font-bold';
    boxTag.innerText = `SCAN ID CARD • ${curRad}M`;
   }

   lucide.createIcons();
  }

  // =========================================================
  // AUDIO NOTIFICATION ENGINE (DITANAM LANGSUNG DI FILE INDEX)
  // 100% Mandiri, Bersuara di Semua HP (iOS/Android) & Laptop
  // =========================================================
  let audioCtx = null;
  let isAudioContextUnlocked = false;

  // Mode Antrean Berkelanjutan dinonaktifkan (kamera otomatis ditutup setelah scan)
  let isContinuousScanMode = false;
  function toggleContinuousScanMode(val) {
   isContinuousScanMode = false;
   localStorage.removeItem('wfm_continuous_scan');
  }

  function getAudioContext() {
   if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
     audioCtx = new AudioContextClass();
    }
   }
   if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
   }
   return audioCtx;
  }

  // MEMBUKA KUNCI AUDIO BROWSER MOBILE (iOS Safari & Android Chrome Autoplay Unlocker)
  function unlockAudioContextOnGesture() {
   if (isAudioContextUnlocked) return;
   try {
    const ctx = getAudioContext();
    if (ctx) {
     if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
     }
     // Mainkan buffer hening 1 sample agar sistem audio smartphone terbuka permanen
     const buffer = ctx.createBuffer(1, 1, 22050);
     const source = ctx.createBufferSource();
     source.buffer = buffer;
     source.connect(ctx.destination);
     source.start(0);
    }

    // Pancingan audio DOM tanpa meninggalkan status muted terkunci
    const s = document.getElementById('audio-file-success');
    const e = document.getElementById('audio-file-error');
    if (s) {
     s.muted = true;
     const ps = s.play();
     if (ps && typeof ps.then === 'function') {
      ps.then(() => { s.pause(); s.currentTime = 0; s.muted = false; })
       .catch(() => { s.muted = false; });
     } else {
      s.muted = false;
     }
    }
    if (e) {
     e.muted = true;
     const pe = e.play();
     if (pe && typeof pe.then === 'function') {
      pe.then(() => { e.pause(); e.currentTime = 0; e.muted = false; })
       .catch(() => { e.muted = false; });
     } else {
      e.muted = false;
     }
    }

    isAudioContextUnlocked = true;
   } catch (err) {}
  }

  // Daftarkan listener universal pada seluruh layar HP & Laptop untuk membuka kunci audio seketika
  const globalUnlockTriggers = ['touchstart', 'touchend', 'click', 'keydown', 'pointerdown'];
  function handleGlobalUnlock() {
   unlockAudioContextOnGesture();
   if (isAudioContextUnlocked) {
    globalUnlockTriggers.forEach(evt => document.removeEventListener(evt, handleGlobalUnlock, true));
   }
  }
  globalUnlockTriggers.forEach(evt => document.addEventListener(evt, handleGlobalUnlock, { capture: true, passive: true }));

  function speakNotification(text) {
   if ('speechSynthesis' in window) {
    try {
     window.speechSynthesis.cancel();
     const utterance = new SpeechSynthesisUtterance(text);
     utterance.lang = 'id-ID';
     utterance.rate = 1.05;
     utterance.pitch = 1.0;
     
     const voices = window.speechSynthesis.getVoices();
     const idVoice = voices.find(v => v.lang && (v.lang.startsWith('id') || v.lang.includes('ID')));
     if (idVoice) utterance.voice = idVoice;

     window.speechSynthesis.speak(utterance);
    } catch (e) {
     console.warn('Speech error:', e);
    }
   }
  }

  // 1. NADA SUARA ABSEN BERHASIL (NATIVE RETAIL POS CHIME DITANAM DI SCRIPT)
  // Nada lonceng POS kasir modern (C5-E5-G5-C6) yang jernih, nyaring, dan ramah di speaker HP
  function playSynthesizedSuccessChime() {
   try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    
    const chords = [
     { f: 523.25, start: 0, dur: 0.22, vol: 0.38 },
     { f: 659.25, start: 0.08, dur: 0.22, vol: 0.38 },
     { f: 783.99, start: 0.16, dur: 0.28, vol: 0.42 },
     { f: 1046.50, start: 0.24, dur: 0.40, vol: 0.48 }
    ];

    chords.forEach(c => {
     const osc = ctx.createOscillator();
     const gain = ctx.createGain();
     osc.type = 'sine';
     osc.frequency.setValueAtTime(c.f, now + c.start);

     gain.gain.setValueAtTime(0.001, now + c.start);
     gain.gain.exponentialRampToValueAtTime(c.vol, now + c.start + 0.02);
     gain.gain.exponentialRampToValueAtTime(0.0001, now + c.start + c.dur);

     osc.connect(gain);
     gain.connect(ctx.destination);
     osc.start(now + c.start);
     osc.stop(now + c.start + c.dur);
    });
   } catch (e) {
    console.warn('Synthesizer success error:', e);
   }
  }

  // 2. NADA SUARA ABSEN GAGAL & DI LUAR LOKASI (DOUBLE DESCENDING ALERT BUZZER DITANAM DI SCRIPT)
  // Nada peringatan tegas & jelas yang langsung membedakan saat terjadi error atau staf di luar radius
  function playSynthesizedErrorBuzz() {
   try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const pulses = [
     { f1: 360, f2: 260, start: 0, dur: 0.15, vol: 0.48 },
     { f1: 280, f2: 170, start: 0.19, dur: 0.24, vol: 0.52 }
    ];

    pulses.forEach(p => {
     const osc = ctx.createOscillator();
     const gain = ctx.createGain();
     osc.type = 'sawtooth';
     osc.frequency.setValueAtTime(p.f1, now + p.start);
     osc.frequency.exponentialRampToValueAtTime(p.f2, now + p.start + p.dur);

     gain.gain.setValueAtTime(0.001, now + p.start);
     gain.gain.exponentialRampToValueAtTime(p.vol, now + p.start + 0.015);
     gain.gain.exponentialRampToValueAtTime(0.0001, now + p.start + p.dur);

     osc.connect(gain);
     gain.connect(ctx.destination);
     osc.start(now + p.start);
     osc.stop(now + p.start + p.dur);
    });
   } catch (e) {
    console.warn('Synthesizer error buzz error:', e);
   }
  }

  // 3. DISPATCHER SUARA UTAMA (Prioritas: Kustom Storage Admin -> File Resmi Bawaan -> Native Synthesizer)
  function playOfficialAudio(isSuccess, extraReason = '') {
   unlockAudioContextOnGesture();

   // Cek apakah ada file audio kustom yang disimpan di memori Base64 (dari upload laptop admin atau sync cloud)
   const customStorage = isSuccess 
    ? (localStorage.getItem('wfm_sound_in') || localStorage.getItem('wfm_sound_out'))
    : localStorage.getItem('wfm_sound_err');

   if (customStorage && customStorage.startsWith('data:audio')) {
    try {
     const a = new Audio(customStorage);
     a.muted = false;
     a.volume = 1.0;
     const p = a.play();
     if (p && typeof p.then === 'function') {
      p.then(() => triggerVoiceAfterSound(isSuccess, extraReason))
       .catch(() => playOfficialFileOrFallback(isSuccess, extraReason));
      return;
     }
    } catch (e) {}
   }

   playOfficialFileOrFallback(isSuccess, extraReason);
  }

  function playOfficialFileOrFallback(isSuccess, extraReason = '') {
   // Mainkan berkas suara resmi bawaan sistem di folder wfm:
   // - Berhasil (Masuk & Keluar): "suara absen-berhasil.mpeg"
   // - Gagal & Di Luar Lokasi: "suara absen-gagal.mpeg"
   const targetFileName = isSuccess ? 'suara%20absen-berhasil.mpeg' : 'suara%20absen-gagal.mpeg';
   const domId = isSuccess ? 'audio-file-success' : 'audio-file-error';
   const domAudio = document.getElementById(domId);

   let played = false;
   if (domAudio) {
    try {
     domAudio.muted = false;
     domAudio.volume = 1.0;
     domAudio.currentTime = 0;
     const p = domAudio.play();
     if (p && typeof p.then === 'function') {
      played = true;
      p.then(() => triggerVoiceAfterSound(isSuccess, extraReason))
       .catch(() => tryDirectAudioFile(targetFileName, isSuccess, extraReason));
      return;
     }
    } catch (e) {}
   }

   if (!played) {
    tryDirectAudioFile(targetFileName, isSuccess, extraReason);
   }
  }

  function tryDirectAudioFile(targetFile, isSuccess, extraReason) {
   const candidates = isSuccess
    ? ['suara%20absen-berhasil.mpeg', 'suara absen-berhasil.mpeg', 'suara absen-berhasil.mp3']
    : ['suara%20absen-gagal.mpeg', 'suara absen-gagal.mpeg', 'suara absen-gagal.mp3'];

   function tryCandidate(index) {
    if (index >= candidates.length) {
     fallbackToEmbeddedChime(isSuccess, extraReason);
     return;
    }
    try {
     const audio = new Audio(candidates[index]);
     audio.muted = false;
     audio.volume = 1.0;
     const p = audio.play();
     if (p && typeof p.then === 'function') {
      p.then(() => triggerVoiceAfterSound(isSuccess, extraReason))
       .catch(() => tryCandidate(index + 1));
      return;
     }
    } catch (e) {}
    tryCandidate(index + 1);
   }

   tryCandidate(0);
  }

  function fallbackToEmbeddedChime(isSuccess, extraReason = '') {
   // Cadangan synthesizer jika perangkat mobile offline tidak memiliki berkas lokal
   if (isSuccess) {
    playSynthesizedSuccessChime();
   } else {
    playSynthesizedErrorBuzz();
   }
   triggerVoiceAfterSound(isSuccess, extraReason);
  }

  function triggerVoiceAfterSound(isSuccess, extraReason = '') {
   if (localStorage.getItem('wfm_sound_voice_enabled') === 'true') {
    setTimeout(() => {
     if (isSuccess) {
      speakNotification(extraReason ? `Absen berhasil, ${extraReason}` : 'Absen berhasil');
     } else {
      speakNotification('Gagal, ' + (extraReason || 'silakan coba lagi'));
     }
    }, 380);
   }
  }

  function playAttendanceSuccessSound(type = 'check_in', userName = '') {
   const cleanName = (userName || '').split(' ')[0] || '';
   playOfficialAudio(true, cleanName);
  }

  function playAttendanceErrorSound(reason = '') {
   playOfficialAudio(false, reason);
  }

  // 4. SINKRONISASI SUARA CLOUD FIREBASE (Agar File Suara Laptop Mengalir ke Semua HP di Kedua Gudang)
  async function uploadAudioClipsToCloud() {
   const soundIn = localStorage.getItem('wfm_sound_in');
   const soundErr = localStorage.getItem('wfm_sound_err');
   const soundInName = localStorage.getItem('wfm_sound_in_name') || 'suara absen-berhasil.mpeg';
   const soundErrName = localStorage.getItem('wfm_sound_err_name') || 'suara absen-gagal.mpeg';

   if (!soundIn && !soundErr) {
    alert('Belum ada file suara kustom yang dipilih dari laptop.\n\nSilakan klik "Pilih File dari Laptop" terlebih dahulu untuk memilih file suara absen-berhasil dan suara absen-gagal.');
    return;
   }

   const payload = {
    success: soundIn || '',
    success_name: soundInName,
    error: soundErr || '',
    error_name: soundErrName,
    updatedAt: new Date().toISOString()
   };

   try {
    const mbiAudioUrl = getFirebaseAudioEndpoint('MBI');
    const maiAudioUrl = getFirebaseAudioEndpoint('MAI');
    const [resMbi, resMai] = await Promise.allSettled([
     fetch(mbiAudioUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
     }),
     fetch(maiAudioUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
     })
    ]);

    const mbiOk = resMbi.status === 'fulfilled' && resMbi.value.ok;
    const maiOk = resMai.status === 'fulfilled' && resMai.value.ok;

    if (mbiOk || maiOk) {
     alert('Å“â€¦ SUKSES MENGUNGGAH SUARA KE KEDUA CLOUD DATABASE (MBI & MAI)!\n\nFile suara notifikasi resmi (berhasil & gagal) telah disimpan di Google Firebase Cloud 24/7.\nSemua HP karyawan di Gudang MBI dan Gudang MAI otomatis mengunduh & memutar suara ini!');
    } else {
     alert('Å¡  Gagal terhubung ke Cloud. Pastikan Rules Firebase sudah .read: true & .write: true.');
    }
   } catch (err) {
    alert('Gagal mengunggah suara ke Cloud: ' + err.message);
   }
  }

  async function syncAudioClipsFromCloud(showAlert = false) {
   try {
    const mbiAudioUrl = getFirebaseAudioEndpoint('MBI');
    const maiAudioUrl = getFirebaseAudioEndpoint('MAI');
    
    let data = null;
    try {
     const res = await fetch(mbiAudioUrl);
     if (res.ok) data = await res.json();
    } catch(e) {}

    if (!data || !data.success) {
     try {
      const res = await fetch(maiAudioUrl);
      if (res.ok) data = await res.json();
     } catch(e) {}
    }

    if (data && typeof data === 'object') {
     let updated = false;
     if (data.success && data.success.startsWith('data:audio')) {
      localStorage.setItem('wfm_sound_in', data.success);
      localStorage.setItem('wfm_sound_out', data.success);
      localStorage.setItem('wfm_sound_in_name', data.success_name || 'suara absen-berhasil.mpeg');
      localStorage.setItem('wfm_sound_out_name', data.success_name || 'suara absen-berhasil.mpeg');
      updated = true;
     }
     if (data.error && data.error.startsWith('data:audio')) {
      localStorage.setItem('wfm_sound_err', data.error);
      localStorage.setItem('wfm_sound_err_name', data.error_name || 'suara absen-gagal.mpeg');
      updated = true;
     }
     if (updated) {
      renderAudioSettingsUI();
      if (showAlert) {
       alert('Å“â€¦ SINKRONISASI SUARA CLOUD BERHASIL!\n\nFile suara notifikasi resmi telah diterapkan ke perangkat ini dan siap berbunyi.');
      }
     } else if (showAlert) {
      alert('â€ž  Belum ada file suara kustom di Cloud. Sistem tetap menggunakan nada notifikasi bawaan yang sudah ditanam di aplikasi.');
     }
    }
   } catch (e) {
    if (showAlert) alert('Gagal menarik suara dari Cloud: ' + e.message);
   }
  }

  // Coba otomatis membaca file lokal jika aplikasi dibuka di lingkungan server/laptop
  async function tryAutoLoadLocalFolderAudio() {
   const audioTargets = [
    { key: 'wfm_sound_in', files: ['suara absen-berhasil.mpeg', 'suara%20absen-berhasil.mpeg', 'suara absen-berhasil.mp3'], name: 'suara absen-berhasil.mpeg', isSuccess: true },
    { key: 'wfm_sound_err', files: ['suara absen-gagal.mpeg', 'suara%20absen-gagal.mpeg', 'suara absen-gagal.mp3'], name: 'suara absen-gagal.mpeg', isSuccess: false }
   ];

   for (const target of audioTargets) {
    if (!localStorage.getItem(target.key)) {
     for (const fileName of target.files) {
      try {
       const res = await fetch(fileName);
       if (res.ok) {
        const blob = await res.blob();
        if (blob && blob.size > 200) {
         const reader = new FileReader();
         reader.onload = (e) => {
          const base64 = e.target.result;
          if (base64 && base64.startsWith('data:audio')) {
           localStorage.setItem(target.key, base64);
           localStorage.setItem(target.key + '_name', target.name);
           if (target.isSuccess) {
            localStorage.setItem('wfm_sound_out', base64);
            localStorage.setItem('wfm_sound_out_name', target.name);
           }
           renderAudioSettingsUI();
          }
         };
         reader.readAsDataURL(blob);
         break;
        }
       }
      } catch (err) {}
     }
    }
   }
  }

  // MODAL PENGATURAN SUARA DARI LAPTOP (KHUSUS ADMIN)
  function openAudioSettingsModal() {
   if (!isUserAdmin(currentUser) && !hasPermission('perm_sys_audio_settings')) {
    alert('Akses Ditolak: Pengaturan suara notifikasi presensi hanya dapat diakses oleh Akun Administrator atau akun yang memiliki izin.');
    return;
   }
   const modal = document.getElementById('audio-settings-modal');
   if (!modal) return;
   modal.classList.remove('hidden');
   renderAudioSettingsUI();
   lucide.createIcons();
  }

  function closeAudioSettingsModal() {
   const modal = document.getElementById('audio-settings-modal');
   if (modal) modal.classList.add('hidden');
  }

  function handleCustomAudioUpload(type, event) {
   const file = event.target.files && event.target.files[0];
   if (!file) return;

   if (!file.type.startsWith('audio/') && !/\.(mp3|wav|ogg|m4a|aac|mpeg)$/i.test(file.name)) {
    alert('Format file tidak didukung. Silakan pilih file audio berformat .mp3, .mpeg, .wav, .ogg, atau .m4a.');
    return;
   }

   if (file.size > 8 * 1024 * 1024) {
    alert('Ukuran file terlalu besar (maksimal 8 MB). Silakan gunakan file audio ringkas / nada notifikasi.');
    return;
   }

   const reader = new FileReader();
   reader.onload = (e) => {
    const base64Data = e.target.result;
    try {
     if (type === 'in' || type === 'out') {
      localStorage.setItem('wfm_sound_in', base64Data);
      localStorage.setItem('wfm_sound_in_name', file.name);
      localStorage.setItem('wfm_sound_out', base64Data);
      localStorage.setItem('wfm_sound_out_name', file.name);
     } else if (type === 'err') {
      localStorage.setItem('wfm_sound_err', base64Data);
      localStorage.setItem('wfm_sound_err_name', file.name);
     }
     renderAudioSettingsUI();
     playTestAudio(type);
     alert(`Å“â€¦ File Suara Berhasil Disimpan!\n\nFile "${file.name}" aktif untuk notifikasi.`);
    } catch (err) {
     alert('Gagal menyimpan file audio ke memori browser: ' + err.message);
    }
   };
   reader.readAsDataURL(file);
  }

  function playTestAudio(type) {
   if (type === 'err') {
    playOfficialAudio(false, 'Uji Coba Gagal');
   } else {
    playOfficialAudio(true, 'Uji Coba Berhasil');
   }
  }

  function resetAudioToDefault(type) {
   if (type === 'in' || type === 'out') {
    localStorage.removeItem('wfm_sound_in');
    localStorage.removeItem('wfm_sound_in_name');
    localStorage.removeItem('wfm_sound_out');
    localStorage.removeItem('wfm_sound_out_name');
   } else if (type === 'err') {
    localStorage.removeItem('wfm_sound_err');
    localStorage.removeItem('wfm_sound_err_name');
   }
   renderAudioSettingsUI();
   alert('Suara telah dikembalikan ke file resmi bawaan sistem: suara absen-berhasil.mpeg & suara absen-gagal.mpeg.');
  }

  function toggleVoiceTTS(enabled) {
   localStorage.setItem('wfm_sound_voice_enabled', enabled ? 'true' : 'false');
  }

  function renderAudioSettingsUI() {
   const inName = localStorage.getItem('wfm_sound_in_name');
   const errName = localStorage.getItem('wfm_sound_err_name');
   const voiceEnabled = localStorage.getItem('wfm_sound_voice_enabled') === 'true';

   const inStatus = document.getElementById('audio-in-status');
   const inFilename = document.getElementById('audio-in-filename');
   if (inStatus && inFilename) {
    if (inName) {
     inStatus.innerText = 'Kustom: ' + inName;
     inStatus.className = 'text-[10px] font-extrabold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 border border-slate-300';
     inFilename.innerText = 'File kustom aktif: ' + inName;
    } else {
     inStatus.innerText = 'Bawaan Folder';
     inStatus.className = 'text-[10px] font-extrabold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 border border-slate-300';
     inFilename.innerText = 'File resmi sistem: suara absen-berhasil.mpeg';
    }
   }

   const errStatus = document.getElementById('audio-err-status');
   const errFilename = document.getElementById('audio-err-filename');
   if (errStatus && errFilename) {
    if (errName) {
     errStatus.innerText = 'Kustom: ' + errName;
     errStatus.className = 'text-[10px] font-extrabold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 border border-slate-300';
     errFilename.innerText = 'File kustom aktif: ' + errName;
    } else {
     errStatus.innerText = 'Bawaan Folder';
     errStatus.className = 'text-[10px] font-extrabold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 border border-slate-300';
     errFilename.innerText = 'File resmi sistem: suara absen-gagal.mpeg';
    }
   }

   const toggleVoice = document.getElementById('toggle-voice-tts');
   if (toggleVoice) {
    toggleVoice.checked = voiceEnabled;
   }
  }

  function playLocationVerifiedSound() {
   try {
    const ctx = getAudioContext();
    if (ctx) {
     const now = ctx.currentTime;
     const notes = [440, 880];
     notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.08);
      gain.gain.setValueAtTime(0.01, now + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.25, now + i * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.2);
     });
    }
   } catch (e) {}

   setTimeout(() => {
    speakNotification('Lokasi sukses');
   }, 200);
  }

  // =========================================================
  // PROFESSIONAL FLOATING TOAST NOTIFICATION (NON-BLOCKING UNTUK ABSEN MASAL)
  // =========================================================
  let attendanceToastTimeout = null;

  function showProfessionalAttendanceToast(data) {
   const toast = document.getElementById('attendance-success-toast');
   if (!toast) return;

   const {
    isError = false,
    isWarning = false,
    title = 'Absensi Berhasil!',
    subtitle = 'Data absensi telah otomatis tersimpan ke Cloud',
    name = '-',
    nik = '-',
    dept = 'STAFF',
    type = 'check_in',
    warehouse = activeWarehouse || 'MBI',
    time = formatDisplayTimeWIB(new Date()).replace(/\./g, ':') + ' WIB',
    statusText = 'Tepat Waktu',
    isLate = false
   } = data;

   const cardContainer = document.getElementById('toast-card-container');
   const headerBg = document.getElementById('toast-header-bg');
   const headerIconBox = document.getElementById('toast-header-icon-box');
   const titleEl = document.getElementById('toast-title');
   const subtitleEl = document.getElementById('toast-subtitle');
   const whBadgeEl = document.getElementById('toast-wh-badge');
   const avatarEl = document.getElementById('toast-avatar');
   const empNameEl = document.getElementById('toast-emp-name');
   const empNikDeptEl = document.getElementById('toast-emp-nik-dept');
   const typePillEl = document.getElementById('toast-type-pill');
   const timeEl = document.getElementById('toast-time');
   const statusBadgeEl = document.getElementById('toast-status-badge');
   const progressBar = document.getElementById('toast-progress-bar');

   titleEl.innerText = title;
   subtitleEl.innerText = subtitle;
   whBadgeEl.innerText = (warehouse || 'MBI').replace('Gudang ', '');
   empNameEl.innerText = name;
   empNikDeptEl.innerHTML = nik !== '-' ? `<span class="font-bold text-teal-700">${nik}</span> • <span>${(dept || 'STAFF').toUpperCase()}</span>` : `<span>${(dept || 'STAFF').toUpperCase()}</span>`;
   avatarEl.innerText = (name || 'K').charAt(0).toUpperCase();
   timeEl.innerText = time;

   if (isError) {
    cardContainer.className = 'bg-white/98 backdrop-blur-md rounded-3xl border-2 border-rose-500 shadow-2xl shadow-rose-950/25 overflow-hidden';
    headerBg.className = 'p-4 bg-gradient-to-r from-rose-600 to-rose-700 text-white flex items-center justify-between';
    headerIconBox.innerHTML = '<i data-lucide="alert-circle" class="w-5 h-5 text-white"></i>';
    typePillEl.innerText = 'GAGAL';
    typePillEl.className = 'px-2.5 py-1 rounded-xl text-xs font-black bg-rose-100 text-rose-900 border border-rose-300 shrink-0';
    statusBadgeEl.innerText = statusText;
    statusBadgeEl.className = 'font-bold text-rose-700';
    if (progressBar) progressBar.className = 'h-full bg-rose-500 w-full';
   } else if (isWarning) {
    cardContainer.className = 'bg-white/98 backdrop-blur-md rounded-3xl border-2 border-amber-500 shadow-2xl shadow-amber-950/25 overflow-hidden';
    headerBg.className = 'p-4 bg-gradient-to-r from-amber-600 to-amber-700 text-white flex items-center justify-between';
    headerIconBox.innerHTML = '<i data-lucide="alert-triangle" class="w-5 h-5 text-white"></i>';
    typePillEl.innerText = 'PERHATIAN';
    typePillEl.className = 'px-2.5 py-1 rounded-xl text-xs font-black bg-amber-100 text-amber-900 border border-amber-300 shrink-0';
    statusBadgeEl.innerText = statusText;
    statusBadgeEl.className = 'font-bold text-amber-700';
    if (progressBar) progressBar.className = 'h-full bg-amber-500 w-full';
   } else {
    cardContainer.className = 'bg-white/98 backdrop-blur-md rounded-3xl border-2 border-emerald-500 shadow-2xl shadow-emerald-950/25 overflow-hidden';
    headerBg.className = type === 'check_in' 
     ? 'p-4 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between'
     : 'p-4 bg-gradient-to-r from-sky-600 to-blue-700 text-white flex items-center justify-between';
    headerIconBox.innerHTML = '<i data-lucide="check-circle-2" class="w-5 h-5 text-white"></i>';
    typePillEl.innerText = type === 'check_in' ? 'MASUK' : 'PULANG';
    typePillEl.className = type === 'check_in' 
     ? 'px-2.5 py-1 rounded-xl text-xs font-black bg-emerald-100 text-emerald-900 border border-emerald-300 shrink-0'
     : 'px-2.5 py-1 rounded-xl text-xs font-black bg-sky-100 text-sky-900 border border-sky-300 shrink-0';
    
    if (isLate) {
     statusBadgeEl.innerText = 'Terlambat';
     statusBadgeEl.className = 'font-bold text-amber-700';
    } else {
     statusBadgeEl.innerText = statusText;
     statusBadgeEl.className = 'font-bold text-emerald-700';
    }
    if (progressBar) progressBar.className = type === 'check_in' ? 'h-full bg-emerald-500 w-full' : 'h-full bg-sky-500 w-full';
   }

   // Reset timer animation progress bar (2.2 Detik untuk Presensi Cepat Massal)
   if (progressBar) {
    progressBar.style.transition = 'none';
    progressBar.style.width = '100%';
    setTimeout(() => {
     progressBar.style.transition = 'width 2.2s linear';
     progressBar.style.width = '0%';
    }, 40);
   }

   // Tampilkan toast (non-blocking)
   toast.classList.remove('hidden');
   setTimeout(() => {
    toast.classList.remove('opacity-0', 'scale-95');
    toast.classList.add('opacity-100', 'scale-100');
   }, 10);

   lucide.createIcons();

   // Jeda 2.2 detik (optimal untuk scan massal antrean) lalu otomatis hilang
   if (attendanceToastTimeout) clearTimeout(attendanceToastTimeout);
   attendanceToastTimeout = setTimeout(() => {
    hideProfessionalAttendanceToast();
   }, 2200);
  }

  function hideProfessionalAttendanceToast() {
   const toast = document.getElementById('attendance-success-toast');
   if (!toast) return;
   toast.classList.remove('opacity-100', 'scale-100');
   toast.classList.add('opacity-0', 'scale-95');
   setTimeout(() => {
    toast.classList.add('hidden');
   }, 300);
   if (attendanceToastTimeout) clearTimeout(attendanceToastTimeout);
  }

  // Variabel Pengatur Sensitivitas & Anti Double-Scan
  let isScanProcessing = false;
  let lastScannedCode = '';
  let lastScannedTime = 0;

  async function processScannedText(decodedText) {
   const trimmed = decodedText ? decodedText.trim() : '';
   if (!trimmed) return;

   const now = Date.now();

   // PROTEKSI 1: Jika sistem sedang memproses hasil scan -> Abaikan scan lanjutan
   if (isScanProcessing) {
    return;
   }

   // PROTEKSI 2: Anti-Double Read untuk Barcode yang Sama (Cooldown 2.5 Detik)
   if (trimmed === lastScannedCode && (now - lastScannedTime < 2500)) {
    return;
   }

   // PROTEKSI 3: Jeda Minimal Antar Scan Berbeda (Hanya 150ms agar super responsif)
   if (now - lastScannedTime < 150) {
    return;
   }

   const alertEl = document.getElementById('att-alert');
   if (alertEl) alertEl.classList.add('hidden');

   const isUserAdminCurrent = isUserAdmin(currentUser) || (currentUser && (currentUser.role === 'admin' || currentUser.role === 'superadmin' || (currentUser.nik && currentUser.nik.startsWith('ADM'))));
   const isScannedAdmin = trimmed.toUpperCase().startsWith('ADM') || trimmed.toUpperCase().includes('ADMIN');
   const isScannerTerminal = isUserScanner(currentUser) || (currentUser && (currentUser.role === 'scanner' || (currentUser.nik && currentUser.nik.startsWith('ABSEN-'))));
   const isInstantScanMode = isUserAdminCurrent || isScannedAdmin || isScannerTerminal;

   isScanProcessing = true;
   lastScannedCode = trimmed;
   lastScannedTime = now;

   const statusMsg = document.getElementById('cam-status-msg');

   // MODE CEPAT SEKETIKA (0ms): Untuk Akun Scanner Pos Gudang & Admin
   // Menghilangkan jeda 5-6 detik pencarian satelit GPS per scan agar antrean absensi kilat lancar!
   if (isInstantScanMode) {
    if (statusMsg) statusMsg.innerText = `Memproses absensi...`;
    processAttendanceScan(trimmed);
    return;
   }

   // VERIFIKASI GPS OTOMATIS DENGAN CACHE KILAT
   const targetWhCoords = getWarehouseCoords(activeWarehouse);
   const curRad = Number(targetWhCoords.radius) > 0 ? Number(targetWhCoords.radius) : (Number(localStorage.getItem('wfm_gps_radius')) || 100);
   if (statusMsg) statusMsg.innerText = `Memverifikasi radius GPS HP (maksimal ${curRad}m)...`;

   const gpsCheck = await verifyGPSLocation(activeWarehouse);
   if (!gpsCheck.valid) {
    showProfessionalAttendanceToast({
     isError: true,
     title: 'Di Luar Radius Gudang',
     subtitle: gpsCheck.error || `Anda berada di luar batas ${curRad} meter dari titik lokasi gudang.`,
     statusText: 'GPS Tidak Valid'
    });
    playAttendanceErrorSound('Di luar lokasi');
    if (statusMsg) statusMsg.innerText = `Verifikasi GPS gagal (di luar radius ${curRad}m).`;
    setTimeout(() => { isScanProcessing = false; }, 2500);
    return;
   } else {
    if (statusMsg) statusMsg.innerText = `GPS Valid (${gpsCheck.distance}m / maks ${curRad}m)! Memproses absensi...`;
   }

   // Langsung proses absensi kartu ID
   processAttendanceScan(trimmed);
  }

  async function rescueActiveOpenSessionFromCloud(warehouse, matchedUser) {
   if (!matchedUser) return null;
   const wh = (warehouse || (typeof activeWarehouse !== 'undefined' ? activeWarehouse : 'MBI') || 'MBI').toUpperCase();
   const whLower = wh.toLowerCase();
   const endpoint = getFirebaseEndpoint(wh);
   if (!endpoint) return null;

   const MAX_ACTIVE_SHIFT_MS = 18 * 60 * 60 * 1000;
   const nowMs = Date.now();

   const isMatch = (r) => {
    if (!r || !r.checkInTime) return false;
    if (r.checkOutTime && r.checkOutTime !== '-' && r.checkOutTime !== '') return false;
    if (r.notes && r.notes.toLowerCase().includes('miss scan')) return false;
    if (r.checkInStatus === 'miss_scan') return false;

    const inMs = parseSafeTimeMs(r.checkInTime, r.date) || new Date(r.checkInTime).getTime();
    if (isNaN(inMs) || inMs <= 0) return false;
    const elapsed = nowMs - inMs;
    if (elapsed < 0 || elapsed >= MAX_ACTIVE_SHIFT_MS) return false;

    const uId = matchedUser.id ? String(matchedUser.id).trim().toLowerCase() : '';
    const uNik = matchedUser.nik ? String(matchedUser.nik).trim().toUpperCase() : '';
    const uName = matchedUser.name ? cleanStr(matchedUser.name) : '';

    const rId = r.userId ? String(r.userId).trim().toLowerCase() : '';
    const rNik = r.userNik ? String(r.userNik).trim().toUpperCase() : '';
    const rName = r.userName ? cleanStr(r.userName) : '';

    if (uId && rId && uId === rId) return true;
    if (uNik && rNik && uNik === rNik) return true;
    if (uName && rName && uName === rName) return true;
    return false;
   };
   try {
    const candidates = [];

    // 0. Cek langsung ke Supabase (Bebas Limit Kuota 24/7 & Realtime)
    try {
     if (typeof rescueActiveOpenSessionFromSupabase === 'function') {
      const sbSession = await rescueActiveOpenSessionFromSupabase(wh, matchedUser);
      if (sbSession && isMatch(sbSession)) candidates.push(sbSession);
     }
    } catch (eSbRescue) {}

    // 1. Cek langsung ke Cloud Firestore (_metadata/today_attendance) - Super Cepat (1 Read, < 100ms)
    try {
     const fsToday = await getDocFromFirestore(wh, '_metadata', 'today_attendance');
     if (fsToday && Array.isArray(fsToday.records)) {
      fsToday.records.forEach(item => { if (item && isMatch(item)) candidates.push(item); });
     }
    } catch (eFs) {}

    // 2. Jaring Pengaman Shift Malam Lintas Hari & Beda Perangkat:
    // Jika tidak ada di today_attendance (misal sudah berganti tanggal ke hari berikutnya atau tertimpa),
    // query langsung ke koleksi dokumen 'attendance' di Firestore berdasarkan NIK & ID karyawan (maksimal 5 dokumen, super hemat)!
    if (candidates.length === 0 && typeof queryFirestoreAttendanceByField === 'function') {
     try {
      if (matchedUser.nik) {
       const byNik = await queryFirestoreAttendanceByField(wh, 'userNik', String(matchedUser.nik).trim(), 5);
       byNik.forEach(item => { if (item && isMatch(item)) candidates.push(item); });
      }
      if (candidates.length === 0 && matchedUser.id) {
       const byId = await queryFirestoreAttendanceByField(wh, 'userId', String(matchedUser.id).trim(), 5);
       byId.forEach(item => { if (item && isMatch(item)) candidates.push(item); });
      }
     } catch (eQuery) {}
    }

    // CATATAN PERLINDUNGAN KUOTA: listAllDocsFromFirestore DILARANG KERAS dipanggil di sini
    // agar scan absen masuk biasa tidak menyedot ribuan dokumen riwayat presensi.

    if (candidates.length > 0) {
     // Pilih kandidat dengan waktu checkIn terbaru
     candidates.sort((a, b) => {
      const ta = a.checkInTime ? new Date(a.checkInTime).getTime() : 0;
      const tb = b.checkInTime ? new Date(b.checkInTime).getTime() : 0;
      return tb - ta;
     });
     const bestSession = candidates[0];

     // Integrasikan ke database lokal HP saat ini agar langsung tersimpan di memori dan cache
     const localAtt = getWhDB(wh, 'attendance', []);
     const existingIdx = localAtt.findIndex(x => x && (x.id === bestSession.id || (x.userNik === bestSession.userNik && x.date === bestSession.date)));
     if (existingIdx >= 0) {
      localAtt[existingIdx] = { ...localAtt[existingIdx], ...bestSession };
     } else {
      localAtt.unshift(bestSession);
     }
     setWhDB(wh, 'attendance', localAtt, true);
     return bestSession;
    }
   } catch (e) {
    console.warn('rescueActiveOpenSessionFromCloud notice:', e);
   }
   return null;
  }

  async function processAttendanceScan(nikCode) {
   if (typeof recordUserInteraction === 'function') recordUserInteraction();
   const now = new Date();
   const todayStr = getLocalDateString(now);
   const currentWh = (activeWarehouse || 'MBI').toUpperCase();
   const primaryUsers = getWhDB(currentWh, 'users', currentWh === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);
   const otherWh = (currentWh === 'MBI') ? 'MAI' : 'MBI';
   const secondaryUsers = getWhDB(otherWh, 'users', otherWh === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);
   const allUsers = [...primaryUsers, ...secondaryUsers];

   const rawCode = (nikCode || '').trim();
   let scannedNik = rawCode;
   let scannedName = '';

   // A. Cek payload JSON (jika QR memuat format { nik: "...", name: "..." })
   if (rawCode.startsWith('{') && rawCode.endsWith('}')) {
    try {
     const parsed = JSON.parse(rawCode);
     if (parsed.nik) scannedNik = parsed.nik;
     if (parsed.name) scannedName = parsed.name;
     if (parsed.id) scannedNik = parsed.id;
    } catch(e) {}
   }

   // B. Cek pemisah pipe | (misal "MBI26-002|RIZKI ELIYANSYAH" atau "RIZKI ELIYANSYAH|MBI26-002")
   if (scannedNik.includes('|')) {
    const parts = scannedNik.split('|').map(s => s.trim());
    if (parts[0].match(/(MBI|MAI|ADM|\d)/i)) {
     scannedNik = parts[0];
     scannedName = parts[1] || '';
    } else {
     scannedName = parts[0];
     scannedNik = parts[1] || '';
    }
   }

   // C. Cek format URL QR (misal "https://.../id?nik=MBI26-002" atau "?id=...")
   if (scannedNik.includes('?')) {
    try {
     const urlObj = new URL(scannedNik, window.location.href);
     const pNik = urlObj.searchParams.get('nik') || urlObj.searchParams.get('id') || urlObj.searchParams.get('code');
     if (pNik) scannedNik = pNik;
    } catch(e) {}
   }

   const cleanUpper = scannedNik.toUpperCase().trim();
   const cleanAlphaNum = cleanUpper.replace(/[^A-Z0-9]/g, '');

   // D. Ekstraksi pola NIK dengan regex fleksibel (toleran spasi/strip: MBI26-002, MBI-26-002, MAI 26-001, dsb)
   let extractedNik = '';
   const nikMatch = scannedNik.match(/(MBI|MAI)[-\s]?\d{2}[-\s]?\d{3,4}/i) || scannedNik.match(/ADM[-\s]?\d+/i) || scannedNik.match(/ADM-MAI/i) || scannedNik.match(/ABSEN-(MBI|MAI)/i);
   if (nikMatch) {
    extractedNik = nikMatch[0].toUpperCase().replace(/\s+/g, '');
   }

   function isExactCodeMatch(u) {
     if (!u) return false;
     const uNik = (u.nik || '').toUpperCase().trim();
     const uBarcode = (u.barcodeValue || '').toUpperCase().trim();
     const uId = (u.id || '').trim();
     const uCleanAlphaNum = uNik.replace(/[^A-Z0-9]/g, '');
     const uCleanBarcodeAlphaNum = uBarcode.replace(/[^A-Z0-9]/g, '');
     if (uNik && (uNik === cleanUpper || (cleanAlphaNum && uCleanAlphaNum === cleanAlphaNum))) return true;
     if (uBarcode && (uBarcode === cleanUpper || (cleanAlphaNum && uCleanBarcodeAlphaNum === cleanAlphaNum))) return true;
     if (extractedNik && (uNik === extractedNik || uCleanAlphaNum === extractedNik.replace(/[^A-Z0-9]/g, ''))) return true;
     if (uId && (uId === scannedNik || uId === rawCode)) return true;
     return false;
    }
    function isNameOnlyMatch(u) {
     if (!u || !u.name) return false;
     const cn = cleanStr(u.name);
     return !!cn && (cn === cleanStr(scannedNik) || (scannedName && cn === cleanStr(scannedName)) || cn === cleanStr(rawCode));
    }

    // Tahap 1: kode/NIK/barcode PERSIS (prioritas mutlak, gudang aktif dahulu)
    let matchedUser = primaryUsers.find(isExactCodeMatch) || secondaryUsers.find(isExactCodeMatch) || null;
    // Tahap 2: nama (hanya jika kode bukan NIK yang dikenal)
    if (!matchedUser) {
     matchedUser = primaryUsers.find(isNameOnlyMatch) || secondaryUsers.find(isNameOnlyMatch) || null;
    }
    // Tahap 3: sufiks nomor parsial -> hanya diterima jika HANYA ADA SATU kandidat (mencegah NIK tertukar)
    if (!matchedUser && cleanAlphaNum.length >= 6) {
     const suffixCandidates = allUsers.filter(u => u && u.nik && u.nik.toUpperCase().replace(/[^A-Z0-9]/g, '').endsWith(cleanAlphaNum));
     if (suffixCandidates.length === 1) matchedUser = suffixCandidates[0];
    }
    if (!matchedUser) {
     matchedUser = null;
   }

   if (!matchedUser) {
    const gunCard = document.getElementById('last-gun-success-card');
    if (gunCard) gunCard.classList.add('hidden');
    showProfessionalAttendanceToast({
     isError: true,
     title: 'Kartu Tidak Terdaftar',
     subtitle: `Barcode ID "${rawCode}" tidak ditemukan di database karyawan.`,
     name: 'ID: ' + rawCode,
     nik: '-',
     dept: '-',
     statusText: 'Tidak Ditemukan'
    });
    playAttendanceErrorSound('Kartu tidak terdaftar');
    setTimeout(() => { isScanProcessing = false; }, 2500);
    return;
   }

   // Validasi Status Aktif Karyawan
   if (!isManagementSystemAccount(matchedUser) && (matchedUser.status === 'inactive' || matchedUser.isActive === false || isNikInactiveRegistered(matchedUser.nik))) {
    const gunCard = document.getElementById('last-gun-success-card');
    if (gunCard) gunCard.classList.add('hidden');
    showProfessionalAttendanceToast({
     isError: true,
     title: 'Kartu Berstatus Nonaktif',
     subtitle: `Karyawan "${matchedUser.name}" (${matchedUser.nik || matchedUser.id}) berstatus NONAKTIF. Hubungi Admin HRD.`,
     name: matchedUser.name,
     nik: matchedUser.nik || matchedUser.id,
     dept: matchedUser.dept || '-',
     statusText: 'Nonaktif'
    });
    playAttendanceErrorSound('Kartu karyawan berstatus nonaktif');
    setTimeout(() => { isScanProcessing = false; }, 2500);
    return;
   }

   // Validasi Ketat Penempatan Gudang (Cross-Warehouse Protection)
   // Mencegah karyawan Gudang MBI absen di Scanner Gudang MAI, dan sebaliknya
   const scannerWh = (activeWarehouse || 'MBI').toUpperCase();
   let userWh = (matchedUser.warehouse || '').toUpperCase();
   if (!userWh && matchedUser.nik) {
    const cleanNikUpper = matchedUser.nik.toUpperCase();
    if (cleanNikUpper.startsWith('MAI')) userWh = 'MAI';
    else if (cleanNikUpper.startsWith('MBI')) userWh = 'MBI';
   }
   if (!userWh) {
    const isMaiUser = maiUsers.some(u => u && ((u.nik && matchedUser.nik && u.nik.toUpperCase() === matchedUser.nik.toUpperCase()) || u.id === matchedUser.id));
    userWh = isMaiUser ? 'MAI' : 'MBI';
   }

   const nowFormatted = formatDisplayTimeWIB(now) + ' WIB';

   if (!isManagementSystemAccount(matchedUser) && userWh !== scannerWh) {
    const gunCard = document.getElementById('last-gun-success-card');
    if (gunCard) gunCard.classList.add('hidden');
    showProfessionalAttendanceToast({
     isError: true,
     title: 'Beda Gudang Penempatan',
     subtitle: `Kartu presensi "${matchedUser.name}" (${matchedUser.nik || matchedUser.id}) terdaftar di Gudang ${userWh}. Tidak dapat absen di Scanner Gudang ${scannerWh}. Silakan absen di Pos Scanner Gudang ${userWh}.`,
     name: matchedUser.name,
     nik: matchedUser.nik || matchedUser.id,
     dept: matchedUser.dept || 'Staff',
     warehouse: userWh,
     time: nowFormatted,
     statusText: `Khusus Gudang ${userWh}`
    });
    playAttendanceErrorSound('Beda gudang penempatan');
    setTimeout(() => { isScanProcessing = false; }, 2000);
    return;
   }

   const targetWh = scannerWh;
   let attendances = getWhDB(targetWh, 'attendance', targetWh === 'MBI' ? SEED_MBI_ATTENDANCE : SEED_MAI_ATTENDANCE);

   // 1. FILTER & URUTKAN SELURUH RIWAYAT PRESENSI KARYAWAN SECARA KRONOLOGIS TERBARU (DESCENDING)
   const findUserAtts = (list) => (list || []).filter(a => 
    a && !isAttendanceMarkedDeleted(a) && (
     (a.userId && a.userId === matchedUser.id) ||
     (a.userName && cleanStr(a.userName) === cleanStr(matchedUser.name)) ||
     (a.userNik && a.userNik.toUpperCase() === matchedUser.nik.toUpperCase() && (!a.userName || cleanStr(a.userName) === cleanStr(matchedUser.name)))
    )
   ).sort((a, b) => {
    const tA = a.checkInTime ? new Date(a.checkInTime).getTime() : 0;
    const tB = b.checkInTime ? new Date(b.checkInTime).getTime() : 0;
    return tB - tA;
   });

   let userAtts = findUserAtts(attendances);

   // 2. IDENTIFIKASI SESI AKTIF (MENDUKUNG 100% SEMUA SHIFT TERMASUK SHIFT MALAM LINTAS HARI)
   const MAX_ACTIVE_SHIFT_MS = 18 * 60 * 60 * 1000;
   
   const findOpenSession = (atts) => (atts || []).find(a => {
    if (!a || !a.checkInTime || isAttendanceMarkedDeleted(a)) return false;
    if (a.checkOutTime && a.checkOutTime !== '-' && a.checkOutTime !== '') return false;
    const inMs = parseSafeTimeMs(a.checkInTime, a.date) || new Date(a.checkInTime).getTime();
    if (isNaN(inMs) || inMs <= 0) return false;
    const elapsed = now.getTime() - inMs;
    return (elapsed >= 0 && elapsed < MAX_ACTIVE_SHIFT_MS);
   });

   let activeOpenSession = findOpenSession(userAtts);

   // JARING PENGAMAN MULTI-DEVICE CLOUD (Cross-Device Rescue 24 Jam):
   // Jika sesi aktif belum ditemukan di memori lokal HP (misal karyawan absen masuk di HP lain),
   // segera cari sesi terbuka langsung ke Firebase Cloud sebelum memutuskan status presensi!
   if (!activeOpenSession) {
    try {
     const rescued = await rescueActiveOpenSessionFromCloud(targetWh, matchedUser);
     if (rescued) {
      attendances = getWhDB(targetWh, 'attendance', targetWh === 'MBI' ? SEED_MBI_ATTENDANCE : SEED_MAI_ATTENDANCE);
      userAtts = findUserAtts(attendances);
      activeOpenSession = rescued;
     }
    } catch (eRescue) {}
   }

   // PROTEKSI ANTI-BERPINDAH KE ABSEN PULANG:
   // Tombol Absen Masuk dilarang keras otomatis berubah menjadi Absen Pulang.
   // Karyawan yang ter-scan 2 kali saat Absen Masuk akan langsung diberi notifikasi bahwa mereka sudah absen masuk.

   // SMART AUTO-SWITCH KE ABSEN PULANG (MENCEGAH MISS SCAN MASSAL DI GUDANG MBI & MAI):
   // Jika karyawan sudah memiliki sesi masuk aktif dan sudah bertugas >= 15 menit,
   // maka tap kartu ini adalah niat Absen Pulang!
   // Otomatis alihkan ke mode Absen Pulang agar karyawan TIDAK TERKENA MISS SCAN akibat pos scanner masih di tab 'Masuk'.
   if (selectedAttendanceType === 'check_in' && activeOpenSession) {
    const inMs = (typeof parseSafeTimeMs === 'function') 
      ? (parseSafeTimeMs(activeOpenSession.checkInTime, activeOpenSession.date) || new Date(activeOpenSession.checkInTime).getTime())
      : new Date(activeOpenSession.checkInTime).getTime();
    const diffMs = Math.max(0, now.getTime() - inMs);
    if (diffMs >= 15 * 60 * 1000) {
     selectedAttendanceType = 'check_out';
     try { setAttendanceType('check_out'); } catch(eType) {}
    }
   }

   if (selectedAttendanceType === 'check_in') {
    // ==========================================
    // MODE ABSEN MASUK (CHECK_IN) - 24 JAM PENUH
    // ==========================================

    // 1. PROTEKSI MUTLAK SCAN MASUK GANDA (DOUBLE SCAN / TAP 2 KALI):
    // Karyawan yang SUDAH ABSEN MASUK dilarang absen masuk ulang dan TIDAK BOLEH dialihkan menjadi absen pulang.
    // Berikan notifikasi peringatan bahwa presensi masuk sudah tersimpan.
    if (activeOpenSession) {
     const inTimeStr = formatDisplayTimeWIB(activeOpenSession.checkInTime).replace(/\./g, ':') + ' WIB';
     const shiftDateStr = activeOpenSession.date || getLocalDateString(new Date(activeOpenSession.checkInTime));

     showProfessionalAttendanceToast({
      isWarning: true,
      title: 'Sudah Absen Masuk!',
      subtitle: `${matchedUser.name} (${matchedUser.nik || matchedUser.id}) sudah berhasil tercatat absen masuk pada jam ${inTimeStr} (Shift ${shiftDateStr}). Scan masuk tidak dapat diulang. Untuk absen pulang, silakan pilih tombol [Absen Keluar].`,
      name: matchedUser.name,
      nik: matchedUser.nik || matchedUser.id,
      dept: matchedUser.dept || 'Staff',
      warehouse: targetWh,
      time: inTimeStr,
      statusText: 'Sudah Absen Masuk'
     });
     playAttendanceErrorSound('Sudah absen masuk');
     setTimeout(() => { isScanProcessing = false; }, 2000);
     return;
    }

    // 2. CEK APAKAH SUDAH MENYELESAIKAN SHIFT HARI INI (SUDAH ABSEN MASUK & PULANG DI HARI YANG SAMA)
    // Mencegah karyawan absen masuk ulang setelah pulang di hari yang sama yang menyebabkan data ganda/lonjakan data
    const todayCompletedSession = userAtts.find(a => {
     if (!a || !a.checkOutTime || isAttendanceMarkedDeleted(a)) return false;
     const aLocalDate = a.checkInTime ? getLocalDateString(new Date(a.checkInTime)) : a.date;
     return (a.date === todayStr || aLocalDate === todayStr);
    });

    if (todayCompletedSession) {
     const inTimeStr = todayCompletedSession.checkInTime ? (formatDisplayTimeWIB(todayCompletedSession.checkInTime, false).replace(/\./g, ':') + ' WIB') : '-';
     const outTimeStr = formatDisplayTimeWIB(todayCompletedSession.checkOutTime, false).replace(/\./g, ':') + ' WIB';
     showProfessionalAttendanceToast({
      isWarning: true,
      title: 'Shift Hari Ini Sudah Selesai!',
      subtitle: `${matchedUser.name} (${matchedUser.nik || matchedUser.id}) sudah selesai absen masuk (${inTimeStr}) dan pulang (${outTimeStr}) untuk hari ini. Presensi masuk tidak dapat diulang pada hari yang sama.`,
      name: matchedUser.name,
      nik: matchedUser.nik,
      dept: matchedUser.dept || 'Staff',
      warehouse: targetWh,
      time: outTimeStr,
      statusText: 'Sudah Selesai Shift'
     });
     playAttendanceErrorSound('Shift hari ini sudah selesai');
     setTimeout(() => { isScanProcessing = false; }, 2000);
     return;
    }

    // 3. FINALISASI SESI KEDALUWARSA (> 18 JAM TANPA PULANG) SEBAGAI MISS SCAN
    const expiredOpenSession = userAtts.find(a => a.checkInTime && !a.checkOutTime && !a.notes?.includes('Miss Scan'));
    if (expiredOpenSession) {
     expiredOpenSession.checkOutTime = null;
     expiredOpenSession.notes = expiredOpenSession.notes ? (expiredOpenSession.notes.includes('Miss Scan') ? expiredOpenSession.notes : expiredOpenSession.notes + ' (Miss Scan)') : 'Miss Scan';
     setWhDB(targetWh, 'attendance', attendances, true);
     try { syncAttendanceToCloud(targetWh, attendances, expiredOpenSession); } catch (ePush) {}
    }

    // KARYAWAN MEMBUAT ABSEN MASUK BARU PADA SEMUA JAM (00:00 - 23:59 WIB)
    const minute = now.getMinutes();
    const isLate = minute >= 1 && minute <= 30;

    attendances.unshift({
     id: `att-${targetWh.toLowerCase()}-${Date.now()}`,
     userId: matchedUser.id,
     userNik: matchedUser.nik,
     userName: matchedUser.name,
     dept: matchedUser.dept,
     outsource: matchedUser.outsource || 'Internal',
     warehouse: targetWh,
     date: todayStr,
     checkInTime: now.toISOString(),
     checkOutTime: null,
     checkInStatus: isLate ? 'late' : 'on_time',
     notes: (document.getElementById('att-notes')?.value || '').trim(),
     updatedAt: now.toISOString()
    });

    const notesInput = document.getElementById('att-notes');
    if (notesInput) notesInput.value = '';

    const newlyAddedRecord = attendances[0];

    // 1. Simpan ke database lokal seketika (skipCloudSave = true agar tidak memicu dobel proses)
    setWhDB(targetWh, 'attendance', attendances, true);

    // 2. RESPON KILAT (0ms): Langsung munculkan notifikasi & bunyikan suara tanpa jeda
    showProfessionalAttendanceToast({
     type: 'check_in',
     title: 'Absen Masuk Berhasil!',
     subtitle: `Presensi ${matchedUser.name} (${matchedUser.outsource || 'Internal'}) sukses tercatat & tersinkron`,
     name: matchedUser.name,
     nik: matchedUser.nik,
     dept: matchedUser.dept || 'Staff',
     warehouse: targetWh,
     time: nowFormatted,
     statusText: isLate ? 'Terlambat' : 'Tepat Waktu',
     isLate: isLate
    });

    playAttendanceSuccessSound('check_in', matchedUser.name);

    // 3. Sinkronisasi multi-cloud via Outbox anti-hilang di latar belakang (non-blocking) agar kamera HP tetap 60 FPS
    setTimeout(() => {
     syncAttendanceToCloud(targetWh, attendances, newlyAddedRecord);
    }, 20);
   } else {
    // ==========================================
    // MODE ABSEN PULANG (CHECK_OUT) - 24 JAM PENUH
    // ==========================================
    // KASUS 1: Ada sesi terbuka yang sah (rentang 0 s.d 18 jam)
    // MENDUKUNG PENUH SELURUH SHIFT: Shift Malam Lintas Hari (Masuk kemarin malam, Pulang pagi hari ini), Shift Dini Hari, Shift Pagi, Shift Siang/Sore, Shift Lembur.
    if (activeOpenSession) {
     const inMs = parseSafeTimeMs(activeOpenSession.checkInTime, activeOpenSession.date) || new Date(activeOpenSession.checkInTime).getTime();
     const diffMs = Math.max(0, now.getTime() - inMs);

     // Proteksi jika baru saja tap masuk (< 1 menit)
     if (diffMs < 60 * 1000) {
      const inTimeStr = formatDisplayTimeWIB(activeOpenSession.checkInTime).replace(/\./g, ':') + ' WIB';
      showProfessionalAttendanceToast({
       isWarning: true,
       title: 'Baru Saja Absen Masuk!',
       subtitle: `${matchedUser.name} baru saja tap masuk pada jam ${inTimeStr}. Mohon tunggu minimal 1 menit sebelum melakukan absen pulang.`,
       name: matchedUser.name,
       nik: matchedUser.nik,
       dept: matchedUser.dept || 'Staff',
       warehouse: targetWh,
       time: inTimeStr,
       statusText: 'Baru Tap Masuk'
      });
      playAttendanceErrorSound('Baru saja absen masuk');
      setTimeout(() => { isScanProcessing = false; }, 2000);
      return;
     }

     activeOpenSession.checkOutTime = now.toISOString();
     activeOpenSession.updatedAt = now.toISOString();
     activeOpenSession.userNik = matchedUser.nik;
     activeOpenSession.userName = matchedUser.name;
     activeOpenSession.userId = matchedUser.id;
     activeOpenSession.dept = matchedUser.dept;
     activeOpenSession.outsource = matchedUser.outsource || activeOpenSession.outsource || 'Internal';
     cleanStaleMissScanFlags(activeOpenSession);

     // Sinkronisasi mutlak ke array attendances lokal untuk mencegah reference detached
     const existIdx = attendances.findIndex(x => x && (
      (activeOpenSession.id && x.id === activeOpenSession.id) ||
      (x.userNik && activeOpenSession.userNik && x.userNik.toUpperCase() === activeOpenSession.userNik.toUpperCase() && (!x.checkOutTime || x.checkOutTime === '-' || x.checkOutTime === '')) ||
      (x.userId && activeOpenSession.userId && x.userId === activeOpenSession.userId && (!x.checkOutTime || x.checkOutTime === '-' || x.checkOutTime === ''))
     ));

     if (existIdx >= 0) {
      attendances[existIdx] = { ...attendances[existIdx], ...activeOpenSession };
      activeOpenSession = attendances[existIdx];
     } else {
      attendances.unshift(activeOpenSession);
     }

     // 1. Simpan ke database lokal seketika (skipCloudSave = true)
     setWhDB(targetWh, 'attendance', attendances, true);

     const hrs = Math.floor(diffMs / (1000 * 60 * 60));
     const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

     // 2. RESPON KILAT (0ms): Langsung munculkan notifikasi & bunyikan suara tanpa jeda
     showProfessionalAttendanceToast({
      type: 'check_out',
      title: 'Absen Pulang Berhasil!',
      subtitle: `Presensi pulang ${matchedUser.name} sukses tercatat (Shift ${activeOpenSession.date}, durasi kerja ${hrs} jam ${mins} mnt)`,
      name: matchedUser.name,
      nik: matchedUser.nik,
      dept: matchedUser.dept || 'Staff',
      warehouse: targetWh,
      time: nowFormatted,
      statusText: 'Shift Selesai',
      isLate: false
     });

     playAttendanceSuccessSound('check_out', matchedUser.name);

     // 3. Sinkronisasi multi-cloud via Outbox anti-hilang di latar belakang (non-blocking) agar kamera HP tetap 60 FPS
     setTimeout(() => {
      syncAttendanceToCloud(targetWh, attendances, activeOpenSession);
     }, 20);
    } else {
     // KASUS 2: Tidak ada sesi terbuka (Sudah pulang sebelumnya ATAU Belum masuk)
     const recentAtt = userAtts[0];
     const hasRecentCheckout = recentAtt && recentAtt.checkOutTime && ((now.getTime() - new Date(recentAtt.checkOutTime).getTime()) < MAX_ACTIVE_SHIFT_MS);

     if (hasRecentCheckout) {
      const outTimeStr = formatDisplayTimeWIB(recentAtt.checkOutTime, false).replace(/\./g, ':') + ' WIB';
      showProfessionalAttendanceToast({
       isWarning: true,
       title: 'Sudah Absen Pulang!',
       subtitle: `${matchedUser.name} (${matchedUser.nik}) sudah tercatat absen pulang pada jam ${outTimeStr}.`,
       name: matchedUser.name,
       nik: matchedUser.nik,
       dept: matchedUser.dept || 'Staff',
       warehouse: targetWh,
       time: outTimeStr,
       statusText: 'Sudah Pulang'
      });
      playAttendanceErrorSound('Sudah absen pulang');
     } else {
      showProfessionalAttendanceToast({
       isError: true,
       title: 'Belum Absen Masuk',
       subtitle: `${matchedUser.name} (${matchedUser.nik}) belum tercatat absen masuk untuk shift ini. Silakan pilih tombol [Absen Masuk] terlebih dahulu.`,
       name: matchedUser.name,
       nik: matchedUser.nik,
       dept: matchedUser.dept || 'Staff',
       warehouse: targetWh,
       time: nowFormatted,
       statusText: 'Belum Masuk'
      });
      playAttendanceErrorSound('Belum absen masuk');
     }
     setTimeout(() => { isScanProcessing = false; }, 2000);
     return;
    }
   }

   // Tampilkan kartu bukti sukses di Standby Wrapper & Gun Wrapper
   const card = document.getElementById('last-scan-success-card');
   const nameEl = document.getElementById('last-scan-name');
   const nikDeptEl = document.getElementById('last-scan-nik-dept');
   const typeBadgeEl = document.getElementById('last-scan-type-badge');
   const timeEl = document.getElementById('last-scan-time');
   const standbyTitle = document.getElementById('standby-title');
   const standbySubtitle = document.getElementById('standby-subtitle');
   const standbyIcon = document.getElementById('standby-icon-box');
   const btnOpenText = document.getElementById('btn-open-cam-text');

   // Gun Card elements
   const gunCard = document.getElementById('last-gun-success-card');
   const gunNameEl = document.getElementById('last-gun-name');
   const gunNikDeptEl = document.getElementById('last-gun-nik-dept');
   const gunTypeBadgeEl = document.getElementById('last-gun-type-badge');
   const gunTimeEl = document.getElementById('last-gun-time');

   if (nameEl) nameEl.innerText = matchedUser.name;
   if (nikDeptEl) nikDeptEl.innerText = `${matchedUser.nik} • ${(matchedUser.dept || 'STAFF').toUpperCase()}`;
   if (typeBadgeEl) {
    typeBadgeEl.innerText = selectedAttendanceType === 'check_in' ? 'ABSEN MASUK' : 'ABSEN PULANG';
    typeBadgeEl.className = selectedAttendanceType === 'check_in' ? 'px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-200 text-emerald-900 uppercase' : 'px-2 py-0.5 rounded text-[10px] font-bold bg-rose-200 text-rose-900 uppercase';
   }
   if (timeEl) timeEl.innerText = nowFormatted;

   if (gunNameEl) gunNameEl.innerText = matchedUser.name;
   if (gunNikDeptEl) gunNikDeptEl.innerText = `${matchedUser.nik} • ${(matchedUser.dept || 'STAFF').toUpperCase()}`;
   if (gunTypeBadgeEl) {
    gunTypeBadgeEl.innerText = selectedAttendanceType === 'check_in' ? 'ABSEN MASUK' : 'ABSEN PULANG';
    gunTypeBadgeEl.className = selectedAttendanceType === 'check_in' ? 'px-2 py-0.5 rounded text-[10px] font-bold bg-sky-200 text-sky-900 uppercase' : 'px-2 py-0.5 rounded text-[10px] font-bold bg-rose-200 text-rose-900 uppercase';
   }
   if (gunTimeEl) gunTimeEl.innerText = nowFormatted;
   if (gunCard) gunCard.classList.remove('hidden');

   // Tampilkan kartu bukti presensi sukses di Standby Wrapper & Gun Wrapper
   if (card) card.classList.remove('hidden');
   if (standbyIcon) standbyIcon.classList.add('hidden');
   if (standbyTitle) standbyTitle.innerText = selectedAttendanceType === 'check_in' ? 'Absen Masuk Berhasil Dicatat!' : 'Absen Pulang Berhasil Dicatat!';
   if (standbySubtitle) standbySubtitle.innerText = `Presensi ${matchedUser.name} (${matchedUser.nik || ''}) sukses tersimpan ke sistem.`;

   // Visual feedback langsung di kamera (Kamera tetap nyala mulus tanpa lag & tanpa layar blank!)
   const boxBorder = document.getElementById('scanner-box-border');
   const boxTag = document.getElementById('scanner-box-tag');
   const camStatus = document.getElementById('cam-status-msg');

   if (camStatus) {
    camStatus.innerHTML = `<span class="text-emerald-700 font-extrabold">Å“â€¦ Presensi ${selectedAttendanceType === 'check_in' ? 'Masuk' : 'Pulang'} Sukses:</span> <span class="text-slate-900 font-bold">${matchedUser.name}</span> (${nowFormatted})`;
   }
   if (boxBorder) {
    boxBorder.className = 'w-[270px] h-48 sm:w-[310px] sm:h-52 border-4 border-emerald-400 bg-emerald-500/20 rounded-3xl flex items-center justify-center transition-all duration-200 shadow-lg shadow-emerald-500/30';
   }
   if (boxTag) {
    boxTag.innerText = 'BERHASIL TERCATAT!';
    boxTag.className = 'text-[11px] text-white bg-emerald-600 px-3 py-1 rounded-lg font-mono font-extrabold tracking-wider shadow-md';
   }

   // Render update data presensi hari ini secara instan (sangat ringan < 1ms)
   renderScannerTodayRecords();

   // Kembalikan tampilan kamera siap untuk scan karyawan berikutnya setelah 1.2 detik
   setTimeout(() => {
    if (boxBorder) {
     boxBorder.className = 'w-[270px] h-48 sm:w-[310px] sm:h-52 border-2 border-emerald-400 border-dashed rounded-3xl animate-pulse flex items-center justify-center';
    }
    if (boxTag) {
     boxTag.innerText = 'SCAN BARCODE / QR';
     boxTag.className = 'text-[10px] text-emerald-200 bg-slate-900/90 px-2.5 py-1 rounded-lg font-mono font-bold tracking-wide';
    }
    if (camStatus) {
     camStatus.innerText = 'Arahkan kamera ke Barcode ID Card Karyawan berikutnya...';
    }
    isScanProcessing = false;
    resetVerificationState();
   }, 1200);
  }

  // =========================================================
  // SWITCHER METODE SCAN (KAMERA HP vs BARCODE GUN EXTERNAL)
  // =========================================================
  let activeScanMethod = 'camera';
  let externalBarcodeKeystrokes = [];

  function switchScanMethod(method) {
   activeScanMethod = method;
   const isCam = method === 'camera';
   
   const tabCam = document.getElementById('tab-scan-camera');
   const tabGun = document.getElementById('tab-scan-gun');
   const modeCam = document.getElementById('mode-camera-container');
   const modeGun = document.getElementById('mode-gun-container');

   if (tabCam) tabCam.className = isCam ? 'px-4 py-2 rounded-lg text-xs font-black bg-white text-slate-900 shadow-xs transition flex items-center gap-1.5' : 'px-4 py-2 rounded-lg text-xs font-bold text-slate-600 hover:text-slate-900 transition flex items-center gap-1.5';
   if (tabGun) tabGun.className = !isCam ? 'px-4 py-2 rounded-lg text-xs font-black bg-white text-slate-900 shadow-xs transition flex items-center gap-1.5' : 'px-4 py-2 rounded-lg text-xs font-bold text-slate-600 hover:text-slate-900 transition flex items-center gap-1.5';

   if (modeCam) modeCam.classList.toggle('hidden', !isCam);
   if (modeGun) modeGun.classList.toggle('hidden', isCam);

   if (!isCam) {
    stopScanner();
    resetExternalBarcodeTracker();
    unlockAudioContextOnGesture();
    preloadGPSLocation();
    setTimeout(() => {
     const inputEl = document.getElementById('external-barcode-input');
     if (inputEl) {
      inputEl.value = '';
      inputEl.focus();
      inputEl.select();
     }
    }, 120);
   }
   lucide.createIcons();
  }

  let externalBarcodeTimer = null;
  let isExternalBarcodeProcessing = false;
  let externalBarcodeEntries = [];
  let isManualPasteAttempted = false;
  let lastProcessedBarcode = '';
  let lastProcessedBarcodeTime = 0;

  function resetExternalBarcodeTracker() {
   externalBarcodeEntries = [];
   isManualPasteAttempted = false;
   if (externalBarcodeTimer) {
    clearTimeout(externalBarcodeTimer);
    externalBarcodeTimer = null;
   }
  }

  function isLikelyBarcodePattern(val) {
   if (!val || val.length < 4) return false;
   const t = val.trim();
   // Format NIK resmi MBI / MAI (misal: MBI26-001, MAI26-023)
   if (/^(MBI|MAI)\d{2}-\d{3,4}$/i.test(t)) return true;
   // Format ber-piping: NIK|Nama
   if (t.includes('|')) return true;
   // Format Admin / Scanner / SPV
   if (/^(ADM|SPV)\d+/i.test(t) || /^ADM-MAI$/i.test(t) || /^ABSEN-/i.test(t)) return true;
   return false;
  }

  function isKnownUserBarcode(val) {
   if (!val || val.length < 3) return false;
   const t = val.trim().toUpperCase();
   if (isLikelyBarcodePattern(t)) return true;
   const mbi = getWhDB('MBI', 'users', SEED_MBI_USERS);
   const mai = getWhDB('MAI', 'users', SEED_MAI_USERS);
   return [...mbi, ...mai].some(u => (u.nik && u.nik.toUpperCase() === t) || (u.barcodeValue && u.barcodeValue.toUpperCase() === t) || (u.id && u.id.toUpperCase() === t));
  }

  function handleExternalBarcodeInput(e) {
   unlockAudioContextOnGesture();
   const val = (e.target.value || '').trim();
   const now = performance.now();

   if (!val) {
    resetExternalBarcodeTracker();
    return;
   }

   // Catat entri waktu dan panjang karakter
   externalBarcodeEntries.push({
    time: now,
    len: val.length
   });

   // Hentikan timer sebelumnya jika karakter masih mengalir
   if (externalBarcodeTimer) {
    clearTimeout(externalBarcodeTimer);
    externalBarcodeTimer = null;
   }

   // AKSELERASI SUPER CEPAT & PRESISI:
   // 1. Jika pola barcode sudah lengkap / cocok NIK karyawan (panjang >= 7): eksekusi sangat cepat (20ms)!
   // 2. Jika batch commit PDA Android (panjang >= 6 dengan <= 2 event): eksekusi dalam 25ms!
   // 3. Jika karakter masih mengalir dari barcode gun (belum lengkap): tunggu 120ms jeda karakter terakhir agar seluruh NIK masuk utuh!
   const isComplete = isLikelyBarcodePattern(val) || isKnownUserBarcode(val);
   const isBatchPDA = externalBarcodeEntries.length <= 2 && val.length >= 6;
   const delayMs = (isComplete && val.length >= 7) ? 20 : (isBatchPDA ? 25 : 120);

   if (val.length >= 4) {
    externalBarcodeTimer = setTimeout(() => {
     processExternalBarcodeSubmit();
    }, delayMs);
   }
  }

  function handleExternalBarcodeKeyDown(e) {
   unlockAudioContextOnGesture();
   // Deteksi jika user mencoba shortcut keyboard Ctrl+V / Cmd+V untuk paste manual
   if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
    isManualPasteAttempted = true;
   }

   // Jika user menekan tombol Backspace atau Delete: indikasi pasti pengetikan manual manusia
   if (e.key === 'Backspace' || e.key === 'Delete') {
    externalBarcodeEntries.push({
     time: performance.now() + 1000,
     len: 0
    });
   }

   // Jika user / alat scanner mengirimkan tombol Enter (key 'Enter' atau keyCode 13)
   if (e.key === 'Enter' || e.keyCode === 13) {
    e.preventDefault();
    if (externalBarcodeTimer) {
     clearTimeout(externalBarcodeTimer);
     externalBarcodeTimer = null;
    }
    processExternalBarcodeSubmit();
   }
  }

  function handleExternalBarcodeFormSubmit(e) {
   if (e) e.preventDefault();
   if (externalBarcodeTimer) {
    clearTimeout(externalBarcodeTimer);
    externalBarcodeTimer = null;
   }
   processExternalBarcodeSubmit();
  }

  function checkIsHardwareScanner(rawText) {
   if (!rawText || rawText.length < 3) return false;
   if (isManualPasteAttempted) return false;

   const entries = externalBarcodeEntries;
   const count = entries.length;
   if (count === 0) return false;

   // Skenario 1: Teks masuk instan dalam 1 atau beberapa batch event (Android PDA commitText / KeyboardEmulator batch)
   // Pada perangkat Android PDA, seluruh string barcode (misal 9-10 karakter) langsung diinjeksikan dalam 1-3 event
   if (count <= 3 && rawText.length >= 4) {
    const totalDuration = count > 1 ? (entries[count - 1].time - entries[0].time) : 0;
    if (totalDuration < 300) {
     return true; // 100% Alat Scanner Hardware PDA Android
    }
   }

   // Skenario 2: Alat Scanner Barcode Gun USB / Bluetooth / Wireless 2.4G (keystroke burst)
   // Karakter dikirim berurutan dengan burst cepat. Berikan toleransi hardware hingga 90ms per char
   const firstTime = entries[0].time;
   const lastTime = entries[count - 1].time;
   const totalDuration = lastTime - firstTime;
   const avgGap = count > 1 ? (totalDuration / (count - 1)) : 0;

   if (rawText.length >= 4 && avgGap <= 90 && totalDuration <= (count * 95 + 200)) {
    return true; // 100% Alat Scanner Barcode Gun
   }

   // Skenario 3: Alat Scanner Bluetooth / Wireless PDA pada HP Android & iPhone
   if (isKnownUserBarcode(rawText) && (count <= 4 || avgGap <= 180 || totalDuration < 800)) {
    return true;
   }

   // Selain itu: Terdeteksi pengetikan manual oleh jari manusia
   return false;
  }

  async function processExternalBarcodeSubmit() {
   if (isExternalBarcodeProcessing) return;

   const inputEl = document.getElementById('external-barcode-input');
   if (!inputEl) return;
   const inputVal = (inputEl.value || '').trim();
   if (!inputVal) return;

   const now = performance.now();

   // Proteksi Anti Double-Tap untuk Kartu Sama (1.5 Detik Cooldown untuk NIK yang persis sama)
   if (inputVal === lastProcessedBarcode && (now - lastProcessedBarcodeTime < 1500)) {
    inputEl.value = '';
    resetExternalBarcodeTracker();
    return;
   }

   isExternalBarcodeProcessing = true;
   if (externalBarcodeTimer) {
    clearTimeout(externalBarcodeTimer);
    externalBarcodeTimer = null;
   }

   unlockAudioContextOnGesture();

   // Evaluasi apakah input berasal dari Alat Scanner Fisik Asli (PDA / Barcode Gun)
   const isHardware = checkIsHardwareScanner(inputVal);

   // Cek apakah akun aktif adalah Administrator atau Akun Scanner Terminal Pos Gudang
   const isUserAdminCurrent = isUserAdmin(currentUser) || (currentUser && (currentUser.role === 'admin' || currentUser.role === 'superadmin' || (currentUser.nik && currentUser.nik.startsWith('ADM'))));
   const isScannedAdmin = inputVal.toUpperCase().startsWith('ADM') || inputVal.toUpperCase().includes('ADMIN');
   const isScannerTerminal = isUserScanner(currentUser) || (currentUser && (currentUser.role === 'scanner' || (currentUser.nik && currentUser.nik.startsWith('ABSEN'))));
   const isInstantScanMode = isUserAdminCurrent || isScannedAdmin || isScannerTerminal || isHardware;
   const isAdminTestMode = isUserAdminCurrent || isScannedAdmin;

   // KOSONGKAN INPUT & RESET TRACKER SEKETIKA
   inputEl.value = '';
   resetExternalBarcodeTracker();

   if (!isHardware && !isAdminTestMode) {
    // â€ºâ€ PENGETIKAN MANUAL DITOLAK TEGAS UNTUK STAF & AKUN SCANNER PRESENSI
    showProfessionalAttendanceToast({
     isError: true,
     title: 'Pengetikan Manual Ditolak!',
     subtitle: 'Sistem mendeteksi pengetikan manual. Dilarang mengetik NIK! Wajib memindai fisik kartu ID Card menggunakan alat scanner PDA / Barcode Gun.',
     name: 'Akses Ditolak',
     nik: inputVal,
     dept: 'Pos Scanner',
     statusText: 'Anti-Ketik Manual'
    });
    playAttendanceErrorSound('Pengetikan manual ditolak');

    setTimeout(() => {
     isExternalBarcodeProcessing = false;
     const el = document.getElementById('external-barcode-input');
     if (el && activeScanMethod === 'gun') {
      el.focus();
     }
    }, 600);
    return;
   }

   // MODE CEPAT SEKETIKA & POS SCANNER RESMI:
   // Untuk Akun Pos Scanner, Admin, atau Alat Scanner Barcode Wireless Hardware Fisik Resmi:
   // Menghilangkan false-positive "Di Luar Radius" akibat PC/Laptop tanpa GPS atau atap seng gudang yang menghalangi satelit
   if (!isInstantScanMode) {
    const isDesktop = !/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
    if (!isDesktop) {
     const targetWhCoords = getWarehouseCoords(activeWarehouse);
     const curRad = Number(targetWhCoords.radius) > 0 ? Number(targetWhCoords.radius) : (Number(localStorage.getItem('wfm_gps_radius')) || 100);

     const gpsCheck = await verifyGPSLocation(activeWarehouse);
     if (!gpsCheck.valid) {
      showProfessionalAttendanceToast({
       isError: true,
       title: 'Di Luar Radius Gudang',
       subtitle: gpsCheck.error || `Anda berada di luar batas ${curRad} meter dari titik lokasi gudang.`,
       statusText: 'GPS Tidak Valid'
      });
      playAttendanceErrorSound('Di luar lokasi');

      setTimeout(() => {
       isExternalBarcodeProcessing = false;
       const el = document.getElementById('external-barcode-input');
       if (el && activeScanMethod === 'gun') {
        el.focus();
       }
      }, 800);
      return;
     }
    }
   }

   // Catat barcode terakhir yang sukses diproses
   lastProcessedBarcode = inputVal;
   lastProcessedBarcodeTime = now;

   // Eksekusi pemrosesan absensi secepat kilat (Menampilkan Toast Pop-Up dan Memutar Suara Sesuai Setting Admin)
   processAttendanceScan(inputVal);

   // Buka kunci input seketika (hanya jeda 40ms) dan pastikan kursor selalu fokus untuk karyawan berikutnya
   setTimeout(() => {
    isExternalBarcodeProcessing = false;
    const el = document.getElementById('external-barcode-input');
    if (el && activeScanMethod === 'gun') {
     el.focus();
    }
   }, 40);
  }

  let scannerTodayLimit = 30;

  function toggleTodayScanHistory() {
   const panel = document.getElementById('today-scan-history-panel');
   const icon = document.getElementById('history-chevron-icon');
   const label = document.getElementById('history-toggle-label');
   if (!panel) return;

   const isHidden = panel.classList.contains('hidden');
   if (isHidden) {
    panel.classList.remove('hidden');
    if (icon) icon.classList.add('rotate-180');
    if (label) label.innerText = 'Tutup Daftar';
    scannerTodayLimit = 30;
    renderScannerTodayRecords();
   } else {
    panel.classList.add('hidden');
    if (icon) icon.classList.remove('rotate-180');
    if (label) label.innerText = 'Lihat Daftar Absen';
   }
   lucide.createIcons();
  }

  function showAllScannerTodayRecords() {
   scannerTodayLimit = 99999;
   renderScannerTodayRecords();
  }

  function renderScannerTodayRecords() {
   const container = document.getElementById('scanner-today-records-list');
   if (!container) return;

   const realTodayStr = getLocalDateString(new Date());
   const nowMs = Date.now();

   const targetWh = activeWarehouse || 'MBI';
   const attendances = getWhDB(targetWh, 'attendance', []);
   const recentAtt = attendances.filter(a => {
    if (!a || isAttendanceMarkedDeleted(a)) return false;
    const checkInLocal = a.checkInTime ? getLocalDateString(new Date(a.checkInTime)) : '';
    const checkOutLocal = a.checkOutTime ? getLocalDateString(new Date(a.checkOutTime)) : '';

    // 1. Masuk atau Pulang hari ini
    if (a.date === realTodayStr || checkInLocal === realTodayStr || checkOutLocal === realTodayStr) return true;

    // 2. Sedang dalam sesi shift aktif berjalan (masuk shift lintas hari tapi belum tap pulang)
    if (!a.checkOutTime && a.checkInTime && (nowMs - new Date(a.checkInTime).getTime() <= 18 * 60 * 60 * 1000)) return true;

    return false;
   });

   // Helper parsing timestamp presisi untuk semua format waktu (ISO string, unix ms, HH:mm:ss, HH.mm.ss WIB)
   const parseScanTimestamp = (timeVal, dateVal) => {
    if (!timeVal) return 0;
    if (typeof timeVal === 'number') return timeVal;
    const d = new Date(timeVal);
    if (!isNaN(d.getTime())) return d.getTime();
    if (typeof timeVal === 'string') {
     const clean = timeVal.replace(/\s*WIB/i, '').trim().replace(/\./g, ':');
     const parts = clean.split(':');
     if (parts.length >= 2) {
      const hh = parseInt(parts[0], 10) || 0;
      const mm = parseInt(parts[1], 10) || 0;
      const ss = parseInt(parts[2], 10) || 0;
      const baseDate = dateVal ? parseYMD(dateVal) : new Date();
      baseDate.setHours(hh, mm, ss, 0);
      return baseDate.getTime();
     }
    }
    return 0;
   };

   // URUTKAN ABSEN MASUK TERBARU DI PALING ATAS
   // Urutan baris murni berdasarkan tanggal & jam masuk (tidak terpengaruh saat karyawan tap pulang)
   recentAtt.sort((a, b) => {
    const inA = parseScanTimestamp(a.checkInTime, a.date);
    const inB = parseScanTimestamp(b.checkInTime, b.date);
    return inB - inA;
   });

   const countBadge = document.getElementById('scanner-today-count-badge');
   if (countBadge) {
    countBadge.innerText = `${recentAtt.length} Data`;
   }
   const whLabel = document.getElementById('history-wh-name');
   if (whLabel) {
    whLabel.innerText = `Gudang ${targetWh}`;
   }

   // Jika panel sedang tertutup, hentikan di sini agar tidak membebani CPU & DOM!
   const panel = document.getElementById('today-scan-history-panel');
   if (panel && panel.classList.contains('hidden')) {
    return;
   }

   // 1. Dirty check data presensi agar tidak me-rebuild DOM jika data tidak berubah sama sekali
   const attHash = `${targetWh}_today_${recentAtt.length}_${scannerTodayLimit}_` + recentAtt.slice(0, scannerTodayLimit).map(a => `${a.id || a.userNik}_${a.checkInTime || ''}_${a.checkOutTime || ''}_${a.checkInStatus || ''}`).join('|');
   if (container.dataset.lastAttHash === attHash && container.children.length > 0) {
    return; // Data sama persis, pertahankan elemen DOM dan posisi scroll pengguna 100%!
   }
   container.dataset.lastAttHash = attHash;

   // 2. Rekam posisi scroll horizontal & vertikal sebelum re-render
   const scrollEl = container.querySelector('.overflow-x-auto');
   const prevScrollLeft = scrollEl ? scrollEl.scrollLeft : 0;
   const prevScrollTop = scrollEl ? scrollEl.scrollTop : 0;

   if (recentAtt.length === 0) {
    container.innerHTML = `<div class="p-8 text-center text-xs text-slate-400 font-medium bg-white rounded-2xl border border-dashed border-slate-200">Belum ada riwayat scan absensi hari ini di Gudang ${targetWh}.</div>`;
    return;
   }

   const displayedAtt = recentAtt.slice(0, scannerTodayLimit);

   let html = `
    <div class="overflow-x-auto custom-scroll bg-white rounded-2xl border border-slate-200 shadow-2xs">
     <table class="w-full min-w-[860px] text-left text-xs border-collapse">
      <thead class="bg-slate-100/90 text-slate-700 font-black uppercase text-[11px] border-b border-slate-200">
       <tr>
        <th class="p-3.5 w-12 text-center whitespace-nowrap">No</th>
        <th class="p-3.5 min-w-[105px] whitespace-nowrap">Tanggal</th>
        <th class="p-3.5 min-w-[190px] whitespace-nowrap">Nama Karyawan</th>
        <th class="p-3.5 min-w-[110px] whitespace-nowrap">NIK</th>
        <th class="p-3.5 min-w-[110px] whitespace-nowrap">Outsourcing</th>
        <th class="p-3.5 min-w-[125px] whitespace-nowrap">Departemen</th>
        <th class="p-3.5 min-w-[125px] whitespace-nowrap">Jam Masuk</th>
        <th class="p-3.5 min-w-[125px] text-center whitespace-nowrap">Status Masuk</th>
        <th class="p-3.5 min-w-[135px] whitespace-nowrap">Jam Pulang</th>
       </tr>
      </thead>
      <tbody class="divide-y divide-slate-100">
   `;

   const users = getWhDB(targetWh, 'users', targetWh === 'MBI' ? SEED_MBI_USERS : SEED_MAI_USERS);
   const userMap = new Map();
   users.forEach(u => {
    if (u.nik) userMap.set(u.nik.toUpperCase(), u);
    if (u.name) userMap.set(cleanStr(u.name), u);
    if (u.id) userMap.set(u.id, u);
   });

   displayedAtt.forEach((a, idx) => {
    let dateFormatted = a.date || '-';
    if (a.date && a.date.includes('-')) {
     const parts = a.date.split('-');
     if (parts.length === 3) {
      dateFormatted = `${parts[2]}/${parts[1]}/${parts[0]}`;
     }
    }

    const inTime = a.checkInTime ? (formatDisplayTimeWIB(a.checkInTime).replace(/\./g, ':') + ' WIB') : '-';
    const outTime = a.checkOutTime ? (formatDisplayTimeWIB(a.checkOutTime).replace(/\./g, ':') + ' WIB') : '-';
    const isLate = a.checkInStatus === 'late';
    const matchedU = (a.userNik && userMap.get(a.userNik.toUpperCase())) || (a.userName && userMap.get(cleanStr(a.userName))) || (a.userId && userMap.get(a.userId));
    const outsourceName = a.outsource || (matchedU ? matchedU.outsource : 'Internal') || 'Internal';

    html += `
     <tr class="hover:bg-slate-50 transition">
      <td class="p-3.5 text-center font-bold text-slate-400 font-mono whitespace-nowrap">${idx + 1}</td>
      <td class="p-3.5 font-mono font-bold text-slate-700 whitespace-nowrap">${dateFormatted}</td>
      <td class="p-3.5 font-extrabold text-slate-900 text-sm whitespace-nowrap">
       <div class="flex items-center gap-2.5">
        <div class="w-7 h-7 rounded-lg bg-slate-900 text-white font-black text-xs flex items-center justify-center shrink-0">
         ${(a.userName || 'K').charAt(0).toUpperCase()}
        </div>
        <span class="whitespace-nowrap">${a.userName}</span>
       </div>
      </td>
      <td class="p-3.5 font-mono font-bold text-slate-700 whitespace-nowrap">${a.userNik}</td>
      <td class="p-3.5 font-bold text-slate-800 whitespace-nowrap">${outsourceName}</td>
      <td class="p-3.5 font-semibold text-slate-600 uppercase text-[11px] whitespace-nowrap">${a.dept || 'STAFF'}</td>
      <td class="p-3.5 font-mono font-bold text-slate-900 whitespace-nowrap">${inTime}</td>
      <td class="p-3.5 text-center whitespace-nowrap">
       <span class="inline-flex items-center justify-center px-3 py-1 rounded-xl text-xs font-black whitespace-nowrap shadow-2xs ${isLate ? 'bg-amber-50 text-amber-900 border border-amber-300' : 'bg-emerald-50 text-emerald-900 border border-emerald-300'}">
        ${isLate ? 'Terlambat' : 'Tepat Waktu'}
       </span>
       ${(a.notes && a.notes !== 'Tepat Waktu' && a.notes !== 'Terlambat' && a.notes !== '-') ? `<div class="text-[10px] text-slate-500 font-medium mt-0.5 italic whitespace-nowrap">${a.notes}</div>` : ''}
      </td>
      <td class="p-3.5 font-mono font-bold whitespace-nowrap">
       ${a.checkOutTime ? `<span class="text-slate-900">${outTime}</span>` : (getAttendanceDurationInfo(a).isMissScan ? '<span class="text-rose-600 font-bold not-italic">Miss Scan (-)</span>' : '<span class="text-amber-600 font-bold not-italic">Sedang Shift</span>')}
      </td>
     </tr>
    `;
   });

   html += `
      </tbody>
     </table>
    </div>
   `;

   if (recentAtt.length > displayedAtt.length) {
    html += `
     <div class="p-3 text-center bg-slate-100/70 rounded-xl border border-slate-200 mt-2.5 flex items-center justify-between flex-wrap gap-2">
      <span class="text-xs text-slate-600 font-medium">Menampilkan ${displayedAtt.length} dari ${recentAtt.length} data scan absensi hari ini.</span>
      <button type="button" onclick="showAllScannerTodayRecords()" class="text-xs font-bold text-blue-700 hover:text-blue-900 bg-white hover:bg-blue-50 border border-blue-200 px-3.5 py-1.5 rounded-xl transition shadow-2xs">
       Tampilkan Semua (${recentAtt.length} Data)
      </button>
     </div>
    `;
   }

   container.innerHTML = html;
   lucide.createIcons();

   // 3. Kembalikan posisi scroll horizontal & vertikal agar saat digeser di HP tidak meloncat kembali ke awal
   const newScrollEl = container.querySelector('.overflow-x-auto');
   if (newScrollEl) {
    newScrollEl.scrollLeft = prevScrollLeft;
    newScrollEl.scrollTop = prevScrollTop;
   }
  }

  // =========================================================
  // KAMERA SCANNER - ULTRA FAST MULTI-DEVICE (IPHONE, ANDROID & LAPTOP)
  // =========================================================

  // Deteksi apakah perangkat adalah HP / Tablet (Mobile)
  function isMobilePhoneOrTablet() {
   const ua = (navigator.userAgent || '').toLowerCase();
   // 1. Cek string user agent
   if (/android|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile/i.test(ua)) return true;
   // 2. Cek navigator.userAgentData (Chrome / Edge mobile)
   if (navigator.userAgentData && navigator.userAgentData.mobile) return true;
   // 3. Cek iPad / iPhone mode desktop (MacIntel dengan touch points > 1)
   if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return true;
   // 4. Cek fitur touch dan ukuran layar (HP biasanya memiliki touch dan lebar layar <= 850px)
   const hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
   const isMobileScreen = Math.min(window.screen.width, window.screen.height) <= 850;
   if (hasTouch && isMobileScreen) return true;
   return false;
  }

  let isScannerStarting = false;
  async function startScanner() {
   if (isScannerStarting) return;
   isScannerStarting = true;

   const statusMsg = document.getElementById('cam-status-msg');
   if (statusMsg) statusMsg.innerText = 'Menghubungkan ke kamera...';

   // 1. Periksa Secure Context (Kamera browser mobile mewajibkan HTTPS)
   if (typeof window !== 'undefined' && window.isSecureContext === false && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    if (statusMsg) statusMsg.innerHTML = '<span class="text-rose-600 font-bold">Akses Kamera Diblokir Browser:</span> Website harus dibuka via <b>HTTPS</b> (https://...) agar kamera HP dapat aktif.';
    alert('Akses Kamera Diblokir Browser:\n\nBrowser HP memblokir akses kamera jika website tidak dibuka dengan HTTPS.\nPastikan Anda membuka website dengan alamat berawalan https://');
    isScannerStarting = false;
    return;
   }

   // 2. Periksa ketersediaan library Html5Qrcode
   if (typeof Html5Qrcode === 'undefined') {
    if (statusMsg) statusMsg.innerText = '⚠️ Library kamera sedang dimuat... Coba 3 detik lagi.';
    isScannerStarting = false;
    return;
   }

   // 3. Tampilkan container video, sembunyikan standby
   const videoWrapper = document.getElementById('camera-video-wrapper');
   const standbyWrapper = document.getElementById('camera-standby-wrapper');
   if (videoWrapper) videoWrapper.classList.remove('hidden');
   if (standbyWrapper) standbyWrapper.classList.add('hidden');

   const qrReaderContainer = document.getElementById('qr-reader');
   if (qrReaderContainer) {
    qrReaderContainer.style.minHeight = '280px';
    qrReaderContainer.innerHTML = '';
   }

   if (html5QrScanner) {
    try { await html5QrScanner.stop(); } catch (e) {}
    try { html5QrScanner.clear(); } catch (e) {}
    html5QrScanner = null;
   }

   try {
    const oldVideos = document.querySelectorAll('#qr-reader video, video');
    oldVideos.forEach(v => {
     if (v.srcObject && typeof v.srcObject.getTracks === 'function') {
      v.srcObject.getTracks().forEach(t => t.stop());
      v.srcObject = null;
     }
    });
   } catch (e) {}

   lastScannedCode = '';
   isScanProcessing = false;

   try {
    const isMobile = isMobilePhoneOrTablet();

    // Gunakan ZXing WebAssembly stabil (nonaktifkan useBarCodeDetector yang sering hang di Chrome Android)
    const scannerInitOptions = {
     verbose: false,
     experimentalFeatures: {
      useBarCodeDetectorIfSupported: false
     }
    };
    if (typeof Html5QrcodeSupportedFormats !== 'undefined') {
     scannerInitOptions.formatsToSupport = [Html5QrcodeSupportedFormats.QR_CODE];
    }

    html5QrScanner = new Html5Qrcode("qr-reader", scannerInitOptions);

    const scanConfig = {
     fps: 15,
     qrbox: (viewfinderWidth, viewfinderHeight) => {
      const minDim = Math.min(viewfinderWidth, viewfinderHeight);
      if (minDim <= 0) return { width: 250, height: 250 };
      const edge = Math.floor(minDim * 0.78);
      const boxDim = Math.max(180, Math.min(edge, minDim - 10));
      return { width: boxDim, height: boxDim };
     },
     disableFlip: !isMobile
    };

    let started = false;

    // Prioritas 1: facingMode murni ("environment" di HP / "user" di laptop)
    // Tanpa constraint resolusi ekstrem agar kamera langsung terbuka instan (<200ms) di semua tipe HP
    const primaryConstraint = isMobile ? { facingMode: "environment" } : { facingMode: "user" };
    try {
     await html5QrScanner.start(
      primaryConstraint,
      scanConfig,
      (decodedText) => { processScannedText(decodedText); },
      () => {}
     );
     started = true;
    } catch (errPrimary) {
     console.warn('Percobaan 1 facingMode gagal, mencoba fallback deviceId:', errPrimary);
    }

    // Prioritas 2: Fallback deviceId dari Html5Qrcode.getCameras()
    if (!started) {
     try {
      const devs = await Html5Qrcode.getCameras();
      if (devs && Array.isArray(devs) && devs.length > 0) {
       let selectedId = devs[0].id;
       if (isMobile) {
        const backCam = devs.find(d => !/front|depan|selfie|face|user/i.test((d.label || '').toLowerCase())) || devs[devs.length - 1];
        if (backCam) selectedId = backCam.id;
       }
       await html5QrScanner.start(
        selectedId,
        scanConfig,
        (decodedText) => { processScannedText(decodedText); },
        () => {}
       );
       started = true;
      }
     } catch (errRetry) {
      console.warn('Percobaan 2 deviceId gagal:', errRetry);
     }
    }

    // Prioritas 3: Fallback universal default
    if (!started) {
     try {
      await html5QrScanner.start(
       {},
       scanConfig,
       (decodedText) => { processScannedText(decodedText); },
       () => {}
      );
      started = true;
     } catch (errAny) {
      console.warn('Percobaan 3 universal camera gagal:', errAny);
     }
    }

    if (!started) {
     throw new Error('Akses kamera tidak dapat diaktifkan. Pastikan izin kamera sudah diaktifkan di setelan browser.');
    }

    // Pasang atribut playsinline & muted wajib untuk browser mobile agar video tidak terhenti
    const applyVideoAttributes = () => {
     const vidEl = document.querySelector('#qr-reader video');
     if (vidEl) {
      vidEl.setAttribute('playsinline', 'true');
      vidEl.setAttribute('webkit-playsinline', 'true');
      vidEl.muted = true;
      vidEl.playsInline = true;
      vidEl.style.width = '100%';
      vidEl.style.height = '100%';
      vidEl.style.objectFit = 'cover';

      try {
       if (vidEl.srcObject && typeof vidEl.srcObject.getVideoTracks === 'function') {
        const track = vidEl.srcObject.getVideoTracks()[0];
        if (track && typeof track.getCapabilities === 'function') {
         const caps = track.getCapabilities();
         const adv = {};
         if (caps.focusMode && Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) {
          adv.focusMode = 'continuous';
         }
         if (Object.keys(adv).length > 0 && typeof track.applyConstraints === 'function') {
          track.applyConstraints({ advanced: [adv] }).catch(() => {});
         }
        }
       }
      } catch(eTrack) {}
     }
    };

    applyVideoAttributes();
    setTimeout(applyVideoAttributes, 200);

    if (statusMsg) statusMsg.innerText = `Kamera Aktif • Arahkan ke Barcode / QR ID Card Karyawan`;
    if (window.lucide) lucide.createIcons();

    // Ambil GPS di latar belakang setelah kamera berhasil tampil
    setTimeout(() => {
     try { preloadGPSLocation(); } catch(e) {}
    }, 1200);

   } catch (err) {
    console.error('Html5Qrcode error:', err);
    if (statusMsg) {
     statusMsg.innerHTML = `<span class="text-rose-600 font-bold">Kamera belum dapat diakses:</span> ${err.message || 'Izin kamera belum aktif'}.<br><span class="text-[11px] text-slate-600">Klik ikon Gembok di bar alamat web browser Anda, lalu pastikan Kamera di-set "Izinkan" (Allow).</span>`;
    }
    alert('Kamera belum dapat dibuka:\n' + (err.message || err) + '\n\nLangkah mudah:\n1. Pastikan izin kamera sudah di-Izinkan (Allow) di browser Anda.\n2. Pastikan kamera tidak sedang dipakai aplikasi lain (Zoom, Google Meet, atau Kamera bawaan).\n3. Buka halaman ini menggunakan protokol HTTPS (https://...).');
   } finally {
    isScannerStarting = false;
   }
  }

  async function stopScanner() {
   if (html5QrScanner) {
    try {
     await html5QrScanner.stop();
    } catch (e) {}
    try {
     html5QrScanner.clear();
    } catch (e) {}
    html5QrScanner = null;
   }

   // Pastikan seluruh track kamera fisik dihentikan seketika di hardware HP/Laptop
   try {
    const oldVideos = document.querySelectorAll('#qr-reader video, video');
    oldVideos.forEach(vidEl => {
     if (vidEl && vidEl.srcObject && typeof vidEl.srcObject.getTracks === 'function') {
      vidEl.srcObject.getTracks().forEach(t => t.stop());
      vidEl.srcObject = null;
     }
    });
    const qrCont = document.getElementById('qr-reader');
    if (qrCont) qrCont.innerHTML = '';
   } catch (e) {}

   // Sembunyikan video container dan tampilkan standby wrapper
   const videoWrapper = document.getElementById('camera-video-wrapper');
   const standbyWrapper = document.getElementById('camera-standby-wrapper');
   if (videoWrapper) videoWrapper.classList.add('hidden');
   if (standbyWrapper) standbyWrapper.classList.remove('hidden');

   if (window.lucide) lucide.createIcons();
  }

  function setAttendanceType(type) {
   selectedAttendanceType = type;
   unlockAudioContextOnGesture();
   if (type === 'check_out') {
    try { syncAttendanceLiveDelta(activeWarehouse); } catch (eDelta) {}
   }
   const isIn = type === 'check_in';
   const btnIn = document.getElementById('btn-type-in');
   const btnOut = document.getElementById('btn-type-out');
   if (btnIn) {
    btnIn.className = isIn 
     ? 'py-3 sm:py-2.5 rounded-2xl font-black text-xs sm:text-xs bg-emerald-600 text-white shadow-md shadow-emerald-600/30 transition flex items-center justify-center gap-1.5 ring-2 ring-emerald-500/50' 
     : 'py-3 sm:py-2.5 rounded-2xl font-bold text-xs sm:text-xs bg-slate-100 text-slate-600 hover:bg-slate-200 transition flex items-center justify-center gap-1.5';
   }
   if (btnOut) {
    btnOut.className = !isIn 
     ? 'py-3 sm:py-2.5 rounded-2xl font-black text-xs sm:text-xs bg-rose-600 text-white shadow-md shadow-rose-600/30 transition flex items-center justify-center gap-1.5 ring-2 ring-rose-500/50' 
     : 'py-3 sm:py-2.5 rounded-2xl font-bold text-xs sm:text-xs bg-slate-100 text-slate-600 hover:bg-slate-200 transition flex items-center justify-center gap-1.5';
   }
   if (activeScanMethod === 'gun') {
    const inputEl = document.getElementById('external-barcode-input');
    if (inputEl) inputEl.focus();
   }
   if (window.lucide) lucide.createIcons();
  }

  // =========================================================