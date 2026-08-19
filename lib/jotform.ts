import "server-only";

import type {
  Submission,
} from "@/types";

import {
  syncActivitiesToSupabase,
} from "@/lib/activity-sync";

/* =========================================================
   JOTFORM FIELD MAPPING
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
   CONFIG
========================================================= */

const CREATED_AT_IS_UTC =
  true;

const JOTFORM_PAGE_SIZE =
  1000;

const CACHE_TTL_MS =
  25_000;

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

interface JotformApiPage {
  content?:
    JotformRawSubmission[];
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
   DATE
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
   FETCH ONE JOTFORM PAGE
========================================================= */

async function fetchJotformPage(
  apiKey: string,
  formId: string,
  offset: number
): Promise<JotformRawSubmission[]> {
  const url =
    `https://api.jotform.com/form/${encodeURIComponent(
      formId
    )}/submissions?apiKey=${encodeURIComponent(
      apiKey
    )}&limit=${JOTFORM_PAGE_SIZE}&offset=${offset}&orderby=id`;

  let res: Response;

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
      "[jotform] network error contacting upstream API:",
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

  let json:
    JotformApiPage;

  try {
    json =
      await res.json();
  } catch (
    parseErr
  ) {
    console.error(
      "[jotform] failed to parse upstream response:",
      parseErr
    );

    throw new JotformUpstreamError(
      502,
      "The upstream data provider returned an unexpected response."
    );
  }

  return (
    json.content ??
    []
  );
}

/* =========================================================
   FETCH ALL JOTFORM SUBMISSIONS
========================================================= */

async function fetchAllJotformSubmissions(
  apiKey: string,
  formId: string
): Promise<JotformRawSubmission[]> {
  const all:
    JotformRawSubmission[] =
      [];

  let offset =
    0;

  while (
    true
  ) {
    const page =
      await fetchJotformPage(
        apiKey,
        formId,
        offset
      );

    all.push(
      ...page
    );

    /*
     * ถ้า page นี้มีน้อยกว่า 1000
     * แปลว่าเราอยู่หน้าสุดท้ายแล้ว
     */
    if (
      page.length <
      JOTFORM_PAGE_SIZE
    ) {
      break;
    }

    offset +=
      JOTFORM_PAGE_SIZE;
  }

  return all;
}

/* =========================================================
   MAIN FETCH
========================================================= */

export async function fetchJotformSubmissions(
  options: FetchJotformOptions = {}
): Promise<FetchJotformResult> {
  const {
    force = false,
  } = options;

  /* =======================================================
     CACHE
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
     ENV
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
      "[jotform] missing JOTFORM_API_KEY and/or JOTFORM_FORM_ID."
    );

    throw new JotformConfigError(
      "Jotform integration is not configured."
    );
  }

  /* =======================================================
     FETCH COMPLETE SNAPSHOT
  ======================================================= */

  const rawSubmissions =
    await fetchAllJotformSubmissions(
      apiKey,
      formId
    );

  const submissions =
    normalizeSubmissions(
      rawSubmissions
    );

  /* =======================================================
     SYNC JOTFORM → SUPABASE

     snapshotComplete = true
     เพราะดึง pagination จนครบแล้ว
  ======================================================= */

  try {
    await syncActivitiesToSupabase(
      submissions,
      {
        snapshotComplete:
          true,
      }
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
     RESPONSE
  ======================================================= */

  const data = {
    submissions,

    fetchedAtUTC:
      new Date().toISOString(),
  };

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
