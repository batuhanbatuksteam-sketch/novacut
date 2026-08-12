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
  halil:   { ad: "Halil",        tel: "905454851501" },
};

// sure_dk veritabanıyla aynı olmalı: slotlar 30 dakikalık.
// Saç ve sakal 1 slot, saç & sakal 2 slot birden kaplar.
export const HIZMETLER = {
  sac:      { ad: "Saç",         fiyat: 800,  sure_dk: 30, sure: "30 dk" },
  sakal:    { ad: "Sakal",       fiyat: 300,  sure_dk: 30, sure: "30 dk" },
  sacsakal: { ad: "Saç & Sakal", fiyat: 1000, sure_dk: 60, sure: "1 saat" },
};

export const SLOT_DK = 30;

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
