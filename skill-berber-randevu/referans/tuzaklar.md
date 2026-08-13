# Tuzaklar

Bunların hepsi Nova Cut kurulumunda gerçekten yaşandı ve saatler aldı.
Hepsi **sessiz** arızaydı: hata mesajı yok, ekran normal görünüyor, iş çalışmıyor.

---

## 1. `[hidden]` çalışmıyor, panel giriş ekranının altında açılıyor

**Belirti:** Şifre doğru, giriş başarılı, hata yok — ama ekran değişmiyor.

**Sebep:** Tarayıcının `[hidden] { display: none }` kuralı çok zayıf. Kendi
yazdığın `.giris { display: grid }` onu ezer. Eleman `hidden` işaretli kalır
ama ekranda durur; panel de onun altında açılır.

**Çözüm:** `berber.css`'in başındaki satır:
```css
[hidden] { display: none !important; }
```

**Ders:** `element.hidden` yerine `getComputedStyle(el).display` ile doğrula.
`panelEkrani.hidden === false` testi geçer ama ekranda hiçbir şey görünmez.

---

## 2. `.gitignore`'da satır içi yorum deseni bozar

```gitignore
# YANLIŞ — desen "google-services.json   # Firebase" olur, hiçbir şey eşleşmez
android/app/google-services.json      # Firebase anahtarı

# DOĞRU
# Firebase anahtarı
android/app/google-services.json
```

Ayrıca dosya zaten takip ediliyorsa `.gitignore` etkisiz kalır;
`git rm --cached <dosya>` gerekir. `git check-ignore` takip edilen dosyaları
atladığı için "eşleşmiyor" der ve yanıltır — `--no-index` ile test et.

---

## 3. vercel.json iki şeyi kabul etmiyor

- Header girdilerinde yalnızca `source`, `headers`, `has`, `missing` geçerli.
  `comment` gibi bir alan eklersen deploy **Invalid request** ile reddedilir.
  JSON yorum desteklemez; açıklamayı README'ye yaz.
- `source` düz regex değil **path-to-regexp**. `/(.*\.(html|js|css))` geçersiz.
  `/(.*)` ve düz dosya yolları güvenli.

**Cache-Control kuralı yazma.** Vercel statik dosyaları zaten
`max-age=0, must-revalidate` + ETag ile sunuyor.

---

## 4. iOS'ta bildirim gelmiyor: yanlış push eklentisi

`@capacitor/push-notifications` Android'de **FCM token**, iOS'ta **APNs token**
döndürür. Sunucu FCM ile gönderiyorsa iOS'ta bildirimler sessizce ulaşmaz.

**Çözüm:** iki platformda da FCM token veren `@capacitor-firebase/messaging`.

---

## 5. `firebase/messaging does not resolve to a valid URL`

`@capacitor-firebase/messaging`'in **web** sürümü `firebase/messaging` import
eder. esbuild'de `external` bırakırsan pakette çıplak bir bare specifier kalır,
WebView çözemez ve **tüm modülü** düşürür — cihaz kaydı hiç yapılmaz.

**Çözüm:** external değil, boş modülle karşıla (`hazirla.mjs` içindeki
`firebase-web-bos` eklentisi). Native'de o kod zaten çalışmıyor.

---

## 6. `The default Firebase app has not yet been configured`

iOS'ta `AppDelegate.swift` içine gerekiyor:

```swift
import FirebaseCore
// application(_:didFinishLaunchingWithOptions:) içinde, return'den önce:
FirebaseApp.configure()
```

Bu satır olmadan Messaging token üretmez.

---

## 7. Firebase'de Key ID ≠ Team ID

İkisi de 10 karakter, karıştırılıyor. Yanlışsa APNs jetonu reddeder, bildirim
hatasız kaybolur.

- **Key ID**: `.p8` dosyasının adında → `AuthKey_<KeyID>.p8`
- **Team ID**: Xcode projesindeki `DEVELOPMENT_TEAM`, ya da
  developer.apple.com → Membership details

`.p8` **bir kez** indirilebilir. İndirme başarısız olursa anahtarı revoke edip
yenisini üret. Aynı dosyayı hem development hem production satırına yükle.

---

## 8. Şifrelerde Türkçe karakter

`hüseyinyönetim` gibi bir şifre klavyeden çıkmayabiliyor ve giriş imkânsız hale
geliyor. **Şifreleri ASCII tut**, ayrıca girilen metni sadeleştir:

```js
const TR_ASCII = { "ö":"o","ü":"u","ı":"i","İ":"i","ş":"s","ç":"c","ğ":"g", ... };
const sifreSadelestir = (s) => s.replace(/[öÖüÜıİşŞçÇğĞ]/g, c => TR_ASCII[c]).toLowerCase();
```

Böylece iki yazım da çalışır. Giriş ekranına "Göster" düğmesi koy.

---

## 9. `python3 -m http.server` cache başlığı göndermiyor

Tarayıcı eski JS/CSS'i tutar, değişiklikler görünmez — saatlerce yanlış yerde
hata ararsın. `sunucu.py` bunu `no-store` ile kapatır. Ayrıca JS/CSS
bağlantılarına `?v=N` koy ve her değişiklikte artır.

---

## 10. SQL dosyalarının sırası

`01-kurulum.sql` → `02` → `03` → `04` → `05`. Sonraki dosyalar önceki
fonksiyonların üstüne yazar. `01`'i tekrar çalıştırırsan **hepsini** tekrar
çalıştır, yoksa eski `gun_uygunluk()` yenisini ezer ve çalışma saatleri
yok sayılır.

---

## 11. Mobilde sabit katmanlar

`position: fixed` film grain / vignette katmanları mobilde adres çubuğu inip
kalkarken görünür alanla uyuşmaz; altta aydınlık bir şerit kalır. Kullanma.

---

## 12. Dokunmatikte `:hover` yok

Masaüstündeki hover efektleri mobilde hiç tetiklenmez. Kart ekranın ortasına
gelince sınıf ekle:

```css
@media (hover: none) { .master.odakta .ph img { filter: grayscale(0); } }
```

---

## Test ederken

- **Headless Chrome bu sayfaları kaydıramaz** (`body { overflow-x: hidden }`
  body'yi kaydırma konteyneri yapıyor). Kaydırmaya bağlı davranışı sade bir
  test sayfasında doğrula.
- `--virtual-time-budget` ağ isteklerini beklemez; sabit `setTimeout` yerine
  koşulu yokla.
- macOS'ta `timeout` komutu **yok**; `timeout 90 chrome ...` sessizce çalışmaz.
- Elemanın gizli olduğunu `hidden` ile değil `getComputedStyle` ile doğrula.
