import Dashboard from "@/components/Dashboard";
import HomeButton from "@/components/HomeButton";
import { fetchJotformSubmissions } from "@/lib/jotform";
import type { JotformApiResponse } from "@/types";

export const dynamic = "force-dynamic";

async function getInitialData(): Promise<JotformApiResponse | null> {
  try {
    const { submissions, fetchedAtUTC } =
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
  const initialData = await getInitialData();

  return (
    <>
      <div
        style={{
          background: "#0D0B08",
          padding: "18px 24px 0",
        }}
      >
        <HomeButton />
      </div>

      <Dashboard initialData={initialData} />
    </>
  );
}
