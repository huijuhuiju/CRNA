# 整合帳戶資料庫

`long_leave.db` 是 SQLite 資料庫，包含：

- `users`：有效帳號、人員編號、角色、到職與試用資料。
- `leave_applications`：所有長假申請、申請人、代送人、日期、方案、狀態與核准日。
- `application_status_history`：核准、駁回、抽籤等異動稽核紀錄。
- `course_schedule`：未來 CV course 上傳資料的儲存位置。

原型帳號的密碼已使用 PBKDF2-SHA256 雜湊保存；示範密碼均為 `123456`，正式上線前必須強制更換。

執行 `init_database.py` 可重建示範資料庫。SQLite 用於本機驗證；正式部署時應依相同結構移轉至院內 PostgreSQL 或受管 PostgreSQL。
