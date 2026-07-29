PRAGMA foreign_keys = ON;

CREATE TABLE events (
  id TEXT PRIMARY KEY,
  owner_token_hash TEXT NOT NULL,
  creator_session_id TEXT NOT NULL,
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 50),
  event_date TEXT NOT NULL,
  meet_time TEXT NOT NULL,
  place TEXT NOT NULL CHECK (length(place) BETWEEN 1 AND 60),
  sport TEXT NOT NULL CHECK (sport IN ('soccer', 'basketball', 'baseball', 'volleyball', 'other')),
  expected_count INTEGER NOT NULL CHECK (expected_count BETWEEN 1 AND 50),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'hidden')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX events_expires_at ON events (expires_at);
CREATE INDEX events_creator ON events (creator_session_id);

CREATE TABLE responses (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  edit_token_hash TEXT NOT NULL,
  respondent_session_id TEXT NOT NULL,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 20),
  attendance TEXT NOT NULL CHECK (attendance IN ('yes', 'maybe', 'no')),
  ride TEXT NOT NULL CHECK (ride IN ('self', 'offer', 'need')),
  seats INTEGER NOT NULL DEFAULT 0 CHECK (seats BETWEEN 0 AND 8),
  passengers INTEGER NOT NULL DEFAULT 0 CHECK (passengers BETWEEN 0 AND 4),
  note TEXT NOT NULL CHECK (length(note) <= 100),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (event_id, respondent_session_id)
);

CREATE INDEX responses_event ON responses (event_id, created_at);

CREATE TABLE reports (
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  reporter_session_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (event_id, reporter_session_id)
);

CREATE TABLE product_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  name TEXT NOT NULL CHECK (
    name IN (
      'visited',
      'event_created',
      'link_copied',
      'response_saved',
      'owner_opened',
      'event_closed',
      'returned'
    )
  ),
  context TEXT NOT NULL DEFAULT '',
  occurred_on TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (session_id, name, context, occurred_on)
);

CREATE INDEX product_events_created_at ON product_events (created_at);
