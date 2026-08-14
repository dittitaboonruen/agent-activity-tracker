import Dashboard from "@/components/Dashboard";
import PageTopBar from "@/components/PageTopBar";

import {
  fetchJotformSubmissions,
} from "@/lib/jotform";

import type {
  JotformApiResponse,
} from "@/types";

export const dynamic =
  "force-dynamic";

async function getInitialData(): Promise<
  JotformApiResponse | null
> {
  try {
    const {
      submissions,
      fetchedAtUTC,
    } =
      await fetchJotformSubmissions();

    return {
      submissions,
      fetchedAtUTC,
    };
  } catch {
    return null;
  }
}

export default async function ActivityDashboardPage() {
  const initialData =
    await getInitialData();

  return (
    <div
      style={{
        minHeight:
          "100vh",

        background:
          "var(--bg)",

        padding:
          "18px 20px 0",
      }}
    >
      <PageTopBar />

      <Dashboard
        initialData={
          initialData
        }
      />
    </div>
  );
}
