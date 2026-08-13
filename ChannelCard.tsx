"use client";

import React from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card } from "./ui";
import type { ChartDatum } from "@/types";

const TOOLTIP_STYLE = {
  background: "#1C1810",
  border: "1px solid #3A2F1B",
  borderRadius: 4,
  color: "#F4EEDD",
  fontSize: 12,
};

export default function ChannelCard({ data }: { data: ChartDatum[] }) {
  return (
    <Card>
      <div className="dash-section-title">ช่องทางที่ใช้ติดต่อ</div>
      <div style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#241E12" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fill: "#B4A98D", fontSize: 10 }}
              axisLine={{ stroke: "#3A2F1B" }}
              tickLine={false}
              interval={0}
              angle={-12}
              textAnchor="end"
              height={46}
            />
            <YAxis tick={{ fill: "#8A8066", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: "rgba(201,162,75,0.06)" }} />
            <Bar dataKey="count" fill="#C9A24B" radius={[3, 3, 0, 0]} barSize={26} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
