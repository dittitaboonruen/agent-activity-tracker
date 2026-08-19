"use client";

import React from "react";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from "recharts";

import { Card } from "./ui";

import type {
  ChartDatum,
} from "@/types";

const TOOLTIP_STYLE = {
  background: "#1C1810",
  border: "1px solid #3A2F1B",
  borderRadius: 6,
  color: "#F4EEDD",
  fontSize: 12,
};

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

interface Props {
  data: ChartDatum[];
}

export default function ActivityBreakdownCard({
  data,
}: Props) {
  function getStepCount(
    step: string
  ): number {
    return (
      data.find(
        (item) =>
          item.name === step
      )?.count ?? 0
    );
  }

  const groupedData =
    GROUPS.map((group) => ({
      ...group,

      total:
        group.steps.reduce(
          (sum, step) =>
            sum +
            getStepCount(step),
          0
        ),

      data:
        group.steps.map(
          (step) => ({
            name: step,
            count:
              getStepCount(step),
          })
        ),
    }));

  return (
    <Card>
      {/* HEADER */}
      <div
        style={{
          marginBottom: 16,
        }}
      >
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
          className="dash-section-title"
          style={{
            marginTop: 4,
          }}
        >
          9 ขั้นตอนการขาย
        </div>

        <div
          style={{
            marginTop: 4,
            fontSize: 12,
            color:
              "var(--text-muted)",
          }}
        >
          แสดงจำนวนกิจกรรมในแต่ละขั้นตอน
          แยกตาม 3 หมวดหลัก
        </div>
      </div>

      {/* GROUPS */}
      <div
        style={{
          display: "grid",
          gap: 16,
        }}
      >
        {groupedData.map(
          (group, index) => (
            <div
              key={group.key}
              style={{
                border:
                  "1px solid var(--border)",
                borderRadius: 8,
                padding: 12,
                background:
                  "var(--panel-soft)",
              }}
            >
              {/* GROUP HEADER */}
              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                  alignItems:
                    "center",
                  gap: 10,
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems:
                      "center",
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius:
                        "50%",
                      display:
                        "flex",
                      justifyContent:
                        "center",
                      alignItems:
                        "center",
                      border:
                        "1px solid #C9A24B",
                      color:
                        "#C9A24B",
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    {index + 1}
                  </div>

                  <strong
                    style={{
                      fontSize: 14,
                      color:
                        "var(--text)",
                    }}
                  >
                    {group.label}
                  </strong>
                </div>

                <div
                  style={{
                    fontSize: 12,
                    color:
                      "var(--text-muted)",
                  }}
                >
                  รวม{" "}
                  <strong
                    style={{
                      color:
                        "#C9A24B",
                      fontSize: 16,
                    }}
                  >
                    {group.total}
                  </strong>
                </div>
              </div>

              {/* BAR CHART */}
              <div
                style={{
                  height: 125,
                }}
              >
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >
                  <BarChart
                    data={
                      group.data
                    }
                    layout="vertical"
                    margin={{
                      left: 4,
                      right: 28,
                      top: 2,
                      bottom: 2,
                    }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#241E12"
                      horizontal={
                        false
                      }
                    />

                    <XAxis
                      type="number"
                      allowDecimals={
                        false
                      }
                      tick={{
                        fill:
                          "#8A8066",
                        fontSize: 10,
                      }}
                      axisLine={{
                        stroke:
                          "#3A2F1B",
                      }}
                      tickLine={
                        false
                      }
                    />

                    <YAxis
                      type="category"
                      dataKey="name"
                      width={165}
                      tick={{
                        fill:
                          "#B4A98D",
                        fontSize: 10,
                      }}
                      axisLine={{
                        stroke:
                          "#3A2F1B",
                      }}
                      tickLine={
                        false
                      }
                    />

                    <Tooltip
                      contentStyle={
                        TOOLTIP_STYLE
                      }
                      cursor={{
                        fill:
                          "rgba(201,162,75,0.06)",
                      }}
                    />

                    <Bar
                      dataKey="count"
                      fill="#C9A24B"
                      radius={[
                        0,
                        3,
                        3,
                        0,
                      ]}
                      barSize={14}
                    >
                      <LabelList
                        dataKey="count"
                        position="right"
                        fill="#B4A98D"
                        fontSize={10}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )
        )}
      </div>
    </Card>
  );
}
