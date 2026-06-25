do $$ declare v text; lk timestamptz; begin
  select feed_token::text, feed_linked_at into v, lk from public.booking_settings where professional_id='1d0177ba-bfd9-4e2e-a997-7201f9273d55';
  raise notice 'FEED_TOKEN_1D0177=% linked_at=%', v, lk;
end $$;
