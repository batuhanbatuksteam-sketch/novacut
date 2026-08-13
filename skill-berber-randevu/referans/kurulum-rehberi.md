# {{MARKA_AD}} — Randevu sistemi kurulum rehberi

Bu dosya `kur.mjs` tarafından markaya göre doldurulur. Sırayla git; her adımın
sonunda "böyle doğrula" satırı var, atlama.

---

## 1 · Supabase projesi

1. supabase.com → yeni proje, bölge **Frankfurt** (İstanbul'a en yakın)
2. Settings → API → **Project URL** ve **anon key**'i kopyala
3. `marka.json` içindeki `supabase_url`, `supabase_ref`, `supabase_anon`
   alanlarını doldur, `kur.mjs`'i tekrar çalıştır

**Şemayı yükle** — SQL Editor'de **sırayla**:

```
sql/01-kurulum.sql
sql/02-calisma-saatleri.sql
sql/03-yarim-saat.sql
sql/04-bildirimler.sql
```

`05-bildirim-tetikleyici.sql`'i şimdilik beklet (Edge Function deploy edilmeden
çalışmaz).

**Doğrula:** `select * from berberler;` iki satır dönmeli.

---

## 2 · Berber hesapları

Authentication → Users → **Add user**, her berber için:

- E-posta: `<berber_id>@{{MARKA_SLUG}}.local`
- Şifre: `marka.json`daki `sifre` (ASCII olmalı)
- **Auto Confirm User** işaretli

Oluşan user id'leri alıp:

```sql
insert into berber_hesap (user_id, berber_id) values
  ('...', '<berber_id>'),
  ('...', '<berber_id>');
```

**Doğrula:** panelden giriş yapılabiliyor mu.

---

## 3 · Siteyi yayına al

1. Kodu GitHub'a at
2. Vercel → Import Project → Framework **Other**, Build ve Output **boş**
3. Deploy

**Doğrula:** `/berber.html` açılıyor, `/sql/` 404 veriyor.

> Vercel Hobby planı **ticari kullanıma kapalı**. Berber dükkânı ticari sayılır.
> Pro'ya geç veya Cloudflare Pages'e taşı (ücretsiz katmanı ticari kullanıma açık).

---

## 4 · Alan adı

Kayıt firmasında nameserver'ları `ns1.vercel-dns.com` / `ns2.vercel-dns.com`
yap, ya da Vercel'in verdiği A kaydını gir. Yayılma 1–48 saat.

**Doğrula:** `dig +short NS <alan>` Vercel'i göstermeli, `curl -I https://<alan>`
200 dönmeli, sertifika Let's Encrypt olmalı.

---

## 5 · Firebase

1. console.firebase.google.com → yeni proje: `{{MARKA_SLUG}}`
2. **iOS uygulaması ekle** → bundle id **`{{APP_ID}}`**
   → `GoogleService-Info.plist` indir
   → Xcode'da `App` klasörüne sürükle, **Add to targets: App** işaretli olsun
3. **Android uygulaması ekle** → paket adı **`{{APP_ID}}`**
   → `google-services.json` → `app/android/app/` içine koy

Firebase'in "SDK ekle / kod yaz" adımlarını **atla**, Capacitor hallediyor.

**Doğrula:** plist App hedefinin Resources aşamasında mı —
```bash
grep -c "GoogleService-Info.plist in Resources" app/ios/App/App.xcodeproj/project.pbxproj
```

---

## 6 · APNs anahtarı

developer.apple.com → Certificates, IDs & Profiles → **Keys** → **+**
→ sadece **Apple Push Notifications service (APNs)** işaretli → Register
→ `.p8` indir (**bir kez indirilebilir**)

Firebase → ⚙️ → **Cloud Messaging** → APNs Authentication Key:

| Alan | Nereden |
|---|---|
| `.p8` dosyası | indirdiğin dosya |
| **Key ID** | dosya adı: `AuthKey_<KeyID>.p8` |
| **Team ID** | `grep DEVELOPMENT_TEAM app/ios/App/App.xcodeproj/project.pbxproj` |

Aynı dosyayı **hem development hem production** satırına yükle.

> Key ID ile Team ID **farklı** değerlerdir. Karıştırırsan bildirim hatasız kaybolur.

---

## 7 · Bildirim sunucusu

Firebase → ⚙️ → **Service accounts** → **Generate new private key** → JSON iner.

```bash
supabase secrets set --project-ref {{SUPABASE_REF}} \
  FCM_PROJE_ID=<project_id> \
  FCM_ISTEMCI_EPOSTA=<client_email> \
  FCM_OZEL_ANAHTAR="<private_key>"

supabase functions deploy randevu-bildir --project-ref {{SUPABASE_REF}}
```

Sonra `sql/05-bildirim-tetikleyici.sql`'i çalıştır.

**Doğrula:** bir randevu oluştur, ardından
```sql
select status_code, content from net._http_response order by id desc limit 1;
```
`{"gonderilen":1,"toplam":1}` görmelisin.

---

## 8 · iOS uygulaması

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
cd app && npm install && npm run ios
```

Xcode'da:
1. `App` hedefi → **Signing & Capabilities** → Team seç
2. **+ Capability** → **Push Notifications**
3. Telefonu bağla, hedef seç, **▶ Run**

Apple sözleşmesi güncellendiyse önce developer.apple.com'da kabul et, yoksa
capability eklenemez.

**Doğrula:** giriş yaptıktan sonra
```sql
select berber_id, platform from cihazlar;
```

---

## 9 · Android APK

```bash
brew install openjdk@21
brew install --cask android-commandlinetools
yes | sdkmanager --licenses
sdkmanager --install "platforms;android-36" "build-tools;36.0.0" "platform-tools"
source app/ortam.sh
cd app && npm run apk
```

Çıktı: `app/android/app/build/outputs/apk/debug/app-debug.apk`

Android Studio gerekmiyor. Debug APK'nın imzası 1 yıl geçerli; kalıcı kullanım
için kendi keystore'unla release APK üret.

---

## 10 · Teslim öncesi

- [ ] Test randevularını sil: `delete from randevular;`
- [ ] Çalışma saatleri doğru mu: `select * from calisma_saatleri;`
- [ ] Her berber kendi randevusunu görüyor, diğerininkini görmüyor
- [ ] Aynı saate iki kişi alınamıyor (iki sekmede dene, biri 409 almalı)
- [ ] Arama ve WhatsApp butonları doğru numaraya gidiyor
- [ ] Bildirim gerçek telefona düşüyor
- [ ] `anon` anahtarla `randevular` tablosu okunamıyor (401 dönmeli)
