#!/usr/bin/env node
/* Berber randevu sistemini yeni bir markaya kurar.
 *
 *   node kur.mjs <marka.json> <hedef-klasor>
 *
 * Hedef klasör, frontend'i zaten bitmiş sitenin kökü olmalı (index.html'in
 * durduğu yer). Betik oraya randevu sistemini ekler; mevcut tasarıma
 * dokunmaz, sadece panelin ihtiyaç duyduğu CSS değişkenlerini kontrol eder.
 */
import { cp, mkdir, readFile, readdir, writeFile, access } from "node:fs/promises";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const kok = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [, , markaYolu, hedefYolu] = process.argv;

if (!markaYolu || !hedefYolu) {
  console.error("kullanım: node kur.mjs <marka.json> <hedef-klasor>");
  process.exit(1);
}

const m = JSON.parse(await readFile(resolve(markaYolu), "utf8"));
const hedef = resolve(hedefYolu);
const log = (s) => console.log("  " + s);

/* ---------------------------------------------------------------- doğrulama */
const eksik = ["marka_ad", "marka_slug", "app_id", "berberler", "hizmetler"]
  .filter((k) => !m[k]);
if (eksik.length) {
  console.error("marka.json'da eksik alanlar: " + eksik.join(", "));
  process.exit(1);
}
for (const b of m.berberler) {
  if (!/^\+90\d{10}$/.test(b.telefon)) {
    console.error(`${b.id}: telefon +905XXXXXXXXX biçiminde olmalı (${b.telefon})`);
    process.exit(1);
  }
  if (b.sifre && !/^[\x20-\x7E]+$/.test(b.sifre)) {
    console.error(`${b.id}: şifrede ASCII dışı karakter var. Berberin klavyesinden `
      + `çıkmayabilir; sadeleştir.`);
    process.exit(1);
  }
}

/* ---------------------------------------------------------------- üretilenler */
const tirnak = (s) => String(s).replace(/'/g, "''");

const degerler = {
  MARKA_AD: m.marka_ad,
  MARKA_SLUG: m.marka_slug,
  APP_ID: m.app_id,
  APP_AD: m.app_ad || `${m.marka_ad} Berber`,
  SUPABASE_URL: m.supabase_url || "https://BURAYA-PROJE-URL.supabase.co",
  SUPABASE_REF: m.supabase_ref || "BURAYA-PROJE-REF",
  SUPABASE_ANON: m.supabase_anon || "BURAYA-ANON-KEY",
  ACILIS: m.acilis || "10:00",
  KAPANIS: m.kapanis || "21:00",

  BERBER_SATIRLARI: m.berberler
    .map((b) => `  ('${tirnak(b.id)}','${tirnak(b.ad)}','${tirnak(b.telefon)}')`)
    .join(",\n"),

  BERBERLER_JS: m.berberler
    .map((b) => `  ${b.id}: { ad: "${b.ad}", tel: "${b.telefon.replace("+", "")}" },`)
    .join("\n"),

  HIZMETLER_JS: m.hizmetler
    .map((h) => `  ${h.id}: { ad: "${h.ad}", fiyat: ${h.fiyat}, sure_dk: ${h.sure_dk}, `
      + `sure: "${h.sure_dk >= 60 ? h.sure_dk / 60 + " saat" : h.sure_dk + " dk"}" },`)
    .join("\n"),

  HIZMET_SATIRLARI: m.hizmetler
    .map((h) => `  ('${tirnak(h.id)}','${tirnak(h.ad)}',${h.sure_dk},${h.fiyat})`)
    .join(",\n"),

  EPOSTALAR_JS: m.berberler
    .map((b) => `  ${b.id}: "${b.id}@${m.marka_slug}.local",`)
    .join("\n"),

  KAPALI_GUNLER: (m.kapali_gunler || [0]).join(","),
};

const doldur = (s) =>
  s.replace(/\{\{(\w+)\}\}/g, (t, k) => (k in degerler ? degerler[k] : t));

/* ---------------------------------------------------------------- kopyalama */
async function yaz(kaynak, hedefRel) {
  const icerik = await readFile(join(kok, "sablonlar", kaynak), "utf8");
  const yol = join(hedef, hedefRel);
  await mkdir(dirname(yol), { recursive: true });
  await writeFile(yol, doldur(icerik));
  log(hedefRel);
}

async function klasor(kaynak, hedefRel) {
  for (const d of await readdir(join(kok, "sablonlar", kaynak), { withFileTypes: true })) {
    if (d.isDirectory()) await klasor(join(kaynak, d.name), join(hedefRel, d.name));
    else await yaz(join(kaynak, d.name), join(hedefRel, d.name));
  }
}

console.log(`\n${m.marka_ad} — randevu sistemi kuruluyor\n`);

console.log("veritabanı:");
await klasor("sql", "sql");

console.log("\nweb:");
await yaz("web/js/db.js", "js/db.js");
await yaz("web/js/berber.js", "js/berber.js");
await yaz("web/js/randevu.js", "js/randevu.js");
await yaz("web/css/berber.css", "css/berber.css");
await yaz("web/sunucu.py", "sunucu.py");

console.log("\nedge function:");
await yaz("edge/randevu-bildir/index.ts", "supabase/functions/randevu-bildir/index.ts");

console.log("\nuygulama:");
await klasor("app", "app");

/* ---------------------------------------------------------------- kontroller */
console.log("\nkontroller:");

// Panelin beklediği tema değişkenleri sitede tanımlı mı
const GEREKLI = ["--bg", "--bg-card", "--ink", "--ink-soft", "--muted", "--muted-dim",
                 "--line", "--line-strong", "--gold-1", "--gold-2", "--gold-grad",
                 "--font-display", "--font-sans", "--ease"];
try {
  const css = await readFile(join(hedef, "css/style.css"), "utf8");
  const yok = GEREKLI.filter((v) => !css.includes(v + ":"));
  if (yok.length) {
    log(`⚠ css/style.css'te tanımlı olmayan tema değişkenleri: ${yok.join(", ")}`);
    log("  Panel bunları kullanıyor. Markanın renkleriyle tanımla, panel kendini uydurur.");
  } else {
    log("✓ tema değişkenlerinin hepsi tanımlı");
  }
} catch {
  log("⚠ css/style.css bulunamadı — panel CSS'i tema değişkenlerine dayanıyor");
}

// [hidden] tuzağı
try {
  const css = await readFile(join(hedef, "css/style.css"), "utf8");
  if (/\.giris\s*\{[^}]*display\s*:/.test(css) && !css.includes("[hidden]")) {
    log("⚠ display tanımlayan bir kural [hidden]'ı ezebilir — berber.css'teki");
    log("  [hidden]{display:none!important} satırının durduğundan emin ol");
  }
} catch { /* yok say */ }

console.log(`\n  Kurulum bitti. Sıradaki adımlar: ${join(kok, "referans/kurulum-rehberi.md")}\n`);
