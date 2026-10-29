/* NOVA CUT — Ana sayfadaki hizmet listesi.
   Menüyü berberler panelden yayınlıyor; satırlar ondan üretilir. Bağlantı
   kurulamazsa HTML'deki yedek satırlar olduğu gibi kalır. */

import { HIZMETLER, hizmetleriYukle, sureYaz, kacis } from "./db.js?v=11";

const liste = document.getElementById("hizmetListe");

if (liste && await hizmetleriYukle()) {
  // Yedek satırlar ekranda belirmişse yenileri de görünür doğsun; yoksa
  // kaydırınca belirsinler (main.js).
  const gorunur = !!liste.querySelector(".svc-row.is-visible");

  liste.innerHTML = Object.values(HIZMETLER).map((h, i) => `
    <div class="svc-row reveal${gorunur ? " is-visible" : ""}"${i ? ` style="--d:${(Math.min(i, 6) * 0.05).toFixed(2)}s"` : ""}>
      <span class="idx">${String(i + 1).padStart(2, "0")}</span>
      <div><h3>${kacis(h.ad)}</h3>${h.aciklama ? `<p>${kacis(h.aciklama)}</p>` : ""}</div>
      <div class="price">₺${h.fiyat}<small>Yaklaşık ${sureYaz(h.sure_dk)}</small></div>
    </div>`).join("");

  const satirlar = [...liste.querySelectorAll(".svc-row")];
  if (!gorunur) {
    if (window.NOVA_REVEAL) window.NOVA_REVEAL(satirlar);
    else satirlar.forEach((el) => el.classList.add("is-visible"));
  }
}
