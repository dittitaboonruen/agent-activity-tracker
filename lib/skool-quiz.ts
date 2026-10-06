export type QuizResultRow = {
  id: number;
  agentId: number;
  agentCode: string;
  agentName: string;
  agentNickname: string;
  unitId: number | null;
  unitName: string;
  courseId: number;
  courseName: string;
  lessonId: number;
  lessonName: string;
  parentLessonName: string;
  lessonActive: boolean;
  score: number;
  maxScore: number;
  scorePercent: number;
  passed: boolean;
  submittedAt: string;
  updatedAt: string;
};

// Submitted date determines the latest attempt; regrading an older response
// must not replace a more recent attempt. ID breaks equal timestamps.
export function latestQuizAttempts(rows: QuizResultRow[]) {
  const latest = new Map<string, QuizResultRow>();
  for (const row of rows) {
    const key = `${row.agentId}:${row.lessonId}`;
    const previous = latest.get(key);
    if (!previous || row.submittedAt > previous.submittedAt ||
      (row.submittedAt === previous.submittedAt && row.id > previous.id)) {
      latest.set(key, row);
    }
  }
  return [...latest.values()].sort((a, b) =>
    b.submittedAt.localeCompare(a.submittedAt) || b.id - a.id);
}

// Each active agent/quiz pair contributes once, using its latest attempt.
// Missing results are not failures. Disabled lessons remain in the detail history.
export function summarizeQuizResults(rows: QuizResultRow[]) {
  const active = rows.filter(row => row.lessonActive);
  const latest = latestQuizAttempts(active);
  const passed = latest.filter(row => row.passed).length;
  return {
    agents: new Set(latest.map(row => row.agentId)).size,
    results: latest.length,
    passed,
    failed: latest.length - passed,
    averageScore: latest.length
      ? Math.round(latest.reduce((sum, row) => sum + row.scorePercent, 0) / latest.length * 10) / 10
      : null,
    updatedAt: active.reduce<string | null>((last, row) =>
      !last || row.updatedAt > last ? row.updatedAt : last, null),
  };
}
