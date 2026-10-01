alter table public.system_settings
add column if not exists mfa_required boolean not null default true;
