"use client";

import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CenterDonutLabel } from "./ui";
import { pct } from "@/lib/dashboard-calculations";
import type { ChartDatum } from "@/types";

const TOOLTIP_STYLE = {
  background: "#1C1810",
  border: "1px solid #3A2F1B",
  borderRadius: 4,
  color: "#F4EEDD",
  fontSize: 12,
};

export default function ClosingStatusCard({
  closingData,
  totalSubmissions,
  closedSales,
}: {
  closingData: ChartDatum[];
  totalSubmissions: number;
  closedSales: number;
}) {
  const hasNotClosed = (closingData[1]?.value ?? 0) > 0;

  return (
    <Card>
      <div className="dash-section-title">สถานะการปิดการขาย</div>
      <div className="dash-donut-wrap">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={closingData}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="90%"
              paddingAngle={hasNotClosed ? 3 : 0}
              stroke="none"
            >
              {closingData.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} />
          </PieChart>
        </ResponsiveContainer>
        <CenterDonutLabel
          total={totalSubmissions}
          pctText={`${pct(closedSales, totalSubmissions)}% ปิดการขาย`}
          sub="รายการทั้งหมด"
        />
      </div>
      <div className="dash-legend">
        {closingData.map((d, i) => (
          <div key={i} className="dash-legend-item">
            <span className="dash-legend-dot" style={{ background: d.color }} />
            {d.name}: {d.value} ({pct(d.value ?? 0, totalSubmissions)}%)
          </div>
        ))}
      </div>
    </Card>
  );
}
