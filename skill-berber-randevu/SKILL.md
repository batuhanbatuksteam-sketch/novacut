---
name: berber-randevu
description: Bir berber/kuaför sitesine çalışan randevu sistemi kurar - Supabase veritabanı, WhatsApp yönlendirmeli rezervasyon akışı, berber paneli, ve iOS/Android uygulaması (push bildirimli). Frontend tasarımı hazır olan bir siteye eklenir. "randevu sistemi kur", "berber paneli ekle", "rezervasyon", "berber uygulaması" gibi isteklerde kullan.
---

# Berber randevu sistemi

Nova Cut'ta uçtan uca kurulup canlıya alınmış bir sistemin şablonu. Kodu
**yeniden yazma** — `sablonlar/` altındakileri kopyala, markaya uyarla.

## Önce oku

`referans/tuzaklar.md` — 12 maddelik liste. Hepsi gerçekten yaşandı, hepsi
sessiz arızaydı (hata yok, ekran normal, iş çalışmıyor). Kod yazmadan önce oku;
yoksa aynı saatleri baştan harcarsın.

## Sistem ne yapıyor

Müşteri siteden berber, hizmet ve saat seçer → randevu **beklemede** kaydedilir
ve slot o anda dolar → müşteri WhatsApp'a yönlendirilir, mesaj **ilgili berberin
kendi numarasına** hazır gelir → berber panelden onaylar.

Müşteri mesajı göndermezse 30 dakika sonra kayıt "mesaj gelmedi" olur ve slot
kendiliğinden açılır; berber panelde görüp arayabilir.

Slotlar **yarım saatlik**. Saç/sakal 1 dilim, saç+sakal 2 dilim — böylece berber
bir saatlik aralığa iki müşteri alabilir.

**WhatsApp Business API kullanılmıyor.** `wa.me` derin bağlantısı yeterli:
ücretsiz, onay süreci yok, şablon yok. Kullanıcı "otomatik mesaj gitsin" derse
Cloud API'nin maliyetini ve şablon onayını anlat, önce bunu öner.

## Kurulum

```bash
cp ~/.claude/skills/berber-randevu/marka.ornek.json marka.json
# marka.json'u doldur
node ~/.claude/skills/berber-randevu/scripts/kur.mjs marka.json <site-klasoru>
```

Betik SQL'i, web katmanını, Edge Function'ı ve Capacitor uygulamasını hedefe
yazar; telefon biçimini ve şifrelerin ASCII olduğunu doğrular; sitenin tema
değişkenlerini kontrol eder.

Sonra `referans/kurulum-rehberi.md`'yi sırayla uygula — Supabase, Firebase,
APNs, Xcode, Android. Her adımın doğrulama komutu var.

## Markaya uyarlama

**Panel CSS'i yeniden yazma.** `berber.css` sitenin tema değişkenlerini
kullanıyor; markanın renkleriyle bunlar tanımlıysa panel kendini uydurur:

```
--bg  --bg-card  --ink  --ink-soft  --muted  --muted-dim
--line  --line-strong  --gold-1  --gold-2  --gold-grad
--font-display  --font-sans  --ease
```

`--gold-*` isimleri altın çağrıştırsa da marka rengi ne ise odur; sadece
değişken adı. Sitede yoksa `css/style.css`'e ekle.

Değişecek yerler: `marka.json` (isimler, telefonlar, hizmetler, saatler),
uygulama ikonu (`app/assets/icon.png`, logodan üret), `app_id`.

Randevu sayfasının markup'ı sitenin tasarımına ait. `randevu.js` şu seçicileri
bekliyor: `.choice-card[data-barber]`, `.service-card[data-service]`,
`#dateScroll`, `#slotGrid`, `#bookForm`, `#fName`/`#fLast`/`#fPhone`, `#waOnay`,
`#recap`, `#confirmRecap`, `#waGonder`. Tasarım farklıysa bu adları koru ya da
`randevu.js`'teki seçicileri güncelle.

## Değiştirmemen gerekenler

Bunlar güvenliğin ve doğruluğun taşıyıcısı:

- **`cakisma_yok` exclusion constraint** — çifte randevuyu veritabanı engelliyor,
  kod değil. "Önce kontrol et sonra yaz" yaklaşımı aradaki milisaniyede kırılır.
- **Tarayıcı tablolara erişmiyor.** Her şey `gun_uygunluk` ve `randevu_olustur`
  security-definer fonksiyonlarından geçiyor; müşteri ad/telefonu anon'a hiç
  dönmüyor. RLS'i gevşetme.
- **Süre ve çalışma saati kontrolü sunucuda.** Tarayıcıdan gelen süreye güvenme.
- **`[hidden] { display: none !important; }`** — bkz. tuzaklar #1.

## Web ve uygulama tek kaynak

`app/scripts/hazirla.mjs` paneli siteden kopyalayıp `www/`'ye paketler. Panelde
bir düzeltme yapınca site ve iki uygulama birden düzelir. Uygulamaya özel olan
tek şey `app/kaynak/` altındaki native katman (bildirim, güvenli alan, oturum).

Uygulamada oturum korunur (telefonun kendi kilidi var), webde her açılışta şifre
sorulur. Ayrımı `window.NOVA_NATIVE` bayrağı yapıyor.

## Doğrulama

İş bitti demeden önce `referans/kurulum-rehberi.md` sonundaki listeyi geç.
Özellikle: iki sekmede aynı saati almayı dene (biri 409 almalı) ve anon
anahtarla `randevular` tablosunu okumayı dene (401 dönmeli).

Tarayıcı testinde elemanın görünürlüğünü `hidden` ile değil
`getComputedStyle(el).display` ile ölç — bu proje tam olarak o yüzden saatler
kaybetti.
