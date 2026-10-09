import {
  NextResponse,
  type NextRequest,
} from "next/server";

import {
  getSupabaseClient,
} from "@/lib/supabase";

import {
  getSkoolAccess,
} from "@/lib/skool-access";

import {
  LearningFilterError,
  readLearningAgentId,
} from "@/lib/learning-filter";

import type {
  QuizResultRow,
} from "@/lib/skool-quiz";

export const dynamic =
  "force-dynamic";

export const revalidate = 0;

export const runtime =
  "nodejs";

const headers = {
  "Cache-Control":
    "no-store, max-age=0",
};

/**
 * Royal Partner Quiz Standard
 * 60% ขึ้นไป = ผ่าน
 */
const PASSING_SCORE_PERCENT =
  60;

const json = (
  body: unknown,
  status = 200
) =>
  NextResponse.json(
    body,
    {
      status,
      headers,
    }
  );

async function allRows(
  query: () => any
): Promise<any[]> {
  const rows: any[] = [];

  for (
    let offset = 0;
    ;
    offset += 500
  ) {
    const {
      data,
      error,
    } =
      await query().range(
        offset,
        offset + 499
      );

    if (error) {
      throw error;
    }

    rows.push(
      ...(data ?? [])
    );

    if (
      !data ||
      data.length < 500
    ) {
      return rows;
    }
  }
}

export async function GET(
  request: NextRequest
) {
  const access =
    await getSkoolAccess();

  if (!access.allowed) {
    return json(
      {
        success: false,
        error:
          access.message,
      },
      access.status
    );
  }

  try {
    const selectedAgentId =
      readLearningAgentId(
        request?.url
      );

    const db =
      getSupabaseClient();

    const agents =
      await allRows(() => {
        let q =
          db
            .from(
              "agent_master"
            )
            .select(
              "id, agent_code, agent_name, agent_nickname, unit_id"
            )
            .eq(
              "active",
              true
            )
            .order("id");

        if (
          !access.canSeeAll
        ) {
          q =
            q.eq(
              "unit_id",
              access.unitId!
            );
        }

        if (
          selectedAgentId !==
          null
        ) {
          q =
            q.eq(
              "id",
              selectedAgentId
            );
        }

        return q;
      });

    if (
      selectedAgentId !==
        null &&
      agents.length === 0
    ) {
      return json(
        {
          success: false,
          error:
            "ไม่พบตัวแทนที่เลือกในข้อมูลที่คุณมีสิทธิ์ดู",
        },
        404
      );
    }

    if (
      agents.length === 0
    ) {
      return json({
        success: true,
        scope: access,
        rows: [],
      });
    }

    const agentIds =
      agents.map(
        (agent) =>
          agent.id
      );

    const results =
      await allRows(() =>
        db
          .from(
            "learning_quiz_results"
          )
          .select(
            "id, agent_id, lesson_id, score, max_score, score_percent, passed, submitted_at, updated_at"
          )
          .in(
            "agent_id",
            agentIds
          )
          .order("id")
      );

    if (
      results.length === 0
    ) {
      return json({
        success: true,
        scope: access,
        rows: [],
      });
    }

    const lessonIds = [
      ...new Set(
        results.map(
          (result) =>
            result.lesson_id
        )
      ),
    ];

    const unitIds = [
      ...new Set(
        agents
          .map(
            (agent) =>
              agent.unit_id
          )
          .filter(
            (id) =>
              id !== null
          )
      ),
    ];

    const [
      lessons,
      units,
    ] =
      await Promise.all([
        allRows(() =>
          db
            .from(
              "learning_lessons"
            )
            .select(
              "id, course_id, lesson_name, parent_lesson_id, active"
            )
            .in(
              "id",
              lessonIds
            )
            .order("id")
        ),

        unitIds.length
          ? allRows(() =>
              db
                .from(
                  "units"
                )
                .select(
                  "id, unit_name"
                )
                .in(
                  "id",
                  unitIds
                )
                .order(
                  "id"
                )
            )
          : Promise.resolve(
              []
            ),
      ]);

    const parentIds = [
      ...new Set(
        lessons
          .map(
            (lesson) =>
              lesson.parent_lesson_id
          )
          .filter(
            (id) =>
              id !== null
          )
      ),
    ];

    const courseIds = [
      ...new Set(
        lessons.map(
          (lesson) =>
            lesson.course_id
        )
      ),
    ];

    const [
      parents,
      courses,
    ] =
      await Promise.all([
        parentIds.length
          ? allRows(() =>
              db
                .from(
                  "learning_lessons"
                )
                .select(
                  "id, lesson_name"
                )
                .in(
                  "id",
                  parentIds
                )
                .order(
                  "id"
                )
            )
          : Promise.resolve(
              []
            ),

        courseIds.length
          ? allRows(() =>
              db
                .from(
                  "learning_courses"
                )
                .select(
                  "id, course_name"
                )
                .in(
                  "id",
                  courseIds
                )
                .order(
                  "id"
                )
            )
          : Promise.resolve(
              []
            ),
      ]);

    const agentMap =
      new Map(
        agents.map(
          (agent) => [
            agent.id,
            agent,
          ]
        )
      );

    const unitMap =
      new Map(
        units.map(
          (unit) => [
            unit.id,
            unit,
          ]
        )
      );

    const lessonMap =
      new Map(
        lessons.map(
          (lesson) => [
            lesson.id,
            lesson,
          ]
        )
      );

    const parentMap =
      new Map(
        parents.map(
          (lesson) => [
            lesson.id,
            lesson,
          ]
        )
      );

    const courseMap =
      new Map(
        courses.map(
          (course) => [
            course.id,
            course,
          ]
        )
      );

    const rows:
      QuizResultRow[] =
      results
        .map(
          (result) => {
            const agent =
              agentMap.get(
                result.agent_id
              );

            const lesson =
              lessonMap.get(
                result.lesson_id
              );

            if (
              !agent ||
              !lesson
            ) {
              throw new Error(
                "Quiz relation missing"
              );
            }

            const score =
              Number(
                result.score
              );

            const maxScore =
              Number(
                result.max_score
              );

            /**
             * Recalculate percentage
             * เพื่อให้ข้อมูลเก่าและใหม่ใช้กติกาเดียวกัน
             */
            const scorePercent =
              maxScore > 0
                ? Math.round(
                    (score /
                      maxScore) *
                      10_000
                  ) / 100
                : Number(
                    result.score_percent ??
                      0
                  );

            /**
             * สำคัญ:
             * ไม่ใช้ค่า passed เก่าจาก DB
             * เพราะข้อมูลเก่าอาจคำนวณด้วยเกณฑ์ 80%
             */
            const passed =
              scorePercent >=
              PASSING_SCORE_PERCENT;

            return {
              id:
                result.id,

              agentId:
                agent.id,

              agentCode:
                agent.agent_code ??
                "",

              agentName:
                agent.agent_name ??
                "",

              agentNickname:
                agent.agent_nickname ??
                "",

              unitId:
                agent.unit_id,

              unitName:
                unitMap.get(
                  agent.unit_id
                )?.unit_name ??
                "ไม่ระบุหน่วย",

              courseId:
                lesson.course_id,

              courseName:
                courseMap.get(
                  lesson.course_id
                )?.course_name ??
                "ไม่ระบุคอร์ส",

              lessonId:
                lesson.id,

              lessonName:
                lesson.lesson_name,

              parentLessonName:
                parentMap.get(
                  lesson.parent_lesson_id
                )?.lesson_name ??
                "",

              lessonActive:
                lesson.active ===
                true,

              score,

              maxScore,

              scorePercent,

              passed,

              submittedAt:
                result.submitted_at,

              updatedAt:
                result.updated_at,
            };
          }
        )
        .sort(
          (a, b) =>
            b.submittedAt.localeCompare(
              a.submittedAt
            ) ||
            b.id - a.id
        );

    return json({
      success: true,
      scope: access,
      passingScorePercent:
        PASSING_SCORE_PERCENT,
      rows,
    });
  } catch (error) {
    if (
      error instanceof
      LearningFilterError
    ) {
      return json(
        {
          success: false,
          error:
            error.message,
        },
        400
      );
    }

    console.error(
      "[skool-quiz-results] query failed:",
      error
    );

    return json(
      {
        success: false,
        error:
          "ไม่สามารถโหลดคะแนนข้อสอบได้ กรุณาตรวจการติดตั้งตาราง learning_quiz_results",
      },
      500
    );
  }
}
