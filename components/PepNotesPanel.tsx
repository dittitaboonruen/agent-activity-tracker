"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Card } from "./ui";
import { dataTimestampLabel, latestDataTimestamp, formatThaiDateLong } from "@/lib/date-utils";
import type { PepNote } from "@/types";

interface PepNotesPanelProps {
  agentFilter: string;
  todayStr: string;
  refreshKey?: number;
  /** Prefill only — from the existing auto-computed PEP analytics (PEP_META[gapKey]). Fully editable/overridable by the manager. */
  suggestedRecommendation?: string;
  suggestedQuestion?: string;
}

function PepNotesPanel({
  agentFilter,
  todayStr,
  refreshKey = 0,
  suggestedRecommendation = "",
  suggestedQuestion = "",
}: PepNotesPanelProps) {
  const [history, setHistory] = useState<PepNote[]>([]);
  const [historyLoading, setHistoryLoading] = useState(agentFilter !== "all");
  const [historyError, setHistoryError] = useState<string | null>(null);

  const [pepDate, setPepDate] = useState(todayStr);
  const [recommendation, setRecommendation] = useState("");
  const [coachingQuestion, setCoachingQuestion] = useState("");
  const [actionPlan, setActionPlan] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [editingNote, setEditingNote] = useState<PepNote | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<PepNote | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deletedMessage, setDeletedMessage] = useState(false);
  const newDraftRef = useRef({ pepDate: todayStr, recommendation: "", coachingQuestion: "", actionPlan: "" });

  const [historyRetry, setHistoryRetry] = useState(0);
  const historyRequestRef = useRef<AbortController | null>(null);
  const saveContextRef = useRef(0);

  // A late save response belongs to its original selection, even after unmount.
  useEffect(() => {
    return () => { saveContextRef.current += 1; };
  }, [agentFilter, todayStr]);

  // Reset the draft only when the selected agent or Bangkok date changes.
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

    setSaving(false);
    setEditingNote(null);
    setDeleteCandidate(null);
    setDeleting(false);
    setDeleteError(null);
    setDeletedMessage(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentFilter, todayStr]);

  // Refresh history separately so retry or dashboard refresh preserves the draft.
  useEffect(() => {
    historyRequestRef.current?.abort();
    const controller = new AbortController();
    historyRequestRef.current = controller;
    setHistory([]);
    setHistoryError(null);
    setHistoryLoading(agentFilter !== "all");
    if (agentFilter === "all") return () => controller.abort();

    fetch(`/api/pep-notes?agent=${encodeURIComponent(agentFilter)}`, { cache: "no-store", signal: controller.signal })
      .then(async res => {
        const json = await res.json();
        if (!res.ok || !Array.isArray(json.notes)) throw new Error(json.error || "ไม่สามารถโหลดประวัติ PEP ได้");
        if (!controller.signal.aborted) setHistory(json.notes);
      })
      .catch(err => {
        if (!controller.signal.aborted) setHistoryError(err instanceof Error ? err.message : "ไม่สามารถโหลดประวัติ PEP ได้");
      })
      .finally(() => {
        if (!controller.signal.aborted) setHistoryLoading(false);
      });
    return () => controller.abort();
  }, [agentFilter, refreshKey, historyRetry]);

  const handleSave = useCallback(async () => {
    if (agentFilter === "all" || saving || deleting) return;
    const context = saveContextRef.current;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const res = await fetch("/api/pep-notes", {
        method: editingNote ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentName: agentFilter, pepDate, recommendation, coachingQuestion, actionPlan,
          ...(editingNote ? { id: editingNote.id, expectedUpdatedAt: editingNote.updatedAt } : {}) }),
      });
      const json = await res.json();
      if (!res.ok || !json.note) throw new Error(json?.error || "ไม่สามารถบันทึก PEP ได้");
      if (context !== saveContextRef.current) return;
      historyRequestRef.current?.abort();
      setHistoryLoading(false);
      setHistoryError(null);
      setHistory((prev) => [json.note as PepNote, ...prev.filter(note => note.id !== json.note.id)]);
      if (editingNote) setEditingNote(json.note as PepNote);
      setSaveSuccess(true);
      setHistoryRetry(value => value + 1);
    } catch (err) {
      if (context !== saveContextRef.current) return;
      setSaveError(err instanceof Error ? err.message : "ไม่สามารถบันทึก PEP ได้");
    } finally {
      if (context === saveContextRef.current) setSaving(false);
    }
  }, [agentFilter, saving, deleting, editingNote, pepDate, recommendation, coachingQuestion, actionPlan]);

  function startEdit(note: PepNote) {
    if (saving || deleting) return;
    if (!editingNote) newDraftRef.current = { pepDate, recommendation, coachingQuestion, actionPlan };
    setEditingNote(note);
    setPepDate(note.pepDate); setRecommendation(note.recommendation);
    setCoachingQuestion(note.coachingQuestion); setActionPlan(note.actionPlan);
    setSaveSuccess(false); setSaveError(null); setDeleteCandidate(null); setDeleteError(null);
    document.getElementById("pep-note-date")?.focus();
  }

  function finishEdit() {
    const draft = newDraftRef.current;
    setPepDate(draft.pepDate); setRecommendation(draft.recommendation);
    setCoachingQuestion(draft.coachingQuestion); setActionPlan(draft.actionPlan);
    setEditingNote(null); setSaveError(null); setSaveSuccess(false);
  }

  async function handleDelete() {
    if (!deleteCandidate || saving || deleting) return;
    const note = deleteCandidate;
    const context = saveContextRef.current;
    setDeleting(true); setDeleteError(null); setDeletedMessage(false);
    try {
      const res = await fetch("/api/pep-notes", { method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: note.id, agentName: agentFilter, expectedUpdatedAt: note.updatedAt }) });
      const json = await res.json();
      if (!res.ok || json.deleted !== true) throw new Error(json.error || "ไม่สามารถลบ PEP ได้");
      if (context !== saveContextRef.current) return;
      historyRequestRef.current?.abort();
      setHistory(prev => prev.filter(item => item.id !== note.id));
      setHistoryLoading(false); setHistoryError(null);
      if (editingNote?.id === note.id) finishEdit();
      setDeleteCandidate(null); setDeletedMessage(true);
      setHistoryRetry(value => value + 1);
    } catch (err) {
      if (context === saveContextRef.current) setDeleteError(err instanceof Error ? err.message : "ไม่สามารถลบ PEP ได้");
    } finally {
      if (context === saveContextRef.current) setDeleting(false);
    }
  }

  const busy = saving || deleting;

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
      {editingNote && <p role="status">กำลังแก้ไขรายการวันที่ {formatThaiDateLong(editingNote.pepDate)} — บันทึกจะอัปเดตรายการเดิม</p>}

      <div className="dash-pepform-field">
        <label htmlFor="pep-note-date">วันที่ทำ PEP</label>
        <input id="pep-note-date" disabled={busy} type="date" value={pepDate} onChange={(e) => setPepDate(e.target.value)} max={todayStr} />
      </div>

      <div className="dash-pepform-field">
        <label htmlFor="pep-note-recommendation">แนวทาง PEP / เทคนิคที่แนะนำ</label>
        <textarea id="pep-note-recommendation" disabled={busy} value={recommendation} onChange={(e) => setRecommendation(e.target.value)} rows={2} />
      </div>

      <div className="dash-pepform-field">
        <label htmlFor="pep-note-question">คำถามชวนโค้ช</label>
        <textarea id="pep-note-question" disabled={busy} value={coachingQuestion} onChange={(e) => setCoachingQuestion(e.target.value)} rows={2} />
      </div>

      <div className="dash-pepform-field">
        <label htmlFor="pep-note-action">Action Plan</label>
        <textarea id="pep-note-action"
          disabled={busy}
          value={actionPlan}
          onChange={(e) => setActionPlan(e.target.value)}
          rows={2}
          placeholder="ขั้นตอนถัดไปที่ตกลงกับตัวแทน..."
        />
      </div>

      <div className="dash-pepform-actions" style={{ flexWrap: "wrap" }}>
        <button className="dash-save-btn" onClick={handleSave} disabled={busy}>
          {saving ? "กำลังบันทึก..." : editingNote ? "บันทึกการแก้ไข" : "บันทึก PEP"}
        </button>
        {editingNote && <button type="button" className="dash-refresh-btn" disabled={busy} onClick={finishEdit}>กลับไปสร้างรายการใหม่</button>}
        {saveSuccess && <span className="dash-save-success">บันทึกแล้ว</span>}
      </div>

      {saveError && <div className="dash-stale-warning dash-pepform-error" role="alert">ไม่สามารถบันทึก PEP ได้: {saveError}</div>}

      <div className="dash-eyebrow dash-pep-history-eyebrow">ประวัติ PEP</div>
      {deletedMessage && <p role="status" className="dash-save-success">ลบรายการ PEP แล้ว</p>}
      {deleteCandidate && <div className="dash-stale-warning" role="group" aria-label="ยืนยันลบ PEP">
        <p>ลบบันทึกวันที่ {formatThaiDateLong(deleteCandidate.pepDate)} ของ {agentFilter} ใช่หรือไม่? การลบนี้กู้คืนจากหน้านี้ไม่ได้</p>
        {deleteCandidate.actionPlan && <p>Action Plan: {deleteCandidate.actionPlan}</p>}
        <button type="button" className="dash-refresh-btn" disabled={busy} onClick={handleDelete}>{deleting ? "กำลังลบ..." : "ยืนยันลบ"}</button>{" "}
        <button type="button" className="dash-refresh-btn" disabled={busy} onClick={() => { setDeleteCandidate(null); setDeleteError(null); }}>ยกเลิก</button>
        {deleteError && <p role="alert">{deleteError}</p>}
      </div>}

      {historyLoading && <div className="dash-pep-empty" role="status">กำลังโหลดประวัติ...</div>}
      {historyError && <div className="dash-stale-warning" role="alert">
        ไม่สามารถโหลดประวัติ PEP ได้: {historyError}{" "}
        <button type="button" className="dash-refresh-btn" onClick={() => setHistoryRetry(value => value + 1)}>ลองโหลดประวัติใหม่</button>
      </div>}
      {!historyLoading && !historyError && history.length === 0 && (
        <div className="dash-pep-empty">ยังไม่มีประวัติ PEP สำหรับตัวแทนนี้</div>
      )}
      {!historyLoading && !historyError && history.length > 0 && (
        <p style={{ color: "var(--cream-muted)", fontSize: 12 }}>
          บันทึก PEP อัปเดตล่าสุด: {dataTimestampLabel(latestDataTimestamp(history.map(note => note.updatedAt || note.createdAt)))}
        </p>
      )}
      {!historyLoading && !historyError && history.length > 0 && (
        <div className="dash-pep-history-list">
          {history.map((note) => (
            <div key={note.id} className="dash-pep-history-item">
              <div className="dash-pep-history-date">{formatThaiDateLong(note.pepDate)}</div>
              <div className="dash-pepform-actions" style={{ flexWrap: "wrap" }}>
                <button type="button" className="dash-refresh-btn" disabled={busy} onClick={() => startEdit(note)} aria-label={`แก้ไข PEP วันที่ ${formatThaiDateLong(note.pepDate)}`}>แก้ไข</button>
                <button type="button" className="dash-refresh-btn" disabled={busy} onClick={() => { setDeleteCandidate(note); setDeleteError(null); setDeletedMessage(false); }} aria-label={`ลบ PEP วันที่ ${formatThaiDateLong(note.pepDate)}`}>ลบ</button>
              </div>
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
