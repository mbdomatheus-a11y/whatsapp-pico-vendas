alter table public.planning_sessions
add column if not exists use_schedule boolean not null default true;
