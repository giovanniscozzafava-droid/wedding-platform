-- WIRING EROSIONE MAGAZZINO: l'evento SVOLTO erode la dispensa automaticamente.
-- La macchina di consumo esiste già ed è completa:
--   fb_consume_event(entry) → fb_explode_menu(menu, coperti)  [applica resa/sfrido via yield_percent]
--                          → fb_consume_fefo(ingrediente, magazzino, qty, entry)  [SCARICO FEFO sui lotti,
--                            first-expired-first-out, con gestione dello stock negativo].
-- Qui aggiungo SOLO l'attivazione automatica alla transizione di stato → SVOLTO, con idempotenza
-- (non scarica due volte lo stesso evento) e best-effort (se il consumo fallisce non blocca l'evento).

create or replace function public.tg_fb_consume_on_svolto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.evento_stato = 'SVOLTO' and (old.evento_stato is distinct from 'SVOLTO') then
    -- idempotenza: se l'evento ha già SCARICO a suo carico, non ripeto
    if not exists (select 1 from public.fb_stock_movements
                   where event_id = new.id and type = 'SCARICO') then
      begin
        perform public.fb_consume_event(new.id);
      exception when others then
        null; -- non bloccare la transizione dell'evento se il consumo magazzino fallisce
      end;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_fb_consume_on_svolto on public.calendar_entries;
create trigger trg_fb_consume_on_svolto
  after update of evento_stato on public.calendar_entries
  for each row execute function public.tg_fb_consume_on_svolto();
