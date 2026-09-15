"use client";

import { useEffect, useState } from "react";

type AnnualTarget = {
  id: number;
  agent_name: string;
  target_year: number;
  target_fyp: number | string;
  target_fyc: number | string;
  target_case: number | string;
  created_at?: string;
  updated_at?: string;
};

export default function AnnualTargetPage() {
  const currentYear = new Date().getFullYear() + 543;
  const targetYear = currentYear - 543;

  const [agentName, setAgentName] = useState("");
  const [targetFyp, setTargetFyp] = useState("");
  const [targetFyc, setTargetFyc] = useState("");
  const [targetCase, setTargetCase] = useState("");

  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loadingTarget, setLoadingTarget] = useState(false);

  const [existingTarget, setExistingTarget] =
    useState<AnnualTarget | null>(null);

  function formatNumberInput(value: string) {
    const digitsOnly = value.replace(/\D/g, "");

    if (!digitsOnly) {
      return "";
    }

    return Number(digitsOnly).toLocaleString("en-US");
  }

  function formatStoredNumber(value: number | string) {
    const numberValue = Number(value);

    if (!Number.isFinite(numberValue)) {
      return "";
    }

    return numberValue.toLocaleString("en-US");
  }

  function parseNumberInput(value: string) {
    return Number(value.replace(/,/g, ""));
  }

  function clearTargetFields() {
    setTargetFyp("");
    setTargetFyc("");
    setTargetCase("");
  }

  /*
   * โหลด Target เดิมอัตโนมัติ
   * หลังผู้ใช้หยุดพิมพ์ชื่อประมาณ 600ms
   */
  useEffect(() => {
    const name = agentName.trim();

    if (!name) {
      setExistingTarget(null);
      clearTargetFields();
      setStatus("");
      return;
    }

    const controller = new AbortController();

    const timer = window.setTimeout(async () => {
      setLoadingTarget(true);
      setStatus("");

      try {
        const params = new URLSearchParams({
          agent: name,
          year: String(targetYear),
        });

        const response = await fetch(
          `/api/annual-target?${params.toString()}`,
          {
            method: "GET",
            cache: "no-store",
            signal: controller.signal,
          }
        );

        const data = await response.json();

        if (!response.ok) {
          setExistingTarget(null);
          clearTargetFields();

          setStatus(
            data.error ||
              "ไม่สามารถตรวจสอบ Annual Target เดิมได้"
          );

          return;
        }

        const target: AnnualTarget | null =
          data.target ?? null;

        if (!target) {
          setExistingTarget(null);
          clearTargetFields();

          setStatus(
            `ยังไม่มี Annual Target ปี ${currentYear} ของ ${name}`
          );

          return;
        }

        setExistingTarget(target);

        setTargetFyp(
          formatStoredNumber(target.target_fyp)
        );

        setTargetFyc(
          formatStoredNumber(target.target_fyc)
        );

        setTargetCase(
          formatStoredNumber(target.target_case)
        );

        setStatus(
          `✏️ พบ Annual Target ปี ${currentYear} ของ ${name} — สามารถแก้ไขและบันทึกทับข้อมูลเดิมได้`
        );
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }

        console.error(
          "[annual-target] Load existing target error:",
          error
        );

        setExistingTarget(null);
        clearTargetFields();

        setStatus(
          "เกิดข้อผิดพลาดในการตรวจสอบ Target เดิม"
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoadingTarget(false);
        }
      }
    }, 600);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [agentName, targetYear, currentYear]);

  async function handleSubmit(
    e: React.FormEvent
  ) {
    e.preventDefault();

    const name = agentName.trim();

    if (!name) {
      setStatus("กรุณาระบุชื่อตัวแทน");
      return;
    }

    setLoading(true);
    setStatus("");

    try {
      const response = await fetch(
        "/api/annual-target",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            agentName: name,
            targetYear,
            targetFyp:
              parseNumberInput(targetFyp),
            targetFyc:
              parseNumberInput(targetFyc),
            targetCase:
              parseNumberInput(targetCase),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setStatus(
          data.error ||
            "ไม่สามารถบันทึกข้อมูลได้"
        );
        return;
      }

      if (data.target) {
        setExistingTarget(data.target);

        setTargetFyp(
          formatStoredNumber(
            data.target.target_fyp
          )
        );

        setTargetFyc(
          formatStoredNumber(
            data.target.target_fyc
          )
        );

        setTargetCase(
          formatStoredNumber(
            data.target.target_case
          )
        );
      }

      setStatus(
        existingTarget
          ? "✅ อัปเดตเป้าหมายเรียบร้อยแล้ว"
          : "✅ บันทึกเป้าหมายเรียบร้อยแล้ว"
      );
    } catch (error) {
      console.error(
        "[annual-target] Save error:",
        error
      );

      setStatus(
        "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง"
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    const name = agentName.trim();

    if (!name) {
      setStatus(
        "กรุณากรอกชื่อตัวแทนก่อนลบ Target"
      );
      return;
    }

    if (!existingTarget) {
      setStatus(
        `ไม่พบ Annual Target ปี ${currentYear} ของ ${name}`
      );
      return;
    }

    const confirmed = window.confirm(
      `ต้องการลบ Annual Target ปี ${currentYear} ของ "${name}" ใช่หรือไม่?\n\nข้อมูล Target FYP / FYC / CASE ของปีนี้จะถูกลบ`
    );

    if (!confirmed) return;

    setDeleting(true);
    setStatus("");

    try {
      const response = await fetch(
        "/api/annual-target",
        {
          method: "DELETE",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            agentName: name,
            targetYear,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setStatus(
          data.error ||
            "ไม่สามารถลบ Target ได้"
        );
        return;
      }

      clearTargetFields();
      setExistingTarget(null);

      setStatus(
        `🗑️ ลบ Annual Target ปี ${currentYear} ของ ${name} เรียบร้อยแล้ว`
      );
    } catch (error) {
      console.error(
        "[annual-target] Delete error:",
        error
      );

      setStatus(
        "เกิดข้อผิดพลาดในการลบข้อมูล"
      );
    } finally {
      setDeleting(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "var(--rp-page-gradient), var(--bg)",
        color: "var(--cream)",
        padding: "32px 20px 60px",
        transition:
          "background .2s ease, color .2s ease",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 680,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            background: "var(--surface)",
            border:
              "1px solid var(--hairline)",
            borderRadius: 20,
            padding:
              "clamp(22px, 5vw, 32px)",
            boxShadow:
              "0 14px 40px rgba(0,0,0,.06)",
          }}
        >
          <div
            style={{
              marginBottom: 28,
            }}
          >
            <div
              style={{
                color: "var(--gold)",
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: 2,
                marginBottom: 8,
              }}
            >
              ROYAL PARTNER · PERFORMANCE
            </div>

            <h1
              style={{
                margin: 0,
                fontSize:
                  "clamp(28px, 5vw, 34px)",
                color: "var(--cream)",
              }}
            >
              Annual Target {currentYear}
            </h1>

            <p
              style={{
                color:
                  "var(--cream-muted)",
                marginTop: 10,
                marginBottom: 0,
                lineHeight: 1.6,
              }}
            >
              กำหนด Target FYP / FYC /
              CASE ประจำปี
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <FieldLabel>
              ชื่อ-นามสกุล / ชื่อตัวแทน
            </FieldLabel>

            <input
              style={inputStyle}
              value={agentName}
              onChange={(e) =>
                setAgentName(e.target.value)
              }
              required
              autoComplete="off"
              placeholder="กรอกชื่อของคุณ"
            />

            {loadingTarget && (
              <div
                style={{
                  marginTop: 10,
                  fontSize: 13,
                  color:
                    "var(--cream-muted)",
                }}
              >
                กำลังตรวจสอบ Target
                เดิม...
              </div>
            )}

            {!loadingTarget &&
              agentName.trim() &&
              existingTarget && (
                <div
                  style={{
                    marginTop: 12,
                    padding: "10px 12px",
                    borderRadius: 10,
                    border:
                      "1px solid var(--gold)",
                    background:
                      "var(--rp-soft-gold)",
                    color:
                      "var(--gold-bright)",
                    fontSize: 13,
                    lineHeight: 1.5,
                  }}
                >
                  ✏️ EDIT MODE —
                  พบข้อมูลเดิมปี{" "}
                  {currentYear}
                </div>
              )}

            {!loadingTarget &&
              agentName.trim() &&
              !existingTarget && (
                <div
                  style={{
                    marginTop: 12,
                    padding: "10px 12px",
                    borderRadius: 10,
                    border:
                      "1px solid var(--hairline)",
                    background:
                      "var(--surface-alt)",
                    color:
                      "var(--cream-muted)",
                    fontSize: 13,
                    lineHeight: 1.5,
                  }}
                >
                  ＋ NEW TARGET —
                  ยังไม่มีข้อมูลปี{" "}
                  {currentYear}
                </div>
              )}

            <FieldLabel>
              Target FYP
            </FieldLabel>

            <input
              style={inputStyle}
              value={targetFyp}
              onChange={(e) =>
                setTargetFyp(
                  formatNumberInput(
                    e.target.value
                  )
                )
              }
              required
              inputMode="numeric"
              placeholder="เช่น 1,200,000"
            />

            <FieldLabel>
              Target FYC
            </FieldLabel>

            <input
              style={inputStyle}
              value={targetFyc}
              onChange={(e) =>
                setTargetFyc(
                  formatNumberInput(
                    e.target.value
                  )
                )
              }
              required
              inputMode="numeric"
              placeholder="เช่น 300,000"
            />

            <FieldLabel>
              Target CASE
            </FieldLabel>

            <input
              style={inputStyle}
              value={targetCase}
              onChange={(e) =>
                setTargetCase(
                  formatNumberInput(
                    e.target.value
                  )
                )
              }
              required
              inputMode="numeric"
              placeholder="เช่น 36"
            />

            <button
              type="submit"
              disabled={
                loading ||
                deleting ||
                loadingTarget
              }
              style={{
                width: "100%",
                marginTop: 22,
                padding: "14px 18px",
                borderRadius: 12,
                border:
                  "1px solid var(--gold)",
                background:
                  "var(--gold)",
                color: "#18120A",
                fontWeight: 800,
                fontSize: 16,
                cursor:
                  loading ||
                  deleting ||
                  loadingTarget
                    ? "default"
                    : "pointer",
                opacity:
                  loading ||
                  deleting ||
                  loadingTarget
                    ? 0.65
                    : 1,
              }}
            >
              {loading
                ? "กำลังบันทึก..."
                : existingTarget
                ? "อัปเดตเป้าหมายประจำปี"
                : "บันทึกเป้าหมายประจำปี"}
            </button>

            <button
              type="button"
              onClick={handleDelete}
              disabled={
                loading ||
                deleting ||
                loadingTarget ||
                !existingTarget
              }
              style={{
                width: "100%",
                marginTop: 12,
                padding: "13px 18px",
                borderRadius: 12,
                border:
                  "1px solid var(--rp-danger-border)",
                background: "transparent",
                color:
                  "var(--rp-danger)",
                fontWeight: 700,
                fontSize: 15,
                cursor:
                  deleting ||
                  !existingTarget
                    ? "default"
                    : "pointer",
                opacity:
                  loading ||
                  deleting ||
                  loadingTarget ||
                  !existingTarget
                    ? 0.45
                    : 1,
              }}
            >
              {deleting
                ? "กำลังลบ..."
                : `🗑️ ลบ Target ปี ${currentYear}`}
            </button>

            {status && (
              <div
                style={{
                  marginTop: 18,
                  padding: "13px 14px",
                  textAlign: "center",
                  borderRadius: 10,
                  border:
                    "1px solid var(--hairline)",
                  background:
                    "var(--rp-soft-gold)",
                  color:
                    "var(--gold-bright)",
                  lineHeight: 1.5,
                }}
              >
                {status}
              </div>
            )}
          </form>
        </div>
      </div>
    </main>
  );
}

function FieldLabel({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <label
      style={{
        display: "block",
        marginBottom: 8,
        marginTop: 18,
        fontSize: 14,
        fontWeight: 600,
        color:
          "var(--cream-muted)",
      }}
    >
      {children}
    </label>
  );
}

const inputStyle = {
  width: "100%",
  boxSizing: "border-box" as const,
  padding: "13px 14px",
  borderRadius: 10,
  border:
    "1px solid var(--hairline)",
  background:
    "var(--surface-alt)",
  color: "var(--cream)",
  fontSize: 16,
  outline: "none",
};
