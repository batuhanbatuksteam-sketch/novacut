-- =====================================================================
-- NOVA CUT — Hizmet menüsü panelden yönetilsin
--
-- Berberler panelden fiyat değiştirir, yeni hizmet ekler, "Siteye Yayınla"
-- der; site (ana sayfa + randevu) menüyü artık buradan okur. Menü salonun
-- ORTAK menüsüdür: iki berber de aynı listeyi görür ve düzenler.
--
-- Yazma yetkisi tabloda değil, tek bir fonksiyonda: hizmet_menusu_yayinla.
-- Böylece doğrulama (ad, fiyat, süre) sunucuda yapılır ve panelin iç
-- kayıtları (kapali, mola) hiçbir şekilde değiştirilemez.
--
-- 08-sac-fiyati.sql'den SONRA çalıştırılır.
-- =====================================================================

-- ---------------------------------------------------------------- kolonlar
alter table hizmetler add column if not exists aciklama    text        not null default '';
alter table hizmetler add column if not exists sira        int         not null default 0;
-- Hizmet silinmez, siteden kaldırılır: eski randevular ona bağlı (FK).
alter table hizmetler add column if not exists aktif       boolean     not null default true;
alter table hizmetler add column if not exists guncellendi timestamptz not null default now();
alter table hizmetler add column if not exists guncelleyen text;

-- Mevcut üç hizmet: sitedeki metinler ve sıra aynen korunuyor.
update hizmetler set sira = 1,
  aciklama = 'Makas ve makine dengesi, yüz hattına göre şekillendirme ve temiz kenar geçişleri.'
where id = 'sac' and aciklama = '';
update hizmetler set sira = 2,
  aciklama = 'Sakal hatlarının belirginleştirilmesi, bakım ve forma sokma dokunuşları.'
where id = 'sakal' and aciklama = '';
update hizmetler set sira = 3,
  aciklama = 'Kesim ve sakal tasarımının birlikte tamamlandığı, bütünlüklü bir görünüm.'
where id = 'sacsakal' and aciklama = '';

-- ---------------------------------------------------------------- yayınla
-- Panel menünün tamamını gönderir; liste sırası sitedeki sıra olur.
--   [{ "id": "sac" | null, "ad": "...", "aciklama": "...",
--      "sure_dk": 30, "fiyat": 700, "aktif": true }, ...]
-- id boşsa yeni hizmet açılır.
--
-- p_beklenen: panelin menüyü yüklediği andaki son yayın zamanı. İki berber
-- aynı anda düzenlerse ikincisi ötekinin yayınını farkında olmadan ezmesin
-- diye MENU_DEGISTI ile reddedilir; panel güncel menüyü yükleyip uyarır.
create or replace function hizmet_menusu_yayinla(p_liste jsonb, p_beklenen timestamptz)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_berber   text;
  v_son      timestamptz;
  v_simdi    timestamptz := now();
  v_sira     int := 0;
  e          jsonb;
  v_id       text;
  v_ad       text;
  v_aciklama text;
  v_sure     int;
  v_fiyat    int;
  v_aktif    boolean;
begin
  select berber_id into v_berber from berber_hesap where user_id = auth.uid();
  if v_berber is null then raise exception 'YETKISIZ'; end if;

  if jsonb_typeof(p_liste) is distinct from 'array' or jsonb_array_length(p_liste) = 0 then
    raise exception 'GECERSIZ_MENU';
  end if;

  -- Aynı anda gelen iki yayın sırayla işlensin.
  perform pg_advisory_xact_lock(hashtext('hizmet_menusu'));

  select max(guncellendi) into v_son
  from hizmetler where id not in ('kapali', 'mola');
  if p_beklenen is not null and v_son is distinct from p_beklenen then
    raise exception 'MENU_DEGISTI';
  end if;

  for e in select * from jsonb_array_elements(p_liste) loop
    v_sira     := v_sira + 1;
    v_id       := nullif(btrim(coalesce(e->>'id', '')), '');
    v_ad       := btrim(coalesce(e->>'ad', ''));
    v_aciklama := left(btrim(coalesce(e->>'aciklama', '')), 200);
    v_aktif    := coalesce((e->>'aktif')::boolean, true);

    if length(v_ad) < 2 or length(v_ad) > 40 then raise exception 'GECERSIZ_AD'; end if;

    if coalesce(e->>'fiyat', '') !~ '^\d{1,6}$' then raise exception 'GECERSIZ_FIYAT'; end if;
    v_fiyat := (e->>'fiyat')::int;

    if coalesce(e->>'sure_dk', '') !~ '^\d{1,3}$' then raise exception 'GECERSIZ_SURE'; end if;
    v_sure := (e->>'sure_dk')::int;
    if v_sure < 5 or v_sure > 480 then raise exception 'GECERSIZ_SURE'; end if;

    if v_id in ('kapali', 'mola') then raise exception 'GECERSIZ_HIZMET'; end if;

    if v_id is null then
      insert into hizmetler (id, ad, aciklama, sure_dk, fiyat, sira, aktif, guncellendi, guncelleyen)
      values ('h_' || substr(md5(gen_random_uuid()::text), 1, 10),
              v_ad, v_aciklama, v_sure, v_fiyat, v_sira, v_aktif, v_simdi, v_berber);
    else
      update hizmetler
         set ad = v_ad, aciklama = v_aciklama, sure_dk = v_sure, fiyat = v_fiyat,
             sira = v_sira, aktif = v_aktif, guncellendi = v_simdi, guncelleyen = v_berber
       where id = v_id;
      if not found then raise exception 'GECERSIZ_HIZMET'; end if;
    end if;
  end loop;

  -- Sitede randevu alınabilecek en az bir hizmet kalmalı.
  if not exists (select 1 from hizmetler where aktif and id not in ('kapali', 'mola')) then
    raise exception 'MENU_BOS';
  end if;

  -- Müşteri iki aynı isimli hizmet görmesin.
  if exists (
    select 1 from hizmetler
    where aktif and id not in ('kapali', 'mola')
    group by lower(ad) having count(*) > 1
  ) then
    raise exception 'AYNI_AD';
  end if;

  return v_simdi;
end;
$$;

revoke all on function hizmet_menusu_yayinla(jsonb, timestamptz) from public, anon;
grant execute on function hizmet_menusu_yayinla(jsonb, timestamptz) to authenticated;

-- ---------------------------------------------------------------- bitiş saati
-- 06'daki sürümle aynı, tek fark blok birimi: eskiden "en kısa hizmet bir
-- blok eder" diye min(sure_dk) okunuyordu. Artık berberler hizmet ekliyor;
-- 15 dakikalık bir hizmet eklenince saç birden iki blok sayılır, Hüseyin'in
-- 28 dakikalık bloklarında saç randevusu verilemez hâle gelirdi. Birim artık
-- sabit: 30 dakika = bir blok (saç ve sakal bir, saç & sakal iki blok).
create or replace function slot_bitisi(
  p_berber  text,
  p_tarih   date,
  p_bas     timestamptz,
  p_sure_dk int
)
returns timestamptz
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ozel    boolean;
  v_birim   constant int := 30;
  v_gereken int;
  v_hedef   timestamptz;
  v_son     timestamptz;
  v_sayi    int := 0;
  v_basladi boolean := false;
  r         record;
begin
  select ozel_slot into v_ozel from berberler where id = p_berber;
  if v_ozel is null then return null; end if;

  v_gereken := greatest(1, ceil(p_sure_dk::numeric / v_birim)::int);
  v_hedef   := p_bas + make_interval(mins => p_sure_dk);

  for r in select * from slot_bloklari(p_berber, p_tarih) loop
    if not v_basladi then
      if r.bas <> p_bas then continue; end if;
      v_basladi := true;
    else
      if r.bas <> v_son then return null; end if;   -- boşluk var, zincir kırıldı
    end if;

    v_son  := r.son;
    v_sayi := v_sayi + 1;

    if v_son >= v_hedef then return v_son; end if;
    if v_ozel and v_sayi >= v_gereken then return v_son; end if;
  end loop;

  return null;
end;
$$;

-- ---------------------------------------------------------------- randevu
-- 06'daki sürümle aynı; siteden kaldırılan hizmete randevu alınamaz.
create or replace function randevu_olustur(
  p_berber  text,
  p_hizmet  text,
  p_tarih   date,
  p_saat    text,
  p_ad      text,
  p_telefon text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bas  timestamptz;
  v_bit  timestamptz;
  v_sure int;
  v_id   uuid;
  v_tel  text;
begin
  v_tel := regexp_replace(p_telefon, '\D', '', 'g');
  v_tel := regexp_replace(v_tel, '^0+', '');
  if v_tel ~ '^5\d{9}$' then v_tel := '90' || v_tel; end if;
  if v_tel !~ '^90\d{10}$' then raise exception 'GECERSIZ_TELEFON'; end if;

  if length(btrim(p_ad)) < 3 then raise exception 'GECERSIZ_AD'; end if;

  select sure_dk into v_sure from hizmetler where id = p_hizmet and aktif;
  if v_sure is null then raise exception 'GECERSIZ_HIZMET'; end if;
  -- Panelin iç kayıtları siteden alınamaz.
  if p_hizmet in ('kapali', 'mola') then raise exception 'GECERSIZ_HIZMET'; end if;

  if not exists (select 1 from berberler where id = p_berber and aktif) then
    raise exception 'GECERSIZ_BERBER';
  end if;

  v_bas := (p_tarih + p_saat::time) at time zone 'Europe/Istanbul';
  if v_bas < now() then raise exception 'GECMIS_SAAT'; end if;

  -- Saat berberin gerçek bir bloğu olmalı ve hizmet o bloğa sığmalı.
  v_bit := slot_bitisi(p_berber, p_tarih, v_bas, v_sure);
  if v_bit is null then raise exception 'CALISMA_DISI'; end if;

  update randevular
     set durum = 'iptal'
   where durum = 'beklemede'
     and olusturuldu < now() - interval '30 minutes';

  insert into randevular
    (berber_id, hizmet_id, musteri_ad, musteri_tel, baslangic, bitis)
  values
    (p_berber, p_hizmet, btrim(p_ad), v_tel, v_bas, v_bit)
  returning id into v_id;

  return v_id;
exception
  when exclusion_violation then
    raise exception 'SAAT_DOLU';
end;
$$;

grant execute on function randevu_olustur(text, text, date, text, text, text) to anon, authenticated;
grant execute on function slot_bitisi(text, date, timestamptz, int)           to authenticated;

select id, ad, sure_dk, fiyat, sira, aktif from hizmetler order by sira, id;
