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

  agent_id:
    | number
    | null;

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

interface AgentMasterRow {
  id: number;

  agent_name:
    | string
    | null;

  agent_nickname:
    | string
    | null;

  active:
    | boolean
    | null;
}

interface SyncOptions {
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
   NORMALIZE AGENT NAME
========================================================= */

function normalizeAgentKey(
  value:
    | string
    | null
    | undefined
): string {
  return (
    value ?? ""
  )
    .trim()
    .toLowerCase()
    .replace(
      /\s+/g,
      " "
    );
}

/* =========================================================
   LOAD AGENT MASTER
========================================================= */

async function loadAgentMaster(): Promise<
  AgentMasterRow[]
> {
  const supabase =
    getSupabaseAdmin();

  const {
    data,
    error,
  } =
    await supabase
      .from(
        "agent_master"
      )
      .select(
        "id, agent_name, agent_nickname, active"
      )
      .eq(
        "active",
        true
      );

  if (
    error
  ) {
    console.error(
      "[activity-sync] Unable to load agent_master:",
      error.message
    );

    throw new Error(
      "Unable to load agent master data."
    );
  }

  return (
    data ?? []
  ) as AgentMasterRow[];
}

/* =========================================================
   BUILD AGENT LOOKUP

   รองรับการ match ด้วย:
   - agent_name
   - agent_nickname

   ถ้าชื่อ/ชื่อเล่นซ้ำหลายคน
   จะไม่เดา agent_id ให้
========================================================= */

function buildAgentLookup(
  agents: AgentMasterRow[]
): Map<
  string,
  number | null
> {
  const lookup =
    new Map<
      string,
      number | null
    >();

  function addKey(
    key: string,
    agentId: number
  ) {
    if (
      !key
    ) {
      return;
    }

    if (
      !lookup.has(
        key
      )
    ) {
      lookup.set(
        key,
        agentId
      );

      return;
    }

    const existing =
      lookup.get(
        key
      );

    if (
      existing !==
      agentId
    ) {
      /*
       * มีชื่อเดียวกันมากกว่า 1 คน
       * ไม่เลือกให้เอง
       */
      lookup.set(
        key,
        null
      );
    }
  }

  for (
    const agent
    of agents
  ) {
    const nameKey =
      normalizeAgentKey(
        agent.agent_name
      );

    const nicknameKey =
      normalizeAgentKey(
        agent.agent_nickname
      );

    addKey(
      nameKey,
      agent.id
    );

    addKey(
      nicknameKey,
      agent.id
    );
  }

  return lookup;
}

/* =========================================================
   FIND AGENT ID
========================================================= */

function findAgentId(
  agentName: string,
  lookup: Map<
    string,
    number | null
  >
): number | null {
  const key =
    normalizeAgentKey(
      agentName
    );

  if (
    !key
  ) {
    return null;
  }

  const result =
    lookup.get(
      key
    );

  return (
    typeof result ===
      "number"
      ? result
      : null
  );
}

/* =========================================================
   JOTFORM SUBMISSION
   → SUPABASE ROW
========================================================= */

function toActivityRow(
  submission: Submission,
  syncedAt: string,
  agentLookup: Map<
    string,
    number | null
  >
): ActivityRow {
  const agentId =
    findAgentId(
      submission.agent,
      agentLookup
    );

  return {
    jotform_submission_id:
      submission.id,

    agent_id:
      agentId,

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
     * ถ้ารายการเคยถูก Soft Delete
     * แล้วกลับมาอยู่ใน Jotform
     * จะ restore เป็น active
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
    submissions.length ===
    0
  ) {
    return;
  }

  const supabase =
    getSupabaseAdmin();

  /*
   * โหลด Agent Master ก่อน
   */
  const agents =
    await loadAgentMaster();

  const agentLookup =
    buildAgentLookup(
      agents
    );

  const syncedAt =
    new Date().toISOString();

  const rows =
    submissions.map(
      (submission) =>
        toActivityRow(
          submission,
          syncedAt,
          agentLookup
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
   * STEP 1
   *
   * Jotform
   * → หา agent_master.id
   * → upsert activities
   */
  await upsertActiveSubmissions(
    submissions
  );

  /*
   * STEP 2
   *
   * submission ที่หายจาก
   * Jotform snapshot ทั้งหมด
   * → Soft Delete
   */
  if (
    snapshotComplete
  ) {
    await markMissingAsDeleted(
      submissions
    );
  }
}
