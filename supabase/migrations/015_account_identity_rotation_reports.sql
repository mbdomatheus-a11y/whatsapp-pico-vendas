alter table public.whatsapp_accounts
  add column if not exists phone_number text;

alter table public.whatsapp_accounts
  drop constraint if exists whatsapp_accounts_phone_number_check;
alter table public.whatsapp_accounts
  add constraint whatsapp_accounts_phone_number_check
  check (phone_number is null or phone_number ~ '^55[1-9][0-9]{9,10}$');

create unique index if not exists whatsapp_accounts_org_phone_unique
  on public.whatsapp_accounts (organization_id, phone_number)
  where phone_number is not null;

alter table public.system_settings
  add column if not exists account_rotation_batch_size integer not null default 1
  check (account_rotation_batch_size between 1 and 500);

alter table public.campaigns
  add column if not exists account_rotation_batch_size integer not null default 1
  check (account_rotation_batch_size between 1 and 500);

alter table public.audit_logs
  add column if not exists group_id uuid references public.user_groups(id) on delete set null;

update public.audit_logs a
set group_id = c.group_id
from public.campaigns c
where a.group_id is null
  and a.entity_type = 'campaign'
  and a.entity_id = c.id::text;

create index if not exists audit_logs_org_group_date_idx
  on public.audit_logs (organization_id, group_id, created_at desc);

create index if not exists communication_logs_group_date_idx
  on public.communication_logs (group_id, sent_at desc);

create index if not exists inbound_events_group_date_idx
  on public.inbound_events (group_id, received_at desc);
