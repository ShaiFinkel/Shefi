// רישום מרכזי של כל הסוכנים בחברה — שם תצוגה, חטיבה, ותיאור.

export type Division = "ops" | "dev" | "knowledge";

export interface AgentInfo {
  key: string;
  display: string;
  role: string;
  division: Division;
}

export const AGENTS: AgentInfo[] = [
  // Ops
  { key: "Shefi", display: "שפי", role: "Chief of Staff", division: "ops" },
  { key: "Tova", display: "טובה", role: "מנהלת משימות", division: "ops" },
  { key: "Mira", display: "מירה", role: "מזכירה", division: "ops" },
  { key: "Aya", display: "איה", role: "ארכיונאית", division: "ops" },
  { key: "Shani", display: "שני", role: "ספקים", division: "ops" },
  { key: "Yael", display: "יעל", role: "אירועים", division: "ops" },
  { key: "Maya", display: "מאיה", role: "תקשורת פנימית", division: "ops" },
  // Dev
  { key: "Noam", display: "נועם", role: "Product Manager", division: "dev" },
  { key: "Daniel", display: "דניאל", role: "Developer", division: "dev" },
  { key: "Kosem", display: "קוסם", role: "QA", division: "dev" },
  { key: "Liya", display: "ליה", role: "Designer", division: "dev" },
  { key: "Uri", display: "אורי", role: "DevOps", division: "dev" },
  { key: "Rotem", display: "רותם", role: "Tech Writer", division: "dev" },
  // Knowledge
  { key: "Ofir", display: "אופיר", role: "חוקר", division: "knowledge" },
  { key: "Aviv", display: "אביב", role: "אנליסט נתונים", division: "knowledge" },
];

export function lookupAgent(key: string): AgentInfo | undefined {
  return AGENTS.find((a) => a.key === key);
}
