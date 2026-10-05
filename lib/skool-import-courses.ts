import type { SupabaseClient } from "@supabase/supabase-js";

export type ImportedCourse = {
  id: number;
  course_name: string;
  active: boolean;
  created: boolean;
};

/** Insert missing Classrooms only. Never overwrite an admin's course settings. */
export async function ensureImportCourses(
  supabase: SupabaseClient,
  classrooms: string[],
  now: string
): Promise<ImportedCourse[]> {
  const names = Array.from(new Set(classrooms));

  const { data, error } = await supabase
    .from("learning_courses")
    .select("id, course_name, active")
    .in("course_name", names);

  if (error) throw error;

  const existing = new Map<string, ImportedCourse>();

  for (const course of data ?? []) {
    if (existing.has(course.course_name)) {
      throw new Error("DUPLICATE_CLASSROOM");
    }

    existing.set(course.course_name, {
      ...course,
      created: false,
    });
  }

  if (names.every((name) => existing.has(name))) {
    return names.map((name) => existing.get(name)!);
  }

  const { data: last, error: orderError } = await supabase
    .from("learning_courses")
    .select("sort_order")
    .order("sort_order", {
      ascending: false,
      nullsFirst: false,
    })
    .limit(1);

  if (orderError) throw orderError;

  let order = Math.max(0, Number(last?.[0]?.sort_order) || 0);

  for (const name of names) {
    if (existing.has(name)) continue;

    const { data: inserted, error: insertError } = await supabase
      .from("learning_courses")
      .insert({
        course_name: name,
        course_code: null,
        description: null,
        sort_order: ++order,
        active: true,
        updated_at: now,
      })
      .select("id, course_name, active")
      .single();

    // A simultaneous import may have inserted the same unique Classroom.
    if (insertError?.code === "23505") {
      const { data: winner, error: lookupError } = await supabase
        .from("learning_courses")
        .select("id, course_name, active")
        .eq("course_name", name)
        .single();

      if (lookupError || !winner) {
        throw lookupError ?? insertError;
      }

      existing.set(name, {
        ...winner,
        created: false,
      });
    } else {
      if (insertError || !inserted) {
        throw insertError ?? new Error("COURSE_INSERT");
      }

      existing.set(name, {
        ...inserted,
        created: true,
      });
    }
  }

  return names.map((name) => existing.get(name)!);
}
