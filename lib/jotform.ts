import "server-only";

import type {
  Submission,
} from "@/types";

import {
  syncActivitiesToSupabase,
} from "@/lib/activity-sync";

/* =========================================================
   JOTFORM FIELD MAPPING

   ใช้ keyword จากข้อความคำถาม
   แทนการล็อก Question ID
========================================================= */

const FIELD_KEYWORDS = {
  customer: [
    "ชื่อลูกค้า",
  ],

  source: [
    "แหล่งที่มา",
  ],

  channel: [
    "ช่องทาง",
  ],

  moneyMap: [
    "money map",
  ],

  agent: [
    "ชื่อตัวแทน",
  ],

  activities: [
    "ขั้นตอนไหนของกระบวนการขาย",
    "กระบวนการขาย",
    "กิจกรรมหลัก",
  ],
} as const;

/* =========================================================
   TIMEZONE
========================================================= */

const CREATED_AT_IS_UTC =
  true;

/* =========================================================
   RAW TYPES
========================================================= */

interface JotformRawAnswer {
  name?: string;
  text?: string;
  type?: string;

  answer?:
    | string
    | string[];
}

interface JotformRawSubmission {
  id: string;

  created_at: string;

  answers?: Record<
    string,
    JotformRawAnswer
  >;
}

/* =========================================================
   FIND ANSWER
========================================================= */

function findAnswer(
  answers: Record<
    string,
    JotformRawAnswer
  >,
  keywords:
    readonly string[]
): JotformRawAnswer | undefined {
  return Object.values(
    answers
  ).find((answer) => {
    if (
      typeof answer?.text !==
      "string"
    ) {
      return false;
    }

    const questionText =
      answer.text
        .toLowerCase()
        .trim();

    return keywords.some(
      (keyword) =>
        questionText.includes(
          keyword
            .toLowerCase()
            .trim()
        )
    );
  });
}

/* =========================================================
   ANSWER NORMALIZATION
========================================================= */

function toStringAnswer(
  answer:
    | string
    | string[]
    | undefined
): string {
  if (
    Array.isArray(
      answer
    )
  ) {
    return answer.join(
      " "
    );
  }

  return (
    answer ?? ""
  );
}

function toActivitiesArray(
  answer:
    | string
    | string[]
    | undefined
): string[] {
  if (
    Array.isArray(
      answer
    )
  ) {
    return answer
      .map((item) =>
        item.trim()
      )
      .filter(Boolean);
  }

  if (
    typeof answer ===
      "string" &&
    answer.trim().length >
      0
  ) {
    return answer
      .split(
        /\s{2,}|,\s*/
      )
      .map((item) =>
        item.trim()
      )
      .filter(Boolean);
  }

  return [];
}

/* =========================================================
   CREATED DATE → ISO
========================================================= */

function toUtcIso(
  createdAt: string
): string {
  const isoLike =
    createdAt.replace(
      " ",
      "T"
    );

  return CREATED_AT_IS_UTC
    ? `${isoLike}Z`
    : isoLike;
}

/* =========================================================
   NORMALIZE SUBMISSIONS
========================================================= */

export function normalizeSubmissions(
  raw: JotformRawSubmission[]
): Submission[] {
  return raw
    .map(
      (
        sub
      ): Submission => {
        const answers =
          sub.answers ?? {};

        const customerA =
          findAnswer(
            answers,
            FIELD_KEYWORDS.customer
          );

        const sourceA =
          findAnswer(
            answers,
            FIELD_KEYWORDS.source
          );

        const channelA =
          findAnswer(
            answers,
            FIELD_KEYWORDS.channel
          );

        const moneyMapA =
          findAnswer(
            answers,
            FIELD_KEYWORDS.moneyMap
          );

        const agentA =
          findAnswer(
            answers,
            FIELD_KEYWORDS.agent
          );

        const activitiesA =
          findAnswer(
            answers,
            FIELD_KEYWORDS.activities
          );

        return {
          id:
            String(
              sub.id
            ),

          customer:
            toStringAnswer(
              customerA?.answer
            ),

          source:
            toStringAnswer(
              sourceA?.answer
            ),

          channel:
            toStringAnswer(
              channelA?.answer
            ),

          moneyMap:
            toStringAnswer(
              moneyMapA?.answer
            ),

          agent:
            toStringAnswer(
              agentA?.answer
            ),

          activities:
            toActivitiesArray(
              activitiesA?.answer
            ),

          createdAtUTC:
            toUtcIso(
              sub.created_at
            ),
        };
      }
    )
    .filter(
      (submission) =>
        submission.agent ||
        submission.customer
    );
}

/* =========================================================
   FETCH RESULT
========================================================= */

export interface FetchJotformResult {
  submissions:
    Submission[];

  fetchedAtUTC:
    string;

  cacheHit:
    boolean;
}

export interface FetchJotformOptions {
  force?: boolean;
}

/* =========================================================
   ERRORS
========================================================= */

export class JotformConfigError extends Error {}

export class JotformUpstreamError extends Error {
  status: number;

  constructor(
    status: number,
    message: string
  ) {
    super(message);

    this.status =
      status;
  }
}

/* =========================================================
   CACHE
========================================================= */

const CACHE_TTL_MS =
  25_000;

interface CacheEntry {
  data: Omit<
    FetchJotformResult,
    "cacheHit"
  >;

  expiresAt: number;
}

let cache:
  | CacheEntry
  | null = null;

/* =========================================================
   FETCH JOTFORM
========================================================= */

export async function fetchJotformSubmissions(
  options: FetchJotformOptions = {}
): Promise<FetchJotformResult> {
  const {
    force = false,
  } = options;

  /* =======================================================
     RETURN CACHE
  ======================================================= */

  if (
    !force &&
    cache &&
    Date.now() <
      cache.expiresAt
  ) {
    return {
      ...cache.data,
      cacheHit: true,
    };
  }

  /* =======================================================
     ENVIRONMENT VARIABLES
  ======================================================= */

  const apiKey =
    process.env
      .JOTFORM_API_KEY;

  const formId =
    process.env
      .JOTFORM_FORM_ID;

  if (
    !apiKey ||
    !formId
  ) {
    console.error(
      "[jotform] missing JOTFORM_API_KEY and/or JOTFORM_FORM_ID environment variables."
    );

    throw new JotformConfigError(
      "Jotform integration is not configured."
    );
  }

  /* =======================================================
     JOTFORM URL
  ======================================================= */

  const url =
    `https://api.jotform.com/form/${encodeURIComponent(
      formId
    )}/submissions?apiKey=${encodeURIComponent(
      apiKey
    )}&limit=1000&orderby=created_at`;

  let res: Response;

  /* =======================================================
     FETCH JOTFORM
  ======================================================= */

  try {
    res =
      await fetch(
        url,
        {
          cache:
            "no-store",
        }
      );
  } catch (
    networkErr
  ) {
    console.error(
      "[jotform] network error contacting the upstream API:",
      networkErr
    );

    throw new JotformUpstreamError(
      502,
      "Unable to reach the upstream data provider."
    );
  }

  if (
    !res.ok
  ) {
    const body =
      await res
        .text()
        .catch(
          () => ""
        );

    console.error(
      `[jotform] upstream API returned ${res.status}:`,
      body
    );

    throw new JotformUpstreamError(
      res.status,
      "The upstream data provider returned an error."
    );
  }

  /* =======================================================
     PARSE JSON
  ======================================================= */

  let json: unknown;

  try {
    json =
      await res.json();
  } catch (
    parseErr
  ) {
    console.error(
      "[jotform] failed to parse upstream response as JSON:",
      parseErr
    );

    throw new JotformUpstreamError(
      502,
      "The upstream data provider returned an unexpected response."
    );
  }

  /* =======================================================
     NORMALIZE JOTFORM DATA
  ======================================================= */

  const rawSubmissions:
    JotformRawSubmission[] =
      (
        json as {
          content?:
            JotformRawSubmission[];
        }
      )?.content ?? [];

  const submissions =
    normalizeSubmissions(
      rawSubmissions
    );

  /* =======================================================
     SYNC JOTFORM → SUPABASE

     ถ้า Supabase sync มีปัญหา
     Dashboard ยังทำงานต่อจาก Jotform ได้
  ======================================================= */

  try {
    await syncActivitiesToSupabase(
      submissions
    );
  } catch (
    syncError
  ) {
    console.error(
      "[jotform] activity sync failed:",
      syncError
    );
  }

  /* =======================================================
     BUILD RESPONSE
  ======================================================= */

  const data = {
    submissions,

    fetchedAtUTC:
      new Date().toISOString(),
  };

  /* =======================================================
     UPDATE CACHE
  ======================================================= */

  cache = {
    data,

    expiresAt:
      Date.now() +
      CACHE_TTL_MS,
  };

  return {
    ...data,
    cacheHit: false,
  };
}
