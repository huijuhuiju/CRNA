"""Export the SQLite seed data as a Firebase-safe JSON payload."""
import json
import sqlite3
from pathlib import Path

root = Path(__file__).parent.parent
db = sqlite3.connect(root / "database" / "long_leave.db")
db.row_factory = sqlite3.Row
users = [dict(row) for row in db.execute("""
    SELECT id AS legacyId, employee_no AS employeeNo, display_name AS displayName,
           account_name AS accountName, role, employed_on AS employedOn,
           probation_passed AS probationPassed, is_active AS isActive
    FROM users WHERE is_active = 1 ORDER BY employee_no
""")]
applications = [dict(row) for row in db.execute("""
    SELECT id AS legacyId, applicant_id AS applicantLegacyId,
           submitted_by_id AS submittedByLegacyId, plan_code AS planCode,
           start_date AS startDate, end_date AS endDate, requested_days AS requestedDays,
           status, submitted_at AS submittedAt, approved_at AS approvedAt,
           approved_by_id AS approvedByLegacyId, note
    FROM leave_applications ORDER BY start_date
""")]
(root / "firebase" / "seed-data.json").write_text(
    json.dumps({"users": users, "applications": applications}, ensure_ascii=False, indent=2),
    encoding="utf-8",
)
print(f"Exported {len(users)} users and {len(applications)} applications.")
