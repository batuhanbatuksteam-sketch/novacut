# Nova Cut Berber — iOS & Android uygulaması

Berberlerin randevularını telefondan yönettiği uygulama. Web panelinin
(`berber.html`) aynısı; Capacitor ile native kabuğa sarılıyor.

**Tek kaynak ilkesi:** panelin kodu sitede duruyor, burada kopyalanıyor.
Bir hatayı `js/berber.js` içinde düzeltirsen hem site hem iki uygulama düzelir.
Uygulamaya özel olan tek şey `kaynak/` altındaki bildirim ve native katman.

## Uygulamada ne var

- Günlük randevu listesi, bekleyen / onaylı / "mesaj gelmedi" durumları
- Müşteriye tek dokunuşla **arama** ve **WhatsApp**
- Randevu onaylama ve iptal
- Telefonla gelen randevu için yarım saatlik dilim kapatma
- Haftalık çalışma saatleri düzenleyici
- Yeni randevu düşünce **push bildirimi**

Webden tek farkı: uygulamada oturum korunur, her açılışta şifre sorulmaz
(telefonun kendi kilidi var). Webde sorulmaya devam eder.

## Gereken kurulumlar

| Ne | Nereden | Not |
|---|---|---|
| Xcode | Mac App Store | ~10 GB. Sadece iOS için |
| Android Studio | developer.android.com | Java ve SDK'yı da kurar |
| Node | zaten kurulu | v25 |

CocoaPods **gerekmiyor** — Capacitor 8 Swift Package Manager kullanıyor.

## Geliştirme akışı

```bash
cd app
npm run senkron      # paneli www/ içine hazırlar + native projelere kopyalar
npm run ios          # Xcode'da açar
npm run android      # Android Studio'da açar
```

Panelde bir değişiklik yaptığında `npm run senkron` yeterli; sonra Xcode /
Android Studio'dan tekrar çalıştır.

## Firebase (bildirimler için)

Bildirimler Firebase Cloud Messaging üzerinden gidiyor. FCM, iOS tarafında
APNs'e kendisi devrediyor; iki ayrı altyapı kurmaya gerek yok.

1. **console.firebase.google.com** → yeni proje: `nova-cut`
2. **Android uygulaması ekle** → paket adı `tr.com.novacut.berber`
   → `google-services.json` indir → `app/android/app/` içine koy
   *(bu dosya `.gitignore`'da, depoya girmez)*
3. **iOS uygulaması ekle** → bundle id `tr.com.novacut.berber`
   → `GoogleService-Info.plist` indir → Xcode'da App hedefine sürükle
4. **APNs anahtarı:** developer.apple.com → Keys → yeni key, Apple Push
   Notifications service (APNs) işaretli → `.p8` indir.
   Firebase → Proje ayarları → Cloud Messaging → APNs Authentication Key →
   `.p8` dosyasını, Key ID'yi ve Team ID'yi gir.
5. **Servis hesabı:** Firebase → Proje ayarları → Hizmet hesapları →
   "Yeni özel anahtar oluştur" → inen JSON'daki üç alanı Supabase'e gir:

```bash
supabase secrets set \
  FCM_PROJE_ID=<project_id> \
  FCM_ISTEMCI_EPOSTA=<client_email> \
  FCM_OZEL_ANAHTAR="<private_key>"
```

## Edge Function ve tetikleyici

```bash
supabase functions deploy randevu-bildir
```

Sonra Supabase panelinde **Database → Webhooks → Create**:

- Tablo: `randevular`
- Olay: **Insert**
- Tür: Supabase Edge Functions → `randevu-bildir`

Yeni randevu düştüğü anda ilgili berberin telefonuna bildirim gider.

## Xcode'da yapılacaklar

1. `App` hedefi → **Signing & Capabilities**
2. Team olarak Apple Developer hesabını seç
3. **+ Capability** → **Push Notifications** ekle
4. Telefonu USB ile bağla, hedef olarak seç, Run

Ücretsiz hesapla imzalanan uygulama 7 günde bir yenilenmek zorundadır;
Developer Program üyeliğiyle 1 yıl geçerlidir.

## Android APK

Android Studio'da **Build → Build Bundle(s)/APK(s) → Build APK(s)**.
Çıkan dosya: `android/app/build/outputs/apk/debug/app-debug.apk`

Telefona WhatsApp veya kabloyla atıp kurulabilir; "bilinmeyen kaynaklara izin
ver" gerekir. Uzun ömürlü kullanım için release APK'yı imzalamak daha iyidir.

## Uygulama kimliği

`tr.com.novacut.berber` — iki platformda da aynı. Firebase'de ve Xcode'da
bunu birebir aynı yazmak zorundasın, yoksa bildirimler gelmez.
