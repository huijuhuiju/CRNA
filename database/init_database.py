"""Create the local integrated account database used by the prototype."""
from __future__ import annotations

import hashlib
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

BASE_DIR = Path(__file__).parent
DB_PATH = BASE_DIR / "long_leave.db"
SCHEMA_PATH = BASE_DIR / "schema.sql"


def password_record(password: str) -> tuple[str, str]:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 600_000)
    return digest.hex(), salt.hex()


def main() -> None:
    if DB_PATH.exists():
        DB_PATH.unlink()
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    connection = sqlite3.connect(DB_PATH)
    connection.execute("PRAGMA foreign_keys = ON")
    connection.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))

    raw_users = [
        ("u1", "A001", "王小美", "staff", "staff", "2025-03-01", 1, "123456"),
        ("u2", "A002", "林安琪", "lin", "staff", "2024-08-15", 1, "123456"),
        ("u3", "A003", "陳怡君", "chen", "staff", "2023-05-01", 1, "123456"),
        ("u4", "A004", "張雅雯", "zhang", "staff", "2024-01-10", 1, "123456"),
        ("m1", "M001", "李主任", "director", "director", "2018-07-01", 1, "123456"),
    ]
    for user_id, employee_no, name, account, role, employed_on, probation, password in raw_users:
        digest, salt = password_record(password)
        connection.execute(
            """INSERT INTO users
              (id, employee_no, display_name, account_name, password_hash, password_salt,
               role, employed_on, probation_passed, is_active, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)""",
            (user_id, employee_no, name, account, digest, salt, role, employed_on, probation, now, now),
        )

    applications = [
        ("a1", "u2", "u2", "one", "2026-10-05", "2026-10-11", 7, "pending", "2026-07-15", None, None, ""),
        ("a2", "u3", "u3", "one", "2026-10-06", "2026-10-12", 7, "pending", "2026-07-15", None, None, ""),
        ("a3", "u4", "u4", "one", "2026-10-07", "2026-10-13", 7, "pending", "2026-07-15", None, None, ""),
        ("a4", "u1", "u1", "one", "2026-08-10", "2026-08-16", 7, "approved", "2026-05-30", "2026-06-03", "m1", "家庭旅遊"),
    ]
    for app in applications:
        connection.execute(
            """INSERT INTO leave_applications
              (id, applicant_id, submitted_by_id, plan_code, start_date, end_date,
               requested_days, status, submitted_at, approved_at, approved_by_id, note,
               created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (*app, now, now),
        )
        if app[7] == "approved":
            connection.execute(
                """INSERT INTO application_status_history
                   (application_id, from_status, to_status, changed_by_id, changed_at, reason)
                   VALUES (?, 'pending', 'approved', ?, ?, '示範核准紀錄')""",
                (app[0], app[10], app[9]),
            )
    connection.commit()
    connection.close()
    print(f"Created {DB_PATH}")


if __name__ == "__main__":
    main()
