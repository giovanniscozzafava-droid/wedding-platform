-- ============================================================================
-- Feed: i peer della stessa cerchia di un WP si vedono a vicenda
-- ----------------------------------------------------------------------------
-- Bug: i fornitori della stessa WP non vedevano i post NETWORK degli altri
-- fornitori, anche se appartenevano alla stessa "rete" della capostipite.
--
-- Estende can_see_network_of() con la regola "peers":
--  - Se viewer e author hanno entrambi una collaboration ACTIVE con LO STESSO
--    capostipite (e nessuno dei due è quel capostipite stesso), si vedono.
--
-- Le altre 4 regole precedenti restano invariate:
--   self, collaborations bidi, coppia↔WP, coppia↔fornitori del proprio wedding.
-- ============================================================================

create or replace function can_see_network_of(p_viewer uuid, p_author uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    -- Self
    p_viewer = p_author
    or
    -- WP ↔ fornitore (collaborations ACTIVE, bidirezionale)
    exists (
      select 1 from collaborations c
       where c.status = 'ACTIVE'
         and ((c.capostipite_id = p_author and c.fornitore_id = p_viewer)
           or (c.fornitore_id = p_author and c.capostipite_id = p_viewer))
    )
    or
    -- Coppia ↔ owner del wedding (WP), bidirezionale
    exists (
      select 1
        from wedding_couple_members m
        join calendar_entries e on e.id = m.entry_id
       where m.user_id is not null
         and (
              (m.user_id = p_viewer and e.owner_id = p_author)
           or (m.user_id = p_author and e.owner_id = p_viewer)
         )
    )
    or
    -- Coppia ↔ fornitori del proprio wedding (via quote_items), bidirezionale
    exists (
      select 1
        from wedding_couple_members m
        join calendar_entries e on e.id = m.entry_id
        join quote_items qi     on qi.quote_id = e.quote_id
       where m.user_id is not null
         and e.quote_id is not null
         and qi.supplier_id is not null
         and (
              (m.user_id = p_viewer and qi.supplier_id = p_author)
           or (m.user_id = p_author and qi.supplier_id = p_viewer)
         )
    )
    or
    -- ✨ NUOVO: Peer della stessa cerchia.
    -- viewer e author sono entrambi fornitori (o WP↔fornitore inverso) con una
    -- collaboration ACTIVE verso lo stesso capostipite. Esclude il caso degenere
    -- in cui uno dei due È il capostipite (gia coperto dalla regola 2).
    exists (
      select 1
        from collaborations c1
        join collaborations c2 on c2.capostipite_id = c1.capostipite_id
       where c1.status = 'ACTIVE'
         and c2.status = 'ACTIVE'
         and c1.fornitore_id = p_viewer
         and c2.fornitore_id = p_author
         and c1.fornitore_id <> c2.fornitore_id
    )
$$;
