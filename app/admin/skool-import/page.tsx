"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

type ImportSummary = {
  importedRows: number;
  courses: number;
  members: number;
  linkedAgents: number;
  unlinkedMembers: number;
};

type ImportResponse = {
  success?: boolean;
  message?: string;
  error?: string;
  summary?: ImportSummary;
};

export default function SkoolImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImportResponse | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file) {
      setError("กรุณาเลือกไฟล์ CSV ก่อนนำเข้า");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/admin/skool-import", {
        method: "POST",
        body: formData,
        cache: "no-store",
      });

      const data = (await response.json().catch(() => ({
        error: "ไม่สามารถอ่านผลลัพธ์จากระบบได้",
      }))) as ImportResponse;

      if (!response.ok || data.success !== true) {
        setError(data.error || "ไม่สามารถนำเข้าข้อมูล Skool ได้");
        return;
      }

      setResult(data);
    } catch {
      setError("เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--rp-page-gradient), var(--bg)",
        color: "var(--cream)",
        padding: "28px 18px 60px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 860,
          margin: "0 auto",
        }}
      >
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            minHeight: 42,
            marginBottom: 20,
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

        <section
          style={{
            overflow: "hidden",
            background: "var(--surface)",
            border: "1px solid var(--hairline)",
            borderRadius: 22,
            boxShadow: "0 18px 50px rgba(0,0,0,.12)",
          }}
        >
          <header
            style={{
              padding: "clamp(24px, 5vw, 38px)",
              borderBottom: "1px solid var(--hairline)",
              background:
                "linear-gradient(135deg, var(--rp-soft-gold), transparent 65%)",
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
              ROYAL PARTNER · LEARNING DATA
            </div>

            <h1
              style={{
                margin: 0,
                fontSize: "clamp(28px, 6vw, 42px)",
                lineHeight: 1.1,
              }}
            >
              Import Skool Progress
            </h1>

            <p
              style={{
                maxWidth: 650,
                margin: "13px 0 0",
                color: "var(--cream-muted)",
                lineHeight: 1.7,
              }}
            >
              อัปโหลดไฟล์ Course Progress CSV ล่าสุด เพื่ออัปเดตเปอร์เซ็นต์
              การเรียนของตัวแทนใน Performance Hub
            </p>
          </header>

          <div style={{ padding: "clamp(22px, 5vw, 38px)" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
                gap: 12,
                marginBottom: 28,
              }}
            >
              {[
                ["01", "Export CSV", "ดาวน์โหลด Course Progress จาก Skool"],
                ["02", "Upload", "เลือกไฟล์ CSV ล่าสุดจากเครื่อง"],
                ["03", "Update", "ระบบเชื่อมและอัปเดตข้อมูลอัตโนมัติ"],
              ].map(([number, title, description]) => (
                <div
                  key={number}
                  style={{
                    padding: 17,
                    border: "1px solid var(--hairline)",
                    borderRadius: 14,
                    background: "var(--surface-alt)",
                  }}
                >
                  <div
                    style={{
                      color: "var(--gold)",
                      fontSize: 12,
                      fontWeight: 800,
                    }}
                  >
                    {number}
                  </div>
                  <div style={{ marginTop: 7, fontWeight: 800 }}>{title}</div>
                  <div
                    style={{
                      marginTop: 6,
                      color: "var(--cream-muted)",
                      fontSize: 13,
                      lineHeight: 1.55,
                    }}
                  >
                    {description}
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={handleSubmit}>
              <label
                htmlFor="skool-csv"
                style={{
                  display: "block",
                  marginBottom: 9,
                  color: "var(--cream-muted)",
                  fontSize: 14,
                  fontWeight: 700,
                }}
              >
                ไฟล์ Course Progress CSV
              </label>

              <div
                style={{
                  padding: "22px 18px",
                  border: "1px dashed var(--gold)",
                  borderRadius: 15,
                  background: "var(--rp-soft-gold)",
                }}
              >
                <input
                  id="skool-csv"
                  type="file"
                  accept=".csv,text/csv"
                  disabled={loading}
                  onChange={(event) => {
                    const nextFile = event.target.files?.[0] ?? null;
                    setFile(nextFile);
                    setError("");
                    setResult(null);
                  }}
                  style={{
                    width: "100%",
                    color: "var(--cream)",
                    fontSize: 15,
                  }}
                />

                <div
                  style={{
                    marginTop: 12,
                    color: "var(--cream-muted)",
                    fontSize: 13,
                    lineHeight: 1.5,
                  }}
                >
                  รองรับเฉพาะ .csv ขนาดไม่เกิน 1 MB
                  {file
                    ? ` · เลือกแล้ว: ${file.name} (${Math.max(
                        1,
                        Math.ceil(file.size / 1024)
                      )} KB)`
                    : ""}
                </div>
              </div>

              <button
                type="submit"
                disabled={!file || loading}
                style={{
                  width: "100%",
                  marginTop: 18,
                  padding: "14px 18px",
                  border: "1px solid var(--gold)",
                  borderRadius: 12,
                  background: "var(--gold)",
                  color: "#18120A",
                  fontSize: 16,
                  fontWeight: 800,
                  cursor: !file || loading ? "default" : "pointer",
                  opacity: !file || loading ? 0.55 : 1,
                }}
              >
                {loading ? "กำลังตรวจและนำเข้าข้อมูล..." : "นำเข้าข้อมูล Skool"}
              </button>
            </form>

            {error && (
              <div
                role="alert"
                style={{
                  marginTop: 18,
                  padding: "14px 15px",
                  border: "1px solid var(--rp-danger-border)",
                  borderRadius: 12,
                  background: "rgba(180, 55, 55, .08)",
                  color: "var(--rp-danger)",
                  lineHeight: 1.6,
                }}
              >
                ⚠️ {error}
              </div>
            )}

            {result?.success && result.summary && (
              <div
                aria-live="polite"
                style={{
                  marginTop: 20,
                  padding: 20,
                  border: "1px solid var(--gold)",
                  borderRadius: 15,
                  background: "var(--rp-soft-gold)",
                }}
              >
                <div
                  style={{
                    color: "var(--gold-bright)",
                    fontSize: 17,
                    fontWeight: 800,
                  }}
                >
                  ✅ {result.message || "นำเข้าข้อมูลเรียบร้อยแล้ว"}
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
                    gap: 10,
                    marginTop: 16,
                  }}
                >
                  {[
                    ["แถวที่นำเข้า", result.summary.importedRows],
                    ["สมาชิก Skool", result.summary.members],
                    ["เชื่อมตัวแทนแล้ว", result.summary.linkedAgents],
                    ["ยังไม่เชื่อม/ทีมงาน", result.summary.unlinkedMembers],
                  ].map(([label, value]) => (
                    <div
                      key={String(label)}
                      style={{
                        padding: 13,
                        border: "1px solid var(--hairline)",
                        borderRadius: 11,
                        background: "var(--surface)",
                        textAlign: "center",
                      }}
                    >
                      <div
                        style={{
                          color: "var(--gold-bright)",
                          fontSize: 24,
                          fontWeight: 900,
                        }}
                      >
                        {value}
                      </div>
                      <div
                        style={{
                          marginTop: 4,
                          color: "var(--cream-muted)",
                          fontSize: 12,
                        }}
                      >
                        {label}
                      </div>
                    </div>
                  ))}
                </div>

                <p
                  style={{
                    margin: "15px 0 0",
                    color: "var(--cream-muted)",
                    fontSize: 13,
                    lineHeight: 1.6,
                  }}
                >
                  ระบบจะแสดงใน Dashboard เฉพาะสมาชิกที่เชื่อมกับ Agent Master แล้ว
                  บัญชีทีมงานที่ไม่มี Agent ID จะไม่ถูกนำไปนับ
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
