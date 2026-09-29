create table public.whatsapp_accounts (
  id uuid primary key default gen_random_uuid(),
  label text not null check (char_length(label) between 1 and 60),
  instance_name text not null unique check (instance_name ~ '^[a-zA-Z0-9_-]{2,60}$'),
  enabled boolean not null default true,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

insert into public.whatsapp_accounts (label, instance_name) values ('Principal', 'producao') on conflict do nothing;

alter table public.campaigns add column whatsapp_account_id uuid references public.whatsapp_accounts(id);
update public.campaigns set whatsapp_account_id = (select id from public.whatsapp_accounts where instance_name = 'producao' limit 1) where whatsapp_account_id is null;

alter table public.message_queue alter column telefone drop not null;
alter table public.message_queue alter column mensagem drop not null;
alter table public.message_queue add column destination_masked text;
alter table public.message_queue add column destination_hash text;

update public.message_queue set
  destination_masked = '********' || right(telefone, 4),
  destination_hash = encode(extensions.digest(telefone, 'sha256'), 'hex'),
  telefone = null,
  mensagem = null
where status = 'enviado' and telefone is not null;

create table public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  must_change_password boolean not null default true,
  changed_at timestamptz
);

insert into public.user_profiles (user_id, must_change_password)
select id, false from auth.users on conflict do nothing;

create or replace function public.handle_new_user_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.user_profiles (user_id, must_change_password) values (new.id, true) on conflict do nothing;
  return new;
end; $$;

create trigger on_auth_user_created_profile after insert on auth.users for each row execute function public.handle_new_user_profile();

alter table public.whatsapp_accounts enable row level security;
alter table public.user_profiles enable row level security;
create policy "authenticated_manage_accounts" on public.whatsapp_accounts for all to authenticated using (true) with check (true);
create policy "users_read_own_profile" on public.user_profiles for select to authenticated using (user_id = auth.uid());
create policy "users_update_own_profile" on public.user_profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop function public.claim_next_message();

create function public.claim_next_message()
returns table(id uuid, telefone text, mensagem text, idempotency_key text, instance_name text)
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
  select cl.*, coalesce(a.instance_name, 'producao') as instance_name into claimed_record
  from claimed cl join public.campaigns c on c.id=cl.campaign_id
  left join public.whatsapp_accounts a on a.id=c.whatsapp_account_id;
  if claimed_record.id is null then return; end if;
  update public.campaigns c set status='processando' where c.id=claimed_record.campaign_id and c.status='autorizada';
  return query select claimed_record.id, claimed_record.telefone, claimed_record.mensagem, claimed_record.idempotency_key, claimed_record.instance_name;
end; $$;

create or replace function public.finish_message(target_id uuid, was_success boolean, provider_id text default null, error_text text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare target_campaign uuid;
begin
  update public.message_queue set
    status=case when was_success then 'enviado'::public.message_status else 'erro'::public.message_status end,
    external_id=provider_id, erro=error_text, enviado_em=case when was_success then now() else null end,
    destination_masked=case when was_success then '********' || right(telefone, 4) else destination_masked end,
    destination_hash=case when was_success then encode(extensions.digest(telefone, 'sha256'), 'hex') else destination_hash end,
    telefone=case when was_success then null else telefone end,
    mensagem=case when was_success then null else mensagem end
  where id=target_id and status='processando' returning campaign_id into target_campaign;
  if target_campaign is not null and not exists (select 1 from public.message_queue where campaign_id=target_campaign and status in ('pendente','pronto_para_envio','processando')) then
    update public.campaigns set status=case when exists(select 1 from public.message_queue where campaign_id=target_campaign and status='erro') then 'erro'::public.campaign_status else 'concluida'::public.campaign_status end where id=target_campaign;
  end if;
end; $$;

revoke all on function public.claim_next_message() from public, anon, authenticated;
revoke all on function public.finish_message(uuid,boolean,text,text) from public, anon, authenticated;
