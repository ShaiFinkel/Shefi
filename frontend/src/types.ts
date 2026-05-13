export type AgentEventKind =
  | "message"
  | "tool_call"
  | "tool_result"
  | "handoff"
  | "system";

export interface AgentEvent {
  id: number;
  ts: string;
  agent: string;
  kind: AgentEventKind;
  content: string;
  target_agent: string | null;
  meta: Record<string, unknown> | null;
}

export type Division = "ops" | "dev" | "knowledge";

export interface AgentInfo {
  key: string;
  display: string;
  role: string;
  division: Division;
}

export interface DevTask {
  id: number;
  title: string;
  spec: string | null;
  status: string;
  assignee: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Proposal {
  id: number;
  dev_task_id: number | null;
  branch: string;
  summary: string;
  diff_text: string;
  status: "ready" | "approved" | "rejected" | "merged";
  created_at: string;
}

export type Channel = "buyme" | "amazon_au" | "amazon_us" | "amazon_ca" | "manual";

export interface Employee {
  id: number;
  name: string;
  name_he: string | null;
  country: string | null;
  type: string | null;
  email: string | null;
  phone: string | null;
  birthday_md: string | null;
  birthday_full: string | null;
  amount_ils: number;
  channel: Channel;
  notes: string | null;
  position: string | null;
  department: string | null;
  org_chart_id: string | null;
  manager_org_id: string | null;
  level: number | null;
  location: string | null;
  hire_date: string | null;
  person_number: string | null;
  tech_title: string | null;
  address: string | null;
  grade_level: string | null;
  gender: string | null;
  manager_name: string | null;
  salary_monthly: number | null;
  salary_yearly: number | null;
  currency: string | null;
  active: number;
  departed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type OrderStatus = "pending" | "approved" | "sent" | "skipped" | "failed";

export interface BirthdayOrderRow {
  id: number;
  employee_id: number;
  month: string;
  send_date: string;
  channel: Channel;
  amount_ils: number;
  status: OrderStatus;
  approved_at: string | null;
  sent_at: string | null;
  notes: string | null;
  created_at: string;
  employee_name: string;
  employee_country: string | null;
  employee_email: string | null;
  employee_phone: string | null;
}

export interface BirthdayMonthData {
  month: string;
  employees: Employee[];
  orders: BirthdayOrderRow[];
  preview_text: string;
}

export interface DashboardSummary {
  today: string;
  month: string;
  tasks: { open: number; due_today: number; overdue: number };
  reminders: { pending: number };
  employees: { active: number; eligible: number; birthdays_this_month: number };
  birthdays: { pending_orders: number; approved_orders: number };
  dev: { open_tasks: number; ready_proposals: number };
  vendors: { active: number };
  events: { active: number };
  memories: number;
  equipment: {
    awaiting_manager: number;
    awaiting_exec: number;
    approved: number;
    ordered: number;
  };
}

export type EquipmentCategory =
  | "laptop"
  | "monitor"
  | "chair"
  | "accessory"
  | "software"
  | "phone"
  | "other";

export type EquipmentRequestStatus =
  | "pending"
  | "manager_approved"
  | "exec_approved"
  | "ordered"
  | "received"
  | "rejected";

export interface CatalogItem {
  id: number;
  name: string;
  category: EquipmentCategory;
  description: string | null;
  vendor: string | null;
  price: number | null;
  currency: string;
  image_url: string | null;
  active: number;
  created_at: string;
  updated_at: string;
}

export type DeliveryTo = "office" | "home";

export interface EquipmentRequest {
  id: number;
  employee_id: number;
  catalog_id: number | null;
  custom_name: string | null;
  quantity: number;
  justification: string | null;
  status: EquipmentRequestStatus;
  manager_decision_by: string | null;
  manager_decision_at: string | null;
  exec_decision_by: string | null;
  exec_decision_at: string | null;
  quote_url: string | null;
  rejected_reason: string | null;
  ordered_at: string | null;
  received_at: string | null;
  delivery_to: DeliveryTo | null;
  delivery_address: string | null;
  manager_employee_id: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // enriched fields from API
  employee_name: string;
  employee_department: string | null;
  employee_manager_name: string | null;
  employee_home_address: string | null;
  catalog_name: string | null;
  catalog_category: EquipmentCategory | null;
  catalog_price: number | null;
  catalog_currency: string | null;
  display_name: string;
}

export interface TaskItem {
  id: number;
  kind: "task" | "idea" | "note";
  title: string;
  details: string | null;
  priority: "P1" | "P2" | "P3" | "P4" | null;
  status: "open" | "done" | "archived";
  due_date: string | null;
  source: string;
  created_at: string;
  updated_at: string;
}
