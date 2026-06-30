do $$ declare v text; begin
  select string_agg(jobname||' ['||schedule||']',' , ') into v from cron.job where jobname in ('album-nudge-daily','funnel-daily');
  raise notice 'CRON_JOBS=%', coalesce(v,'(nessuno)');
exception when others then raise notice 'CRON_CHECK_ERR=%', sqlerrm; end $$;
