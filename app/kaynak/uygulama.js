/* Nova Cut Berber — yalnızca uygulamada çalışan katman.
 *
 * Panelin kendisi (berber.js) web ile ortak. Burada sadece native olan işler var:
 * bildirim izni ve cihaz kaydı, durum çubuğu, uygulamaya dönünce tazeleme.
 */
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { StatusBar, Style } from "@capacitor/status-bar";
import { App } from "@capacitor/app";
import { db } from "./db.js";

if (Capacitor.isNativePlatform()) {
  baslat();
}

async function baslat() {
  /* ---- Durum çubuğu koyu temaya uysun ---- */
  try {
    await StatusBar.setStyle({ style: Style.Dark });
    if (Capacitor.getPlatform() === "android") {
      await StatusBar.setBackgroundColor({ color: "#0b0a08" });
    }
  } catch { /* bazı cihazlarda desteklenmiyor, önemli değil */ }

  /* ---- Berber giriş yapınca cihazı bildirim için kaydet ---- */
  db.auth.onAuthStateChange((olay, oturum) => {
    if (oturum && (olay === "SIGNED_IN" || olay === "INITIAL_SESSION")) {
      bildirimleriKur().catch((e) => console.error("bildirim kurulamadı:", e));
    }
  });

  /* ---- Uygulamaya geri dönünce randevular tazelensin ----
     Berber telefonu cebine koyup çıkarınca eski listeyi görmesin. */
  App.addListener("appStateChange", ({ isActive }) => {
    if (isActive && document.querySelector("#panelEkrani")?.hidden === false) {
      location.reload();
    }
  });
}

let kuruldu = false;

async function bildirimleriKur() {
  if (kuruldu) return;

  let izin = await PushNotifications.checkPermissions();
  if (izin.receive === "prompt" || izin.receive === "prompt-with-rationale") {
    izin = await PushNotifications.requestPermissions();
  }
  if (izin.receive !== "granted") {
    console.warn("bildirim izni verilmedi");
    return;
  }

  kuruldu = true;

  PushNotifications.addListener("registration", (token) => {
    cihazKaydet(token.value).catch((e) => console.error("cihaz kaydedilemedi:", e));
  });

  PushNotifications.addListener("registrationError", (e) => {
    console.error("bildirim kaydı hatası:", e);
  });

  // Bildirime dokununca paneli tazele ki yeni randevu hemen görünsün.
  PushNotifications.addListener("pushNotificationActionPerformed", () => {
    location.reload();
  });

  await PushNotifications.register();
}

async function cihazKaydet(token) {
  const { data: hesap } = await db
    .from("berber_hesap").select("berber_id").single();
  if (!hesap) return;

  // Aynı cihaz tekrar kaydolabilir; token birincil anahtar olduğu için üzerine yazar.
  const { error } = await db.from("cihazlar").upsert(
    {
      token,
      berber_id: hesap.berber_id,
      platform: Capacitor.getPlatform(),
      son_gorulme: new Date().toISOString(),
    },
    { onConflict: "token" }
  );
  if (error) console.error("cihaz kaydı reddedildi:", error.message);
}
