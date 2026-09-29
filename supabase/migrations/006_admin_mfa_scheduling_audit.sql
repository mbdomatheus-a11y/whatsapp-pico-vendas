create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 100),
  created_at timestamptz not null default now()
);

create table public.user_groups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 100),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

alter table public.user_profiles
  add column full_name text,
  add column phone text,
  add column role text not null default 'consulta' check (role in ('master','admin','operador','consulta')),
  add column organization_id uuid references public.organizations(id),
  add column active boolean not null default true,
  add column mfa_reset_at timestamptz;

create table public.user_group_memberships (
  user_id uuid not null references auth.users(id) on delete cascade,
  group_id uuid not null references public.user_groups(id) on delete cascade,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (user_id, group_id)
);

create table public.system_settings (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  retention_days integer not null default 30 check (retention_days between 0 and 3650),
  delay_min_seconds integer not null default 1 check (delay_min_seconds between 0 and 3600),
  delay_max_seconds integer not null default 30 check (delay_max_seconds between 0 and 3600),
  batch_size integer not null default 100 check (batch_size between 1 and 500),
  batch_pause_minutes integer not null default 10 check (batch_pause_minutes between 0 and 1440),
  timezone text not null default 'America/Sao_Paulo',
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  check (delay_max_seconds >= delay_min_seconds)
);

create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  selected_group_id uuid references public.user_groups(id) on delete set null,
  preferences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.campaigns
  add column group_id uuid references public.user_groups(id),
  add column scheduled_at timestamptz,
  add column confirmation_enabled boolean not null default false,
  add column delay_min_seconds integer,
  add column delay_max_seconds integer,
  add column batch_size integer,
  add column batch_pause_minutes integer;

alter table public.whatsapp_accounts add column organization_id uuid references public.organizations(id);
alter table public.test_recipients add column organization_id uuid references public.organizations(id);

create table public.campaign_attachments (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null check (mime_type in ('application/pdf','image/jpeg','image/png','image/webp')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  created_at timestamptz not null default now()
);

create table public.read_confirmations (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  message_id uuid not null unique references public.message_queue(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.communication_logs (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations(id) on delete set null,
  group_id uuid references public.user_groups(id) on delete set null,
  campaign_id uuid references public.campaigns(id) on delete set null,
  message_id uuid,
  actor_id uuid references auth.users(id) on delete set null,
  recipient_label text,
  destination_masked text,
  message_text text,
  attachment_names text[] not null default '{}',
  provider_id text,
  sent_at timestamptz not null default now(),
  expires_at timestamptz
);

create table public.inbound_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  group_id uuid references public.user_groups(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  event_type text not null check (event_type in ('mensagem','reacao')),
  sender_hash text,
  sender_masked text,
  content text,
  received_at timestamptz not null default now()
);

do $$
declare v_org_id uuid; v_group_id uuid; v_master_id uuid;
begin
  insert into public.organizations (name) values ('Pernambucanas') returning id into v_org_id;
  select id into v_master_id from auth.users where lower(email) = 'matheus.oliveira@pernambucanas.com.br' limit 1;
  insert into public.user_groups (organization_id, name, created_by) values (v_org_id, 'Operacao principal', v_master_id) returning id into v_group_id;
  update public.user_profiles p set organization_id = v_org_id, role = case when p.user_id = v_master_id then 'master' else 'admin' end;
  update public.user_profiles p set full_name = coalesce(nullif(u.raw_user_meta_data->>'name',''), split_part(u.email,'@',1)) from auth.users u where u.id = p.user_id;
  insert into public.user_group_memberships (user_id, group_id, created_by) select id, v_group_id, v_master_id from auth.users on conflict do nothing;
  insert into public.system_settings (organization_id, updated_by) values (v_org_id, v_master_id);
  insert into public.user_preferences (user_id, selected_group_id) select id, v_group_id from auth.users on conflict do nothing;
  update public.campaigns set group_id = v_group_id where public.campaigns.group_id is null;
  update public.whatsapp_accounts set organization_id = v_org_id where organization_id is null;
  update public.test_recipients set organization_id = v_org_id where organization_id is null;
end $$;

alter table public.campaigns alter column group_id set not null;
alter table public.whatsapp_accounts alter column organization_id set not null;
alter table public.test_recipients alter column organization_id set not null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('campaign-attachments','campaign-attachments',false,10485760,array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false, file_size_limit=10485760, allowed_mime_types=excluded.allowed_mime_types;

create or replace function public.handle_new_user_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.user_profiles (user_id, must_change_password, full_name, phone)
  values (new.id, true, coalesce(nullif(new.raw_user_meta_data->>'name',''), split_part(new.email,'@',1)), new.raw_user_meta_data->>'phone')
  on conflict do nothing;
  return new;
end; $$;

alter table public.organizations enable row level security;
alter table public.user_groups enable row level security;
alter table public.user_group_memberships enable row level security;
alter table public.system_settings enable row level security;
alter table public.user_preferences enable row level security;
alter table public.audit_logs enable row level security;
alter table public.campaign_attachments enable row level security;
alter table public.read_confirmations enable row level security;
alter table public.communication_logs enable row level security;
alter table public.inbound_events enable row level security;

create or replace function public.is_group_member(target_group uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_group_memberships where user_id = auth.uid() and group_id = target_group)
$$;
create or replace function public.is_org_admin(target_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_profiles where user_id = auth.uid() and organization_id = target_org and active and role in ('master','admin'))
$$;
revoke all on function public.is_group_member(uuid) from public, anon;
revoke all on function public.is_org_admin(uuid) from public, anon;
grant execute on function public.is_group_member(uuid), public.is_org_admin(uuid) to authenticated;

drop policy if exists "authenticated_read_campaigns" on public.campaigns;
drop policy if exists "authenticated_create_campaigns" on public.campaigns;
drop policy if exists "authenticated_update_campaigns" on public.campaigns;
drop policy if exists "authenticated_read_queue" on public.message_queue;
drop policy if exists "authenticated_create_queue" on public.message_queue;
drop policy if exists "authenticated_manage_accounts" on public.whatsapp_accounts;

create policy "members_read_campaigns" on public.campaigns for select to authenticated using (public.is_group_member(group_id));
create policy "operators_create_campaigns" on public.campaigns for insert to authenticated with check (created_by = auth.uid() and public.is_group_member(group_id));
create policy "creators_update_campaigns" on public.campaigns for update to authenticated using (created_by = auth.uid() and public.is_group_member(group_id)) with check (created_by = auth.uid() and public.is_group_member(group_id));
create policy "members_read_queue" on public.message_queue for select to authenticated using (exists (select 1 from public.campaigns c where c.id = campaign_id and public.is_group_member(c.group_id)));
create policy "creators_create_queue" on public.message_queue for insert to authenticated with check (exists (select 1 from public.campaigns c where c.id = campaign_id and c.created_by = auth.uid() and public.is_group_member(c.group_id)));
create policy "org_read_accounts" on public.whatsapp_accounts for select to authenticated using (organization_id = (select organization_id from public.user_profiles where user_id = auth.uid()));
create policy "org_admin_manage_accounts" on public.whatsapp_accounts for all to authenticated using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));

create policy "users_read_own_preferences" on public.user_preferences for select to authenticated using (user_id = auth.uid());
create policy "users_update_own_preferences" on public.user_preferences for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users_read_memberships" on public.user_group_memberships for select to authenticated using (user_id = auth.uid());
create policy "users_read_groups" on public.user_groups for select to authenticated using (exists (select 1 from public.user_group_memberships m where m.group_id = id and m.user_id = auth.uid()));

create index audit_logs_org_created_idx on public.audit_logs (organization_id, created_at desc);
create index communication_logs_org_sent_idx on public.communication_logs (organization_id, sent_at desc);
create index campaigns_schedule_idx on public.campaigns (scheduled_at) where scheduled_at is not null;
create index confirmations_campaign_idx on public.read_confirmations (campaign_id, confirmed_at);
create index inbound_events_group_received_idx on public.inbound_events (group_id, received_at desc);

drop function if exists public.claim_campaign_message(uuid);
create function public.claim_campaign_message(target_campaign uuid)
returns table(id uuid, telefone text, mensagem text, gerente_id text, idempotency_key text, instance_name text, campaign_id uuid, group_id uuid, confirmation_enabled boolean)
language plpgsql security definer set search_path = '' as $$
declare claimed_record record;
begin
  with next_item as (
    select q.id
    from public.message_queue q
    join public.campaigns c on c.id = q.campaign_id
    where q.campaign_id = target_campaign
      and q.status = 'pronto_para_envio'
      and c.status in ('autorizada','processando')
      and (c.scheduled_at is null or c.scheduled_at <= now())
    order by q.sequence_number
    for update of q skip locked
    limit 1
  ), claimed as (
    update public.message_queue q
    set status = 'processando', claimed_at = now(), tentativas = tentativas + 1
    from next_item n where q.id = n.id
    returning q.id, q.telefone, q.mensagem, q.gerente_id, q.idempotency_key, q.campaign_id
  )
  select cl.*, c.group_id, c.confirmation_enabled, coalesce(a.instance_name, 'producao') as instance_name
  into claimed_record
  from claimed cl
  join public.campaigns c on c.id = cl.campaign_id
  left join public.whatsapp_accounts a on a.id = c.whatsapp_account_id;
  if claimed_record.id is null then return; end if;
  update public.campaigns c set status = 'processando' where c.id = target_campaign and c.status = 'autorizada';
  return query select claimed_record.id, claimed_record.telefone, claimed_record.mensagem, claimed_record.gerente_id, claimed_record.idempotency_key, claimed_record.instance_name, claimed_record.campaign_id, claimed_record.group_id, claimed_record.confirmation_enabled;
end; $$;
revoke all on function public.claim_campaign_message(uuid) from public, anon, authenticated;
