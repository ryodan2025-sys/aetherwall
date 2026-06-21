# 🌌 AetherWall

**Windows için ücretsiz, açık kaynak canlı duvar kağıdı motoru.**

Video, görsel, HTML/CSS/JS ve GLSL shader duvar kağıtlarını masaüstünüze sabitler.
Kapalı kaynak alternatiflere bağımlı kalmadan, kodun her satırını görebileceğiniz
bir alternatif.

> Kaynak kodu tamamen açık. Hiçbir telemetri, hiçbir gizli ağ isteği yok —
> isteyen herkes `src/` klasörünü satır satır okuyabilir.

---

## 📥 İndirme

[**Releases**](../../releases) sayfasından son sürümü indirin:

- **`AetherWall-Setup-x.x.x.exe`** — Kurulum sihirbazı (önerilen). Başlat menüsü kısayolu, otomatik güncelleme.

### ⚠️ Windows SmartScreen Uyarısı Hakkında

İlk çalıştırmada Windows **"Bilinmeyen Yayımcı"** uyarısı gösterebilir. Bu,
uygulamanın henüz ücretli bir dijital imza sertifikasına sahip olmamasından
kaynaklanır — **kötü amaçlı yazılım anlamına gelmez.**

Devam etmek için: **Daha fazla bilgi → Yine de çalıştır**

Bu projede güvendiğiniz tek şey bizim sözümüz olmak zorunda değil — kaynak kodu
açık, isteyen herkes inceleyip kendi makinesinde derleyebilir
(aşağıdaki [Kaynaktan Derleme](#-kaynaktan-derleme) bölümüne bakın).

---

## ✨ Özellikler

- 🎬 **Video** (MP4, WebM), **Görsel** (JPG, PNG, GIF, WebP), **HTML/CSS/JS** ve **GLSL Shader** duvar kağıtları
- 🎮 **Oyun Algılama** — bilinen oyun veya tam ekran uygulama açılınca otomatik duraklat (40+ oyun dahili tanımlı, özel ekleme desteklenir)
- 🎨 **Windows Renk Uyumu** — duvar kağıdından dominant rengi çekip taskbar accent rengine uygular
- 🌍 **Çoklu Dil** — Türkçe ve İngilizce arayüz
- ⚡ **FPS Limiti** — 15 / 30 / 60 / Limitsiz
- 🖥️ **Çoklu Monitör** — her ekrana farklı duvar kağıdı atayın
- ☀️/🌙 **Açık/Koyu Tema**
- 🔄 **Otomatik Güncelleme**
- 📦 **Hafif** — gereksiz arka plan servisleri kapalı, debounce'lu disk yazımı, lazy thumbnail yükleme

---

## 🛠️ Kaynaktan Derleme

```bash
git clone https://github.com/KULLANICI_ADIN/aetherwall.git
cd aetherwall
npm install
npm start          # geliştirme modu
```

Kendi `.exe`'nizi üretmek için:

```bash
npm run build      # Windows installer + portable (.exe)
npm run build:dir  # sadece klasör çıktısı (hızlı test için)
```

Çıktılar `dist/` klasöründe oluşur.

---

## 🤝 Katkıda Bulunma

PR'lar açık. Büyük değişiklikler öncesi bir issue açıp tartışmanızı öneririz.

---

## 🏗️ Proje Yapısı

```
src/
  main/
    index.js      — Ana süreç (pencereler, IPC, tray)
    preload.js    — Güvenli köprü (contextBridge)
    i18n.js       — Çeviri verileri
    updater.js    — Otomatik güncelleme
  renderer/
    ui.html       — Yönetim arayüzü (Dashboard, Kütüphane, Ayarlar)
    wallpaper.html— Duvar kağıdı renderer
  templates/      — Hazır interaktif şablonlar
  settings/       — Ayar & kütüphane kalıcılığı (debounce'lu disk I/O)
  workerw/        — Windows WorkerW masaüstü entegrasyonu
  gamedetect/     — Oyun/tam ekran algılama
  monitor/        — Çoklu monitör desteği
assets/           — İkon ve installer kaynakları
```

## 🔧 Teknik Notlar

- **WorkerW Yöntemi**: Duvar kağıdı penceresi `SetParent` ile WorkerW'e bağlanır;
  masaüstü simgeleri ve görev çubuğu bunun üzerinde kalır.
- **Güvenlik**: `contextIsolation: true`, `nodeIntegration: false`.
  Renderer ile main süreç arası iletişim yalnızca preload köprüsü üzerinden.
- **Koffi**: Windows API çağrıları için native FFI (koffi paketi).
- **Performans**: Ayarlar in-memory cache + 300ms debounce ile disk'e yazılır;
  oyun algılama tek PowerShell çağrısıyla çalışır (8sn aralık); thumbnail'lar
  IntersectionObserver ile yalnızca görünür olduklarında render edilir.

## 📄 Lisans

[MIT](LICENSE) — istediğiniz gibi kullanın, değiştirin, dağıtın.
