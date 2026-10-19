import {
  NextResponse,
  type NextRequest,
} from "next/server";

import {
  getSupabaseClient,
} from "@/lib/supabase";

export const dynamic =
  "force-dynamic";

// Redeploy marker: sheet sync env enabled

export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control":
    "no-store, max-age=0",
};

type ProductionRow = {
  production_date: string;
  agent_code: string | null;
  agent_name: string;
  agent_nickname: string | null;
  aia_case_submitted: number | null;
  aia_case_approved: number | null;
  aia_fyp_submitted: number | null;
  aia_fyp_approved: number | null;
  aia_fyc_approved: number | null;
  pa_case: number | null;
  pa_fyp: number | null;
  pa_fyc: number | null;
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

function n(value: unknown) {
  return Number(value ?? 0) || 0;
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

function rowTotals(
  row: ProductionRow
): Totals {
  return {
    caseSubmitted:
      n(row.aia_case_submitted),
    caseApproved:
      n(row.aia_case_approved),
    fypSubmitted:
      n(row.aia_fyp_submitted),
    fypApproved:
      n(row.aia_fyp_approved),
    fycApproved:
      n(row.aia_fyc_approved),
    paCase:
      n(row.pa_case),
    paFyp:
      n(row.pa_fyp),
    paFyc:
      n(row.pa_fyc),
  };
}

function countActive(
  rows: ProductionRow[]
) {
  const byAgent =
    new Map<string, number>();

  for (const row of rows) {
    byAgent.set(
      row.agent_name,
      (byAgent.get(
        row.agent_name
      ) ?? 0) +
        n(
          row.aia_case_approved
        )
    );
  }

  return Array.from(
    byAgent.values()
  ).filter(
    (value) =>
      value > 0
  ).length;
}

function unauthorized(
  message: string
) {
  return NextResponse.json(
    {
      error: message,
    },
    {
      status: 401,
      headers:
        NO_STORE_HEADERS,
    }
  );
}

export async function GET(
  request: NextRequest
) {
  const expectedSecret =
    process.env
      .RP_SHEET_SYNC_SECRET;

  const providedSecret =
    request.headers.get(
      "x-rp-sync-key"
    ) ?? "";

  if (!expectedSecret) {
    return NextResponse.json(
      {
        error:
          "RP_SHEET_SYNC_SECRET is not configured.",
      },
      {
        status: 503,
        headers:
          NO_STORE_HEADERS,
      }
    );
  }

  if (
    !providedSecret ||
    providedSecret !==
      expectedSecret
  ) {
    return unauthorized(
      "Invalid sync key."
    );
  }

  try {
    const supabase =
      getSupabaseClient();

    const [
      productionResult,
      agentsResult,
      unitsResult,
    ] =
      await Promise.all([
        supabase
          .from(
            "daily_production"
          )
          .select("*")
          .order(
            "production_date",
            {
              ascending: true,
            }
          )
          .order(
            "agent_code",
            {
              ascending: true,
            }
          ),

        supabase
          .from(
            "agent_master"
          )
          .select(
            "agent_code,agent_name,agent_nickname,unit_id,active"
          )
          .eq(
            "active",
            true
          ),

        supabase
          .from("units")
          .select(
            "id,unit_name,active"
          )
          .eq(
            "active",
            true
          ),
      ]);

    if (
      productionResult.error ||
      agentsResult.error ||
      unitsResult.error
    ) {
      console.error(
        "[monthly-performance-sheet-sync] query failed:",
        productionResult.error,
        agentsResult.error,
        unitsResult.error
      );

      return NextResponse.json(
        {
          error:
            "Unable to load source data.",
        },
        {
          status: 500,
          headers:
            NO_STORE_HEADERS,
        }
      );
    }

    const production =
      (productionResult.data ??
        []) as ProductionRow[];

    const units =
      unitsResult.data ?? [];

    const agents =
      agentsResult.data ?? [];

    const unitById =
      new Map<
        number,
        string
      >();

    for (const unit of units) {
      unitById.set(
        Number(unit.id),
        String(
          unit.unit_name
        )
      );
    }

    const unitByCode =
      new Map<
        string,
        string
      >();

    const unitByName =
      new Map<
        string,
        string
      >();

    for (const agent of agents) {
      const unitName =
        agent.unit_id
          ? unitById.get(
              Number(
                agent.unit_id
              )
            )
          : undefined;

      if (!unitName) {
        continue;
      }

      if (
        agent.agent_code
      ) {
        unitByCode.set(
          String(
            agent.agent_code
          ),
          unitName
        );
      }

      unitByName.set(
        String(
          agent.agent_name
        ),
        unitName
      );
    }

    function getUnit(
      row: ProductionRow
    ) {
      return (
        (row.agent_code &&
          unitByCode.get(
            row.agent_code
          )) ||
        unitByName.get(
          row.agent_name
        ) ||
        "ไม่ระบุหน่วย"
      );
    }

    const syncedAt =
      new Date()
        .toISOString();

    const raw = production.map(
      (row) => ({
        production_date:
          row.production_date,
        agent_code:
          row.agent_code ?? "",
        agent_name:
          row.agent_name,
        agent_nickname:
          row.agent_nickname ??
          "",
        unit:
          getUnit(row),
        aia_case_submitted:
          n(
            row.aia_case_submitted
          ),
        aia_case_approved:
          n(
            row.aia_case_approved
          ),
        aia_fyp_submitted:
          n(
            row.aia_fyp_submitted
          ),
        aia_fyp_approved:
          n(
            row.aia_fyp_approved
          ),
        aia_fyc_approved:
          n(
            row.aia_fyc_approved
          ),
        pa_case:
          n(row.pa_case),
        pa_fyp:
          n(row.pa_fyp),
        pa_fyc:
          n(row.pa_fyc),
        synced_at:
          syncedAt,
      })
    );

    const months =
      Array.from(
        new Set(
          production.map(
            (row) =>
              row.production_date.slice(
                0,
                7
              )
          )
        )
      ).sort();

    const monthlyAgent: Array<
      Record<string, unknown>
    > = [];

    const monthlyUnit: Array<
      Record<string, unknown>
    > = [];

    const unitRanking: Array<
      Record<string, unknown>
    > = [];

    const summary: Array<
      Record<string, unknown>
    > = [];

    for (const ym of months) {
      const [
        year,
        month,
      ] = ym.split("-");

      const monthRows =
        production.filter(
          (row) =>
            row.production_date.startsWith(
              ym
            )
        );

      const ytdRows =
        production.filter(
          (row) =>
            row.production_date >=
              `${year}-01-01` &&
            row.production_date <=
              `${ym}-31`
        );

      const agentNames =
        Array.from(
          new Set(
            ytdRows.map(
              (row) =>
                row.agent_name
            )
          )
        );

      for (
        const agentName of
        agentNames
      ) {
        const monthAgentRows =
          monthRows.filter(
            (row) =>
              row.agent_name ===
              agentName
          );

        const ytdAgentRows =
          ytdRows.filter(
            (row) =>
              row.agent_name ===
              agentName
          );

        let monthTotals = {
          ...EMPTY,
        };

        for (
          const row of
          monthAgentRows
        ) {
          monthTotals =
            addTotals(
              monthTotals,
              rowTotals(row)
            );
        }

        let ytdTotals = {
          ...EMPTY,
        };

        for (
          const row of
          ytdAgentRows
        ) {
          ytdTotals =
            addTotals(
              ytdTotals,
              rowTotals(row)
            );
        }

        const latest =
          [...ytdAgentRows].sort(
            (a, b) =>
              b.production_date.localeCompare(
                a.production_date
              )
          )[0];

        const approvedMonths =
          new Set(
            ytdAgentRows
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

        monthlyAgent.push({
          year,
          month,
          agent_code:
            latest?.agent_code ??
            "",
          agent_name:
            agentName,
          nickname:
            latest?.agent_nickname ??
            "",
          unit:
            latest
              ? getUnit(
                  latest
                )
              : "ไม่ระบุหน่วย",
          case_submitted:
            monthTotals.caseSubmitted,
          case_approved:
            monthTotals.caseApproved,
          fyp_submitted:
            monthTotals.fypSubmitted,
          fyp_approved:
            monthTotals.fypApproved,
          fyc_approved:
            monthTotals.fycApproved,
          pa_case:
            monthTotals.paCase,
          pa_fyp:
            monthTotals.paFyp,
          pa_fyc:
            monthTotals.paFyc,
          ytd_case:
            ytdTotals.caseApproved,
          ytd_fyp:
            ytdTotals.fypApproved,
          ytd_fyc:
            ytdTotals.fycApproved,
          approved_months:
            approvedMonths,
          updated_at:
            syncedAt,
        });
      }

      const unitNames =
        Array.from(
          new Set(
            ytdRows.map(
              (row) =>
                getUnit(row)
            )
          )
        );

      const rankingRows: Array<
        Record<string, unknown>
      > = [];

      for (
        const unitName of
        unitNames
      ) {
        const monthUnitRows =
          monthRows.filter(
            (row) =>
              getUnit(row) ===
              unitName
          );

        const ytdUnitRows =
          ytdRows.filter(
            (row) =>
              getUnit(row) ===
              unitName
          );

        let monthTotals = {
          ...EMPTY,
        };

        for (
          const row of
          monthUnitRows
        ) {
          monthTotals =
            addTotals(
              monthTotals,
              rowTotals(row)
            );
        }

        let ytdTotals = {
          ...EMPTY,
        };

        for (
          const row of
          ytdUnitRows
        ) {
          ytdTotals =
            addTotals(
              ytdTotals,
              rowTotals(row)
            );
        }

        const unitRecord = {
          year,
          month,
          unit:
            unitName,
          case_approved:
            monthTotals.caseApproved,
          fyp_approved:
            monthTotals.fypApproved,
          fyc_approved:
            monthTotals.fycApproved,
          active_agents:
            countActive(
              monthUnitRows
            ),
          ytd_case:
            ytdTotals.caseApproved,
          ytd_fyp:
            ytdTotals.fypApproved,
          ytd_fyc:
            ytdTotals.fycApproved,
          updated_at:
            syncedAt,
        };

        monthlyUnit.push(
          unitRecord
        );

        rankingRows.push(
          unitRecord
        );
      }

      rankingRows.sort(
        (a, b) =>
          Number(
            b.fyc_approved
          ) -
            Number(
              a.fyc_approved
            ) ||
          Number(
            b.ytd_fyc
          ) -
            Number(
              a.ytd_fyc
            )
      );

      rankingRows.forEach(
        (
          row,
          index
        ) => {
          unitRanking.push({
            year:
              row.year,
            month:
              row.month,
            rank:
              index + 1,
            unit:
              row.unit,
            case_approved:
              row.case_approved,
            fyp_approved:
              row.fyp_approved,
            fyc_approved:
              row.fyc_approved,
            active_agents:
              row.active_agents,
            ytd_case:
              row.ytd_case,
            ytd_fyp:
              row.ytd_fyp,
            ytd_fyc:
              row.ytd_fyc,
            updated_at:
              syncedAt,
          });
        }
      );

      let monthTotal = {
        ...EMPTY,
      };

      for (
        const row of monthRows
      ) {
        monthTotal =
          addTotals(
            monthTotal,
            rowTotals(row)
          );
      }

      let ytdTotal = {
        ...EMPTY,
      };

      for (
        const row of ytdRows
      ) {
        ytdTotal =
          addTotals(
            ytdTotal,
            rowTotals(row)
          );
      }

      const period =
        `${year}-${month}`;

      const monthlyMetrics = [
        [
          "AIA Case อนุมัติ",
          monthTotal.caseApproved,
        ],
        [
          "AIA FYP อนุมัติ",
          monthTotal.fypApproved,
        ],
        [
          "AIA FYC อนุมัติ",
          monthTotal.fycApproved,
        ],
        [
          "Active Agent",
          countActive(
            monthRows
          ),
        ],
        [
          "PA Case",
          monthTotal.paCase,
        ],
        [
          "PA FYP",
          monthTotal.paFyp,
        ],
        [
          "PA FYC",
          monthTotal.paFyc,
        ],
      ];

      const ytdMetrics = [
        [
          "AIA Case YTD",
          ytdTotal.caseApproved,
        ],
        [
          "AIA FYP YTD",
          ytdTotal.fypApproved,
        ],
        [
          "AIA FYC YTD",
          ytdTotal.fycApproved,
        ],
        [
          "PA Case YTD",
          ytdTotal.paCase,
        ],
        [
          "PA FYP YTD",
          ytdTotal.paFyp,
        ],
        [
          "PA FYC YTD",
          ytdTotal.paFyc,
        ],
      ];

      for (
        const [
          metric,
          value,
        ] of monthlyMetrics
      ) {
        summary.push({
          section:
            "MONTH",
          metric,
          value,
          period,
          updated_at:
            syncedAt,
        });
      }

      for (
        const [
          metric,
          value,
        ] of ytdMetrics
      ) {
        summary.push({
          section:
            "YTD",
          metric,
          value,
          period,
          updated_at:
            syncedAt,
        });
      }
    }

    return NextResponse.json(
      {
        syncedAt,
        raw,
        monthlyAgent,
        monthlyUnit,
        unitRanking,
        summary,
      },
      {
        headers:
          NO_STORE_HEADERS,
      }
    );
  } catch (error) {
    console.error(
      "[monthly-performance-sheet-sync] unexpected error:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unexpected sync error.",
      },
      {
        status: 500,
        headers:
          NO_STORE_HEADERS,
      }
    );
  }
}
