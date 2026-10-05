import { timingSafeEqual } from "node:crypto";

import { NextResponse, type NextRequest } from "next/server";

import { getSupabaseClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
};

type JsonRecord = Record<string, unknown>;

function jsonResponse(body: JsonRecord, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: NO_STORE_HEADERS,
  });
}

function text(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function secureEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function authorized(request: NextRequest) {
  const expectedSecret = process.env.GOOGLE_FORM_WEBHOOK_SECRET?.trim() ?? "";

  if (!expectedSecret) {
    return { ok: false as const, configured: false as const };
  }

  const authorization = request.headers.get("authorization") ?? "";
  const prefix = "Bearer ";
  const receivedSecret = authorization.startsWith(prefix)
    ? authorization.slice(prefix.length).trim()
    : "";

  return {
    ok: Boolean(receivedSecret) && secureEquals(receivedSecret, expectedSecret),
    configured: true as const,
  };
}

export async function POST(request: NextRequest) {
  const auth = authorized(request);

  if (!auth.configured) {
    console.error(
      "[google-form-quiz] GOOGLE_FORM_WEBHOOK_SECRET is not configured"
    );
    return jsonResponse(
      { success: false, error: "Quiz integration is not configured" },
      503
    );
  }

  if (!auth.ok) {
    return jsonResponse({ success: false, error: "Unauthorized" }, 401);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonResponse({ success: false, error: "Invalid JSON" }, 400);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonResponse({ success: false, error: "Invalid request body" }, 400);
  }

  const data = body as JsonRecord;
  const formId = text(data.formId, 200);
  const responseId = text(data.responseId, 200);
  const agentCode = text(data.agentCode, 50);
  const agentEmail = text(data.agentEmail, 320).toLowerCase() || null;
  const score = number(data.score);
  const maxScore = number(data.maxScore);
  const submittedAtText = text(data.submittedAt, 100);
  const submittedAt = new Date(submittedAtText);

  if (!formId || !responseId || !agentCode) {
    return jsonResponse(
      {
        success: false,
        error: "formId, responseId and agentCode are required",
      },
      400
    );
  }

  if (
    score === null ||
    maxScore === null ||
    score < 0 ||
    maxScore <= 0 ||
    score > maxScore
  ) {
    return jsonResponse({ success: false, error: "Invalid quiz score" }, 400);
  }

  if (!submittedAtText || Number.isNaN(submittedAt.getTime())) {
    return jsonResponse({ success: false, error: "Invalid submittedAt" }, 400);
  }

  try {
    const supabase = getSupabaseClient();

    const [lessonResult, agentResult] = await Promise.all([
      supabase
        .from("learning_lessons")
        .select(
          "id, lesson_name, lesson_type, passing_score_percent, active"
        )
        .eq("google_form_id", formId)
        .eq("active", true)
        .maybeSingle(),
      supabase
        .from("agent_master")
        .select("id, agent_code, agent_name, active")
        .eq("agent_code", agentCode)
        .eq("active", true)
        .maybeSingle(),
    ]);

    if (lessonResult.error) {
      console.error(
        "[google-form-quiz] lesson lookup error:",
        lessonResult.error
      );
      return jsonResponse(
        { success: false, error: "Unable to verify quiz lesson" },
        500
      );
    }

    if (agentResult.error) {
      console.error(
        "[google-form-quiz] agent lookup error:",
        agentResult.error
      );
      return jsonResponse(
        { success: false, error: "Unable to verify agent" },
        500
      );
    }

    const lesson = lessonResult.data;
    const agent = agentResult.data;

    if (!lesson || lesson.lesson_type !== "QUIZ") {
      return jsonResponse(
        { success: false, error: "Google Form is not linked to an active quiz" },
        404
      );
    }

    if (!agent) {
      return jsonResponse(
        { success: false, error: "Agent code was not found" },
        404
      );
    }

    const scorePercent = Math.round((score / maxScore) * 10_000) / 100;
    const passingScore = Number(lesson.passing_score_percent ?? 80);
    const passed = scorePercent >= passingScore;
    const now = new Date().toISOString();

    const { data: saved, error: saveError } = await supabase
      .from("learning_quiz_results")
      .upsert(
        {
          lesson_id: lesson.id,
          agent_id: agent.id,
          google_form_id: formId,
          google_response_id: responseId,
          agent_code: String(agent.agent_code ?? agentCode),
          agent_email: agentEmail,
          score,
          max_score: maxScore,
          score_percent: scorePercent,
          passed,
          submitted_at: submittedAt.toISOString(),
          source: "google_forms",
          updated_at: now,
        },
        { onConflict: "google_form_id,google_response_id" }
      )
      .select("id, score_percent, passed, submitted_at")
      .single();

    if (saveError) {
      console.error("[google-form-quiz] save error:", saveError);
      return jsonResponse(
        { success: false, error: "Unable to save quiz result" },
        500
      );
    }

    return jsonResponse({
      success: true,
      result: {
        id: saved.id,
        agentCode: agent.agent_code,
        agentName: agent.agent_name,
        lessonId: lesson.id,
        lessonName: lesson.lesson_name,
        scorePercent: saved.score_percent,
        passed: saved.passed,
        submittedAt: saved.submitted_at,
      },
    });
  } catch (error) {
    console.error("[google-form-quiz] unexpected error:", error);
    return jsonResponse(
      { success: false, error: "Unable to process quiz result" },
      500
    );
  }
}

export async function GET() {
  return jsonResponse({ success: false, error: "Method not allowed" }, 405);
}

export async function PUT() {
  return jsonResponse({ success: false, error: "Method not allowed" }, 405);
}

export async function PATCH() {
  return jsonResponse({ success: false, error: "Method not allowed" }, 405);
}

export async function DELETE() {
  return jsonResponse({ success: false, error: "Method not allowed" }, 405);
}
