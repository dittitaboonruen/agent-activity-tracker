import type { Submission } from "@/types";

/** Safe, scoped roster returned by /api/dashboard-agents. */
export interface DashboardAgent {
  id: number;
  agentName: string;
  agentCode: string | null;
  jotformAgentName: string | null;
}

function identity(value: string) {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("th-TH");
}

export function dashboardAgentNames(agents: DashboardAgent[]): string[] {
  return Array.from(new Set(agents.map(agent => agent.agentName).filter(name => name.trim())))
    .sort((a, b) => a.localeCompare(b, "th"));
}

/** Match only unique registered names/aliases; keep unmatched activity in totals. */
export function matchDashboardActivities(
  submissions: Submission[], agents: DashboardAgent[]
): Submission[] {
  const names = new Map<string, Set<string>>();
  for (const agent of agents) {
    if (!agent.agentName.trim()) continue;
    for (const value of [agent.agentName, agent.jotformAgentName]) {
      if (!value?.trim()) continue;
      const key = identity(value);
      const matches = names.get(key) ?? new Set<string>();
      matches.add(agent.agentName);
      names.set(key, matches);
    }
  }
  return submissions.map(submission => {
    const matches = names.get(identity(submission.agent));
    if (matches?.size !== 1) return submission;
    const agent = matches.values().next().value as string;
    return agent === submission.agent ? submission : { ...submission, agent };
  });
}

/** PEP history was saved using the Jotform name before the roster switch. */
export function dashboardPepName(agentName: string, agents: DashboardAgent[]): string {
  if (agentName === "all") return "all";
  return agents.find(agent => agent.agentName === agentName)?.jotformAgentName || agentName;
}
