# Skool Matching Safety + Audit Log — deployment checklist

**Deployment order matters. Never merge the branch before the SQL is installed and verified in the correct Agent Performance Hub Supabase project.**

## What changes
- Manual link requires exactly one active Agent Code, review of both identities, verification method and a minimum 8-character evidence note.
- One PostgreSQL RPC transaction links the Skool account and writes the immutable audit row. Failure of either operation rolls back both.
- Row locking serializes concurrent attempts for the same Agent Master identity.
- Existing links cannot be silently replaced/cleared by an import; matching does not edit Agent Master, Production, Quiz or PEP.
- Authorized Training/Admin can view the most recent 50 audit events. All other roles remain blocked.

## Supabase: once per project
1. In the **correct Supabase project for Agent Performance Hub**, back up relevant data and verify that `public.skool_members`, `public.agent_master` and their IDs exist.
2. In SQL Editor review and execute **`sql/skool_matching_safety_audit_20261116.sql`** as an authorized database administrator. SQL runs in one transaction.
3. Verify:
   ```sql
   select to_regclass('public.skool_member_match_audit') as audit_table;
   select routine_name from information_schema.routines
   where routine_schema = 'public'
     and routine_name = 'skool_link_member_audited';
   select count(*) from public.skool_member_match_audit;
   ```
4. Do not backfill records for matching actions performed before audit launch. Their historical operator identity and evidence cannot be reconstructed reliably.

## Preview QA before Production
1. Confirm full-scope Training/Admin can open Skool Member Matching and view empty/previous audit history.
2. Confirm Manager without full-scope matching permission receives 403.
3. Try an invalid Agent Code, mismatched name, unconfirmed identity and missing evidence; **no Skool link or audit row may be created**.
4. Verify two simultaneous matching attempts to the same Agent Code cannot both succeed.
5. Link one verified test member: the audit count increases by 1 and the same agent's Skool progress appears in the Learning and PEP views.
6. Reimport CSV and confirm the link remains and the audit history remains unchanged.
7. Recheck Google Forms, My Money Map and Monthly Production are unaffected.

## Operational notes
- Import CSV remains the authoritative progress data source.
- Audit covers only **new matches** made through this RPC after deployment. Previous links remain intact but have no manufactured audit entries.
- Correcting a mistaken historical link requires a **separate audited correction workflow**; do not edit `agent_id` directly.
- If the schema has not been installed, the new API fails closed with HTTP 503 on POST; never fall back to unaudited UPDATE.
- The connected Supabase account in ChatGPT currently does not expose the live Performance Hub project, so SQL execution and data-level verification require access to that correct project.
