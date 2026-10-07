create extension if not exists pgcrypto;

do $$ begin
  create type public.participant_status as enum ('pending','checked_in','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'SCANNER' check (role in ('ADMIN','SCANNER')),
  created_at timestamptz not null default now()
);
create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text not null,
  identification text not null,
  phone text not null,
  token text not null unique,
  status public.participant_status not null default 'pending',
  registered_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  checked_in_at timestamptz,
  checked_in_by uuid references auth.users(id),
  device_info text,
  constraint participants_email_unique unique (email),
  constraint participants_identification_unique unique (identification)
);
create index if not exists participants_created_at_idx on public.participants(created_at desc);
create index if not exists participants_status_idx on public.participants(status);
create table if not exists public.check_in_attempts (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid references public.participants(id),
  scanned_by uuid references auth.users(id),
  device_info text,
  result text not null check (result in ('authorized','already_used','cancelled','invalid')),
  created_at timestamptz not null default now()
);
create index if not exists check_in_attempts_created_at_idx on public.check_in_attempts(created_at desc);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.user_profiles(id, role) values (new.id, 'SCANNER') on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.check_in_qr(p_token text, p_device_info text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_participant public.participants%rowtype;
  v_result text;
begin
  if v_user is null or not exists (select 1 from public.user_profiles where id=v_user and role in ('ADMIN','SCANNER')) then
    raise exception 'not authorized' using errcode='42501';
  end if;
  select * into v_participant from public.participants where token=p_token for update;
  if not found then
    insert into public.check_in_attempts(scanned_by,device_info,result) values (v_user,left(p_device_info,250),'invalid');
    return jsonb_build_object('result','invalid');
  elsif v_participant.status='cancelled' then
    v_result := 'cancelled';
  elsif v_participant.status='checked_in' then
    v_result := 'already_used';
  else
    update public.participants set status='checked_in', checked_in_at=now(), checked_in_by=v_user, device_info=left(p_device_info,250)
      where id=v_participant.id and status='pending'
      returning * into v_participant;
    if found then v_result := 'authorized'; else v_result := 'already_used'; end if;
  end if;
  insert into public.check_in_attempts(participant_id,scanned_by,device_info,result)
    values(v_participant.id,v_user,left(p_device_info,250),v_result);
  return jsonb_build_object('result',v_result,'participant',jsonb_build_object(
    'id',v_participant.id,'first_name',v_participant.first_name,'last_name',v_participant.last_name,'email',v_participant.email,
    'status',v_participant.status,'checked_in_at',v_participant.checked_in_at));
end $$;

alter table public.user_profiles enable row level security;
alter table public.participants enable row level security;
alter table public.check_in_attempts enable row level security;

drop policy if exists "users read own profile" on public.user_profiles;
create policy "users read own profile" on public.user_profiles for select to authenticated using (id=auth.uid());
drop policy if exists "admins manage participants" on public.participants;
create policy "admins manage participants" on public.participants for all to authenticated
using (exists(select 1 from public.user_profiles where id=auth.uid() and role='ADMIN'))
with check (exists(select 1 from public.user_profiles where id=auth.uid() and role='ADMIN'));
drop policy if exists "admins read scan attempts" on public.check_in_attempts;
create policy "admins read scan attempts" on public.check_in_attempts for select to authenticated
using (exists(select 1 from public.user_profiles where id=auth.uid() and role='ADMIN'));

revoke all on function public.check_in_qr(text,text) from public, anon;
grant execute on function public.check_in_qr(text,text) to authenticated;

