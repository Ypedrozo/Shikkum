-- Shikkum ticket groups and delivery audit. Safe to apply after 202610070001.
alter table public.user_profiles drop constraint if exists user_profiles_role_check;
alter table public.user_profiles add constraint user_profiles_role_check
  check (role in ('ADMIN','SCANNER','cashier','gate_operator'));

create table if not exists public.guest_groups (
  id uuid primary key default gen_random_uuid(),
  responsible_name text not null check (length(btrim(responsible_name)) between 2 and 160),
  email text not null check (length(btrim(email)) <= 254),
  phone text not null check (length(btrim(phone)) between 5 and 30),
  ticket_count integer not null check (ticket_count between 1 and 20),
  registered_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.participants alter column first_name drop not null;
alter table public.participants alter column last_name drop not null;
alter table public.participants alter column email drop not null;
alter table public.participants alter column identification drop not null;
alter table public.participants alter column phone drop not null;
alter table public.participants drop constraint if exists participants_email_unique;
alter table public.participants drop constraint if exists participants_email_key;
alter table public.participants
  add column if not exists group_id uuid references public.guest_groups(id) on delete set null,
  add column if not exists ticket_number integer,
  add column if not exists is_placeholder boolean not null default false,
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references auth.users(id);
create unique index if not exists participants_group_ticket_unique
  on public.participants(group_id, ticket_number) where group_id is not null;
create index if not exists participants_group_id_idx on public.participants(group_id);

create table if not exists public.email_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  recipient text not null,
  requested_at timestamptz not null default now(),
  status text not null check (status in ('sent','failed')),
  provider_id text,
  error_message text
);
create index if not exists email_delivery_logs_participant_idx
  on public.email_delivery_logs(participant_id, requested_at desc);

alter table public.guest_groups enable row level security;
alter table public.email_delivery_logs enable row level security;

drop policy if exists "cashiers read guest groups" on public.guest_groups;
create policy "cashiers read guest groups" on public.guest_groups for select to authenticated
using (exists(select 1 from public.user_profiles p where p.id=auth.uid() and p.role in ('ADMIN','cashier')));
drop policy if exists "cashiers read delivery logs" on public.email_delivery_logs;
create policy "cashiers read delivery logs" on public.email_delivery_logs for select to authenticated
using (exists(select 1 from public.user_profiles p where p.id=auth.uid() and p.role in ('ADMIN','cashier')));
drop policy if exists "cashiers write delivery logs" on public.email_delivery_logs;
create policy "cashiers write delivery logs" on public.email_delivery_logs for insert to authenticated
with check (exists(select 1 from public.user_profiles p where p.id=auth.uid() and p.role in ('ADMIN','cashier')));

drop policy if exists "admins manage participants" on public.participants;
drop policy if exists "cashiers manage participants" on public.participants;
drop policy if exists "cashiers read participants" on public.participants;
create policy "cashiers read participants" on public.participants for select to authenticated
using (exists(select 1 from public.user_profiles p where p.id=auth.uid() and p.role in ('ADMIN','cashier')));
create or replace function public.register_guest_group(
  p_responsible_name text,
  p_email text,
  p_phone text,
  p_ticket_count integer,
  p_tickets jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_group_id uuid;
  v_ticket jsonb;
  v_ticket_id uuid;
  v_number integer := 0;
  v_first text;
  v_last text;
  v_email text;
  v_phone text;
  v_identification text;
  v_placeholder boolean;
  v_token text;
  v_tickets jsonb := '[]'::jsonb;
  v_responsible_first text;
  v_responsible_last text;
begin
  if v_user is null or not exists (
    select 1 from public.user_profiles
    where id=v_user and role in ('ADMIN','cashier')
  ) then raise exception 'not authorized' using errcode='42501'; end if;

  if p_responsible_name is null or length(btrim(p_responsible_name)) not between 2 and 160
     or p_email is null or length(btrim(p_email)) > 254
     or lower(btrim(p_email)) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     or p_phone is null or btrim(p_phone) !~ '^[+()0-9 .-]{5,30}$'
     or p_ticket_count is null or p_ticket_count not between 1 and 20
  then raise exception 'invalid registration data' using errcode='22023'; end if;
  if p_tickets is null or jsonb_typeof(p_tickets) <> 'array' then
    raise exception 'invalid ticket list' using errcode='22023';
  end if;
  if jsonb_array_length(p_tickets) <> p_ticket_count then
    raise exception 'ticket count mismatch' using errcode='22023';
  end if;

  insert into public.guest_groups(responsible_name,email,phone,ticket_count,registered_by)
    values(btrim(p_responsible_name),lower(btrim(p_email)),btrim(p_phone),p_ticket_count,v_user)
    returning id into v_group_id;

  v_responsible_first := split_part(btrim(p_responsible_name),' ',1);
  v_responsible_last := nullif(btrim(substr(btrim(p_responsible_name),length(v_responsible_first)+1)),'');

  for v_ticket in select value from jsonb_array_elements(p_tickets) loop
    v_number := v_number + 1;
    v_first := nullif(btrim(coalesce(v_ticket->>'first_name','')),'');
    v_last := nullif(btrim(coalesce(v_ticket->>'last_name','')),'');
    v_email := nullif(lower(btrim(coalesce(v_ticket->>'email',''))),'');
    v_phone := nullif(btrim(coalesce(v_ticket->>'phone','')),'');
    v_identification := nullif(btrim(coalesce(v_ticket->>'identification','')),'');
    v_placeholder := v_first is null;

    if v_number=1 and v_placeholder then
      v_first := v_responsible_first;
      v_last := v_responsible_last;
      v_email := lower(btrim(p_email));
      v_phone := btrim(p_phone);
      v_placeholder := false;
    end if;

    if (v_first is not null and length(v_first)>100)
       or (v_last is not null and length(v_last)>100)
       or (v_email is not null and (length(v_email)>254 or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'))
       or (v_phone is not null and (length(v_phone)>30 or v_phone !~ '^[+()0-9 .-]{5,30}$'))
       or (v_identification is not null and length(v_identification)>50)
    then raise exception 'invalid attendee data' using errcode='22023'; end if;

    v_token := replace(replace(rtrim(encode(public.gen_random_bytes(32),'base64'),'='),'+','-'),'/','_');
    insert into public.participants(
      first_name,last_name,email,identification,phone,token,registered_by,
      group_id,ticket_number,is_placeholder
    ) values (
      v_first,v_last,v_email,v_identification,v_phone,v_token,v_user,
      v_group_id,v_number,v_placeholder
    ) returning id into v_ticket_id;

    v_tickets := v_tickets || jsonb_build_array(jsonb_build_object(
      'id',v_ticket_id,'first_name',v_first,'last_name',v_last,'email',v_email,
      'phone',v_phone,'token',v_token,'status','pending',
      'ticket_number',v_number,'is_placeholder',v_placeholder
    ));
  end loop;

  return jsonb_build_object(
    'group',jsonb_build_object('id',v_group_id,'responsible_name',btrim(p_responsible_name),
      'email',lower(btrim(p_email)),'phone',btrim(p_phone),'ticket_count',p_ticket_count),
    'tickets',v_tickets
  );
end $$;

create or replace function public.get_public_ticket(p_token text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_ticket public.participants%rowtype; v_group_name text;
begin
  if p_token is null or length(p_token)>100 then return null; end if;
  select * into v_ticket from public.participants where token=p_token;
  if not found then return null; end if;
  if v_ticket.group_id is not null then
    select responsible_name into v_group_name from public.guest_groups where id=v_ticket.group_id;
  end if;
  return jsonb_build_object(
    'first_name',v_ticket.first_name,
    'last_name',v_ticket.last_name,
    'ticket_number',v_ticket.ticket_number,
    'ticket_count',(select ticket_count from public.guest_groups where id=v_ticket.group_id),
    'group_name',v_group_name,
    'status',v_ticket.status,
    'created_at',v_ticket.created_at,
    'checked_in_at',v_ticket.checked_in_at
  );
end $$;

revoke all on function public.register_guest_group(text,text,text,integer,jsonb) from public, anon;
grant execute on function public.register_guest_group(text,text,text,integer,jsonb) to authenticated;
revoke all on function public.get_public_ticket(text) from public;
grant execute on function public.get_public_ticket(text) to anon, authenticated;

create or replace function public.check_in_qr(p_token text, p_device_info text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_participant public.participants%rowtype;
  v_result text;
begin
  if v_user is null or not exists (
    select 1 from public.user_profiles
    where id=v_user and role in ('ADMIN','SCANNER','gate_operator')
  ) then raise exception 'not authorized' using errcode='42501'; end if;

  select * into v_participant from public.participants where token=p_token for update;
  if not found then
    insert into public.check_in_attempts(scanned_by,device_info,result)
      values(v_user,left(p_device_info,250),'invalid');
    return jsonb_build_object('result','invalid');
  elsif v_participant.status='cancelled' then
    v_result := 'cancelled';
  elsif v_participant.status='checked_in' then
    v_result := 'already_used';
  else
    update public.participants set status='checked_in',checked_in_at=now(),checked_in_by=v_user,
      device_info=left(p_device_info,250)
      where id=v_participant.id and status='pending'
      returning * into v_participant;
    if found then v_result := 'authorized'; else v_result := 'already_used'; end if;
  end if;

  insert into public.check_in_attempts(participant_id,scanned_by,device_info,result)
    values(v_participant.id,v_user,left(p_device_info,250),v_result);
  return jsonb_build_object('result',v_result,'participant',jsonb_build_object(
    'first_name',v_participant.first_name,'last_name',v_participant.last_name,
    'ticket_number',v_participant.ticket_number,'is_placeholder',v_participant.is_placeholder,
    'status',v_participant.status,'checked_in_at',v_participant.checked_in_at
  ));
end $$;
revoke all on function public.check_in_qr(text,text) from public, anon;
grant execute on function public.check_in_qr(text,text) to authenticated;

revoke all on public.participants, public.guest_groups, public.email_delivery_logs,
  public.check_in_attempts, public.user_profiles from anon;
revoke all on public.guest_groups, public.email_delivery_logs from public;
revoke insert, update, delete on public.participants from authenticated;
grant select on public.participants, public.guest_groups, public.email_delivery_logs,
  public.check_in_attempts, public.user_profiles to authenticated;
grant insert on public.email_delivery_logs to authenticated;

create or replace function public.cancel_ticket(p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user uuid := auth.uid(); v_id uuid;
begin
  if v_user is null or not exists (
    select 1 from public.user_profiles
    where id=v_user and role in ('ADMIN','cashier')
  ) then raise exception 'not authorized' using errcode='42501'; end if;
  update public.participants
    set status='cancelled',cancelled_at=now(),cancelled_by=v_user
    where id=p_id and status='pending'
    returning id into v_id;
  if not found then return jsonb_build_object('ok',false); end if;
  return jsonb_build_object('ok',true);
end $$;
revoke all on function public.cancel_ticket(uuid) from public, anon;
grant execute on function public.cancel_ticket(uuid) to authenticated;

