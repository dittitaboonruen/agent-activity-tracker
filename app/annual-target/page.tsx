"use client";

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

type PublicAgent = {
  id: number;
  agent_name: string;
};

function getBangkokYear() {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
    }).format(new Date())
  );
}

function formatNumberInput(value: string) {
  const digits = value
    .replace(/[^0-9]/g, "")
    .replace(/^0+(?=\d)/, "");

  return digits ? Number(digits).toLocaleString("en-US") : "";
}

function toNumber(value: string) {
  return Number(value.replace(/,/g, ""));
}

async function readJson(response: Response) {
  return response.json().catch(() => ({})) as Promise<
    Record<string, unknown>
  >;
}

export default function AnnualTargetPage() {
  const targetYear = useMemo(() => getBangkokYear(), []);
  const buddhistYear = targetYear + 543;

  const [agents, setAgents] = useState<PublicAgent[]>([]);
  const [agentId, setAgentId] = useState("");
  const [agentCode, setAgentCode] = useState("");
  const [targetFyp, setTargetFyp] = useState("");
  const [targetFyc, setTargetFyc] = useState("");
  const [targetCase, setTargetCase] = useState("");
  const [status, setStatus] = useState("");
  const [statusType, setStatusType] = useState<
    "success" | "error" | ""
  >("");
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadAgents() {
      try {
        const response = await fetch(
          "/api/annual-target?scope=agents",
          {
            cache: "no-store",
            signal: controller.signal,
          }
        );

        const data = await readJson(response);

        if (!response.ok) {
          throw new Error(
            typeof data.error === "string"
              ? data.error
              : "ไม่สามารถโหลดรายชื่อตัวแทนได้"
          );
        }

        setAgents(
          Array.isArray(data.agents)
            ? (data.agents as PublicAgent[])
            : []
        );
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setStatusType("error");
        setStatus(
          error instanceof Error
            ? error.message
            : "ไม่สามารถโหลดรายชื่อตัวแทนได้"
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoadingAgents(false);
        }
      }
    }

    loadAgents();
    return () => controller.abort();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting || submitted) return;

    setSubmitting(true);
    setStatus("");
    setStatusType("");

    try {
      const response = await fetch("/api/annual-target", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          agentId: Number(agentId),
          agentCode: agentCode.trim(),
          targetYear,
          targetFyp: toNumber(targetFyp),
          targetFyc: toNumber(targetFyc),
          targetCase: toNumber(targetCase),
        }),
      });

      const data = await readJson(response);

      if (!response.ok) {
        setStatusType("error");
        setStatus(
          typeof data.error === "string"
            ? data.error
            : "ไม่สามารถบันทึกข้อมูลได้"
        );
        return;
      }

      setSubmitted(true);
      setStatusType("success");
      setStatus(`บันทึก Annual Target ปี ${buddhistYear} เรียบร้อยแล้ว`);
    } catch {
      setStatusType("error");
      setStatus("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    } finally {
      setSubmitting(false);
    }
  }

  const formDisabled = submitting || submitted;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--rp-page-gradient), var(--bg)",
        color: "var(--cream)",
        padding: "32px 20px 60px",
        transition: "background .2s ease, color .2s ease",
      }}
    >
      <div style={{ width: "100%", maxWidth: 680, margin: "0 auto" }}>
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--hairline)",
            borderRadius: 20,
            padding: "clamp(22px, 5vw, 32px)",
            boxShadow: "0 14px 40px rgba(0,0,0,.06)",
          }}
        >
          <div style={{ marginBottom: 28 }}>
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
                fontSize: "clamp(28px, 5vw, 34px)",
                color: "var(--cream)",
              }}
            >
              Annual Target {buddhistYear}
            </h1>

            <p
              style={{
                color: "var(--cream-muted)",
                marginTop: 10,
                marginBottom: 0,
                lineHeight: 1.6,
              }}
            >
              กำหนด Target FYP / FYC / CASE ประจำปี กรุณาตรวจสอบข้อมูลก่อนบันทึก เพราะส่งได้หนึ่งครั้งต่อปี
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <FieldLabel>ชื่อ-นามสกุลตัวแทน</FieldLabel>

            <select
              style={inputStyle}
              value={agentId}
              onChange={(event) => {
                setAgentId(event.target.value);
                setStatus("");
                setStatusType("");
              }}
              required
              disabled={loadingAgents || formDisabled}
            >
              <option value="">
                {loadingAgents
                  ? "กำลังโหลดรายชื่อ..."
                  : "เลือกชื่อตัวแทน"}
              </option>

              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.agent_name}
                </option>
              ))}
            </select>

            <FieldLabel>Agent Code</FieldLabel>

            <input
              style={inputStyle}
              value={agentCode}
              onChange={(event) =>
                setAgentCode(
                  event.target.value.replace(/\s/g, "").toUpperCase()
                )
              }
              required
              disabled={formDisabled}
              autoComplete="off"
              spellCheck={false}
              placeholder="กรอกรหัสตัวแทนของคุณ"
            />

            <FieldLabel>Target FYP</FieldLabel>

            <input
              style={inputStyle}
              value={targetFyp}
              onChange={(event) =>
                setTargetFyp(formatNumberInput(event.target.value))
              }
              required
              disabled={formDisabled}
              inputMode="numeric"
              placeholder="เช่น 1,200,000"
            />

            <FieldLabel>Target FYC</FieldLabel>

            <input
              style={inputStyle}
              value={targetFyc}
              onChange={(event) =>
                setTargetFyc(formatNumberInput(event.target.value))
              }
              required
              disabled={formDisabled}
              inputMode="numeric"
              placeholder="เช่น 300,000"
            />

            <FieldLabel>Target CASE</FieldLabel>

            <input
              style={inputStyle}
              value={targetCase}
              onChange={(event) =>
                setTargetCase(formatNumberInput(event.target.value))
              }
              required
              disabled={formDisabled}
              inputMode="numeric"
              placeholder="เช่น 36"
            />

            <button
              type="submit"
              disabled={loadingAgents || formDisabled}
              style={{
                width: "100%",
                marginTop: 22,
                padding: "14px 18px",
                borderRadius: 12,
                border: "1px solid var(--gold)",
                background: "var(--gold)",
                color: "#18120A",
                fontWeight: 800,
                fontSize: 16,
                cursor:
                  loadingAgents || formDisabled ? "default" : "pointer",
                opacity: loadingAgents || formDisabled ? 0.65 : 1,
              }}
            >
              {submitted
                ? "บันทึกเรียบร้อยแล้ว"
                : submitting
                  ? "กำลังบันทึก..."
                  : "บันทึกเป้าหมายประจำปี"}
            </button>

            {status && (
              <div
                role="status"
                style={{
                  marginTop: 18,
                  padding: "13px 14px",
                  textAlign: "center",
                  borderRadius: 10,
                  border:
                    statusType === "success"
                      ? "1px solid rgba(71, 180, 115, .45)"
                      : "1px solid var(--rp-danger-border)",
                  background:
                    statusType === "success"
                      ? "rgba(71, 180, 115, .10)"
                      : "rgba(180, 71, 71, .08)",
                  color:
                    statusType === "success"
                      ? "#72D39A"
                      : "var(--rp-danger)",
                  lineHeight: 1.5,
                }}
              >
                {statusType === "success" ? "✅ " : "⚠️ "}
                {status}
              </div>
            )}
          </form>
        </div>
      </div>
    </main>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label
      style={{
        display: "block",
        marginBottom: 8,
        marginTop: 18,
        fontSize: 14,
        fontWeight: 600,
        color: "var(--cream-muted)",
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
  border: "1px solid var(--hairline)",
  background: "var(--surface-alt)",
  color: "var(--cream)",
  fontSize: 16,
  outline: "none",
};
