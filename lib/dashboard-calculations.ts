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

export function countActivityGroup(
  submissions: Submission[],
  steps: readonly string[]
): number {
  return submissions.reduce(
    (total, submission) =>
      total +
      submission.activities.filter((activity) =>
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
