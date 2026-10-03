import { NextResponse, type NextRequest } from "next/server";

import { checkRateLimit } from "@/lib/rate-limit";
import { getSupabaseClient } from "@/lib/supabase";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" };
const ALLOWED_EMAILS = new Set([
  "training@royalpartner.org",
  "newagent@royalpartner.org",
]);

type Entity = "course" | "lesson";
type Body = Record<string, unknown>;

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { success: false, error: message },
    { status, headers: NO_STORE_HEADERS }
  );
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function integer(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function boolean(value: unknown, fallback = true) {
  return typeof value === "boolean" ? value : fallback;
}

function validQuizUrl(value: string) {
  if (!value) return true;

  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      ["docs.google.com", "forms.gle"].includes(url.hostname.toLowerCase())
    );
  } catch {
    return false;
  }
}

async function verifyAdmin() {
  const authClient = createClient();
  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser();

  if (userError || !user?.email) {
    return { allowed: false as const, status: 401, message: "กรุณาเข้าสู่ระบบใหม่" };
  }

  const email = user.email.trim().toLowerCase();

  if (!ALLOWED_EMAILS.has(email)) {
    return {
      allowed: false as const,
      status: 403,
      message: "บัญชีนี้ไม่มีสิทธิ์จัดการคอร์ส Skool",
    };
  }

  const { data: profile, error: profileError } = await authClient
    .from("user_profiles")
    .select("active, role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (
    profileError ||
    !profile ||
    profile.active !== true ||
    !["admin", "manager"].includes(String(profile.role).toLowerCase())
  ) {
    return {
      allowed: false as const,
      status: 403,
      message: "บัญชีนี้ยังไม่ได้รับอนุญาต",
    };
  }

  return { allowed: true as const };
}

async function parseBody(request: NextRequest) {
  try {
    const body = (await request.json()) as unknown;
    if (typeof body !== "object" || body === null) return null;
    return body as Body;
  } catch {
    return null;
  }
}

export async function GET() {
  const access = await verifyAdmin();
  if (!access.allowed) return errorResponse(access.message, access.status);

  try {
    const supabase = getSupabaseClient();
    const [courseResult, lessonResult] = await Promise.all([
      supabase
        .from("learning_courses")
        .select("id, course_code, course_name, description, sort_order, active")
        .order("sort_order", { ascending: true })
        .order("course_name", { ascending: true }),
      supabase
        .from("learning_lessons")
        .select(
          "id, course_id, lesson_name, lesson_type, lesson_order, quiz_url, active"
        )
        .order("lesson_order", { ascending: true })
        .order("id", { ascending: true }),
    ]);

    if (courseResult.error || lessonResult.error) {
      console.error("[skool-courses] GET error:", {
        courses: courseResult.error,
        lessons: lessonResult.error,
      });
      return errorResponse("ไม่สามารถโหลดข้อมูลคอร์สและบทเรียนได้", 500);
    }

    return NextResponse.json(
      {
        success: true,
        courses: courseResult.data ?? [],
        lessons: lessonResult.data ?? [],
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    console.error("[skool-courses] GET unexpected error:", error);
    return errorResponse("เกิดข้อผิดพลาดในการโหลดข้อมูล", 500);
  }
}

async function save(request: NextRequest) {
  const rate = checkRateLimit(request);
  if (!rate.allowed) {
    return errorResponse("กรุณารอสักครู่ก่อนลองใหม่อีกครั้ง", 429);
  }

  const access = await verifyAdmin();
  if (!access.allowed) return errorResponse(access.message, access.status);

  const body = await parseBody(request);
  if (!body) return errorResponse("ข้อมูลที่ส่งมาไม่ถูกต้อง", 400);

  const entity = text(body.entity) as Entity;
  const id = integer(body.id);
  const now = new Date().toISOString();

  try {
    const supabase = getSupabaseClient();

    if (entity === "course") {
      const courseName = text(body.courseName);
      const courseCode = text(body.courseCode);
      const description = text(body.description);
      const sortOrder = integer(body.sortOrder);

      if (!courseName) return errorResponse("กรุณาระบุชื่อคอร์ส", 400);
      if (sortOrder === null || sortOrder < 0) {
        return errorResponse("ลำดับคอร์สไม่ถูกต้อง", 400);
      }

      const payload = {
        course_name: courseName,
        course_code: courseCode || null,
        description: description || null,
        sort_order: sortOrder,
        active: boolean(body.active),
        updated_at: now,
      };

      const query = id
        ? supabase.from("learning_courses").update(payload).eq("id", id)
        : supabase.from("learning_courses").insert(payload);

      const { data, error } = await query.select().single();

      if (error) {
        console.error("[skool-courses] save course error:", error);
        return errorResponse(
          error.code === "23505"
            ? "ชื่อหรือรหัสคอร์สนี้มีอยู่แล้ว"
            : "ไม่สามารถบันทึกคอร์สได้",
          error.code === "23505" ? 409 : 500
        );
      }

      return NextResponse.json(
        { success: true, item: data },
        { headers: NO_STORE_HEADERS }
      );
    }

    if (entity === "lesson") {
      const courseId = integer(body.courseId);
      const lessonName = text(body.lessonName);
      const lessonType = text(body.lessonType).toUpperCase();
      const lessonOrder = integer(body.lessonOrder);
      const quizUrl = text(body.quizUrl);

      if (!courseId || courseId < 1) {
        return errorResponse("กรุณาเลือกคอร์ส", 400);
      }
      if (!lessonName) return errorResponse("กรุณาระบุชื่อบทเรียน", 400);
      if (!["INFO", "QUIZ"].includes(lessonType)) {
        return errorResponse("ประเภทบทเรียนไม่ถูกต้อง", 400);
      }
      if (lessonOrder === null || lessonOrder < 1) {
        return errorResponse("ลำดับบทเรียนไม่ถูกต้อง", 400);
      }
      if (lessonType === "QUIZ" && !quizUrl) {
        return errorResponse("บทประเภท QUIZ ต้องมีลิงก์ Google Form", 400);
      }
      if (!validQuizUrl(quizUrl)) {
        return errorResponse("ลิงก์แบบทดสอบต้องเป็น Google Forms แบบ https", 400);
      }

      const payload = {
        course_id: courseId,
        lesson_name: lessonName,
        lesson_type: lessonType,
        lesson_order: lessonOrder,
        quiz_url: lessonType === "QUIZ" ? quizUrl : null,
        active: boolean(body.active),
        updated_at: now,
      };

      const query = id
        ? supabase.from("learning_lessons").update(payload).eq("id", id)
        : supabase.from("learning_lessons").insert(payload);

      const { data, error } = await query.select().single();

      if (error) {
        console.error("[skool-courses] save lesson error:", error);
        return errorResponse("ไม่สามารถบันทึกบทเรียนได้", 500);
      }

      return NextResponse.json(
        { success: true, item: data },
        { headers: NO_STORE_HEADERS }
      );
    }

    return errorResponse("ไม่รู้จักประเภทข้อมูลนี้", 400);
  } catch (error) {
    console.error("[skool-courses] save unexpected error:", error);
    return errorResponse("เกิดข้อผิดพลาดในการบันทึกข้อมูล", 500);
  }
}

export async function POST(request: NextRequest) {
  return save(request);
}

export async function PATCH(request: NextRequest) {
  return save(request);
}

export async function DELETE(request: NextRequest) {
  const rate = checkRateLimit(request);
  if (!rate.allowed) {
    return errorResponse("กรุณารอสักครู่ก่อนลองใหม่อีกครั้ง", 429);
  }

  const access = await verifyAdmin();
  if (!access.allowed) return errorResponse(access.message, access.status);

  const body = await parseBody(request);
  if (!body) return errorResponse("ข้อมูลที่ส่งมาไม่ถูกต้อง", 400);

  const entity = text(body.entity) as Entity;
  const id = integer(body.id);
  if (!id || id < 1) return errorResponse("รหัสข้อมูลไม่ถูกต้อง", 400);

  const table =
    entity === "course"
      ? "learning_courses"
      : entity === "lesson"
        ? "learning_lessons"
        : null;

  if (!table) return errorResponse("ไม่รู้จักประเภทข้อมูลนี้", 400);

  try {
    const { data, error } = await getSupabaseClient()
      .from(table)
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("[skool-courses] deactivate error:", error);
      return errorResponse("ไม่สามารถปิดใช้งานข้อมูลได้", 500);
    }

    if (!data) return errorResponse("ไม่พบข้อมูลที่ต้องการ", 404);

    return NextResponse.json(
      { success: true },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    console.error("[skool-courses] deactivate unexpected error:", error);
    return errorResponse("เกิดข้อผิดพลาดในการปิดใช้งานข้อมูล", 500);
  }
}
