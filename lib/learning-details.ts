import type { LearningAgentSelection } from "@/lib/learning-filter";
import { latestQuizAttempts, type QuizResultRow } from "@/lib/skool-quiz";

/** The current Skool CSV records course progress, not individual lesson completion. */
export type CourseLearningRow = {
  agentId: number;
  agentName: string;
  agentCode: string;
  courseId: number;
  courseName: string;
  hasAccess: boolean;
  progressPercent: number;
  status: "completed" | "in_progress" | "not_started";
  syncedAt: string | null;
};

export const COURSE_GROUPS = [
  { key: "completed", label: "เรียนจบแล้ว" },
  { key: "in_progress", label: "กำลังเรียน" },
  { key: "not_started", label: "ยังไม่เริ่มเรียน" },
  { key: "no_access", label: "ยังไม่มีสิทธิ์เข้าคอร์ส" },
] as const;

// APIs enforce permissions. Also discard other agents defensively for an individual report.
export function selectCourseRows(rows: CourseLearningRow[], selection: LearningAgentSelection) {
  if (selection === null) return [];
  return rows.filter(row => selection === "all" || row.agentId === selection)
    .sort((a, b) => a.courseName.localeCompare(b.courseName, "th") || a.agentName.localeCompare(b.agentName, "th"));
}

export function courseProgressGroups(rows: CourseLearningRow[]) {
  return COURSE_GROUPS.map(group => ({ ...group, rows: rows.filter(row =>
    group.key === "no_access" ? row.hasAccess === false : row.hasAccess !== false && row.status === group.key) }));
}

export function failedQuizAttempts(rows: QuizResultRow[], selection: LearningAgentSelection = "all") {
  if (selection === null) return [];
  return latestQuizAttempts(rows.filter(row => row.lessonActive && (selection === "all" || row.agentId === selection)))
    .filter(row => !row.passed);
}

export function quizLessonTitle(row: QuizResultRow) {
  const lesson = row.parentLessonName && row.parentLessonName !== row.lessonName
    ? `${row.parentLessonName} / ${row.lessonName}` : row.lessonName;
  return `${row.courseName || "ไม่ระบุคอร์ส"} › ${lesson || "ไม่ระบุข้อสอบ"}`;
}
