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
`;
