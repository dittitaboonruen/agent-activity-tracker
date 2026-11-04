-- Additive only: existing daily_production, agents, units and permissions are unchanged.
begin;

create table if not exists public.aia_monthly_batches (
  id bigint generated always as identity primary key,
  report_year integer not null check (report_year between 2000 and 2200),
  report_month integer not null check (report_month between 1 and 12),
  scope text not null check (scope in ('person','unit')),
  as_of_date date not null,
  status text not null default 'draft' check (status in ('draft','confirmed')),
  revision integer not null default 1 check (revision > 0),
  updated_by uuid not null,
  updated_at timestamptz not null default now(),
  confirmed_by uuid,
  confirmed_at timestamptz,
  unique (report_year,report_month,scope),
  check ((status='confirmed' and confirmed_by is not null and confirmed_at is not null)
      or (status='draft' and confirmed_by is null and confirmed_at is null))
);

create table if not exists public.aia_monthly_rows (
  id bigint generated always as identity primary key,
  batch_id bigint not null references public.aia_monthly_batches(id) on delete cascade,
  entity_code text not null check (length(btrim(entity_code)) between 1 and 100),
  entity_name text not null check (length(btrim(entity_name)) between 1 and 250),
  nickname text, unit_id bigint, unit_code text, unit_name text,
  month_cases integer check (month_cases >= 0),
  month_fyp numeric(18,2) check (month_fyp >= 0),
  month_fyc numeric(18,2) check (month_fyc >= 0),
  ytd_cases integer check (ytd_cases >= 0),
  ytd_fyp numeric(18,2) check (ytd_fyp >= 0),
  ytd_fyc numeric(18,2) check (ytd_fyc >= 0),
  exp numeric(18,2) check (exp >= 0),
  lap numeric(18,2) check (lap >= 0),
  limra numeric(5,2) check (limra between 0 and 100),
  active_agents integer check (active_agents >= 0),
  unique (batch_id,entity_code)
);

create table if not exists public.aia_monthly_audit (
  id bigint generated always as identity primary key,
  batch_id bigint not null references public.aia_monthly_batches(id),
  revision integer not null,
  action text not null check (action in ('draft','confirm','reopen')),
  changed_by uuid not null,
  changed_at timestamptz not null default now(),
  before_snapshot jsonb,
  after_snapshot jsonb not null,
  unique (batch_id,revision)
);

alter table public.aia_monthly_batches enable row level security;
alter table public.aia_monthly_rows enable row level security;
alter table public.aia_monthly_audit enable row level security;
-- Only the authenticated server routes use these tables. No browser Data API access.
revoke all on public.aia_monthly_batches, public.aia_monthly_rows, public.aia_monthly_audit from public, anon, authenticated;
grant select,insert,update,delete on public.aia_monthly_batches, public.aia_monthly_rows to service_role;
grant select,insert on public.aia_monthly_audit to service_role;
grant usage,select on sequence public.aia_monthly_batches_id_seq, public.aia_monthly_rows_id_seq, public.aia_monthly_audit_id_seq to service_role;

create or replace function public.save_aia_monthly_batch(
  p_year integer, p_month integer, p_scope text, p_as_of_date date,
  p_action text, p_expected_revision integer, p_rows jsonb, p_actor uuid
) returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $function$
declare
  b public.aia_monthly_batches%rowtype;
  before_data jsonb;
  after_data jsonb;
begin
  if p_year is null or p_year not between 2000 and 2200 or p_month is null or p_month not between 1 and 12
     or p_scope is null or p_scope not in ('person','unit') or p_action is null or p_action not in ('draft','confirm','reopen')
     or p_actor is null or p_as_of_date is null or p_expected_revision is null or p_expected_revision<0 then
    raise exception 'Invalid monthly batch request' using errcode='22023';
  end if;
  -- Serializes initial inserts as well as updates; revision still guards stale browser tabs.
  perform pg_advisory_xact_lock(hashtextextended('aia-monthly:'||p_year||':'||p_month||':'||p_scope,0));
  select * into b from public.aia_monthly_batches
    where report_year=p_year and report_month=p_month and scope=p_scope for update;
  if coalesce(b.revision,0)<>p_expected_revision then
    raise exception 'Monthly batch changed; reload before saving' using errcode='40001';
  end if;
  if b.id is not null then
    select jsonb_build_object('batch',to_jsonb(b),'rows',coalesce(jsonb_agg(to_jsonb(r) order by r.entity_code),'[]'::jsonb))
      into before_data from public.aia_monthly_rows r where r.batch_id=b.id;
  end if;
  if p_action='reopen' then
    if b.id is null or b.status<>'confirmed' then raise exception 'Only a confirmed batch can be reopened' using errcode='55000'; end if;
    update public.aia_monthly_batches set status='draft',confirmed_by=null,confirmed_at=null,
      updated_by=p_actor,updated_at=now(),revision=revision+1 where id=b.id returning * into b;
  else
    if b.status='confirmed' then raise exception 'Reopen confirmed batch before editing' using errcode='55000'; end if;
    if jsonb_typeof(p_rows) is distinct from 'array' then raise exception 'Rows must be an array' using errcode='22023'; end if;
    if jsonb_array_length(p_rows) not between 1 and 2000 then raise exception 'Invalid row count' using errcode='22023'; end if;
    if exists(select 1 from jsonb_array_elements(p_rows) x where jsonb_typeof(x)<>'object'
      or nullif(btrim(x->>'entity_code'),'') is null or nullif(btrim(x->>'entity_name'),'') is null)
      or (select count(distinct x->>'entity_code') from jsonb_array_elements(p_rows) x)<>jsonb_array_length(p_rows)
      then raise exception 'Invalid or duplicate entity codes' using errcode='22023'; end if;
    if p_action='confirm' and exists(
      select 1 from jsonb_array_elements(p_rows) r cross join unnest(array['month_cases','month_fyp','month_fyc','ytd_cases','ytd_fyp','ytd_fyc','exp','lap','limra']) k
      where not (r ? k) or r->k='null'::jsonb
    ) then raise exception 'Confirmed rows must contain all nine AIA metrics' using errcode='22023'; end if;
    if b.id is null then
      insert into public.aia_monthly_batches(report_year,report_month,scope,as_of_date,updated_by)
      values(p_year,p_month,p_scope,p_as_of_date,p_actor) returning * into b;
    else
      update public.aia_monthly_batches set revision=revision+1,updated_by=p_actor,updated_at=now(),as_of_date=p_as_of_date
        where id=b.id returning * into b;
    end if;
    delete from public.aia_monthly_rows where batch_id=b.id;
    insert into public.aia_monthly_rows(batch_id,entity_code,entity_name,nickname,unit_id,unit_code,unit_name,
      month_cases,month_fyp,month_fyc,ytd_cases,ytd_fyp,ytd_fyc,exp,lap,limra,active_agents)
    select b.id,x.entity_code,x.entity_name,x.nickname,x.unit_id,x.unit_code,x.unit_name,
      x.month_cases,x.month_fyp,x.month_fyc,x.ytd_cases,x.ytd_fyp,x.ytd_fyc,x.exp,x.lap,x.limra,x.active_agents
    from jsonb_to_recordset(p_rows) as x(entity_code text,entity_name text,nickname text,unit_id bigint,unit_code text,unit_name text,
      month_cases integer,month_fyp numeric,month_fyc numeric,ytd_cases integer,ytd_fyp numeric,ytd_fyc numeric,exp numeric,lap numeric,limra numeric,active_agents integer);
    update public.aia_monthly_batches set status=case when p_action='confirm' then 'confirmed' else 'draft' end,
      confirmed_by=case when p_action='confirm' then p_actor else null end,
      confirmed_at=case when p_action='confirm' then now() else null end
      where id=b.id returning * into b;
  end if;
  select jsonb_build_object('batch',to_jsonb(b),'rows',coalesce(jsonb_agg(to_jsonb(r) order by r.entity_code),'[]'::jsonb))
    into after_data from public.aia_monthly_rows r where r.batch_id=b.id;
  insert into public.aia_monthly_audit(batch_id,revision,action,changed_by,before_snapshot,after_snapshot)
    values(b.id,b.revision,p_action,p_actor,before_data,after_data);
  return to_jsonb(b);
end;
$function$;
revoke all on function public.save_aia_monthly_batch(integer,integer,text,date,text,integer,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.save_aia_monthly_batch(integer,integer,text,date,text,integer,jsonb,uuid) to service_role;
commit;
