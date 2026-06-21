'use strict';

const { screen, BrowserWindow } = require('electron');
const path    = require('path');
const workerW = require('../workerw');

// Her monitör için ayrı pencere ve state
const monitorWindows = new Map(); // displayId → { window, isAttached, display }

async function createMonitorWindow(display, preloadPath, wallpaperHtmlPath) {
  const { bounds, id } = display;

  const win = new BrowserWindow({
    width:  bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    frame:       false,
    transparent: false,
    skipTaskbar: true,
    resizable:   false,
    movable:     false,
    focusable:   false,
    alwaysOnTop: false,
    show:        false,
    backgroundColor: '#000000',
    webPreferences: {
      nodeIntegration:             false,
      contextIsolation:            true,
      preload:                     preloadPath,
      webSecurity:                 false,
      allowRunningInsecureContent: true,
      backgroundThrottling:        false,
    },
  });

  await win.loadFile(wallpaperHtmlPath);
  win.setIgnoreMouseEvents(true, { forward: true });

  let attached = false;
  try {
    // Primary monitörde workerW kullan; secondary için pencereyi sadece göster
    const isPrimary = display.id === screen.getPrimaryDisplay().id;
    if (isPrimary) {
      attached = await workerW.attachToDesktop(win, { retry: true });
    } else {
      // Secondary: pencereyi doğru konuma sabitle ve göster
      win.setPosition(bounds.x, bounds.y);
      win.setSize(bounds.width, bounds.height);
      win.showInactive();
      attached = false; // workerW ikincil monitörde desteklenmiyor
    }
    if (!win.isVisible()) win.showInactive();
    win.webContents.invalidate();
    monitorWindows.set(id, { window: win, isAttached: attached, display });
    console.log(`[AW] Monitör ${id} aktif (${bounds.width}x${bounds.height} @ ${bounds.x},${bounds.y}) ✓`);
  } catch (e) {
    console.error(`[AW] Monitör ${id} hatası:`, e.message);
    win.showInactive();
    monitorWindows.set(id, { window: win, isAttached: false, display });
  }

  win.on('closed', () => monitorWindows.delete(id));
  return win;
}

async function initMonitors(preloadPath, wallpaperHtmlPath, primaryDisplayId) {
  const displays = screen.getAllDisplays();
  console.log(`[AW] ${displays.length} monitör tespit edildi`);

  for (const display of displays) {
    // Ana monitör zaten createWallpaperWindow() + workerW tarafından yönetiliyor.
    // Burada onu atlıyoruz, yoksa aynı ekrana iki pencere çakışır ve ikisi de
    // boş/beyaz görünür (z-order ve WorkerW attach çakışması).
    if (primaryDisplayId && display.id === primaryDisplayId) {
      console.log(`[AW] Monitör ${display.id} ana ekran — atlandı (zaten wallpaperWindow yönetiyor)`);
      continue;
    }
    await createMonitorWindow(display, preloadPath, wallpaperHtmlPath);
  }

  screen.on('display-added', async (event, display) => {
    console.log('[AW] Yeni monitör eklendi:', display.id);
    if (primaryDisplayId && display.id === primaryDisplayId) return;
    await createMonitorWindow(display, preloadPath, wallpaperHtmlPath);
  });

  screen.on('display-removed', (event, display) => {
    console.log('[AW] Monitör çıkartıldı:', display.id);
    const entry = monitorWindows.get(display.id);
    if (entry) { entry.window.close(); monitorWindows.delete(display.id); }
  });
}

function loadWallpaperOnAll(wallpaperPath, type) {
  const escaped = wallpaperPath.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  for (const [, entry] of monitorWindows) {
    entry.window.webContents
      .executeJavaScript(`window.loadWallpaper('${escaped}', '${type}')`)
      .catch(() => {});
  }
}

function loadWallpaperOnDisplay(displayId, wallpaperPath, type) {
  const entry = monitorWindows.get(Number(displayId));
  if (!entry) {
    console.warn(`[AW] Monitör ${displayId} bulunamadı. Mevcut:`, [...monitorWindows.keys()]);
    return;
  }
  const escaped = wallpaperPath.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  entry.window.webContents
    .executeJavaScript(`window.loadWallpaper('${escaped}', '${type}')`)
    .catch((e) => console.error('[AW] loadWallpaper hatası:', e.message));
}

function pauseAll() {
  for (const [, entry] of monitorWindows) {
    entry.window.webContents.executeJavaScript('window.pauseWallpaper?.()').catch(() => {});
  }
}

function resumeAll() {
  for (const [, entry] of monitorWindows) {
    entry.window.webContents.executeJavaScript('window.resumeWallpaper?.()').catch(() => {});
  }
}

function setSettingsOnAll(s) {
  const json = JSON.stringify(s);
  for (const [, entry] of monitorWindows) {
    entry.window.webContents
      .executeJavaScript(`window.applySettings?.(${json})`)
      .catch(() => {});
  }
}

function getMonitors() {
  const primary = screen.getPrimaryDisplay();
  return screen.getAllDisplays().map(d => {
    const isPrimary = d.id === primary.id;
    return {
      id:          d.id,
      bounds:      d.bounds,
      scaleFactor: d.scaleFactor,
      isPrimary,
      // Ana monitör wallpaperWindow üzerinden her zaman aktif kabul edilir,
      // diğerleri monitorWindows Map'inde kayıtlıysa aktiftir.
      isActive:    isPrimary ? true : monitorWindows.has(d.id),
      label:       isPrimary ? 'Ana Monitör' : `Monitör ${d.id}`,
    };
  });
}

function closeAll() {
  for (const [, entry] of monitorWindows) {
    try { entry.window.close(); } catch (_) {}
  }
  monitorWindows.clear();
}

module.exports = {
  initMonitors,
  loadWallpaperOnAll,
  loadWallpaperOnDisplay,
  pauseAll,
  resumeAll,
  setSettingsOnAll,
  getMonitors,
  closeAll,
};
