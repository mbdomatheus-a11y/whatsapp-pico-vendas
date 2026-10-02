alter table public.message_queue
  add column if not exists message_variant smallint not null default 1
    check (message_variant between 1 and 5);

alter table public.communication_logs
  add column if not exists message_variant smallint not null default 1
    check (message_variant between 1 and 5);

notify pgrst, 'reload schema';
