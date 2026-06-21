'use strict';

const { app, BrowserWindow, ipcMain, Tray, Menu, screen, nativeImage, dialog } = require('electron');
const path       = require('path');
const workerW    = require('../workerw');
const settings   = require('../settings');
const gameDetect = require('../gamedetect');
const monitor    = require('../monitor');
const { initUpdater } = require('./updater');
const i18nData = require('./i18n');

const PRELOAD_PATH   = path.join(__dirname, 'preload.js');
const WALLPAPER_HTML = path.join(__dirname, '../renderer/wallpaper.html');
const UI_HTML        = path.join(__dirname, '../renderer/ui.html');
const LOADING_HTML   = path.join(__dirname, '../renderer/loading.html');
const TEMPLATES_DIR  = path.join(__dirname, '../templates');

let wallpaperWindow = null;
let uiWindow        = null;
let splashWindow    = null;
let tray            = null;
let isAttached      = false;
let isPaused        = false;
let currentSettings = settings.load();

const SPLASH_DURATION = 5800;

// ─── Splash ───────────────────────────────────────────────────────────────────
function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 900, height: 600,
    frame: false, transparent: false,
    skipTaskbar: true, resizable: false,
    movable: true, alwaysOnTop: true, center: true,
    backgroundColor: '#000000',
    webPreferences: { nodeIntegration: false, contextIsolation: true, webSecurity: false, backgroundThrottling: true },
  });
  splashWindow.loadFile(LOADING_HTML);
  setTimeout(() => {
    if (splashWindow && !splashWindow.isDestroyed()) { splashWindow.close(); splashWindow = null; }
    // Splash bitti — önce wallpaper göster, sonra UI aç
    if (wallpaperWindow && !wallpaperWindow.isDestroyed()) {
      wallpaperWindow.show();
      wallpaperWindow.webContents.invalidate();
    }
    createUIWindow();
  }, SPLASH_DURATION);
  splashWindow.on('closed', () => { splashWindow = null; });
}

// ─── Wallpaper Penceresi ──────────────────────────────────────────────────────
async function createWallpaperWindow() {
  const { width, height } = screen.getPrimaryDisplay().bounds;
  wallpaperWindow = new BrowserWindow({
    width, height, x:0, y:0,
    frame:false, transparent:false, skipTaskbar:true,
    resizable:false, movable:false, focusable:false,
    alwaysOnTop:false, show:false, backgroundColor:'#000000',
    webPreferences:{
      nodeIntegration:false, contextIsolation:true, preload:PRELOAD_PATH,
      webSecurity:false, allowRunningInsecureContent:true,
      backgroundThrottling:false,  // Wallpaper her zaman render edilmeli
      spellcheck:false,
      v8CacheOptions:'bypassHeatCheck',
    },
  });
  await wallpaperWindow.loadFile(WALLPAPER_HTML);
  try {
    isAttached = await workerW.attachToDesktop(wallpaperWindow, { retry: true });
    // show() splash sonrasında çağrılacak
    wallpaperWindow.webContents.invalidate();
  } catch(err) {
    console.error('[AW] Attach hatasi:', err.message);
    isAttached = false;
    // show() splash sonrasında çağrılacak
  }
  wallpaperWindow.setIgnoreMouseEvents(true, { forward: true });
  wallpaperWindow.on('closed', () => { workerW.detachFromDesktop(); wallpaperWindow = null; isAttached = false; });
}

// ─── UI Penceresi ─────────────────────────────────────────────────────────────
function createUIWindow() {
  if (uiWindow) { uiWindow.focus(); return; }
  uiWindow = new BrowserWindow({
    width:1100, height:720, minWidth:900, minHeight:600,
    title:'AetherWall', frame:false, focusable:true, resizable:true,
    show: false,
    webPreferences:{
      nodeIntegration:false, contextIsolation:true, preload:PRELOAD_PATH,
      webSecurity:false,
      backgroundThrottling:true,   // UI arka planda kısıtlansın → CPU tasarrufu
      spellcheck:false,
    },
  });
  uiWindow.loadFile(UI_HTML);
  uiWindow.once('ready-to-show', () => uiWindow.show());
  uiWindow.on('closed', () => { uiWindow = null; });
}

// ─── Tray ─────────────────────────────────────────────────────────────────────
function createTray() {
  let icon;
  try {
    const iconPath = path.join(__dirname, '../../assets/icon.png');
    const fs = require('fs');
    icon = fs.existsSync(iconPath)
      ? nativeImage.createFromPath(iconPath).resize({ width:16, height:16 })
      : nativeImage.createEmpty();
  } catch { icon = nativeImage.createEmpty(); }
  tray = new Tray(icon);
  tray.setToolTip('AetherWall');
  const menu = Menu.buildFromTemplate([
    { label:'AetherWall Aç', click:() => createUIWindow() },
    { type:'separator' },
    { label:'Duraklat',  click:() => pauseWallpaper() },
    { label:'Devam Et',  click:() => resumeWallpaper() },
    { type:'separator' },
    { label:'Çıkış', click:() => app.quit() },
  ]);
  tray.setContextMenu(menu);
  tray.on('double-click', () => createUIWindow());
}

// ─── Wallpaper Kontrol ────────────────────────────────────────────────────────
function pauseWallpaper() {
  isPaused = true;
  wallpaperWindow?.webContents.executeJavaScript('window.pauseWallpaper?.()').catch(() => {});
  uiWindow?.webContents.send('status:update', getStatus());
}
function resumeWallpaper() {
  isPaused = false;
  wallpaperWindow?.webContents.executeJavaScript('window.resumeWallpaper?.()').catch(() => {});
  uiWindow?.webContents.send('status:update', getStatus());
}
function getStatus() {
  return { attached:isAttached, isPaused, screenSize:workerW.getScreenSize(), version:app.getVersion(), settings:currentSettings };
}

// ─── IPC ──────────────────────────────────────────────────────────────────────
function setupIPC() {
  ipcMain.handle('wallpaper:load', async (e, wallpaperPath, type) => {
    if (!wallpaperWindow) return { success:false };
    const escaped = wallpaperPath.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    if (type === 'html' || type === 'template') {
      await wallpaperWindow.loadURL('file:///' + wallpaperPath.replace('file:///','').replace(/\\/g,'/'));
    } else {
      await wallpaperWindow.webContents.executeJavaScript(`window.loadWallpaper('${escaped}','${type}')`).catch(() => {});
    }
    return { success:true };
  });

  ipcMain.handle('wallpaper:pause',  () => { pauseWallpaper(); return true; });
  ipcMain.handle('wallpaper:resume', () => { resumeWallpaper(); return true; });
  ipcMain.handle('app:status', () => getStatus());

  ipcMain.handle('template:path', (e, file) =>
    'file:///' + path.join(TEMPLATES_DIR, file).replace(/\\/g, '/'));

  ipcMain.handle('wallpaper:copyLocal', async (e, srcPath) => {
    const fs = require('fs'), os = require('os'), crypto = require('crypto');
    try {
      let localPath = decodeURIComponent(srcPath.replace(/^file:\/+/, ''));
      if (localPath.match(/^\/[A-Za-z]:\//)) localPath = localPath.slice(1);
      const wallpapersDir = path.join(process.env.APPDATA || path.join(os.homedir(),'AppData','Roaming'), 'AetherWall','wallpapers');
      if (!fs.existsSync(wallpapersDir)) fs.mkdirSync(wallpapersDir, { recursive:true });
      const ext = path.extname(localPath);
      const destPath = path.join(wallpapersDir, path.basename(localPath,ext)+'_'+crypto.createHash('md5').update(srcPath).digest('hex').slice(0,8)+ext);
      if (!fs.existsSync(destPath)) fs.copyFileSync(localPath, destPath);
      return 'file:///' + destPath.replace(/\\/g, '/');
    } catch(e) { return srcPath; }
  });

  ipcMain.handle('dialog:openFile', async () => {
    const r = await dialog.showOpenDialog(uiWindow || BrowserWindow.getFocusedWindow(), {
      title:'Wallpaper Seç',
      filters:[
        { name:'Wallpaper', extensions:['mp4','webm','html','htm','jpg','jpeg','png','gif','webp','glsl','frag'] },
        { name:'Video',   extensions:['mp4','webm'] },
        { name:'Görsel',  extensions:['jpg','jpeg','png','gif','webp'] },
        { name:'HTML',    extensions:['html','htm'] },
        { name:'Shader',  extensions:['glsl','frag'] },
      ],
      properties:['openFile'],
    });
    if (r.canceled || !r.filePaths.length) return null;
    const fp = r.filePaths[0], ext = path.extname(fp).slice(1).toLowerCase();
    const typeMap = {mp4:'video',webm:'video',html:'html',htm:'html',glsl:'shader',frag:'shader',jpg:'image',jpeg:'image',png:'image',gif:'image',webp:'image'};
    return { path:'file:///'+fp.replace(/\\/g,'/'), name:path.basename(fp,path.extname(fp)), type:typeMap[ext]||'image' };
  });

  ipcMain.handle('library:load', () => settings.loadLibrary());
  ipcMain.handle('library:save', (e, lib) => { settings.saveLibrary(lib); return true; });

  ipcMain.handle('settings:load', () => settings.load());

  let _gameDetectRestartTimer = null;
  ipcMain.handle('settings:save', (e, s) => {
    if ('startWithWindows' in s) setAutostart(s.startWithWindows);
    currentSettings = { ...currentSettings, ...s };
    settings.save(currentSettings); // zaten debounce'lu (300ms)

    // gameDetect restart'ı debounce — toggle'a art arda basılınca sürekli restart etme
    clearTimeout(_gameDetectRestartTimer);
    _gameDetectRestartTimer = setTimeout(() => {
      if (currentSettings.pauseOnFullscreen) gameDetect.start(pauseWallpaper, resumeWallpaper);
      else gameDetect.stop();
    }, 500);

    wallpaperWindow?.webContents.executeJavaScript(
      `window.applySettings?.(${JSON.stringify({fpsLimit:currentSettings.fpsLimit,volume:currentSettings.volume,playbackSpeed:currentSettings.playbackSpeed})})`
    ).catch(() => {});
    return currentSettings;
  });

  ipcMain.handle('autostart:get', () => getAutostartStatus());
  ipcMain.handle('autostart:set', (e, enable) => { setAutostart(enable); return true; });

  ipcMain.handle('gamedetect:add',    (e, n) => { gameDetect.addCustomProcess(n); return true; });
  ipcMain.handle('gamedetect:remove', (e, n) => { gameDetect.removeCustomProcess(n); return true; });
  ipcMain.handle('gamedetect:status', () => gameDetect.getStatus());

  ipcMain.on('ui:close',    () => uiWindow?.close());
  ipcMain.on('ui:minimize', () => uiWindow?.minimize());
  ipcMain.on('ui:maximize', () => uiWindow?.isMaximized() ? uiWindow.unmaximize() : uiWindow?.maximize());
  ipcMain.on('wallpaper:ready', () => {});

  ipcMain.handle('i18n:get', () => {
    const lang = currentSettings.language || 'tr';
    return { lang, translations: i18nData[lang] || i18nData['tr'] };
  });
  ipcMain.handle('i18n:set', (e, lang) => {
    currentSettings.language = lang;
    settings.save(currentSettings);
    return { lang, translations: i18nData[lang] || i18nData['tr'] };
  });

  let lastAccentColor = null;
  ipcMain.on('wallpaper:dominantColor', (e, color) => {
    // Aynı renk tekrar gelirse işlem yapma
    if (color === lastAccentColor) return;
    lastAccentColor = color;
    uiWindow?.webContents.send('theme:accentColor', color);
    if (currentSettings.windowsAccentSync) setWindowsAccentColor(color);
  });

  ipcMain.handle('accent:setWindows',   (e, color) => setWindowsAccentColor(color));
  ipcMain.handle('accent:resetWindows', ()          => resetWindowsAccentColor());

  // Çoklu Monitör
  ipcMain.handle('monitor:list', () => {
    try { return monitor.getMonitors(); }
    catch(e) { console.error('[AW] monitor:list hata:', e.message); return []; }
  });
  ipcMain.handle('monitor:loadWallpaper', async (e, displayId, wallpaperPath, type) => {
    try {
      await monitor.loadWallpaperOnDisplay(Number(displayId), wallpaperPath, type);
      if (!currentSettings.monitorConfig) currentSettings.monitorConfig = {};
      currentSettings.monitorConfig[displayId] = { path: wallpaperPath, type };
      settings.save(currentSettings);
      return true;
    } catch(e) { console.error('[AW] monitor:loadWallpaper hata:', e.message); return false; }
  });

  ipcMain.handle('wallpaper:setInteractive', (e, interactive) => {
    if (!wallpaperWindow) return;
    wallpaperWindow.setIgnoreMouseEvents(!interactive, { forward: true });
  });
}

// ─── Windows Accent — EncodedCommand ile (tırnak sorunu yok) ─────────────────
function runPS(scriptLines) {
  const script  = scriptLines.join('\n');
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  return new Promise((resolve) => {
    require('child_process').exec(
      `powershell -NonInteractive -NoProfile -EncodedCommand ${encoded}`,
      { windowsHide: true, timeout: 10000 },
      (err) => {
        if (err) console.error('[AW] PS hatası:', err.message);
        resolve(!err);
      }
    );
  });
}

function setWindowsAccentColor(rgbStr) {
  try {
    const m = rgbStr.match(/rgb\((\d+),(\d+),(\d+)\)/);
    if (!m) return;
    const r = parseInt(m[1]), g = parseInt(m[2]), b = parseInt(m[3]);

    // Renk paleti (8 ton)
    function shade(r,g,b,f){ return [Math.min(255,r*f|0),Math.min(255,g*f|0),Math.min(255,b*f|0),255]; }
    const pal    = [0.4,0.6,0.75,0.9,1.0,1.2,1.4,1.6].flatMap(f => shade(r,g,b,f));
    const palHex = pal.map(v => v.toString(16).padStart(2,'0')).join('');

    // ABGR formatı (Windows registry)
    const abgr = (0xFF000000 + (b << 16) + (g << 8) + r) >>> 0;

    const lines = [
      `$c = [uint32]${abgr}`,
      `$pb = [byte[]](("${palHex}" -split "(?<=\\G.{2})" | Where-Object {$_} | ForEach-Object {[Convert]::ToByte($_, 16)}))`,
      `$dwm = "HKCU:\\Software\\Microsoft\\Windows\\DWM"`,
      `Set-ItemProperty -Path $dwm -Name AccentColor          -Value $c  -Type DWord  -Force`,
      `Set-ItemProperty -Path $dwm -Name AccentColorInactive  -Value $c  -Type DWord  -Force`,
      `Set-ItemProperty -Path $dwm -Name ColorizationColor    -Value $c  -Type DWord  -Force`,
      `$acc = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Accent"`,
      `if (-not (Test-Path $acc)) { New-Item -Path $acc -Force | Out-Null }`,
      `Set-ItemProperty -Path $acc -Name AccentColor     -Value $c  -Type DWord  -Force`,
      `Set-ItemProperty -Path $acc -Name AccentColorMenu -Value $c  -Type DWord  -Force`,
      `Set-ItemProperty -Path $acc -Name AccentPalette   -Value $pb -Type Binary -Force`,
      `$pers = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize"`,
      `Set-ItemProperty -Path $pers -Name ColorPrevalence -Value 1 -Type DWord -Force`,
      `Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class AW2{[DllImport("user32.dll")]public static extern IntPtr SendMessageTimeout(IntPtr h,uint m,UIntPtr w,string l,uint f,uint t,out IntPtr r);}' -ErrorAction SilentlyContinue`,
      `$x=[IntPtr]::Zero`,
      `[AW2]::SendMessageTimeout([IntPtr]0xffff,0x001A,[UIntPtr]::Zero,"ImmersiveColorSet",2,3000,[ref]$x) | Out-Null`,
    ];

    runPS(lines).then(ok => {
      if (ok) console.log('[AW] Accent güncellendi:', rgbStr);
    });
  } catch(e) { console.error('[AW] Accent hazırlık hatası:', e.message); }
}

function resetWindowsAccentColor() {
  const lines = [
    `$pers = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize"`,
    `Set-ItemProperty -Path $pers -Name ColorPrevalence -Value 0 -Type DWord -Force`,
    `Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class AWR2{[DllImport("user32.dll")]public static extern IntPtr SendMessageTimeout(IntPtr h,uint m,UIntPtr w,string l,uint f,uint t,out IntPtr r);}' -ErrorAction SilentlyContinue`,
    `$x=[IntPtr]::Zero`,
    `[AWR2]::SendMessageTimeout([IntPtr]0xffff,0x001A,[UIntPtr]::Zero,"ImmersiveColorSet",2,3000,[ref]$x) | Out-Null`,
  ];
  runPS(lines).then(() => console.log('[AW] Accent sıfırlandı'));
}

const os       = require('os');
const path_mod = require('path');
const fs_mod   = require('fs');
const cp_mod   = require('child_process');

// ─── Autostart ────────────────────────────────────────────────────────────────
function getAutostartStatus() {
  try {
    require('child_process').execSync(
      'reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v AetherWall',
      { windowsHide:true }
    );
    return true;
  } catch { return false; }
}

function setAutostart(enable) {
  try {
    const { execSync } = require('child_process');
    const key = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
    if (enable) {
      execSync(`reg add "${key}" /v "AetherWall" /t REG_SZ /d "\\"${process.execPath}\\"" /f`, { windowsHide:true });
    } else {
      try { execSync(`reg delete "${key}" /v "AetherWall" /f`, { windowsHide:true }); } catch(_) {}
    }
    console.log('[AW] Autostart:', enable ? 'açıldı' : 'kapatıldı');
  } catch(e) { console.error('Autostart hatası:', e.message); }
}

// ─── Başlangıç ────────────────────────────────────────────────────────────────
// Chromium / V8 performans bayrakları
app.commandLine.appendSwitch('js-flags',
  '--max-old-space-size=512 --optimize-for-size'   // 256 çok düşüktü → sık GC; 512 dengeli
);
app.commandLine.appendSwitch('disable-features',
  'HardwareMediaKeyHandling,MediaSessionService,AutofillServerCommunication'
);
// Gereksiz Chromium servisleri kapat
app.commandLine.appendSwitch('disable-background-networking');
app.commandLine.appendSwitch('disable-extensions');
app.commandLine.appendSwitch('disable-component-update');
// Video için donanım hızlandırma açık tut ama render sürecini koru
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');          // video frame kopyalamayı azalt

app.whenReady().then(async () => {
  setupIPC();
  createSplashWindow();
  await createWallpaperWindow();

  // Ek monitörlere wallpaper penceresi aç (ana monitör zaten wallpaperWindow'da yönetiliyor)
  const PRELOAD_PATH    = path_mod.join(__dirname, 'preload.js');
  const WALLPAPER_HTML  = path_mod.join(__dirname, '../renderer/wallpaper.html');
  const primaryDisplayId = screen.getPrimaryDisplay().id;
  await monitor.initMonitors(PRELOAD_PATH, WALLPAPER_HTML, primaryDisplayId);

  createTray();
  initUpdater(uiWindow);

  if (currentSettings.pauseOnFullscreen) gameDetect.start(pauseWallpaper, resumeWallpaper);

  const lib    = settings.loadLibrary();
  const active = lib.find(w => w.isActive);
  if (active) {
    // Splash bittikten sonra yükle (SPLASH_DURATION + 500ms)
    setTimeout(() => {
      const escaped = active.path.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
      wallpaperWindow?.webContents
        .executeJavaScript(`window.loadWallpaper('${escaped}','${active.type}')`)
        .catch(() => {});

      // Kayıtlı monitör konfigürasyonlarını uygula — ama önce geçersiz/artık
      // bağlı olmayan monitör ID'lerini temizle. Windows'ta monitör ID'leri
      // sürücü güncellemesi veya yeniden bağlanma sonrası değişebiliyor;
      // eski ID'ler settings.json'da kalıp gereksiz uyarı logu üretiyordu.
      const mc = currentSettings.monitorConfig || {};
      const connectedIds = new Set(screen.getAllDisplays().map(d => String(d.id)));
      let changed = false;

      for (const dispId of Object.keys(mc)) {
        if (!connectedIds.has(dispId)) {
          console.log(`[AW] Geçersiz monitör kaydı temizlendi: ${dispId}`);
          delete mc[dispId];
          changed = true;
        }
      }
      if (changed) {
        currentSettings.monitorConfig = mc;
        settings.save(currentSettings);
      }

      for (const [dispId, wCfg] of Object.entries(mc)) {
        if (wCfg?.path) monitor.loadWallpaperOnDisplay(Number(dispId), wCfg.path, wCfg.type);
      }
    }, SPLASH_DURATION + 500);
  }
});

app.on('before-quit', () => {
  gameDetect.stop();
  monitor.closeAll();
  workerW.detachFromDesktop();
});

app.on('window-all-closed', () => {});
