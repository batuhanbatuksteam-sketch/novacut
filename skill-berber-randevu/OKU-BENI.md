# Bu klasör nedir

`~/.claude/skills/berber-randevu/` altındaki skill'in **kopyası**. Depoda
durması için buraya konuldu; Claude'un gerçekten kullandığı sürüm ev
dizinindeki. Şablonlarda değişiklik yaparsan iki tarafı da güncelle:

```bash
cp -R ~/.claude/skills/berber-randevu/. skill-berber-randevu/
```

## Yeni bir berber sitesine kurmak için

Yeni projede Claude'a şunu söylemen yeterli:

> berber-randevu skill'ini kullanarak bu siteye randevu sistemi kur

Claude `SKILL.md`'yi okur, `referans/tuzaklar.md`'yi okur, `marka.json`'u
seninle doldurur ve `scripts/kur.mjs` ile kurar.

Elle yapmak istersen:

```bash
cp ~/.claude/skills/berber-randevu/marka.ornek.json marka.json
# doldur
node ~/.claude/skills/berber-randevu/scripts/kur.mjs marka.json .
```

## İçindekiler

| Yol | Ne |
|---|---|
| `SKILL.md` | Claude'un okuduğu talimat |
| `referans/tuzaklar.md` | Bu kurulumda çarpılan 12 tuzak — en değerli dosya |
| `referans/kurulum-rehberi.md` | Supabase → Firebase → APNs → Xcode → Android, sırayla |
| `marka.ornek.json` | Doldurulacak marka bilgileri |
| `scripts/kur.mjs` | Şablonları markaya uyarlayıp hedefe yazar |
| `sablonlar/sql/` | Veritabanı şeması, güvenlik kuralları, fonksiyonlar |
| `sablonlar/web/` | Panel, randevu akışı, dev sunucusu |
| `sablonlar/app/` | Capacitor uygulaması (iOS + Android) |
| `sablonlar/edge/` | Bildirim gönderen Edge Function |

## Neyi kapsamıyor

Sitenin **tasarımı**. Frontend'i sen bitiriyorsun; skill sadece randevu
sistemini ekliyor. Panel, sitenin CSS değişkenlerini kullanarak kendini
markanın temasına uyduruyor (`SKILL.md`'de liste var).
