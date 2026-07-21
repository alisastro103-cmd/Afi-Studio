/**
 * Afi Studio — Smart PWA Install Prompt
 * Menampilkan tombol "Install App" mengambang kalau situs belum
 * di-install sebagai PWA. Tidak butuh backend/database.
 *
 * Cukup tambahkan <script src="/pwa-install.js" defer></script>
 * di setiap halaman.
 */
(function () {
  var DISMISS_KEY = 'afi-install-dismissed-at';
  var DISMISS_DAYS = 3; // muncul lagi setelah 3 hari kalau di-dismiss

  function isStandalone() {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true // iOS Safari
    );
  }

  function isIOS() {
    return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
  }

  function wasRecentlyDismissed() {
    var ts = localStorage.getItem(DISMISS_KEY);
    if (!ts) return false;
    var days = (Date.now() - Number(ts)) / (1000 * 60 * 60 * 24);
    return days < DISMISS_DAYS;
  }

  if (isStandalone() || wasRecentlyDismissed()) return;

  var deferredPrompt = null;
  var btn = null;
  var sheet = null;

  function injectStyles() {
    var style = document.createElement('style');
    style.textContent = [
      '#afi-install-btn{position:fixed;right:16px;bottom:16px;z-index:2500;',
      'display:flex;align-items:center;gap:8px;padding:12px 16px;border-radius:999px;',
      'background:var(--accent,#6c5ce7);color:#fff;font-family:\'Outfit\',sans-serif;',
      'font-weight:700;font-size:13px;box-shadow:0 8px 24px rgba(0,0,0,.25);',
      'border:none;cursor:pointer;transform:translateY(80px);opacity:0;',
      'transition:transform .3s ease,opacity .3s ease;}',
      '#afi-install-btn.show{transform:translateY(0);opacity:1;}',
      '#afi-install-btn svg{width:16px;height:16px;flex-shrink:0;}',
      '#afi-install-close{background:rgba(255,255,255,.2);border:none;color:#fff;',
      'width:18px;height:18px;border-radius:50%;font-size:11px;line-height:1;',
      'display:flex;align-items:center;justify-content:center;cursor:pointer;margin-left:2px;}',
      '#afi-install-sheet{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:3000;',
      'display:flex;align-items:flex-end;justify-content:center;opacity:0;pointer-events:none;',
      'transition:opacity .25s ease;}',
      '#afi-install-sheet.open{opacity:1;pointer-events:all;}',
      '#afi-install-sheet .box{background:var(--surface,#fff);color:var(--text,#0f172a);',
      'width:100%;max-width:480px;border-radius:20px 20px 0 0;padding:24px 20px 28px;',
      'transform:translateY(30px);transition:transform .25s ease;font-family:\'Outfit\',sans-serif;}',
      '#afi-install-sheet.open .box{transform:translateY(0);}',
      '#afi-install-sheet h3{margin:0 0 8px;font-size:17px;font-weight:800;}',
      '#afi-install-sheet p{margin:0 0 4px;font-size:13.5px;line-height:1.6;opacity:.85;}',
      '#afi-install-sheet .step{display:flex;align-items:center;gap:10px;margin-top:12px;',
      'font-size:13.5px;font-weight:600;}',
      '#afi-install-sheet .step span.n{width:22px;height:22px;border-radius:50%;',
      'background:var(--accent,#6c5ce7);color:#fff;display:flex;align-items:center;',
      'justify-content:center;font-size:12px;flex-shrink:0;}',
      '#afi-install-sheet .close-sheet{margin-top:20px;width:100%;padding:12px;',
      'border-radius:999px;border:1px solid var(--border,#e5e7eb);background:transparent;',
      'color:var(--text,#0f172a);font-weight:700;font-size:14px;cursor:pointer;}',
    ].join('');
    document.head.appendChild(style);
  }

  function createButton() {
    btn = document.createElement('button');
    btn.id = 'afi-install-btn';
    btn.setAttribute('aria-label', 'Install Afi Studio');
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' +
      '<span>Install App</span>' +
      '<button id="afi-install-close" aria-label="Tutup">✕</button>';
    document.body.appendChild(btn);

    btn.addEventListener('click', function (e) {
      if (e.target.id === 'afi-install-close') {
        e.stopPropagation();
        dismiss();
        return;
      }
      handleInstallClick();
    });

    requestAnimationFrame(function () {
      btn.classList.add('show');
    });
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    if (btn) btn.classList.remove('show');
    setTimeout(function () {
      if (btn && btn.parentNode) btn.parentNode.removeChild(btn);
    }, 300);
  }

  function createSheet(bodyHtml) {
    sheet = document.createElement('div');
    sheet.id = 'afi-install-sheet';
    sheet.innerHTML =
      '<div class="box">' +
      bodyHtml +
      '<button class="close-sheet">Mengerti</button>' +
      '</div>';
    document.body.appendChild(sheet);
    sheet.addEventListener('click', function (e) {
      if (e.target === sheet || e.target.classList.contains('close-sheet')) {
        sheet.classList.remove('open');
      }
    });
    requestAnimationFrame(function () {
      sheet.classList.add('open');
    });
  }

  function handleInstallClick() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.finally(function () {
        deferredPrompt = null;
        dismiss();
      });
      return;
    }

    if (isIOS()) {
      createSheet(
        '<h3>Install Afi Studio</h3>' +
          '<p>Tambahkan Afi Studio ke Home Screen supaya bisa dibuka seperti aplikasi biasa.</p>' +
          '<div class="step"><span class="n">1</span> Tap ikon Share (kotak dengan panah ke atas) di Safari</div>' +
          '<div class="step"><span class="n">2</span> Pilih "Add to Home Screen"</div>' +
          '<div class="step"><span class="n">3</span> Tap "Add" di pojok kanan atas</div>'
      );
      return;
    }

    createSheet(
      '<h3>Install Afi Studio</h3>' +
        '<p>Buka menu browser (⋮) lalu pilih "Install app" atau "Add to Home screen" untuk memasang Afi Studio di perangkatmu.</p>'
    );
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    if (!btn) {
      injectStyles();
      createButton();
    }
  });

  window.addEventListener('appinstalled', function () {
    dismiss();
  });

  // Fallback: kalau beforeinstallprompt tidak fire dalam 2.5 detik
  // (misal iOS Safari, atau browser yang tidak support event ini
  // tapi bukan berarti PWA tidak bisa di-install), tetap tampilkan
  // tombol dengan instruksi manual.
  setTimeout(function () {
    if (!btn && !isStandalone()) {
      injectStyles();
      createButton();
    }
  }, 2500);
})();
