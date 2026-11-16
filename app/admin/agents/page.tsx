"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import PageTopBar from "@/components/PageTopBar";
import "./agent-master.css";

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

  const [search, setSearch] = useState("");
  const [unitFilter, setUnitFilter] = useState("all");
  const [managerFilter, setManagerFilter] = useState("all");
  const [emailFilter, setEmailFilter] = useState("all");
  const [showEditor, setShowEditor] = useState(false);

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

  const filteredAgents = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("th-TH");
    return agents.filter((agent) => {
      if (unitFilter !== "all" && String(agent.unit_id ?? "") !== unitFilter) return false;
      if (managerFilter !== "all" && (agent.manager_user_id ?? "") !== managerFilter) return false;
      if (emailFilter === "with" && !agent.agent_email?.trim()) return false;
      if (emailFilter === "without" && agent.agent_email?.trim()) return false;
      if (!keyword) return true;
      const unit = units.find(item => item.id === agent.unit_id);
      const manager = managers.find(item => item.user_id === agent.manager_user_id);
      return [
        agent.agent_code, agent.agent_name, agent.agent_nickname,
        agent.agent_email, agent.jotform_agent_name,
        unit?.unit_code, unit?.unit_name, manager?.full_name, manager?.email,
      ].filter(Boolean).join(" ").toLocaleLowerCase("th-TH").includes(keyword);
    });
  }, [agents, units, managers, search, unitFilter, managerFilter, emailFilter]);

  const emailCount = agents.filter(agent => Boolean(agent.agent_email?.trim())).length;
  const missingEmailCount = agents.length - emailCount;
  const unitCounts = units.map(unit => ({
    ...unit,
    count: agents.filter(agent => agent.unit_id === unit.id).length,
  })).filter(unit => unit.count > 0);
  const unknownUnitCount = agents.filter(agent => !units.some(unit => unit.id === agent.unit_id)).length;

  function startAdd() {
    resetForm();
    setShowEditor(true);
    window.setTimeout(() => document.getElementById("agent-master-editor")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

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
    setShowEditor(true);

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
    <main className="rp-agent-page">
      <div className="rp-agent-container">
        <PageTopBar />

        <header className="rp-agent-heading">
          <div className="rp-agent-eyebrow">ROYAL PARTNER · AGENT MASTER</div>
          <div className="rp-agent-heading-line">
            <span className="rp-agent-heading-icon" aria-hidden="true">👥</span>
            <div>
              <h1>Agent Master</h1>
              <p>ทะเบียนกลางของตัวแทน หน่วย หัวหน้าที่ดูแล และข้อมูลสำหรับเชื่อมระบบ Skool</p>
            </div>
          </div>
        </header>

        <aside className="rp-agent-notice">
          <span aria-hidden="true" className="rp-agent-notice-icon">ℹ</span>
          <div>
            <strong>ข้อมูลทะเบียนตัวแทน</strong>
            <p>ตรวจสอบรหัส ชื่อ อีเมล หน่วย และผู้ดูแลให้ถูกต้องก่อนนำเข้าข้อมูลจาก Skool หรือ Jotform</p>
            <small>การมีอีเมลใน Agent Master ยังไม่ใช่การยืนยันว่าจับคู่บัญชี Skool สำเร็จ</small>
          </div>
        </aside>

        <section className="rp-agent-stats" aria-label="สรุปทะเบียนตัวแทน">
          <div className="rp-agent-stat rp-agent-stat-gold">
            <span className="rp-agent-stat-icon" aria-hidden="true">👥</span>
            <div><span className="rp-agent-stat-label">ตัวแทนทั้งหมด</span><strong>{agents.length.toLocaleString("th-TH")} <small>คน</small></strong></div>
          </div>
          <div className="rp-agent-stat rp-agent-stat-green">
            <span className="rp-agent-stat-icon" aria-hidden="true">✉</span>
            <div><span className="rp-agent-stat-label">มีอีเมลสำหรับจับคู่</span><strong>{emailCount.toLocaleString("th-TH")} <small>คน</small></strong><span className="rp-agent-stat-detail">{agents.length ? Math.round(emailCount / agents.length * 100) : 0}% ของทะเบียน</span></div>
          </div>
          <div className="rp-agent-stat rp-agent-stat-rose">
            <span className="rp-agent-stat-icon" aria-hidden="true">!</span>
            <div><span className="rp-agent-stat-label">ยังไม่มีอีเมล</span><strong>{missingEmailCount.toLocaleString("th-TH")} <small>คน</small></strong><span className="rp-agent-stat-detail">ควรตรวจสอบข้อมูล</span></div>
          </div>
          <div className="rp-agent-stat rp-agent-stat-purple">
            <span className="rp-agent-stat-icon" aria-hidden="true">▦</span>
            <div className="rp-agent-units-summary">
              <span className="rp-agent-stat-label">จำนวนตามหน่วย (Unit)</span>
              {unitCounts.map(unit => <div key={unit.id} className="rp-agent-unit-line"><span>{unit.unit_name || unit.unit_code}</span><strong>{unit.count} คน</strong></div>)}
              {unknownUnitCount > 0 && <div className="rp-agent-unit-line"><span>ยังไม่ได้กำหนด</span><strong>{unknownUnitCount} คน</strong></div>}
            </div>
          </div>
        </section>

        <section className="rp-agent-list" aria-label="รายชื่อตัวแทน">
          <div className="rp-agent-filters">
            <label className="rp-agent-search">
              <span className="rp-agent-filter-icon" aria-hidden="true">⌕</span>
              <span className="rp-agent-sr-only">ค้นหาตัวแทน</span>
              <input value={search} onChange={event => setSearch(event.target.value)}
                placeholder="ค้นหารหัส ชื่อ ชื่อเล่น อีเมล หรือ Jotform..." />
            </label>
            <label className="rp-agent-filter"><span>▦ หน่วยงาน</span>
              <select value={unitFilter} onChange={event => setUnitFilter(event.target.value)}>
                <option value="all">ทุกหน่วย</option>
                {units.map(unit => <option key={unit.id} value={String(unit.id)}>{unit.unit_name || unit.unit_code}</option>)}
              </select>
            </label>
            <label className="rp-agent-filter"><span>♙ ผู้จัดการ</span>
              <select value={managerFilter} onChange={event => setManagerFilter(event.target.value)}>
                <option value="all">ทุกคน</option>
                {managers.map(manager => <option key={manager.user_id} value={manager.user_id}>{manager.full_name || manager.email}</option>)}
              </select>
            </label>
            <label className="rp-agent-filter"><span>✉ สถานะอีเมล</span>
              <select value={emailFilter} onChange={event => setEmailFilter(event.target.value)}>
                <option value="all">ทั้งหมด</option>
                <option value="with">มีอีเมล</option>
                <option value="without">ไม่มีอีเมล</option>
              </select>
            </label>
            {canManage && <button type="button" className="rp-agent-add" onClick={startAdd}>✚ เพิ่มตัวแทน</button>}
            <button type="button" className="rp-agent-refresh" onClick={() => void loadAgentMaster()} disabled={loadingAgents}>
              ↻ {loadingAgents ? "กำลังโหลด" : "รีเฟรช"}
            </button>
          </div>

          <div className="rp-agent-list-heading">
            <div><h2>👥 รายชื่อตัวแทน</h2><p>แสดง {filteredAgents.length} จากทั้งหมด {agents.length} คน</p></div>
            {(search || unitFilter !== "all" || managerFilter !== "all" || emailFilter !== "all") && (
              <button type="button" className="rp-agent-reset" onClick={() => { setSearch(""); setUnitFilter("all"); setManagerFilter("all"); setEmailFilter("all"); }}>ล้างตัวกรอง ✕</button>
            )}
          </div>

          <div className="rp-agent-table-wrap">
            <table className="rp-agent-table">
              <thead><tr>
                <th>No.</th><th>▥ รหัส (Code)</th><th>♟ ชื่อ-นามสกุล (Name)</th><th>◇ ชื่อเล่น</th>
                <th>▦ หน่วยงาน (Unit)</th><th>♙ ผู้จัดการ (Manager)</th>
                <th>✉ อีเมล / สำหรับ Skool</th><th>▤ ชื่อใน Jotform</th>
                {canManage && <th>จัดการ</th>}
              </tr></thead>
              <tbody>
                {loadingAgents ? (
                  <tr><td className="rp-agent-empty" colSpan={canManage ? 9 : 8}>กำลังโหลดทะเบียนตัวแทน…</td></tr>
                ) : filteredAgents.length === 0 ? (
                  <tr><td className="rp-agent-empty" colSpan={canManage ? 9 : 8}>ไม่พบตัวแทนตามตัวกรองที่เลือก</td></tr>
                ) : filteredAgents.map((agent, index) => {
                  const unit = getUnit(agent);
                  const manager = getManager(agent);
                  const unitCode = (unit?.unit_code || "").toUpperCase();
                  const unitClass = unitCode.includes("A") && !unitCode.includes("CENTRAL") && !unitCode.includes("TEAM_B") && !unitCode.includes("TEAM_C") ? "a" : unitCode.includes("B") && !unitCode.includes("CENTRAL") ? "b" : unitCode.includes("C") && !unitCode.includes("CENTRAL") ? "c" : "center";
                  return <tr key={agent.id}>
                    <td className="rp-agent-row-no">{index + 1}</td>
                    <td><span className="rp-agent-code">{agent.agent_code || "—"}</span></td>
                    <td><span className="rp-agent-name"><span aria-hidden="true">♟</span>{agent.agent_name}</span></td>
                    <td>{agent.agent_nickname || <span className="rp-agent-muted">—</span>}</td>
                    <td><span className={"rp-agent-unit-tag rp-agent-unit-" + unitClass}>{unit ? (unit.unit_code || unit.unit_name) : "ยังไม่กำหนด"}</span></td>
                    <td><span className="rp-agent-manager-name">{manager?.full_name || "—"}</span>{manager?.email && <small className="rp-agent-secondary">{manager.email}</small>}</td>
                    <td>{agent.agent_email?.trim() ? (
                      <div className="rp-agent-email-cell"><span className="rp-agent-email" title={agent.agent_email}>{agent.agent_email}</span><span className="rp-agent-status rp-agent-status-email">✓ มีอีเมล</span></div>
                    ) : <span className="rp-agent-status rp-agent-status-missing">✉ ยังไม่มีอีเมล</span>}</td>
                    <td>{agent.jotform_agent_name || <span className="rp-agent-muted">—</span>}</td>
                    {canManage && <td><button type="button" className="rp-agent-edit" onClick={() => editAgent(agent)}>✎ แก้ไข</button></td>}
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        </section>

        {canManage && showEditor ? (
          <section id="agent-master-editor" className="rp-agent-editor" style={panelStyle}>
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
        ) : !canManage ? (
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


        {status && <div className="rp-agent-status-message" role="status">{status}</div>}
        <p className="rp-agent-footnote">ℹ Agent Email เป็นข้อมูลสำหรับจับคู่กับ Skool ส่วน Jotform Name ใช้จับคู่ Activity • สถานะเชื่อมบัญชี Skool จริงต้องตรวจจากระบบ Skool</p>
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
