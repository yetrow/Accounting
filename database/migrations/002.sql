CREATE TABLE audit_log (id TEXT PRIMARY KEY, revision INTEGER NOT NULL UNIQUE, at INTEGER NOT NULL, kind TEXT NOT NULL, payload TEXT NOT NULL);
CREATE TRIGGER audit_no_update BEFORE UPDATE ON audit_log BEGIN SELECT RAISE(ABORT,'Audit records are immutable'); END;
CREATE TRIGGER audit_no_delete BEFORE DELETE ON audit_log BEGIN SELECT RAISE(ABORT,'Audit records are immutable'); END;
CREATE TABLE recovery (id INTEGER PRIMARY KEY CHECK(id=1), snapshot TEXT NOT NULL);
CREATE INDEX transactions_account_date ON transactions(account_id,date);
CREATE INDEX audit_at ON audit_log(at);
