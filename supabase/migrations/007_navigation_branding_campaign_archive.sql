alter table public.campaigns
  add column if not exists archived_at timestamptz;

alter table public.system_settings
  add column if not exists logo_storage_path text,
  add column if not exists logo_mime_type text check (logo_mime_type in ('image/png','image/jpeg','image/webp'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('brand-assets','brand-assets',false,2097152,array['image/png','image/jpeg','image/webp'])
on conflict (id) do update
set public=false, file_size_limit=2097152, allowed_mime_types=excluded.allowed_mime_types;

create index if not exists campaigns_group_archived_created_idx
on public.campaigns (group_id, archived_at, created_at desc);
