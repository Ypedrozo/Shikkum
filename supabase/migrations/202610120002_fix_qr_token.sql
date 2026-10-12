-- Fix QR token generation for Supabase deployments where pgcrypto is not in public.
-- Replaces the existing registration RPC in place; it does not delete existing records.
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

    v_token := replace(pg_catalog.gen_random_uuid()::text,'-','');
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
revoke all on function public.register_guest_group(text,text,text,integer,jsonb) from public, anon;
grant execute on function public.register_guest_group(text,text,text,integer,jsonb) to authenticated;
