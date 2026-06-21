; AetherWall — NSIS Özel Installer Script
; Kurulum/Kaldırma sırasında ek işlemler

!macro customInstall
  ; Windows ile başlat kaydını ekle (kullanıcı ayarından bağımsız, default kapalı)
  ; Gerçek kayıt settings modülü tarafından yönetiliyor
  DetailPrint "AetherWall kurulumu tamamlanıyor..."
!macroend

!macro customUninstall
  ; Kaldırma sırasında ayar dosyalarını temizle (isteğe bağlı)
  DetailPrint "AetherWall kaldırılıyor..."
  ; Autostart kaydını temizle
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "AetherWall"
!macroend
