create table if not exists public.planning_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  group_id uuid not null references public.user_groups(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  whatsapp_account_id uuid not null references public.whatsapp_accounts(id),
  name text not null check (char_length(name) between 1 and 120),
  weekday text not null check (weekday in ('SEGUNDA','TERÇA','QUARTA','QUINTA','SEXTA','SABADO','DOMINGO')),
  message_template text not null check (char_length(message_template) between 1 and 3000),
  source_file_name text not null,
  segmentation_file_name text,
  preview_payload jsonb not null,
  selected_filters jsonb not null default '{}'::jsonb,
  status text not null default 'preparada' check (status in ('preparada','convertida')),
  campaign_id uuid references public.campaigns(id) on delete set null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.planning_sessions enable row level security;

create index if not exists planning_sessions_group_updated_idx
on public.planning_sessions (group_id, updated_at desc);

create index if not exists planning_sessions_expiry_idx
on public.planning_sessions (expires_at)
where expires_at is not null;
