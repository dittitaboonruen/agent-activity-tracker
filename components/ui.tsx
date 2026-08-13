"use client";

import React from "react";

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="dash-eyebrow">{children}</div>;
}

export function Card({
  children,
  style,
  className = "",
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <div className={`dash-card ${className}`} style={style}>
      <span className="dash-corner dash-corner-tl" />
      <span className="dash-corner dash-corner-br" />
      {children}
    </div>
  );
}

export function KpiCard({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number | string;
  suffix?: string;
}) {
  return (
    <Card className="dash-kpi">
      <div className="dash-kpi-label">{label}</div>
      <div className="dash-kpi-value">
        {value}
        {suffix && <span className="dash-kpi-suffix">{suffix}</span>}
      </div>
    </Card>
  );
}

export function CenterDonutLabel({
  total,
  pctText,
  sub,
}: {
  total: number | string;
  pctText?: string;
  sub?: string;
}) {
  return (
    <div className="dash-donut-center">
      <div className="dash-donut-total">{total}</div>
      {pctText && <div className="dash-donut-pct">{pctText}</div>}
      {sub && <div className="dash-donut-sub">{sub}</div>}
    </div>
  );
}
