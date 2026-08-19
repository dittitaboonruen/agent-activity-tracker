import "server-only";

import {
  createClient,
} from "@supabase/supabase-js";

import type {
  Submission,
} from "@/types";

/* =========================================================
   TYPES
========================================================= */

interface ActivityRow {
  jotform_submission_id: string;

  agent_id: number | null;

  agent_name: string;

  customer: string;

  source: string;

  channel: string;

  money_map: string;

  activities: string[];

  created_at_jotform:
    | string
    | null;

  synced_at: string;
}

/* =========================================================
   SUPABASE SERVER CLIENT
========================================================= */

function getSupabaseAdmin() {
  const supabaseUrl =
    process.env
      .SUPABASE_URL;

  const supabaseSecretKey =
    process.env
      .SUPABASE_SECRET_KEY;

  if (
    !supabaseUrl ||
    !supabaseSecretKey
  ) {
    throw new Error(
      "Supabase server configuration is missing."
    );
  }

  return createClient(
    supabaseUrl,
    supabaseSecretKey,
    {
      auth: {
        persistSession:
          false,

        autoRefreshToken:
          false,
      },
    }
  );
}

/* =========================================================
   CONVERT JOTFORM SUBMISSION
   → SUPABASE ACTIVITY ROW
========================================================= */

function toActivityRow(
  submission: Submission
): ActivityRow {
  return {
    jotform_submission_id:
      submission.id,

    // ตอนนี้ยังไม่บังคับ map agent_id
    // จะเชื่อมกับ agent_master ภายหลัง
    agent_id:
      null,

    agent_name:
      submission.agent,

    customer:
      submission.customer,

    source:
      submission.source,

    channel:
      submission.channel,

    money_map:
      submission.moneyMap,

    activities:
      submission.activities,

    created_at_jotform:
      submission.createdAtUTC ||
      null,

    synced_at:
      new Date().toISOString(),
  };
}

/* =========================================================
   SYNC JOTFORM
   → SUPABASE ACTIVITIES
========================================================= */

export async function syncActivitiesToSupabase(
  submissions: Submission[]
): Promise<void> {
  if (
    submissions.length ===
    0
  ) {
    return;
  }

  const supabase =
    getSupabaseAdmin();

  const rows =
    submissions.map(
      toActivityRow
    );

  const {
    error,
  } =
    await supabase
      .from(
        "activities"
      )
      .upsert(
        rows,
        {
          onConflict:
            "jotform_submission_id",
        }
      );

  if (
    error
  ) {
    console.error(
      "[activity-sync] Supabase upsert failed:",
      error.message
    );

    throw new Error(
      "Unable to sync activity data."
    );
  }
}
