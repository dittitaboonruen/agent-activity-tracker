export type OutlineItem = { name: string; parentIndex: number | null };

/** One lesson per line; two spaces or one tab adds a child level. */
export function parseLessonOutline(source: string): OutlineItem[] {
  const result: OutlineItem[] = [];
  const stack: number[] = [];
  const siblings = new Set<string>();
  for (const [lineIndex, raw] of source.replace(/^\uFEFF/, "").split(/\r?\n/).entries()) {
    if (!raw.trim()) continue;
    const indent = raw.match(/^[\t ]*/)?.[0] ?? "";
    const spaces = indent.replace(/\t/g, "  ").length;
    if (spaces % 2) throw new Error(`บรรทัด ${lineIndex + 1}: ใช้ 2 ช่องว่างต่อข้อย่อยหนึ่งระดับ`);
    const depth = spaces / 2;
    if (depth > 4 || depth > stack.length) throw new Error(`บรรทัด ${lineIndex + 1}: ลำดับข้อย่อยข้ามระดับหรือเกิน 5 ระดับ`);
    const name = raw.trim();
    if (name.length > 300) throw new Error(`บรรทัด ${lineIndex + 1}: ชื่อบทเรียนยาวเกิน 300 ตัวอักษร`);
    const parentIndex = depth ? stack[depth - 1] : null;
    const key = `${parentIndex ?? "root"}:${name}`;
    if (siblings.has(key)) throw new Error(`บรรทัด ${lineIndex + 1}: มีชื่อซ้ำภายในบทหลักเดียวกัน`);
    siblings.add(key);
    result.push({ name, parentIndex });
    stack[depth] = result.length - 1;
    stack.length = depth + 1;
    if (result.length > 200) throw new Error("เพิ่มได้ครั้งละไม่เกิน 200 บท");
  }
  if (!result.length) throw new Error("กรุณาวางรายชื่อบทเรียน");
  return result;
}

export type TreeLesson = { id: number; parent_lesson_id?: number | null; lesson_order: number };
export function lessonTree<T extends TreeLesson>(lessons: T[]): Array<{ lesson: T; number: string; depth: number }> {
  const rows: Array<{ lesson: T; number: string; depth: number }> = [];
  const ids = new Set(lessons.map(l => l.id));
  const children = new Map<number | null, T[]>();
  for (const lesson of lessons) {
    const parent = lesson.parent_lesson_id && ids.has(lesson.parent_lesson_id) ? lesson.parent_lesson_id : null;
    const group = children.get(parent) ?? [];
    group.push(lesson);
    children.set(parent, group);
  }
  const seen = new Set<number>();
  const visit = (parent: number | null, prefix: string, depth: number) => {
    const group = (children.get(parent) ?? []).sort((a, b) => a.lesson_order - b.lesson_order || a.id - b.id);
    group.forEach((lesson, i) => {
      if (seen.has(lesson.id)) return;
      seen.add(lesson.id);
      const number = prefix ? `${prefix}.${i + 1}` : String(i + 1);
      rows.push({ lesson, number, depth });
      visit(lesson.id, number, depth + 1);
    });
  };
  visit(null, "", 0);
  // Keep malformed legacy data visible for correction.
  for (const lesson of lessons) if (!seen.has(lesson.id)) rows.push({ lesson, number: "?", depth: 0 });
  return rows;
}

/** Confirmed first six courses; other courses keep their relative order. */
export function recommendedCourseIds<T extends { id: number; course_name: string }>(courses: T[]): number[] {
  const prefixes = ["start here", "about royal partner", "pre-agent class", "starter course", "aia knowledge hub", "แผนคุ้มครองรายได้"];
  const ids = prefixes.flatMap(prefix => courses.filter(c => c.course_name.toLowerCase().startsWith(prefix)).map(c => c.id));
  return [...ids, ...courses.filter(c => !ids.includes(c.id)).map(c => c.id)];
}

// Draft titles from the supplied ผลิตภัณฑ์.md; these are not a Skool lesson export.
export const PRODUCT_OUTLINES = [
  { match: "income protection", title: "แผนคุ้มครองรายได้", outline: "AIA 20Pay Life\nAIA Term 5 / 10 / 15 / 20\nAIA 20 Pay Life Plus\nAIA Legacy Prestige" },
  { match: "health insurance", title: "แผนคุ้มครองสุขภาพ", outline: "AIA Health Starter\nAIA Infinite Care (New Standard)" },
  { match: "critical illness", title: "แผนดูแลโรคร้ายแรง", outline: "AIA Multi-Pay CI Plus\nAIA CI ProCare\nCI Plus / CI Top Up\nAIA CI SuperCare 10/99 & 20/99 (Non Par)\nAIA Care for Cancer | ป่วยได้ ก็ยิ้มได้\nAIA TPD\nAIA CI Super Care Prestige" },
  { match: "unit linked", title: "แผนประกันเพื่อการลงทุน", outline: "Issara Prestige Plus\nSmart Select Prestige\nInfinite Wealth Prestige | กาวสู่การลงทุนระดับสากล\n20 Pay Link Prestige" },
  { match: "retirement", title: "แผนรายได้หลังเกษียณ", outline: "AIA Endowment 15/25\nAIA Excellent\nAIA Annuity Sure (บำนาญได้ชัวร์)\nAIA Annuity Fix\nAIA Protection 65" },
  { match: "แผนคุ้มครองอุบัติเหตุ", title: "แผนคุ้มครองอุบัติเหตุ", outline: "AIANPA5500\nAIA PA 32K" },
  { match: "แผนสวัสดิการพนักงานองค์กร", title: "แผนสวัสดิการพนักงานองค์กร", outline: "Flexi Pack\nContinental Plan\nProvident Fund (กองทุนสำรองเลี้ยงชีพ)" },
];
export function productOutline(courseName: string) {
  const normalized = courseName.toLowerCase().replace(/[-‑–]/g, " ");
  return PRODUCT_OUTLINES.find(p => normalized.includes(p.match) || normalized.includes(p.title));
}
