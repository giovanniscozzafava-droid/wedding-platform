-- Abilita il negozio stampe sull'account fotografo di Giovanni (1d0177) per il test/uso.
insert into public.print_shop_settings (professional_id, enabled, products)
values ('1d0177ba-bfd9-4e2e-a997-7201f9273d55', true, array['stampa','maxi','tela','cornice','pannello','autore','set'])
on conflict (professional_id) do update set enabled=true, products=excluded.products, updated_at=now();
