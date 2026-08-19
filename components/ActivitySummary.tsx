"use client";

import React from "react";

import { Card } from "./ui";

import type {
  ChartDatum,
} from "@/types";

interface ActivitySummaryProps {
  breakdown: ChartDatum[];
  totalActivities: number;
}

const GROUPS = [
  {
    key: "prospecting",
    label: "หารายชื่อ",
    steps: [
      "หาผู้มุ่งหวัง",
      "นัดหมาย",
      "เปิดบทสนทนา",
    ],
  },

  {
    key: "sales",
    label: "ขาย",
    steps: [
      "วิเคราะห์ความต้องการ",
      "นำเสนอผลิตภัณฑ์",
      "ตอบข้อโต้แย้ง / ปิดการขาย",
    ],
  },

  {
    key: "service",
    label: "บริการ",
    steps: [
      "นำส่งใบสมัคร / งานระบบ",
      "บริการหลังการขาย",
      "ขอรายชื่อแนะนำ / ต่อยอดตลาด",
    ],
  },
] as const;

function ActivitySummary({
  breakdown,
  totalActivities,
}: ActivitySummaryProps) {
  function getStepCount(
    step: string
  ): number {
    return (
      breakdown.find(
        (item) =>
          item.name === step
      )?.count ?? 0
    );
  }

  const groups =
    GROUPS.map((group) => {
      const count =
        group.steps.reduce(
          (sum, step) =>
            sum +
            getStepCount(step),
          0
        );

      return {
        ...group,
        count,
      };
    });

  return (
    <Card
      className="dash-activity-summary"
      style={{
        marginTop: 14,
      }}
    >
      {/* HEADER */}
      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 14,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              letterSpacing:
                "0.08em",
              color:
                "var(--text-muted)",
            }}
          >
            SALES PROCESS
          </div>

          <div
            style={{
              marginTop: 4,
              fontSize: 16,
              fontWeight: 700,
              color:
                "var(--text)",
            }}
          >
            สรุปขั้นตอนการขาย
          </div>
        </div>

        <div
          style={{
            fontSize: 13,
            color:
              "var(--text-muted)",
          }}
        >
          กิจกรรมทั้งหมด{" "}
          <strong
            style={{
              color:
                "#C9A24B",
              fontSize: 18,
            }}
          >
            {totalActivities}
          </strong>
        </div>
      </div>

      {/* 3 MAIN GROUPS */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(3, minmax(0, 1fr))",
          gap: 12,
        }}
      >
        {groups.map(
          (group, index) => (
            <div
              key={group.key}
              style={{
                border:
                  "1px solid var(--border)",
                borderRadius: 8,
                padding: 14,
                background:
                  "var(--panel-soft)",
              }}
            >
              {/* GROUP NUMBER + NAME */}
              <div
                style={{
                  display: "flex",
                  alignItems:
                    "center",
                  justifyContent:
                    "space-between",
                  gap: 10,
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems:
                      "center",
                    gap: 9,
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius:
                        "50%",
                      display:
                        "flex",
                      alignItems:
                        "center",
                      justifyContent:
                        "center",
                      border:
                        "1px solid #C9A24B",
                      color:
                        "#C9A24B",
                      fontWeight: 700,
                      fontSize: 12,
                    }}
                  >
                    {index + 1}
                  </div>

                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color:
                        "var(--text)",
                    }}
                  >
                    {group.label}
                  </div>
                </div>

                <div
                  style={{
                    fontSize: 24,
                    lineHeight: 1,
                    fontWeight: 700,
                    color:
                      "#C9A24B",
                  }}
                >
                  {group.count}
                </div>
              </div>

              {/* STEPS */}
              <div
                style={{
                  display: "grid",
                  gap: 7,
                }}
              >
                {group.steps.map(
                  (step) => {
                    const count =
                      getStepCount(
                        step
                      );

                    return (
                      <div
                        key={step}
                        style={{
                          display:
                            "flex",
                          alignItems:
                            "center",
                          justifyContent:
                            "space-between",
                          gap: 10,
                          paddingTop: 6,
                          borderTop:
                            "1px solid var(--border)",
                        }}
                      >
                        <span
                          style={{
                            fontSize:
                              12,
                            color:
                              "var(--text-muted)",
                          }}
                        >
                          {step}
                        </span>

                        <strong
                          style={{
                            color:
                              count > 0
                                ? "#C9A24B"
                                : "var(--text-muted)",
                            fontSize:
                              12,
                          }}
                        >
                          {count}
                        </strong>
                      </div>
                    );
                  }
                )}
              </div>
            </div>
          )
        )}
      </div>

      {/* MOBILE RESPONSIVE */}
      <style jsx>{`
        @media (max-width: 850px) {
          div[style*="repeat(3"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </Card>
  );
}

export default React.memo(
  ActivitySummary
);
