"use client";

import { useEffect, useMemo, useState } from "react";
import HomeButton from "@/components/HomeButton";

type DailyProduction = {
  production_date: string;
  agent_code: string | null;
  agent_name: string;
  agent_nickname: string | null;

  aia_case_submitted: number;
  aia_case_approved: number;
  aia_fyp_submitted: number;
  aia_fyp_approved: number;
  aia_fyc_approved: number;

  pa_case: number;
  pa_fyp: number;
  pa_fyc: number;
};

type AgentSummary = {
  code: string;
  name: string;
  nickname: string;

  monthlyAiaCaseSubmitted: number;
  monthlyAiaCaseApproved: number;
  monthlyAiaFypSubmitted: number;
  monthlyAiaFypApproved: number;
  monthlyAiaFycApproved: number;

  ytdAiaCaseApproved: number;
  ytdAiaFypApproved: number;
  ytdAiaFycApproved: number;

  monthlyPaCase: number;
  monthlyPaFyp: number;
  monthlyPaFyc: number;

  ytdPaCase: number;
  ytdPaFyp: number;
  ytdPaFyc: number;

  approvedMonths: number;
};

function currentBangkokYearMonth() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((p) => p.type === "year")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";

  return { year, month };
}

function money(value: number) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function PerformanceDashboardPage() {
  const initial = currentBangkokYearMonth();

  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);
  const [rows, setRows] = useState<DailyProduction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/daily-production", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "ไม่สามารถโหลดข้อมูลได้");
        return;
      }

      setRows(data.rows ?? []);
    } catch {
      setError("เกิดข้อผิดพลาดในการโหลดข้อมูล");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const summary = useMemo(() => {
    const selectedMonth = `${year}-${month}`;

    const ytdStart = `${year}-01-01`;
    const ytdEnd = `${year}-${month}-31`;

    const monthRows = rows.filter((row) =>
      row.production_date.startsWith(selectedMonth)
    );

    const ytdRows = rows.filter(
      (row) =>
        row.production_date >= ytdStart &&
        row.production_date <= ytdEnd
    );

    const agentNames = Array.from(
      new Set(
        ytdRows
          .map((row) => row.agent_name)
          .filter(Boolean)
      )
    ).sort();

    return agentNames.map((agentName): AgentSummary => {
      const monthly = monthRows.filter(
        (row) => row.agent_name === agentName
      );

      const ytd = ytdRows.filter(
        (row) => row.agent_name === agentName
      );

      const latestInfo =
        [...ytd]
          .sort((a, b) =>
            b.production_date.localeCompare(a.production_date)
          )[0] ?? null;

      const approvedMonthSet = new Set(
        ytd
          .filter(
            (row) =>
              Number(row.aia_case_approved ?? 0) > 0 ||
              Number(row.pa_case ?? 0) > 0
          )
          .map((row) => row.production_date.slice(0, 7))
      );

      return {
        code: latestInfo?.agent_code ?? "",
        name: agentName,
        nickname: latestInfo?.agent_nickname ?? "",

        monthlyAiaCaseSubmitted: monthly.reduce(
          (sum, row) => sum + Number(row.aia_case_submitted ?? 0),
          0
        ),

        monthlyAiaCaseApproved: monthly.reduce(
          (sum, row) => sum + Number(row.aia_case_approved ?? 0),
          0
        ),

        monthlyAiaFypSubmitted: monthly.reduce(
          (sum, row) => sum + Number(row.aia_fyp_submitted ?? 0),
          0
        ),

        monthlyAiaFypApproved: monthly.reduce(
          (sum, row) => sum + Number(row.aia_fyp_approved ?? 0),
          0
        ),

        monthlyAiaFycApproved: monthly.reduce(
          (sum, row) => sum + Number(row.aia_fyc_approved ?? 0),
          0
        ),

        ytdAiaCaseApproved: ytd.reduce(
          (sum, row) => sum + Number(row.aia_case_approved ?? 0),
          0
        ),

        ytdAiaFypApproved: ytd.reduce(
          (sum, row) => sum + Number(row.aia_fyp_approved ?? 0),
          0
        ),

        ytdAiaFycApproved: ytd.reduce(
          (sum, row) => sum + Number(row.aia_fyc_approved ?? 0),
          0
        ),

        monthlyPaCase: monthly.reduce(
          (sum, row) => sum + Number(row.pa_case ?? 0),
          0
        ),

        monthlyPaFyp: monthly.reduce(
          (sum, row) => sum + Number(row.pa_fyp ?? 0),
          0
        ),

        monthlyPaFyc: monthly.reduce(
          (sum, row) => sum + Number(row.pa_fyc ?? 0),
          0
        ),

        ytdPaCase: ytd.reduce(
          (sum, row) => sum + Number(row.pa_case ?? 0),
          0
        ),

        ytdPaFyp: ytd.reduce(
          (sum, row) => sum + Number(row.pa_fyp ?? 0),
          0
        ),

        ytdPaFyc: ytd.reduce(
          (sum, row) => sum + Number(row.pa_fyc ?? 0),
          0
        ),

        approvedMonths: approvedMonthSet.size,
      };
    });
  }, [rows, year, month]);

  const totals = useMemo(() => {
    return summary.reduce(
      (acc, row) => ({
        monthlyAiaCaseSubmitted:
          acc.monthlyAiaCaseSubmitted + row.monthlyAiaCaseSubmitted,

        monthlyAiaCaseApproved:
          acc.monthlyAiaCaseApproved + row.monthlyAiaCaseApproved,

        monthlyAiaFypSubmitted:
          acc.monthlyAiaFypSubmitted + row.monthlyAiaFypSubmitted,

        monthlyAiaFypApproved:
          acc.monthlyAiaFypApproved + row.monthlyAiaFypApproved,

        monthlyAiaFycApproved:
          acc.monthlyAiaFycApproved + row.monthlyAiaFycApproved,

        ytdAiaCaseApproved:
          acc.ytdAiaCaseApproved + row.ytdAiaCaseApproved,

        ytdAiaFypApproved:
          acc.ytdAiaFypApproved + row.ytdAiaFypApproved,

        ytdAiaFycApproved:
          acc.ytdAiaFycApproved + row.ytdAiaFycApproved,

        monthlyPaCase:
          acc.monthlyPaCase + row.monthlyPaCase,

        monthlyPaFyp:
          acc.monthlyPaFyp + row.monthlyPaFyp,

        monthlyPaFyc:
          acc.monthlyPaFyc + row.monthlyPaFyc,

        ytdPaCase:
          acc.ytdPaCase + row.ytdPaCase,

        ytdPaFyp:
          acc.ytdPaFyp + row.ytdPaFyp,

        ytdPaFyc:
          acc.ytdPaFyc + row.ytdPaFyc,
      }),
      {
        monthlyAiaCaseSubmitted: 0,
        monthlyAiaCaseApproved: 0,
        monthlyAiaFypSubmitted: 0,
        monthlyAiaFypApproved: 0,
        monthlyAiaFycApproved: 0,

        ytdAiaCaseApproved: 0,
        ytdAiaFypApproved: 0,
        ytdAiaFycApproved: 0,

        monthlyPaCase: 0,
        monthlyPaFyp: 0,
        monthlyPaFyc: 0,

        ytdPaCase: 0,
        ytdPaFyp: 0,
        ytdPaFyc: 0,
      }
    );
  }, [summary]);

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
          maxWidth: 1800,
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
            Monthly Performance
          </h1>

          <p
            style={{
              color: "#A89B86",
              marginTop: 8,
            }}
          >
            สรุปผลงาน Production รายเดือนและ YTD
          </p>
        </div>

        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 18,
          }}
        >
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            style={filterStyle}
          >
            {[
              ["01", "มกราคม"],
              ["02", "กุมภาพันธ์"],
              ["03", "มีนาคม"],
              ["04", "เมษายน"],
              ["05", "พฤษภาคม"],
              ["06", "มิถุนายน"],
              ["07", "กรกฎาคม"],
              ["08", "สิงหาคม"],
              ["09", "กันยายน"],
              ["10", "ตุลาคม"],
              ["11", "พฤศจิกายน"],
              ["12", "ธันวาคม"],
            ].map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            style={filterStyle}
          >
            {["2025", "2026", "2027", "2028", "2029", "2030"].map(
              (value) => (
                <option key={value} value={value}>
                  {Number(value) + 543}
                </option>
              )
            )}
          </select>

          <button
            onClick={loadData}
            style={{
              ...filterStyle,
              cursor: "pointer",
              color: "#C9A24B",
            }}
          >
            ↻ รีเฟรช
          </button>
        </div>

        {loading && (
          <div style={{ marginBottom: 16, color: "#A89B86" }}>
            กำลังโหลดข้อมูล...
          </div>
        )}

        {error && (
          <div
            style={{
              marginBottom: 16,
              color: "#E0A98B",
            }}
          >
            {error}
          </div>
        )}

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
                minWidth: 1900,
                borderCollapse: "collapse",
              }}
            >
              <thead>
                <tr
                  style={{
                    background: "rgba(201,162,75,0.12)",
                  }}
                >
                  <HeaderCell>No.</HeaderCell>
                  <HeaderCell>Code</HeaderCell>
                  <HeaderCell>Name</HeaderCell>
                  <HeaderCell>Nick Name</HeaderCell>

                  <HeaderCell>AIA Case นำส่ง</HeaderCell>
                  <HeaderCell>AIA Case อนุมัติ</HeaderCell>
                  <HeaderCell>AIA FYP นำส่ง</HeaderCell>
                  <HeaderCell>AIA FYP อนุมัติ</HeaderCell>
                  <HeaderCell>AIA FYC อนุมัติ</HeaderCell>

                  <HeaderCell>AIA Case YTD</HeaderCell>
                  <HeaderCell>AIA FYP YTD</HeaderCell>
                  <HeaderCell>AIA FYC YTD</HeaderCell>

                  <HeaderCell>PA Case</HeaderCell>
                  <HeaderCell>PA FYP</HeaderCell>
                  <HeaderCell>PA FYC</HeaderCell>

                  <HeaderCell>PA Case YTD</HeaderCell>
                  <HeaderCell>PA FYP YTD</HeaderCell>
                  <HeaderCell>PA FYC YTD</HeaderCell>

                  <HeaderCell>เดือนที่มีงานอนุมัติ</HeaderCell>
                </tr>
              </thead>

              <tbody>
                {summary.map((row, index) => (
                  <tr
                    key={row.name}
                    style={{
                      borderTop: "1px solid #332A1C",
                    }}
                  >
                    <Cell>{index + 1}</Cell>
                    <Cell>{row.code}</Cell>
                    <Cell>{row.name}</Cell>
                    <Cell>{row.nickname}</Cell>

                    <NumberCell>{row.monthlyAiaCaseSubmitted}</NumberCell>
                    <NumberCell>{row.monthlyAiaCaseApproved}</NumberCell>
                    <NumberCell>
                      {money(row.monthlyAiaFypSubmitted)}
                    </NumberCell>
                    <NumberCell>
                      {money(row.monthlyAiaFypApproved)}
                    </NumberCell>
                    <NumberCell>
                      {money(row.monthlyAiaFycApproved)}
                    </NumberCell>

                    <NumberCell>{row.ytdAiaCaseApproved}</NumberCell>
                    <NumberCell>
                      {money(row.ytdAiaFypApproved)}
                    </NumberCell>
                    <NumberCell>
                      {money(row.ytdAiaFycApproved)}
                    </NumberCell>

                    <NumberCell>{row.monthlyPaCase}</NumberCell>
                    <NumberCell>{money(row.monthlyPaFyp)}</NumberCell>
                    <NumberCell>{money(row.monthlyPaFyc)}</NumberCell>

                    <NumberCell>{row.ytdPaCase}</NumberCell>
                    <NumberCell>{money(row.ytdPaFyp)}</NumberCell>
                    <NumberCell>{money(row.ytdPaFyc)}</NumberCell>

                    <NumberCell>{row.approvedMonths}</NumberCell>
                  </tr>
                ))}

                <tr
                  style={{
                    background: "rgba(201,162,75,0.14)",
                    borderTop: "1px solid #C9A24B",
                    fontWeight: 800,
                  }}
                >
                  <Cell>รวม</Cell>
                  <Cell></Cell>
                  <Cell></Cell>
                  <Cell></Cell>

                  <NumberCell>
                    {totals.monthlyAiaCaseSubmitted}
                  </NumberCell>
                  <NumberCell>
                    {totals.monthlyAiaCaseApproved}
                  </NumberCell>
                  <NumberCell>
                    {money(totals.monthlyAiaFypSubmitted)}
                  </NumberCell>
                  <NumberCell>
                    {money(totals.monthlyAiaFypApproved)}
                  </NumberCell>
                  <NumberCell>
                    {money(totals.monthlyAiaFycApproved)}
                  </NumberCell>

                  <NumberCell>
                    {totals.ytdAiaCaseApproved}
                  </NumberCell>
                  <NumberCell>
                    {money(totals.ytdAiaFypApproved)}
                  </NumberCell>
                  <NumberCell>
                    {money(totals.ytdAiaFycApproved)}
                  </NumberCell>

                  <NumberCell>{totals.monthlyPaCase}</NumberCell>
                  <NumberCell>{money(totals.monthlyPaFyp)}</NumberCell>
                  <NumberCell>{money(totals.monthlyPaFyc)}</NumberCell>

                  <NumberCell>{totals.ytdPaCase}</NumberCell>
                  <NumberCell>{money(totals.ytdPaFyp)}</NumberCell>
                  <NumberCell>{money(totals.ytdPaFyc)}</NumberCell>

                  <Cell>-</Cell>
                </tr>
              </tbody>
            </table>
          </div>
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
        padding: "13px 10px",
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

function Cell({
  children,
}: {
  children?: React.ReactNode;
}) {
  return (
    <td
      style={{
        padding: "11px 10px",
        fontSize: 13,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </td>
  );
}

function NumberCell({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <td
      style={{
        padding: "11px 10px",
        fontSize: 13,
        textAlign: "right",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </td>
  );
}

const filterStyle = {
  background: "#17130E",
  color: "#F4E8D0",
  border: "1px solid #4A3B1E",
  borderRadius: 9,
  padding: "10px 12px",
  fontSize: 14,
};
