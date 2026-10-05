"use client";

import Link from "next/link";
import SkoolCsvImport, { SKOOL_IMPORT_EVENT, type ImportResult } from "@/components/SkoolCsvImport";
import type { CourseImportStats } from "@/lib/skool-import-stats";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";

type Course = {
  id: number;
  course_code: string | null;
  course_name: string;
  description: string | null;
  sort_order: number;
  active: boolean;
};

type Lesson = {
  id: number;
  course_id: number;
  lesson_name: string;
  lesson_type: "INFO" | "QUIZ";
  lesson_order: number;
  quiz_url: string | null;
  active: boolean;
};

type ApiResponse = {
  success?: boolean;
  error?: string;
  courses?: Course[];
  lessons?: Lesson[];
  importStats?: Record<string, CourseImportStats>;
  warning?: string;
};

const emptyCourse = {
  courseName: "",
  courseCode: "",
  description: "",
  sortOrder: "1",
  active: true,
};

const emptyLesson = {
  courseId: "",
  lessonName: "",
  lessonType: "INFO" as "INFO" | "QUIZ",
  lessonOrder: "1",
  quizUrl: "",
  active: true,
};

export default function SkoolCoursesAdminPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [importStats, setImportStats] = useState<Record<string, CourseImportStats>>({});
  const [warning, setWarning] = useState("");
  const [courseForm, setCourseForm] = useState(emptyCourse);
  const [lessonForm, setLessonForm] = useState(emptyLesson);
  const [editingCourseId, setEditingCourseId] = useState<number | null>(null);
  const [editingLessonId, setEditingLessonId] = useState<number | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const loadGeneration = useRef(0);

  const loadData = useCallback(async (preferredCourseId?: number) => {
    const generation = ++loadGeneration.current;
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/skool-courses", {
        cache: "no-store",
      });
      const body = (await response.json()) as ApiResponse;
      if (generation !== loadGeneration.current) return;

      if (!response.ok || body.success !== true) {
        setError(body.error || "ไม่สามารถโหลดข้อมูลได้");
        return;
      }

      const nextCourses = body.courses ?? [];
      setCourses(nextCourses);
      setLessons(body.lessons ?? []);
      setImportStats(body.importStats ?? {});
      setWarning(body.warning ?? "");
      const urlCourseId = Number(new URLSearchParams(window.location.search).get("course"));
      setSelectedCourseId((current) => {
        const preferred = preferredCourseId ?? current ?? urlCourseId;
        return preferred && nextCourses.some((course) => course.id === preferred)
          ? preferred
          : nextCourses[0]?.id ?? null;
      });
    } catch {
      if (generation === loadGeneration.current) setError("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      if (generation === loadGeneration.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const refresh = () => { void loadData(); };
    const onStorage = (event: StorageEvent) => {
      if (event.key === SKOOL_IMPORT_EVENT) refresh();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", refresh);
    };
  }, [loadData]);

  async function onImported(result: ImportResult) {
    const firstId = result.importedCourses[0]?.id;
    await loadData(firstId);
    if (firstId) resetLessonForm(firstId);
  }

  const selectedCourse = courses.find((course) => course.id === selectedCourseId);
  const selectedLessons = useMemo(
    () =>
      lessons
        .filter((lesson) => lesson.course_id === selectedCourseId)
        .sort((a, b) => a.lesson_order - b.lesson_order || a.id - b.id),
    [lessons, selectedCourseId]
  );

  function clearNotice() {
    setError("");
    setMessage("");
  }

  function resetCourseForm() {
    setEditingCourseId(null);
    setCourseForm({
      ...emptyCourse,
      sortOrder: String(Math.max(0, ...courses.map((course) => course.sort_order)) + 1),
    });
  }

  function resetLessonForm(courseId = selectedCourseId) {
    setEditingLessonId(null);
    setLessonForm({
      ...emptyLesson,
      courseId: courseId ? String(courseId) : "",
      lessonOrder: String(Math.max(0, ...lessons.filter((lesson) => lesson.course_id === courseId).map((lesson) => lesson.lesson_order)) + 1),
    });
  }

  async function request(method: "POST" | "PATCH" | "DELETE", payload: object) {
    const response = await fetch("/api/admin/skool-courses", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await response.json()) as ApiResponse;

    if (!response.ok || body.success !== true) {
      throw new Error(body.error || "ไม่สามารถบันทึกข้อมูลได้");
    }
  }

  async function saveCourse(event: FormEvent) {
    event.preventDefault();
    clearNotice();
    setSaving(true);

    try {
      await request(editingCourseId ? "PATCH" : "POST", {
        entity: "course",
        id: editingCourseId,
        ...courseForm,
        sortOrder: Number(courseForm.sortOrder),
      });
      setMessage(editingCourseId ? "แก้ไขคอร์สเรียบร้อยแล้ว" : "เพิ่มคอร์สเรียบร้อยแล้ว");
      resetCourseForm();
      await loadData();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ไม่สามารถบันทึกคอร์สได้");
    } finally {
      setSaving(false);
    }
  }

  async function saveLesson(event: FormEvent) {
    event.preventDefault();
    clearNotice();
    setSaving(true);

    try {
      await request(editingLessonId ? "PATCH" : "POST", {
        entity: "lesson",
        id: editingLessonId,
        ...lessonForm,
        courseId: Number(lessonForm.courseId),
        lessonOrder: Number(lessonForm.lessonOrder),
      });
      setMessage(editingLessonId ? "แก้ไขบทเรียนเรียบร้อยแล้ว" : "เพิ่มบทเรียนเรียบร้อยแล้ว");
      resetLessonForm(Number(lessonForm.courseId));
      await loadData();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ไม่สามารถบันทึกบทเรียนได้");
    } finally {
      setSaving(false);
    }
  }

  async function deactivate(entity: "course" | "lesson", id: number, label: string) {
    if (!window.confirm(`ต้องการปิดใช้งาน “${label}” ใช่หรือไม่?\nข้อมูลเดิมจะไม่ถูกลบ`)) return;

    clearNotice();
    setSaving(true);

    try {
      await request("DELETE", { entity, id });
      setMessage(`ปิดใช้งาน ${label} เรียบร้อยแล้ว`);
      await loadData();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ไม่สามารถปิดใช้งานได้");
    } finally {
      setSaving(false);
    }
  }

  function editCourse(course: Course) {
    clearNotice();
    setEditingCourseId(course.id);
    setCourseForm({
      courseName: course.course_name,
      courseCode: course.course_code ?? "",
      description: course.description ?? "",
      sortOrder: String(course.sort_order),
      active: course.active,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function editLesson(lesson: Lesson) {
    clearNotice();
    setSelectedCourseId(lesson.course_id);
    setEditingLessonId(lesson.id);
    setLessonForm({
      courseId: String(lesson.course_id),
      lessonName: lesson.lesson_name,
      lessonType: lesson.lesson_type,
      lessonOrder: String(lesson.lesson_order),
      quizUrl: lesson.quiz_url ?? "",
      active: lesson.active,
    });
  }

  return (
    <main style={pageStyle}>
      <div style={{ width: "100%", maxWidth: 1180, margin: "0 auto" }}>
        <nav style={navStyle}>
          <Link href="/" style={outlineLinkStyle}>← หน้าหลัก</Link>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/admin/skool-import" style={outlineLinkStyle}>Import CSV</Link>
            <Link href="/dashboard/skool" style={outlineLinkStyle}>ดู Dashboard</Link>
          </div>
        </nav>

        <header style={headerStyle}>
          <div style={eyebrowStyle}>ROYAL PARTNER · LEARNING ADMIN</div>
          <h1 style={titleStyle}>Skool Course & Lesson Manager</h1>
          <p style={subtitleStyle}>
            นำเข้า CSV ให้คอร์สและความคืบหน้าแสดงทันที แล้วค่อยเพิ่มบทเรียนและแก้รายละเอียด
          </p>
        </header>

        {(error || message) && (
          <div style={error ? errorStyle : successStyle}>{error ? `⚠️ ${error}` : `✅ ${message}`}</div>
        )}

        <SkoolCsvImport onImported={onImported} disabled={saving} />
        {warning && <p role="alert" style={noteStyle}>{warning}</p>}

        <div style={formGridStyle}>
          <form onSubmit={saveCourse} style={panelStyle}>
            <PanelHeader
              title={editingCourseId ? "แก้ไขคอร์ส" : "เพิ่มคอร์ส"}
              caption="ชื่อคอร์สต้องตรงกับช่อง Classroom ทุกตัวอักษร"
            />
            <div style={panelBodyStyle}>
              <Field label="ชื่อคอร์ส / Classroom *">
                <input
                  style={inputStyle}
                  value={courseForm.courseName}
                  onChange={(event) => setCourseForm({ ...courseForm, courseName: event.target.value })}
                  placeholder="เช่น แผนคุ้มครองรายได้ | Income Protection"
                  required
                />
              </Field>
              <div style={twoFieldStyle}>
                <Field label="รหัสคอร์ส">
                  <input
                    style={inputStyle}
                    value={courseForm.courseCode}
                    onChange={(event) => setCourseForm({ ...courseForm, courseCode: event.target.value })}
                    placeholder="เช่น IP-001"
                  />
                </Field>
                <Field label="ลำดับคอร์ส *">
                  <input
                    style={inputStyle}
                    type="number"
                    min="0"
                    value={courseForm.sortOrder}
                    onChange={(event) => setCourseForm({ ...courseForm, sortOrder: event.target.value })}
                    required
                  />
                </Field>
              </div>
              <Field label="คำอธิบาย">
                <textarea
                  style={{ ...inputStyle, minHeight: 88, paddingTop: 12, resize: "vertical" }}
                  value={courseForm.description}
                  onChange={(event) => setCourseForm({ ...courseForm, description: event.target.value })}
                  placeholder="อธิบายวัตถุประสงค์ของคอร์ส"
                />
              </Field>
              <ActiveField
                checked={courseForm.active}
                onChange={(active) => setCourseForm({ ...courseForm, active })}
              />
              <FormActions
                saving={saving}
                editing={editingCourseId !== null}
                onCancel={resetCourseForm}
              />
            </div>
          </form>

          <form onSubmit={saveLesson} style={panelStyle}>
            <PanelHeader
              title={editingLessonId ? "แก้ไขบทเรียน" : "เพิ่มบทเรียน"}
              caption="INFO ไม่ต้องมีแบบทดสอบ · QUIZ ต้องใส่ Google Form"
            />
            <div style={panelBodyStyle}>
              <Field label="คอร์ส *">
                <select
                  style={inputStyle}
                  value={lessonForm.courseId}
                  onChange={(event) => {
                    const courseId = Number(event.target.value) || null;
                    setSelectedCourseId(courseId);
                    setLessonForm({ ...lessonForm, courseId: event.target.value });
                  }}
                  required
                >
                  <option value="">เลือกคอร์ส</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>{course.course_name}</option>
                  ))}
                </select>
              </Field>
              <Field label="ชื่อบทเรียน *">
                <input
                  style={inputStyle}
                  value={lessonForm.lessonName}
                  onChange={(event) => setLessonForm({ ...lessonForm, lessonName: event.target.value })}
                  placeholder="เช่น Welcome to Royal Partner"
                  required
                />
              </Field>
              <div style={twoFieldStyle}>
                <Field label="ประเภท *">
                  <select
                    style={inputStyle}
                    value={lessonForm.lessonType}
                    onChange={(event) =>
                      setLessonForm({
                        ...lessonForm,
                        lessonType: event.target.value as "INFO" | "QUIZ",
                        quizUrl: event.target.value === "INFO" ? "" : lessonForm.quizUrl,
                      })
                    }
                  >
                    <option value="INFO">INFO</option>
                    <option value="QUIZ">QUIZ</option>
                  </select>
                </Field>
                <Field label="ลำดับบท *">
                  <input
                    style={inputStyle}
                    type="number"
                    min="1"
                    value={lessonForm.lessonOrder}
                    onChange={(event) => setLessonForm({ ...lessonForm, lessonOrder: event.target.value })}
                    required
                  />
                </Field>
              </div>
              {lessonForm.lessonType === "QUIZ" && (
                <Field label="Google Form URL *">
                  <input
                    style={inputStyle}
                    type="url"
                    value={lessonForm.quizUrl}
                    onChange={(event) => setLessonForm({ ...lessonForm, quizUrl: event.target.value })}
                    placeholder="https://forms.gle/..."
                    required
                  />
                </Field>
              )}
              <ActiveField
                checked={lessonForm.active}
                onChange={(active) => setLessonForm({ ...lessonForm, active })}
              />
              <FormActions
                saving={saving}
                editing={editingLessonId !== null}
                onCancel={() => resetLessonForm()}
                disabled={courses.length === 0}
              />
            </div>
          </form>
        </div>

        <section style={{ ...panelStyle, marginTop: 18 }}>
          <PanelHeader
            title={`คอร์สทั้งหมด (${courses.length})`}
            caption="เลือกคอร์สเพื่อดูและจัดการบทเรียน"
          />
          {loading ? (
            <div style={emptyStyle}>กำลังโหลดข้อมูล...</div>
          ) : courses.length === 0 ? (
            <div style={emptyStyle}>ยังไม่มีคอร์ส นำเข้า CSV ด้านบนเพื่อสร้างคอร์สอัตโนมัติได้เลย</div>
          ) : (
            <div style={courseGridStyle}>
              {courses.map((course) => {
                const count = lessons.filter((lesson) => lesson.course_id === course.id).length;
                const selected = selectedCourseId === course.id;
                const stats = importStats[String(course.id)];

                return (
                  <article
                    key={course.id}
                    style={{ ...courseCardStyle, ...(selected ? selectedCardStyle : {}) }}
                    onClick={() => {
                      setSelectedCourseId(course.id);
                      setLessonForm((current) => ({ ...current, courseId: String(course.id) }));
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div>
                        <div style={{ fontSize: 11, color: "var(--gold)", fontWeight: 800 }}>
                          #{course.sort_order} · {course.course_code || "NO CODE"}
                        </div>
                        <h3 style={{ margin: "7px 0 0", fontSize: 16 }}>{course.course_name}</h3>
                      </div>
                      <Status active={course.active} />
                    </div>
                    <p style={cardDescriptionStyle}>{course.description || "ไม่มีคำอธิบาย"}</p>
                    {stats && (
                      <div style={{ ...noteStyle, margin: "10px 0", padding: 10 }}>
                        <strong>มีข้อมูลจาก CSV แล้ว</strong><br />
                        สมาชิกที่นำเข้า {stats.members} คน · เรียนจบ {stats.completed} คน<br />
                        ความคืบหน้าเฉลี่ย {stats.averageProgress}%<br />
                        <span>รวมสมาชิก Skool ที่นำเข้าทั้งหมด</span>
                      </div>
                    )}
                    <div style={cardFooterStyle}>
                      <span>{count > 0 ? `${count} บทเรียน` : "ยังไม่เพิ่มบทเรียน · เพิ่มภายหลังได้"}</span>
                      <div style={{ display: "flex", gap: 10 }}>
                        <button type="button" style={textButtonStyle} onClick={(event) => { event.stopPropagation(); editCourse(course); }}>แก้ไข</button>
                        {course.active && (
                          <button type="button" style={dangerButtonStyle} onClick={(event) => { event.stopPropagation(); void deactivate("course", course.id, course.course_name); }}>ปิดใช้</button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section style={{ ...panelStyle, marginTop: 18 }}>
          <PanelHeader
            title={selectedCourse ? `บทเรียน: ${selectedCourse.course_name}` : "บทเรียน"}
            caption={`${selectedLessons.length} บท · เรียงตามลำดับที่กำหนด`}
          />
          {!selectedCourse ? (
            <div style={emptyStyle}>เลือกคอร์สเพื่อดูบทเรียน</div>
          ) : selectedLessons.length === 0 ? (
            <div style={emptyStyle}>
              {importStats[String(selectedCourse.id)]
                ? "นำเข้าความคืบหน้าระดับคอร์สแล้ว — CSV นี้ไม่มีรายชื่อบทเรียน เพิ่มบทเรียนภายหลังได้จากฟอร์มด้านบน"
                : "ยังไม่มีบทเรียน — นำเข้า CSV เพื่อแสดงความคืบหน้าระดับคอร์สก่อนได้ แล้วค่อยเพิ่มบทเรียนภายหลัง"}
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr>{["ลำดับ", "บทเรียน", "ประเภท", "แบบทดสอบ", "สถานะ", "จัดการ"].map((heading) => <th key={heading} style={thStyle}>{heading}</th>)}</tr>
                </thead>
                <tbody>
                  {selectedLessons.map((lesson) => (
                    <tr key={lesson.id} style={trStyle}>
                      <td style={tdStyle}>{lesson.lesson_order}</td>
                      <td style={{ ...tdStyle, color: "var(--cream)", fontWeight: 700 }}>{lesson.lesson_name}</td>
                      <td style={tdStyle}><TypeBadge type={lesson.lesson_type} /></td>
                      <td style={tdStyle}>
                        {lesson.quiz_url ? <a href={lesson.quiz_url} target="_blank" rel="noreferrer" style={textLinkStyle}>เปิด Form ↗</a> : "—"}
                      </td>
                      <td style={tdStyle}><Status active={lesson.active} /></td>
                      <td style={tdStyle}>
                        <div style={{ display: "flex", gap: 12 }}>
                          <button type="button" style={textButtonStyle} onClick={() => editLesson(lesson)}>แก้ไข</button>
                          {lesson.active && <button type="button" style={dangerButtonStyle} onClick={() => void deactivate("lesson", lesson.id, lesson.lesson_name)}>ปิดใช้</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside style={noteStyle}>
          <strong>ลำดับการทำงาน:</strong> Export CSV จาก Skool → Import ที่หน้านี้ → คอร์สและความคืบหน้าแสดงทันที → แก้รายละเอียดและเพิ่มบทเรียน/Google Forms ภายหลัง โดยคงชื่อ Classroom ให้ตรงกับ CSV เพื่อให้นำเข้าครั้งต่อไปเข้าคอร์สเดิม
        </aside>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={fieldStyle}><span style={labelStyle}>{label}</span>{children}</label>;
}

function PanelHeader({ title, caption }: { title: string; caption: string }) {
  return <header style={panelHeaderStyle}><strong>{title}</strong><span style={captionStyle}>{caption}</span></header>;
}

function ActiveField({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label style={checkStyle}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      เปิดใช้งานและแสดงในระบบ
    </label>
  );
}

function FormActions({ saving, editing, disabled = false, onCancel }: { saving: boolean; editing: boolean; disabled?: boolean; onCancel: () => void }) {
  return (
    <div style={{ display: "flex", gap: 9, marginTop: 18 }}>
      <button type="submit" disabled={saving || disabled} style={{ ...primaryButtonStyle, opacity: saving || disabled ? 0.55 : 1 }}>
        {saving ? "กำลังบันทึก..." : editing ? "บันทึกการแก้ไข" : "เพิ่มข้อมูล"}
      </button>
      {editing && <button type="button" onClick={onCancel} style={secondaryButtonStyle}>ยกเลิก</button>}
    </div>
  );
}

function Status({ active }: { active: boolean }) {
  return <span style={{ ...statusStyle, color: active ? "#4FAE73" : "var(--cream-faint)" }}>{active ? "● ใช้งาน" : "○ ปิดใช้"}</span>;
}

function TypeBadge({ type }: { type: "INFO" | "QUIZ" }) {
  return <span style={{ ...typeStyle, color: type === "QUIZ" ? "var(--gold-bright)" : "#6EA4D9" }}>{type}</span>;
}

const pageStyle = { minHeight: "100vh", padding: "28px 18px 64px", background: "var(--rp-page-gradient), var(--bg)", color: "var(--cream)" };
const navStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" as const, gap: 10, marginBottom: 20 };
const outlineLinkStyle = { display: "inline-flex", alignItems: "center", minHeight: 40, padding: "0 14px", border: "1px solid var(--hairline)", borderRadius: 999, color: "var(--gold-bright)", textDecoration: "none", fontWeight: 700, fontSize: 13 };
const headerStyle = { padding: "clamp(24px, 5vw, 38px)", border: "1px solid var(--hairline)", borderRadius: 22, background: "linear-gradient(135deg, var(--rp-soft-gold), transparent 65%), var(--surface)", boxShadow: "0 18px 50px rgba(0,0,0,.12)", marginBottom: 18 };
const eyebrowStyle = { marginBottom: 9, color: "var(--gold)", fontSize: 12, fontWeight: 800, letterSpacing: 2.2 };
const titleStyle = { margin: 0, fontSize: "clamp(29px, 6vw, 44px)", lineHeight: 1.08 };
const subtitleStyle = { margin: "13px 0 0", color: "var(--cream-muted)", lineHeight: 1.7 };
const formGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 430px), 1fr))", gap: 18 };
const panelStyle = { overflow: "hidden", border: "1px solid var(--hairline)", borderRadius: 17, background: "var(--surface)" };
const panelHeaderStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" as const, gap: 8, padding: "16px 18px", borderBottom: "1px solid var(--hairline)" };
const panelBodyStyle = { padding: 18 };
const captionStyle = { color: "var(--cream-faint)", fontSize: 11, lineHeight: 1.5 };
const fieldStyle = { display: "flex", flexDirection: "column" as const, gap: 7, marginBottom: 14 };
const labelStyle = { color: "var(--cream-muted)", fontSize: 12, fontWeight: 800 };
const inputStyle = { width: "100%", minHeight: 43, boxSizing: "border-box" as const, padding: "0 12px", border: "1px solid var(--hairline)", borderRadius: 9, background: "var(--surface-alt)", color: "var(--cream)", fontSize: 14, outline: "none" };
const twoFieldStyle = { display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 };
const checkStyle = { display: "flex", alignItems: "center", gap: 9, color: "var(--cream-muted)", fontSize: 13 };
const primaryButtonStyle = { flex: 1, minHeight: 43, border: "1px solid var(--gold)", borderRadius: 10, background: "var(--gold)", color: "#18120A", fontWeight: 900, cursor: "pointer" };
const secondaryButtonStyle = { minHeight: 43, padding: "0 15px", border: "1px solid var(--hairline)", borderRadius: 10, background: "transparent", color: "var(--cream-muted)", fontWeight: 700, cursor: "pointer" };
const courseGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, padding: 17 };
const courseCardStyle = { padding: 15, border: "1px solid var(--hairline-soft)", borderRadius: 13, background: "var(--surface-alt)", cursor: "pointer" };
const selectedCardStyle = { borderColor: "var(--gold)", boxShadow: "inset 0 0 0 1px var(--gold)" };
const cardDescriptionStyle = { minHeight: 40, margin: "10px 0", color: "var(--cream-muted)", fontSize: 12, lineHeight: 1.6 };
const cardFooterStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, paddingTop: 10, borderTop: "1px solid var(--hairline-soft)", color: "var(--cream-faint)", fontSize: 12 };
const textButtonStyle = { padding: 0, border: 0, background: "transparent", color: "var(--gold-bright)", fontWeight: 800, cursor: "pointer" };
const dangerButtonStyle = { padding: 0, border: 0, background: "transparent", color: "var(--rp-danger)", fontWeight: 800, cursor: "pointer" };
const statusStyle = { whiteSpace: "nowrap" as const, fontSize: 11, fontWeight: 800 };
const typeStyle = { display: "inline-flex", padding: "5px 8px", border: "1px solid var(--hairline)", borderRadius: 999, background: "var(--surface-alt)", fontSize: 10, fontWeight: 900 };
const tableStyle = { width: "100%", minWidth: 760, borderCollapse: "collapse" as const, fontSize: 13 };
const thStyle = { padding: "12px 14px", background: "var(--surface-alt)", color: "var(--cream-faint)", fontSize: 10, fontWeight: 800, textAlign: "left" as const, whiteSpace: "nowrap" as const };
const trStyle = { borderTop: "1px solid var(--hairline-soft)" };
const tdStyle = { padding: 14, color: "var(--cream-muted)", verticalAlign: "middle" as const };
const textLinkStyle = { color: "var(--gold-bright)", fontWeight: 700, textDecoration: "none" };
const emptyStyle = { padding: "42px 20px", color: "var(--cream-muted)", textAlign: "center" as const };
const noteStyle = { marginTop: 18, padding: "14px 16px", border: "1px solid var(--hairline)", borderRadius: 13, background: "var(--rp-soft-gold)", color: "var(--cream-muted)", fontSize: 12, lineHeight: 1.7 };
const errorStyle = { marginBottom: 18, padding: "14px 16px", border: "1px solid var(--rp-danger-border)", borderRadius: 12, background: "rgba(180,55,55,.08)", color: "var(--rp-danger)" };
const successStyle = { marginBottom: 18, padding: "14px 16px", border: "1px solid var(--gold)", borderRadius: 12, background: "var(--rp-soft-gold)", color: "var(--gold-bright)" };
