-- An invitation is credited only after a new player starts an authenticated Game.
CREATE TABLE IF NOT EXISTS pending_invites (
 player_id TEXT PRIMARY KEY,
 invite_code TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
