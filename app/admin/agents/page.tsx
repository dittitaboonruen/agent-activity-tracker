"use client";

import { useEffect, useState } from "react";
import HomeButton from "@/components/HomeButton";

type Agent = {
  id?: number;
  agent_code: string | null;
  agent_name: string;
  agent_nickname: string | null;
  active?: boolean;
};

type FormState = {
  agentCode: string;
  agentName: string;
  agentNickname: string;
};

const emptyForm: FormState = {
  agentCode: "",
  agentName: "",
  agentNickname: "",
};

export default function AgentMasterPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [status, setStatus] = useState("");

  async function loadAgents() {
    setLoadingAgents(true);
    setStatus("");

    try {
      const response = await fetch("/api/agent-master", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        setStatus(data.error || "ไม่สามารถโหลดรายชื่อตัวแทนได้");
        return;
      }

      setAgents(data.agents ?? []);
    } catch {
      setStatus("เกิดข้อผิดพลาดในการโหลดรายชื่อตัวแทน");
    } finally {
      setLoadingAgents(false);
    }
  }

  useEffect(() => {
    loadAgents();
  }, []);

  function updateForm(field: keyof FormState, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function saveAgent() {
    setStatus("");

    if (!form.agentName.trim()) {
      setStatus("กรุณากรอกชื่อตัวแทน");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/agent-master", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          agentCode: form.agentCode.trim(),
          agentName: form.agentName.trim(),
          agentNickname: form.agentNickname.trim(),
          active: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setStatus(data.error || "ไม่สามารถบันทึกตัวแทนได้");
        return;
      }

      setStatus("บันทึกข้อมูลตัวแทนเรียบร้อย");
      setForm(emptyForm);

      await loadAgents();
    } catch {
      setStatus("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    } finally {
      setLoading(false);
    }
  }

  function editAgent(agent: Agent) {
    setForm({
      agentCode: agent.agent_code ?? "",
      agentName: agent.agent_name ?? "",
      agentNickname: agent.agent_nickname ?? "",
    });

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0D0B08",
        color: "#F4E8D0",
        padding: "26px 18px 60px",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
        }}
      >
        <div style={{ marginBottom: 20 }}>
          <HomeButton />
        </div>

        <div style={{ marginBottom: 26 }}>
          <div
            style={{
              color: "#C9A24B",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 2,
              marginBottom: 8,
            }}
          >
            ROYAL PARTNER · AGENT DEV
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: 34,
            }}
          >
            Agent Master
          </h1>

          <p
            style={{
              marginTop: 10,
              color: "#A89B86",
              lineHeight: 1.6,
            }}
          >
            จัดเก็บ Code / Name / Nick Name ของตัวแทน
            เพื่อใช้ใน Daily Production
          </p>
        </div>

        {/* FORM */}
        <div
          style={{
            background: "#17130E",
            border: "1px solid #4A3B1E",
            borderRadius: 18,
            padding: 20,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 14,
            }}
          >
            <Field
              label="Agent Code"
              value={form.agentCode}
              placeholder="เช่น 319930"
              onChange={(value) =>
                updateForm("agentCode", value)
              }
            />

            <Field
              label="Name"
              value={form.agentName}
              placeholder="ชื่อ-นามสกุล"
              onChange={(value) =>
                updateForm("agentName", value)
              }
            />

            <Field
              label="Nick Name"
              value={form.agentNickname}
              placeholder="ชื่อเล่น"
              onChange={(value) =>
                updateForm("agentNickname", value)
              }
            />
          </div>

          <div
            style={{
              marginTop: 18,
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <button
              type="button"
              onClick={saveAgent}
              disabled={loading}
              style={{
                border: "1px solid #C9A24B",
                background: "#C9A24B",
                color: "#17110A",
                borderRadius: 10,
                padding: "12px 22px",
                fontWeight: 800,
                cursor: loading ? "default" : "pointer",
                opacity: loading ? 0.65 : 1,
              }}
            >
              {loading
                ? "กำลังบันทึก..."
                : "บันทึกตัวแทน"}
            </button>
          </div>
        </div>

        {status && (
          <div
            style={{
              marginBottom: 18,
              padding: "13px 16px",
              border: "1px solid #4A3B1E",
              borderRadius: 10,
              color: "#D8B66A",
              background: "rgba(201,162,75,.06)",
            }}
          >
            {status}
          </div>
        )}

        {/* LIST */}
        <div
          style={{
            background: "#17130E",
            border: "1px solid #4A3B1E",
            borderRadius: 18,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "16px 18px",
              borderBottom: "1px solid #332A1C",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div>
              <div
                style={{
                  color: "#C9A24B",
                  fontWeight: 800,
                }}
              >
                รายชื่อตัวแทน
              </div>

              <div
                style={{
                  fontSize: 12,
                  color: "#807460",
                  marginTop: 3,
                }}
              >
                ทั้งหมด {agents.length} คน
              </div>
            </div>

            <button
              type="button"
              onClick={loadAgents}
              style={{
                border: "1px solid #4A3B1E",
                background: "transparent",
                color: "#C9A24B",
                borderRadius: 9,
                padding: "9px 12px",
                cursor: "pointer",
              }}
            >
              ↻ รีเฟรช
            </button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                minWidth: 700,
                borderCollapse: "collapse",
              }}
            >
              <thead>
                <tr
                  style={{
                    background: "rgba(201,162,75,.08)",
                  }}
                >
                  <HeaderCell>No.</HeaderCell>
                  <HeaderCell>Code</HeaderCell>
                  <HeaderCell>Name</HeaderCell>
                  <HeaderCell>Nick Name</HeaderCell>
                  <HeaderCell>จัดการ</HeaderCell>
                </tr>
              </thead>

              <tbody>
                {loadingAgents ? (
                  <tr>
                    <td
                      colSpan={5}
                      style={{
                        padding: 24,
                        textAlign: "center",
                        color: "#8F8370",
                      }}
                    >
                      กำลังโหลด...
                    </td>
                  </tr>
                ) : agents.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      style={{
                        padding: 24,
                        textAlign: "center",
                        color: "#8F8370",
                      }}
                    >
                      ยังไม่มีรายชื่อตัวแทน
                    </td>
                  </tr>
                ) : (
                  agents.map((agent, index) => (
                    <tr
                      key={agent.id ?? `${agent.agent_name}-${index}`}
                      style={{
                        borderTop: "1px solid #332A1C",
                      }}
                    >
                      <Cell>{index + 1}</Cell>

                      <Cell>
                        {agent.agent_code || "-"}
                      </Cell>

                      <Cell>
                        {agent.agent_name}
                      </Cell>

                      <Cell>
                        {agent.agent_nickname || "-"}
                      </Cell>

                      <Cell>
                        <button
                          type="button"
                          onClick={() => editAgent(agent)}
                          style={{
                            border: "1px solid #C9A24B",
                            background: "transparent",
                            color: "#C9A24B",
                            borderRadius: 8,
                            padding: "8px 12px",
                            cursor: "pointer",
                          }}
                        >
                          แก้ไข
                        </button>
                      </Cell>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label
        style={{
          display: "block",
          color: "#C9A24B",
          fontSize: 12,
          fontWeight: 700,
          marginBottom: 7,
        }}
      >
        {label}
      </label>

      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%",
          boxSizing: "border-box",
          background: "#0F0C09",
          color: "#F4E8D0",
          border: "1px solid #3D3325",
          borderRadius: 9,
          padding: "11px 12px",
          fontSize: 14,
        }}
      />
    </div>
  );
}

function HeaderCell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <th
      style={{
        padding: "13px 12px",
        textAlign: "left",
        color: "#D8B66A",
        fontSize: 12,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function Cell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <td
      style={{
        padding: "12px",
        fontSize: 13,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </td>
  );
}
