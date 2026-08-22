-- =====================================================================
-- NOVA CUT — Berbere özel slot düzeni
--
-- İki farklı çalışma biçimi var:
--
--   Halil   → ızgara modu. Açılış–kapanış arası SLOT_DK adımlarla bölünür.
--             Artık 30 değil 60 dakika: her randevu bir saat sürer.
--
--   Hüseyin → özel blok modu. Saatleri ızgara üretmez; hangi bloğu isterse
--             kendi yazar (18:27–18:55 gibi). Bloklar slot_sablon'da durur.
--
-- Önceki dosyalardan SONRA çalıştırılır.
-- =====================================================================

-- ---------------------------------------------------------------- berber ayarı
alter table berberler add column if not exists slot_dk   int     not null default 30;
alter table berberler add column if not exists ozel_slot boolean not null default false;

update berberler set ad = 'Halil İbrahim Kayar' where id = 'halil';

-- Halil: saatlik ızgara. Hüseyin: kendi blokları.
update berberler set slot_dk = 60, ozel_slot = false where id = 'halil';
update berberler set slot_dk = 30, ozel_slot = true  where id = 'huseyin';

-- ---------------------------------------------------------------- özel bloklar
create table if not exists slot_sablon (
  berber_id text not null references berberler(id) on delete cascade,
  gun       int  not null check (gun between 0 and 6),   -- 0 = Pazar
  baslangic time not null,
  bitis     time not null,
  primary key (berber_id, gun, baslangic),
  constraint blok_sirasi check (bitis > baslangic)
);

create index if not exists slot_sablon_ix on slot_sablon (berber_id, gun, baslangic);

-- Hüseyin'in ilk düzeni: bugüne kadarki davranışın aynısı olsun diye
-- çalışma saatlerinden yarım saatlik bloklar üretiliyor. Panelden istediği
-- gibi değiştirecek.
insert into slot_sablon (berber_id, gun, baslangic, bitis)
select c.berber_id, c.gun, t::time, (t + interval '30 minutes')::time
from calisma_saatleri c
join berberler b on b.id = c.berber_id and b.ozel_slot
cross join lateral generate_series(
  ('2000-01-01'::date + c.acilis),
  ('2000-01-01'::date + c.kapanis) - interval '30 minutes',
  interval '30 minutes'
) t
where not c.kapali
on conflict do nothing;

alter table slot_sablon enable row level security;
revoke all on slot_sablon from anon;

-- Berber yalnızca kendi bloklarını görür ve düzenler.
drop policy if exists ss_oku on slot_sablon;
create policy ss_oku on slot_sablon
  for select to authenticated
  using (berber_id in (select berber_id from berber_hesap where user_id = auth.uid()));

drop policy if exists ss_ekle on slot_sablon;
create policy ss_ekle on slot_sablon
  for insert to authenticated
  with check (berber_id in (select berber_id from berber_hesap where user_id = auth.uid()));

drop policy if exists ss_guncelle on slot_sablon;
create policy ss_guncelle on slot_sablon
  for update to authenticated
  using (berber_id in (select berber_id from berber_hesap where user_id = auth.uid()))
  with check (berber_id in (select berber_id from berber_hesap where user_id = auth.uid()));

drop policy if exists ss_sil on slot_sablon;
create policy ss_sil on slot_sablon
  for delete to authenticated
  using (berber_id in (select berber_id from berber_hesap where user_id = auth.uid()));

-- ---------------------------------------------------------------- bloklar
-- Bir günün blokları — iki mod da buradan çıkar. Site de panel de aynı
-- listeyi kullanır ki ekranda görünen saatlerle veritabanı hiç ayrışmasın.
create or replace function slot_bloklari(p_berber text, p_tarih date)
returns table(bas timestamptz, bit timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_ozel    boolean;
  v_slot    int;
  v_acilis  time;
  v_kapanis time;
  v_kapali  boolean;
  v_gun     int := extract(dow from p_tarih);
begin
  select b.ozel_slot, b.slot_dk into v_ozel, v_slot
  from berberler b where b.id = p_berber and b.aktif;
  if v_ozel is null then return; end if;

  select c.acilis, c.kapanis, c.kapali into v_acilis, v_kapanis, v_kapali
  from calisma_saatleri c where c.berber_id = p_berber and c.gun = v_gun;

  -- Kayıt yoksa da izin günü sayılır; uydurma saat üretmeyelim.
  if coalesce(v_kapali, true) then return; end if;

  if v_ozel then
    return query
      select (p_tarih + s.baslangic) at time zone 'Europe/Istanbul',
             (p_tarih + s.bitis)     at time zone 'Europe/Istanbul'
      from slot_sablon s
      where s.berber_id = p_berber and s.gun = v_gun
      order by s.baslangic;
  else
    return query
      select t at time zone 'Europe/Istanbul',
             (t + make_interval(mins => v_slot)) at time zone 'Europe/Istanbul'
      from generate_series(
             p_tarih + v_acilis,
             (p_tarih + v_kapanis) - make_interval(mins => v_slot),
             make_interval(mins => v_slot)
           ) t
      order by t;
  end if;
end;
$$;

-- ---------------------------------------------------------------- bitiş saati
-- Bir bloktan başlayan randevu nerede biter?
--
-- Randevu blok sınırında biter, dakikası dakikasına değil: 60 dakikalık
-- saç & sakal iki yarım saatlik bloğu birden kaplar; Halil'de 30 dakikalık
-- saç, saatlik bloğun tamamını kaplar. Bloklar bitişik değilse (Hüseyin
-- araya boşluk koymuşsa) zincir kırılır ve o saat verilemez.
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
  v_hedef   timestamptz := p_bas + make_interval(mins => p_sure_dk);
  v_son     timestamptz;
  v_basladi boolean := false;
  r         record;
begin
  for r in select * from slot_bloklari(p_berber, p_tarih) loop
    if not v_basladi then
      if r.bas = p_bas then
        v_basladi := true;
        v_son := r.bit;
        if v_son >= v_hedef then return v_son; end if;
      end if;
    else
      if r.bas <> v_son then return null; end if;   -- boşluk var, zincir kırıldı
      v_son := r.bit;
      if v_son >= v_hedef then return v_son; end if;
    end if;
  end loop;
  return null;
end;
$$;

-- ---------------------------------------------------------------- uygunluk
-- Dönüş tipi değişiyor: önce düşmesi gerek.
drop function if exists gun_uygunluk(text, date, int);
drop function if exists gun_uygunluk(text, date);

create or replace function gun_uygunluk(
  p_berber  text,
  p_tarih   date,
  p_sure_dk int default 30
)
returns table(saat text, musait boolean, biter text)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  r     record;
  v_bit timestamptz;
begin
  for r in select * from slot_bloklari(p_berber, p_tarih) loop
    v_bit := slot_bitisi(p_berber, p_tarih, r.bas, p_sure_dk);

    saat  := to_char(r.bas at time zone 'Europe/Istanbul', 'HH24:MI');
    biter := case when v_bit is null then null
                  else to_char(v_bit at time zone 'Europe/Istanbul', 'HH24:MI') end;

    musait := v_bit is not null
      and r.bas > now() + interval '30 minutes'
      and not exists (
        select 1 from randevular x
        where x.berber_id = p_berber
          and x.durum <> 'iptal'
          -- 30 dakikada onaylanmayan "beklemede" kayıt slotu tutmaz
          and not (x.durum = 'beklemede'
                   and x.olusturuldu < now() - interval '30 minutes')
          and tstzrange(x.baslangic, x.bitis) && tstzrange(r.bas, v_bit)
      );

    return next;
  end loop;
end;
$$;

-- ---------------------------------------------------------------- randevu
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

  select sure_dk into v_sure from hizmetler where id = p_hizmet;
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

-- ---------------------------------------------------------------- iç kayıtlar
-- Panelde bloğa dokununca iki seçenek çıkıyor:
--   mola   → yer kapanır, randevu listesinde görünmez, tekrar dokununca açılır
--   kapali → telefonla alınan randevu; berberin yazdığı isimle listede durur
insert into hizmetler (id, ad, sure_dk, fiyat) values
  ('kapali', 'Telefonla Randevu', 30, 0),
  ('mola',   'Mola',              30, 0)
on conflict (id) do update set ad = excluded.ad, fiyat = excluded.fiyat;

-- ---------------------------------------------------------------- yetkiler
grant execute on function gun_uygunluk(text, date, int)                       to anon, authenticated;
grant execute on function randevu_olustur(text, text, date, text, text, text) to anon, authenticated;
-- Panel ızgarayı bundan üretiyor; site zaten gun_uygunluk üzerinden geçiyor.
grant execute on function slot_bloklari(text, date)                           to authenticated;
grant execute on function slot_bitisi(text, date, timestamptz, int)           to authenticated;

-- Artık kullanılmıyor: yerini slot_bitisi aldı.
drop function if exists calisiyor_mu(text, date, time, int);
drop function if exists calisiyor_mu(text, date, time);

-- ---------------------------------------------------------------- bildirim
-- Berber kendi eliyle mola verdiğinde ya da telefonla aldığı randevuyu
-- yazdığında telefonuna "Yeni randevu" bildirimi düşmesin.
drop trigger if exists randevu_bildirim on randevular;
create trigger randevu_bildirim
  after insert on randevular
  for each row
  when (new.hizmet_id not in ('kapali', 'mola'))
  execute function randevu_bildirim_tetikle();
