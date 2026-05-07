// Schema של Shefi & Co.
// קובע ב־code (ולא בקובץ נפרד) כדי שיעבוד גם אחרי compile ל־dist/.

export const schemaSql = `
CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL CHECK (kind IN ('task', 'idea', 'note')),
  title TEXT NOT NULL,
  details TEXT,
  priority TEXT CHECK (priority IN ('P1', 'P2', 'P3', 'P4')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'archived')),
  due_date TEXT,
  source TEXT NOT NULL DEFAULT 'telegram',
  raw_input TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  closed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
CREATE INDEX IF NOT EXISTS idx_items_due_date ON items(due_date);
CREATE INDEX IF NOT EXISTS idx_items_kind ON items(kind);

CREATE TABLE IF NOT EXISTS reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER REFERENCES items(id) ON DELETE CASCADE,
  remind_at TEXT NOT NULL,
  message TEXT,
  sent INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reminders_pending
  ON reminders(remind_at) WHERE sent = 0;

CREATE TABLE IF NOT EXISTS memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER REFERENCES items(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  embedding TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_memories_item ON memories(item_id);

-- v2: Agent activity timeline (live dashboard feed)
CREATE TABLE IF NOT EXISTS agent_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL DEFAULT (datetime('now')),
  agent TEXT NOT NULL,
  kind TEXT NOT NULL,                       -- message | tool_call | tool_result | handoff | system
  content TEXT NOT NULL,
  target_agent TEXT,
  meta TEXT                                 -- JSON
);

CREATE INDEX IF NOT EXISTS idx_agent_events_ts ON agent_events(ts);
CREATE INDEX IF NOT EXISTS idx_agent_events_agent ON agent_events(agent);

-- v2: Dev division backlog
CREATE TABLE IF NOT EXISTS dev_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  spec TEXT,
  status TEXT NOT NULL DEFAULT 'spec' CHECK (status IN ('spec','in_progress','review','merged','rejected','cancelled')),
  assignee TEXT,
  created_by TEXT NOT NULL DEFAULT 'CEO',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_dev_tasks_status ON dev_tasks(status);

-- v2: Code-change proposals (diffs awaiting CEO approval)
CREATE TABLE IF NOT EXISTS proposals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dev_task_id INTEGER REFERENCES dev_tasks(id) ON DELETE CASCADE,
  branch TEXT NOT NULL,
  summary TEXT NOT NULL,
  diff_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('ready','approved','rejected','merged')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);

CREATE TABLE IF NOT EXISTS approvals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  proposal_id INTEGER NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  decision TEXT NOT NULL CHECK (decision IN ('approve','reject','comment')),
  comment TEXT,
  decided_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- v2: specialists' notebook (Shani/Yael/Maya keep records here)
CREATE TABLE IF NOT EXISTS records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent TEXT NOT NULL,                       -- which agent owns it
  category TEXT NOT NULL,                    -- vendor | event | comm | etc.
  title TEXT NOT NULL,
  body TEXT,
  data TEXT,                                 -- JSON for typed fields
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_records_agent ON records(agent);
CREATE INDEX IF NOT EXISTS idx_records_category ON records(category);
CREATE INDEX IF NOT EXISTS idx_records_due_date ON records(due_date);

-- v2.1: Employees roster (synced from Excel + maintained via Telegram)
CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  name_he TEXT,                              -- Hebrew name if known (helps NL matching)
  country TEXT,                              -- Israel | USA | Australia | ...
  type TEXT,                                 -- Employee | Contractor | Employee - Hourly
  email TEXT,
  phone TEXT,
  birthday_md TEXT,                          -- MM-DD (the part that matters for recurring)
  birthday_full TEXT,                        -- YYYY-MM-DD original (for age, etc.)
  amount_ils INTEGER NOT NULL DEFAULT 300,
  channel TEXT NOT NULL DEFAULT 'buyme'      -- buyme | amazon_au | amazon_us | amazon_ca | manual
    CHECK (channel IN ('buyme','amazon_au','amazon_us','amazon_ca','manual')),
  notes TEXT,
  -- v2.2: org-chart fields (synced from Dragontail org chart)
  position TEXT,
  department TEXT,
  org_chart_id TEXT,                         -- the original org-chart id (string)
  manager_org_id TEXT,                       -- the org-chart id of the manager
  level INTEGER,                             -- org-chart level (1=GM, 2=direct reports, etc.)
  location TEXT,                             -- Tel Aviv / Haifa / Remote / New York / London / ...
  active INTEGER NOT NULL DEFAULT 1,
  departed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_employees_name ON employees(name);
CREATE INDEX IF NOT EXISTS idx_employees_active ON employees(active);
CREATE INDEX IF NOT EXISTS idx_employees_birthday ON employees(birthday_md);

-- v2.1: Monthly birthday gift orders (one row per employee per month)
CREATE TABLE IF NOT EXISTS birthday_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  month TEXT NOT NULL,                       -- YYYY-MM (the month we're ordering for)
  send_date TEXT NOT NULL,                   -- YYYY-MM-DD (calendar-year birthday date)
  channel TEXT NOT NULL,                     -- buyme | amazon_au | amazon_us | amazon_ca | manual
  amount_ils INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','sent','skipped','failed')),
  approved_at TEXT,
  sent_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (employee_id, month)
);

CREATE INDEX IF NOT EXISTS idx_birthday_orders_month ON birthday_orders(month);
CREATE INDEX IF NOT EXISTS idx_birthday_orders_status ON birthday_orders(status);
`;
