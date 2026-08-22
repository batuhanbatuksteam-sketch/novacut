# NOVA CUT — Saloon Nova · H&H

Tuzla İçmeler için berber randevu sitesi. Statik HTML/CSS/JS — derleme adımı yok.
Veri tarafı Supabase (Postgres + Auth), barındırma Vercel.

## Nasıl çalışıyor

1. Müşteri siteden berber, hizmet ve saat seçer, adını ve telefonunu yazar.
2. Randevu **beklemede** olarak kaydedilir — slot o anda dolar, çifte randevu olmaz.
3. Müşteri WhatsApp'a yönlendirilir; mesaj **ilgili berberin kendi numarasına** hazır gelir.
4. Berber panelden onaylar. Müşteri mesajı göndermediyse kayıt 30 dakika sonra
   "mesaj gelmedi" olarak işaretlenir ve slot kendiliğinden açılır; berber panelden
   arayıp teyit alabilir.

Dilim uzunluğu **berbere göre** değişir; tek bir sabit yoktur:

- **Halil İbrahim Kayar** — ızgara modu, **birer saatlik** bloklar. Hangi hizmet
  seçilirse seçilsin randevu bir saat yer kaplar.
- **Hüseyin Uzun** — özel blok modu. Bloklarını panelden kendi yazar; istediği
  saati istediği uzunlukta açabilir (`18:27 – 18:55` gibi). Site randevu
  saatlerini birebir bu bloklardan üretir.

Randevu her zaman **blok sınırında** biter, dakikası dakikasına değil. Bir hizmet
tek bloğa sığmıyorsa **bitişik blokları** birden kaplar; araya boşluk bırakılmışsa
o saat verilmez.

"Sığıyor mu" sorusu iki modda farklı ölçülür:

- Izgara modunda ölçü **dakika**. Bloklar zaten eşit uzunlukta olduğu için
  60 dakikalık saç & sakal tam bir saat eder, iki saat değil.
- Özel modda ölçü ayrıca **blok sayısı**: saç ve sakal bir blok, saç & sakal iki
  blok. Berber `18:27 – 18:55` gibi 28 dakikalık bir blok yazdıysa "saçı 28
  dakikada kesiyorum" demektir; nominal 30 dakikaya bakıp o bloğu kapatmak onun
  kendi kararını çöpe atmak olurdu. İki ölçüden hangisi önce karşılanırsa randevu
  orada biter — böylece saatlik bloklar yazdığında saç & sakal iki saat sürmez.

Karar tek yerde, veritabanındaki `slot_bitisi` fonksiyonunda verilir — site ve
panel aynı sonucu görür.

## Sayfalar

| Dosya | Ne |
|---|---|
| `index.html` | Ana sayfa |
| `randevu.html` | 4 adımlı randevu akışı |
| `berber.html` | Berber paneli — şifre ile girilir, arama motorlarına kapalı |

## Yerel çalıştırma

```bash
python3 sunucu.py          # http://localhost:8001
```

`python3 -m http.server` **kullanma** — cache başlığı göndermediği için tarayıcı eski
JS/CSS dosyalarını tutar ve değişiklikleri görmezsin. `sunucu.py` bunu kapatır.

## Veritabanı kurulumu

Supabase SQL Editor'de **sırayla**:

1. `sql/kurulum.sql` — tablolar, güvenlik kuralları, randevu fonksiyonu
2. `sql/02-calisma-saatleri.sql` — haftalık program, uygunluk fonksiyonu
3. `sql/03-yarim-saat.sql` — yarım saatlik slotlar
4. `sql/04-bildirimler.sql` — cihaz kayıtları, push bildirim metni
5. `sql/05-bildirim-tetikleyici.sql` — yeni randevuda Edge Function'ı çağırır
6. `sql/06-esnek-slotlar.sql` — berbere özel blok düzeni, mola kaydı

Sıra önemli: sonraki dosyalar önceki fonksiyonların üstüne yazar.
`kurulum.sql`'i tekrar çalıştırırsan sonrakilerin hepsini de tekrar çalıştır.

Ardından Authentication → Users'tan iki kullanıcı açıp `berber_hesap` tablosuna
bağla (adımlar `kurulum.sql` sonunda yazılı).

## Ayarlar

- `js/db.js` — Supabase URL ve **anon** anahtarı, berber telefonları, hizmet süreleri.
  anon anahtarı gizli değildir; erişim veritabanındaki RLS kurallarıyla kısıtlanır.
  `service_role` anahtarı bu depoda hiçbir yerde kullanılmaz.
- Berber şifreleri Supabase Auth'ta tutulur, kodda yer almaz.

## Güvenlik notları

- Tarayıcı tablolara doğrudan erişemez; her şey `gun_uygunluk` ve `randevu_olustur`
  fonksiyonlarından geçer. Müşteri ad/telefonu anon kullanıcıya hiç dönmez.
- Berber yalnızca kendi randevularını, kendi çalışma programını ve kendi blok
  düzenini görür.
- Panelin iç kayıtları (`mola`, `kapali`) siteden alınamaz: `randevu_olustur`
  bu hizmet kimliklerini reddeder.
- Çakışan randevuyu veritabanı kısıtı (`cakisma_yok`) engeller — kodda değil,
  veritabanında. Aynı anda gelen iki istekte ikincisi reddedilir.

## Statik dosya sürümleri

JS/CSS bağlantılarında `?v=N` var. Dosyaları değiştirince bu numarayı artır,
yoksa ziyaretçilerde eski sürüm kalabilir (`berber.js` içindeki `SURUM` sabitiyle
birlikte güncelle — panelin altında görünür).

## vercel.json hakkında

`source` alanı düz regex değil **path-to-regexp** kabul ediyor; `/(.*\.(html|js|css))`
gibi bir desen "invalid source pattern" hatası verir. Ayrıca girdilerde yalnızca
`source`, `headers`, `has`, `missing` alanları geçerli — `comment` gibi bir alan
eklenirse deploy reddedilir.

Cache-Control kuralı bilerek yok: Vercel statik dosyaları zaten
`max-age=0, must-revalidate` ile sunup ETag ile doğruluyor, yani eski dosya
takılma sorunu ayar gerektirmiyor.
