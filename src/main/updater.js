'use strict';

/**
 * AetherWall — Auto Updater
 *
 * Nasıl çalışır:
 *   1. Uygulama açılınca UPDATE_CHECK_URL'den version.json indirir
 *   2. Mevcut versiyondan yeni varsa kullanıcıya sorar
 *   3. Onaylarsa setup.exe indirir ve /S (sessiz) flag ile çalıştırır
 *
 * version.json formatı:
 * {
 *   "version": "1.1.0",
 *   "url": "https://example.com/AetherWall-Setup-1.1.0.exe",
 *   "notes": "Yenilikler: ..."
 * }
 */

const https  = require('https');
const http   = require('http');
const fs     = require('fs');
const path   = require('path');
const os     = require('os');
const { app, dialog, ipcMain } = require('electron');

// ── Güncelleme sunucusu ───────────────────────────────────────────────────────
// Örnek: 'https://raw.githubusercontent.com/KULLANICI/aetherwall-releases/main/version.json'
const UPDATE_CHECK_URL = 'https://raw.githubusercontent.com/ryodan2025-sys/aetherwall/main/version.json';
// ─────────────────────────────────────────────────────────────────────────────

const DOWNLOAD_DIR = path.join(os.tmpdir(), 'aetherwall-update');
let uiWin      = null;
let downloading = false;

// ── HTTP GET yardımcı ────────────────────────────────────────────────────────
function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { headers: { 'User-Agent': 'AetherWall-Updater' } }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchJSON(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('JSON parse hatası: ' + data.slice(0, 100))); }
      });
    }).on('error', reject);
  });
}

// ── Versiyon karşılaştır ─────────────────────────────────────────────────────
function isNewer(remote, local) {
  const r = remote.split('.').map(Number);
  const l = local.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((r[i]||0) > (l[i]||0)) return true;
    if ((r[i]||0) < (l[i]||0)) return false;
  }
  return false;
}

// ── Dosya indir ──────────────────────────────────────────────────────────────
function downloadFile(url, dest, onProgress) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
    const file = fs.createWriteStream(dest);
    const mod  = url.startsWith('https') ? https : http;

    mod.get(url, { headers: { 'User-Agent': 'AetherWall-Updater' } }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        try { fs.unlinkSync(dest); } catch {}
        return downloadFile(res.headers.location, dest, onProgress).then(resolve).catch(reject);
      }

      const total = parseInt(res.headers['content-length'] || '0');
      let received = 0;

      res.on('data', chunk => {
        received += chunk.length;
        file.write(chunk);
        if (total > 0) onProgress?.(Math.round(received / total * 100));
      });
      res.on('end',   () => { file.close(); resolve(dest); });
    }).on('error', err => {
      try { fs.unlinkSync(dest); } catch {}
      reject(err);
    });
  });
}

// ── Güncelleme kontrol ───────────────────────────────────────────────────────
async function checkForUpdates(silent = true) {
  if (UPDATE_CHECK_URL.includes('YOUR_USERNAME')) return;

  try {
    const remote = await fetchJSON(UPDATE_CHECK_URL);
    const local  = app.getVersion();

    if (!isNewer(remote.version, local)) {
      if (!silent) {
        dialog.showMessageBox({
          type: 'info', title: 'AetherWall',
          message: 'Güncel sürümü kullanıyorsunuz.',
          detail: `Sürüm: v${local}`,
          buttons: ['Tamam'],
        });
      }
      return;
    }

    const { response } = await dialog.showMessageBox({
      type:    'info',
      title:   '🚀 AetherWall Güncellemesi',
      message: `Yeni sürüm mevcut: v${remote.version}`,
      detail:  (remote.notes || 'Yeni iyileştirmeler ve düzeltmeler.') + '\n\nŞu anki sürüm: v' + local,
      buttons:   ['Şimdi İndir & Güncelle', 'Sonra Hatırlat'],
      defaultId: 0,
      cancelId:  1,
    });

    if (response === 0) downloadUpdate(remote);

  } catch(e) {
    if (!silent) {
      dialog.showMessageBox({
        type: 'warning', title: 'Güncelleme Kontrolü',
        message: 'Güncelleme sunucusuna ulaşılamadı.',
        detail: e.message, buttons: ['Tamam'],
      });
    }
  }
}

// ── İndir ve kur ─────────────────────────────────────────────────────────────
async function downloadUpdate(remote) {
  if (downloading) return;
  downloading = true;

  const fileName = path.basename(remote.url);
  const dest     = path.join(DOWNLOAD_DIR, fileName);

  uiWin?.webContents.send('update:downloading', { version: remote.version });

  try {
    await downloadFile(remote.url, dest, pct => {
      uiWin?.webContents.send('update:progress', pct);
    });

    uiWin?.webContents.send('update:downloaded');

    const { response } = await dialog.showMessageBox({
      type:    'info',
      title:   'Güncelleme Hazır',
      message: `v${remote.version} indirildi!`,
      detail:  'Uygulama kapanacak ve güncelleme başlayacak.',
      buttons:   ['Şimdi Kur', 'Sonra'],
      defaultId: 0,
    });

    if (response === 0) {
      const { spawn } = require('child_process');
      spawn(dest, ['/S'], { detached: true, stdio: 'ignore', windowsHide: false }).unref();
      app.quit();
    }

  } catch(e) {
    downloading = false;
    dialog.showMessageBox({
      type: 'error', title: 'İndirme Hatası',
      message: 'Güncelleme indirilemedi.',
      detail: e.message, buttons: ['Tamam'],
    });
  }
}

// ── IPC ──────────────────────────────────────────────────────────────────────
function setupUpdaterIPC() {
  ipcMain.handle('update:check',   () => checkForUpdates(false));
  ipcMain.handle('update:version', () => app.getVersion());
}

// ── Init ─────────────────────────────────────────────────────────────────────
function initUpdater(uiWindow) {
  uiWin = uiWindow;
  setupUpdaterIPC();

  if (!app.isPackaged) return; // Geliştirme modunda güncelleme yok

  setTimeout(() => checkForUpdates(true), 30_000);       // Açılıştan 30sn sonra
  setInterval(() => checkForUpdates(true), 6 * 60 * 60 * 1000); // Her 6 saatte bir
}

module.exports = { initUpdater };
