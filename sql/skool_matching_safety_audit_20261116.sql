-- Royal Partners / Skool Matching Safety + Audit Log
-- Execute ONLY against the verified Agent Performance Hub Supabase project.
-- Designed to be re-runnable. No existing Agent Master/Production/PEP records updated.
-- Must deploy this database change BEFORE enabling the new matching API.

begin;

create table if not exists public.skool_member_match_audit (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  event_type text not null default 'link'
    check (event_type in ('link')),
  skool_member_id bigint not null,
  skool_profile_url text not null,
  skool_name text not null,
  previous_agent_id bigint,
  new_agent_id bigint not null,
  agent_code_snapshot text not null,
  agent_name_snapshot text not null,
  actor_user_id uuid not null,
  actor_email text not null,
  verification_method text not null
    check (verification_method in ('company_roster','skool_owner_confirmation','other_verified')),
  verification_note text not null
    check (char_length(trim(verification_note)) >= 8)
);

create index if not exists skool_member_match_audit_member_idx
  on public.skool_member_match_audit (skool_member_id, created_at desc);
create index if not exists skool_member_match_audit_agent_idx
  on public.skool_member_match_audit (new_agent_id, created_at desc);

alter table public.skool_member_match_audit enable row level security;
-- No anon/authenticated policies; only trusted backend role can read/write.
revoke all on table public.skool_member_match_audit from public, anon, authenticated;
grant select, insert on table public.skool_member_match_audit to service_role;
grant usage, select on sequence public.skool_member_match_audit_id_seq to service_role;

-- Immutable audit entries: even application-side mistakes must not rewrite history.
create or replace function public.skool_match_audit_immutable()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Skool match audit log is append-only' using errcode = '23514';
end;
$$;
revoke all on function public.skool_match_audit_immutable() from public, anon, authenticated;
drop trigger if exists trg_skool_match_audit_immutable on public.skool_member_match_audit;
create trigger trg_skool_match_audit_immutable
  before update or delete on public.skool_member_match_audit
  for each row execute function public.skool_match_audit_immutable();

-- Prevent stale CSV imports from clearing an existing verified link.
-- Skool links are intentionally append-only: corrections require an audited
-- unlink/relink workflow (not implemented in this phase).
create or replace function public.skool_preserve_verified_agent_id()
returns trigger language plpgsql set search_path = '' as $
begin
  if old.agent_id is not null and new.agent_id is distinct from old.agent_id then
    raise exception 'MATCH_EXISTING_LINK_IMMUTABLE' using errcode = 'P0001';
  end if;
  return new;
end;
$;
revoke all on function public.skool_preserve_verified_agent_id() from public, anon, authenticated;
drop trigger if exists trg_skool_preserve_verified_agent_id on public.skool_members;
create trigger trg_skool_preserve_verified_agent_id
  before update of agent_id on public.skool_members
  for each row execute function public.skool_preserve_verified_agent_id();

-- Make the link and audit entry one PostgreSQL transaction.
-- Called ONLY by the server-side Supabase secret client AFTER user authorization.
-- SECURITY INVOKER avoids unnecessary privilege escalation.
create or replace function public.skool_link_member_audited(
  p_member_id bigint,
  p_agent_code text,
  p_expected_skool_name text,
  p_expected_agent_name text,
  p_actor_user_id uuid,
  p_actor_email text,
  p_verification_method text,
  p_verification_note text
)
returns table (member_id bigint, agent_id bigint, matched_agent_code text, matched_agent_name text, audit_id bigint)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_agent public.agent_master%rowtype;
  v_member public.skool_members%rowtype;
  v_audit_id bigint;
  v_duplicate bigint;
  v_count integer;
  v_full_name text;
begin
  if p_member_id is null or p_member_id < 1
    or nullif(pg_catalog.btrim(p_agent_code),'') is null
    or p_actor_user_id is null
    or nullif(pg_catalog.btrim(p_actor_email),'') is null
    or p_verification_method not in ('company_roster','skool_owner_confirmation','other_verified')
    or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_verification_note,''))) < 8
    or pg_catalog.char_length(p_verification_note) > 500
  then
    raise exception 'MATCH_INVALID_INPUT' using errcode = 'P0001';
  end if;

  -- Lock the *agent row* to serialize concurrent attempts linking different
  -- Skool profiles to the SAME Agent Master identity.
  select count(*) into v_count
    from public.agent_master a
    where a.agent_code = p_agent_code and a.active = true;
  if v_count <> 1 then
    raise exception 'MATCH_AGENT_NOT_UNIQUE' using errcode = 'P0001';
  end if;
  select * into strict v_agent
    from public.agent_master a
    where a.agent_code = p_agent_code and a.active = true
    for update;
  if pg_catalog.btrim(coalesce(v_agent.agent_name,'')) <>
     pg_catalog.btrim(coalesce(p_expected_agent_name,''))
  then
    raise exception 'MATCH_AGENT_CHANGED' using errcode = 'P0001';
  end if;

  select * into v_member
    from public.skool_members m
    where m.id = p_member_id
    for update;
  if not found or v_member.agent_id is not null then
    raise exception 'MATCH_MEMBER_ALREADY_LINKED_OR_MISSING' using errcode = 'P0001';
  end if;
  v_full_name := pg_catalog.btrim(pg_catalog.concat_ws(' ', v_member.first_name, v_member.last_name));
  if v_full_name <> pg_catalog.btrim(coalesce(p_expected_skool_name,'')) then
    raise exception 'MATCH_MEMBER_CHANGED' using errcode = 'P0001';
  end if;

  select m.id into v_duplicate
    from public.skool_members m
    where m.agent_id = v_agent.id
    limit 1;
  if found then
    raise exception 'MATCH_AGENT_ALREADY_LINKED' using errcode = 'P0001';
  end if;

  update public.skool_members
  set agent_id = v_agent.id, updated_at = pg_catalog.now()
  where id = p_member_id and agent_id is null;
  if not found then
    raise exception 'MATCH_CONCURRENT_CHANGE' using errcode = 'P0001';
  end if;

  insert into public.skool_member_match_audit (
    skool_member_id, skool_profile_url, skool_name,
    previous_agent_id, new_agent_id, agent_code_snapshot, agent_name_snapshot,
    actor_user_id, actor_email, verification_method, verification_note
  ) values (
    v_member.id, v_member.skool_profile_url, v_full_name,
    null, v_agent.id, v_agent.agent_code, v_agent.agent_name,
    p_actor_user_id, pg_catalog.lower(pg_catalog.btrim(p_actor_email)),
    p_verification_method, pg_catalog.btrim(p_verification_note)
  ) returning id into v_audit_id;

  return query select v_member.id, v_agent.id, v_agent.agent_code,
                      v_agent.agent_name, v_audit_id;
end;
$$;

revoke all on function public.skool_link_member_audited(
  bigint,text,text,text,uuid,text,text,text
) from public, anon, authenticated;
grant execute on function public.skool_link_member_audited(
  bigint,text,text,text,uuid,text,text,text
) to service_role;

commit;

-- Verification after SQL execution:
-- select to_regclass('public.skool_member_match_audit');
-- select routine_name from information_schema.routines
--  where routine_schema='public' and routine_name='skool_link_member_audited';
-- select count(*) from public.skool_member_match_audit;
-- IMPORTANT: Old links pre-dating this change cannot be backfilled as verified actions
-- without trustworthy historical evidence. Do not manufacture audit records.
