-- PROVA LOOK — estensione a FIORISTI (allestimento floreale chiesa/location) e PIROTECNICI
-- (spettacolo). Stesso motore: il fornitore carica una foto della location e l'AI ci AGGIUNGE
-- l'allestimento / i fuochi (image-to-image). Nuovi kind 'flowers' e 'pyro'.

-- 1) estendi i CHECK sui kind
alter table public.look_sessions  drop constraint if exists look_sessions_kind_check;
alter table public.look_sessions  add  constraint look_sessions_kind_check  check (kind in ('hair','makeup','flowers','pyro'));
alter table public.look_styles     drop constraint if exists look_styles_kind_check;
alter table public.look_styles     add  constraint look_styles_kind_check     check (kind in ('hair','makeup','flowers','pyro'));

-- 2) gating per mestiere aggiornato: fioraio/allestimenti → flowers · fuochista → pyro
create or replace function public.look_session_create(p_kind text, p_client_label text, p_entry uuid default null)
returns public.look_sessions language plpgsql security definer set search_path = public as $$
declare v_sub text; v_row public.look_sessions;
begin
  if p_kind not in ('hair','makeup','flowers','pyro') then raise exception 'bad_kind'; end if;
  select subrole into v_sub from public.profiles where id = auth.uid();
  if not (is_admin()
          or (p_kind = 'hair'    and v_sub = 'parrucchiere')
          or (p_kind = 'makeup'  and v_sub = 'make_up')
          or (p_kind = 'flowers' and v_sub in ('fioraio','allestimenti'))
          or (p_kind = 'pyro'    and v_sub = 'fuochista')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  insert into public.look_sessions(owner_id, kind, client_label, entry_id)
    values (auth.uid(), p_kind, nullif(p_client_label,''), p_entry)
    returning * into v_row;
  return v_row;
end$$;
grant execute on function public.look_session_create(text, text, uuid) to authenticated;

-- 3) catalogo (idempotente per i due nuovi kind)
delete from public.look_styles where owner_id is null and kind in ('flowers','pyro');
insert into public.look_styles (owner_id, kind, category, label, prompt_fragment, sort) values
-- ══════════════ FIORISTA (flowers) ══════════════
(null,'flowers','stile','Romantico','romantic lush floral style',10),
(null,'flowers','stile','Boho','boho wildflower style',11),
(null,'flowers','stile','Classico elegante','classic elegant floral style',12),
(null,'flowers','stile','Minimal','minimalist floral style',13),
(null,'flowers','stile','Rustico','rustic country floral style',14),
(null,'flowers','stile','Lussuoso','opulent luxurious floral style',15),
(null,'flowers','stile','Mediterraneo','mediterranean greenery style',16),
(null,'flowers','fiori','Rose','roses',20),
(null,'flowers','fiori','Peonie','peonies',21),
(null,'flowers','fiori','Ortensie','hydrangeas',22),
(null,'flowers','fiori','Ranuncoli','ranunculus',23),
(null,'flowers','fiori','Lisianthus','lisianthus',24),
(null,'flowers','fiori','Orchidee','orchids',25),
(null,'flowers','fiori','Girasoli','sunflowers',26),
(null,'flowers','fiori','Fiori di campo','wildflowers',27),
(null,'flowers','fiori','Verde / eucalipto','eucalyptus greenery',28),
(null,'flowers','colori','Bianco & verde','white and green palette',30),
(null,'flowers','colori','Rosa cipria','blush pink palette',31),
(null,'flowers','colori','Rosso passione','deep red palette',32),
(null,'flowers','colori','Pastello','pastel palette',33),
(null,'flowers','colori','Bianco total','all-white palette',34),
(null,'flowers','colori','Colori caldi','warm tones palette',35),
(null,'flowers','colori','Blu & lavanda','blue and lavender palette',36),
(null,'flowers','elementi','Arco floreale','a floral arch',40),
(null,'flowers','elementi','Centrotavola alti','tall table centerpieces',41),
(null,'flowers','elementi','Centrotavola bassi','low table centerpieces',42),
(null,'flowers','elementi','Cascate di fiori','hanging flower installations',43),
(null,'flowers','elementi','Candele','candles',44),
(null,'flowers','elementi','Allestimento altare','altar floral arrangement',45),
(null,'flowers','elementi','Runner floreale','floral table runner',46),
(null,'flowers','ambiente','Navata chiesa','church aisle',50),
(null,'flowers','ambiente','Altare','ceremony altar',51),
(null,'flowers','ambiente','Ingresso','venue entrance',52),
(null,'flowers','ambiente','Tavolo sposi','sweetheart table',53),
(null,'flowers','ambiente','Sala ricevimento','reception hall',54),
(null,'flowers','ambiente','Giardino esterno','outdoor garden',55),
(null,'flowers','preset','Arco romantico bianco','a romantic white-and-green floral arch with roses and eucalyptus',1),
(null,'flowers','preset','Centrotavola boho','boho wildflower low centerpieces with candles, warm tones',2),
(null,'flowers','preset','Altare classico','classic elegant altar arrangement, white flowers and greenery',3),
(null,'flowers','preset','Mediterraneo rustico','rustic mediterranean greenery installation with olive branches and lemons',4),
(null,'flowers','preset','Opulento colori caldi','opulent luxurious arrangement in warm tones, peonies and roses',5),
-- ══════════════ PIROTECNICO (pyro) ══════════════
(null,'pyro','tipo','Fontane','elegant ground fountains',10),
(null,'pyro','tipo','Cascata di fuoco','a fireworks waterfall/cascade',11),
(null,'pyro','tipo','Batteria finale','a grand finale barrage',12),
(null,'pyro','tipo','Fuochi aerei','aerial fireworks bursts in the sky',13),
(null,'pyro','tipo','Cold sparks','cold spark fountains',14),
(null,'pyro','tipo','Scritte di fuoco','fire lettering / fire writing',15),
(null,'pyro','colori','Oro','gold',20),
(null,'pyro','colori','Argento','silver',21),
(null,'pyro','colori','Multicolore','multicolor',22),
(null,'pyro','colori','Rosso','red',23),
(null,'pyro','colori','Blu','blue',24),
(null,'pyro','colori','Verde','green',25),
(null,'pyro','colori','Bianco','white',26),
(null,'pyro','momento','Taglio torta','during the cake cutting',30),
(null,'pyro','momento','Primo ballo','during the first dance',31),
(null,'pyro','momento','Ingresso sposi','at the couple entrance',32),
(null,'pyro','momento','Gran finale','as the grand finale',33),
(null,'pyro','momento','Mezzanotte','at midnight',34),
(null,'pyro','intensita','Soft elegante','soft elegant intensity',40),
(null,'pyro','intensita','Medio','medium intensity',41),
(null,'pyro','intensita','Spettacolare','spectacular full intensity',42),
(null,'pyro','preset','Cascata dorata finale','a spectacular golden fireworks waterfall as grand finale',1),
(null,'pyro','preset','Cold sparks primo ballo','elegant cold spark fountains during the first dance',2),
(null,'pyro','preset','Batteria multicolore','a multicolor aerial fireworks barrage at midnight',3),
(null,'pyro','preset','Fontane taglio torta','elegant gold ground fountains during the cake cutting',4);

do $$
declare v_f int; v_p int;
begin
  select count(*) into v_f from public.look_styles where kind='flowers' and owner_id is null;
  select count(*) into v_p from public.look_styles where kind='pyro' and owner_id is null;
  raise notice 'PROVA LOOK flowers=% pyro=%', v_f, v_p;
end $$;
