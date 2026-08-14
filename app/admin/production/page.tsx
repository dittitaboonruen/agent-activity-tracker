"use client";

import { useEffect, useState } from "react";
import HomeButton from "@/components/HomeButton";

type ProductionRow = {
  agentCode: string;
  agentName: string;
  aiaCase: string;
  aiaFyp: string;
  aiaFyc: string;
  paCase: string;
  paFyp: string;
  paFyc: string;
  note: string;
};

const emptyRow = (): ProductionRow => ({
  agentCode: "",
  agentName: "",
  aiaCase: "",
  aiaFyp: "",
  aiaFyc: "",
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

  if (!cleaned) {
    return 0;
  }

  return Number(cleaned);
}

function formatNumberInput(value: string) {
  const cleaned = value.replace(/,/g, "");

  if (cleaned === "") {
    return "";
  }

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
        {
          cache: "no-store",
        }
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

      const loadedRows: ProductionRow[] = data.rows.map(
        (item: Record<string, unknown>) => ({
          agentCode: String(item.agent_code ?? ""),
          agentName: String(item.agent_name ?? ""),

          aiaCase:
            Number(item.aia_case ?? 0) === 0
              ? ""
              : String(item.aia_case),

          aiaFyp:
            Number(item.aia_fyp ?? 0) === 0
              ? ""
              : Number(item.aia_fyp).toLocaleString("en-US", {
                  maximumFractionDigits: 2,
                }),

          aiaFyc:
            Number(item.aia_fyc ?? 0) === 0
              ? ""
              : Number(item.aia_fyc).toLocaleString("en-US", {
                  maximumFractionDigits: 2,
                }),

          paCase:
            Number(item.pa_case ?? 0) === 0
              ? ""
              : String(item.pa_case),

          paFyp:
            Number(item.pa_fyp ?? 0) === 0
              ? ""
              : Number(item.pa_fyp).toLocaleString("en-US", {
                  maximumFractionDigits: 2,
                }),

          paFyc:
            Number(item.pa_fyc ?? 0) === 0
              ? ""
              : Number(item.pa_fyc).toLocaleString("en-US", {
                  maximumFractionDigits: 2,
                }),

          note: String(item.note ?? ""),
        })
      );

      setRows(loadedRows);
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
        rowIndex === index
          ? {
              ...row,
              [field]: value,
            }
          : row
      )
    );
  }

  function updateMoneyField(
    index: number,
    field: keyof ProductionRow,
    value: string
  ) {
    updateRow(index, field, formatNumberInput(value));
  }

  function addRow() {
    setRows((current) => [...current, emptyRow()]);
  }

  function removeRow(index: number) {
    setRows((current) => {
      const next = current.filter((_, rowIndex) => rowIndex !== index);

      return next.length > 0 ? next : [emptyRow()];
    });
  }

  async function saveAll() {
    setStatus("");

    const validRows = rows.filter((row) => row.agentName.trim());

    if (validRows.length === 0) {
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

              aiaCase: parseNumber(row.aiaCase),
              aiaFyp: parseNumber(row.aiaFyp),
              aiaFyc: parseNumber(row.aiaFyc),

              paCase: parseNumber(row.paCase),
              paFyp: parseNumber(row.paFyp),
              paFyc: parseNumber(row.paFyc),

              note: row.note.trim(),
            }),
          });

          const data = await response.json();

          return {
            ok: response.ok,
            data,
            agentName: row.agentName,
          };
        })
      );

      const failed = results.filter((result) => !result.ok);

      if (failed.length > 0) {
        setStatus(
          `บันทึกไม่สำเร็จ ${failed.length} รายการ กรุณาตรวจสอบข้อมูลอีกครั้ง`
        );
        return;
      }

      setStatus(
        `บันทึก Daily Production สำเร็จ ${validRows.length} คน`
      );

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
      <div
        style={{
          maxWidth: 1500,
          margin: "0 auto",
        }}
      >
        {/* BACK */}
        <div style={{ marginBottom: 20 }}>
          <HomeButton />
        </div>

        {/* HEADER */}
        <div
          style={{
            marginBottom: 26,
          }}
        >
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
            Daily Production
          </h1>

          <p
            style={{
              marginTop: 10,
              color: "#A89B86",
              lineHeight: 1.6,
            }}
          >
            สำหรับ Admin บันทึกผลงานที่อนุมัติประจำวัน
          </p>
        </div>

        {/* DATE */}
        <div
          style={{
            background: "#17130E",
            border: "1px solid #4A3B1E",
            borderRadius: 18,
            padding: 20,
            marginBottom: 18,
          }}
        >
          <label
            style={{
              display: "block",
              fontSize: 13,
              color: "#C9A24B",
              fontWeight: 700,
              marginBottom: 8,
            }}
          >
            วันที่ Production
          </label>

          <input
            type="date"
            value={productionDate}
            onChange={(e) => setProductionDate(e.target.value)}
            style={{
              background: "#0F0C09",
              color: "#F4E8D0",
              border: "1px solid #4A3B1E",
              borderRadius: 10,
              padding: "11px 13px",
              fontSize: 15,
            }}
          />

          {loadingExisting && (
            <span
              style={{
                marginLeft: 14,
                fontSize: 13,
                color: "#A89B86",
              }}
            >
              กำลังโหลดข้อมูลของวันนี้...
            </span>
          )}
        </div>

        {/* TABLE */}
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
              overflowX: "auto",
            }}
          >
            <table
              style={{
                width: "100%",
                minWidth: 1300,
                borderCollapse: "collapse",
              }}
            >
              <thead>
                <tr
                  style={{
                    background: "rgba(201,162,75,0.10)",
                  }}
                >
                  <HeaderCell>Code</HeaderCell>
                  <HeaderCell>ชื่อตัวแทน</HeaderCell>

                  <HeaderCell>AIA CASE</HeaderCell>
                  <HeaderCell>AIA FYP</HeaderCell>
                  <HeaderCell>AIA FYC</HeaderCell>

                  <HeaderCell>PA CASE</HeaderCell>
                  <HeaderCell>PA FYP</HeaderCell>
                  <HeaderCell>PA FYC</HeaderCell>

                  <HeaderCell>หมายเหตุ</HeaderCell>
                  <HeaderCell></HeaderCell>
                </tr>
              </thead>

              <tbody>
                {rows.map((row, index) => (
                  <tr
                    key={index}
                    style={{
                      borderTop: "1px solid #332A1C",
                    }}
                  >
                    <Cell>
                      <TextInput
                        value={row.agentCode}
                        placeholder="เช่น 319930"
                        onChange={(value) =>
                          updateRow(index, "agentCode", value)
                        }
                      />
                    </Cell>

                    <Cell>
                      <TextInput
                        value={row.agentName}
                        placeholder="ชื่อตัวแทน"
                        onChange={(value) =>
                          updateRow(index, "agentName", value)
                        }
                      />
                    </Cell>

                    <Cell>
                      <NumberInput
                        value={row.aiaCase}
                        placeholder="0"
                        onChange={(value) =>
                          updateRow(index, "aiaCase", value)
                        }
                      />
                    </Cell>

                    <Cell>
                      <NumberInput
                        value={row.aiaFyp}
                        placeholder="0"
                        onChange={(value) =>
                          updateMoneyField(index, "aiaFyp", value)
                        }
                      />
                    </Cell>

                    <Cell>
                      <NumberInput
                        value={row.aiaFyc}
                        placeholder="0"
                        onChange={(value) =>
                          updateMoneyField(index, "aiaFyc", value)
                        }
                      />
                    </Cell>

                    <Cell>
                      <NumberInput
                        value={row.paCase}
                        placeholder="0"
                        onChange={(value) =>
                          updateRow(index, "paCase", value)
                        }
                      />
                    </Cell>

                    <Cell>
                      <NumberInput
                        value={row.paFyp}
                        placeholder="0"
                        onChange={(value) =>
                          updateMoneyField(index, "paFyp", value)
                        }
                      />
                    </Cell>

                    <Cell>
                      <NumberInput
                        value={row.paFyc}
                        placeholder="0"
                        onChange={(value) =>
                          updateMoneyField(index, "paFyc", value)
                        }
                      />
                    </Cell>

                    <Cell>
                      <TextInput
                        value={row.note}
                        placeholder="ไม่บังคับ"
                        onChange={(value) =>
                          updateRow(index, "note", value)
                        }
                      />
                    </Cell>

                    <Cell>
                      <button
                        type="button"
                        onClick={() => removeRow(index)}
                        style={{
                          border: "1px solid #5B4230",
                          background: "transparent",
                          color: "#C8AA83",
                          borderRadius: 8,
                          padding: "8px 10px",
                          cursor: "pointer",
                        }}
                      >
                        ลบ
                      </button>
                    </Cell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ACTION */}
          <div
            style={{
              padding: 20,
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              borderTop: "1px solid #332A1C",
            }}
          >
            <button
              type="button"
              onClick={addRow}
              style={{
                border: "1px solid #C9A24B",
                background: "transparent",
                color: "#C9A24B",
                borderRadius: 10,
                padding: "11px 16px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              + เพิ่มตัวแทน
            </button>

            <button
              type="button"
              onClick={saveAll}
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
                : "บันทึก Production วันนี้"}
            </button>
          </div>
        </div>

        {status && (
          <div
            style={{
              marginTop: 18,
              padding: "14px 18px",
              borderRadius: 12,
              border: "1px solid #4A3B1E",
              background: "rgba(201,162,75,0.08)",
              color: "#D8B66A",
              fontWeight: 700,
            }}
          >
            {status}
          </div>
        )}

        <div
          style={{
            color: "#807460",
            fontSize: 12,
            marginTop: 16,
            lineHeight: 1.6,
          }}
        >
          ไม่ต้องกรอก YTD หรือจำนวนเดือนที่มีงานอนุมัติ
          ระบบจะคำนวณจาก Daily Production ให้อัตโนมัติ
        </div>
      </div>
    </main>
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
        padding: "14px 10px",
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
        padding: 9,
        verticalAlign: "middle",
      }}
    >
      {children}
    </td>
  );
}

function TextInput({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      style={tableInputStyle}
    />
  );
}

function NumberInput({
  value,
  placeholder,
  onChange,
}: {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      value={value}
      placeholder={placeholder}
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
  minWidth: 110,
  boxSizing: "border-box" as const,
  background: "#0F0C09",
  color: "#F4E8D0",
  border: "1px solid #3D3325",
  borderRadius: 8,
  padding: "10px 9px",
  fontSize: 13,
};
