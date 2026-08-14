import "server-only";
import { getSupabaseClient, SupabaseQueryError } from "./supabase";
import type { PepNote, PepNoteInput } from "@/types";

const TABLE = "pep_notes";
const COLUMNS = "id, agent_name, pep_date, recommendation, coaching_question, action_plan, created_at, updated_at";

interface PepNoteRow {
  id: number;
  agent_name: string;
  pep_date: string;
  recommendation: string | null;
  coaching_question: string | null;
  action_plan: string | null;
  created_at: string;
  updated_at: string;
}

function mapRow(row: PepNoteRow): PepNote {
  return {
    id: row.id,
    agentName: row.agent_name,
    pepDate: row.pep_date,
    recommendation: row.recommendation ?? "",
    coachingQuestion: row.coaching_question ?? "",
    actionPlan: row.action_plan ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Returns every PEP note for one agent, most recent PEP date first. Full
 * error detail is logged server-side only (console.error); callers only ever
 * see a generic, sanitized SupabaseQueryError — same pattern as
 * lib/jotform.ts's JotformUpstreamError.
 */
export async function listPepNotesForAgent(agentName: string): Promise<PepNote[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select(COLUMNS)
    .eq("agent_name", agentName)
    .order("pep_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[supabase] listPepNotesForAgent failed:", error);
    throw new SupabaseQueryError("Unable to load PEP notes.");
  }

  return ((data ?? []) as unknown as PepNoteRow[]).map(mapRow);
}

/**
 * Inserts one new PEP note row. Each "บันทึก PEP" click creates a new history
 * entry — this is an append-only log, not an edit-in-place record.
 * `created_at`/`updated_at` are left for the database's own defaults to set.
 */
export async function createPepNote(input: PepNoteInput): Promise<PepNote> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      agent_name: input.agentName,
      pep_date: input.pepDate,
      recommendation: input.recommendation,
      coaching_question: input.coachingQuestion,
      action_plan: input.actionPlan,
    })
    .select(COLUMNS)
    .single();

  if (error || !data) {
    console.error("[supabase] createPepNote failed:", error);
    throw new SupabaseQueryError("Unable to save the PEP note.");
  }

  return mapRow(data as unknown as PepNoteRow);
}
