-- =====================================================================
-- NOVA CUT — Halil de kendi bloklarını yazsın
--
-- Artık iki berber de AYNI sistemi kullanıyor: saatlerini panelden tek tek
-- kendileri ayarlıyor. Aradaki tek fark başlangıç düzeni:
--
--   Halil   → varsayılan bloklar BİRER SAATLİK (10:00–11:00, 11:00–12:00 …)
--   Hüseyin → varsayılan bloklar yarımşar saatlik
--
-- İkisi de bu düzeni panelden istedikleri gibi değiştirebilir; varsayılan
-- sadece işe başlarken karşılarına çıkan düzendir.
--
-- 06-esnek-slotlar.sql'den SONRA çalıştırılır.
-- =====================================================================

update berberler set ozel_slot = true, slot_dk = 60 where id = 'halil';

-- Halil'in başlangıç düzeni: çalışma saatlerinden birer saatlik bloklar.
-- Bugüne kadar ızgara modunda gördüğü saatlerin birebir aynısı, böylece
-- geçişte ne sitede ne panelde saatler kayar.
insert into slot_sablon (berber_id, gun, baslangic, bitis)
select c.berber_id, c.gun, t::time, (t + interval '60 minutes')::time
from calisma_saatleri c
join berberler b on b.id = c.berber_id
cross join lateral generate_series(
  ('2000-01-01'::date + c.acilis),
  ('2000-01-01'::date + c.kapanis) - interval '60 minutes',
  interval '60 minutes'
) t
where c.berber_id = 'halil'
  and not c.kapali
on conflict do nothing;
