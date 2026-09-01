-- =====================================================================
-- NOVA CUT — Saç fiyatı 700 TL
-- Fiyat hem sitede (js/db.js) hem burada yazılı; ikisi de aynı olmalı.
-- =====================================================================

update hizmetler set fiyat = 700 where id = 'sac';

select id, ad, sure_dk, fiyat from hizmetler order by id;
