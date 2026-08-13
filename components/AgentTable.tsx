"use client";

import React from "react";
import { Card } from "./ui";
import type { AgentRow } from "@/types";

export default function AgentTable({ rows, selectedAgent }: { rows: AgentRow[]; selectedAgent: string }) {
  return (
    <Card style={{ marginBottom: 34 }}>
      <div className="dash-table-wrap">
        <table className="dash-table">
          <thead>
            <tr>
              <th>ตัวแทน</th>
              <th className="dash-num">ลูกค้า</th>
              <th className="dash-num">กิจกรรม</th>
              <th className="dash-num">My Money Map</th>
              <th className="dash-num">เสนอขาย</th>
              <th className="dash-num">ปิดการขาย</th>
              <th className="dash-num">% ปิดการขาย</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.agent} className={selectedAgent === row.agent ? "dash-row-selected" : ""}>
                <td>ตัวแทน {row.agent}</td>
                <td className="dash-num">{row.customers}</td>
                <td className="dash-num">{row.activities}</td>
                <td className="dash-num">{row.moneyMap}</td>
                <td className="dash-num">{row.presentations}</td>
                <td className="dash-num">{row.closed}</td>
                <td className="dash-num">{row.closedPct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
