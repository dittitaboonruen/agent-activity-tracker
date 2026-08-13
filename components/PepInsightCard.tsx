"use client";

import React from "react";
import { Card } from "./ui";
import { PEP_META } from "@/lib/dashboard-calculations";
import type { PepInsightResult } from "@/types";

export default function PepInsightCard({
  agentFilter,
  insight,
}: {
  agentFilter: string;
  insight: PepInsightResult | null;
}) {
  return (
    <Card>
      {agentFilter === "all" && (
        <div className="dash-pep-empty">เลือก &quot;ชื่อตัวแทน&quot; จากตัวกรองด้านบน เพื่อดู PEP Insight รายบุคคล</div>
      )}
      {agentFilter !== "all" && insight?.empty && (
        <div className="dash-pep-empty">ไม่มีข้อมูลของตัวแทน {agentFilter} ภายใต้ตัวกรองที่เลือกไว้</div>
      )}
      {agentFilter !== "all" && insight && !insight.empty && insight.strengthKey && insight.gapKey && insight.mine && insight.averages && (
        <div className="dash-pep-grid">
          <div className="dash-pep-item">
            <div className="dash-pep-item-label">จุดแข็ง — ตัวแทน {agentFilter}</div>
            <div className="dash-pep-item-value gold">{PEP_META[insight.strengthKey].label}</div>
            <div className="dash-pep-item-sub">
              {insight.mine[insight.strengthKey]}% เทียบกับค่าเฉลี่ยทีมที่{" "}
              {Math.round(insight.averages[insight.strengthKey] * 10) / 10}%
            </div>
          </div>
          <div className="dash-pep-item">
            <div className="dash-pep-item-label">จุดที่ควรพัฒนา</div>
            <div className="dash-pep-item-value gold">{PEP_META[insight.gapKey].label}</div>
            <div className="dash-pep-item-sub">
              {insight.mine[insight.gapKey]}% เทียบกับค่าเฉลี่ยทีมที่{" "}
              {Math.round(insight.averages[insight.gapKey] * 10) / 10}%
            </div>
          </div>
          <div className="dash-pep-item">
            <div className="dash-pep-item-label">แนวทาง PEP ที่แนะนำ</div>
            <div className="dash-pep-item-value">{PEP_META[insight.gapKey].focus}</div>
          </div>
          <div className="dash-pep-item">
            <div className="dash-pep-item-label">คำถามชวนโค้ช</div>
            <div className="dash-pep-item-value">{PEP_META[insight.gapKey].question}</div>
          </div>
        </div>
      )}
    </Card>
  );
}
