"use client";

import React from "react";

import { Card } from "./ui";

import type {
  AgentRow,
} from "@/types";

interface AgentTableProps {
  rows: AgentRow[];
  selectedAgent: string;
}

export default function AgentTable({
  rows,
  selectedAgent,
}: AgentTableProps) {
  return (
    <Card
      style={{
        marginBottom: 34,
      }}
    >
      <div
        style={{
          marginBottom: 14,
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.08em",
            color: "var(--text-muted)",
          }}
        >
          AGENT PERFORMANCE
        </div>

        <div
          className="dash-section-title"
          style={{
            marginTop: 4,
          }}
        >
          เปรียบเทียบ Sales Process รายตัวแทน
        </div>

        <div
          style={{
            marginTop: 4,
            fontSize: 12,
            color: "var(--text-muted)",
          }}
        >
          เปรียบเทียบกิจกรรมใน 3 หมวดหลัก:
          หารายชื่อ · ขาย · บริการ
        </div>
      </div>

      <div className="dash-table-wrap">
        <table className="dash-table">
          <thead>
            <tr>
              <th>ตัวแทน</th>

              <th className="dash-num">
                ลูกค้า
              </th>

              <th className="dash-num">
                หารายชื่อ
              </th>

              <th className="dash-num">
                ขาย
              </th>

              <th className="dash-num">
                บริการ
              </th>

              <th className="dash-num">
                My Money Map
              </th>

              <th className="dash-num">
                ปิดการขาย
              </th>

              <th className="dash-num">
                % ปิดการขาย
              </th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr
                key={row.agent}
                className={
                  selectedAgent === row.agent
                    ? "dash-row-selected"
                    : ""
                }
              >
                <td>
                  ตัวแทน {row.agent}
                </td>

                <td className="dash-num">
                  {row.customers}
                </td>

                <td className="dash-num">
                  <strong
                    style={{
                      color: "#C9A24B",
                    }}
                  >
                    {row.prospecting}
                  </strong>
                </td>

                <td className="dash-num">
                  <strong
                    style={{
                      color: "#C9A24B",
                    }}
                  >
                    {row.sales}
                  </strong>
                </td>

                <td className="dash-num">
                  <strong
                    style={{
                      color: "#C9A24B",
                    }}
                  >
                    {row.service}
                  </strong>
                </td>

                <td className="dash-num">
                  {row.moneyMap}
                </td>

                <td className="dash-num">
                  {row.closed}
                </td>

                <td className="dash-num">
                  {row.closedPct}%
                </td>
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  style={{
                    textAlign: "center",
                    padding: "26px 12px",
                    color: "var(--text-muted)",
                  }}
                >
                  ไม่มีข้อมูลตัวแทนในช่วงเวลาที่เลือก
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
