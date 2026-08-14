"use client";

import { useEffect, useState } from "react";
import PageTopBar from "@/components/PageTopBar";

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
  const [form, setForm] =
    useState<FormState>(emptyForm);

  const [loading, setLoading] = useState(false);
  const [loadingAgents, setLoadingAgents] =
    useState(false);

  const [status, setStatus] = useState("");

  async function loadAgents() {
    setLoadingAgents(true);
    setStatus("");

    try {
      const response = await fetch(
        "/api/agent-master",
        {
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setStatus(
          data.error ||
            "ไม่สามารถโหลดรายชื่อตัวแทนได้"
        );
        return;
      }

      setAgents(data.agents ?? []);
    } catch {
      setStatus(
        "เกิดข้อผิดพลาดในการโหลดรายชื่อตัวแทน"
      );
    } finally {
      setLoadingAgents(false);
    }
  }

  useEffect(() => {
    loadAgents();
  }, []);

  function updateForm(
    field: keyof FormState,
    value: string
  ) {
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
      const response = await fetch(
        "/api/agent-master",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            agentCode:
              form.agentCode.trim(),

            agentName:
              form.agentName.trim(),

            agentNickname:
              form.agentNickname.trim(),

            active: true,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setStatus(
          data.error ||
            "ไม่สามารถบันทึกตัวแทนได้"
        );
        return;
      }

      setStatus(
        "✅ บันทึกข้อมูลตัวแทนเรียบร้อย"
      );

      setForm(emptyForm);

      await loadAgents();
    } catch {
      setStatus(
        "เกิดข้อผิดพลาดในการบันทึกข้อมูล"
      );
    } finally {
      setLoading(false);
    }
  }

  function editAgent(agent: Agent) {
    setForm({
      agentCode:
        agent.agent_code ?? "",

      agentName:
        agent.agent_name ?? "",

      agentNickname:
        agent.agent_nickname ?? "",
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

        background:
          "var(--rp-page-gradient), var(--bg)",

        color:
          "var(--cream)",

        padding:
          "24px 18px 60px",

        transition:
          "background .2s ease, color .2s ease",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
        }}
      >
        <PageTopBar />

        {/* HEADER */}
        <div
          style={{
            marginBottom: 26,
          }}
        >
          <div
            style={{
              color:
                "var(--gold)",

              fontSize: 12,

              fontWeight: 800,

              letterSpacing: 2,

              marginBottom: 8,
            }}
          >
            ROYAL PARTNER · ADMIN
          </div>

          <h1
            style={{
              margin: 0,

              fontSize: 34,

              color:
                "var(--cream)",
            }}
          >
            Agent Master
          </h1>

          <p
            style={{
              marginTop: 10,

              color:
                "var(--cream-muted)",

              lineHeight: 1.6,
            }}
          >
            จัดการ Code / Name / Nick Name
            ของตัวแทนสำหรับใช้งานในระบบ
            Royal Partner Agent Performance
          </p>
        </div>

        {/* FORM */}
        <div
          style={{
            background:
              "var(--surface)",

            border:
              "1px solid var(--hairline)",

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

              value={
                form.agentCode
              }

              placeholder="เช่น 319930"

              onChange={(value) =>
                updateForm(
                  "agentCode",
                  value
                )
              }
            />

            <Field
              label="Name"

              value={
                form.agentName
              }

              placeholder="ชื่อ-นามสกุล"

              onChange={(value) =>
                updateForm(
                  "agentName",
                  value
                )
              }
            />

            <Field
              label="Nick Name"

              value={
                form.agentNickname
              }

              placeholder="ชื่อเล่น"

              onChange={(value) =>
                updateForm(
                  "agentNickname",
                  value
                )
              }
            />
          </div>

          <div
            style={{
              marginTop: 18,

              display: "flex",

              justifyContent:
                "flex-end",
            }}
          >
            <button
              type="button"

              onClick={
                saveAgent
              }

              disabled={
                loading
              }

              style={{
                border:
                  "1px solid var(--gold)",

                background:
                  "var(--gold)",

                color:
                  "#17110A",

                borderRadius:
                  10,

                padding:
                  "12px 22px",

                fontWeight:
                  800,

                cursor:
                  loading
                    ? "default"
                    : "pointer",

                opacity:
                  loading
                    ? 0.65
                    : 1,
              }}
            >
              {loading
                ? "กำลังบันทึก..."
                : "บันทึกตัวแทน"}
            </button>
          </div>
        </div>

        {/* STATUS */}
        {status && (
          <div
            style={{
              marginBottom: 18,

              padding:
                "13px 16px",

              border:
                "1px solid var(--hairline)",

              borderRadius: 10,

              color:
                "var(--gold-bright)",

              background:
                "var(--rp-soft-gold)",

              lineHeight: 1.5,
            }}
          >
            {status}
          </div>
        )}

        {/* AGENT LIST */}
        <div
          style={{
            background:
              "var(--surface)",

            border:
              "1px solid var(--hairline)",

            borderRadius: 18,

            overflow: "hidden",
          }}
        >
          {/* LIST HEADER */}
          <div
            style={{
              padding:
                "16px 18px",

              borderBottom:
                "1px solid var(--hairline)",

              display: "flex",

              justifyContent:
                "space-between",

              alignItems:
                "center",

              gap: 12,

              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  color:
                    "var(--gold-bright)",

                  fontWeight:
                    800,
                }}
              >
                รายชื่อตัวแทน
              </div>

              <div
                style={{
                  fontSize: 12,

                  color:
                    "var(--cream-faint)",

                  marginTop: 3,
                }}
              >
                ทั้งหมด {agents.length} คน
              </div>
            </div>

            <button
              type="button"

              onClick={
                loadAgents
              }

              disabled={
                loadingAgents
              }

              style={{
                border:
                  "1px solid var(--hairline)",

                background:
                  "var(--surface-alt)",

                color:
                  "var(--gold)",

                borderRadius: 9,

                padding:
                  "9px 12px",

                cursor:
                  loadingAgents
                    ? "default"
                    : "pointer",

                opacity:
                  loadingAgents
                    ? 0.6
                    : 1,
              }}
            >
              {loadingAgents
                ? "กำลังโหลด..."
                : "↻ รีเฟรช"}
            </button>
          </div>

          {/* TABLE */}
          <div
            style={{
              overflowX: "auto",
            }}
          >
            <table
              style={{
                width: "100%",

                minWidth: 700,

                borderCollapse:
                  "collapse",
              }}
            >
              <thead>
                <tr
                  style={{
                    background:
                      "var(--rp-soft-gold)",
                  }}
                >
                  <HeaderCell>
                    No.
                  </HeaderCell>

                  <HeaderCell>
                    Code
                  </HeaderCell>

                  <HeaderCell>
                    Name
                  </HeaderCell>

                  <HeaderCell>
                    Nick Name
                  </HeaderCell>

                  <HeaderCell>
                    จัดการ
                  </HeaderCell>
                </tr>
              </thead>

              <tbody>
                {loadingAgents ? (
                  <tr>
                    <td
                      colSpan={5}

                      style={{
                        padding: 24,

                        textAlign:
                          "center",

                        color:
                          "var(--cream-faint)",
                      }}
                    >
                      กำลังโหลด...
                    </td>
                  </tr>
                ) : agents.length ===
                  0 ? (
                  <tr>
                    <td
                      colSpan={5}

                      style={{
                        padding: 24,

                        textAlign:
                          "center",

                        color:
                          "var(--cream-faint)",
                      }}
                    >
                      ยังไม่มีรายชื่อตัวแทน
                    </td>
                  </tr>
                ) : (
                  agents.map(
                    (
                      agent,
                      index
                    ) => (
                      <tr
                        key={
                          agent.id ??
                          `${agent.agent_name}-${index}`
                        }

                        style={{
                          borderTop:
                            "1px solid var(--hairline-soft)",
                        }}
                      >
                        <Cell>
                          {index + 1}
                        </Cell>

                        <Cell>
                          {agent.agent_code ||
                            "-"}
                        </Cell>

                        <Cell>
                          {
                            agent.agent_name
                          }
                        </Cell>

                        <Cell>
                          {agent.agent_nickname ||
                            "-"}
                        </Cell>

                        <Cell>
                          <button
                            type="button"

                            onClick={() =>
                              editAgent(
                                agent
                              )
                            }

                            style={{
                              border:
                                "1px solid var(--gold)",

                              background:
                                "transparent",

                              color:
                                "var(--gold)",

                              borderRadius:
                                8,

                              padding:
                                "8px 12px",

                              cursor:
                                "pointer",

                              fontWeight:
                                700,
                            }}
                          >
                            แก้ไข
                          </button>
                        </Cell>
                      </tr>
                    )
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* FOOTER NOTE */}
        <div
          style={{
            marginTop: 14,

            color:
              "var(--cream-faint)",

            fontSize: 12,

            lineHeight: 1.6,
          }}
        >
          Agent Master
          เป็นข้อมูลกลางที่ Daily Production
          ใช้ดึงรายชื่อตัวแทนอัตโนมัติ
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
  onChange: (
    value: string
  ) => void;
}) {
  return (
    <div>
      <label
        style={{
          display: "block",

          color:
            "var(--gold)",

          fontSize: 12,

          fontWeight: 700,

          marginBottom: 7,
        }}
      >
        {label}
      </label>

      <input
        value={value}

        placeholder={
          placeholder
        }

        onChange={(e) =>
          onChange(
            e.target.value
          )
        }

        style={{
          width: "100%",

          boxSizing:
            "border-box",

          background:
            "var(--surface-alt)",

          color:
            "var(--cream)",

          border:
            "1px solid var(--hairline)",

          borderRadius: 9,

          padding:
            "11px 12px",

          fontSize: 14,

          outline: "none",
        }}
      />
    </div>
  );
}

function HeaderCell({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <th
      style={{
        padding:
          "13px 12px",

        textAlign: "left",

        color:
          "var(--gold-bright)",

        fontSize: 12,

        whiteSpace:
          "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function Cell({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <td
      style={{
        padding: 12,

        fontSize: 13,

        color:
          "var(--cream)",

        whiteSpace:
          "nowrap",
      }}
    >
      {children}
    </td>
  );
}
