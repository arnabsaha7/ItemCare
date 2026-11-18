ALTER TABLE documents ADD COLUMN relative_path TEXT NOT NULL DEFAULT '';
ALTER TABLE documents ADD COLUMN file_modified_at TEXT NOT NULL DEFAULT '';
ALTER TABLE documents ADD COLUMN integrity_status TEXT NOT NULL DEFAULT 'verified';
ALTER TABLE documents ADD COLUMN observed_sha256 TEXT NOT NULL DEFAULT '';
ALTER TABLE documents ADD COLUMN last_verified_at TEXT NOT NULL DEFAULT '';
