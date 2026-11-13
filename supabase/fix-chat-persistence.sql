-- Run once in Supabase Dashboard -> SQL Editor.
-- Safely disable the old automatic 15-minute archive schedule, if it exists.
do $$
declare
  job_id bigint;
begin
  if to_regclass('cron.job') is not null then
    select jobid into job_id
    from cron.job
    where jobname = 'archive-support-chats-every-minute'
    limit 1;

    if job_id is not null then
      perform cron.unschedule(job_id);
    end if;
  end if;
end
$$;

-- Existing conversations keep their current status.
-- New conversations remain open until you archive them manually.
