'use strict';

const { exec } = require('child_process');

const GAME_PROCESSES = new Set([
  'cs2.exe','csgo.exe','valorant.exe','r5apex.exe','cod.exe',
  'battlefield2042.exe','fortnite.exe','pubg.exe','overwatch2.exe',
  'overwatch.exe','rainbow6.exe','xdefiant.exe','deadlock.exe',
  'witcher3.exe','cyberpunk2077.exe','eldenring.exe','darksouls3.exe',
  'rdr2.exe','gta5.exe','skyrim.exe','skyrimse.exe','fallout4.exe',
  'mountblade2bannerlord.exe','bannerlord.exe','mb_warband.exe',
  'pathofexile.exe','diablo4.exe','baldursgate3.exe','bg3.exe',
  'totalwar.exe','civilization6.exe','hoi4.exe','stellaris.exe',
  'ageofempires4.exe','aoe2de.exe',
  'minecraft.exe','minecraftlauncher.exe','javaw.exe',
  'terraria.exe','stardewvalley.exe','valheim.exe',
  'leagueoflegends.exe','dota2.exe','wow.exe','ffxiv.exe',
  'destiny2.exe','warframe.exe','lostark.exe',
  'satisfactory.exe','deeprockgalactic.exe',
  'deathstranding.exe','monsterhunterworld.exe',
  'sekiro.exe','nioh2.exe','readyornot.exe',
  'escapefromtarkov.exe','hunt.exe','payday3.exe',
]);

const IGNORED_PROCESSES = new Set([
  'chrome.exe','firefox.exe','brave.exe','msedge.exe','opera.exe',
  'winword.exe','excel.exe','powerpnt.exe','outlook.exe',
  'code.exe','devenv.exe','notepad.exe','notepad++.exe',
  'explorer.exe','taskmgr.exe','cmd.exe','powershell.exe',
  'vlc.exe','wmplayer.exe','mpc-hc64.exe','potplayer64.exe',
  'spotify.exe','discord.exe','slack.exe','teams.exe',
  'zoom.exe','obs64.exe','obs32.exe',
]);

let customProcesses  = new Set();
let pollInterval     = null;
let isGameRunning    = false;
let onPauseCallback  = null;
let onResumeCallback = null;

// ── Hafif tam ekran + process kontrolü — TEK PS çağrısı ─────────────────────
// Önceki versiyon: 2 ayrı PS + tasklist = çok ağır
// Yeni: Tek PS içinde her şeyi halleder, wmic yerine CIM kullanır (daha hızlı)
function checkForGames() {
  return new Promise((resolve) => {
    const ps = `
$fw = [System.Runtime.InteropServices.Marshal]::GetActiveObject
Add-Type -TypeDefinition @'
using System;using System.Runtime.InteropServices;using System.Diagnostics;
public class GD {
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h,out RECT r);
  [DllImport("user32.dll")] static extern int GetSystemMetrics(int n);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h,out uint p);
  public struct RECT{public int L,T,R,B;}
  public static string Check(string[] known, string[] ignored){
    try{
      var h=GetForegroundWindow();
      if(h==IntPtr.Zero)return "";
      RECT r;GetWindowRect(h,out r);
      int sw=GetSystemMetrics(0),sh=GetSystemMetrics(1);
      bool fs=(r.L<=0&&r.T<=0&&r.R>=sw&&r.B>=sh);
      uint pid;GetWindowThreadProcessId(h,out pid);
      var pname=(Process.GetProcessById((int)pid).ProcessName.ToLower()+".exe");
      if(Array.IndexOf(ignored,pname)>=0)return "";
      if(fs)return "fs:"+pname;
      if(Array.IndexOf(known,pname)>=0)return "k:"+pname;
    }catch{}
    return "";
  }
}
'@ -ErrorAction SilentlyContinue
$known=@(${[...GAME_PROCESSES, ...customProcesses].map(p=>`'${p}'`).join(',')})
$ign=@(${[...IGNORED_PROCESSES].map(p=>`'${p}'`).join(',')})
[GD]::Check($known,$ign)
`.trim();
    const enc = Buffer.from(ps, 'utf16le').toString('base64');
    exec(
      `powershell -NonInteractive -NoProfile -EncodedCommand ${enc}`,
      { windowsHide: true, timeout: 6000 },
      (err, stdout) => {
        if (err) { resolve(false); return; }
        const r = stdout.trim();
        resolve(r.startsWith('fs:') || r.startsWith('k:') ? r : false);
      }
    );
  });
}

async function tick() {
  try {
    const result = await checkForGames();
    const detected = !!result;
    if (detected && !isGameRunning) {
      isGameRunning = true;
      console.log('[AW] Oyun/tam ekran:', result);
      onPauseCallback?.();
    } else if (!detected && isGameRunning) {
      isGameRunning = false;
      console.log('[AW] Oyun/tam ekran kapandı');
      onResumeCallback?.();
    }
  } catch(e) {
    console.error('[AW] Oyun takip hatası:', e.message);
  }
}

function start(onPause, onResume, intervalMs = 8000) {  // 5sn→8sn: daha az PS spawn
  onPauseCallback  = onPause;
  onResumeCallback = onResume;
  if (pollInterval) clearInterval(pollInterval);
  pollInterval = setInterval(tick, intervalMs);
  setTimeout(tick, 4000); // İlk kontrol 4sn sonra
  console.log('[AW] Oyun takibi başladı');
}

function stop() {
  if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
  isGameRunning = false;
}

function addCustomProcess(name)    { customProcesses.add(name.toLowerCase()); }
function removeCustomProcess(name) { customProcesses.delete(name.toLowerCase()); }
function getStatus()               { return { isGameRunning, customProcesses: [...customProcesses] }; }

module.exports = { start, stop, addCustomProcess, removeCustomProcess, getStatus, GAME_PROCESSES };
