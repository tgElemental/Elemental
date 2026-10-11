-- All state-affecting gameplay operations are atomic SQLite statements.
-- D1 supports SQLite triggers; mutation results are auditable through rounds/grants.
CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  alias TEXT NOT NULL,
  invite_code TEXT NOT NULL UNIQUE,
  referrer_id TEXT REFERENCES players(id),
  water INTEGER NOT NULL DEFAULT 0 CHECK(water >= 0),
  fire INTEGER NOT NULL DEFAULT 0 CHECK(fire >= 0),
  earth INTEGER NOT NULL DEFAULT 0 CHECK(earth >= 0),
  wind INTEGER NOT NULL DEFAULT 0 CHECK(wind >= 0),
  score INTEGER NOT NULL DEFAULT 0,
  weekly_score INTEGER NOT NULL DEFAULT 0,
  week_key TEXT NOT NULL DEFAULT '',
  tree INTEGER NOT NULL DEFAULT 0,
  light INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  rounds_played INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_players_week ON players(week_key,weekly_score DESC);
CREATE TABLE IF NOT EXISTS grants (
  event_key TEXT PRIMARY KEY,
  beneficiary_id TEXT NOT NULL REFERENCES players(id),
  kind TEXT NOT NULL CHECK(kind IN('daily','referral')),
  water INTEGER NOT NULL DEFAULT 5,
  fire INTEGER NOT NULL DEFAULT 5,
  earth INTEGER NOT NULL DEFAULT 5,
  wind INTEGER NOT NULL DEFAULT 5,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TRIGGER IF NOT EXISTS apply_grant AFTER INSERT ON grants
BEGIN
  UPDATE players SET water=water+NEW.water, fire=fire+NEW.fire,
    earth=earth+NEW.earth, wind=wind+NEW.wind
    WHERE id=NEW.beneficiary_id;
END;
CREATE TABLE IF NOT EXISTS rounds (
  action_id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id),
  picked TEXT NOT NULL CHECK(picked IN('water','fire','earth','wind')),
  rival TEXT NOT NULL CHECK(rival IN('water','fire','earth','wind')),
  outcome TEXT NOT NULL CHECK(outcome IN('win','draw','loss')),
  points INTEGER NOT NULL CHECK(points BETWEEN 0 AND 6),
  tree_gain INTEGER NOT NULL CHECK(tree_gain IN(0,1)),
  light_gain INTEGER NOT NULL CHECK(light_gain IN(0,1)),
  weather_key TEXT NOT NULL,
  week_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_rounds_player ON rounds(player_id,created_at DESC);
CREATE TRIGGER IF NOT EXISTS apply_round AFTER INSERT ON rounds
BEGIN
  UPDATE players SET
    water=water-CASE WHEN NEW.picked='water' THEN 1 ELSE 0 END,
    fire=fire-CASE WHEN NEW.picked='fire' THEN 1 ELSE 0 END,
    earth=earth-CASE WHEN NEW.picked='earth' THEN 1 ELSE 0 END,
    wind=wind-CASE WHEN NEW.picked='wind' THEN 1 ELSE 0 END,
    score=score+NEW.points,
    weekly_score=(CASE WHEN week_key=NEW.week_key THEN weekly_score ELSE 0 END)+NEW.points,
    week_key=NEW.week_key,
    tree=tree+NEW.tree_gain,
    light=light+NEW.light_gain,
    streak=CASE WHEN NEW.outcome='win' THEN MIN(streak+1,3) ELSE 0 END,
    rounds_played=rounds_played+1
    WHERE id=NEW.player_id;
END;
