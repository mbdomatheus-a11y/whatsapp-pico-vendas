alter table public.planning_sessions
  add column if not exists account_mode text not null default 'single'
  check (account_mode in ('single', 'round_robin'));

alter table public.planning_sessions
  add column if not exists whatsapp_account_ids uuid[] not null default '{}'::uuid[];

alter table public.planning_sessions
  add column if not exists account_rotation_batch_size integer not null default 1
  check (account_rotation_batch_size between 1 and 500);

update public.planning_sessions
set whatsapp_account_ids = array[whatsapp_account_id]
where cardinality(whatsapp_account_ids) = 0;

notify pgrst, 'reload schema';
