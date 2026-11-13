create extension if not exists pgcrypto;
create table if not exists public.conversations (
 id uuid primary key default gen_random_uuid(),
 visitor_name text not null default 'Asiakas',
 language text not null default 'fi',
 status text not null default 'open' check (status in ('open','closed')),
 visitor_token_hash text,
 created_at timestamptz not null default now()
);
create table if not exists public.messages (
 id uuid primary key default gen_random_uuid(),
 conversation_id uuid not null references public.conversations(id) on delete cascade,
 sender text not null check (sender in ('customer','agent')),
 body text not null,
 language text not null default 'fi',
 created_at timestamptz not null default now()
);
alter table public.conversations add column if not exists visitor_token_hash text;
create index if not exists messages_conversation_id_idx on public.messages(conversation_id);
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
revoke all on public.conversations from anon, authenticated;
revoke all on public.messages from anon, authenticated;
do $$ begin alter publication supabase_realtime add table public.messages; exception when duplicate_object then null; when duplicate_table then null; end $$;

-- Automatically archive open conversations 15 minutes after creation.
create extension if not exists pg_cron with schema extensions;

create or replace function public.archive_expired_support_conversations()
returns void
language sql
security definer
set search_path = public
as $$
  update public.conversations
  set status = 'closed'
  where status = 'open'
    and created_at <= now() - interval '15 minutes';
$$;

do $$
begin
  if not exists (
    select 1 from cron.job where jobname = 'archive-support-chats-every-minute'
  ) then
    perform cron.schedule(
      'archive-support-chats-every-minute',
      '* * * * *',
      'select public.archive_expired_support_conversations();'
    );
  end if;
end
$$;
