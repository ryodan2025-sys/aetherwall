# 🌌 AetherWall

**Windows için ücretsiz, açık kaynak canlı duvar kağıdı motoru.**
**Free and open source live wallpaper engine for Windows.**

Video, görsel, HTML/CSS/JS ve GLSL shader duvar kağıtlarını masaüstünüze sabitler.
Pins video, image, HTML/CSS/JS and GLSL shader wallpapers to your desktop.

> Kaynak kodu tamamen açık. Hiçbir telemetri, hiçbir gizli ağ isteği yok.
> Source code is fully open. No telemetry, no hidden network requests.

---

## 📥 İndirme / Download

[**Releases**](../../releases) sayfasından son sürümü indirin.
Download the latest version from the [**Releases**](../../releases) page.

- **`AetherWall-Setup-x.x.x.exe`** — Kurulum sihirbazı, otomatik güncelleme / Installer, auto update
- **`AetherWall-Portable-x.x.x.exe`** — Kurulum gerektirmez / No installation required

### ⚠️ Windows SmartScreen Uyarısı / Warning

İlk çalıştırmada **"Bilinmeyen Yayımcı"** uyarısı çıkabilir — kötü amaçlı yazılım değildir.
You may see an **"Unknown Publisher"** warning on first run — this is not malware.

**TR:** Daha fazla bilgi → Yine de çalıştır
**EN:** More info → Run anyway

Kaynak kodu açık, isteyen herkes inceleyebilir.
Source code is open, anyone can review it.

---

## ✨ Özellikler / Features

- 🎬 **Video** (MP4, WebM), **Görsel / Image** (JPG, PNG, GIF, WebP), **HTML/CSS/JS**, **GLSL Shader**
- 🎮 **Oyun Algılama / Game Detection** — oyun açılınca otomatik duraklat / auto pause on game launch (40+ games built-in)
- 🎨 **Windows Renk Uyumu / Accent Sync** — duvar kağıdından renk çeker / extracts color from wallpaper
- 🌍 **Çoklu Dil / Multi-language** — Türkçe & English
- ⚡ **FPS Limiti / FPS Limit** — 15 / 30 / 60 / Limitsiz / Unlimited
- 🖥️ **Çoklu Monitör / Multi-monitor** — her ekrana farklı wallpaper / different wallpaper per screen
- ☀️/🌙 **Açık/Koyu Tema / Light/Dark Theme**
- 🔄 **Otomatik Güncelleme / Auto Update**
- 📦 **Hafif / Lightweight** — minimal background resource usage

---

## 🛠️ Kaynaktan Derleme / Build from Source

```bash
git clone https://github.com/ryodan2025-sys/aetherwall.git
cd aetherwall
npm install
npm start          # geliştirme modu / development mode
```

```bash
npm run build      # Windows .exe üret / build Windows .exe
npm run build:dir  # klasör çıktısı / directory output (faster)
```

---

## 🤝 Katkıda Bulunma / Contributing

PR'lar açık / PRs are welcome.
Büyük değişiklikler için önce issue açın / For major changes, please open an issue first.
Detaylar: [CONTRIBUTING.md](CONTRIBUTING.md)

---

## 🏗️ Proje Yapısı / Project Structure

```
src/
  main/
    index.js       — Ana süreç / Main process
    preload.js     — Güvenli köprü / Secure bridge (contextBridge)
    i18n.js        — Çeviriler / Translations
    updater.js     — Otomatik güncelleme / Auto updater
  renderer/
    ui.html        — Arayüz / UI (Dashboard, Library, Settings)
    wallpaper.html — Wallpaper renderer
  templates/       — Hazır şablonlar / Built-in templates
  settings/        — Ayar kalıcılığı / Settings persistence
  workerw/         — Windows WorkerW entegrasyonu / integration
  gamedetect/      — Oyun algılama / Game detection
  monitor/         — Çoklu monitör / Multi-monitor
assets/            — İkonlar / Icons
```

---

## 📄 Lisans / License

[MIT](LICENSE) — Özgürce kullanın, değiştirin, dağıtın.
Free to use, modify and distribute.
