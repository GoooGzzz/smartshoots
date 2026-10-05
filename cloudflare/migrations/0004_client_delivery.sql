-- Separate credentials prevent client accounts from becoming studio staff.
CREATE TABLE delivery_access (
 id TEXT PRIMARY KEY,
 client_id INTEGER NOT NULL UNIQUE REFERENCES accounts_client(id) ON DELETE RESTRICT,
 username TEXT NOT NULL UNIQUE,
 password TEXT NOT NULL,
 is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
 updated_at TEXT NOT NULL
);
CREATE TABLE delivery_sessions (
 token_hash TEXT PRIMARY KEY,
 access_id TEXT NOT NULL REFERENCES delivery_access(id) ON DELETE CASCADE,
 expires_at INTEGER NOT NULL
);
CREATE TABLE delivery_recordings (
 id TEXT PRIMARY KEY,
 client_id INTEGER NOT NULL REFERENCES accounts_client(id) ON DELETE RESTRICT,
 title TEXT NOT NULL,
 filename TEXT NOT NULL,
 content_type TEXT NOT NULL,
 size INTEGER NOT NULL,
 object_key TEXT NOT NULL UNIQUE,
 upload_id TEXT,
 status TEXT NOT NULL CHECK(status IN ('uploading','ready','hidden','deleted')),
 created_by INTEGER NOT NULL REFERENCES accounts_user(id) ON DELETE RESTRICT,
 created_at TEXT NOT NULL
);
CREATE TABLE delivery_parts (
 recording_id TEXT NOT NULL REFERENCES delivery_recordings(id) ON DELETE CASCADE,
 part_number INTEGER NOT NULL,
 etag TEXT NOT NULL,
 size INTEGER NOT NULL,
 PRIMARY KEY(recording_id,part_number)
);
CREATE INDEX delivery_client_status ON delivery_recordings(client_id,status,created_at);
CREATE INDEX delivery_session_expiry ON delivery_sessions(expires_at);
