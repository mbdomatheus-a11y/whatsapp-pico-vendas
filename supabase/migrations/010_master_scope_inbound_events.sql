alter table public.inbound_events
  add column if not exists matched_message_id uuid references public.message_queue(id) on delete set null,
  add column if not exists instance_name text,
  add column if not exists provider_event_id text,
  add column if not exists expires_at timestamptz;

create unique index if not exists inbound_events_provider_event_idx
on public.inbound_events (instance_name, provider_event_id)
where instance_name is not null and provider_event_id is not null;

create index if not exists inbound_events_message_idx
on public.inbound_events (matched_message_id);

create or replace function public.is_group_member(target_group uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.user_groups g
    join public.user_profiles p on p.organization_id = g.organization_id
    where g.id = target_group
      and p.user_id = auth.uid()
      and p.active
      and (
        p.role = 'master'
        or exists (
          select 1 from public.user_group_memberships m
          where m.user_id = auth.uid() and m.group_id = target_group
        )
      )
  )
$$;

revoke all on function public.is_group_member(uuid) from public, anon;
grant execute on function public.is_group_member(uuid) to authenticated;
