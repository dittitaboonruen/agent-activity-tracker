"use client";

import { useEffect, useState } from "react";
import { dataTimestampLabel } from "@/lib/date-utils";

type AnnualTarget = {
  id: number;
  agent_name: string;
  target_year: number;
  target_fyp: number;
  target_fyc: number;
  target_case: number;
  updated_at?: string | null;
};

interface AnnualTargetCardProps {
  agentFilter: string;
  year: number;
  refreshKey?: number;
}

export default function AnnualTargetCard({
  agentFilter,
  year,
  refreshKey = 0,
}: AnnualTargetCardProps) {
  const [target, setTarget] = useState<AnnualTarget | null>(null);
  const [loading, setLoading] = useState(agentFilter !== "all");
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setTarget(null);
    setError(null);
    if (agentFilter === "all") {
      setLoading(false);
      return () => controller.abort();
    }
    setLoading(true);
    async function loadTarget() {
      try {
        const res = await fetch(
          `/api/annual-target?agent=${encodeURIComponent(agentFilter)}&year=${year}`,
          { cache: "no-store", signal: controller.signal }
        );
        const json = await res.json();
        if (!res.ok || !("target" in json)) throw new Error(json.error || "ไม่สามารถโหลดเป้าหมายได้");
        if (!controller.signal.aborted) setTarget(json.target ?? null);
      } catch (loadError) {
        if (!controller.signal.aborted) setError(loadError instanceof Error ? loadError.message : "ไม่สามารถโหลดเป้าหมายได้");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void loadTarget();
    return () => controller.abort();
  }, [agentFilter, year, refreshKey, retry]);

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
        <div role="status" style={{ marginTop: 14, opacity: 0.65 }}>
          กำลังโหลดเป้าหมาย...
        </div>
      ) : error ? (
        <div className="dash-error-banner" role="alert">
          ไม่สามารถโหลดเป้าหมายได้: {error}{" "}
          <button type="button" className="dash-refresh-btn" onClick={() => setRetry(value => value + 1)}>ลองใหม่</button>
        </div>
      ) : !target ? (
        <div style={{ marginTop: 14, opacity: 0.65 }}>
          ยังไม่มีข้อมูลเป้าหมายปี {year + 543} ของ {agentFilter}
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
      {!loading && !error && target && (
        <p style={{ marginTop: 14, color: "var(--cream-muted)", fontSize: 12 }}>
          เป้าหมายอัปเดตล่าสุด: {dataTimestampLabel(target.updated_at)}
        </p>
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
