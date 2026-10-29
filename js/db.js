/* NOVA CUT — Supabase bağlantısı ve ortak veriler.
   AYAR: Supabase → Project Settings → API sayfasındaki iki değeri aşağıya yapıştır.
   anon key gizli değildir; güvenlik veritabanındaki RLS kurallarıyla sağlanır. */

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

export const SUPABASE_URL = "https://ylfpwgwrjtvypsnhrica.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsZnB3Z3dyanR2eXBzbmhyaWNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY1NDQ4NzcsImV4cCI6MjEwMjEyMDg3N30.KhGBTjvaUwaPlEqT0ci3wXfEKpbajWpiNgzYO_Jp5UQ";

export const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const BERBERLER = {
  huseyin: { ad: "Hüseyin Uzun", tel: "905315274854" },
  halil:   { ad: "Halil İbrahim Kayar", tel: "905454851501" },
};

// Menü berberlerin panelden yayınladığı hâliyle veritabanından gelir
// (hizmetleriYukle). Buradaki üç hizmet yalnızca yedek: bağlantı kurulamazsa
// ya da 09-hizmet-menusu.sql henüz çalıştırılmadıysa site boş kalmasın.
// sure_dk hizmetin gerektirdiği EN AZ süre; randevunun gerçek bitişini
// berberin blok düzeni belirler (bkz. slot_bitisi).
export const HIZMETLER = {
  sac:      { ad: "Saç",         fiyat: 700,  sure_dk: 30, aktif: true,
              aciklama: "Makas ve makine dengesi, yüz hattına göre şekillendirme ve temiz kenar geçişleri." },
  sakal:    { ad: "Sakal",       fiyat: 300,  sure_dk: 30, aktif: true,
              aciklama: "Sakal hatlarının belirginleştirilmesi, bakım ve forma sokma dokunuşları." },
  sacsakal: { ad: "Saç & Sakal", fiyat: 1000, sure_dk: 60, aktif: true,
              aciklama: "Kesim ve sakal tasarımının birlikte tamamlandığı, bütünlüklü bir görünüm." },
};

/** Menüyü veritabanından HIZMETLER'e doldurur. Nesnenin kendisi yerinde
    güncellenir; HIZMETLER[id] diye okuyan her yer yeni hâli görür.
    hepsi: siteden kaldırılanlar da gelsin (panel eski randevuların adını
    göstersin diye). Başarısızsa yedek değerler kalır, false döner. */
export async function hizmetleriYukle({ hepsi = false } = {}) {
  let sorgu = db.from("hizmetler")
    .select("id, ad, aciklama, sure_dk, fiyat, sira, aktif, guncellendi, guncelleyen")
    .not("id", "in", "(kapali,mola)")
    .order("sira").order("id");
  if (!hepsi) sorgu = sorgu.eq("aktif", true);

  const { data, error } = await sorgu;
  if (error || !data?.length) return false;

  for (const k of Object.keys(HIZMETLER)) delete HIZMETLER[k];
  for (const h of data) HIZMETLER[h.id] = h;
  return true;
}

/** 30 -> "30 dk", 60 -> "1 saat", 90 -> "1 saat 30 dk" */
export function sureYaz(dk) {
  const s = Math.floor(dk / 60), d = dk % 60;
  if (!s) return d + " dk";
  return s + " saat" + (d ? " " + d + " dk" : "");
}

/** Berberin yazdığı metin innerHTML'e girmeden önce */
export const kacis = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export const GUNLER  = ["Pazar","Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi"];
export const AYLAR   = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran",
                        "Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];

export const iki = (n) => String(n).padStart(2, "0");
export const tarihAnahtari = (d) =>
  d.getFullYear() + "-" + iki(d.getMonth() + 1) + "-" + iki(d.getDate());

/** '2026-08-15' -> '15 Ağustos Cumartesi' */
export function tarihYaz(anahtar) {
  const d = new Date(anahtar + "T12:00:00+03:00");
  return `${d.getDate()} ${AYLAR[d.getMonth()]} ${GUNLER[d.getDay()]}`;
}

/** '905321112233' -> '0532 111 22 33' */
export function telYaz(tel) {
  const d = String(tel).replace(/\D/g, "").replace(/^90/, "");
  return d.length === 10
    ? `0${d.slice(0,3)} ${d.slice(3,6)} ${d.slice(6,8)} ${d.slice(8)}`
    : tel;
}
