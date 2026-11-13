-- Run this once in Supabase SQL Editor to stop the already-installed 15-minute archive job.
do $$
declare job_id bigint;
begin
  select jobid into job_id from cron.job where jobname = 'archive-support-chats-every-minute' limit 1;
  if job_id is not null then
    perform cron.unschedule(job_id);
  end if;
end $$;

-- Existing archived conversations remain in the archive. New conversations stay open
-- until an administrator manually archives them.
