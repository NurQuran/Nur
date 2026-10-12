PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS nur_users (
  id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, google_sub TEXT UNIQUE,
  name TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS nur_sessions (
  token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES nur_users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS nur_sessions_expiry ON nur_sessions(expires_at);
CREATE TABLE IF NOT EXISTS nur_email_codes (
  id TEXT PRIMARY KEY, email TEXT NOT NULL, code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS nur_user_state (
  user_id TEXT PRIMARY KEY REFERENCES nur_users(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL DEFAULT 0, data TEXT NOT NULL DEFAULT '{}', updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS nur_rate_limits (
  key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS nur_admin_sessions (
  token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS nur_service_credentials (
  name TEXT PRIMARY KEY, encrypted_value TEXT NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS nur_analytics (
  event_id TEXT PRIMARY KEY, day TEXT NOT NULL, country TEXT NOT NULL,
  page TEXT NOT NULL, surah INTEGER, visitor_hash TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS nur_analytics_day ON nur_analytics(day);
CREATE INDEX IF NOT EXISTS nur_analytics_surah ON nur_analytics(surah, day);
