do $$ declare v text; n int; begin
  select s.feed_token::text into v from public.booking_settings s join public.profiles p on p.id=s.professional_id where p.slug='giovanni-scozzafava-fotografo-bf3dd2';
  select count(*) into n from public.bookings b join public.profiles p on p.id=b.professional_id where p.slug='giovanni-scozzafava-fotografo-bf3dd2' and b.client_email like '%@planfully.dev';
  raise notice 'FEED_TOKEN=% TEST_BOOKINGS=%', v, n;
end $$;
