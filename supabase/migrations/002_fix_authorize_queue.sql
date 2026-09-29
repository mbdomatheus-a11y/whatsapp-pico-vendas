create or replace function public.authorize_campaign(target_campaign uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected integer;
  queued integer;
begin
  update public.campaigns
  set status = 'autorizada', authorized_at = now(), authorized_by = auth.uid()
  where id = target_campaign
    and created_by = auth.uid()
    and status in ('rascunho', 'pausada')
    and test_sent_at is not null;

  get diagnostics affected = row_count;
  if affected = 0 then
    raise exception 'Campanha inexistente, ja processada ou sem teste concluido';
  end if;

  update public.message_queue
  set status = 'pronto_para_envio'
  where campaign_id = target_campaign
    and status in ('pendente', 'erro');

  get diagnostics queued = row_count;
  if queued = 0 then
    raise exception 'Campanha sem mensagens pendentes';
  end if;

  return jsonb_build_object('ok', true, 'campaign_id', target_campaign, 'queued', queued);
end;
$$;

revoke all on function public.authorize_campaign(uuid) from public, anon;
grant execute on function public.authorize_campaign(uuid) to authenticated;
