-- Cloudflare D1 Database Schema for Chinese Vocab Learner
CREATE TABLE IF NOT EXISTS user_sync_snapshot (
  id TEXT PRIMARY KEY,
  payload_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
