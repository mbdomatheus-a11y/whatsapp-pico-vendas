create extension if not exists pgcrypto;

create type public.campaign_status as enum ('rascunho','autorizada','processando','pausada','concluida','erro');
create type public.message_status as enum ('pendente','pronto_para_envio','processando','enviado','erro');

create table public.campaigns (
  id uuid primary key default gen_random_uuid(), name text not null check (char_length(name) between 1 and 120),
  status public.campaign_status not null default 'rascunho', total_messages integer not null default 0 check (total_messages between 0 and 500),
  created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
  authorized_at timestamptz, authorized_by uuid references auth.users(id), test_sent_at timestamptz, test_sent_by uuid references auth.users(id)
);

create table public.message_queue (
  id uuid primary key default gen_random_uuid(), campaign_id uuid not null references public.campaigns(id) on delete cascade,
  gerente_id text not null, telefone text not null check (telefone ~ '^\d{10,15}$'), mensagem text not null check (char_length(mensagem) between 1 and 4096),
  status public.message_status not null default 'pendente', tentativas integer not null default 0,
  sequence_number integer not null, idempotency_key text not null unique, external_id text, erro text,
  claimed_at timestamptz, enviado_em timestamptz, created_at timestamptz not null default now(),
  unique (campaign_id, sequence_number)
);

create table public.gateway_health (
  id bigint generated always as identity primary key, gateway_online boolean not null,
  whatsapp_status text not null, detail text, checked_at timestamptz not null default now()
);

alter table public.campaigns enable row level security;
alter table public.message_queue enable row level security;
alter table public.gateway_health enable row level security;

create policy "authenticated_read_campaigns" on public.campaigns for select to authenticated using (true);
create policy "authenticated_create_campaigns" on public.campaigns for insert to authenticated with check (created_by = auth.uid());
create policy "authenticated_update_campaigns" on public.campaigns for update to authenticated using (true) with check (true);
create policy "authenticated_read_queue" on public.message_queue for select to authenticated using (true);
create policy "authenticated_create_queue" on public.message_queue for insert to authenticated with check (exists (select 1 from public.campaigns c where c.id = campaign_id and c.created_by = auth.uid() and c.status = 'rascunho'));
create policy "authenticated_read_health" on public.gateway_health for select to authenticated using (true);

create or replace function public.authorize_campaign(target_campaign uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare affected integer;
begin
  update public.campaigns set status='autorizada', authorized_at=now(), authorized_by=auth.uid()
  where id=target_campaign and status in ('rascunho','pausada') and test_sent_at is not null;
  get diagnostics affected = row_count;
  if affected = 0 then raise exception 'Campanha inexistente, ja processada ou sem teste concluido'; end if;
  update public.message_queue set status='pronto_para_envio' where campaign_id=target_campaign and status in ('pendente','erro');
  return jsonb_build_object('ok', true, 'campaign_id', target_campaign);
end; $$;

create or replace function public.claim_next_message()
returns table(id uuid, telefone text, mensagem text, idempotency_key text)
language plpgsql security definer set search_path = '' as $$
declare claimed_record record;
begin
  with next_item as (
    select q.id from public.message_queue q join public.campaigns c on c.id=q.campaign_id
    where q.status='pronto_para_envio' and c.status in ('autorizada','processando')
    order by q.created_at, q.sequence_number for update of q skip locked limit 1
  ), claimed as (
    update public.message_queue q set status='processando', claimed_at=now(), tentativas=tentativas+1
    from next_item n where q.id=n.id returning q.id,q.telefone,q.mensagem,q.idempotency_key,q.campaign_id
  )
  select * into claimed_record from claimed;
  if claimed_record.id is null then return; end if;
  update public.campaigns c set status='processando' where c.id=claimed_record.campaign_id and c.status='autorizada';
  return query select claimed_record.id, claimed_record.telefone, claimed_record.mensagem, claimed_record.idempotency_key;
end; $$;

create or replace function public.finish_message(target_id uuid, was_success boolean, provider_id text default null, error_text text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare target_campaign uuid;
begin
  update public.message_queue set status=case when was_success then 'enviado'::public.message_status else 'erro'::public.message_status end,
    external_id=provider_id, erro=error_text, enviado_em=case when was_success then now() else null end
  where id=target_id and status='processando' returning campaign_id into target_campaign;
  if target_campaign is not null and not exists (select 1 from public.message_queue where campaign_id=target_campaign and status in ('pendente','pronto_para_envio','processando')) then
    update public.campaigns set status=case when exists(select 1 from public.message_queue where campaign_id=target_campaign and status='erro') then 'erro'::public.campaign_status else 'concluida'::public.campaign_status end where id=target_campaign;
  end if;
end; $$;

revoke all on function public.claim_next_message() from public, anon, authenticated;
revoke all on function public.finish_message(uuid,boolean,text,text) from public, anon, authenticated;
grant execute on function public.authorize_campaign(uuid) to authenticated;
