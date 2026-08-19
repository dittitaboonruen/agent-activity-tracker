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

  sync_status:
    | "active"
    | "deleted";

  deleted_at:
    | string
    | null;
}

interface SyncOptions {
  /*
   * true ได้เฉพาะเมื่อข้อมูล submissions
   * เป็น snapshot ครบทุก submission จาก Jotform
   *
   * ถ้ายังดึงไม่ครบ ห้าม mark deleted
   */
  snapshotComplete?: boolean;
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
   JOTFORM SUBMISSION
   → SUPABASE ROW
========================================================= */

function toActivityRow(
  submission: Submission,
  syncedAt: string
): ActivityRow {
  return {
    jotform_submission_id:
      submission.id,

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
      syncedAt,

    /*
     * ถ้า submission ที่เคย deleted
     * กลับมาอยู่ใน Jotform
     * upsert รอบนี้จะ restore เป็น active
     */
    sync_status:
      "active",

    deleted_at:
      null,
  };
}

/* =========================================================
   UPSERT ACTIVE SUBMISSIONS
========================================================= */

async function upsertActiveSubmissions(
  submissions: Submission[]
): Promise<void> {
  if (
    submissions.length === 0
  ) {
    return;
  }

  const supabase =
    getSupabaseAdmin();

  const syncedAt =
    new Date().toISOString();

  const rows =
    submissions.map(
      (submission) =>
        toActivityRow(
          submission,
          syncedAt
        )
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

/* =========================================================
   MARK MISSING JOTFORM SUBMISSIONS AS DELETED
========================================================= */

async function markMissingAsDeleted(
  submissions: Submission[]
): Promise<void> {
  const supabase =
    getSupabaseAdmin();

  const activeIds =
    new Set(
      submissions.map(
        (submission) =>
          submission.id
      )
    );

  /*
   * ดึงเฉพาะ ID ที่ Supabase
   * เคยมองว่า active อยู่
   */
  const {
    data,
    error: readError,
  } =
    await supabase
      .from(
        "activities"
      )
      .select(
        "jotform_submission_id"
      )
      .eq(
        "sync_status",
        "active"
      );

  if (
    readError
  ) {
    console.error(
      "[activity-sync] Unable to read existing activities:",
      readError.message
    );

    throw new Error(
      "Unable to reconcile activity data."
    );
  }

  const missingIds =
    (
      data ?? []
    )
      .map(
        (row) =>
          String(
            row.jotform_submission_id
          )
      )
      .filter(
        (id) =>
          !activeIds.has(
            id
          )
      );

  if (
    missingIds.length ===
    0
  ) {
    return;
  }

  const deletedAt =
    new Date().toISOString();

  const {
    error:
      deleteError,
  } =
    await supabase
      .from(
        "activities"
      )
      .update({
        sync_status:
          "deleted",

        deleted_at:
          deletedAt,

        synced_at:
          deletedAt,
      })
      .in(
        "jotform_submission_id",
        missingIds
      );

  if (
    deleteError
  ) {
    console.error(
      "[activity-sync] Unable to mark deleted activities:",
      deleteError.message
    );

    throw new Error(
      "Unable to reconcile deleted activity data."
    );
  }
}

/* =========================================================
   MAIN SYNC
========================================================= */

export async function syncActivitiesToSupabase(
  submissions: Submission[],
  options: SyncOptions = {}
): Promise<void> {
  const {
    snapshotComplete =
      false,
  } = options;

  /*
   * 1. รายการที่ Jotform ยังมีอยู่
   *    → insert/update
   *    → active
   *    → deleted_at = null
   */
  await upsertActiveSubmissions(
    submissions
  );

  /*
   * 2. ทำ Soft Delete
   *    เฉพาะตอนยืนยันว่า Jotform snapshot ครบ
   *
   * ตอนนี้ false ไว้ก่อน
   * เพื่อป้องกันข้อมูลถูก mark deleted ผิด
   */
  if (
    snapshotComplete
  ) {
    await markMissingAsDeleted(
      submissions
    );
  }
}
