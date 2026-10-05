"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import type { ImportedCourse } from "@/lib/skool-import-courses";

export const SKOOL_IMPORT_EVENT = "rp-skool-import-v1";

export type ImportResult = {
  success: boolean;
  error?: string;
  message?: string;
  importedCourses: ImportedCourse[];
  summary: {
    importedRows: number;
    courses: number;
    createdCourses: number;
    members: number;
    linkedAgents: number;
    unlinkedMembers: number;
  };
};

export default function SkoolCsvImport({
  onImported,
  disabled = false,
}: {
  onImported?: (result: ImportResult) => void | Promise<void>;
  disabled?: boolean;
}) {
  const inputId = useId();
  const busy = useRef(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();

    if (busy.current || disabled) return;

    if (
      !file ||
      !file.name.toLowerCase().endsWith(".csv") ||
      file.size === 0 ||
      file.size > 1_000_000
    ) {
      setError("กรุณาเลือกไฟล์ .csv ขนาดไม่เกิน 1 MB ที่มีข้อมูล");
      return;
    }

    busy.current = true;
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const form = new FormData();
      form.append("file", file);

      const response = await fetch("/api/admin/skool-import", {
        method: "POST",
        body: form,
        cache: "no-store",
      });

      const body = (await response.json()) as ImportResult;

      if (!response.ok || body.success !== true) {
        throw new Error(body.error || "ไม่สามารถนำเข้าข้อมูลได้");
      }

      setResult(body);

      // No member details are stored locally; this only notifies other tabs.
      try {
        localStorage.setItem(SKOOL_IMPORT_EVENT, String(Date.now()));
      } catch {
        /* Storage may be disabled. */
      }

      try {
        await onImported?.(body);
      } catch {
        setError(
          "นำเข้าสำเร็จแล้ว แต่โหลดรายการใหม่ไม่สำเร็จ กรุณารีเฟรชหน้า"
        );
      }
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่"
      );
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }

  return (
    <section aria-label="นำเข้า CSV" style={panel}>
      <h2 style={{ margin: "0 0 8px", fontSize: 20 }}>
        Import CSV แล้วแก้รายละเอียดภายหลัง
      </h2>

      <p style={muted}>
        ระบบสร้างคอร์สใหม่จาก Classroom และอัปเดตความคืบหน้าให้ทันที
        ไม่ต้องเพิ่มคอร์สก่อน
      </p>

      <form
        onSubmit={submit}
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "end",
        }}
      >
        <label htmlFor={inputId} style={{ flex: "1 1 260px" }}>
          <span style={{ display: "block", marginBottom: 8 }}>
            ไฟล์ Course Progress CSV · ไม่เกิน 1 MB / 500 แถว
          </span>

          <input
            id={inputId}
            type="file"
            accept=".csv,text/csv"
            disabled={loading || disabled}
            style={{ maxWidth: "100%" }}
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setError("");
              setResult(null);
            }}
          />
        </label>

        <button
          type="submit"
          disabled={!file || loading || disabled}
          style={button}
        >
          {loading ? "กำลังนำเข้า..." : "นำเข้าและแสดงข้อมูล"}
        </button>
      </form>

      {error && (
        <p
          role="alert"
          style={{ color: "var(--rp-danger)", lineHeight: 1.6 }}
        >
          {error}
        </p>
      )}

      {result?.success && result.summary && (
        <div
          role="status"
          style={{
            marginTop: 18,
            borderTop: "1px solid var(--hairline)",
            paddingTop: 16,
          }}
        >
          <strong>
            นำเข้าสำเร็จ · {result.summary.importedRows} รายการ ·
            สร้างคอร์สใหม่ {result.summary.createdCourses} คอร์ส
          </strong>

          <p style={muted}>
            สมาชิก {result.summary.members} คน · เชื่อมตัวแทนแล้ว{" "}
            {result.summary.linkedAgents} คน · ยังไม่เชื่อม/ทีมงาน{" "}
            {result.summary.unlinkedMembers} คน
          </p>

          <ul style={{ paddingLeft: 22 }}>
            {result.importedCourses.map((course) => (
              <li key={course.id} style={{ margin: "10px 0" }}>
                <a
                  href={`/admin/skool-courses?course=${course.id}`}
                  style={{ color: "var(--gold-bright)" }}
                >
                  {course.course_name}
                </a>

                {course.created ? " · สร้างใหม่" : " · อัปเดตแล้ว"}

                {!course.active &&
                  " · คงสถานะปิดใช้งานตามที่ตั้งไว้"}
              </li>
            ))}
          </ul>

          <p style={muted}>
            Dashboard ตัวแทนนับเฉพาะสมาชิกที่เชื่อม Agent Master แล้ว
            ส่วนหน้านี้แสดงคอร์สที่นำเข้าทั้งหมด
          </p>
        </div>
      )}

      <p style={{ ...muted, marginBottom: 0 }}>
        Course Progress CSV มีความคืบหน้ารวม ไม่มีชื่อบทเรียนรายบท
        จึงนำเข้าได้โดยไม่ต้องมีบทเรียน และเพิ่มบทเรียน/Google Form
        ภายหลังได้
      </p>
    </section>
  );
}

const panel = {
  marginBottom: 18,
  padding: "clamp(18px, 4vw, 28px)",
  border: "1px solid var(--hairline)",
  borderRadius: 17,
  background: "var(--surface)",
  color: "var(--cream)",
};

const muted = {
  color: "var(--cream-muted)",
  lineHeight: 1.7,
  fontSize: 13,
};

const button = {
  padding: "12px 20px",
  minHeight: 44,
  border: 0,
  borderRadius: 10,
  background: "var(--gold)",
  color: "#18120A",
  fontWeight: 800,
  cursor: "pointer",
};
