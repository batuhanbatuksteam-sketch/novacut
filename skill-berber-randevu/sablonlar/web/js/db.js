/* {{MARKA_AD}} — Supabase bağlantısı ve ortak veriler.
   anon key gizli değildir; güvenlik veritabanındaki RLS kurallarıyla sağlanır.
   service_role anahtarı bu depoda HİÇBİR yerde kullanılmaz. */

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

export const SUPABASE_URL = "{{SUPABASE_URL}}";
export const SUPABASE_ANON_KEY = "{{SUPABASE_ANON}}";

export const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const BERBERLER = {
{{BERBERLER_JS}}
};

// sure_dk veritabanıyla aynı olmalı: slotlar 30 dakikalık.
export const HIZMETLER = {
{{HIZMETLER_JS}}
};

export const SLOT_DK = 30;

export const GUNLER = ["Pazar","Pazartesi","Salı","Çarşamba","Perşembe","Cuma","Cumartesi"];
export const AYLAR  = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran",
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
