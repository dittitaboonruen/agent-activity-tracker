/** "all" is the viewer's permitted scope; null means an unresolved selection. */
export type LearningAgentSelection = "all" | number | null;

export class LearningFilterError extends Error {}

/** Only one positive, safe integer ID is accepted. Scope is checked by each API. */
export function readLearningAgentId(url?: string): number | null {
  if (!url) return null;
  const params = new URL(url).searchParams;
  for (const key of params.keys()) {
    if (key !== "agent_id") throw new LearningFilterError("ตัวกรองข้อมูลไม่ถูกต้อง");
  }
  const values = params.getAll("agent_id");
  if (!values.length) return null;
  if (values.length !== 1 || !/^[1-9]\d*$/.test(values[0])) {
    throw new LearningFilterError("รหัสตัวแทนสำหรับตัวกรองไม่ถูกต้อง");
  }
  const id = Number(values[0]);
  if (!Number.isSafeInteger(id)) throw new LearningFilterError("รหัสตัวแทนสำหรับตัวกรองไม่ถูกต้อง");
  return id;
}

export function learningApiUrl(path: string, selection: LearningAgentSelection): string {
  if (selection === "all") return path;
  if (selection === null || !Number.isSafeInteger(selection) || selection <= 0) {
    throw new LearningFilterError("ไม่สามารถระบุตัวแทนที่เลือกได้ กรุณาตรวจชื่อใน Agent Master");
  }
  return `${path}?agent_id=${selection}`;
}
