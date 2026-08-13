-- =====================================================================
-- NOVA CUT — Yeni randevu düşünce Edge Function'ı çağıran tetikleyici
--
-- Supabase panelindeki "Database Webhooks" ekranının yaptığı işin aynısı,
-- ama versiyonlanabilsin diye SQL olarak yazıldı.
--
-- 04-bildirimler.sql'den ve `supabase functions deploy randevu-bildir`
-- komutundan SONRA çalıştırılır.
-- =====================================================================

create extension if not exists pg_net with schema extensions;

-- Fonksiyon JWT doğruluyor; anon anahtarı geçerli bir JWT olduğu için
-- yetki başlığı olarak onu gönderiyoruz. Bu anahtar zaten tarayıcıda açık.
create or replace function randevu_bildirim_tetikle()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_url  text := 'https://ylfpwgwrjtvypsnhrica.supabase.co/functions/v1/randevu-bildir';
  v_anon text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inls'
              || 'ZnB3Z3dyanR2eXBzbmhyaWNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY1NDQ4NzcsImV4'
              || 'cCI6MjEwMjEyMDg3N30.KhGBTjvaUwaPlEqT0ci3wXfEKpbajWpiNgzYO_Jp5UQ';
begin
  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer ' || v_anon
               ),
    body    := jsonb_build_object(
                 'type', 'INSERT',
                 'table', 'randevular',
                 'record', to_jsonb(new)
               ),
    timeout_milliseconds := 5000
  );
  return new;
end;
$$;

drop trigger if exists randevu_bildirim on randevular;
create trigger randevu_bildirim
  after insert on randevular
  for each row
  execute function randevu_bildirim_tetikle();
