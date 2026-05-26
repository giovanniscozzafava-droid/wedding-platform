-- ============================================================================
-- COPY SIMPLIFICATION — Per la fase di lancio, niente prezzi visibili.
-- Tutti i professionisti (WP, Location, Fornitori) usano gratis fino a
-- ottobre 2026. Modello pay-on-success WP + subscription fornitori vengono
-- comunicati direttamente quando sarà il momento.
-- ============================================================================

update beta_status
   set is_beta       = true,
       free_until    = '2026-10-31',
       planned_price = null,
       message_short = 'Gratis per tutti i professionisti fino a ottobre 2026.',
       message_long  = 'Stiamo costruendo insieme il network dei professionisti degli eventi italiani. Fino a ottobre 2026 la piattaforma è completamente gratuita per Wedding Planner, Location, Event Planner e Fornitori. Costruisci il tuo profilo, pubblica i tuoi lavori, ricevi clienti.'
 where role = 'wedding_planner';

update beta_status
   set is_beta       = true,
       free_until    = '2026-10-31',
       planned_price = null,
       message_short = 'Gratis per tutti i professionisti fino a ottobre 2026.',
       message_long  = 'Stiamo costruendo insieme il network dei professionisti degli eventi italiani. Fino a ottobre 2026 la piattaforma è completamente gratuita per Wedding Planner, Location, Event Planner e Fornitori. Costruisci il tuo profilo, pubblica i tuoi lavori, ricevi clienti.'
 where role = 'supplier';
