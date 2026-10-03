"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type ProgressStatus = "not_started" | "in_progress" | "completed";

type SkoolProgressRow = {
  agentId: number;
  agentCode: string;
  agentName: string;
  agentNickname: string;
  unitId: number | null;
  unitCode: string;
  unitName: string;
  skoolMemberId: number;
  skoolName: string;
  skoolProfileUrl: string;
  memberActive: boolean;
  lastActiveAt: string | null;
  courseId: number;
  courseName: string;
  hasAccess: boolean;
  progressPercent: number;
  status: ProgressStatus;
  syncedAt: string | null;
};

type DashboardResponse = {
  success?: boolean;
  error?: string;
  scope?: {
    canSeeAll: boolean;
    unitId: number | null;
    unitName: string | null;
  };
  summary?: {
    linkedAgents: number;
    courses: number;
    records: number;
    completed: number;
    inProgress: number;
    notStarted: number;
    averageProgress: number;
    syncedAt: string | null;
  };
  rows?: SkoolProgressRow[];
};

const STATUS_OPTIONS: Array<{
  value: "all" | ProgressStatus;
  label: string;
}> = [
  { value: "all", label: "ทุกสถานะ" },
  { value: "not_started", label: "ยังไม่เริ่ม" },
  { value: "in_progress", label: "กำลังเรียน" },
  { value: "completed", label: "เรียนจบแล้ว" },
];

function statusLabel(status: ProgressStatus) {
  if (status === "completed") return "เรียนจบแล้ว";
  if (status === "in_progress") return "กำลังเรียน";
  return "ยังไม่เริ่ม";
}

function statusColors(status: ProgressStatus) {
  if (status === "completed") {
    return {
      color: "#70C89A",
      background: "rgba(67, 160, 110, .13)",
      border: "rgba(112, 200, 154, .35)",
    };
  }

  if (status === "in_progress") {
    return {
      color: "var(--gold-bright)",
      background: "rgba(201, 162, 75, .13)",
      border: "rgba(201, 162, 75, .4)",
    };
  }

  return {
    color: "var(--cream-muted)",
    background: "rgba(180, 169, 141, .08)",
    border: "var(--hairline)",
  };
}

function formatDate(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export default function SkoolDashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [unit, setUnit] = useState("all");
  const [course, setCourse] = useState("all");
  const [status, setStatus] = useState<"all" | ProgressStatus>("all");

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/skool-progress", {
        cache: "no-store",
      });
      const responseData = (await response.json().catch(() => ({
        error: "ไม่สามารถอ่านข้อมูลจากระบบได้",
      }))) as DashboardResponse;

      if (!response.ok || responseData.success !== true) {
        setData(null);
        setError(responseData.error || "ไม่สามารถโหลด Skool Dashboard ได้");
        return;
      }

      setData(responseData);
    } catch (loadError) {
      console.error("[skool-dashboard] load error:", loadError);
      setData(null);
      setError("เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const rows = useMemo(() => data?.rows ?? [], [data]);

  const units = useMemo(
    () =>
      Array.from(new Set(rows.map((row) => row.unitName)))
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right, "th")),
    [rows]
  );

  const courses = useMemo(
    () =>
      Array.from(new Set(rows.map((row) => row.courseName)))
        .filter(Boolean)
        .sort((left, right) => left.localeCompare(right, "th")),
    [rows]
  );

  const filteredRows = useMemo(() => {
    const keyword = search.normalize("NFKC").trim().toLocaleLowerCase("th-TH");

    return rows.filter((row) => {
      const matchesSearch =
        !keyword ||
        [
          row.agentCode,
          row.agentName,
          row.agentNickname,
          row.skoolName,
        ].some((value) =>
          String(value ?? "")
            .normalize("NFKC")
            .toLocaleLowerCase("th-TH")
            .includes(keyword)
        );

      return (
        matchesSearch &&
        (unit === "all" || row.unitName === unit) &&
        (course === "all" || row.courseName === course) &&
        (status === "all" || row.status === status)
      );
    });
  }, [course, rows, search, status, unit]);

  const filteredSummary = useMemo(() => {
    const completed = filteredRows.filter(
      (row) => row.status === "completed"
    ).length;
    const inProgress = filteredRows.filter(
      (row) => row.status === "in_progress"
    ).length;
    const notStarted = filteredRows.filter(
      (row) => row.status === "not_started"
    ).length;
    const averageProgress =
      filteredRows.length > 0
        ? Math.round(
            filteredRows.reduce(
              (total, row) => total + row.progressPercent,
              0
            ) / filteredRows.length
          )
        : 0;

    return {
      agents: new Set(filteredRows.map((row) => row.agentId)).size,
      completed,
      inProgress,
      notStarted,
      averageProgress,
    };
  }, [filteredRows]);

  const hasFilters =
    search !== "" || unit !== "all" || course !== "all" || status !== "all";

  function clearFilters() {
    setSearch("");
    setUnit("all");
    setCourse("all");
    setStatus("all");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "28px 18px 64px",
        background: "var(--rp-page-gradient), var(--bg)",
        color: "var(--cream)",
      }}
    >
      <div style={{ width: "100%", maxWidth: 1180, margin: "0 auto" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 22,
          }}
        >
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              minHeight: 42,
              padding: "0 15px",
              border: "1px solid var(--hairline)",
              borderRadius: 999,
              color: "var(--gold-bright)",
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            ← กลับหน้าหลัก
          </Link>

          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            style={{
              minHeight: 42,
              padding: "0 16px",
              border: "1px solid var(--gold)",
              borderRadius: 999,
              background: "transparent",
              color: "var(--gold-bright)",
              fontWeight: 700,
              cursor: loading ? "default" : "pointer",
              opacity: loading ? 0.65 : 1,
            }}
          >
            {loading ? "กำลังโหลด..." : "↻ รีเฟรชข้อมูล"}
          </button>
        </div>

        <header
          style={{
            marginBottom: 24,
            padding: "clamp(24px, 5vw, 38px)",
            border: "1px solid var(--hairline)",
            borderRadius: 22,
            background:
              "linear-gradient(135deg, var(--rp-soft-gold), transparent 65%), var(--surface)",
            boxShadow: "0 18px 50px rgba(0,0,0,.12)",
          }}
        >
          <div
            style={{
              marginBottom: 9,
              color: "var(--gold)",
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: 2.2,
            }}
          >
            ROYAL PARTNER · LEARNING PERFORMANCE
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: "clamp(30px, 6vw, 46px)",
              lineHeight: 1.08,
            }}
          >
            Skool Progress Dashboard
          </h1>

          <p
            style={{
              maxWidth: 760,
              margin: "13px 0 0",
              color: "var(--cream-muted)",
              lineHeight: 1.7,
            }}
          >
            ติดตามความคืบหน้าการเรียนของตัวแทนจากข้อมูล Course Progress
            ที่นำเข้าล่าสุด
          </p>

          {data?.scope && (
            <div
              style={{
                display: "inline-flex",
                marginTop: 16,
                padding: "7px 11px",
                border: "1px solid var(--hairline)",
                borderRadius: 999,
                background: "var(--surface-alt)",
                color: "var(--gold-bright)",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {data.scope.canSeeAll
                ? "สิทธิ์การมองเห็น: ทุกหน่วย"
                : `สิทธิ์การมองเห็น: ${
                    data.scope.unitName || "เฉพาะหน่วยของคุณ"
                  }`}
            </div>
          )}
        </header>

        {error && (
          <div
            style={{
              marginBottom: 20,
              padding: "15px 17px",
              border: "1px solid var(--rp-danger-border)",
              borderRadius: 13,
              background: "rgba(170, 60, 45, .08)",
              color: "var(--rp-danger)",
            }}
          >
            {error}
          </div>
        )}

        {!error && (
          <>
            <section
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))",
                gap: 12,
                marginBottom: 22,
              }}
            >
              {[
                ["ตัวแทนที่เชื่อมแล้ว", filteredSummary.agents, "คน"],
                ["ความคืบหน้าเฉลี่ย", filteredSummary.averageProgress, "%"],
                ["เรียนจบแล้ว", filteredSummary.completed, "รายการ"],
                ["กำลังเรียน", filteredSummary.inProgress, "รายการ"],
                ["ยังไม่เริ่ม", filteredSummary.notStarted, "รายการ"],
              ].map(([label, value, suffix]) => (
                <div
                  key={String(label)}
                  style={{
                    padding: "19px 17px",
                    border: "1px solid var(--hairline)",
                    borderRadius: 15,
                    background: "var(--surface)",
                  }}
                >
                  <div
                    style={{
                      minHeight: 34,
                      color: "var(--cream-muted)",
                      fontSize: 12,
                      lineHeight: 1.45,
                    }}
                  >
                    {label}
                  </div>
                  <div
                    style={{
                      marginTop: 8,
                      color: "var(--gold-bright)",
                      fontSize: 30,
                      fontWeight: 800,
                    }}
                  >
                    {value}
                    <span
                      style={{
                        marginLeft: 5,
                        color: "var(--cream-muted)",
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {suffix}
                    </span>
                  </div>
                </div>
              ))}
            </section>

            <section
              style={{
                marginBottom: 22,
                padding: 18,
                border: "1px solid var(--hairline)",
                borderRadius: 16,
                background: "var(--surface)",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: 12,
                }}
              >
                <label style={fieldStyle}>
                  <span style={labelStyle}>ค้นหาตัวแทน</span>
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="ชื่อ, ชื่อเล่น หรือรหัส"
                    style={inputStyle}
                  />
                </label>

                {data?.scope?.canSeeAll && (
                  <label style={fieldStyle}>
                    <span style={labelStyle}>หน่วย</span>
                    <select
                      value={unit}
                      onChange={(event) => setUnit(event.target.value)}
                      style={inputStyle}
                    >
                      <option value="all">ทุกหน่วย</option>
                      {units.map((unitName) => (
                        <option key={unitName} value={unitName}>
                          {unitName}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <label style={fieldStyle}>
                  <span style={labelStyle}>คอร์ส</span>
                  <select
                    value={course}
                    onChange={(event) => setCourse(event.target.value)}
                    style={inputStyle}
                  >
                    <option value="all">ทุกคอร์ส</option>
                    {courses.map((courseName) => (
                      <option key={courseName} value={courseName}>
                        {courseName}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={fieldStyle}>
                  <span style={labelStyle}>สถานะการเรียน</span>
                  <select
                    value={status}
                    onChange={(event) =>
                      setStatus(event.target.value as "all" | ProgressStatus)
                    }
                    style={inputStyle}
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {hasFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  style={{
                    marginTop: 13,
                    padding: 0,
                    border: 0,
                    background: "transparent",
                    color: "var(--gold-bright)",
                    cursor: "pointer",
                    fontWeight: 700,
                  }}
                >
                  ล้างตัวกรอง
                </button>
              )}
            </section>

            <section
              style={{
                overflow: "hidden",
                border: "1px solid var(--hairline)",
                borderRadius: 17,
                background: "var(--surface)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 10,
                  padding: "17px 18px",
                  borderBottom: "1px solid var(--hairline)",
                }}
              >
                <div style={{ fontWeight: 800 }}>
                  รายละเอียดการเรียน ({filteredRows.length} รายการ)
                </div>
                <div style={{ color: "var(--cream-faint)", fontSize: 12 }}>
                  อัปเดตล่าสุด: {formatDate(data?.summary?.syncedAt ?? null)}
                </div>
              </div>

              {loading ? (
                <div style={emptyStyle}>กำลังโหลดข้อมูล...</div>
              ) : filteredRows.length === 0 ? (
                <div style={emptyStyle}>
                  {rows.length === 0
                    ? "ยังไม่มีตัวแทนที่เชื่อมกับข้อมูล Skool ในขอบเขตนี้"
                    : "ไม่พบข้อมูลตามตัวกรองที่เลือก"}
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      minWidth: 940,
                      borderCollapse: "collapse",
                      fontSize: 13,
                    }}
                  >
                    <thead>
                      <tr>
                        {[
                          "ตัวแทน",
                          "หน่วย",
                          "คอร์ส",
                          "ความคืบหน้า",
                          "สถานะ",
                          "ใช้งานล่าสุด",
                          "Skool",
                        ].map((heading) => (
                          <th key={heading} style={thStyle}>
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRows.map((row) => {
                        const statusColor = statusColors(row.status);

                        return (
                          <tr
                            key={`${row.skoolMemberId}-${row.courseId}`}
                            style={{ borderTop: "1px solid var(--hairline-soft)" }}
                          >
                            <td style={tdStyle}>
                              <div style={{ fontWeight: 800 }}>{row.agentName}</div>
                              <div
                                style={{
                                  marginTop: 4,
                                  color: "var(--cream-faint)",
                                  fontSize: 11,
                                }}
                              >
                                {row.agentCode || "ไม่มีรหัส"}
                                {row.agentNickname
                                  ? ` · ${row.agentNickname}`
                                  : ""}
                              </div>
                            </td>
                            <td style={tdStyle}>{row.unitName}</td>
                            <td style={{ ...tdStyle, maxWidth: 260 }}>
                              {row.courseName}
                            </td>
                            <td style={{ ...tdStyle, minWidth: 170 }}>
                              <div
                                style={{
                                  display: "flex",
                                  justifyContent: "space-between",
                                  gap: 8,
                                  marginBottom: 7,
                                }}
                              >
                                <span style={{ color: "var(--cream-muted)" }}>
                                  Progress
                                </span>
                                <strong style={{ color: "var(--gold-bright)" }}>
                                  {row.progressPercent}%
                                </strong>
                              </div>
                              <div
                                style={{
                                  height: 7,
                                  overflow: "hidden",
                                  borderRadius: 999,
                                  background: "var(--surface-alt)",
                                  border: "1px solid var(--hairline-soft)",
                                }}
                              >
                                <div
                                  style={{
                                    width: `${row.progressPercent}%`,
                                    height: "100%",
                                    borderRadius: 999,
                                    background:
                                      row.status === "completed"
                                        ? "#70C89A"
                                        : "var(--gold)",
                                  }}
                                />
                              </div>
                            </td>
                            <td style={tdStyle}>
                              <span
                                style={{
                                  display: "inline-flex",
                                  padding: "6px 9px",
                                  border: `1px solid ${statusColor.border}`,
                                  borderRadius: 999,
                                  background: statusColor.background,
                                  color: statusColor.color,
                                  fontSize: 11,
                                  fontWeight: 800,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {statusLabel(row.status)}
                              </span>
                            </td>
                            <td style={tdStyle}>{formatDate(row.lastActiveAt)}</td>
                            <td style={tdStyle}>
                              {row.skoolProfileUrl ? (
                                <a
                                  href={row.skoolProfileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{
                                    color: "var(--gold-bright)",
                                    fontWeight: 700,
                                    textDecoration: "none",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  เปิดโปรไฟล์ ↗
                                </a>
                              ) : (
                                "—"
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <div
              style={{
                marginTop: 17,
                padding: "13px 15px",
                border: "1px solid var(--hairline)",
                borderRadius: 13,
                background: "var(--rp-soft-gold)",
                color: "var(--cream-muted)",
                fontSize: 12,
                lineHeight: 1.65,
              }}
            >
              ข้อมูลหน้านี้เป็นระดับคอร์สจากไฟล์ Skool Course Progress CSV
              และนับเฉพาะสมาชิกที่เชื่อมกับ Agent Master แล้วเท่านั้น
            </div>
          </>
        )}
      </div>
    </main>
  );
}

const fieldStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 7,
};

const labelStyle = {
  color: "var(--cream-faint)",
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 0.6,
};

const inputStyle = {
  width: "100%",
  minHeight: 43,
  padding: "0 12px",
  border: "1px solid var(--hairline)",
  borderRadius: 9,
  background: "var(--surface-alt)",
  color: "var(--cream)",
  fontSize: 13,
  outline: "none",
};

const thStyle = {
  padding: "12px 14px",
  background: "var(--surface-alt)",
  color: "var(--cream-faint)",
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: 0.7,
  textAlign: "left" as const,
  whiteSpace: "nowrap" as const,
};

const tdStyle = {
  padding: "14px",
  color: "var(--cream-muted)",
  verticalAlign: "middle" as const,
};

const emptyStyle = {
  padding: "46px 20px",
  color: "var(--cream-muted)",
  textAlign: "center" as const,
  lineHeight: 1.7,
};
