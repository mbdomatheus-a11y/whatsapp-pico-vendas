alter table public.campaigns
  add column if not exists account_mode text not null default 'single'
    check (account_mode in ('single', 'round_robin')),
  add column if not exists whatsapp_account_ids uuid[] not null default '{}'::uuid[];

update public.campaigns
set whatsapp_account_ids = array[whatsapp_account_id]
where whatsapp_account_id is not null
  and cardinality(whatsapp_account_ids) = 0;

alter table public.message_queue
  add column if not exists whatsapp_account_id uuid references public.whatsapp_accounts(id);

update public.message_queue q
set whatsapp_account_id = c.whatsapp_account_id
from public.campaigns c
where c.id = q.campaign_id
  and q.whatsapp_account_id is null;

create index if not exists message_queue_whatsapp_account_idx
  on public.message_queue (whatsapp_account_id, campaign_id);

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
    returning q.id, q.telefone, q.mensagem, q.gerente_id, q.idempotency_key, q.campaign_id, q.whatsapp_account_id
  )
  select cl.id, cl.telefone, cl.mensagem, cl.gerente_id, cl.idempotency_key, cl.campaign_id,
    c.group_id, c.confirmation_enabled, coalesce(qa.instance_name, ca.instance_name, 'producao') as instance_name
  into claimed_record
  from claimed cl
  join public.campaigns c on c.id = cl.campaign_id
  left join public.whatsapp_accounts qa on qa.id = cl.whatsapp_account_id
  left join public.whatsapp_accounts ca on ca.id = c.whatsapp_account_id;
  if claimed_record.id is null then return; end if;
  update public.campaigns c set status = 'processando' where c.id = target_campaign and c.status = 'autorizada';
  return query select claimed_record.id, claimed_record.telefone, claimed_record.mensagem, claimed_record.gerente_id, claimed_record.idempotency_key, claimed_record.instance_name, claimed_record.campaign_id, claimed_record.group_id, claimed_record.confirmation_enabled;
end; $$;
revoke all on function public.claim_campaign_message(uuid) from public, anon, authenticated;

drop function if exists public.claim_next_message();
create function public.claim_next_message()
returns table(id uuid, telefone text, mensagem text, idempotency_key text, instance_name text)
language plpgsql security definer set search_path = '' as $$
declare claimed_record record;
begin
  with next_item as (
    select q.id from public.message_queue q join public.campaigns c on c.id=q.campaign_id
    where q.status='pronto_para_envio' and c.status in ('autorizada','processando')
      and (c.scheduled_at is null or c.scheduled_at <= now())
    order by q.created_at, q.sequence_number for update of q skip locked limit 1
  ), claimed as (
    update public.message_queue q set status='processando', claimed_at=now(), tentativas=tentativas+1
    from next_item n where q.id=n.id returning q.id,q.telefone,q.mensagem,q.idempotency_key,q.campaign_id,q.whatsapp_account_id
  )
  select cl.id, cl.telefone, cl.mensagem, cl.idempotency_key,
    coalesce(qa.instance_name, ca.instance_name, 'producao') as instance_name
  into claimed_record
  from claimed cl join public.campaigns c on c.id=cl.campaign_id
  left join public.whatsapp_accounts qa on qa.id=cl.whatsapp_account_id
  left join public.whatsapp_accounts ca on ca.id=c.whatsapp_account_id;
  if claimed_record.id is null then return; end if;
  update public.campaigns c set status='processando' where c.id=claimed_record.campaign_id and c.status='autorizada';
  return query select claimed_record.id, claimed_record.telefone, claimed_record.mensagem, claimed_record.idempotency_key, claimed_record.instance_name;
end; $$;
revoke all on function public.claim_next_message() from public, anon, authenticated;
