# Skool Member Classification — Release / Recovery Notes

## Scope
- Unlinked Skool learners are classified manually as pending, staff, or team_leader.
- Classification is independent of Agent Master and learning_course_progress. Existing 26 linked identities remain unchanged.
- Staff/team_leader categories are blocked from new agent matching by a PostgreSQL trigger; to match a newly appointed agent later, first reclassify to pending with a documented audit reason, then verify and match.
- Each classification change is stored in an append-only audit table. Do not auto-classify the 11 remaining accounts by name alone.
- The UI defaults to showing pending only; totals count all unlinked accounts.

## Installation
Run sql/skool_member_classification_20261116.sql in the verified Agent Tracking production Supabase SQL Editor (back up first).
The UI is read-only for classification until it detects both new tables. No SQL is run automatically by the web deployment.
Verify classification_table and classification_audit_table are non-null; classified_count initially 0.

## Verification
1. Confirm existing Skool totals (37/26/11/0 duplicates) did not change.
2. Confirm Training/Admin with full visibility can filter categories.
3. Classify one **verified** staff member with a documented non-sensitive reason; expect audit # and correct count.
4. Reimport CSV; staff classification remains and learning progress is unaffected.
5. Change the same test account back to pending and confirm second audit entry (if appropriate).
6. Ensure matching button is hidden for staff/leader and PostgreSQL trigger prevents direct linking.
7. Ensure users without matching permission cannot call classification API.
8. Confirm existing Agent PEP, Skool dashboard, Monthly Production remain intact.

## Does it protect against an outage?
No. This preserves durable classification/audit data while Supabase is operational, but is NOT disaster recovery.
To tolerate Vercel downtime or Supabase data loss separately implement and test scheduled database backups,
restore drills, documented RTO/RPO, a monitoring/alerting process, and verified exports of weekly Skool CSVs.
Avoid assuming plan-level backups or point-in-time recovery without checking actual Supabase project capabilities.
