-- album_lab_list espone anche entry_id (serve alla stamperia per esportare lo ZIP via album-zip)
drop function if exists public.album_lab_list();
create function public.album_lab_list()
returns table (id uuid, entry_id uuid, couple_label text, photographer text, format_key text, pages int, copies int, cover jsonb, status text, queue_order int, reject_reason text, created_at timestamptz)
language sql stable security invoker set search_path = public as $$
  select o.id, o.entry_id, o.couple_label, coalesce(p.business_name, p.full_name, 'Fotografo'), o.format_key, o.pages, o.copies, o.cover, o.status, o.queue_order, o.reject_reason, o.created_at
  from public.album_orders o left join public.profiles p on p.id = o.photographer_id
  order by case o.status when 'NEW' then 0 when 'ACCEPTED' then 1 when 'IN_PRODUCTION' then 2 when 'ON_HOLD' then 3 when 'SHIPPED' then 4 else 5 end, o.queue_order, o.created_at;
$$;
grant execute on function public.album_lab_list() to authenticated;
