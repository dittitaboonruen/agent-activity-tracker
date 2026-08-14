"use client";

import { useEffect, useState } from "react";

type AnnualTarget = {
  id: number;
  agent_name: string;
  target_year: number;
  target_fyp: number;
  target_fyc: number;
  target_case: number;
};

interface AnnualTargetCardProps {
  agentFilter: string;
  year: number;
}

export default function AnnualTargetCard({
  agentFilter,
  year,
}: AnnualTargetCardProps) {
  const [target, setTarget] = useState<AnnualTarget | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (agentFilter === "all") {
      setTarget(null);
      return;
    }

    async function loadTarget() {
      setLoading(true);

      try {
        const res = await fetch(
          `/api/annual-target?agent=${encodeURIComponent(
            agentFilter
          )}&year=${year}`,
          { cache: "no-store" }
        );

        const json = await res.json();

        if (res.ok) {
          setTarget(json.target ?? null);
        } else {
          setTarget(null);
        }
      } catch {
        setTarget(null);
      } finally {
        setLoading(false);
      }
    }

    loadTarget();
  }, [agentFilter, year]);

  if (agentFilter === "all") {
    return (
      <div className="dash-card">
        <div className="dash-card-title">Annual Target</div>
        <div style={{ opacity: 0.65, marginTop: 12 }}>
          เลือกตัวแทนเพื่อดูเป้าหมายประจำปี
        </div>
      </div>
    );
  }

  return (
    <div className="dash-card">
      <div className="dash-card-title">
        Annual Target {year + 543}
      </div>

      {loading ? (
        <div style={{ marginTop: 14, opacity: 0.65 }}>
          กำลังโหลดเป้าหมาย...
        </div>
      ) : !target ? (
        <div style={{ marginTop: 14, opacity: 0.65 }}>
          ยังไม่มีข้อมูลเป้าหมายของ {agentFilter}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 12,
            marginTop: 16,
          }}
        >
          <TargetBox
            label="Target FYP"
            value={Number(target.target_fyp).toLocaleString()}
          />

          <TargetBox
            label="Target FYC"
            value={Number(target.target_fyc).toLocaleString()}
          />

          <TargetBox
            label="Target CASE"
            value={Number(target.target_case).toLocaleString()}
          />
        </div>
      )}
    </div>
  );
}

function TargetBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 12,
        border: "1px solid rgba(201,162,75,.35)",
        background: "rgba(201,162,75,.06)",
      }}
    >
      <div style={{ fontSize: 13, opacity: 0.7 }}>
        {label}
      </div>

      <div
        style={{
          marginTop: 6,
          fontSize: 22,
          fontWeight: 700,
        }}
      >
        {value}
      </div>
    </div>
  );
}
