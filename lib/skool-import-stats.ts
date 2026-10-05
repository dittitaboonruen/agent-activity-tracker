import type { SupabaseClient } from "@supabase/supabase-js";

export type CourseImportStats = {
  members: number;
  completed: number;
  averageProgress: number;
  lastSyncedAt: string | null;
};

export async function getCourseImportStats(
  supabase: SupabaseClient
) {
  const stats: Record<string, CourseImportStats> = {};
  const sums: Record<string, number> = {};
  const pageSize = 500;

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("learning_course_progress")
      .select(
        "course_id, skool_member_id, progress_percent, completed, synced_at"
      )
      .order("course_id", { ascending: true })
      .order("skool_member_id", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) throw error;

    for (const row of data ?? []) {
      const key = String(row.course_id);

      const item = (stats[key] ??= {
        members: 0,
        completed: 0,
        averageProgress: 0,
        lastSyncedAt: null,
      });

      item.members += 1;

      if (row.completed) {
        item.completed += 1;
      }

      sums[key] =
        (sums[key] ?? 0) + Number(row.progress_percent);

      if (
        row.synced_at &&
        (!item.lastSyncedAt || row.synced_at > item.lastSyncedAt)
      ) {
        item.lastSyncedAt = row.synced_at;
      }
    }

    if (!data || data.length < pageSize) break;
  }

  for (const [key, item] of Object.entries(stats)) {
    item.averageProgress =
      Math.round((sums[key] / item.members) * 10) / 10;
  }

  return stats;
}
