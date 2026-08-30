create or replace function public.eyis_cron_status()
returns table (jobname text, schedule text, active boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    return;
  end if;
  return query execute
    'select j.jobname::text, j.schedule::text, j.active
       from cron.job j
      where j.jobname like ''eyis%''';
end;
$$;

revoke all on function public.eyis_cron_status() from public;
revoke all on function public.eyis_cron_status() from anon;
revoke all on function public.eyis_cron_status() from authenticated;
grant execute on function public.eyis_cron_status() to service_role;