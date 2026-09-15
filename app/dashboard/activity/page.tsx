import Dashboard from "@/components/Dashboard";
import PageTopBar from "@/components/PageTopBar";

import {
  fetchJotformSubmissions,
} from "@/lib/jotform";

import {
  filterSubmissionsForAccess,
  getDashboardAccess,
} from "@/lib/dashboard-access";

import type {
  JotformApiResponse,
} from "@/types";

export const dynamic =
  "force-dynamic";

export const revalidate = 0;

async function getInitialData():
  Promise<JotformApiResponse | null> {
  try {
    const access =
      await getDashboardAccess();

    const {
      submissions,
      fetchedAtUTC,
    } =
      await fetchJotformSubmissions();

    return {
      submissions:
        filterSubmissionsForAccess(
          submissions,
          access
        ),

      fetchedAtUTC,
    };
  } catch (error) {
    console.error(
      "[activity-dashboard] initial data error:",
      error
    );

    return null;
  }
}

export default async function ActivityDashboardPage() {
  const initialData =
    await getInitialData();

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg)",
        padding: "18px 20px 0",
      }}
    >
      <PageTopBar />

      <Dashboard
        initialData={initialData}
      />
    </div>
  );
}
