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

export default function MoneyMapCard({ data, total }: { data: ChartDatum[]; total: number }) {
  const hasNotDone = (data[1]?.value ?? 0) > 0;

  return (
    <Card>
      <div className="dash-section-title">My Money Map</div>
      <div className="dash-donut-wrap" style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="90%"
              paddingAngle={hasNotDone ? 3 : 0}
              stroke="none"
            >
              {data.map((d, i) => (
                <Cell key={i} fill={d.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} />
          </PieChart>
        </ResponsiveContainer>
        <CenterDonutLabel total={total} pctText={`${pct(data[0]?.value ?? 0, total)}%`} sub="ทำแล้ว" />
      </div>
      <div className="dash-legend">
        {data.map((d, i) => (
          <div key={i} className="dash-legend-item">
            <span className="dash-legend-dot" style={{ background: d.color }} />
            {d.name}: {d.value}
          </div>
        ))}
      </div>
    </Card>
  );
}
