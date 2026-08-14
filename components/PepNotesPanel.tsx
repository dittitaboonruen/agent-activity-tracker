"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Card } from "./ui";
import { formatThaiDateLong } from "@/lib/date-utils";
import type { PepNote } from "@/types";

interface PepNotesPanelProps {
  agentFilter: string;
  todayStr: string;
  /** Prefill only — from the existing auto-computed PEP analytics (PEP_META[gapKey]). Fully editable/overridable by the manager. */
  suggestedRecommendation?: string;
  suggestedQuestion?: string;
}

function PepNotesPanel({
  agentFilter,
  todayStr,
  suggestedRecommendation = "",
  suggestedQuestion = "",
}: PepNotesPanelProps) {
  const [history, setHistory] = useState<PepNote[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [pepDate, setPepDate] = useState(todayStr);
  const [recommendation, setRecommendation] = useState("");
  const [coachingQuestion, setCoachingQuestion] = useState("");
  const [actionPlan, setActionPlan] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Reset the form and (re)load history whenever the selected agent changes.
  // Intentionally does NOT depend on suggestedRecommendation/suggestedQuestion —
  // those are a one-time prefill on agent selection, not a live sync, so a
  // background data refresh never clobbers what a manager is mid-typing.
  useEffect(() => {
    setSaveError(null);
    setSaveSuccess(false);
    setPepDate(todayStr);
    setRecommendation(suggestedRecommendation);
    setCoachingQuestion(suggestedQuestion);
    setActionPlan("");

    if (agentFilter === "all") {
      setHistory([]);
      setHistoryError(null);
      setHistoryLoading(false);
      return;
    }

    let cancelled = false;
    setHistoryLoading(true);
    setHistoryError(null);

    fetch(`/api/pep-notes?agent=${encodeURIComponent(agentFilter)}`, { cache: "no-store" })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || `Request failed with status ${res.status}`);
        if (!cancelled) setHistory(json.notes ?? []);
      })
      .catch((err) => {
        if (!cancelled) setHistoryError(err instanceof Error ? err.message : "ไม่สามารถโหลดประวัติ PEP ได้");
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentFilter, todayStr]);

  const handleSave = useCallback(async () => {
    if (agentFilter === "all" || saving) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const res = await fetch("/api/pep-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentName: agentFilter, pepDate, recommendation, coachingQuestion, actionPlan }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `Request failed with status ${res.status}`);
      setHistory((prev) => [json.note as PepNote, ...prev]);
      setSaveSuccess(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "ไม่สามารถบันทึก PEP ได้");
    } finally {
      setSaving(false);
    }
  }, [agentFilter, saving, pepDate, recommendation, coachingQuestion, actionPlan]);

  if (agentFilter === "all") {
    return (
      <Card>
        <div className="dash-pep-empty">
          เลือก &quot;ชื่อตัวแทน&quot; จากตัวกรองด้านบน เพื่อบันทึกหรือดูประวัติ PEP Notes
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="dash-section-title">บันทึก PEP — ตัวแทน {agentFilter}</div>

      <div className="dash-pepform-field">
        <label>วันที่ทำ PEP</label>
        <input type="date" value={pepDate} onChange={(e) => setPepDate(e.target.value)} max={todayStr} />
      </div>

      <div className="dash-pepform-field">
        <label>แนวทาง PEP / เทคนิคที่แนะนำ</label>
        <textarea value={recommendation} onChange={(e) => setRecommendation(e.target.value)} rows={2} />
      </div>

      <div className="dash-pepform-field">
        <label>คำถามชวนโค้ช</label>
        <textarea value={coachingQuestion} onChange={(e) => setCoachingQuestion(e.target.value)} rows={2} />
      </div>

      <div className="dash-pepform-field">
        <label>Action Plan</label>
        <textarea
          value={actionPlan}
          onChange={(e) => setActionPlan(e.target.value)}
          rows={2}
          placeholder="ขั้นตอนถัดไปที่ตกลงกับตัวแทน..."
        />
      </div>

      <div className="dash-pepform-actions">
        <button className="dash-save-btn" onClick={handleSave} disabled={saving}>
          {saving ? "กำลังบันทึก..." : "บันทึก PEP"}
        </button>
        {saveSuccess && <span className="dash-save-success">บันทึกแล้ว</span>}
      </div>

      {saveError && <div className="dash-stale-warning dash-pepform-error">ไม่สามารถบันทึก PEP ได้: {saveError}</div>}

      <div className="dash-eyebrow dash-pep-history-eyebrow">ประวัติ PEP</div>

      {historyLoading && <div className="dash-pep-empty">กำลังโหลดประวัติ...</div>}
      {historyError && <div className="dash-stale-warning">ไม่สามารถโหลดประวัติ PEP ได้: {historyError}</div>}
      {!historyLoading && !historyError && history.length === 0 && (
        <div className="dash-pep-empty">ยังไม่มีประวัติ PEP สำหรับตัวแทนนี้</div>
      )}
      {!historyLoading && history.length > 0 && (
        <div className="dash-pep-history-list">
          {history.map((note) => (
            <div key={note.id} className="dash-pep-history-item">
              <div className="dash-pep-history-date">{formatThaiDateLong(note.pepDate)}</div>
              {note.recommendation && (
                <div className="dash-pep-history-row">
                  <span className="dash-pep-history-label">แนวทาง / เทคนิคที่แนะนำ:</span> {note.recommendation}
                </div>
              )}
              {note.coachingQuestion && (
                <div className="dash-pep-history-row">
                  <span className="dash-pep-history-label">คำถามชวนโค้ช:</span> {note.coachingQuestion}
                </div>
              )}
              {note.actionPlan && (
                <div className="dash-pep-history-row">
                  <span className="dash-pep-history-label">Action Plan:</span> {note.actionPlan}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// agentFilter/todayStr/suggested* are stable across pure Dashboard re-renders
// (e.g. the refreshing indicator toggling), so this skips re-rendering the
// form and history list when nothing it actually depends on has changed.
export default React.memo(PepNotesPanel);
