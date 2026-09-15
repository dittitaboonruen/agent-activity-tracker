"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import PageTopBar from "@/components/PageTopBar";

type Agent = {
  id: number;
  agent_code: string | null;
  agent_name: string;
  agent_nickname: string | null;
  agent_email: string | null;
  jotform_agent_name: string | null;
  unit_id: number | null;
  manager_user_id: string | null;
  active: boolean;
};

type Unit = {
  id: number;
  unit_code: string;
  unit_name: string;
  active: boolean;
};

type Manager = {
  user_id: string;
  email: string;
  full_name: string | null;
  role:
    | "manager"
    | "admin";
  active: boolean;
  unit_id: number | null;
};

type FormState = {
  agentCode: string;
  agentName: string;
  agentNickname: string;
  agentEmail: string;
  jotformAgentName: string;
  unitId: string;
  managerUserId: string;
};

const emptyForm: FormState = {
  agentCode: "",
  agentName: "",
  agentNickname: "",
  agentEmail: "",
  jotformAgentName: "",
  unitId: "",
  managerUserId: "",
};

export default function AgentMasterPage() {
  const [
    agents,
    setAgents,
  ] = useState<Agent[]>([]);

  const [
    units,
    setUnits,
  ] = useState<Unit[]>([]);

  const [
    managers,
    setManagers,
  ] = useState<Manager[]>([]);

  const [
    canManage,
    setCanManage,
  ] = useState(false);

  const [
    form,
    setForm,
  ] =
    useState<FormState>(
      emptyForm
    );

  const [
    editingAgentId,
    setEditingAgentId,
  ] = useState<
    number | null
  >(null);

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    loadingAgents,
    setLoadingAgents,
  ] = useState(false);

  const [
    status,
    setStatus,
  ] = useState("");

  async function loadAgentMaster() {
    setLoadingAgents(true);

    try {
      const response =
        await fetch(
          "/api/agent-master",
          {
            cache:
              "no-store",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        setStatus(
          data.error ||
            "ไม่สามารถโหลด Agent Master ได้"
        );

        return;
      }

      setAgents(
        data.agents ?? []
      );

      setUnits(
        data.units ?? []
      );

      setManagers(
        data.managers ?? []
      );

      setCanManage(
        data.canManage ===
          true
      );
    } catch {
      setStatus(
        "เกิดข้อผิดพลาดในการโหลด Agent Master"
      );
    } finally {
      setLoadingAgents(
        false
      );
    }
  }

  useEffect(() => {
    loadAgentMaster();
  }, []);

  /*
    ใช้เฉพาะ Manager ประจำหน่วย

    Training เห็นข้อมูลทั้งหมด
    แต่ไม่ใช่หัวหน้าประจำหน่วย
  */

  const assignableManagers =
    useMemo(
      () =>
        managers.filter(
          (manager) =>
            manager.role ===
              "manager" &&
            manager.email
              .toLowerCase() !==
              "training@royalpartner.org"
        ),
      [managers]
    );

  const managersForSelectedUnit =
    useMemo(() => {
      if (!form.unitId) {
        return [];
      }

      return assignableManagers.filter(
        (manager) =>
          String(
            manager.unit_id ??
              ""
          ) ===
          form.unitId
      );
    }, [
      assignableManagers,
      form.unitId,
    ]);

  const filteredAgents =
    useMemo(() => {
      const keyword =
        search
          .trim()
          .toLocaleLowerCase(
            "th-TH"
          );

      if (!keyword) {
        return agents;
      }

      return agents.filter(
        (agent) => {
          const unit =
            units.find(
              (item) =>
                item.id ===
                agent.unit_id
            );

          const manager =
            managers.find(
              (item) =>
                item.user_id ===
                agent.manager_user_id
            );

          const searchableText =
            [
              agent.agent_code,
              agent.agent_name,
              agent.agent_nickname,
              agent.agent_email,
              agent.jotform_agent_name,
              unit?.unit_code,
              unit?.unit_name,
              manager?.full_name,
              manager?.email,
            ]
              .filter(
                Boolean
              )
              .join(" ")
              .toLocaleLowerCase(
                "th-TH"
              );

          return searchableText.includes(
            keyword
          );
        }
      );
    }, [
      agents,
      managers,
      search,
      units,
    ]);

  function updateForm(
    field:
      keyof FormState,
    value: string
  ) {
    setForm(
      (current) => ({
        ...current,
        [field]: value,
      })
    );
  }

  function changeUnit(
    value: string
  ) {
    const matchingManagers =
      assignableManagers.filter(
        (manager) =>
          String(
            manager.unit_id ??
              ""
          ) ===
          value
      );

    setForm(
      (current) => ({
        ...current,

        unitId:
          value,

        managerUserId:
          matchingManagers.length ===
          1
            ? matchingManagers[0]
                .user_id
            : "",
      })
    );
  }

  function resetForm() {
    setForm(
      emptyForm
    );

    setEditingAgentId(
      null
    );
  }

  async function saveAgent() {
    setStatus("");

    if (
      !form.agentCode.trim()
    ) {
      setStatus(
        "กรุณากรอก Agent Code"
      );

      return;
    }

    if (
      !form.agentName.trim()
    ) {
      setStatus(
        "กรุณากรอกชื่อตัวแทน"
      );

      return;
    }

    if (!form.unitId) {
      setStatus(
        "กรุณาเลือกหน่วย"
      );

      return;
    }

    if (
      !form.managerUserId
    ) {
      setStatus(
        "กรุณาเลือกหัวหน้าที่ดูแล"
      );

      return;
    }

    setLoading(true);

    try {
      const response =
        await fetch(
          "/api/agent-master",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                {
                  agentCode:
                    form.agentCode.trim(),

                  agentName:
                    form.agentName.trim(),

                  agentNickname:
                    form.agentNickname.trim(),

                  agentEmail:
                    form.agentEmail.trim(),

                  jotformAgentName:
                    form.jotformAgentName.trim(),

                  unitId:
                    Number(
                      form.unitId
                    ),

                  managerUserId:
                    form.managerUserId,

                  active:
                    true,
                }
              ),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        setStatus(
          data.error ||
            "ไม่สามารถบันทึกตัวแทนได้"
        );

        return;
      }

      setStatus(
        editingAgentId
          ? "บันทึกการแก้ไขตัวแทนเรียบร้อยแล้ว"
          : "เพิ่มตัวแทนเรียบร้อยแล้ว"
      );

      resetForm();

      await loadAgentMaster();
    } catch {
      setStatus(
        "เกิดข้อผิดพลาดในการบันทึกข้อมูล"
      );
    } finally {
      setLoading(false);
    }
  }

  function editAgent(
    agent: Agent
  ) {
    setForm({
      agentCode:
        agent.agent_code ??
        "",

      agentName:
        agent.agent_name ??
        "",

      agentNickname:
        agent.agent_nickname ??
        "",

      agentEmail:
        agent.agent_email ??
        "",

      jotformAgentName:
        agent.jotform_agent_name ??
        "",

      unitId:
        agent.unit_id
          ? String(
              agent.unit_id
            )
          : "",

      managerUserId:
        agent.manager_user_id ??
        "",
    });

    setEditingAgentId(
      agent.id
    );

    setStatus("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function getUnit(
    agent: Agent
  ) {
    return units.find(
      (unit) =>
        unit.id ===
        agent.unit_id
    );
  }

  function getManager(
    agent: Agent
  ) {
    return managers.find(
      (manager) =>
        manager.user_id ===
        agent.manager_user_id
    );
  }

  return (
    <main
      style={{
        minHeight:
          "100vh",

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
          maxWidth: 1500,
          margin: "0 auto",
        }}
      >
        <PageTopBar />

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
            ROYAL PARTNER · AGENT MASTER
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
            ทะเบียนกลางของตัวแทน หน่วย
            หัวหน้าที่ดูแล และข้อมูลสำหรับเชื่อมระบบ Skool
          </p>
        </div>

        {canManage ? (
          <section
            style={
              panelStyle
            }
          >
            <div
              style={{
                display:
                  "flex",

                justifyContent:
                  "space-between",

                alignItems:
                  "center",

                gap: 12,

                flexWrap:
                  "wrap",

                marginBottom:
                  16,
              }}
            >
              <div>
                <div
                  style={
                    sectionTitleStyle
                  }
                >
                  {editingAgentId
                    ? "แก้ไขตัวแทน"
                    : "เพิ่มตัวแทน"}
                </div>

                <div
                  style={
                    sectionDescriptionStyle
                  }
                >
                  Agent Email จะใช้เป็น Key หลักสำหรับเชื่อมข้อมูลจาก Skool
                </div>
              </div>

              {editingAgentId && (
                <button
                  type="button"

                  onClick={
                    resetForm
                  }

                  style={
                    secondaryButtonStyle
                  }
                >
                  ยกเลิกการแก้ไข
                </button>
              )}
            </div>

            <div
              style={
                formGridStyle
              }
            >
              <Field
                label="Agent Code *"

                value={
                  form.agentCode
                }

                placeholder="เช่น 319930"

                inputMode="numeric"

                readOnly={
                  editingAgentId !==
                  null
                }

                onChange={(
                  value
                ) =>
                  updateForm(
                    "agentCode",
                    value
                  )
                }
              />

              <Field
                label="ชื่อ-นามสกุล *"

                value={
                  form.agentName
                }

                placeholder="ไม่ต้องใส่คำนำหน้าชื่อ"

                onChange={(
                  value
                ) =>
                  updateForm(
                    "agentName",
                    value
                  )
                }
              />

              <Field
                label="ชื่อเล่น"

                value={
                  form.agentNickname
                }

                placeholder="ชื่อเล่น"

                onChange={(
                  value
                ) =>
                  updateForm(
                    "agentNickname",
                    value
                  )
                }
              />

              <Field
                label="Agent Email สำหรับ Skool"

                value={
                  form.agentEmail
                }

                placeholder="name@example.com"

                type="email"

                onChange={(
                  value
                ) =>
                  updateForm(
                    "agentEmail",
                    value
                  )
                }
              />

              <Field
                label="ชื่อที่ใช้ใน Jotform"

                value={
                  form.jotformAgentName
                }

                placeholder="เช่น ธัญญา"

                onChange={(
                  value
                ) =>
                  updateForm(
                    "jotformAgentName",
                    value
                  )
                }
              />

              <SelectField
                label="หน่วย *"

                value={
                  form.unitId
                }

                placeholder="เลือกหน่วย"

                options={units.map(
                  (unit) => ({
                    value:
                      String(
                        unit.id
                      ),

                    label:
                      `${unit.unit_code} · ${unit.unit_name}`,
                  })
                )}

                onChange={
                  changeUnit
                }
              />

              <SelectField
                label="หัวหน้าที่ดูแล *"

                value={
                  form.managerUserId
                }

                placeholder={
                  form.unitId
                    ? "เลือกหัวหน้าที่ดูแล"
                    : "เลือกหน่วยก่อน"
                }

                disabled={
                  !form.unitId
                }

                options={
                  managersForSelectedUnit.map(
                    (
                      manager
                    ) => ({
                      value:
                        manager.user_id,

                      label:
                        `${manager.full_name || "Manager"} · ${manager.email}`,
                    })
                  )
                }

                onChange={(
                  value
                ) =>
                  updateForm(
                    "managerUserId",
                    value
                  )
                }
              />
            </div>

            <div
              style={{
                marginTop: 18,

                display:
                  "flex",

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
                  ...primaryButtonStyle,

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
                  : editingAgentId
                    ? "บันทึกการแก้ไข"
                    : "เพิ่มตัวแทน"}
              </button>
            </div>
          </section>
        ) : (
          <section
            style={{
              ...panelStyle,

              color:
                "var(--cream-muted)",

              lineHeight:
                1.6,
            }}
          >
            บัญชีนี้ดูทะเบียนตัวแทนได้
            แต่การเพิ่มหรือแก้ไขข้อมูลทำได้เฉพาะ NewAgent
          </section>
        )}

        {status && (
          <div
            style={
              statusStyle
            }
          >
            {status}
          </div>
        )}

        <section
          style={{
            ...panelStyle,

            padding: 0,

            overflow:
              "hidden",
          }}
        >
          <div
            style={
              listHeaderStyle
            }
          >
            <div>
              <div
                style={
                  sectionTitleStyle
                }
              >
                รายชื่อตัวแทน
              </div>

              <div
                style={
                  sectionDescriptionStyle
                }
              >
                แสดง {filteredAgents.length} จากทั้งหมด {agents.length} คน
              </div>
            </div>

            <div
              style={{
                display:
                  "flex",

                gap: 10,

                alignItems:
                  "center",

                flexWrap:
                  "wrap",
              }}
            >
              <input
                value={
                  search
                }

                onChange={(
                  event
                ) =>
                  setSearch(
                    event.target.value
                  )
                }

                placeholder="ค้นหาชื่อ รหัส หน่วย หรืออีเมล"

                style={{
                  ...inputStyle,

                  width:
                    "min(320px, 78vw)",
                }}
              />

              <button
                type="button"

                onClick={
                  loadAgentMaster
                }

                disabled={
                  loadingAgents
                }

                style={{
                  ...secondaryButtonStyle,

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
                  : "รีเฟรช"}
              </button>
            </div>
          </div>

          <div
            style={{
              overflowX:
                "auto",
            }}
          >
            <table
              style={{
                width:
                  "100%",

                minWidth:
                  1380,

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
                    Unit
                  </HeaderCell>

                  <HeaderCell>
                    Manager
                  </HeaderCell>

                  <HeaderCell>
                    Agent Email / Skool
                  </HeaderCell>

                  <HeaderCell>
                    Jotform Name
                  </HeaderCell>

                  {canManage && (
                    <HeaderCell>
                      จัดการ
                    </HeaderCell>
                  )}
                </tr>
              </thead>

              <tbody>
                {loadingAgents ? (
                  <tr>
                    <td
                      colSpan={
                        canManage
                          ? 9
                          : 8
                      }

                      style={
                        emptyCellStyle
                      }
                    >
                      กำลังโหลด...
                    </td>
                  </tr>
                ) : filteredAgents.length ===
                  0 ? (
                  <tr>
                    <td
                      colSpan={
                        canManage
                          ? 9
                          : 8
                      }

                      style={
                        emptyCellStyle
                      }
                    >
                      ไม่พบรายชื่อตัวแทน
                    </td>
                  </tr>
                ) : (
                  filteredAgents.map(
                    (
                      agent,
                      index
                    ) => {
                      const unit =
                        getUnit(
                          agent
                        );

                      const manager =
                        getManager(
                          agent
                        );

                      return (
                        <tr
                          key={
                            agent.id
                          }

                          style={{
                            borderTop:
                              "1px solid var(--hairline-soft)",
                          }}
                        >
                          <Cell>
                            {index +
                              1}
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
                            {unit
                              ? `${unit.unit_code} · ${unit.unit_name}`
                              : "ยังไม่ได้กำหนด"}
                          </Cell>

                          <Cell>
                            <div>
                              {manager?.full_name ||
                                "-"}
                            </div>

                            {manager?.email && (
                              <div
                                style={
                                  subTextStyle
                                }
                              >
                                {
                                  manager.email
                                }
                              </div>
                            )}
                          </Cell>

                          <Cell>
                            {agent.agent_email ? (
                              agent.agent_email
                            ) : (
                              <span
                                style={{
                                  color:
                                    "var(--rp-danger)",
                                }}
                              >
                                ยังไม่มีอีเมล
                              </span>
                            )}
                          </Cell>

                          <Cell>
                            {agent.jotform_agent_name ||
                              "-"}
                          </Cell>

                          {canManage && (
                            <Cell>
                              <button
                                type="button"

                                onClick={() =>
                                  editAgent(
                                    agent
                                  )
                                }

                                style={
                                  editButtonStyle
                                }
                              >
                                แก้ไข
                              </button>
                            </Cell>
                          )}
                        </tr>
                      );
                    }
                  )
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div
          style={
            footerStyle
          }
        >
          Agent Email เป็น Key
          สำหรับเชื่อมข้อมูล Skool ส่วน Jotform Name
          ใช้จับคู่ข้อมูล Activity
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
  type = "text",
  inputMode,
  readOnly = false,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (
    value: string
  ) => void;
  type?: string;
  inputMode?:
    | "text"
    | "numeric"
    | "email";
  readOnly?: boolean;
}) {
  return (
    <div>
      <label
        style={
          labelStyle
        }
      >
        {label}
      </label>

      <input
        value={value}

        placeholder={
          placeholder
        }

        type={type}

        inputMode={
          inputMode
        }

        readOnly={
          readOnly
        }

        onChange={(
          event
        ) =>
          onChange(
            event.target.value
          )
        }

        style={{
          ...inputStyle,

          opacity:
            readOnly
              ? 0.65
              : 1,

          cursor:
            readOnly
              ? "not-allowed"
              : "text",
        }}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  placeholder,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  placeholder: string;
  options: Array<{
    value: string;
    label: string;
  }>;
  onChange: (
    value: string
  ) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <label
        style={
          labelStyle
        }
      >
        {label}
      </label>

      <select
        value={value}

        disabled={
          disabled
        }

        onChange={(
          event
        ) =>
          onChange(
            event.target.value
          )
        }

        style={{
          ...inputStyle,

          opacity:
            disabled
              ? 0.6
              : 1,

          cursor:
            disabled
              ? "not-allowed"
              : "pointer",
        }}
      >
        <option value="">
          {placeholder}
        </option>

        {options.map(
          (option) => (
            <option
              key={
                option.value
              }

              value={
                option.value
              }
            >
              {
                option.label
              }
            </option>
          )
        )}
      </select>
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
      style={
        headerCellStyle
      }
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
      style={
        cellStyle
      }
    >
      {children}
    </td>
  );
}

const panelStyle:
  React.CSSProperties = {
  background:
    "var(--surface)",

  border:
    "1px solid var(--hairline)",

  borderRadius: 18,

  padding: 20,

  marginBottom: 24,
};

const formGridStyle:
  React.CSSProperties = {
  display: "grid",

  gridTemplateColumns:
    "repeat(auto-fit, minmax(230px, 1fr))",

  gap: 14,
};

const sectionTitleStyle:
  React.CSSProperties = {
  color:
    "var(--gold-bright)",

  fontWeight: 800,
};

const sectionDescriptionStyle:
  React.CSSProperties = {
  fontSize: 12,

  color:
    "var(--cream-faint)",

  marginTop: 4,
};

const labelStyle:
  React.CSSProperties = {
  display: "block",

  color:
    "var(--gold)",

  fontSize: 12,

  fontWeight: 700,

  marginBottom: 7,
};

const inputStyle:
  React.CSSProperties = {
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
};

const primaryButtonStyle:
  React.CSSProperties = {
  border:
    "1px solid var(--gold)",

  background:
    "var(--gold)",

  color:
    "#17110A",

  borderRadius: 10,

  padding:
    "12px 22px",

  fontWeight: 800,
};

const secondaryButtonStyle:
  React.CSSProperties = {
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
    "pointer",

  fontWeight: 700,
};

const editButtonStyle:
  React.CSSProperties = {
  border:
    "1px solid var(--gold)",

  background:
    "transparent",

  color:
    "var(--gold)",

  borderRadius: 8,

  padding:
    "8px 12px",

  cursor:
    "pointer",

  fontWeight: 700,
};

const statusStyle:
  React.CSSProperties = {
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
};

const listHeaderStyle:
  React.CSSProperties = {
  padding:
    "16px 18px",

  borderBottom:
    "1px solid var(--hairline)",

  display:
    "flex",

  justifyContent:
    "space-between",

  alignItems:
    "center",

  gap: 12,

  flexWrap:
    "wrap",
};

const headerCellStyle:
  React.CSSProperties = {
  padding:
    "13px 12px",

  textAlign:
    "left",

  color:
    "var(--gold-bright)",

  fontSize: 12,

  whiteSpace:
    "nowrap",
};

const cellStyle:
  React.CSSProperties = {
  padding: 12,

  fontSize: 13,

  color:
    "var(--cream)",

  verticalAlign:
    "top",

  whiteSpace:
    "nowrap",
};

const emptyCellStyle:
  React.CSSProperties = {
  padding: 28,

  textAlign:
    "center",

  color:
    "var(--cream-faint)",
};

const subTextStyle:
  React.CSSProperties = {
  marginTop: 3,

  color:
    "var(--cream-faint)",

  fontSize: 11,
};

const footerStyle:
  React.CSSProperties = {
  marginTop: 14,

  color:
    "var(--cream-faint)",

  fontSize: 12,

  lineHeight: 1.6,
};
