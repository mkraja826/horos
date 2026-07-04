PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL UNIQUE,
  auth_type TEXT NOT NULL CHECK (auth_type IN ('phone', 'email')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deleted', 'suspended')),
  last_active_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  gender TEXT,
  preferred_language TEXT NOT NULL DEFAULT 'English',
  current_city TEXT,
  notification_time TEXT NOT NULL DEFAULT '06:00',
  notifications_enabled INTEGER NOT NULL DEFAULT 0,
  app_version TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS birth_details (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  date_of_birth TEXT NOT NULL,
  time_of_birth TEXT NOT NULL,
  birth_place TEXT NOT NULL,
  timezone TEXT NOT NULL,
  latitude REAL,
  longitude REAL,
  rashi TEXT,
  nakshatra TEXT,
  lagna TEXT,
  chart_json TEXT,
  calculation_mode TEXT NOT NULL DEFAULT 'estimated' CHECK (calculation_mode IN ('provider', 'estimated')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS horoscope_cache (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period TEXT NOT NULL CHECK (period IN ('daily', 'weekly', 'monthly', 'panchang')),
  period_key TEXT NOT NULL,
  content_json TEXT NOT NULL,
  calculation_mode TEXT NOT NULL CHECK (calculation_mode IN ('provider', 'estimated')),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, period, period_key)
);

CREATE INDEX IF NOT EXISTS idx_horoscope_cache_lookup
  ON horoscope_cache(user_id, period, period_key, expires_at);

CREATE TABLE IF NOT EXISTS subscriptions (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT CHECK (platform IN ('android', 'ios')),
  product_id TEXT,
  purchase_token TEXT,
  provider_customer_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('trial', 'active', 'expired', 'cancelled')),
  trial_start_date TEXT,
  trial_end_date TEXT,
  subscription_start_date TEXT,
  subscription_end_date TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expo_push_token TEXT NOT NULL,
  notification_time TEXT NOT NULL DEFAULT '06:00',
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  enabled INTEGER NOT NULL DEFAULT 1,
  last_sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, expo_push_token)
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS otp_challenges (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_otp_challenges_identifier ON otp_challenges(identifier, expires_at);

CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  payload_json TEXT NOT NULL
);

-- A one-way identifier fingerprint prevents a deleted account from restarting the
-- one-time trial while allowing all raw contact and birth data to be erased.
CREATE TABLE IF NOT EXISTS trial_ledger (
  identifier_hash TEXT PRIMARY KEY,
  first_trial_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
