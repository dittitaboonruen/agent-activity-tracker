import { bangkokDateStr } from "./date-utils";

import type {
  Submission,
  Filters,
  KpiSummary,
  ChartDatum,
  AgentRow,
  PepMetricKey,
  PepInsightResult,
} from "@/types";

/* =========================================================
   SALES PROCESS STANDARD
   9 ขั้นตอน → 3 หมวดใหญ่
========================================================= */

export const ACTIVITY_GROUPS = {
  prospecting: {
    label: "หารายชื่อ",
    steps: [
      "หาผู้มุ่งหวัง",
      "นัดหมาย",
      "เปิดบทสนทนา",
    ],
  },

  sales: {
    label: "ขาย",
    steps: [
      "วิเคราะห์ความต้องการ",
      "นำเสนอผลิตภัณฑ์",
      "ตอบข้อโต้แย้ง / ปิดการขาย",
    ],
  },

  service: {
    label: "บริการ",
    steps: [
      "นำส่งใบสมัคร / งานระบบ",
      "บริการหลังการขาย",
      "ขอรายชื่อแนะนำ / ต่อยอดตลาด",
    ],
  },
} as const;

export const ACTIVITY_LIST = [
  ...ACTIVITY_GROUPS.prospecting.steps,
  ...ACTIVITY_GROUPS.sales.steps,
  ...ACTIVITY_GROUPS.service.steps,
];

/* =========================================================
   PEP META
========================================================= */

export const PEP_META: Record<
  PepMetricKey,
  {
    label: string;
    focus: string;
    question: string;
  }
> = {
  closingRate: {
    label: "อัตราการปิดการขาย",
    focus:
      "เทคนิคการปิดการขายและการจัดการข้อโต้แย้งของลูกค้า",
    question:
      "อะไรคือสิ่งที่ทำให้ลูกค้าลังเลก่อนตัดสินใจปิดการขายบ่อยที่สุด?",
  },

  presentationRate: {
    label: "อัตราการนำเสนอผลิตภัณฑ์",
    focus:
      "การนำเสนอผลิตภัณฑ์ให้น่าสนใจและตรงกับความต้องการของลูกค้า",
    question:
      "หลังการนำเสนอผลิตภัณฑ์แต่ละครั้ง ลูกค้ามักมีข้อกังวลเรื่องใดมากที่สุด?",
  },

  activityRate: {
    label: "ปริมาณกิจกรรมต่อลูกค้า",
    focus:
      "วินัยในการพาลูกค้าเดินผ่านกระบวนการขายอย่างเป็นระบบ",
    question:
      "จะจัดสรรเวลาอย่างไรให้ลูกค้าแต่ละรายเดินต่อไปยังขั้นตอนถัดไปได้?",
  },

  moneyMapRate: {
    label: "อัตราการทำ My Money Map",
    focus:
      "การใช้ My Money Map เพื่อวิเคราะห์ความต้องการและสร้างความเข้าใจร่วมกับลูกค้า",
    question:
      "จะใช้ My Money Map เชื่อมจากการเปิดบทสนทนาไปสู่การวิเคราะห์ความต้องการได้อย่างไร?",
  },
};

/* =========================================================
   BASIC HELPERS
========================================================= */

export function pct(
  n: number,
  d: number
): number {
  return d > 0
    ? Math.round((n / d) * 1000) / 10
    : 0;
}

export function uniq<T>(
  arr: T[]
): T[] {
  return Array.from(new Set(arr));
}

/* =========================================================
   FILTER OPTIONS
========================================================= */

export function getAllAgents(
  submissions: Submission[]
): string[] {
  return uniq(
    submissions.map((s) => s.agent)
  )
    .filter(Boolean)
    .sort();
}

export function getAllSources(
  submissions: Submission[]
): string[] {
  return uniq(
    submissions.map((s) => s.source)
  )
    .filter(Boolean)
    .sort();
}

export function getAllChannels(
  submissions: Submission[]
): string[] {
  return uniq(
    submissions.map((s) => s.channel)
  )
    .filter(Boolean)
    .sort();
}

/* =========================================================
   DATE / FILTER LOGIC
========================================================= */

export function dateInRange(
  s: Submission,
  filters: Filters,
  todayStr: string
): boolean {
  const localDate =
    bangkokDateStr(s.createdAtUTC);

  if (filters.dateQuick === "today") {
    return localDate === todayStr;
  }

  if (filters.dateQuick === "custom") {
    if (
      !filters.customStart ||
      !filters.customEnd
    ) {
      return false;
    }

    return (
      localDate >= filters.customStart &&
      localDate <= filters.customEnd
    );
  }

  return true;
}

export function matchesBase(
  s: Submission,
  filters: Filters,
  todayStr: string
): boolean {
  return (
    dateInRange(
      s,
      filters,
      todayStr
    ) &&
    (
      filters.channelFilter ===
        "all" ||
      s.channel ===
        filters.channelFilter
    )
  );
}

export function getFiltered(
  submissions: Submission[],
  filters: Filters,
  todayStr: string
): Submission[] {
  return submissions.filter(
    (s) =>
      matchesBase(
        s,
        filters,
        todayStr
      ) &&
      (
        filters.agentFilter ===
          "all" ||
        s.agent ===
          filters.agentFilter
      )
  );
}

export function getBaseFiltered(
  submissions: Submission[],
  filters: Filters,
  todayStr: string
): Submission[] {
  return submissions.filter((s) =>
    matchesBase(
      s,
      filters,
      todayStr
    )
  );
}

/* =========================================================
   SALES PROCESS GROUP HELPERS
========================================================= */

export function countActivityGroup(
  submissions: Submission[],
  steps: readonly string[]
): number {
  return submissions.reduce(
    (total, submission) =>
      total +
      submission.activities.filter(
        (activity) =>
          steps.includes(activity)
      ).length,
    0
  );
}

export function computeActivityGroups(
  filtered: Submission[]
) {
  return [
    {
      key: "prospecting",
      name: "หารายชื่อ",
      count: countActivityGroup(
        filtered,
        ACTIVITY_GROUPS.prospecting.steps
      ),
    },

    {
      key: "sales",
      name: "ขาย",
      count: countActivityGroup(
        filtered,
        ACTIVITY_GROUPS.sales.steps
      ),
    },

    {
      key: "service",
      name: "บริการ",
      count: countActivityGroup(
        filtered,
        ACTIVITY_GROUPS.service.steps
      ),
    },
  ];
}

/* =========================================================
   KPI
========================================================= */

export function computeKpis(
  filtered: Submission[]
): KpiSummary {
  const totalCustomers =
    uniq(
      filtered.map(
        (s) => s.customer
      )
    ).length;

  const totalSubmissions =
    filtered.length;

  const totalActivities =
    filtered.reduce(
      (sum, s) =>
        sum +
        s.activities.length,
      0
    );

  const moneyMapDone =
    filtered.filter(
      (s) =>
        s.moneyMap === "ทำ"
    ).length;

  const presentations =
    filtered.filter((s) =>
      s.activities.includes(
        "นำเสนอผลิตภัณฑ์"
      )
    ).length;

  const closedSales =
    filtered.filter((s) =>
      s.activities.includes(
        "ตอบข้อโต้แย้ง / ปิดการขาย"
      )
    ).length;

  return {
    totalCustomers,
    totalSubmissions,
    totalActivities,
    moneyMapDone,
    presentations,
    closedSales,
  };
}

/* =========================================================
   CLOSING STATUS
========================================================= */

export function computeClosingData(
  kpis: KpiSummary,
  gold: string,
  bronze: string
): ChartDatum[] {
  const closed =
    kpis.closedSales;

  const notClosed =
    Math.max(
      kpis.totalSubmissions -
        closed,
      0
    );

  return [
    {
      name: "ปิดการขาย",
      value: closed,
      color: gold,
    },
    {
      name: "ยังไม่ปิดการขาย",
      value: notClosed,
      color: bronze,
    },
  ];
}

/* =========================================================
   9 STEP BREAKDOWN
========================================================= */

export function computeActivityBreakdown(
  filtered: Submission[]
): ChartDatum[] {
  return ACTIVITY_LIST.map(
    (act) => ({
      name: act,
      count:
        filtered.filter((s) =>
          s.activities.includes(
            act
          )
        ).length,
    })
  );
}

/* =========================================================
   MONEY MAP
========================================================= */

export function computeMoneyMapData(
  filtered: Submission[],
  gold: string,
  bronze: string
): ChartDatum[] {
  const done =
    filtered.filter(
      (s) =>
        s.moneyMap === "ทำ"
    ).length;

  const notDone =
    filtered.length -
    done;

  return [
    {
      name: "ทำ My Money Map",
      value: done,
      color: gold,
    },
    {
      name:
        "ยังไม่ได้ทำ My Money Map",
      value: notDone,
      color: bronze,
    },
  ];
}

/* =========================================================
   CHANNEL
========================================================= */

export function computeChannelData(
  filtered: Submission[],
  channels: string[]
): ChartDatum[] {
  return channels
    .map((ch) => ({
      name: ch,
      count:
        filtered
          .filter(
            (s) =>
              s.channel === ch
          )
          .reduce(
            (sum, s) =>
              sum +
              s.activities.length,
            0
          ),
    }))
    .filter(
      (d) =>
        (d.count ?? 0) > 0
    )
    .sort(
      (a, b) =>
        (b.count ?? 0) -
        (a.count ?? 0)
    );
}

/* =========================================================
   SOURCE
========================================================= */

export function computeSourceData(
  filtered: Submission[],
  sources: string[]
): ChartDatum[] {
  return sources
    .map((src) => ({
      name: src,
      count:
        filtered
          .filter(
            (s) =>
              s.source === src
          )
          .reduce(
            (sum, s) =>
              sum +
              s.activities.length,
            0
          ),
    }))
    .filter(
      (d) =>
        (d.count ?? 0) > 0
    )
    .sort(
      (a, b) =>
        (b.count ?? 0) -
        (a.count ?? 0)
    );
}

/* =========================================================
   AGENT TABLE
========================================================= */

export function computeAgentTable(
  baseFiltered: Submission[],
  agents: string[]
): AgentRow[] {
  return agents.map(
    (ag) => {
      const rows =
        baseFiltered.filter(
          (s) =>
            s.agent === ag
        );

      const customers =
        uniq(
          rows.map(
            (s) =>
              s.customer
          )
        ).length;

      const activities =
        rows.reduce(
          (sum, s) =>
            sum +
            s.activities.length,
          0
        );

      const moneyMap =
        rows.filter(
          (s) =>
            s.moneyMap === "ทำ"
        ).length;

      const presentations =
        rows.filter((s) =>
          s.activities.includes(
            "นำเสนอผลิตภัณฑ์"
          )
        ).length;

      const closed =
        rows.filter((s) =>
          s.activities.includes(
            "ตอบข้อโต้แย้ง / ปิดการขาย"
          )
        ).length;

      return {
        agent: ag,
        customers,
        activities,
        moneyMap,
        presentations,
        closed,
        closedPct:
          pct(
            closed,
            customers
          ),
      };
    }
  );
}

/* =========================================================
   PEP INSIGHT
========================================================= */

export function computePepInsight(
  agentFilter: string,
  baseFiltered: Submission[],
  agents: string[]
): PepInsightResult | null {
  if (
    agentFilter === "all"
  ) {
    return null;
  }

  const rows =
    baseFiltered.filter(
      (s) =>
        s.agent ===
        agentFilter
    );

  if (
    rows.length === 0
  ) {
    return {
      empty: true,
    };
  }

  const perAgent =
    agents
      .map((ag) => {
        const r =
          baseFiltered.filter(
            (s) =>
              s.agent === ag
          );

        const customers =
          uniq(
            r.map(
              (s) =>
                s.customer
            )
          ).length || 1;

        return {
          agent: ag,

          closingRate:
            pct(
              r.filter((s) =>
                s.activities.includes(
                  "ตอบข้อโต้แย้ง / ปิดการขาย"
                )
              ).length,
              customers
            ),

          presentationRate:
            pct(
              r.filter((s) =>
                s.activities.includes(
                  "นำเสนอผลิตภัณฑ์"
                )
              ).length,
              customers
            ),

          activityRate:
            pct(
              r.reduce(
                (sum, s) =>
                  sum +
                  s.activities.length,
                0
              ),
              customers
            ),

          moneyMapRate:
            pct(
              r.filter(
                (s) =>
                  s.moneyMap ===
                  "ทำ"
              ).length,
              customers
            ),
        };
      })
      .filter((a) =>
        baseFiltered.some(
          (s) =>
            s.agent ===
            a.agent
        )
      );

  const avg = (
    key: PepMetricKey
  ) =>
    perAgent.reduce(
      (sum, a) =>
        sum + a[key],
      0
    ) /
    (
      perAgent.length ||
      1
    );

  const averages: Record<
    PepMetricKey,
    number
  > = {
    closingRate:
      avg(
        "closingRate"
      ),

    presentationRate:
      avg(
        "presentationRate"
      ),

    activityRate:
      avg(
        "activityRate"
      ),

    moneyMapRate:
      avg(
        "moneyMapRate"
      ),
  };

  const customers =
    uniq(
      rows.map(
        (s) =>
          s.customer
      )
    ).length || 1;

  const mine: Record<
    PepMetricKey,
    number
  > = {
    closingRate:
      pct(
        rows.filter((s) =>
          s.activities.includes(
            "ตอบข้อโต้แย้ง / ปิดการขาย"
          )
        ).length,
        customers
      ),

    presentationRate:
      pct(
        rows.filter((s) =>
          s.activities.includes(
            "นำเสนอผลิตภัณฑ์"
          )
        ).length,
        customers
      ),

    activityRate:
      pct(
        rows.reduce(
          (sum, s) =>
            sum +
            s.activities.length,
          0
        ),
        customers
      ),

    moneyMapRate:
      pct(
        rows.filter(
          (s) =>
            s.moneyMap ===
            "ทำ"
        ).length,
        customers
      ),
  };

  const deltas =
    (
      Object.keys(
        mine
      ) as PepMetricKey[]
    ).map(
      (k) => ({
        key: k,
        delta:
          mine[k] -
          averages[k],
      })
    );

  const strengthKey =
    deltas.reduce(
      (a, b) =>
        b.delta >
        a.delta
          ? b
          : a
    ).key;

  const gapKey =
    deltas.reduce(
      (a, b) =>
        b.delta <
        a.delta
          ? b
          : a
    ).key;

  return {
    empty: false,
    strengthKey,
    gapKey,
    mine,
    averages,
  };
}
