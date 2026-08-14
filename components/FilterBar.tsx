"use client";

import React from "react";
import type { Filters, DateQuickOption } from "@/types";
import { formatThaiDateLong } from "@/lib/date-utils";

interface FilterBarProps {
  filters: Filters;
  onChange: (next: Partial<Filters>) => void;
  agents: string[];
  channels: string[];
  todayStr: string;
}

const DATE_OPTIONS: { key: DateQuickOption; label: string }[] = [
  { key: "today", label: "วันนี้" },
  { key: "custom", label: "กำหนดเอง" },
];

export default function FilterBar({ filters, onChange, agents, channels, todayStr }: FilterBarProps) {
  return (
    <div className="dash-filter-bar">
      <div className="dash-filter dash-filter-date active">
        <label>วันที่ (Submission Date · Asia/Bangkok)</label>
        <div className="dash-date-quick">
          {DATE_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              className={`dash-pill ${filters.dateQuick === opt.key ? "dash-pill-active" : ""}`}
              onClick={() => onChange({ dateQuick: opt.key })}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {filters.dateQuick === "custom" && (
          <div className="dash-date-range">
            <input
              type="date"
              value={filters.customStart}
              onChange={(e) => onChange({ customStart: e.target.value })}
              max={filters.customEnd || undefined}
            />
            <span className="dash-date-range-sep">ถึง</span>
            <input
              type="date"
              value={filters.customEnd}
              onChange={(e) => onChange({ customEnd: e.target.value })}
              min={filters.customStart || undefined}
            />
            {(!filters.customStart || !filters.customEnd) && (
              <span className="dash-date-caption">เลือกวันที่เริ่มต้นและสิ้นสุด</span>
            )}
            {filters.customStart && filters.customEnd && (
              <span className="dash-date-caption">
                {formatThaiDateLong(filters.customStart)} – {formatThaiDateLong(filters.customEnd)}
              </span>
            )}
          </div>
        )}

        {filters.dateQuick === "today" && <div className="dash-date-caption">{formatThaiDateLong(todayStr)}</div>}
      </div>

      <div className="dash-filter-row">
        <div className={`dash-filter ${filters.agentFilter !== "all" ? "active" : ""}`}>
          <label>ชื่อตัวแทน</label>
          <select value={filters.agentFilter} onChange={(e) => onChange({ agentFilter: e.target.value })}>
            <option value="all">ทุกตัวแทน</option>
            {agents.map((a) => (
              <option key={a} value={a}>
                ตัวแทน {a}
              </option>
            ))}
          </select>
        </div>
        <div className={`dash-filter ${filters.channelFilter !== "all" ? "active" : ""}`}>
          <label>ช่องทางที่ใช้ติดต่อ</label>
          <select value={filters.channelFilter} onChange={(e) => onChange({ channelFilter: e.target.value })}>
            <option value="all">ทุกช่องทาง</option>
            {channels.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
