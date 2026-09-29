create table public.test_recipients (
  id uuid primary key default gen_random_uuid(),
  label text not null check (char_length(label) between 1 and 80),
  phone text not null unique check (phone ~ '^55\d{10,11}$'),
  active boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.test_recipients enable row level security;

create or replace function public.claim_campaign_message(target_campaign uuid)
returns table(id uuid, telefone text, mensagem text, idempotency_key text, instance_name text)
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
    order by q.sequence_number
    for update of q skip locked
    limit 1
  ), claimed as (
    update public.message_queue q
    set status = 'processando', claimed_at = now(), tentativas = tentativas + 1
    from next_item n where q.id = n.id
    returning q.id, q.telefone, q.mensagem, q.idempotency_key, q.campaign_id
  )
  select cl.*, coalesce(a.instance_name, 'producao') as instance_name
  into claimed_record
  from claimed cl
  join public.campaigns c on c.id = cl.campaign_id
  left join public.whatsapp_accounts a on a.id = c.whatsapp_account_id;

  if claimed_record.id is null then return; end if;
  update public.campaigns c set status = 'processando' where c.id = target_campaign and c.status = 'autorizada';
  return query select claimed_record.id, claimed_record.telefone, claimed_record.mensagem, claimed_record.idempotency_key, claimed_record.instance_name;
end; $$;

revoke all on function public.claim_campaign_message(uuid) from public, anon, authenticated;
