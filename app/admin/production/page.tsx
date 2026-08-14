"use client";

import { useEffect, useState } from "react";
import HomeButton from "@/components/HomeButton";

type ProductionRow = {
  agentCode: string;
  agentName: string;
  agentNickname: string;

  aiaCaseSubmitted: string;
  aiaCaseApproved: string;

  aiaFypSubmitted: string;
  aiaFypApproved: string;

  aiaFycApproved: string;

  paCase: string;
  paFyp: string;
  paFyc: string;

  note: string;
};

const emptyRow = (): ProductionRow => ({
  agentCode: "",
  agentName: "",
  agentNickname: "",

  aiaCaseSubmitted: "",
  aiaCaseApproved: "",

  aiaFypSubmitted: "",
  aiaFypApproved: "",

  aiaFycApproved: "",

  paCase: "",
  paFyp: "",
  paFyc: "",

  note: "",
});

function todayBangkok() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function parseNumber(value: string) {
  const cleaned = value.replace(/,/g, "").trim();
  return cleaned ? Number(cleaned) : 0;
}

function formatNumberInput(value: string) {
  const cleaned = value.replace(/,/g, "");

  if (!cleaned) return "";

  const [integerPart, decimalPart] = cleaned.split(".");

  const formattedInteger = integerPart
    .replace(/\D/g, "")
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  if (decimalPart !== undefined) {
    return `${formattedInteger}.${decimalPart.replace(/\D/g, "")}`;
  }

  return formattedInteger;
}

export default function DailyProductionPage() {
  const [productionDate, setProductionDate] = useState(todayBangkok());
  const [rows, setRows] = useState<ProductionRow[]>([emptyRow()]);
  const [loading, setLoading] = useState(false);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [status, setStatus] = useState("");

  async function loadExistingRows(date: string) {
    setLoadingExisting(true);
    setStatus("");

    try {
      const response = await fetch(
        `/api/daily-production?date=${encodeURIComponent(date)}`,
        { cache: "no-store" }
      );

      const data = await response.json();

      if (!response.ok) {
        setStatus(data.error || "ไม่สามารถโหลดข้อมูลเดิมได้");
        return;
      }

      if (!data.rows || data.rows.length === 0) {
        setRows([emptyRow()]);
        return;
      }

      setRows(
        data.rows.map((item: Record<string, unknown>) => ({
          agentCode: String(item.agent_code ?? ""),
          agentName: String(item.agent_name ?? ""),
          agentNickname: String(item.agent_nickname ?? ""),

          aiaCaseSubmitted: valueOrBlank(item.aia_case_submitted),
          aiaCaseApproved: valueOrBlank(item.aia_case_approved),

          aiaFypSubmitted: moneyOrBlank(item.aia_fyp_submitted),
          aiaFypApproved: moneyOrBlank(item.aia_fyp_approved),

          aiaFycApproved: moneyOrBlank(item.aia_fyc_approved),

          paCase: valueOrBlank(item.pa_case),
          paFyp: moneyOrBlank(item.pa_fyp),
          paFyc: moneyOrBlank(item.pa_fyc),

          note: String(item.note ?? ""),
        }))
      );
    } catch {
      setStatus("เกิดข้อผิดพลาดในการโหลดข้อมูล");
    } finally {
      setLoadingExisting(false);
    }
  }

  useEffect(() => {
    loadExistingRows(productionDate);
  }, [productionDate]);

  function updateRow(
    index: number,
    field: keyof ProductionRow,
    value: string
  ) {
    setRows((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [field]: value } : row
      )
    );
  }

  function addRow() {
    setRows((current) => [...current, emptyRow()]);
  }

  function removeRow(index: number) {
    setRows((current) => {
      const next = current.filter((_, rowIndex) => rowIndex !== index);
      return next.length ? next : [emptyRow()];
    });
  }

  async function saveAll() {
    setStatus("");

    const validRows = rows.filter((row) => row.agentName.trim());

    if (!validRows.length) {
      setStatus("กรุณากรอกชื่อตัวแทนอย่างน้อย 1 คน");
      return;
    }

    setLoading(true);

    try {
      const results = await Promise.all(
        validRows.map(async (row) => {
          const response = await fetch("/api/daily-production", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              productionDate,

              agentCode: row.agentCode.trim(),
              agentName: row.agentName.trim(),
              agentNickname: row.agentNickname.trim(),

              aiaCaseSubmitted: parseNumber(row.aiaCaseSubmitted),
              aiaCaseApproved: parseNumber(row.aiaCaseApproved),

              aiaFypSubmitted: parseNumber(row.aiaFypSubmitted),
              aiaFypApproved: parseNumber(row.aiaFypApproved),

              aiaFycApproved: parseNumber(row.aiaFycApproved),

              paCase: parseNumber(row.paCase),
              paFyp: parseNumber(row.paFyp),
              paFyc: parseNumber(row.paFyc),

              note: row.note.trim(),
            }),
          });

          return {
            ok: response.ok,
            data: await response.json(),
          };
        })
      );

      const failed = results.filter((result) => !result.ok);

      if (failed.length) {
        setStatus(`บันทึกไม่สำเร็จ ${failed.length} รายการ`);
        return;
      }

      setStatus(`บันทึก Daily Production สำเร็จ ${validRows.length} คน`);

      await loadExistingRows(productionDate);
    } catch {
      setStatus("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
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
      <div style={{ maxWidth: 1700, margin: "0 auto" }}>
        <div style={{ marginBottom: 20 }}>
          <HomeButton />
        </div>

        <div style={{ marginBottom: 24 }}>
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

          <h1 style={{ margin: 0, fontSize: 34 }}>
            Daily Production
          </h1>

          <p style={{ color: "#A89B86" }}>
            บันทึกผลงานนำส่ง / อนุมัติ ประจำวัน
          </p>
        </div>

        <div
          style={{
            background: "#17130E",
            border: "1px solid #4A3B1E",
            borderRadius: 16,
            padding: 18,
            marginBottom: 18,
          }}
        >
          <label
            style={{
              display: "block",
              color: "#C9A24B",
              fontWeight: 700,
              marginBottom: 8,
            }}
          >
            วันที่
          </label>

          <input
            type="date"
            value={productionDate}
            onChange={(e) => setProductionDate(e.target.value)}
            style={dateInputStyle}
          />

          {loadingExisting && (
            <span style={{ marginLeft: 12, color: "#A89B86" }}>
              กำลังโหลด...
            </span>
          )}
        </div>

        <div
          style={{
            background: "#17130E",
            border: "1px solid #4A3B1E",
            borderRadius: 16,
            overflow: "hidden",
          }}
        >
          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                minWidth: 1550,
                borderCollapse: "collapse",
              }}
            >
              <thead>
                <tr style={{ background: "rgba(201,162,75,.1)" }}>
                  <HeaderCell>Code</HeaderCell>
                  <HeaderCell>Name</HeaderCell>
                  <HeaderCell>Nick Name</HeaderCell>

                  <HeaderCell>AIA Case นำส่ง</HeaderCell>
                  <HeaderCell>AIA Case อนุมัติ</HeaderCell>

                  <HeaderCell>AIA FYP นำส่ง</HeaderCell>
                  <HeaderCell>AIA FYP อนุมัติ</HeaderCell>

                  <HeaderCell>AIA FYC อนุมัติ</HeaderCell>

                  <HeaderCell>PA Case</HeaderCell>
                  <HeaderCell>PA FYP</HeaderCell>
                  <HeaderCell>PA FYC</HeaderCell>

                  <HeaderCell>หมายเหตุ</HeaderCell>
                  <HeaderCell>จัดการ</HeaderCell>
                </tr>
              </thead>

              <tbody>
                {rows.map((row, index) => (
                  <tr
                    key={index}
                    style={{ borderTop: "1px solid #332A1C" }}
                  >
                    <Cell>
                      <TextInput
                        value={row.agentCode}
                        onChange={(v) => updateRow(index, "agentCode", v)}
                      />
                    </Cell>

                    <Cell>
                      <TextInput
                        value={row.agentName}
                        onChange={(v) => updateRow(index, "agentName", v)}
                      />
                    </Cell>

                    <Cell>
                      <TextInput
                        value={row.agentNickname}
                        onChange={(v) => updateRow(index, "agentNickname", v)}
                      />
                    </Cell>

                    <Cell>
                      <NumberInput
                        value={row.aiaCaseSubmitted}
                        onChange={(v) =>
                          updateRow(index, "aiaCaseSubmitted", v)
                        }
                      />
                    </Cell>

                    <Cell>
                      <NumberInput
                        value={row.aiaCaseApproved}
                        onChange={(v) =>
                          updateRow(index, "aiaCaseApproved", v)
                        }
                      />
                    </Cell>

                    <Cell>
                      <NumberInput
                        value={row.aiaFypSubmitted}
                        onChange={(v) =>
                          updateRow(
                            index,
                            "aiaFypSubmitted",
                            formatNumberInput(v)
                          )
                        }
                      />
                    </Cell>

                    <Cell>
                      <NumberInput
                        value={row.aiaFypApproved}
                        onChange={(v) =>
                          updateRow(
                            index,
                            "aiaFypApproved",
                            formatNumberInput(v)
                          )
                        }
                      />
                    </Cell>

                    <Cell>
                      <NumberInput
                        value={row.aiaFycApproved}
                        onChange={(v) =>
                          updateRow(
                            index,
                            "aiaFycApproved",
                            formatNumberInput(v)
                          )
                        }
                      />
                    </Cell>

                    <Cell>
                      <NumberInput
                        value={row.paCase}
                        onChange={(v) => updateRow(index, "paCase", v)}
                      />
                    </Cell>

                    <Cell>
                      <NumberInput
                        value={row.paFyp}
                        onChange={(v) =>
                          updateRow(index, "paFyp", formatNumberInput(v))
                        }
                      />
                    </Cell>

                    <Cell>
                      <NumberInput
                        value={row.paFyc}
                        onChange={(v) =>
                          updateRow(index, "paFyc", formatNumberInput(v))
                        }
                      />
                    </Cell>

                    <Cell>
                      <TextInput
                        value={row.note}
                        onChange={(v) => updateRow(index, "note", v)}
                      />
                    </Cell>

                    <Cell>
                      <button
                        onClick={() => removeRow(index)}
                        style={deleteButtonStyle}
                      >
                        ลบ
                      </button>
                    </Cell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div
            style={{
              padding: 18,
              borderTop: "1px solid #332A1C",
              display: "flex",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <button onClick={addRow} style={outlineButtonStyle}>
              + เพิ่มตัวแทน
            </button>

            <button
              onClick={saveAll}
              disabled={loading}
              style={saveButtonStyle}
            >
              {loading ? "กำลังบันทึก..." : "บันทึก Production วันนี้"}
            </button>
          </div>
        </div>

        {status && (
          <div
            style={{
              marginTop: 16,
              padding: 14,
              border: "1px solid #4A3B1E",
              borderRadius: 10,
              color: "#D8B66A",
            }}
          >
            {status}
          </div>
        )}
      </div>
    </main>
  );
}

function valueOrBlank(value: unknown) {
  const n = Number(value ?? 0);
  return n === 0 ? "" : String(n);
}

function moneyOrBlank(value: unknown) {
  const n = Number(value ?? 0);

  return n === 0
    ? ""
    : n.toLocaleString("en-US", {
        maximumFractionDigits: 2,
      });
}

function HeaderCell({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        padding: "13px 9px",
        color: "#D8B66A",
        fontSize: 12,
        textAlign: "left",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function Cell({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: 8 }}>{children}</td>;
}

function TextInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={tableInputStyle}
    />
  );
}

function NumberInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      value={value}
      inputMode="decimal"
      onChange={(e) => onChange(e.target.value)}
      style={{
        ...tableInputStyle,
        textAlign: "right",
      }}
    />
  );
}

const tableInputStyle = {
  width: "100%",
  minWidth: 105,
  boxSizing: "border-box" as const,
  background: "#0F0C09",
  color: "#F4E8D0",
  border: "1px solid #3D3325",
  borderRadius: 8,
  padding: "9px",
};

const dateInputStyle = {
  background: "#0F0C09",
  color: "#F4E8D0",
  border: "1px solid #4A3B1E",
  borderRadius: 8,
  padding: "10px 12px",
};

const outlineButtonStyle = {
  border: "1px solid #C9A24B",
  background: "transparent",
  color: "#C9A24B",
  borderRadius: 9,
  padding: "11px 16px",
  fontWeight: 700,
  cursor: "pointer",
};

const saveButtonStyle = {
  border: "1px solid #C9A24B",
  background: "#C9A24B",
  color: "#17110A",
  borderRadius: 9,
  padding: "11px 20px",
  fontWeight: 800,
  cursor: "pointer",
};

const deleteButtonStyle = {
  border: "1px solid #5B4230",
  background: "transparent",
  color: "#C8AA83",
  borderRadius: 8,
  padding: "8px 10px",
  cursor: "pointer",
};
