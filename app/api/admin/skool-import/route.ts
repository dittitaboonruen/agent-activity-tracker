import { NextResponse, type NextRequest } from "next/server";

import { checkRateLimit } from "@/lib/rate-limit";
import { getSupabaseClient } from "@/lib/supabase";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
};

const MAX_FILE_SIZE = 1_000_000;
const MAX_ROWS = 500;

const ALLOWED_IMPORTERS = new Set([
  "training@royalpartner.org",
  "newagent@royalpartner.org",
]);

const REQUIRED_HEADERS = [
  "Classroom",
  "Has Access",
  "First Name",
  "Last Name",
  "Tier",
  "Skool Profile",
  "Progress %",
  "Completed",
  "Joined Date",
  "Last Active Date",
  "Started Step",
] as const;

type CsvRow = Record<string, string>;

type ValidatedRow = {
  classroom: string;
  hasAccess: boolean;
  firstName: string;
  lastName: string;
  tier: string | null;
  profileUrl: string;
  progressPercent: number;
  completed: boolean;
  joinedAt: string | null;
  lastActiveAt: string | null;
  started: boolean;
};

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { success: false, error: message },
    { status, headers: NO_STORE_HEADERS }
  );
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  const input = text.replace(/^\uFEFF/, "");

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];

    if (quoted) {
      if (character === '"') {
        if (input[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += character;
      }

      continue;
    }

    if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(field.trim());
      field = "";
    } else if (character === "\n") {
      row.push(field.trim());
      field = "";

      if (row.some((value) => value !== "")) {
        rows.push(row);
      }

      row = [];
    } else if (character !== "\r") {
      field += character;
    }
  }

  if (quoted) {
    throw new Error("CSV_QUOTE");
  }

  row.push(field.trim());

  if (row.some((value) => value !== "")) {
    rows.push(row);
  }

  return rows;
}

function toRecords(rows: string[][]): CsvRow[] {
  if (rows.length < 2) {
    throw new Error("CSV_EMPTY");
  }

  const headers = rows[0].map((header) => header.trim());
  const missingHeaders = REQUIRED_HEADERS.filter(
    (header) => !headers.includes(header)
  );

  if (missingHeaders.length > 0) {
    throw new Error(`CSV_HEADERS:${missingHeaders.join(", ")}`);
  }

  return rows.slice(1).map((values) => {
    const record: CsvRow = {};

    headers.forEach((header, index) => {
      record[header] = values[index]?.trim() ?? "";
    });

    return record;
  });
}

function parseYesNo(value: string, rowNumber: number, field: string) {
  const normalized = value.trim().toLowerCase();

  if (normalized === "yes") return true;
  if (normalized === "no") return false;

  throw new Error(`ROW:${rowNumber}:${field} ต้องเป็น Yes หรือ No`);
}

function parseDate(value: string, rowNumber: number, field: string) {
  const normalized = value.trim();

  if (!normalized) return null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new Error(`ROW:${rowNumber}:${field} ต้องเป็น YYYY-MM-DD`);
  }

  const date = new Date(`${normalized}T00:00:00.000Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== normalized
  ) {
    throw new Error(`ROW:${rowNumber}:${field} ไม่ถูกต้อง`);
  }

  return date.toISOString();
}

function normalizeProfileUrl(value: string, rowNumber: number) {
  try {
    const url = new URL(value.trim());
    const hostname = url.hostname.toLowerCase();

    if (
      url.protocol !== "https:" ||
      (hostname !== "skool.com" && hostname !== "www.skool.com") ||
      !url.pathname.startsWith("/@")
    ) {
      throw new Error("INVALID");
    }

    const pathname = url.pathname.replace(/\/+$/, "");
    return `https://www.skool.com${pathname}`;
  } catch {
    throw new Error(`ROW:${rowNumber}:Skool Profile ไม่ถูกต้อง`);
  }
}

function validateRows(records: CsvRow[]): ValidatedRow[] {
  if (records.length > MAX_ROWS) {
    throw new Error(`CSV_ROWS:ไฟล์ต้องมีไม่เกิน ${MAX_ROWS} รายการ`);
  }

  const validated = records.map((record, index) => {
    const rowNumber = index + 2;
    const classroom = record["Classroom"].trim();
    const firstName = record["First Name"].trim();
    const lastName = record["Last Name"].trim();

    if (!classroom || !firstName || !lastName) {
      throw new Error(
        `ROW:${rowNumber}:Classroom, First Name และ Last Name ห้ามว่าง`
      );
    }

    const progressPercent = Number(record["Progress %"]);

    if (
      !Number.isFinite(progressPercent) ||
      progressPercent < 0 ||
      progressPercent > 100
    ) {
      throw new Error(`ROW:${rowNumber}:Progress % ต้องอยู่ระหว่าง 0-100`);
    }

    const completedFromCsv = parseYesNo(
      record.Completed,
      rowNumber,
      "Completed"
    );

    return {
      classroom,
      hasAccess: parseYesNo(
        record["Has Access"],
        rowNumber,
        "Has Access"
      ),
      firstName,
      lastName,
      tier: record.Tier.trim() || null,
      profileUrl: normalizeProfileUrl(
        record["Skool Profile"],
        rowNumber
      ),
      progressPercent,
      completed: completedFromCsv || progressPercent >= 100,
      joinedAt: parseDate(record["Joined Date"], rowNumber, "Joined Date"),
      lastActiveAt: parseDate(
        record["Last Active Date"],
        rowNumber,
        "Last Active Date"
      ),
      started: parseYesNo(
        record["Started Step"],
        rowNumber,
        "Started Step"
      ),
    };
  });

  const uniqueRows = new Map<string, ValidatedRow>();

  validated.forEach((row) => {
    uniqueRows.set(`${row.profileUrl}\n${row.classroom}`, row);
  });

  return Array.from(uniqueRows.values());
}

function readableCsvError(error: unknown) {
  if (!(error instanceof Error)) {
    return "ไม่สามารถอ่านไฟล์ CSV ได้";
  }

  if (error.message === "CSV_EMPTY") {
    return "ไฟล์ CSV ไม่มีข้อมูลสมาชิก";
  }

  if (error.message === "CSV_QUOTE") {
    return "รูปแบบเครื่องหมายคำพูดในไฟล์ CSV ไม่สมบูรณ์";
  }

  if (error.message.startsWith("CSV_HEADERS:")) {
    return `ไฟล์ CSV ขาดหัวตาราง: ${error.message.slice(12)}`;
  }

  if (error.message.startsWith("CSV_ROWS:")) {
    return error.message.slice(9);
  }

  if (error.message.startsWith("ROW:")) {
    const [, rowNumber, message] = error.message.split(":");
    return `แถวที่ ${rowNumber}: ${message}`;
  }

  return "ไม่สามารถอ่านไฟล์ CSV ได้";
}

async function verifyImporter() {
  const authClient = createClient();
  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser();

  if (userError || !user?.email) {
    return { allowed: false as const, status: 401, message: "กรุณาเข้าสู่ระบบใหม่" };
  }

  const email = user.email.trim().toLowerCase();

  if (!ALLOWED_IMPORTERS.has(email)) {
    return {
      allowed: false as const,
      status: 403,
      message: "บัญชีนี้ไม่มีสิทธิ์นำเข้าข้อมูล Skool",
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

  return { allowed: true as const, email };
}

export async function POST(request: NextRequest) {
  const rate = checkRateLimit(request);

  if (!rate.allowed) {
    return errorResponse("กรุณารอสักครู่ก่อนลองใหม่อีกครั้ง", 429);
  }

  const access = await verifyImporter();

  if (!access.allowed) {
    return errorResponse(access.message, access.status);
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return errorResponse("ข้อมูลอัปโหลดไม่ถูกต้อง", 400);
  }

  const file = formData.get("file");

  if (!(file instanceof File)) {
    return errorResponse("กรุณาเลือกไฟล์ CSV", 400);
  }

  if (!file.name.toLowerCase().endsWith(".csv")) {
    return errorResponse("รองรับเฉพาะไฟล์ .csv", 400);
  }

  if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
    return errorResponse("ไฟล์ต้องมีขนาดไม่เกิน 1 MB", 400);
  }

  let rows: ValidatedRow[];

  try {
    const text = await file.text();
    rows = validateRows(toRecords(parseCsv(text)));
  } catch (error) {
    return errorResponse(readableCsvError(error), 400);
  }

  try {
    const supabase = getSupabaseClient();
    const now = new Date().toISOString();
    const classrooms = Array.from(new Set(rows.map((row) => row.classroom)));

    const { data: courses, error: coursesError } = await supabase
      .from("learning_courses")
      .select("id, course_name")
      .in("course_name", classrooms)
      .eq("active", true);

    if (coursesError) {
      console.error("[skool-import] course lookup error:", coursesError);
      return errorResponse("ไม่สามารถตรวจสอบคอร์สได้", 500);
    }

    const courseByName = new Map(
      (courses ?? []).map((course) => [String(course.course_name), course.id])
    );

    const missingCourses = classrooms.filter(
      (classroom) => !courseByName.has(classroom)
    );

    if (missingCourses.length > 0) {
      return errorResponse(
        `ยังไม่มีคอร์สในระบบ: ${missingCourses.slice(0, 3).join(", ")}`,
        400
      );
    }

    const profileUrls = Array.from(
      new Set(rows.map((row) => row.profileUrl))
    );

    const { data: existingMembers, error: existingMembersError } =
      await supabase
        .from("skool_members")
        .select("skool_profile_url, agent_id, email")
        .in("skool_profile_url", profileUrls);

    if (existingMembersError) {
      console.error(
        "[skool-import] existing member lookup error:",
        existingMembersError
      );
      return errorResponse("ไม่สามารถตรวจสอบสมาชิก Skool ได้", 500);
    }

    const existingMemberByProfile = new Map(
      (existingMembers ?? []).map((member) => [
        String(member.skool_profile_url),
        {
          agentId: member.agent_id,
          email: member.email,
        },
      ])
    );

    const memberPayload = Array.from(
      new Map(
        rows.map((row) => {
          const existingMember = existingMemberByProfile.get(row.profileUrl);

          return [
            row.profileUrl,
            {
              skool_profile_url: row.profileUrl,
              first_name: row.firstName,
              last_name: row.lastName,
              tier: row.tier,
              email: existingMember?.email ?? null,
              agent_id: existingMember?.agentId ?? null,
              joined_at: row.joinedAt,
              last_active_at: row.lastActiveAt,
              active: row.hasAccess,
              updated_at: now,
            },
          ] as const;
        })
      ).values()
    );

    const { data: members, error: membersError } = await supabase
      .from("skool_members")
      .upsert(memberPayload, { onConflict: "skool_profile_url" })
      .select("id, skool_profile_url, agent_id");

    if (membersError) {
      console.error("[skool-import] member upsert error:", membersError);
      return errorResponse("ไม่สามารถบันทึกสมาชิก Skool ได้", 500);
    }

    const memberByProfile = new Map(
      (members ?? []).map((member) => [
        String(member.skool_profile_url),
        { id: member.id, agentId: member.agent_id },
      ])
    );

    const progressPayload = rows.map((row) => {
      const member = memberByProfile.get(row.profileUrl);
      const courseId = courseByName.get(row.classroom);

      if (!member || courseId === undefined) {
        throw new Error("IMPORT_MAPPING");
      }

      return {
        skool_member_id: member.id,
        course_id: courseId,
        has_access: row.hasAccess,
        progress_percent: row.progressPercent,
        started: row.started || row.progressPercent > 0,
        completed: row.completed,
        source: "classroom_scout_csv",
        source_file_name: file.name.slice(0, 255),
        synced_at: now,
        updated_at: now,
      };
    });

    const { error: progressError } = await supabase
      .from("learning_course_progress")
      .upsert(progressPayload, {
        onConflict: "skool_member_id,course_id",
      });

    if (progressError) {
      console.error("[skool-import] progress upsert error:", progressError);
      return errorResponse("ไม่สามารถบันทึกความคืบหน้าการเรียนได้", 500);
    }

    const linkedMembers = (members ?? []).filter(
      (member) => member.agent_id !== null
    ).length;

    return NextResponse.json(
      {
        success: true,
        message: "นำเข้าข้อมูล Skool เรียบร้อยแล้ว",
        summary: {
          importedRows: rows.length,
          courses: classrooms.length,
          members: memberPayload.length,
          linkedAgents: linkedMembers,
          unlinkedMembers: memberPayload.length - linkedMembers,
        },
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    console.error("[skool-import] unexpected error:", error);
    return errorResponse("เกิดข้อผิดพลาดในการนำเข้าข้อมูล Skool", 500);
  }
}

export async function GET() {
  return errorResponse("Method not allowed.", 405);
}

export async function PUT() {
  return errorResponse("Method not allowed.", 405);
}

export async function PATCH() {
  return errorResponse("Method not allowed.", 405);
}

export async function DELETE() {
  return errorResponse("Method not allowed.", 405);
}
