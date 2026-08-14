"use client";

import React from "react";
import { Card } from "./ui";
import type { ChartDatum } from "@/types";

interface ActivitySummaryProps {
  /** Same value already passed to ActivityBreakdownCard — computed once via computeActivityBreakdown(filtered). Not recomputed here. */
  breakdown: ChartDatum[];
  /** Same value already shown in the "กิจกรรมทั้งหมด" KPI card (kpis.totalActivities). Not recomputed here. */
  totalActivities: number;
}

function ActivitySummary({ breakdown, totalActivities }: ActivitySummaryProps) {
  // Zero-value activity types are hidden from this compact view (the full bar
  // chart below still always shows every type, unchanged).
  const nonZero = breakdown.filter((d) => (d.count ?? 0) > 0);

  return (
    <Card className="dash-activity-summary">
      <span className="dash-activity-summary-total">กิจกรรมทั้งหมด: {totalActivities}</span>
      {nonZero.length > 0 && (
        <div className="dash-activity-chip-list">
          {nonZero.map((d) => (
            <span key={d.name} className="dash-activity-chip">
              {d.name}: <span className="dash-activity-chip-count">{d.count}</span>
            </span>
          ))}
        </div>
      )}
    </Card>
  );
}

// breakdown/totalActivities are memoized upstream in Dashboard.tsx, so this
// skips re-rendering when an unrelated state change (e.g. refreshing toggling)
// doesn't change the underlying data — same pattern as the chart cards.
export default React.memo(ActivitySummary);
