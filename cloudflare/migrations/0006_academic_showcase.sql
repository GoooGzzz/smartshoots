CREATE TABLE academy_profiles (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL,
 speciality TEXT NOT NULL,
 bio_en TEXT NOT NULL DEFAULT '',
 bio_ar TEXT NOT NULL DEFAULT '',
 dedication TEXT NOT NULL DEFAULT '',
 programs INTEGER NOT NULL DEFAULT 0 CHECK(programs>=0),
 recordings INTEGER NOT NULL DEFAULT 0 CHECK(recordings>=0),
 hours REAL NOT NULL DEFAULT 0 CHECK(hours>=0),
 photo_key TEXT,
 photo_type TEXT,
 is_published INTEGER NOT NULL DEFAULT 0 CHECK(is_published IN (0,1)),
 updated_at TEXT NOT NULL
);
