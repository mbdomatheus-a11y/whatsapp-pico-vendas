create or replace function public.stop_campaign(target_campaign uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare affected integer; cancelled_count integer;
begin
  update public.campaigns
  set status = 'cancelada'::public.campaign_status
  where id = target_campaign and status in ('autorizada','processando','pausada');
  get diagnostics affected = row_count;
  if affected = 0 then raise exception 'Campanha inexistente ou nao pode ser parada'; end if;

  update public.message_queue
  set status = 'cancelado'::public.message_status,
      destination_masked = case when telefone is not null then '********' || right(telefone, 4) else destination_masked end,
      destination_hash = case when telefone is not null then encode(extensions.digest(telefone, 'sha256'), 'hex') else destination_hash end,
      telefone = null,
      mensagem = null,
      erro = 'Cancelada pelo operador'
  where campaign_id = target_campaign and status in ('pendente','pronto_para_envio','erro');
  get diagnostics cancelled_count = row_count;
  return jsonb_build_object('ok', true, 'campaign_id', target_campaign, 'cancelled', cancelled_count);
end; $$;

revoke all on function public.stop_campaign(uuid) from public, anon, authenticated;

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
  if target_campaign is not null
    and not exists (select 1 from public.message_queue where campaign_id=target_campaign and status in ('pendente','pronto_para_envio','processando'))
  then
    update public.campaigns
    set status=case when exists(select 1 from public.message_queue where campaign_id=target_campaign and status='erro') then 'erro'::public.campaign_status else 'concluida'::public.campaign_status end
    where id=target_campaign and status <> 'cancelada'::public.campaign_status;
  end if;
end; $$;

revoke all on function public.finish_message(uuid,boolean,text,text) from public, anon, authenticated;
