'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('aetherwall', {
  // Wallpaper
  loadWallpaper:       (path, type) => ipcRenderer.invoke('wallpaper:load', path, type),
  pauseWallpaper:      ()           => ipcRenderer.invoke('wallpaper:pause'),
  resumeWallpaper:     ()           => ipcRenderer.invoke('wallpaper:resume'),
  getStatus:           ()           => ipcRenderer.invoke('app:status'),
  setInteractive:      (v)          => ipcRenderer.invoke('wallpaper:setInteractive', v),
  onStatusUpdate:      (cb)         => { ipcRenderer.removeAllListeners('status:update');  ipcRenderer.on('status:update',  (_e,d) => cb(d)); },

  // Şablon
  getTemplatePath: (file) => ipcRenderer.invoke('template:path', file),

  // Dosya
  openFileDialog: () => ipcRenderer.invoke('dialog:openFile'),
  copyWallpaper:  (src) => ipcRenderer.invoke('wallpaper:copyLocal', src),

  // Library
  loadLibrary: ()    => ipcRenderer.invoke('library:load'),
  saveLibrary: (lib) => ipcRenderer.invoke('library:save', lib),

  // Ayarlar
  loadSettings: ()  => ipcRenderer.invoke('settings:load'),
  saveSettings: (s) => ipcRenderer.invoke('settings:save', s),

  // Autostart
  getAutostart: ()    => ipcRenderer.invoke('autostart:get'),
  setAutostart: (v)   => ipcRenderer.invoke('autostart:set', v),

  // Oyun algılama
  addGameProcess:    (n) => ipcRenderer.invoke('gamedetect:add', n),
  removeGameProcess: (n) => ipcRenderer.invoke('gamedetect:remove', n),
  getGameStatus:     ()  => ipcRenderer.invoke('gamedetect:status'),

  // UI pencere kontrolleri
  closeUI:    () => ipcRenderer.send('ui:close'),
  minimizeUI: () => ipcRenderer.send('ui:minimize'),
  maximizeUI: () => ipcRenderer.send('ui:maximize'),
  signalReady:() => ipcRenderer.send('wallpaper:ready'),

  // Dominant renk
  sendDominantColor: (color) => ipcRenderer.send('wallpaper:dominantColor', color),
  onAccentColor:     (cb)    => {
    ipcRenderer.removeAllListeners('theme:accentColor');
    ipcRenderer.on('theme:accentColor', (_e, color) => cb(color));
  },

  // Wallpaper renderer olayları
  onWallpaperLoad: (cb) => { ipcRenderer.removeAllListeners('wallpaper:load');   ipcRenderer.on('wallpaper:load',   (_e,d) => cb(d)); },
  onPause:         (cb) => { ipcRenderer.removeAllListeners('wallpaper:pause');  ipcRenderer.on('wallpaper:pause',  () => cb()); },
  onResume:        (cb) => { ipcRenderer.removeAllListeners('wallpaper:resume'); ipcRenderer.on('wallpaper:resume', () => cb()); },

  // Güncelleme
  getAppVersion: () => ipcRenderer.invoke('update:version'),
  checkUpdate:   () => ipcRenderer.invoke('update:check'),
  onUpdateDownloading: (cb) => { ipcRenderer.removeAllListeners('update:downloading'); ipcRenderer.on('update:downloading', (_e,d) => cb(d)); },
  onUpdateProgress:    (cb) => { ipcRenderer.removeAllListeners('update:progress');    ipcRenderer.on('update:progress',    (_e,p) => cb(p)); },
  onUpdateDownloaded:  (cb) => { ipcRenderer.removeAllListeners('update:downloaded');  ipcRenderer.on('update:downloaded',  () => cb()); },

  // Dil
  getTranslations: () => ipcRenderer.invoke('i18n:get'),
  setLanguage:     (lang) => ipcRenderer.invoke('i18n:set', lang),

  // Windows Accent
  setWindowsAccent:    (color)  => ipcRenderer.invoke('accent:setWindows', color),
  resetWindowsAccent:  ()       => ipcRenderer.invoke('accent:resetWindows'),

  // Çoklu Monitör
  getMonitors:              ()                    => ipcRenderer.invoke('monitor:list'),
  loadWallpaperOnDisplay:   (displayId, path, type) => ipcRenderer.invoke('monitor:loadWallpaper', displayId, path, type),

  platform: process.platform,
});
