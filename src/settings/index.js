'use strict';

const fs   = require('fs');
const path = require('path');
const os   = require('os');

const SETTINGS_DIR  = path.join(os.homedir(), '.aetherwall');
const SETTINGS_FILE = path.join(SETTINGS_DIR, 'settings.json');
const LIBRARY_FILE  = path.join(SETTINGS_DIR, 'library.json');

const DEFAULTS = {
  theme:            'dark',
  language:         'tr',
  startWithWindows: false,
  minimizeToTray:   true,
  fpsLimit:          60,
  volume:            0,
  playbackSpeed:     1.0,
  pauseOnBattery:    false,
  pauseOnFullscreen: true,
  windowsAccentSync: false,
  paletteId:        'aether',
  multiMonitor:     false,
  monitorConfig:    {},
  audioInput:       'system',
};

// ── In-memory cache — disk'e her çağrıda gitmeyi önler ───────────────────────
let _settingsCache  = null;
let _libraryCache   = null;
let _saveTimer      = null;   // debounce — 300ms bekle, sonra yaz
let _libSaveTimer   = null;

function ensureDir() {
  if (!fs.existsSync(SETTINGS_DIR)) fs.mkdirSync(SETTINGS_DIR, { recursive: true });
}

function load() {
  if (_settingsCache) return { ..._settingsCache };
  ensureDir();
  try {
    _settingsCache = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')) };
  } catch {
    _settingsCache = { ...DEFAULTS };
  }
  return { ..._settingsCache };
}

function save(s) {
  _settingsCache = { ...s };
  // Debounce: art arda gelen kayıtları birleştir, 300ms sonra disk'e yaz
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    try {
      ensureDir();
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(_settingsCache, null, 2), 'utf8');
    } catch(e) { console.error('[AW] Ayar kayıt hatası:', e.message); }
  }, 300);
}

function loadLibrary() {
  if (_libraryCache) return [..._libraryCache];
  ensureDir();
  try {
    _libraryCache = JSON.parse(fs.readFileSync(LIBRARY_FILE, 'utf8'));
  } catch {
    _libraryCache = [];
  }
  return [..._libraryCache];
}

function saveLibrary(library) {
  _libraryCache = [...library];
  clearTimeout(_libSaveTimer);
  _libSaveTimer = setTimeout(() => {
    try {
      ensureDir();
      fs.writeFileSync(LIBRARY_FILE, JSON.stringify(_libraryCache, null, 2), 'utf8');
    } catch(e) { console.error('[AW] Kütüphane kayıt hatası:', e.message); }
  }, 300);
}

// Önbelleği geçersiz kıl (dışarıdan dosya değiştirilirse)
function invalidateCache() { _settingsCache = null; _libraryCache = null; }

function get(key)        { return load()[key]; }
function set(key, value) { const s = load(); s[key] = value; save(s); return s; }

module.exports = { load, save, get, set, loadLibrary, saveLibrary, invalidateCache, SETTINGS_DIR, DEFAULTS };
