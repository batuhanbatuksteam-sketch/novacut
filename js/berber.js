/* NOVA CUT — Berber paneli.
   Berber kendi randevularını görür, onaylar, iptal eder ve saat kapatır.
   Beklemede olan randevular sarı durur: müşteri WhatsApp mesajını göndermemiş olabilir,
   berber tek dokunuşla arar veya WhatsApp'tan yazar. */

import { db, HIZMETLER, iki, tarihAnahtari, telYaz } from "./db.js?v=9";

/** "10:30" -> 630 dakika */
const dkCevir = (s) => {
  const [a, b] = s.split(":").map(Number);
  return a * 60 + b;
};
/** 630 -> "10:30" */
const dkYaz = (d) => iki(Math.floor(d / 60)) + ":" + iki(d % 60);

const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

const GUN_KISA = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
const AY_KISA  = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

let berberId = null;
let berberAdi = "";
let ozelMod = false;          // true: saatlerini kendi yazan berber (Hüseyin)
let seciliGun = new Date();
let randevular = [];          // seçili günün tüm kayıtları (mola dahil)
let gorunenler = [];          // listede gösterilenler (mola hariç)
let bloklar = [];             // seçili günün blokları
let randevuluGunler = new Set();   // gün şeridindeki kırmızı ışıklar

seciliGun.setHours(0, 0, 0, 0);

/* ---------- yardımcılar ---------- */
const istSaat = (iso) =>
  new Date(iso).toLocaleTimeString("tr-TR", {
    timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit",
  });

/** Bir zaman damgasının İstanbul'daki günü: '2026-08-22' */
const istGun = (iso) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(iso));

/** Gün başlangıcı/bitişi — İstanbul saatine göre, UTC ISO olarak */
const gunAraligi = (d) => {
  const a = tarihAnahtari(d);
  const son = new Date(d); son.setDate(son.getDate() + 1);
  return [`${a}T00:00:00+03:00`, `${tarihAnahtari(son)}T00:00:00+03:00`];
};

/** Beklemede olup 30 dakikası dolmuş kayıt = müşteri mesajı göndermemiş */
const suresiGecti = (r) =>
  r.durum === "beklemede" &&
  Date.now() - new Date(r.olusturuldu).getTime() > 30 * 60 * 1000;

function hataYaz(el, mesaj) {
  el.textContent = mesaj || "";
  el.classList.toggle("show", !!mesaj);
}

/* ---------- giriş ---------- */
const girisForm = $("#girisForm");
const girisHata = $("#girisHata");

// Berberler e-posta yazmasın: kim olduğunu seçer, arkada e-postaya çevrilir.
const EPOSTALAR = {
  halil:   "halil@novacut.local",
  huseyin: "huseyin@novacut.local",
};

// Şifre ASCII saklanıyor. Klavyeden "ö/ü/ı/ş/ç/ğ" çıkmayabildiği için
// yazılanı sadeleştiriyoruz: "halilyönetim" de "halilyonetim" de kabul edilsin.
const TR_ASCII = { "ö":"o","Ö":"o","ü":"u","Ü":"u","ı":"i","İ":"i",
                   "ş":"s","Ş":"s","ç":"c","Ç":"c","ğ":"g","Ğ":"g" };
const sifreSadelestir = (s) =>
  s.replace(/[öÖüÜıİşŞçÇğĞ]/g, (c) => TR_ASCII[c]).toLowerCase();

// Son giren kişi hatırlansın — her seferinde seçmesinler.
let seciliBerber = localStorage.getItem("novacut_berber");
if (!EPOSTALAR[seciliBerber]) seciliBerber = null;

function kimCiz() {
  $$(".kim").forEach((b) =>
    b.classList.toggle("secili", b.dataset.berber === seciliBerber));
}

$$(".kim").forEach((b) =>
  b.addEventListener("click", () => {
    seciliBerber = b.dataset.berber;
    kimCiz();
    hataYaz(girisHata, "");
    $("#gSifre").focus();
  }));

kimCiz();

// Ekrandaki sürüm damgası: bu yazı görünüyorsa güncel JS çalışıyor demektir.
const SURUM = "9";
$("#surum").textContent = SURUM;

$("#gozBtn").addEventListener("click", () => {
  const alan = $("#gSifre");
  const gizli = alan.type === "password";
  alan.type = gizli ? "text" : "password";
  $("#gozBtn").textContent = gizli ? "Gizle" : "Göster";
  alan.focus();
});

girisForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  hataYaz(girisHata, "");

  if (!seciliBerber) {
    hataYaz(girisHata, "Önce kim olduğunu seç.");
    return;
  }

  const btn = $("#girisBtn");
  btn.disabled = true; btn.textContent = "Giriş yapılıyor…";

  const { error } = await db.auth.signInWithPassword({
    email: EPOSTALAR[seciliBerber],
    password: sifreSadelestir($("#gSifre").value),
  });

  btn.disabled = false; btn.textContent = "Giriş Yap";
  if (error) {
    hataYaz(girisHata, "Şifre hatalı.");
    $("#gSifre").select();
    return;
  }
  localStorage.setItem("novacut_berber", seciliBerber);

  // Panel açılırken bir şey patlarsa sessiz kalmasın — ekranda görünsün.
  try {
    await panelAc();
  } catch (e) {
    hataYaz(girisHata, "Panel açılamadı: " + (e && e.message ? e.message : e));
    console.error("panelAc hatası:", e);
  }
});

// Hiçbir hata sessizce kaybolmasın.
window.addEventListener("unhandledrejection", (e) => {
  const m = e.reason && (e.reason.message || e.reason);
  hataYaz(girisHata, "Beklenmeyen hata: " + m);
  console.error("yakalanmamış:", e.reason);
});
window.addEventListener("error", (e) => {
  hataYaz(girisHata, "Beklenmeyen hata: " + e.message);
});

$("#cikisBtn").addEventListener("click", async () => {
  await db.auth.signOut();
  location.reload();
});

/* ---------- panel açılışı ---------- */
async function panelAc() {
  const { data: hesap, error } = await db
    .from("berber_hesap").select("berber_id").single();

  if (error || !hesap) {
    hataYaz(girisHata, "Bu hesap bir berbere bağlı değil. Kurulumu tamamlayın.");
    await db.auth.signOut();
    return;
  }

  berberId = hesap.berber_id;

  // slot_dk ve ozel_slot berberin çalışma biçimini belirler:
  // ızgara modunda saatler açılış–kapanış arasından üretilir, özel modda
  // berberin kendi yazdığı bloklardan gelir.
  const { data: b } = await db
    .from("berberler").select("ad, ozel_slot, slot_dk").eq("id", berberId).single();
  berberAdi = b?.ad || "Berber";
  ozelMod   = !!b?.ozel_slot;
  slotDk    = b?.slot_dk || 30;

  $("#berberAdi").textContent = berberAdi;
  $("#girisEkrani").hidden = true;
  $("#panelEkrani").hidden = false;

  // Her berber kendi düzenleyicisini görür: Halil haftalık saat aralığını,
  // Hüseyin blokları tek tek.
  $("#programBlok").hidden = ozelMod;
  $("#bloklarBlok").hidden = !ozelMod;

  gunSeridiCiz();
  if (ozelMod) await sablonYukle();
  else         await programYukle();
  await yenile();
}

/* ---------- gün şeridi ---------- */
/* Randevusu olan günün üstünde kırmızı bir ışık yanar; berber ileri tarihte
   randevusu olduğunu şeride bakar bakmaz görsün. */
function gunSeridiCiz() {
  const el = $("#gunSerit");
  el.innerHTML = "";
  const bugun = new Date(); bugun.setHours(0, 0, 0, 0);

  for (let i = 0; i < 10; i++) {
    const d = new Date(bugun); d.setDate(bugun.getDate() + i);
    const anahtar = tarihAnahtari(d);
    const b = document.createElement("button");
    b.type = "button";
    b.className = "gun-cip" +
      (anahtar === tarihAnahtari(seciliGun) ? " secili" : "") +
      (randevuluGunler.has(anahtar) ? " randevulu" : "");
    b.innerHTML =
      `<span class="g">${i === 0 ? "Bugün" : GUN_KISA[d.getDay()]}</span>` +
      `<span class="n">${d.getDate()}</span>` +
      `<span class="a">${AY_KISA[d.getMonth()]}</span>` +
      (randevuluGunler.has(anahtar)
        ? '<span class="isik" aria-label="Bu gün randevun var"></span>' : "");
    b.addEventListener("click", async () => {
      seciliGun = d;
      gunSeridiCiz();
      await yenile();
    });
    el.appendChild(b);
  }
}

/** Şeritteki 10 günün hangilerinde randevu var? Mola sayılmaz. */
async function gunIsiklariYukle() {
  const bugun = new Date(); bugun.setHours(0, 0, 0, 0);
  const son = new Date(bugun); son.setDate(bugun.getDate() + 10);

  const { data, error } = await db
    .from("randevular")
    .select("baslangic")
    .eq("berber_id", berberId)
    .neq("durum", "iptal")
    .neq("hizmet_id", "mola")
    .gte("baslangic", gunAraligi(bugun)[0])
    .lt("baslangic", gunAraligi(son)[0]);

  randevuluGunler = new Set((error ? [] : data).map((r) => istGun(r.baslangic)));
}

/* ---------- veri ---------- */
async function yenile() {
  const [bas, son] = gunAraligi(seciliGun);
  const [randevuCevap, blokCevap] = await Promise.all([
    db.from("randevular")
      .select("*")
      .eq("berber_id", berberId)
      .neq("durum", "iptal")
      .gte("baslangic", bas)
      .lt("baslangic", son)
      .order("baslangic"),
    db.rpc("slot_bloklari", {
      p_berber: berberId,
      p_tarih: tarihAnahtari(seciliGun),
    }),
    gunIsiklariYukle(),
  ]);

  randevular = randevuCevap.error ? [] : randevuCevap.data;
  // Mola bir randevu değil, sadece kapalı bir yer: listede ve özette görünmez.
  gorunenler = randevular.filter((r) => r.hizmet_id !== "mola");

  // slot_bloklari(bas, son) döndürüyor: "bit" Postgres'te tip adı, kolon olamıyor.
  bloklar = (blokCevap.error ? [] : blokCevap.data).map((b) => ({
    bas: new Date(b.bas),
    bit: new Date(b.son),
    saat: istSaat(b.bas),
    bitSaat: istSaat(b.son),
  }));

  gunSeridiCiz();
  listeCiz();
  ozetCiz();
  izgaraCiz();
}

function ozetCiz() {
  const onayli = gorunenler.filter((r) => r.durum === "onayli").length;
  const bekleyen = gorunenler.filter((r) => r.durum === "beklemede" && !suresiGecti(r)).length;
  const cevapsiz = gorunenler.filter(suresiGecti).length;

  $("#ozet").innerHTML = `
    <div class="ozet-kutu"><b>${onayli}</b><span>Onaylı</span></div>
    <div class="ozet-kutu sari"><b>${bekleyen}</b><span>Bekliyor</span></div>
    <div class="ozet-kutu kirmizi"><b>${cevapsiz}</b><span>Mesaj gelmedi</span></div>`;
}

function listeCiz() {
  const el = $("#liste");

  if (!gorunenler.length) {
    el.innerHTML = '<p class="bos">Bu gün için randevun yok.</p>';
    return;
  }

  el.innerHTML = gorunenler.map((r) => {
    const gecti = suresiGecti(r);
    const durumSinif = r.durum === "onayli" ? "onayli" : (gecti ? "cevapsiz" : "bekliyor");
    const durumYazi  = r.durum === "onayli" ? "Onaylı"
                     : (gecti ? "Mesaj gelmedi" : "Bekliyor");

    // Telefonla alınan randevunun numarası yok; arama/WhatsApp butonu çıkmasın.
    const telefonlu = r.musteri_tel && r.musteri_tel !== "0";
    const hizmet = HIZMETLER[r.hizmet_id]?.ad
                || (r.hizmet_id === "kapali" ? "Telefonla randevu" : r.hizmet_id);
    const detay = telefonlu ? `${hizmet} · ${telYaz(r.musteri_tel)}` : hizmet;

    const waMetin = encodeURIComponent(
      `Merhaba ${r.musteri_ad}, Nova Cut'tan yazıyorum. ` +
      `${istSaat(r.baslangic)} randevunuz için teyit alabilir miyim?`
    );

    return `
      <article class="randevu ${durumSinif}" data-id="${r.id}">
        <div class="r-ust">
          <div class="r-saat">${istSaat(r.baslangic)}<small>${istSaat(r.bitis)}</small></div>
          <span class="r-rozet">${durumYazi}</span>
        </div>
        <div class="r-ad">${r.musteri_ad}</div>
        <div class="r-detay">${detay}</div>

        ${gecti ? '<p class="r-uyari">Müşteri WhatsApp mesajını göndermemiş. Arayıp teyit al.</p>' : ""}

        <div class="r-islem">
          ${telefonlu ? `
          <a class="ikon-btn wa" href="https://wa.me/${r.musteri_tel}?text=${waMetin}"
             target="_blank" rel="noopener">WhatsApp</a>
          <a class="ikon-btn ara" href="tel:+${r.musteri_tel}">Ara</a>` : ""}
          ${r.durum !== "onayli"
            ? `<button class="ikon-btn onay" type="button" data-onay="${r.id}">Onayla</button>`
            : ""}
          <button class="ikon-btn iptal" type="button" data-iptal="${r.id}">İptal</button>
        </div>
      </article>`;
  }).join("");

  $$("[data-onay]", el).forEach((b) =>
    b.addEventListener("click", () => durumDegistir(b.dataset.onay, "onayli")));

  $$("[data-iptal]", el).forEach((b) =>
    b.addEventListener("click", () => {
      if (confirm("Bu randevu iptal edilsin mi? Saat siteden tekrar alınabilir olacak.")) {
        durumDegistir(b.dataset.iptal, "iptal");
      }
    }));
}

async function durumDegistir(id, durum) {
  const { error } = await db.from("randevular").update({ durum }).eq("id", id);
  if (error) { alert("Güncellenemedi, tekrar deneyin."); return; }
  await yenile();
}

/* ---------- blok ızgarası ---------- */
/* Izgara sabit değil: berberin o güne ait blokları neyse o. Halil'de saatlik
   dilimler, Hüseyin'de kendi yazdığı bloklar. */
function izgaraCiz() {
  const el = $("#kapatIzgara");
  el.innerHTML = "";

  if (!bloklar.length) {
    el.innerHTML = '<p class="izgara-bos">Bu gün için blok yok — izin günü olarak ' +
      (ozelMod ? "işaretli ya da o güne hiç blok yazmamışsın." : "işaretli.") +
      ' Aşağıdan değiştirebilirsin.</p>';
    return;
  }

  for (const blok of bloklar) {
    // Bloğa değen bir kayıt varsa o blok kapalıdır.
    const kayit = randevular.find(
      (r) => new Date(r.baslangic) < blok.bit && new Date(r.bitis) > blok.bas);
    const mola = kayit && kayit.hizmet_id === "mola";

    const b = document.createElement("button");
    b.type = "button";
    b.className = "kapat-slot" + (mola ? " mola" : kayit ? " dolu" : "");
    b.innerHTML = `<span class="ks-saat">${blok.saat}</span>` +
                  `<span class="ks-bit">${blok.bitSaat}</span>` +
                  (mola ? '<span class="ks-not">Mola</span>' : "");

    if (mola) {
      b.title = "Molayı kaldır";
      b.addEventListener("click", () => molaKaldir(kayit.id, b));
    } else if (kayit) {
      b.disabled = true;
      b.title = kayit.musteri_ad;
    } else {
      b.title = "Dokun: mola ver ya da telefonla randevu kaydet";
      b.addEventListener("click", () => sayfaAc(blok));
    }
    el.appendChild(b);
  }
}

async function molaKaldir(id, btn) {
  btn.disabled = true;
  const { error } = await db.from("randevular").update({ durum: "iptal" }).eq("id", id);
  if (error) { alert("Açılamadı, tekrar deneyin."); btn.disabled = false; return; }
  await yenile();
}

/* ---------- blok seçenek sayfası ---------- */
/* Eskiden bloğa dokunmak doğrudan "Telefonla randevu" yazıyordu. Artık berber
   ne yaptığını söylüyor: mola mı verdi, yoksa telefondan randevu mu aldı. */
let sayfaBlok = null;
const slotSayfa = $("#slotSayfa");
const sayfaHata = $("#sayfaHata");

function sayfaAc(blok) {
  sayfaBlok = blok;
  $("#sayfaSaat").textContent = blok.saat + " – " + blok.bitSaat;
  $("#sayfaAd").value = "";
  hataYaz(sayfaHata, "");
  slotSayfa.hidden = false;
}

function sayfaKapat() {
  slotSayfa.hidden = true;
  sayfaBlok = null;
}

$$("[data-sayfa-kapat]").forEach((b) => b.addEventListener("click", sayfaKapat));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !slotSayfa.hidden) sayfaKapat();
});

/** Bloğu kapatan kaydı yazar. hizmet: 'mola' | 'kapali'
    Mola butonunun içinde <b>/<small> var; metnini değiştirmiyoruz, sadece
    kilitliyoruz. "Kaydediliyor…" yazısı düz metinli kayıt butonunda çıkıyor. */
async function blokKapat(hizmet, ad) {
  const molaBtn = $("#sayfaMola");
  const kayitBtn = $("#sayfaRandevu");
  const eskiYazi = kayitBtn.textContent;

  molaBtn.disabled = kayitBtn.disabled = true;
  kayitBtn.textContent = "Kaydediliyor…";

  const { error } = await db.from("randevular").insert({
    berber_id: berberId,
    hizmet_id: hizmet,
    musteri_ad: ad,
    musteri_tel: "0",
    baslangic: sayfaBlok.bas.toISOString(),
    bitis: sayfaBlok.bit.toISOString(),
    durum: "onayli",
  });

  molaBtn.disabled = kayitBtn.disabled = false;
  kayitBtn.textContent = eskiYazi;

  if (error) {
    hataYaz(sayfaHata, error.code === "23P01"
      ? "Bu blok az önce doldu."
      : "Kaydedilemedi, tekrar deneyin.");
    return;
  }
  sayfaKapat();
  await yenile();
}

$("#sayfaMola").addEventListener("click", () => {
  if (!sayfaBlok) return;
  blokKapat("mola", "Mola");
});

$("#sayfaRandevu").addEventListener("click", () => {
  if (!sayfaBlok) return;
  const ad = $("#sayfaAd").value.trim();
  if (ad.length < 2) {
    hataYaz(sayfaHata, "Müşterinin adını yaz. Sadece kapatmak istiyorsan Mola'ya bas.");
    $("#sayfaAd").focus();
    return;
  }
  blokKapat("kapali", ad);
});

/* ---------- haftalık çalışma programı (ızgara modu) ---------- */
const GUN_ADI = ["Pazar", "Pazartesi", "Salı", "Çarşamba",
                 "Perşembe", "Cuma", "Cumartesi"];
// Hafta Pazartesi'den başlasın, Pazar sona
const GUN_SIRA = [1, 2, 3, 4, 5, 6, 0];

let slotDk = 30;
let program = [];        // ekrandaki hâli
let programKayitli = ""; // en son kaydedilen hâli (karşılaştırma için)

// 06:00–23:30 arası yarım saatlik adımlar — berber aralığı ince ayarlayabilsin.
const SAAT_SECENEK = Array.from({ length: 36 }, (_, i) => dkYaz(360 + i * 30));

const programImza = (p) =>
  JSON.stringify(p.map((g) => [g.gun, g.acilis, g.kapanis, g.kapali]));

async function programYukle() {
  const { data, error } = await db
    .from("calisma_saatleri")
    .select("gun, acilis, kapanis, kapali")
    .eq("berber_id", berberId);

  if (error || !data) { program = []; return; }

  program = GUN_SIRA.map((g) => {
    const s = data.find((x) => x.gun === g);
    return {
      gun: g,
      acilis:  (s?.acilis  || "10:00:00").slice(0, 5),
      kapanis: (s?.kapanis || "21:00:00").slice(0, 5),
      kapali:  s?.kapali ?? (g === 0),
    };
  });
  programKayitli = programImza(program);
  programCiz();
}

function saatSecimi(deger, sinif, gun, alan) {
  const secenekler = SAAT_SECENEK
    .map((s) => `<option value="${s}"${s === deger ? " selected" : ""}>${s}</option>`)
    .join("");
  return `<select class="${sinif}" data-gun="${gun}" data-alan="${alan}">${secenekler}</select>`;
}

function programCiz() {
  const el = $("#program");
  const sureYazi = slotDk === 60 ? "birer saatlik" : slotDk + " dakikalık";

  el.innerHTML = program.map((g) => {
    const slot = g.kapali ? 0 : Math.max(
      0, Math.floor((dkCevir(g.kapanis) - dkCevir(g.acilis)) / slotDk));

    return `
      <div class="p-gun ${g.kapali ? "kapali" : ""}" data-gun="${g.gun}">
        <div class="p-ad">
          <span>${GUN_ADI[g.gun]}</span>
          <small>${g.kapali ? "İzin günü" : slot + " blok · " + sureYazi}</small>
        </div>

        <div class="p-saatler">
          ${saatSecimi(g.acilis,  "p-sec", g.gun, "acilis")}
          <span class="p-tire">—</span>
          ${saatSecimi(g.kapanis, "p-sec", g.gun, "kapanis")}
        </div>

        <button class="p-anahtar ${g.kapali ? "" : "acik"}" type="button"
                data-toggle="${g.gun}"
                aria-label="${GUN_ADI[g.gun]} ${g.kapali ? "aç" : "kapat"}">
          <span class="p-topuz"></span>
        </button>
      </div>`;
  }).join("");

  $$("[data-toggle]", el).forEach((b) =>
    b.addEventListener("click", () => {
      const g = program.find((x) => x.gun === +b.dataset.toggle);
      g.kapali = !g.kapali;
      programCiz();
    }));

  $$(".p-sec", el).forEach((s) =>
    s.addEventListener("change", () => {
      const g = program.find((x) => x.gun === +s.dataset.gun);
      g[s.dataset.alan] = s.value;
      // Kapanış açılıştan sonra olmak zorunda — kullanıcıyı uğraştırma, düzelt.
      if (dkCevir(g.kapanis) <= dkCevir(g.acilis)) {
        if (s.dataset.alan === "acilis") {
          g.kapanis = dkYaz(Math.min(dkCevir(g.acilis) + slotDk, 23 * 60 + 30));
        } else {
          g.acilis = dkYaz(Math.max(dkCevir(g.kapanis) - slotDk, 0));
        }
      }
      programCiz();
    }));

  programDurumCiz();
}

function programDurumCiz() {
  const degisti = programImza(program) !== programKayitli;
  $("#programKaydet").disabled = !degisti;
  $("#programGeri").disabled = !degisti;
  const d = $("#programDurum");
  d.textContent = degisti ? "Kaydedilmedi" : "Güncel";
  d.className = "program-durum" + (degisti ? " bekliyor" : "");
}

$("#programKaydet").addEventListener("click", async () => {
  const btn = $("#programKaydet");
  btn.disabled = true; btn.textContent = "Kaydediliyor…";

  let hata = null;
  for (const g of program) {
    const { error } = await db.from("calisma_saatleri")
      .update({ acilis: g.acilis, kapanis: g.kapanis, kapali: g.kapali })
      .eq("berber_id", berberId).eq("gun", g.gun);
    if (error) { hata = error; break; }
  }

  btn.textContent = "Kaydet";

  if (hata) {
    alert("Kaydedilemedi: " + hata.message);
    btn.disabled = false;
    return;
  }

  programKayitli = programImza(program);
  programDurumCiz();
  await yenile();          // blok ızgarası da yeni programa uysun
});

$("#programGeri").addEventListener("click", programYukle);

/* ---------- blok düzeni (özel mod — Hüseyin) ---------- */
/* Bloklar slot_sablon'da haftanın gününe göre durur. Site randevu saatlerini
   birebir buradan üretir; 18:27 yazarsa sitede 18:27 çıkar. */
let sablon = [];         // [{gun, kapali, bloklar:[{bas,bit}]}]
let sablonKayitli = "";

const sablonImza = (p) =>
  JSON.stringify(p.map((g) => [g.gun, g.kapali, g.bloklar.map((b) => [b.bas, b.bit])]));

async function sablonYukle() {
  const [cs, ss] = await Promise.all([
    db.from("calisma_saatleri").select("gun, kapali").eq("berber_id", berberId),
    db.from("slot_sablon").select("gun, baslangic, bitis").eq("berber_id", berberId),
  ]);

  const gunler = cs.data || [];
  const sb = ss.data || [];

  // acik: sadece ekran durumu — imzaya girmez, kaydedilmez.
  const acikOlanlar = new Set(sablon.filter((g) => g.acik).map((g) => g.gun));

  sablon = GUN_SIRA.map((g) => ({
    gun: g,
    acik: acikOlanlar.has(g),
    kapali: gunler.find((x) => x.gun === g)?.kapali ?? (g === 0),
    bloklar: sb
      .filter((x) => x.gun === g)
      .map((x) => ({ bas: x.baslangic.slice(0, 5), bit: x.bitis.slice(0, 5) }))
      .sort((a, b) => dkCevir(a.bas) - dkCevir(b.bas)),
  }));

  sablonKayitli = sablonImza(sablon);
  sablonCiz();
}

/** "22 blok · 10:00–21:00" — gün kapalıyken ne olduğunu açmadan görsün. */
function blokOzeti(bloklar) {
  if (!bloklar.length) return "";
  return " · " + bloklar[0].bas + "–" + bloklar[bloklar.length - 1].bit;
}

/* Yedi günün blokları alt alta yüzlerce satır ederdi. Günler kapalı açılır,
   berber hangi günü düzenleyecekse onu açar. */
function sablonCiz() {
  const el = $("#bloklar");

  el.innerHTML = sablon.map((g) => {
    const satirlar = g.bloklar.map((b, i) => `
      <div class="b-satir">
        <input type="time" class="b-saat" data-gun="${g.gun}" data-i="${i}" data-alan="bas" value="${b.bas}" />
        <span class="b-tire">—</span>
        <input type="time" class="b-saat" data-gun="${g.gun}" data-i="${i}" data-alan="bit" value="${b.bit}" />
        <span class="b-sure">${Math.max(0, dkCevir(b.bit) - dkCevir(b.bas))} dk</span>
        <button class="b-sil" type="button" data-sil="${g.gun}" data-i="${i}"
                aria-label="Bloğu sil">✕</button>
      </div>`).join("");

    return `
      <div class="b-gun ${g.kapali ? "kapali" : ""} ${g.acik ? "acik" : ""}" data-gun="${g.gun}">
        <div class="b-ust">
          <button class="b-ad" type="button" data-ac="${g.gun}"
                  aria-expanded="${g.acik ? "true" : "false"}">
            <span class="b-ok" aria-hidden="true"></span>
            <span class="b-ad-yazi">
              <span>${GUN_ADI[g.gun]}</span>
              <small>${g.kapali ? "İzin günü"
                     : g.bloklar.length + " blok" + blokOzeti(g.bloklar)}</small>
            </span>
          </button>
          <button class="p-anahtar ${g.kapali ? "" : "acik"}" type="button"
                  data-bkapat="${g.gun}"
                  aria-label="${GUN_ADI[g.gun]} ${g.kapali ? "aç" : "kapat"}">
            <span class="p-topuz"></span>
          </button>
        </div>

        <div class="b-govde"${g.acik ? "" : " hidden"}>
          <div class="b-liste">
            ${satirlar || '<p class="b-bos">Bu güne henüz blok yazmadın.</p>'}
          </div>

          <div class="b-araclar">
            <button class="b-ekle" type="button" data-ekle="${g.gun}">+ Blok ekle</button>
            <div class="b-doldur">
              <span>Hızlı doldur</span>
              <input type="time" class="b-d-bas" value="10:00" aria-label="Başlangıç" />
              <input type="time" class="b-d-bit" value="21:00" aria-label="Bitiş" />
              <input type="number" class="b-d-sure" value="30" min="5" max="240" step="5" aria-label="Blok süresi (dakika)" />
              <button class="b-d-uygula" type="button" data-doldur="${g.gun}">Uygula</button>
            </div>
          </div>
        </div>
      </div>`;
  }).join("");

  $$("[data-ac]", el).forEach((b) =>
    b.addEventListener("click", () => {
      const g = sablon.find((x) => x.gun === +b.dataset.ac);
      g.acik = !g.acik;
      sablonCiz();
    }));

  $$("[data-bkapat]", el).forEach((b) =>
    b.addEventListener("click", () => {
      const g = sablon.find((x) => x.gun === +b.dataset.bkapat);
      g.kapali = !g.kapali;
      sablonCiz();
    }));

  $$("[data-sil]", el).forEach((b) =>
    b.addEventListener("click", () => {
      const g = sablon.find((x) => x.gun === +b.dataset.sil);
      g.bloklar.splice(+b.dataset.i, 1);
      sablonCiz();
    }));

  $$("[data-ekle]", el).forEach((b) =>
    b.addEventListener("click", () => {
      const g = sablon.find((x) => x.gun === +b.dataset.ekle);
      // Yeni blok son bloğun bittiği yerden başlasın; sıfırdan saat aramasın.
      const son = g.bloklar[g.bloklar.length - 1];
      const bas = son ? dkCevir(son.bit) : 10 * 60;
      g.bloklar.push({ bas: dkYaz(Math.min(bas, 23 * 60)),
                       bit: dkYaz(Math.min(bas + 30, 24 * 60 - 1)) });
      sablonCiz();
    }));

  $$("[data-doldur]", el).forEach((b) =>
    b.addEventListener("click", () => {
      const kutu = b.closest(".b-doldur");
      const g = sablon.find((x) => x.gun === +b.dataset.doldur);
      const bas  = dkCevir($(".b-d-bas", kutu).value || "10:00");
      const bit  = dkCevir($(".b-d-bit", kutu).value || "21:00");
      const sure = Math.max(5, +$(".b-d-sure", kutu).value || 30);
      if (bit <= bas) { alert("Bitiş, başlangıçtan sonra olmalı."); return; }

      const yeni = [];
      for (let t = bas; t + sure <= bit; t += sure) {
        yeni.push({ bas: dkYaz(t), bit: dkYaz(t + sure) });
      }
      if (!yeni.length) { alert("Bu aralığa tek blok bile sığmıyor."); return; }
      // Doldurmak, o günün düzenini baştan yazar — yarısı eski yarısı yeni kalmasın.
      g.bloklar = yeni;
      sablonCiz();
    }));

  $$(".b-saat", el).forEach((inp) =>
    inp.addEventListener("change", () => {
      const g = sablon.find((x) => x.gun === +inp.dataset.gun);
      const blok = g.bloklar[+inp.dataset.i];
      if (!inp.value) { sablonCiz(); return; }
      blok[inp.dataset.alan] = inp.value;
      // Bitiş başlangıçtan önce kalmasın.
      if (dkCevir(blok.bit) <= dkCevir(blok.bas)) {
        if (inp.dataset.alan === "bas") {
          blok.bit = dkYaz(Math.min(dkCevir(blok.bas) + 30, 24 * 60 - 1));
        } else {
          blok.bas = dkYaz(Math.max(dkCevir(blok.bit) - 30, 0));
        }
      }
      g.bloklar.sort((a, b) => dkCevir(a.bas) - dkCevir(b.bas));
      sablonCiz();
    }));

  sablonDurumCiz();
}

function sablonDurumCiz() {
  const degisti = sablonImza(sablon) !== sablonKayitli;
  $("#bloklarKaydet").disabled = !degisti;
  $("#bloklarGeri").disabled = !degisti;
  const d = $("#bloklarDurum");
  d.textContent = degisti ? "Kaydedilmedi" : "Güncel";
  d.className = "program-durum" + (degisti ? " bekliyor" : "");
}

/** Kaydetmeden önce: bir gün içinde bloklar üst üste binmemeli. */
function sablonDogrula() {
  for (const g of sablon) {
    const s = [...g.bloklar].sort((a, b) => dkCevir(a.bas) - dkCevir(b.bas));
    for (let i = 0; i < s.length; i++) {
      if (dkCevir(s[i].bit) <= dkCevir(s[i].bas)) {
        return `${GUN_ADI[g.gun]}: ${s[i].bas}–${s[i].bit} bloğunun bitişi başlangıcından sonra olmalı.`;
      }
      if (i > 0 && dkCevir(s[i].bas) < dkCevir(s[i - 1].bit)) {
        return `${GUN_ADI[g.gun]}: ${s[i - 1].bas}–${s[i - 1].bit} ile ` +
               `${s[i].bas}–${s[i].bit} blokları çakışıyor.`;
      }
    }
  }
  return null;
}

$("#bloklarKaydet").addEventListener("click", async () => {
  const hata = sablonDogrula();
  if (hata) { alert(hata); return; }

  const btn = $("#bloklarKaydet");
  btn.disabled = true; btn.textContent = "Kaydediliyor…";

  // İzin günü bilgisi calisma_saatleri'nde, bloklar slot_sablon'da duruyor.
  for (const g of sablon) {
    await db.from("calisma_saatleri")
      .update({ kapali: g.kapali })
      .eq("berber_id", berberId).eq("gun", g.gun);
  }

  const { error: silHata } = await db.from("slot_sablon")
    .delete().eq("berber_id", berberId);

  const satirlar = sablon.flatMap((g) =>
    g.bloklar.map((b) => ({
      berber_id: berberId, gun: g.gun,
      baslangic: b.bas, bitis: b.bit,
    })));

  const { error: ekleHata } = satirlar.length
    ? await db.from("slot_sablon").insert(satirlar)
    : { error: null };

  btn.textContent = "Kaydet";

  if (silHata || ekleHata) {
    // Ekrandaki düzen duruyor: tekrar Kaydet'e basmak yeter.
    alert("Kaydedilemedi: " + (silHata || ekleHata).message +
          "\nDüzenin ekranda duruyor, tekrar Kaydet'e bas.");
    btn.disabled = false;
    return;
  }

  sablonKayitli = sablonImza(sablon);
  sablonDurumCiz();
  await yenile();
});

$("#bloklarGeri").addEventListener("click", sablonYukle);

/* ---------- açılış ----------
   Webde panelde müşteri ad ve telefonları var; linki eline geçen herkes
   girebilmesin diye her açılışta şifre sorulur.

   Uygulamada (NOVA_NATIVE) oturum korunur: telefonun kendi kilidi zaten var
   ve berberin gün içinde onlarca kez şifre yazması işkence olurdu. */
const { data: { session } } = await db.auth.getSession();
if (session) {
  if (window.NOVA_NATIVE) await panelAc();
  else await db.auth.signOut();
}

/* Güvenli tazeleme: açık bir seçenek sayfasının altından ızgarayı değiştirmez.
   Düzenleyicilere (program / blok düzeni) dokunmaz, bu yüzden kaydedilmemiş
   değişiklikler kaybolmaz. */
function tazele() {
  if (berberId && slotSayfa.hidden) yenile();
}

/* Panel açıkken 60 saniyede bir tazele — yeni randevu kendiliğinden düşsün */
setInterval(tazele, 60000);

/* Uygulama katmanı bunu çağırıyor. Eskiden sayfayı baştan yüklüyordu; berber
   blok düzenini yazarken uygulamadan çıkıp dönünce emeği çöpe gidiyordu. */
window.NOVA_TAZELE = tazele;
