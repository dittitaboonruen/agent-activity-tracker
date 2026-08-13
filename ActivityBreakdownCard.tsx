"use client";

import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from "recharts";
import { Card } from "./ui";
import type { ChartDatum } from "@/types";

const TOOLTIP_STYLE = {
  background: "#1C1810",
  border: "1px solid #3A2F1B",
  borderRadius: 4,
  color: "#F4EEDD",
  fontSize: 12,
};

export default function ActivityBreakdownCard({ data }: { data: ChartDatum[] }) {
  return (
    <Card>
      <div className="dash-section-title">กิจกรรมที่ทำ (แยกตามประเภท)</div>
      <div style={{ height: 230 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#241E12" horizontal={false} />
            <XAxis type="number" tick={{ fill: "#8A8066", fontSize: 11 }} axisLine={{ stroke: "#3A2F1B" }} tickLine={false} allowDecimals={false} />
            <YAxis type="category" dataKey="name" width={110} tick={{ fill: "#B4A98D", fontSize: 11 }} axisLine={{ stroke: "#3A2F1B" }} tickLine={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(201,162,75,0.06)" }} />
            <Bar dataKey="count" fill="#C9A24B" radius={[0, 3, 3, 0]} barSize={16}>
              <LabelList dataKey="count" position="right" fill="#B4A98D" fontSize={11} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
