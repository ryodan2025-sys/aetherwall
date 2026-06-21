'use strict';

const koffi = require('koffi');

const user32 = koffi.load('user32.dll');

const EnumWindowsProc = koffi.proto('bool __stdcall EnumWindowsProc(void *hwnd, intptr lParam)');

const FindWindowA           = user32.func('void* __stdcall FindWindowA(const char *lpClassName, const char *lpWindowName)');
const FindWindowExA         = user32.func('void* __stdcall FindWindowExA(void *hWndParent, void *hWndChildAfter, const char *lpszClass, const char *lpszWindow)');
const SendMessageTimeoutA   = user32.func('intptr __stdcall SendMessageTimeoutA(void *hWnd, uint Msg, uintptr wParam, intptr lParam, uint fuFlags, uint uTimeout, _Out_ uintptr *lpdwResult)');
const EnumWindows           = user32.func('EnumWindows', 'bool', [koffi.pointer(EnumWindowsProc), 'intptr']);
const SetWindowLongA        = user32.func('long __stdcall SetWindowLongA(void *hWnd, int nIndex, long dwNewLong)');
const GetWindowLongA        = user32.func('long __stdcall GetWindowLongA(void *hWnd, int nIndex)');
const SetLayeredWindowAttrs = user32.func('bool __stdcall SetLayeredWindowAttributes(void *hWnd, uint crKey, uint8 bAlpha, uint dwFlags)');
const SetParent             = user32.func('void* __stdcall SetParent(void *hWndChild, void *hWndNewParent)');
const SetWindowPos          = user32.func('bool __stdcall SetWindowPos(void *hWnd, void *hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags)');
const ShowWindow            = user32.func('bool __stdcall ShowWindow(void *hWnd, int nCmdShow)');
const GetSystemMetrics      = user32.func('int __stdcall GetSystemMetrics(int nIndex)');
const IsWindow              = user32.func('bool __stdcall IsWindow(void *hWnd)');
const MoveWindow            = user32.func('bool __stdcall MoveWindow(void *hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint)');

const WM_SPAWN_WORKER  = 0x052C;
const SMTO_NORMAL      = 0x0000;
const GWL_EXSTYLE      = -20;
const WS_EX_LAYERED    = 0x00080000;
const LWA_ALPHA        = 0x00000002;
const SW_SHOW          = 5;
const SM_CXSCREEN      = 0;
const SM_CYSCREEN      = 1;
const SWP_NOACTIVATE   = 0x0010;
const SWP_SHOWWINDOW   = 0x0040;
const SWP_FRAMECHANGED = 0x0020;
const SWP_NOZORDER     = 0x0004;

let workerWHandle  = null;
let originalParent = null;
let attachedHwnd   = null;
let watcherTimer   = null;

function ptrToBigInt(ptr) {
  if (!ptr) return 0n;
  try { return BigInt(koffi.address(ptr)); } catch { return 0n; }
}
function isValid(ptr) { return ptr !== null && ptrToBigInt(ptr) !== 0n; }
function sleep(ms)    { return new Promise(r => setTimeout(r, ms)); }

function findEmptyWorkerW(progman) {
  let cur = null;
  while (true) {
    cur = FindWindowExA(progman, cur, 'WorkerW', null);
    if (!isValid(cur)) break;
    const dv = FindWindowExA(cur, null, 'SHELLDLL_DefView', null);
    if (!isValid(dv)) return cur;
  }

  let found = null;
  const cb = koffi.register((hwnd, _) => {
    const dv = FindWindowExA(hwnd, null, 'SHELLDLL_DefView', null);
    if (isValid(dv)) {
      const next = FindWindowExA(null, hwnd, 'WorkerW', null);
      if (isValid(next)) { found = next; return false; }
    }
    return true;
  }, koffi.pointer(EnumWindowsProc));
  try { EnumWindows(cb, 0); } finally { koffi.unregister(cb); }
  return found;
}

async function forceCreateWorkerW(progman) {
  const result = [BigInt(0)];
  for (let i = 0; i < 5; i++) {
    SendMessageTimeoutA(progman, WM_SPAWN_WORKER, 0x0D, 0x01, SMTO_NORMAL, 1000, result);
    await sleep(300);
    SendMessageTimeoutA(progman, WM_SPAWN_WORKER, 0, 0, SMTO_NORMAL, 1000, result);
    await sleep(700);
    const w = findEmptyWorkerW(progman);
    if (isValid(w)) return w;
    if (i < 4) await sleep(1000 * (i + 1));
  }
  return null;
}

async function attachToDesktop(browserWindow, options = {}) {
  const screenW = GetSystemMetrics(SM_CXSCREEN);
  const screenH = GetSystemMetrics(SM_CYSCREEN);

  const progman = FindWindowA('Progman', null);
  if (!isValid(progman)) { console.error('[AW] Progman bulunamadi!'); return false; }

  workerWHandle = await forceCreateWorkerW(progman);
  if (!isValid(workerWHandle)) { console.error('[AW] WorkerW olusturulamadi!'); return false; }

  const hwndBuf = browserWindow.getNativeWindowHandle();
  attachedHwnd  = koffi.decode(hwndBuf, 'void *');

  const exStyle = GetWindowLongA(attachedHwnd, GWL_EXSTYLE);
  SetWindowLongA(attachedHwnd, GWL_EXSTYLE, exStyle | WS_EX_LAYERED);
  SetLayeredWindowAttrs(attachedHwnd, 0, 255, LWA_ALPHA);

  SetWindowPos(attachedHwnd, null, 0, 0, screenW, screenH,
    SWP_NOACTIVATE | SWP_SHOWWINDOW | SWP_FRAMECHANGED | SWP_NOZORDER);

  const prev = SetParent(attachedHwnd, workerWHandle);
  if (!isValid(prev)) { console.error('[AW] SetParent basarisiz!'); return false; }
  originalParent = prev;

  MoveWindow(attachedHwnd, 0, 0, screenW, screenH, true);
  ShowWindow(attachedHwnd, SW_SHOW);
  SetLayeredWindowAttrs(attachedHwnd, 0, 255, LWA_ALPHA);

  console.log('[AW] ✅ Wallpaper masaüstüne sabitlendi!');
  if (options.retry !== false) startWatcher(browserWindow, options, progman);
  return true;
}

// options ve progman parametrelerini doğru al
function startWatcher(browserWindow, opts, progman) {
  if (watcherTimer) clearInterval(watcherTimer);
  watcherTimer = setInterval(async () => {
    try {
      if (!workerWHandle || !IsWindow(workerWHandle)) {
        console.warn('[AW] WorkerW kayboldu, yeniden baglaniyor...');
        clearInterval(watcherTimer); watcherTimer = null;
        await sleep(2000);
        const ok = await attachToDesktop(browserWindow, { ...opts, retry: false });
        if (ok) browserWindow.webContents.invalidate();
        return;
      }
      if (!browserWindow.isDestroyed()) {
        browserWindow.webContents.invalidate();
      }
    } catch (_) {}
  }, 8000);
  browserWindow.on('closed', () => {
    if (watcherTimer) { clearInterval(watcherTimer); watcherTimer = null; }
  });
}

function detachFromDesktop() {
  if (watcherTimer) { clearInterval(watcherTimer); watcherTimer = null; }
  if (!attachedHwnd) return;
  try { if (originalParent) SetParent(attachedHwnd, originalParent); }
  catch (e) { console.error('[AW] Detach hatasi:', e.message); }
  finally { workerWHandle = null; originalParent = null; attachedHwnd = null; }
}

function getScreenSize() {
  return { width: GetSystemMetrics(SM_CXSCREEN), height: GetSystemMetrics(SM_CYSCREEN) };
}

module.exports = { attachToDesktop, detachFromDesktop, getScreenSize };
