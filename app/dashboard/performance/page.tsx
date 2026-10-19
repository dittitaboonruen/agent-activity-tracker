"use client";

import { useEffect, useMemo, useState } from "react";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell as RechartsCell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import PageTopBar from "@/components/PageTopBar";

/* ------------------------------------------------------------------ */
/* TYPES                                                               */
/* ------------------------------------------------------------------ */

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

type AgentMaster = {
  agent_code: string | null;
  agent_name: string;
  agent_nickname: string | null;
  unit_id?: number | null;
};

type Unit = {
  id: number;
  unit_code: string | null;
  unit_name: string;
};

type Totals = {
  caseSubmitted: number;
  caseApproved: number;

  fypSubmitted: number;
  fypApproved: number;
  fycApproved: number;

  paCase: number;
  paFyp: number;
  paFyc: number;
};

type AgentSummary = {
  code: string;
  name: string;
  nickname: string;
  unit: string;
  month: Totals;
  ytd: Totals;
  approvedMonths: number;
};

type UnitLine = {
  label: string;
  month: Totals;
  ytd: Totals;
  activeAgents: number;
};

type PerformanceChartRow = {
  name: string;
  fullName?: string;
  unit?: string;

  caseApproved: number;
  fyp: number;
  fyc: number;

  activeAgents?: number;
};

type View =
  | "agent"
  | "unit"
  | "rank";

/* ------------------------------------------------------------------ */
/* CONSTANTS                                                           */
/* ------------------------------------------------------------------ */

const MONTHS: [string, string][] = [
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
];

const NO_UNIT =
  "ไม่ระบุหน่วย";

const EMPTY: Totals = {
  caseSubmitted: 0,
  caseApproved: 0,

  fypSubmitted: 0,
  fypApproved: 0,
  fycApproved: 0,

  paCase: 0,
  paFyp: 0,
  paFyc: 0,
};

const PIE_COLORS = [
  "#C9972B",
  "#D9B85D",
  "#8D6B25",
  "#E5C978",
  "#A67C22",
  "#F0DDA5",
  "#755619",
  "#B99542",
  "#E2C36F",
  "#967020",
];

/* ------------------------------------------------------------------ */
/* HELPERS                                                             */
/* ------------------------------------------------------------------ */

function currentBangkokYearMonth() {
  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone:
          "Asia/Bangkok",
        year: "numeric",
        month: "2-digit",
      }
    ).formatToParts(
      new Date()
    );

  return {
    year:
      parts.find(
        (part) =>
          part.type ===
          "year"
      )?.value ?? "",

    month:
      parts.find(
        (part) =>
          part.type ===
          "month"
      )?.value ?? "",
  };
}

function money(
  value: number
) {
  return value.toLocaleString(
    "en-US",
    {
      minimumFractionDigits:
        2,
      maximumFractionDigits:
        2,
    }
  );
}

function compactMoney(
  value: number
) {
  return new Intl.NumberFormat(
    "en-US",
    {
      notation: "compact",
      maximumFractionDigits:
        1,
    }
  ).format(value);
}

function n(
  value: unknown
) {
  return (
    Number(value ?? 0) ||
    0
  );
}

function sumRows(
  list: DailyProduction[]
): Totals {
  return list.reduce(
    (acc, row) => ({
      caseSubmitted:
        acc.caseSubmitted +
        n(
          row.aia_case_submitted
        ),

      caseApproved:
        acc.caseApproved +
        n(
          row.aia_case_approved
        ),

      fypSubmitted:
        acc.fypSubmitted +
        n(
          row.aia_fyp_submitted
        ),

      fypApproved:
        acc.fypApproved +
        n(
          row.aia_fyp_approved
        ),

      fycApproved:
        acc.fycApproved +
        n(
          row.aia_fyc_approved
        ),

      paCase:
        acc.paCase +
        n(row.pa_case),

      paFyp:
        acc.paFyp +
        n(row.pa_fyp),

      paFyc:
        acc.paFyc +
        n(row.pa_fyc),
    }),
    {
      ...EMPTY,
    }
  );
}

function addTotals(
  a: Totals,
  b: Totals
): Totals {
  return {
    caseSubmitted:
      a.caseSubmitted +
      b.caseSubmitted,

    caseApproved:
      a.caseApproved +
      b.caseApproved,

    fypSubmitted:
      a.fypSubmitted +
      b.fypSubmitted,

    fypApproved:
      a.fypApproved +
      b.fypApproved,

    fycApproved:
      a.fycApproved +
      b.fycApproved,

    paCase:
      a.paCase +
      b.paCase,

    paFyp:
      a.paFyp +
      b.paFyp,

    paFyc:
      a.paFyc +
      b.paFyc,
  };
}

/**
 * Active Agent =
 * มี AIA Case อนุมัติอย่างน้อย 1 Case
 */
function countActive(
  list: DailyProduction[]
) {
  const totalsByAgent =
    new Map<
      string,
      number
    >();

  list.forEach(
    (row) => {
      totalsByAgent.set(
        row.agent_name,

        (totalsByAgent.get(
          row.agent_name
        ) ?? 0) +
          n(
            row.aia_case_approved
          )
      );
    }
  );

  return Array.from(
    totalsByAgent.values()
  ).filter(
    (value) =>
      value > 0
  ).length;
}

/* ------------------------------------------------------------------ */
/* PAGE                                                                */
/* ------------------------------------------------------------------ */

export default function PerformanceDashboardPage() {
  const initial =
    currentBangkokYearMonth();

  const [
    year,
    setYear,
  ] =
    useState(
      initial.year
    );

  const [
    month,
    setMonth,
  ] =
    useState(
      initial.month
    );

  const [
    view,
    setView,
  ] =
    useState<View>(
      "agent"
    );

  const [
    selectedUnit,
    setSelectedUnit,
  ] =
    useState("");

  const [
    rows,
    setRows,
  ] =
    useState<
      DailyProduction[]
    >([]);

  const [
    agents,
    setAgents,
  ] =
    useState<
      AgentMaster[]
    >([]);

  const [
    units,
    setUnits,
  ] =
    useState<Unit[]>(
      []
    );

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  /* ---------------------------------------------------------------- */
  /* LOAD DATA                                                         */
  /* ---------------------------------------------------------------- */

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const [
        productionResponse,
        agentResponse,
      ] =
        await Promise.all(
          [
            fetch(
              "/api/monthly-performance",
              {
                cache:
                  "no-store",
              }
            ),

            fetch(
              "/api/agent-master",
              {
                cache:
                  "no-store",
              }
            ),
          ]
        );

      const data =
        await productionResponse.json();

      if (
        !productionResponse.ok
      ) {
        setRows([]);

        setError(
          data.error ||
            "ไม่สามารถโหลดข้อมูล Monthly Performance ได้"
        );

        return;
      }

      setRows(
        data.rows ?? []
      );

      if (
        agentResponse.ok
      ) {
        const agentData =
          await agentResponse.json();

        setAgents(
          agentData.agents ??
            []
        );

        setUnits(
          agentData.units ??
            []
        );
      }
    } catch (
      error
    ) {
      console.error(
        "[monthly-performance-page] load error:",
        error
      );

      setRows([]);

      setError(
        "เกิดข้อผิดพลาดในการโหลด Monthly Performance"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  /* ---------------------------------------------------------------- */
  /* UNIT LOOKUP                                                       */
  /* ---------------------------------------------------------------- */

  const unitLookup =
    useMemo(() => {
      const unitName =
        new Map<
          number,
          string
        >();

      units.forEach(
        (unit) => {
          unitName.set(
            unit.id,
            unit.unit_name
          );
        }
      );

      const byCode =
        new Map<
          string,
          string
        >();

      const byName =
        new Map<
          string,
          string
        >();

      agents.forEach(
        (agent) => {
          const unit =
            agent.unit_id
              ? unitName.get(
                  agent.unit_id
                )
              : undefined;

          if (!unit) {
            return;
          }

          if (
            agent.agent_code
          ) {
            byCode.set(
              agent.agent_code,
              unit
            );
          }

          byName.set(
            agent.agent_name,
            unit
          );
        }
      );

      return (row: {
        agent_code:
          | string
          | null;

        agent_name: string;
      }) =>
        (row.agent_code &&
          byCode.get(
            row.agent_code
          )) ||
        byName.get(
          row.agent_name
        ) ||
        NO_UNIT;
    }, [
      agents,
      units,
    ]);

  const unitList =
    useMemo(() => {
      const usedIds =
        new Set(
          agents
            .map(
              (agent) =>
                agent.unit_id
            )
            .filter(
              (
                value
              ): value is number =>
                typeof value ===
                "number"
            )
        );

      const names =
        units
          .filter(
            (unit) =>
              usedIds.has(
                unit.id
              )
          )
          .map(
            (unit) =>
              unit.unit_name
          );

      const hasNoUnit =
        rows.some(
          (row) =>
            unitLookup(
              row
            ) ===
            NO_UNIT
        );

      return [
        ...names,
        ...(hasNoUnit
          ? [NO_UNIT]
          : []),
      ];
    }, [
      units,
      agents,
      rows,
      unitLookup,
    ]);

  useEffect(() => {
    if (
      !selectedUnit &&
      unitList.length
    ) {
      setSelectedUnit(
        unitList[0]
      );
    }
  }, [
    unitList,
    selectedUnit,
  ]);

  /* ---------------------------------------------------------------- */
  /* PERIOD                                                            */
  /* ---------------------------------------------------------------- */

  const selectedMonth =
    `${year}-${month}`;

  const monthRows =
    useMemo(
      () =>
        rows.filter(
          (row) =>
            row.production_date.startsWith(
              selectedMonth
            )
        ),
      [
        rows,
        selectedMonth,
      ]
    );

  const ytdRows =
    useMemo(
      () =>
        rows.filter(
          (row) =>
            row.production_date >=
              `${year}-01-01` &&
            row.production_date <=
              `${year}-${month}-31`
        ),
      [
        rows,
        year,
        month,
      ]
    );

  /* ---------------------------------------------------------------- */
  /* AGENT SUMMARY                                                     */
  /* ---------------------------------------------------------------- */

  const agentSummary =
    useMemo(() => {
      const names =
        Array.from(
          new Set(
            ytdRows
              .map(
                (row) =>
                  row.agent_name
              )
              .filter(
                Boolean
              )
          )
        );

      const list =
        names.map(
          (
            agentName
          ): AgentSummary => {
            const monthly =
              monthRows.filter(
                (row) =>
                  row.agent_name ===
                  agentName
              );

            const ytd =
              ytdRows.filter(
                (row) =>
                  row.agent_name ===
                  agentName
              );

            const latest =
              [...ytd].sort(
                (a, b) =>
                  b.production_date.localeCompare(
                    a.production_date
                  )
              )[0] ??
              null;

            const approvedMonths =
              new Set(
                ytd
                  .filter(
                    (row) =>
                      n(
                        row.aia_case_approved
                      ) > 0
                  )
                  .map(
                    (row) =>
                      row.production_date.slice(
                        0,
                        7
                      )
                  )
              ).size;

            return {
              code:
                latest?.agent_code ??
                "",

              name:
                agentName,

              nickname:
                latest?.agent_nickname ??
                "",

              unit:
                latest
                  ? unitLookup(
                      latest
                    )
                  : NO_UNIT,

              month:
                sumRows(
                  monthly
                ),

              ytd:
                sumRows(
                  ytd
                ),

              approvedMonths,
            };
          }
        );

      return list.sort(
        (a, b) =>
          b.month
            .fycApproved -
            a.month
              .fycApproved ||
          b.ytd
            .fycApproved -
            a.ytd
              .fycApproved
      );
    }, [
      monthRows,
      ytdRows,
      unitLookup,
    ]);

  /* ---------------------------------------------------------------- */
  /* TOTALS                                                            */
  /* ---------------------------------------------------------------- */

  const totals =
    useMemo(
      () => ({
        month:
          sumRows(
            monthRows
          ),

        ytd:
          sumRows(
            ytdRows
          ),
      }),
      [
        monthRows,
        ytdRows,
      ]
    );

  /* ---------------------------------------------------------------- */
  /* UNIT MONTHLY                                                      */
  /* ---------------------------------------------------------------- */

  const unitMonthly =
    useMemo(
      (): UnitLine[] => {
        const unitRows =
          rows.filter(
            (row) =>
              row.production_date.startsWith(
                year
              ) &&
              unitLookup(
                row
              ) ===
                selectedUnit
          );

        let running: Totals =
          {
            ...EMPTY,
          };

        return MONTHS
          .filter(
            ([value]) =>
              value <= month
          )
          .map(
            ([
              value,
              label,
            ]) => {
              const inMonth =
                unitRows.filter(
                  (row) =>
                    row.production_date.startsWith(
                      `${year}-${value}`
                    )
                );

              const monthTotals =
                sumRows(
                  inMonth
                );

              running =
                addTotals(
                  running,
                  monthTotals
                );

              return {
                label,

                month:
                  monthTotals,

                ytd: {
                  ...running,
                },

                activeAgents:
                  countActive(
                    inMonth
                  ),
              };
            }
          );
      },
      [
        rows,
        year,
        month,
        selectedUnit,
        unitLookup,
      ]
    );

  /* ---------------------------------------------------------------- */
  /* UNIT RANKING                                                      */
  /* ---------------------------------------------------------------- */

  const unitRanking =
    useMemo(
      (): UnitLine[] => {
        return unitList
          .map(
            (unit) => {
              const inMonth =
                monthRows.filter(
                  (row) =>
                    unitLookup(
                      row
                    ) ===
                    unit
                );

              const inYtd =
                ytdRows.filter(
                  (row) =>
                    unitLookup(
                      row
                    ) ===
                    unit
                );

              return {
                label:
                  unit,

                month:
                  sumRows(
                    inMonth
                  ),

                ytd:
                  sumRows(
                    inYtd
                  ),

                activeAgents:
                  countActive(
                    inMonth
                  ),
              };
            }
          )
          .filter(
            (line) =>
              line.label !==
                NO_UNIT ||
              line.ytd
                .caseApproved >
                0 ||
              line.ytd
                .fycApproved >
                0
          )
          .sort(
            (a, b) =>
              b.month
                .fycApproved -
                a.month
                  .fycApproved ||
              b.ytd
                .fycApproved -
                a.ytd
                  .fycApproved
          );
      },
      [
        unitList,
        monthRows,
        ytdRows,
        unitLookup,
      ]
    );

  /* ---------------------------------------------------------------- */
  /* LABELS                                                            */
  /* ---------------------------------------------------------------- */

  const monthLabel =
    MONTHS.find(
      ([value]) =>
        value ===
        month
    )?.[1] ?? "";

  const thaiYear =
    Number(year) +
    543;

  /* ---------------------------------------------------------------- */
  /* CHART DATA                                                        */
  /* ---------------------------------------------------------------- */

  const agentChartData =
    useMemo(() => {
      return agentSummary
        .filter(
          (row) =>
            row.month
              .fycApproved >
              0 ||
            row.month
              .fypApproved >
              0 ||
            row.month
              .caseApproved >
              0
        )
        .slice(
          0,
          12
        )
        .map(
          (row) => ({
            name:
              row.nickname ||
              row.name,

            fullName:
              row.name,

            unit:
              row.unit,

            caseApproved:
              row.month
                .caseApproved,

            fyp:
              row.month
                .fypApproved,

            fyc:
              row.month
                .fycApproved,
          })
        );
    }, [
      agentSummary,
    ]);

  const unitTrendChartData =
    useMemo(() => {
      return unitMonthly.map(
        (row) => ({
          name:
            row.label,

          caseApproved:
            row.month
              .caseApproved,

          fyp:
            row.month
              .fypApproved,

          fyc:
            row.month
              .fycApproved,

          activeAgents:
            row.activeAgents,
        })
      );
    }, [
      unitMonthly,
    ]);

  const rankingChartData =
    useMemo(() => {
      return unitRanking
        .filter(
          (row) =>
            row.month
              .fycApproved >
              0 ||
            row.month
              .fypApproved >
              0 ||
            row.month
              .caseApproved >
              0
        )
        .map(
          (row) => ({
            name:
              row.label,

            caseApproved:
              row.month
                .caseApproved,

            fyp:
              row.month
                .fypApproved,

            fyc:
              row.month
                .fycApproved,

            activeAgents:
              row.activeAgents,
          })
        );
    }, [
      unitRanking,
    ]);

  /* ---------------------------------------------------------------- */
  /* EXPORT EXCEL                                                      */
  /* ---------------------------------------------------------------- */

  async function exportExcel() {
    try {
      const XLSX =
        await import(
          "xlsx"
        );

      const workbook =
        XLSX.utils.book_new();

      const viewLabel =
        view === "agent"
          ? "รายตัวแทน"
          : view ===
            "unit"
          ? `รายหน่วย - ${
              selectedUnit ||
              "-"
            }`
          : "อันดับเครือ";

      /* ---------------- SUMMARY SHEET ---------------- */

      const summaryData =
        [
          [
            "ROYAL PARTNER",
          ],

          [
            "Monthly Performance Report",
          ],

          [],

          [
            "เดือน",
            monthLabel,
          ],

          [
            "ปี",
            thaiYear,
          ],

          [
            "มุมมอง",
            viewLabel,
          ],

          [],

          [
            "KPI",
            "ผลรวม",
          ],

          [
            "AIA Case อนุมัติ",
            totals.month
              .caseApproved,
          ],

          [
            "AIA FYP อนุมัติ",
            totals.month
              .fypApproved,
          ],

          [
            "AIA FYC อนุมัติ",
            totals.month
              .fycApproved,
          ],

          [
            "Active Agent",
            countActive(
              monthRows
            ),
          ],

          [
            "PA Case",
            totals.month
              .paCase,
          ],

          [
            "PA FYP",
            totals.month
              .paFyp,
          ],

          [
            "PA FYC",
            totals.month
              .paFyc,
          ],

          [],

          [
            "YTD KPI",
            "ผลรวม",
          ],

          [
            "AIA Case YTD",
            totals.ytd
              .caseApproved,
          ],

          [
            "AIA FYP YTD",
            totals.ytd
              .fypApproved,
          ],

          [
            "AIA FYC YTD",
            totals.ytd
              .fycApproved,
          ],

          [
            "PA Case YTD",
            totals.ytd
              .paCase,
          ],

          [
            "PA FYP YTD",
            totals.ytd
              .paFyp,
          ],

          [
            "PA FYC YTD",
            totals.ytd
              .paFyc,
          ],
        ];

      const summarySheet =
        XLSX.utils.aoa_to_sheet(
          summaryData
        );

      summarySheet[
        "!cols"
      ] = [
        {
          wch: 28,
        },
        {
          wch: 24,
        },
      ];

      XLSX.utils.book_append_sheet(
        workbook,
        summarySheet,
        "Summary"
      );

      /* ---------------- AGENT SHEET ---------------- */

      if (
        view ===
        "agent"
      ) {
        const exportRows =
          agentSummary.map(
            (
              row,
              index
            ) => ({
              "No.":
                index + 1,

              Code:
                row.code ||
                "",

              Name:
                row.name,

              "Nick Name":
                row.nickname ||
                "",

              หน่วย:
                row.unit,

              "Case นำส่ง":
                row.month
                  .caseSubmitted,

              "Case อนุมัติ":
                row.month
                  .caseApproved,

              "FYP นำส่ง":
                row.month
                  .fypSubmitted,

              "FYP อนุมัติ":
                row.month
                  .fypApproved,

              "FYC อนุมัติ":
                row.month
                  .fycApproved,

              "AIA Case YTD":
                row.ytd
                  .caseApproved,

              "AIA FYP YTD":
                row.ytd
                  .fypApproved,

              "AIA FYC YTD":
                row.ytd
                  .fycApproved,

              "Approved Months":
                row.approvedMonths,

              "PA Case":
                row.month
                  .paCase,

              "PA FYP":
                row.month
                  .paFyp,

              "PA FYC":
                row.month
                  .paFyc,

              "PA Case YTD":
                row.ytd
                  .paCase,

              "PA FYP YTD":
                row.ytd
                  .paFyp,

              "PA FYC YTD":
                row.ytd
                  .paFyc,
            })
          );

        const worksheet =
          XLSX.utils.json_to_sheet(
            exportRows
          );

        worksheet[
          "!cols"
        ] = [
          {
            wch: 7,
          },
          {
            wch: 12,
          },
          {
            wch: 30,
          },
          {
            wch: 18,
          },
          {
            wch: 20,
          },
          {
            wch: 13,
          },
          {
            wch: 13,
          },
          {
            wch: 16,
          },
          {
            wch: 16,
          },
          {
            wch: 16,
          },
          {
            wch: 15,
          },
          {
            wch: 16,
          },
          {
            wch: 16,
          },
          {
            wch: 18,
          },
          {
            wch: 12,
          },
          {
            wch: 14,
          },
          {
            wch: 14,
          },
          {
            wch: 15,
          },
          {
            wch: 15,
          },
          {
            wch: 15,
          },
        ];

        XLSX.utils.book_append_sheet(
          workbook,
          worksheet,
          "Agent Performance"
        );
      }

      /* ---------------- UNIT SHEET ---------------- */

      if (
        view ===
        "unit"
      ) {
        const exportRows =
          unitMonthly.map(
            (row) => ({
              เดือน:
                row.label,

              "AIA Case อนุมัติ":
                row.month
                  .caseApproved,

              "AIA FYP อนุมัติ":
                row.month
                  .fypApproved,

              "AIA FYC อนุมัติ":
                row.month
                  .fycApproved,

              "AIA Case YTD":
                row.ytd
                  .caseApproved,

              "AIA FYP YTD":
                row.ytd
                  .fypApproved,

              "AIA FYC YTD":
                row.ytd
                  .fycApproved,

              "Active Agent":
                row.activeAgents,

              "PA Case":
                row.month
                  .paCase,

              "PA FYP":
                row.month
                  .paFyp,

              "PA FYC":
                row.month
                  .paFyc,

              "PA Case YTD":
                row.ytd
                  .paCase,

              "PA FYP YTD":
                row.ytd
                  .paFyp,

              "PA FYC YTD":
                row.ytd
                  .paFyc,
            })
          );

        const worksheet =
          XLSX.utils.json_to_sheet(
            exportRows
          );

        worksheet[
          "!cols"
        ] =
          Array.from(
            {
              length: 14,
            },
            () => ({
              wch: 18,
            })
          );

        XLSX.utils.book_append_sheet(
          workbook,
          worksheet,
          "Unit Performance"
        );
      }

      /* ---------------- RANK SHEET ---------------- */

      if (
        view ===
        "rank"
      ) {
        const exportRows =
          unitRanking.map(
            (
              row,
              index
            ) => ({
              อันดับ:
                index + 1,

              หน่วย:
                row.label,

              "AIA Case อนุมัติ":
                row.month
                  .caseApproved,

              "AIA FYP อนุมัติ":
                row.month
                  .fypApproved,

              "AIA FYC อนุมัติ":
                row.month
                  .fycApproved,

              "AIA Case YTD":
                row.ytd
                  .caseApproved,

              "AIA FYP YTD":
                row.ytd
                  .fypApproved,

              "AIA FYC YTD":
                row.ytd
                  .fycApproved,

              "Active Agent":
                row.activeAgents,

              "PA Case":
                row.month
                  .paCase,

              "PA FYP":
                row.month
                  .paFyp,

              "PA FYC":
                row.month
                  .paFyc,

              "PA Case YTD":
                row.ytd
                  .paCase,

              "PA FYP YTD":
                row.ytd
                  .paFyp,

              "PA FYC YTD":
                row.ytd
                  .paFyc,
            })
          );

        const worksheet =
          XLSX.utils.json_to_sheet(
            exportRows
          );

        worksheet[
          "!cols"
        ] = [
          {
            wch: 10,
          },
          {
            wch: 25,
          },

          ...Array.from(
            {
              length: 13,
            },
            () => ({
              wch: 18,
            })
          ),
        ];

        XLSX.utils.book_append_sheet(
          workbook,
          worksheet,
          "Unit Ranking"
        );
      }

      /* ---------------- FILE NAME ---------------- */

      const safeUnit =
        selectedUnit
          .replace(
            /[\\/:*?"<>|]/g,
            "-"
          )
          .replace(
            /\s+/g,
            "_"
          );

      const fileView =
        view ===
        "agent"
          ? "Agent"
          : view ===
            "unit"
          ? `Unit_${
              safeUnit ||
              "All"
            }`
          : "Ranking";

      const fileName =
        `RoyalPartner_MonthlyPerformance_` +
        `${fileView}_${year}-${month}.xlsx`;

      XLSX.writeFile(
        workbook,
        fileName
      );
    } catch (
      error
    ) {
      console.error(
        "[monthly-performance] Excel export failed:",
        error
      );

      window.alert(
        "ไม่สามารถ Export Excel ได้ กรุณาลองใหม่อีกครั้ง"
      );
    }
  }

  /* ---------------------------------------------------------------- */
  /* RENDER                                                            */
  /* ---------------------------------------------------------------- */

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
          maxWidth:
            1900,

          margin:
            "0 auto",
        }}
      >
        <PageTopBar />

        {/* HEADER */}

        <div
          style={{
            marginBottom:
              26,
          }}
        >
          <div
            style={{
              color:
                "var(--gold)",

              fontSize:
                12,

              fontWeight:
                800,

              letterSpacing:
                2,
            }}
          >
            ROYAL PARTNER ·
            PERFORMANCE
          </div>

          <h1
            style={{
              fontSize:
                34,

              margin:
                "8px 0",

              color:
                "var(--cream)",
            }}
          >
            Monthly Performance
          </h1>

          <div
            style={{
              color:
                "var(--cream-muted)",
            }}
          >
            สรุปผลงานรายเดือน · YTD
          </div>
        </div>

        {/* FILTER */}

        <div
          style={{
            background:
              "var(--surface)",

            border:
              "1px solid var(--hairline)",

            borderRadius:
              14,

            padding:
              14,

            display:
              "flex",

            gap:
              12,

            flexWrap:
              "wrap",

            alignItems:
              "center",

            justifyContent:
              "space-between",

            marginBottom:
              22,
          }}
        >
          <div
            style={{
              display:
                "flex",

              gap:
                12,

              flexWrap:
                "wrap",
            }}
          >
            <select
              value={
                month
              }
              onChange={(
                event
              ) =>
                setMonth(
                  event.target
                    .value
                )
              }
              style={
                filterStyle
              }
            >
              {MONTHS.map(
                ([
                  value,
                  label,
                ]) => (
                  <option
                    key={
                      value
                    }
                    value={
                      value
                    }
                  >
                    {label}
                  </option>
                )
              )}
            </select>

            <select
              value={
                year
              }
              onChange={(
                event
              ) =>
                setYear(
                  event.target
                    .value
                )
              }
              style={
                filterStyle
              }
            >
              {[
                "2025",
                "2026",
                "2027",
                "2028",
                "2029",
                "2030",
              ].map(
                (value) => (
                  <option
                    key={
                      value
                    }
                    value={
                      value
                    }
                  >
                    {Number(
                      value
                    ) +
                      543}
                  </option>
                )
              )}
            </select>

            {view ===
              "unit" && (
              <select
                value={
                  selectedUnit
                }
                onChange={(
                  event
                ) =>
                  setSelectedUnit(
                    event.target
                      .value
                  )
                }
                style={
                  filterStyle
                }
              >
                {unitList.map(
                  (unit) => (
                    <option
                      key={
                        unit
                      }
                      value={
                        unit
                      }
                    >
                      {unit}
                    </option>
                  )
                )}
              </select>
            )}

            <button
              type="button"
              onClick={
                loadData
              }
              disabled={
                loading
              }
              style={{
                ...filterStyle,

                opacity:
                  loading
                    ? 0.6
                    : 1,
              }}
            >
              {loading
                ? "กำลังโหลด..."
                : "↻ รีเฟรช"}
            </button>
          </div>

          {/* VIEW + EXPORT */}

          <div
            style={{
              display:
                "flex",

              gap:
                10,

              flexWrap:
                "wrap",

              alignItems:
                "center",
            }}
          >
            <div
              style={{
                display:
                  "flex",

                gap:
                  4,

                padding:
                  4,

                borderRadius:
                  999,

                border:
                  "1px solid var(--hairline)",

                background:
                  "var(--surface-alt)",
              }}
            >
              <ViewButton
                active={
                  view ===
                  "agent"
                }
                onClick={() =>
                  setView(
                    "agent"
                  )
                }
              >
                รายตัวแทน
              </ViewButton>

              <ViewButton
                active={
                  view ===
                  "unit"
                }
                onClick={() =>
                  setView(
                    "unit"
                  )
                }
              >
                รายหน่วย
              </ViewButton>

              <ViewButton
                active={
                  view ===
                  "rank"
                }
                onClick={() =>
                  setView(
                    "rank"
                  )
                }
              >
                อันดับเครือ
              </ViewButton>
            </div>

            <button
              type="button"
              onClick={
                exportExcel
              }
              disabled={
                loading
              }
              style={{
                background:
                  "var(--gold)",

                color:
                  "#18120A",

                border:
                  "1px solid var(--gold)",

                borderRadius:
                  10,

                padding:
                  "10px 15px",

                fontSize:
                  13,

                fontWeight:
                  800,

                cursor:
                  loading
                    ? "not-allowed"
                    : "pointer",

                opacity:
                  loading
                    ? 0.6
                    : 1,

                whiteSpace:
                  "nowrap",
              }}
            >
              📥 Export Excel
            </button>
          </div>
        </div>

        {/* LOADING */}

        {loading && (
          <div
            style={{
              marginBottom:
                16,

              color:
                "var(--cream-muted)",
            }}
          >
            กำลังโหลดข้อมูล...
          </div>
        )}

        {/* ERROR */}

        {error && (
          <div
            style={{
              marginBottom:
                16,

              padding:
                "12px 14px",

              border:
                "1px solid var(--rp-danger-border)",

              borderRadius:
                10,

              color:
                "var(--rp-danger)",
            }}
          >
            {error}
          </div>
        )}

        {/* SUMMARY CARDS */}

        <div
          style={{
            display:
              "grid",

            gridTemplateColumns:
              "repeat(auto-fit,minmax(180px,1fr))",

            gap:
              12,

            marginBottom:
              22,
          }}
        >
          <SummaryCard
            label="AIA Case อนุมัติ"
            value={totals.month.caseApproved.toLocaleString()}
          />

          <SummaryCard
            label="AIA FYP อนุมัติ"
            value={money(
              totals.month
                .fypApproved
            )}
          />

          <SummaryCard
            label="AIA FYC อนุมัติ"
            value={money(
              totals.month
                .fycApproved
            )}
          />

          <SummaryCard
            label="Active Agent"
            value={countActive(
              monthRows
            ).toLocaleString()}
          />

          <SummaryCard
            label="PA FYP"
            value={money(
              totals.month
                .paFyp
            )}
          />

          <SummaryCard
            label="PA FYC"
            value={money(
              totals.month
                .paFyc
            )}
          />
        </div>

        {/* PERFORMANCE CHARTS */}

        <PerformanceOverview
          view={
            view
          }
          monthLabel={
            monthLabel
          }
          thaiYear={
            thaiYear
          }
          selectedUnit={
            selectedUnit
          }
          agentData={
            agentChartData
          }
          unitTrendData={
            unitTrendChartData
          }
          rankingData={
            rankingChartData
          }
        />

        {/* AGENT TABLE */}

        {view ===
          "agent" && (
          <TableBox
            title={`ผลผลิตรายตัวแทน ${monthLabel} ${thaiYear}`}
            hint="เรียงตาม FYC อนุมัติของเดือนนี้ มากไปน้อย"
          >
            <table
              style={{
                ...tableStyle,

                minWidth:
                  2000,
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
                    หน่วย
                  </HeaderCell>

                  <HeaderCell>
                    Case นำส่ง
                  </HeaderCell>

                  <HeaderCell>
                    Case อนุมัติ
                  </HeaderCell>

                  <HeaderCell>
                    FYP นำส่ง
                  </HeaderCell>

                  <HeaderCell>
                    FYP อนุมัติ
                  </HeaderCell>

                  <HeaderCell>
                    FYC อนุมัติ
                  </HeaderCell>

                  <HeaderCell>
                    AIA Case YTD
                  </HeaderCell>

                  <HeaderCell>
                    AIA FYP YTD
                  </HeaderCell>

                  <HeaderCell>
                    AIA FYC YTD
                  </HeaderCell>

                  <HeaderCell>
                    Approved Months
                  </HeaderCell>

                  <HeaderCell>
                    PA Case
                  </HeaderCell>

                  <HeaderCell>
                    PA FYP
                  </HeaderCell>

                  <HeaderCell>
                    PA FYC
                  </HeaderCell>

                  <HeaderCell>
                    PA Case YTD
                  </HeaderCell>

                  <HeaderCell>
                    PA FYP YTD
                  </HeaderCell>

                  <HeaderCell>
                    PA FYC YTD
                  </HeaderCell>
                </tr>
              </thead>

              <tbody>
                {agentSummary.length ===
                0 ? (
                  <EmptyRow
                    colSpan={
                      20
                    }
                  />
                ) : (
                  <>
                    {agentSummary.map(
                      (
                        row,
                        index
                      ) => (
                        <tr
                          key={
                            row.name
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
                            {row.code ||
                              "-"}
                          </Cell>

                          <Cell>
                            {
                              row.name
                            }
                          </Cell>

                          <Cell>
                            {row.nickname ||
                              "-"}
                          </Cell>

                          <Cell>
                            <UnitTag
                              unit={
                                row.unit
                              }
                            />
                          </Cell>

                          <NumberCell>
                            {
                              row
                                .month
                                .caseSubmitted
                            }
                          </NumberCell>

                          <NumberCell>
                            {
                              row
                                .month
                                .caseApproved
                            }
                          </NumberCell>

                          <NumberCell>
                            {money(
                              row
                                .month
                                .fypSubmitted
                            )}
                          </NumberCell>

                          <NumberCell>
                            {money(
                              row
                                .month
                                .fypApproved
                            )}
                          </NumberCell>

                          <NumberCell
                            strong
                          >
                            {money(
                              row
                                .month
                                .fycApproved
                            )}
                          </NumberCell>

                          <NumberCell>
                            {
                              row
                                .ytd
                                .caseApproved
                            }
                          </NumberCell>

                          <NumberCell>
                            {money(
                              row
                                .ytd
                                .fypApproved
                            )}
                          </NumberCell>

                          <NumberCell>
                            {money(
                              row
                                .ytd
                                .fycApproved
                            )}
                          </NumberCell>

                          <NumberCell>
                            {
                              row.approvedMonths
                            }
                          </NumberCell>

                          <NumberCell>
                            {
                              row
                                .month
                                .paCase
                            }
                          </NumberCell>

                          <NumberCell>
                            {money(
                              row
                                .month
                                .paFyp
                            )}
                          </NumberCell>

                          <NumberCell>
                            {money(
                              row
                                .month
                                .paFyc
                            )}
                          </NumberCell>

                          <NumberCell>
                            {
                              row
                                .ytd
                                .paCase
                            }
                          </NumberCell>

                          <NumberCell>
                            {money(
                              row
                                .ytd
                                .paFyp
                            )}
                          </NumberCell>

                          <NumberCell>
                            {money(
                              row
                                .ytd
                                .paFyc
                            )}
                          </NumberCell>
                        </tr>
                      )
                    )}

                    <tr
                      style={
                        totalRowStyle
                      }
                    >
                      <Cell>
                        รวม
                      </Cell>

                      <Cell />
                      <Cell />
                      <Cell />
                      <Cell />

                      <NumberCell>
                        {
                          totals
                            .month
                            .caseSubmitted
                        }
                      </NumberCell>

                      <NumberCell>
                        {
                          totals
                            .month
                            .caseApproved
                        }
                      </NumberCell>

                      <NumberCell>
                        {money(
                          totals
                            .month
                            .fypSubmitted
                        )}
                      </NumberCell>

                      <NumberCell>
                        {money(
                          totals
                            .month
                            .fypApproved
                        )}
                      </NumberCell>

                      <NumberCell>
                        {money(
                          totals
                            .month
                            .fycApproved
                        )}
                      </NumberCell>

                      <NumberCell>
                        {
                          totals
                            .ytd
                            .caseApproved
                        }
                      </NumberCell>

                      <NumberCell>
                        {money(
                          totals
                            .ytd
                            .fypApproved
                        )}
                      </NumberCell>

                      <NumberCell>
                        {money(
                          totals
                            .ytd
                            .fycApproved
                        )}
                      </NumberCell>

                      <Cell>
                        -
                      </Cell>

                      <NumberCell>
                        {
                          totals
                            .month
                            .paCase
                        }
                      </NumberCell>

                      <NumberCell>
                        {money(
                          totals
                            .month
                            .paFyp
                        )}
                      </NumberCell>

                      <NumberCell>
                        {money(
                          totals
                            .month
                            .paFyc
                        )}
                      </NumberCell>

                      <NumberCell>
                        {
                          totals
                            .ytd
                            .paCase
                        }
                      </NumberCell>

                      <NumberCell>
                        {money(
                          totals
                            .ytd
                            .paFyp
                        )}
                      </NumberCell>

                      <NumberCell>
                        {money(
                          totals
                            .ytd
                            .paFyc
                        )}
                      </NumberCell>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </TableBox>
        )}

        {/* UNIT VIEW */}

        {view ===
          "unit" && (
          <TableBox
            title={`รายงานผลผลิต หน่วย ${selectedUnit} ปี ${thaiYear}`}
            hint={`มกราคม – ${monthLabel} · YTD สะสมให้อัตโนมัติ`}
          >
            <UnitTable
              firstColumn="เดือน"
              lines={
                unitMonthly
              }
            />
          </TableBox>
        )}

        {/* RANK VIEW */}

        {view ===
          "rank" && (
          <TableBox
            title={`รายงานผลผลิต เครือ Royal Partner ${monthLabel} ${thaiYear}`}
            hint="จัดอันดับหน่วยตาม FYC อนุมัติของเดือนนี้"
          >
            <UnitTable
              firstColumn="หน่วย"
              lines={
                unitRanking
              }
              ranked
            />
          </TableBox>
        )}
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* PERFORMANCE OVERVIEW                                                */
/* ------------------------------------------------------------------ */

function PerformanceOverview({
  view,
  monthLabel,
  thaiYear,
  selectedUnit,
  agentData,
  unitTrendData,
  rankingData,
}: {
  view: View;

  monthLabel: string;

  thaiYear: number;

  selectedUnit: string;

  agentData:
    PerformanceChartRow[];

  unitTrendData:
    PerformanceChartRow[];

  rankingData:
    PerformanceChartRow[];
}) {
  /* ---------------- AGENT ---------------- */

  if (
    view === "agent"
  ) {
    const pieData =
      agentData.filter(
        (row) =>
          row.fyc > 0
      );

    return (
      <section
        style={{
          marginBottom:
            22,
        }}
      >
        <ChartSectionHeader
          title="Performance Overview"
          subtitle={`ภาพรวมผลงานรายตัวแทน ${monthLabel} ${thaiYear}`}
        />

        {agentData.length ===
        0 ? (
          <ChartEmpty />
        ) : (
          <div
            style={{
              display:
                "grid",

              gridTemplateColumns:
                "repeat(auto-fit,minmax(420px,1fr))",

              gap:
                16,
            }}
          >
            <ChartCard
              title="FYC อนุมัติรายตัวแทน"
              subtitle="เปรียบเทียบ FYC ของเดือนที่เลือก"
            >
              <ResponsiveContainer
                width="100%"
                height={320}
              >
                <BarChart
                  data={
                    agentData
                  }
                  margin={{
                    top: 15,
                    right: 18,
                    left: 8,
                    bottom: 55,
                  }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--hairline)"
                  />

                  <XAxis
                    dataKey="name"
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                    height={75}
                    tick={{
                      fill:
                        "var(--cream-muted)",
                      fontSize:
                        11,
                    }}
                  />

                  <YAxis
                    tickFormatter={
                      compactMoney
                    }
                    tick={{
                      fill:
                        "var(--cream-muted)",
                      fontSize:
                        11,
                    }}
                  />

                  <Tooltip
                    formatter={(
                      value
                    ) =>
                      money(
                        Number(
                          value
                        )
                      )
                    }
                    contentStyle={{
                      background:
                        "var(--surface)",

                      border:
                        "1px solid var(--hairline)",

                      borderRadius:
                        10,

                      color:
                        "var(--cream)",
                    }}
                  />

                  <Bar
                    dataKey="fyc"
                    name="FYC อนุมัติ"
                    fill="#C9972B"
                    radius={[
                      6,
                      6,
                      0,
                      0,
                    ]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard
              title="สัดส่วน FYC รายตัวแทน"
              subtitle="Contribution ต่อ FYC รวมของเดือน"
            >
              {pieData.length ===
              0 ? (
                <MiniEmpty />
              ) : (
                <ResponsiveContainer
                  width="100%"
                  height={320}
                >
                  <PieChart>
                    <Pie
                      data={
                        pieData
                      }
                      dataKey="fyc"
                      nameKey="name"
                      cx="50%"
                      cy="46%"
                      innerRadius={
                        60
                      }
                      outerRadius={
                        105
                      }
                      paddingAngle={
                        2
                      }
                    >
                      {pieData.map(
                        (
                          _,
                          index
                        ) => (
                          <RechartsCell
                            key={`agent-pie-${index}`}
                            fill={
                              PIE_COLORS[
                                index %
                                  PIE_COLORS.length
                              ]
                            }
                          />
                        )
                      )}
                    </Pie>

                    <Tooltip
                      formatter={(
                        value
                      ) =>
                        money(
                          Number(
                            value
                          )
                        )
                      }
                      contentStyle={{
                        background:
                          "var(--surface)",

                        border:
                          "1px solid var(--hairline)",

                        borderRadius:
                          10,

                        color:
                          "var(--cream)",
                      }}
                    />

                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>
        )}
      </section>
    );
  }

  /* ---------------- UNIT ---------------- */

  if (
    view === "unit"
  ) {
    return (
      <section
        style={{
          marginBottom:
            22,
        }}
      >
        <ChartSectionHeader
          title="Performance Overview"
          subtitle={`แนวโน้มรายเดือน หน่วย ${
            selectedUnit ||
            "-"
          } · มกราคม – ${monthLabel} ${thaiYear}`}
        />

        <div
          style={{
            display:
              "grid",

            gridTemplateColumns:
              "repeat(auto-fit,minmax(420px,1fr))",

            gap:
              16,
          }}
        >
          <ChartCard
            title="FYP / FYC รายเดือน"
            subtitle="แนวโน้มผลงานตั้งแต่มกราคมถึงเดือนที่เลือก"
          >
            <ResponsiveContainer
              width="100%"
              height={320}
            >
              <LineChart
                data={
                  unitTrendData
                }
                margin={{
                  top: 15,
                  right: 22,
                  left: 8,
                  bottom: 10,
                }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--hairline)"
                />

                <XAxis
                  dataKey="name"
                  tick={{
                    fill:
                      "var(--cream-muted)",
                    fontSize:
                      11,
                  }}
                />

                <YAxis
                  tickFormatter={
                    compactMoney
                  }
                  tick={{
                    fill:
                      "var(--cream-muted)",
                    fontSize:
                      11,
                  }}
                />

                <Tooltip
                  formatter={(
                    value
                  ) =>
                    money(
                      Number(
                        value
                      )
                    )
                  }
                  contentStyle={{
                    background:
                      "var(--surface)",

                    border:
                      "1px solid var(--hairline)",

                    borderRadius:
                      10,

                    color:
                      "var(--cream)",
                  }}
                />

                <Legend />

                <Line
                  type="monotone"
                  dataKey="fyp"
                  name="FYP อนุมัติ"
                  stroke="#D9B85D"
                  strokeWidth={
                    3
                  }
                  dot={{
                    r: 4,
                  }}
                />

                <Line
                  type="monotone"
                  dataKey="fyc"
                  name="FYC อนุมัติ"
                  stroke="#C9972B"
                  strokeWidth={
                    3
                  }
                  dot={{
                    r: 4,
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Active Agent รายเดือน"
            subtitle="จำนวนตัวแทนที่มี AIA Case อนุมัติอย่างน้อย 1 Case"
          >
            <ResponsiveContainer
              width="100%"
              height={320}
            >
              <BarChart
                data={
                  unitTrendData
                }
                margin={{
                  top: 15,
                  right: 22,
                  left: 8,
                  bottom: 10,
                }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--hairline)"
                />

                <XAxis
                  dataKey="name"
                  tick={{
                    fill:
                      "var(--cream-muted)",
                    fontSize:
                      11,
                  }}
                />

                <YAxis
                  allowDecimals={
                    false
                  }
                  tick={{
                    fill:
                      "var(--cream-muted)",
                    fontSize:
                      11,
                  }}
                />

                <Tooltip
                  contentStyle={{
                    background:
                      "var(--surface)",

                    border:
                      "1px solid var(--hairline)",

                    borderRadius:
                      10,

                    color:
                      "var(--cream)",
                  }}
                />

                <Bar
                  dataKey="activeAgents"
                  name="Active Agent"
                  fill="#C9972B"
                  radius={[
                    6,
                    6,
                    0,
                    0,
                  ]}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </section>
    );
  }

  /* ---------------- RANK ---------------- */

  const pieData =
    rankingData.filter(
      (row) =>
        row.fyc > 0
    );

  return (
    <section
      style={{
        marginBottom:
          22,
      }}
    >
      <ChartSectionHeader
        title="Performance Overview"
        subtitle={`อันดับเครือ Royal Partner · ${monthLabel} ${thaiYear}`}
      />

      {rankingData.length ===
      0 ? (
        <ChartEmpty />
      ) : (
        <div
          style={{
            display:
              "grid",

            gridTemplateColumns:
              "repeat(auto-fit,minmax(420px,1fr))",

            gap:
              16,
          }}
        >
          <ChartCard
            title="FYC อนุมัติแยกตามหน่วย"
            subtitle="เปรียบเทียบผลงานของแต่ละหน่วย"
          >
            <ResponsiveContainer
              width="100%"
              height={320}
            >
              <BarChart
                data={
                  rankingData
                }
                margin={{
                  top: 15,
                  right: 22,
                  left: 8,
                  bottom: 55,
                }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--hairline)"
                />

                <XAxis
                  dataKey="name"
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  height={70}
                  tick={{
                    fill:
                      "var(--cream-muted)",
                    fontSize:
                      11,
                  }}
                />

                <YAxis
                  tickFormatter={
                    compactMoney
                  }
                  tick={{
                    fill:
                      "var(--cream-muted)",
                    fontSize:
                      11,
                  }}
                />

                <Tooltip
                  formatter={(
                    value
                  ) =>
                    money(
                      Number(
                        value
                      )
                    )
                  }
                  contentStyle={{
                    background:
                      "var(--surface)",

                    border:
                      "1px solid var(--hairline)",

                    borderRadius:
                      10,

                    color:
                      "var(--cream)",
                  }}
                />

                <Bar
                  dataKey="fyc"
                  name="FYC อนุมัติ"
                  fill="#C9972B"
                  radius={[
                    6,
                    6,
                    0,
                    0,
                  ]}
                />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="สัดส่วน FYC แต่ละหน่วย"
            subtitle="Contribution ต่อ FYC รวมทั้งเครือ"
          >
            {pieData.length ===
            0 ? (
              <MiniEmpty />
            ) : (
              <ResponsiveContainer
                width="100%"
                height={320}
              >
                <PieChart>
                  <Pie
                    data={
                      pieData
                    }
                    dataKey="fyc"
                    nameKey="name"
                    cx="50%"
                    cy="46%"
                    innerRadius={
                      60
                    }
                    outerRadius={
                      105
                    }
                    paddingAngle={
                      2
                    }
                  >
                    {pieData.map(
                      (
                        _,
                        index
                      ) => (
                        <RechartsCell
                          key={`unit-pie-${index}`}
                          fill={
                            PIE_COLORS[
                              index %
                                PIE_COLORS.length
                            ]
                          }
                        />
                      )
                    )}
                  </Pie>

                  <Tooltip
                    formatter={(
                      value
                    ) =>
                      money(
                        Number(
                          value
                        )
                      )
                    }
                    contentStyle={{
                      background:
                        "var(--surface)",

                      border:
                        "1px solid var(--hairline)",

                      borderRadius:
                        10,

                      color:
                        "var(--cream)",
                    }}
                  />

                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* CHART COMPONENTS                                                    */
/* ------------------------------------------------------------------ */

function ChartSectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div
      style={{
        marginBottom:
          12,
      }}
    >
      <div
        style={{
          fontSize:
            18,

          fontWeight:
            800,

          color:
            "var(--cream)",
        }}
      >
        📊 {title}
      </div>

      <div
        style={{
          color:
            "var(--cream-faint)",

          fontSize:
            12,

          marginTop:
            4,
        }}
      >
        {subtitle}
      </div>
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children:
    React.ReactNode;
}) {
  return (
    <div
      style={{
        background:
          "var(--surface)",

        border:
          "1px solid var(--hairline)",

        borderRadius:
          16,

        padding:
          "16px 16px 8px",

        minWidth:
          0,
      }}
    >
      <div
        style={{
          fontSize:
            15,

          fontWeight:
            800,

          color:
            "var(--cream)",
        }}
      >
        {title}
      </div>

      <div
        style={{
          fontSize:
            11,

          color:
            "var(--cream-faint)",

          marginTop:
            4,

          marginBottom:
            8,
        }}
      >
        {subtitle}
      </div>

      {children}
    </div>
  );
}

function ChartEmpty() {
  return (
    <div
      style={{
        background:
          "var(--surface)",

        border:
          "1px solid var(--hairline)",

        borderRadius:
          16,

        padding:
          34,

        textAlign:
          "center",

        color:
          "var(--cream-faint)",
      }}
    >
      ยังไม่มี Production
      สำหรับสร้างกราฟในช่วงเวลาที่เลือก
    </div>
  );
}

function MiniEmpty() {
  return (
    <div
      style={{
        height:
          320,

        display:
          "flex",

        alignItems:
          "center",

        justifyContent:
          "center",

        textAlign:
          "center",

        color:
          "var(--cream-faint)",

        fontSize:
          13,
      }}
    >
      ยังไม่มี FYC
      สำหรับแสดงสัดส่วน
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* TABLE COMPONENTS                                                    */
/* ------------------------------------------------------------------ */

function UnitTable({
  firstColumn,
  lines,
  ranked = false,
}: {
  firstColumn: string;
  lines: UnitLine[];
  ranked?: boolean;
}) {
  const sum =
    lines.reduce(
      (
        acc,
        line
      ) => ({
        month:
          addTotals(
            acc.month,
            line.month
          ),

        active:
          acc.active +
          line.activeAgents,
      }),
      {
        month: {
          ...EMPTY,
        },

        active:
          0,
      }
    );

  return (
    <table
      style={{
        ...tableStyle,

        minWidth:
          1100,
      }}
    >
      <thead>
        <tr
          style={{
            background:
              "var(--rp-soft-gold)",
          }}
        >
          {ranked && (
            <HeaderCell>
              อันดับ
            </HeaderCell>
          )}

          <HeaderCell>
            {firstColumn}
          </HeaderCell>

          <HeaderCell>
            Cases
          </HeaderCell>

          <HeaderCell>
            FYP
          </HeaderCell>

          <HeaderCell>
            FYC
          </HeaderCell>

          <HeaderCell>
            Cases YTD
          </HeaderCell>

          <HeaderCell>
            FYP YTD
          </HeaderCell>

          <HeaderCell>
            FYC YTD
          </HeaderCell>

          <HeaderCell>
            Active Agent
          </HeaderCell>
        </tr>
      </thead>

      <tbody>
        {lines.length ===
        0 ? (
          <EmptyRow
            colSpan={
              ranked
                ? 9
                : 8
            }
          />
        ) : (
          <>
            {lines.map(
              (
                line,
                index
              ) => (
                <tr
                  key={
                    line.label
                  }
                  style={{
                    borderTop:
                      "1px solid var(--hairline-soft)",
                  }}
                >
                  {ranked && (
                    <Cell>
                      <RankBadge
                        rank={
                          index +
                          1
                        }
                        empty={
                          line
                            .month
                            .fycApproved ===
                          0
                        }
                      />
                    </Cell>
                  )}

                  <Cell>
                    {
                      line.label
                    }
                  </Cell>

                  <NumberCell>
                    {line.month
                      .caseApproved ||
                      "-"}
                  </NumberCell>

                  <NumberCell>
                    {line.month
                      .fypApproved
                      ? money(
                          line
                            .month
                            .fypApproved
                        )
                      : "-"}
                  </NumberCell>

                  <NumberCell
                    strong
                  >
                    {line.month
                      .fycApproved
                      ? money(
                          line
                            .month
                            .fycApproved
                        )
                      : "-"}
                  </NumberCell>

                  <NumberCell>
                    {line.ytd
                      .caseApproved ||
                      "-"}
                  </NumberCell>

                  <NumberCell>
                    {line.ytd
                      .fypApproved
                      ? money(
                          line
                            .ytd
                            .fypApproved
                        )
                      : "-"}
                  </NumberCell>

                  <NumberCell>
                    {line.ytd
                      .fycApproved
                      ? money(
                          line
                            .ytd
                            .fycApproved
                        )
                      : "-"}
                  </NumberCell>

                  <NumberCell>
                    {line.activeAgents ||
                      "-"}
                  </NumberCell>
                </tr>
              )
            )}

            {ranked && (
              <tr
                style={
                  totalRowStyle
                }
              >
                <Cell />

                <Cell>
                  รวมทั้งเครือ
                </Cell>

                <NumberCell>
                  {
                    sum.month
                      .caseApproved
                  }
                </NumberCell>

                <NumberCell>
                  {money(
                    sum.month
                      .fypApproved
                  )}
                </NumberCell>

                <NumberCell>
                  {money(
                    sum.month
                      .fycApproved
                  )}
                </NumberCell>

                <Cell />
                <Cell />
                <Cell />

                <NumberCell>
                  {
                    sum.active
                  }
                </NumberCell>
              </tr>
            )}
          </>
        )}
      </tbody>
    </table>
  );
}

function TableBox({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children:
    React.ReactNode;
}) {
  return (
    <div
      style={{
        background:
          "var(--surface)",

        border:
          "1px solid var(--hairline)",

        borderRadius:
          16,

        overflow:
          "hidden",
      }}
    >
      <div
        style={{
          padding:
            "14px 16px",

          borderBottom:
            "1px solid var(--hairline)",
        }}
      >
        <div
          style={{
            fontWeight:
              800,

            color:
              "var(--cream)",

            fontSize:
              16,
          }}
        >
          {title}
        </div>

        <div
          style={{
            color:
              "var(--cream-faint)",

            fontSize:
              12,

            marginTop:
              4,
          }}
        >
          {hint}
        </div>
      </div>

      <div
        style={{
          overflowX:
            "auto",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function ViewButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children:
    React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={
        onClick
      }
      style={{
        border:
          "none",

        borderRadius:
          999,

        padding:
          "8px 16px",

        fontSize:
          13,

        fontWeight:
          800,

        cursor:
          "pointer",

        background:
          active
            ? "var(--gold)"
            : "transparent",

        color:
          active
            ? "#18120A"
            : "var(--cream-muted)",

        transition:
          "background .15s ease, color .15s ease",
      }}
    >
      {children}
    </button>
  );
}

function RankBadge({
  rank,
  empty,
}: {
  rank: number;
  empty: boolean;
}) {
  const top =
    !empty &&
    rank <= 3;

  return (
    <span
      style={{
        display:
          "inline-flex",

        alignItems:
          "center",

        justifyContent:
          "center",

        minWidth:
          26,

        height:
          26,

        borderRadius:
          999,

        fontWeight:
          800,

        fontSize:
          12,

        background:
          top
            ? "var(--gold)"
            : "var(--surface-alt)",

        color:
          top
            ? "#18120A"
            : "var(--cream-muted)",

        border:
          "1px solid var(--hairline)",
      }}
    >
      {rank}
    </span>
  );
}

function UnitTag({
  unit,
}: {
  unit: string;
}) {
  const missing =
    unit ===
    NO_UNIT;

  return (
    <span
      style={{
        fontSize:
          12,

        padding:
          "3px 8px",

        borderRadius:
          999,

        border:
          `1px solid ${
            missing
              ? "var(--rp-danger-border)"
              : "var(--hairline)"
          }`,

        color:
          missing
            ? "var(--rp-danger)"
            : "var(--cream-muted)",
      }}
    >
      {unit}
    </span>
  );
}

function EmptyRow({
  colSpan,
}: {
  colSpan: number;
}) {
  return (
    <tr>
      <td
        colSpan={
          colSpan
        }
        style={{
          padding:
            30,

          textAlign:
            "center",

          color:
            "var(--cream-faint)",
        }}
      >
        ยังไม่มี Production
        ในช่วงเวลาที่เลือก
      </td>
    </tr>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        background:
          "var(--surface)",

        border:
          "1px solid var(--hairline)",

        borderRadius:
          14,

        padding:
          16,
      }}
    >
      <div
        style={{
          color:
            "var(--cream-faint)",

          fontSize:
            12,

          marginBottom:
            7,
        }}
      >
        {label}
      </div>

      <div
        style={{
          color:
            "var(--gold-bright)",

          fontSize:
            21,

          fontWeight:
            800,
        }}
      >
        {value}
      </div>
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
          "13px 10px",

        color:
          "var(--gold-bright)",

        fontSize:
          12,

        textAlign:
          "left",

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
  children?:
    React.ReactNode;
}) {
  return (
    <td
      style={{
        padding:
          "11px 10px",

        fontSize:
          13,

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

function NumberCell({
  children,
  strong = false,
}: {
  children:
    React.ReactNode;
  strong?: boolean;
}) {
  return (
    <td
      style={{
        padding:
          "11px 10px",

        fontSize:
          13,

        color:
          strong
            ? "var(--gold-bright)"
            : "var(--cream)",

        fontWeight:
          strong
            ? 800
            : 400,

        textAlign:
          "right",

        whiteSpace:
          "nowrap",
      }}
    >
      {children}
    </td>
  );
}

/* ------------------------------------------------------------------ */
/* STYLES                                                              */
/* ------------------------------------------------------------------ */

const tableStyle = {
  width:
    "100%",

  borderCollapse:
    "collapse" as const,
};

const totalRowStyle = {
  background:
    "var(--rp-soft-gold)",

  borderTop:
    "1px solid var(--gold)",

  fontWeight:
    800,
};

const filterStyle = {
  background:
    "var(--surface-alt)",

  color:
    "var(--cream)",

  border:
    "1px solid var(--hairline)",

  borderRadius:
    9,

  padding:
    "10px 12px",

  fontSize:
    14,

  cursor:
    "pointer",
};
