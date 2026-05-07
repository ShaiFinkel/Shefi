import type { AgentInfo, Division } from "./types";

export function divisionColor(d: Division | string): string {
  if (d === "ops") return "#3aa6ff";
  if (d === "dev") return "#ff7c5c";
  if (d === "knowledge") return "#5cd6a8";
  return "#7c5cff";
}

export function divisionLabel(d: Division): string {
  if (d === "ops") return "תפעול";
  if (d === "dev") return "פיתוח";
  return "ידע";
}

export function agentColor(agent: string, agents: AgentInfo[]): string {
  if (agent === "CEO") return "#ffc857";
  if (agent === "system") return "#a3aab8";
  const a = agents.find((x) => x.key === agent);
  return a ? divisionColor(a.division) : "#7c5cff";
}

export function agentDisplay(agent: string, agents: AgentInfo[]): string {
  if (agent === "CEO") return "את (CEO)";
  if (agent === "system") return "מערכת";
  return agents.find((x) => x.key === agent)?.display ?? agent;
}

export function timeAgo(iso: string): string {
  const t = new Date(iso + "Z").getTime();
  const diff = Date.now() - t;
  if (diff < 60_000) return "עכשיו";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}ד׳`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}ש׳`;
  return new Date(t).toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
