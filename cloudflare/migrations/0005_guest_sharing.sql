-- Shared guest credentials remain separate from studio/client accounts.
CREATE TABLE delivery_guest_access (
 id INTEGER PRIMARY KEY CHECK(id=1),
 username TEXT NOT NULL UNIQUE,
 password TEXT NOT NULL,
 is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
 updated_at TEXT NOT NULL
);
CREATE TABLE delivery_guest_sessions (
 token_hash TEXT PRIMARY KEY,
 expires_at INTEGER NOT NULL
);
CREATE TABLE delivery_guest_recordings (
 recording_id TEXT PRIMARY KEY REFERENCES delivery_recordings(id) ON DELETE CASCADE,
 shared_by INTEGER NOT NULL REFERENCES accounts_user(id) ON DELETE RESTRICT,
 shared_at TEXT NOT NULL
);
