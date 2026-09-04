-- «Sì, creare la fattura importando i dati dal contratto» (Giovanni, 04/09/2026).
--
-- I dati fiscali del cliente sono già sul contratto (client_fiscal_code,
-- client_vat_number, client_address, ecc — li aveva già "Compila con AI dal
-- preventivo"). Qui aggiungo solo dove appoggiare l'esito: quale fattura
-- Fatture in Cloud è nata da quale contratto.
--
-- IVA e metodo di pagamento sono per-azienda (non per-serie): il regime fiscale
-- non cambia da una fattura all'altra. Restano null finché il professionista
-- non li configura (li vede lui nel suo account Fatture in Cloud); creare una
-- fattura senza specificarli è un errore che si vede, non un numero indovinato.

alter table public.fic_connections
  add column if not exists default_vat_id integer,
  add column if not exists default_payment_method_id integer;

alter table public.contracts
  add column if not exists fic_invoice_id       text,
  add column if not exists fic_invoice_number    text,
  add column if not exists fic_invoice_url       text,
  add column if not exists fic_invoice_created_at timestamptz;

comment on column public.contracts.fic_invoice_id is 'id del documento su Fatture in Cloud (issued_documents), se emesso da qui.';

-- Il professionista configura IVA/pagamento una volta (li vede nel suo account
-- Fatture in Cloud); niente UPDATE diretto sui token cifrati, solo questa RPC.
create or replace function public.fic_set_defaults(p_vat_id integer, p_payment_method_id integer)
returns jsonb language sql security definer set search_path = public as $$
  update public.fic_connections
     set default_vat_id = p_vat_id, default_payment_method_id = p_payment_method_id, updated_at = now()
   where professional_id = auth.uid()
  returning jsonb_build_object('ok', true);
$$;
revoke all on function public.fic_set_defaults(integer, integer) from public;
grant execute on function public.fic_set_defaults(integer, integer) to authenticated;
