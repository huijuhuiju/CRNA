PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  employee_no TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  account_name TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('staff', 'director', 'admin')),
  employed_on DATE NOT NULL,
  probation_passed INTEGER NOT NULL DEFAULT 0 CHECK (probation_passed IN (0, 1)),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS leave_applications (
  id TEXT PRIMARY KEY,
  applicant_id TEXT NOT NULL REFERENCES users(id),
  submitted_by_id TEXT NOT NULL REFERENCES users(id),
  plan_code TEXT NOT NULL CHECK (plan_code IN ('one', 'two')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  requested_days INTEGER NOT NULL CHECK (requested_days > 0),
  status TEXT NOT NULL CHECK (status IN ('pending', 'lottery', 'approved', 'rejected', 'cancelled')),
  submitted_at TEXT NOT NULL,
  approved_at TEXT,
  approved_by_id TEXT REFERENCES users(id),
  note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (end_date >= start_date)
);

CREATE TABLE IF NOT EXISTS application_status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id TEXT NOT NULL REFERENCES leave_applications(id),
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by_id TEXT NOT NULL REFERENCES users(id),
  changed_at TEXT NOT NULL,
  reason TEXT
);

CREATE TABLE IF NOT EXISTS course_schedule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  source_file_name TEXT,
  uploaded_by_id TEXT REFERENCES users(id),
  uploaded_at TEXT NOT NULL,
  CHECK (end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_leave_applications_applicant_dates
  ON leave_applications(applicant_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_leave_applications_status
  ON leave_applications(status);
