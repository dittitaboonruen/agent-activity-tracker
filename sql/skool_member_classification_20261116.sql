-- Royal Partner Skool member classification (safe, reversible, audited)
-- Run ONCE in Agent Tracking Supabase SQL Editor, after reviewing.
-- Does not automatically classify any existing account or change learning data.
begin;

create table if not exists public.skool_member_classification (
  skool_member_id bigint primary key references public.skool_members(id) on delete restrict,
  category text not null check (category in ('staff','team_leader','pending')),
  note text not null check (char_length(btrim(note)) between 8 and 500),
  updated_at timestamptz not null default now(),
  updated_by uuid not null,
  updated_by_email text not null
);

create table if not exists public.skool_member_classification_audit (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  skool_member_id bigint not null,
  skool_name_snapshot text not null,
  old_category text not null,
  new_category text not null,
  actor_user_id uuid not null,
  actor_email text not null,
  reason text not null
);
create index if not exists skool_member_classification_audit_member_idx
  on public.skool_member_classification_audit (skool_member_id, created_at desc);

alter table public.skool_member_classification enable row level security;
alter table public.skool_member_classification_audit enable row level security;
revoke all on public.skool_member_classification from public, anon, authenticated;
revoke all on public.skool_member_classification_audit from public, anon, authenticated;
grant select, insert, update on public.skool_member_classification to service_role;
grant select, insert on public.skool_member_classification_audit to service_role;
grant usage, select on sequence public.skool_member_classification_audit_id_seq to service_role;

create or replace function public.skool_classification_audit_append_only()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'CLASSIFICATION_AUDIT_IMMUTABLE' using errcode='P0001';
end;
$$;
revoke all on function public.skool_classification_audit_append_only() from public, anon, authenticated;
drop trigger if exists trg_skool_classification_audit_append_only on public.skool_member_classification_audit;
create trigger trg_skool_classification_audit_append_only
  before update or delete on public.skool_member_classification_audit
  for each row execute function public.skool_classification_audit_append_only();

-- Classification + its audit record are one transaction. Server checks the
-- authenticated caller's allowed role BEFORE calling this service-only RPC.
create or replace function public.skool_classify_member_audited(
  p_member_id bigint,
  p_expected_category text,
  p_new_category text,
  p_note text,
  p_actor_id uuid,
  p_actor_email text
)
returns table (member_id bigint, category text, audit_id bigint)
language plpgsql security invoker set search_path = ''
as $$
declare
  v_member public.skool_members%rowtype;
  v_existing text;
  v_log_id bigint;
begin
  if p_member_id is null or p_member_id < 1
     or p_expected_category not in ('pending','staff','team_leader')
     or p_new_category not in ('pending','staff','team_leader')
     or p_expected_category = p_new_category
     or p_actor_id is null
     or nullif(pg_catalog.btrim(coalesce(p_actor_email,'')),'') is null
     or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_note,''))) not between 8 and 500
  then
    raise exception 'CLASSIFICATION_BAD_INPUT' using errcode='P0001';
  end if;

  -- Serialize all classification writes for a particular Skool account.
  select * into v_member
    from public.skool_members where id = p_member_id for update;
  if not found or v_member.agent_id is not null then
    raise exception 'CLASSIFICATION_MEMBER_LINKED_OR_MISSING' using errcode='P0001';
  end if;
  select c.category into v_existing
    from public.skool_member_classification c
    where c.skool_member_id = p_member_id;
  v_existing := coalesce(v_existing,'pending');
  if v_existing <> p_expected_category then
    raise exception 'CLASSIFICATION_CHANGED_REFRESH' using errcode='P0001';
  end if;

  insert into public.skool_member_classification (
    skool_member_id, category, note, updated_at, updated_by, updated_by_email
  ) values (
    p_member_id, p_new_category, pg_catalog.btrim(p_note),
    pg_catalog.now(), p_actor_id, pg_catalog.lower(pg_catalog.btrim(p_actor_email))
  )
  on conflict (skool_member_id)
  do update set category = excluded.category, note = excluded.note,
     updated_at = excluded.updated_at, updated_by = excluded.updated_by,
     updated_by_email = excluded.updated_by_email;

  insert into public.skool_member_classification_audit (
    skool_member_id, skool_name_snapshot, old_category, new_category,
    actor_user_id, actor_email, reason
  ) values (
    p_member_id, pg_catalog.btrim(pg_catalog.concat_ws(' ',v_member.first_name,v_member.last_name)),
    v_existing, p_new_category, p_actor_id,
    pg_catalog.lower(pg_catalog.btrim(p_actor_email)), pg_catalog.btrim(p_note)
  ) returning id into v_log_id;

  return query select p_member_id, p_new_category, v_log_id;
end;
$$;
revoke all on function public.skool_classify_member_audited(bigint,text,text,text,uuid,text)
  from public, anon, authenticated;
grant execute on function public.skool_classify_member_audited(bigint,text,text,text,uuid,text)
  to service_role;

-- Prevent a classified staff/leader account being linked as an Agent.
-- This also closes races between classification and matching.
create or replace function public.skool_reject_non_agent_link()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.agent_id is not null and old.agent_id is null and exists (
    select 1 from public.skool_member_classification c
    where c.skool_member_id = old.id
      and c.category in ('staff','team_leader')
  ) then
    raise exception 'CLASSIFIED_NON_AGENT_CANNOT_LINK' using errcode='P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.skool_reject_non_agent_link() from public, anon, authenticated;
drop trigger if exists trg_skool_reject_non_agent_link on public.skool_members;
create trigger trg_skool_reject_non_agent_link
  before update of agent_id on public.skool_members
  for each row execute function public.skool_reject_non_agent_link();
commit;

-- Read-only verification:
select to_regclass('public.skool_member_classification') as classification_table,
       to_regclass('public.skool_member_classification_audit') as classification_audit_table,
       (select count(*) from public.skool_member_classification) as classified_count;
