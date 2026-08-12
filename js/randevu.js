/* NOVA CUT — Randevu akışı.
   Slotlar Supabase'den okunur; randevu "beklemede" olarak kaydedilir ve
   müşteri WhatsApp'a yönlendirilir. Berber panelden onaylar. */

import { db, BERBERLER, HIZMETLER, iki, tarihAnahtari, tarihYaz } from "./db.js?v=8";

const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

const tl = (n) => "₺" + n;
const GUN_KISA = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
const AY_KISA  = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

const state = { barber: null, service: null, date: null, time: null,
                first: "", last: "", phone: "" };
let current = 1;
let musaitlik = null;          // Map: "18:00" -> true/false
let yukleniyor = false;
let sonWaLinki = "";

const fmtDate = (d) => d.getDate() + " " + AY_KISA[d.getMonth()] + " " + GUN_KISA[d.getDay()];

/* ---------- doluluk ---------- */
async function musaitlikYukle() {
  musaitlik = null;
  if (!state.barber || !state.date) return;
  yukleniyor = true;
  // Süreyi gönderiyoruz: 1 saatlik saç & sakal için iki slot da boş olmalı,
  // yoksa 20:30'a yazılıp kapanışı aşan randevu çıkar.
  const { data, error } = await db.rpc("gun_uygunluk", {
    p_berber: state.barber,
    p_tarih: tarihAnahtari(state.date),
    p_sure_dk: HIZMETLER[state.service]?.sure_dk ?? 30,
  });
  yukleniyor = false;
  // Bağlantı koparsa saatleri açık göstermek çifte randevu demek — kapalı göster.
  musaitlik = new Map((error ? [] : data).map((s) => [s.saat, s.musait]));
}

/* ---------- render ---------- */
function renderDates() {
  const el = $("#dateScroll");
  el.innerHTML = "";
  const today = new Date(); today.setHours(0, 0, 0, 0);
  for (let i = 0; i < 12; i++) {
    const d = new Date(today); d.setDate(today.getDate() + i);
    const b = document.createElement("button");
    b.type = "button"; b.className = "date-chip"; b.dataset.key = tarihAnahtari(d);
    if (state.date && tarihAnahtari(state.date) === tarihAnahtari(d)) b.classList.add("selected");
    b.innerHTML = '<div class="d">' + (i === 0 ? "Bugün" : GUN_KISA[d.getDay()]) +
      '</div><div class="num">' + d.getDate() + '</div><div class="mo">' + AY_KISA[d.getMonth()] + '</div>';
    b.addEventListener("click", async () => {
      state.date = d; state.time = null;
      renderDates(); renderSlots(); refreshNext(); updateSummary();
      await musaitlikYukle();
      renderSlots();
    });
    el.appendChild(b);
  }
}

function renderSlots() {
  const el = $("#slotGrid");
  el.innerHTML = "";
  if (!state.date) {
    el.innerHTML = '<p class="slot-msg">Önce bir gün seçin.</p>'; return;
  }
  if (yukleniyor || musaitlik === null) {
    el.innerHTML = '<p class="slot-msg">Uygun saatler yükleniyor…</p>'; return;
  }
  if (musaitlik.size === 0) {
    el.innerHTML = '<p class="slot-msg">Saatler alınamadı. Sayfayı yenileyip tekrar deneyin.</p>'; return;
  }
  for (const [saat, musait] of musaitlik) {
    const b = document.createElement("button");
    b.type = "button"; b.className = "slot"; b.textContent = saat;
    if (!musait) { b.classList.add("disabled"); b.disabled = true; b.title = "Dolu"; }
    if (state.time === saat) b.classList.add("selected");
    b.addEventListener("click", () => {
      if (b.disabled) return;
      state.time = saat; renderSlots(); refreshNext(); updateSummary();
    });
    el.appendChild(b);
  }
}

const summaryChip = (k, v) =>
  '<span class="summary-chip"><span class="k">' + k + '</span><b>' + v + '</b></span>';

function updateSummary() {
  const bar = $("#summaryBar");
  if (current < 2 || current > 4) { bar.classList.remove("show"); bar.innerHTML = ""; return; }
  let html = "";
  if (state.barber)  html += summaryChip("Berber", BERBERLER[state.barber].ad);
  if (state.service) html += summaryChip("Hizmet", HIZMETLER[state.service].ad + " · " + tl(HIZMETLER[state.service].fiyat));
  if (state.date)    html += summaryChip("Tarih", fmtDate(state.date));
  if (state.time)    html += summaryChip("Saat", state.time);
  bar.innerHTML = html;
  bar.classList.toggle("show", html !== "");
}

function recapHTML(withContact) {
  const rows = [
    ["Berber", state.barber ? BERBERLER[state.barber].ad : "—"],
    ["Hizmet", state.service ? HIZMETLER[state.service].ad : "—"],
    ["Tarih",  state.date ? fmtDate(state.date) : "—"],
    ["Saat",   state.time || "—"],
    ["Ücret",  state.service ? tl(HIZMETLER[state.service].fiyat) : "—"],
  ];
  if (withContact) {
    rows.push(["Ad Soyad", (state.first + " " + state.last).trim() || "—"]);
    rows.push(["Telefon", state.phone || "—"]);
  }
  return '<h4>Randevu Özeti</h4>' + rows.map(
    (r) => '<div class="line"><span>' + r[0] + '</span><b>' + r[1] + '</b></div>'
  ).join("");
}

/* ---------- adımlar ---------- */
const canGoTo = (s) => {
  if (s === 1) return true;
  if (s === 2) return !!state.barber;
  if (s === 3) return state.barber && state.service;
  if (s === 4) return state.barber && state.service && state.date && state.time;
  return false;
};

function updateStepper() {
  $$(".step-node", $("#stepper")).forEach((node) => {
    const s = +node.dataset.step;
    node.classList.toggle("done", current > s);
    node.classList.toggle("active", current === s);
    node.classList.toggle("clickable", s < current && canGoTo(s));
  });
}

function goTo(step) {
  current = step;
  $$(".step").forEach((p) => p.classList.toggle("active", +p.dataset.step === step));
  updateStepper(); updateSummary();
  if (step === 3) { renderDates(); renderSlots(); refreshNext(); }
  if (step === 4) $("#recap").innerHTML = recapHTML(false);
  if (step === 5) $("#confirmRecap").innerHTML = recapHTML(true);
  const anchor = document.querySelector(".booking-head");
  const top = anchor.getBoundingClientRect().top + window.scrollY - 90;
  window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
}

function refreshNext() {
  const btn = $("#toStep4");
  if (btn) btn.disabled = !(state.date && state.time);
}

/* ---------- seçimler ---------- */
function selectBarber(key, advance) {
  state.barber = key;
  musaitlik = null;
  $$(".choice-card").forEach((c) => c.classList.toggle("selected", c.dataset.barber === key));
  if (advance) goTo(2); else updateStepper();
}

$$(".choice-card").forEach((card) =>
  card.addEventListener("click", () => selectBarber(card.dataset.barber, true)));

$$(".service-card").forEach((card) =>
  card.addEventListener("click", async () => {
    state.service = card.dataset.service;
    $$(".service-card").forEach((c) => c.classList.toggle("selected", c === card));
    goTo(3);
    if (state.date) { await musaitlikYukle(); renderSlots(); }
  }));

$$("[data-back]").forEach((b) =>
  b.addEventListener("click", () => goTo(Math.max(1, current - 1))));

$("#toStep4").addEventListener("click", () => { if (canGoTo(4)) goTo(4); });

$$(".step-node", $("#stepper")).forEach((node) =>
  node.addEventListener("click", () => {
    const s = +node.dataset.step;
    if (s < current && canGoTo(s)) goTo(s);
  }));

/* ---------- form ---------- */
const form = $("#bookForm");
form.addEventListener("submit", (e) => e.preventDefault());

const fields = {
  first: { el: $("#fName"),  test: (v) => v.trim().length >= 2 },
  last:  { el: $("#fLast"),  test: (v) => v.trim().length >= 2 },
  phone: { el: $("#fPhone"), test: (v) => /^(?:90)?0?5\d{9}$/.test(v.replace(/\D/g, "")) },
};

function validateField(name, showError) {
  const f = fields[name];
  const ok = f.test(f.el.value);
  const wrap = f.el.closest(".field");
  if (showError) wrap.classList.toggle("invalid", !ok);
  else if (ok) wrap.classList.remove("invalid");
  return ok;
}

Object.keys(fields).forEach((name) => {
  fields[name].el.addEventListener("blur",  () => validateField(name, true));
  fields[name].el.addEventListener("input", () => validateField(name, false));
});

function hataYaz(mesaj) {
  const kutu = $("#formHata");
  kutu.textContent = mesaj || "";
  kutu.classList.toggle("show", !!mesaj);
}

const HATALAR = {
  SAAT_DOLU:        "Bu saat az önce doldu. Lütfen başka bir saat seçin.",
  GECMIS_SAAT:      "Bu saat geçti. Lütfen ileri bir saat seçin.",
  GECERSIZ_TELEFON: "Telefon numarası geçersiz. 05XX XXX XX XX şeklinde girin.",
  GECERSIZ_AD:      "Lütfen ad ve soyadınızı girin.",
};

function waLinkiKur() {
  const b = BERBERLER[state.barber];
  const metin =
`Merhaba, Nova Cut'tan randevu talebim var.

Ad Soyad: ${state.first} ${state.last}
Berber: ${b.ad}
Hizmet: ${HIZMETLER[state.service].ad}
Tarih: ${tarihYaz(tarihAnahtari(state.date))}
Saat: ${state.time}`;
  return `https://wa.me/${b.tel}?text=${encodeURIComponent(metin)}`;
}

const gonderBtn = $("#submitBooking");

gonderBtn.addEventListener("click", async () => {
  hataYaz("");

  let ok = true, firstBad = null;
  Object.keys(fields).forEach((name) => {
    const good = validateField(name, true);
    if (!good && !firstBad) firstBad = fields[name].el;
    ok = ok && good;
  });
  if (!ok) { if (firstBad) firstBad.focus(); return; }

  const onay = $("#waOnay");
  if (onay && !onay.checked) {
    hataYaz("Devam etmek için WhatsApp ile iletişim onayını işaretleyin.");
    return;
  }

  state.first = fields.first.el.value.trim();
  state.last  = fields.last.el.value.trim();
  state.phone = fields.phone.el.value.trim();

  gonderBtn.disabled = true;
  const eskiMetin = gonderBtn.textContent;
  gonderBtn.textContent = "Kaydediliyor…";

  const { error } = await db.rpc("randevu_olustur", {
    p_berber:  state.barber,
    p_hizmet:  state.service,
    p_tarih:   tarihAnahtari(state.date),
    p_saat:    state.time,
    p_ad:      state.first + " " + state.last,
    p_telefon: state.phone,
  });

  gonderBtn.disabled = false;
  gonderBtn.textContent = eskiMetin;

  if (error) {
    const kod = Object.keys(HATALAR).find((k) => error.message.includes(k));
    hataYaz(kod ? HATALAR[kod] : "Randevu kaydedilemedi. Lütfen tekrar deneyin.");
    if (kod === "SAAT_DOLU" || kod === "GECMIS_SAAT") {
      state.time = null;
      await musaitlikYukle();
      goTo(3); renderSlots(); refreshNext();
    }
    return;
  }

  sonWaLinki = waLinkiKur();
  $("#waGonder").href = sonWaLinki;
  goTo(5);
  // Yeni sekme açmak yerine aynı sekmede yönlendiriyoruz;
  // mobilde WhatsApp uygulaması açılır, sayfa arkada kalır.
  setTimeout(() => { window.location.href = sonWaLinki; }, 600);
});

$("#restart").addEventListener("click", () => {
  state.barber = state.service = state.date = state.time = null;
  state.first = state.last = state.phone = "";
  musaitlik = null; sonWaLinki = "";
  form.reset();
  hataYaz("");
  $$(".choice-card, .service-card").forEach((c) => c.classList.remove("selected"));
  $$(".field").forEach((f) => f.classList.remove("invalid"));
  goTo(1);
});

/* ---------- açılış: ?berber= ile ön seçim ---------- */
const pre = new URLSearchParams(location.search).get("berber");
if (pre && BERBERLER[pre]) {
  selectBarber(pre, false);
  goTo(2);
} else {
  updateStepper(); updateSummary();
}
