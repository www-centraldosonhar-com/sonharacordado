-- =========================================================
-- SÓCIO SONHADOR — FOUNDATION V1
-- =========================================================
--
-- Estrutura independente da Central operacional,
-- mas integrada aos usuários, projetos e Financeiro.
--
-- A Olimpíada Sonhadora é apenas um tipo de campanha
-- dentro do ecossistema do Sócio Sonhador.
-- =========================================================


-- =========================================================
-- 1. DREAMER PROFILES
-- =========================================================

CREATE TABLE IF NOT EXISTS dreamer_profiles (
  id BIGSERIAL PRIMARY KEY,

  user_id BIGINT NOT NULL
    REFERENCES users(id)
    ON DELETE CASCADE,

  preferred_project_id BIGINT
    REFERENCES projects(id)
    ON DELETE SET NULL,

  active INTEGER NOT NULL DEFAULT 1,

  joined_at TIMESTAMP NOT NULL
    DEFAULT CURRENT_TIMESTAMP,

  updated_at TIMESTAMP NOT NULL
    DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(user_id)
);


-- =========================================================
-- 2. DREAMER ROLES
-- =========================================================

CREATE TABLE IF NOT EXISTS dreamer_roles (
  id BIGSERIAL PRIMARY KEY,

  user_id BIGINT NOT NULL
    REFERENCES users(id)
    ON DELETE CASCADE,

  role_code TEXT NOT NULL,

  active INTEGER NOT NULL DEFAULT 1,

  created_at TIMESTAMP NOT NULL
    DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(user_id, role_code)
);


-- =========================================================
-- 3. DREAMER CAMPAIGNS
-- =========================================================

CREATE TABLE IF NOT EXISTS dreamer_campaigns (
  id BIGSERIAL PRIMARY KEY,

  name TEXT NOT NULL,

  slug TEXT NOT NULL UNIQUE,

  campaign_type TEXT NOT NULL
    DEFAULT 'fundraising',

  description TEXT NOT NULL
    DEFAULT '',

  starts_at TIMESTAMP,

  ends_at TIMESTAMP,

  status TEXT NOT NULL
    DEFAULT 'draft',

  allows_external_entries INTEGER NOT NULL
    DEFAULT 1,

  allows_direct_contributions INTEGER NOT NULL
    DEFAULT 1,

  uses_team_ranking INTEGER NOT NULL
    DEFAULT 0,

  created_by BIGINT
    REFERENCES users(id)
    ON DELETE SET NULL,

  created_at TIMESTAMP NOT NULL
    DEFAULT CURRENT_TIMESTAMP,

  updated_at TIMESTAMP NOT NULL
    DEFAULT CURRENT_TIMESTAMP
);


-- =========================================================
-- 4. CAMPAIGN TEAMS
-- =========================================================

CREATE TABLE IF NOT EXISTS dreamer_campaign_teams (
  id BIGSERIAL PRIMARY KEY,

  campaign_id BIGINT NOT NULL
    REFERENCES dreamer_campaigns(id)
    ON DELETE CASCADE,

  project_id BIGINT NOT NULL
    REFERENCES projects(id)
    ON DELETE CASCADE,

  volunteer_count INTEGER NOT NULL
    DEFAULT 0,

  active INTEGER NOT NULL
    DEFAULT 1,

  created_at TIMESTAMP NOT NULL
    DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(campaign_id, project_id)
);


-- =========================================================
-- 5. CONTRIBUTIONS
-- =========================================================

CREATE TABLE IF NOT EXISTS dreamer_contributions (
  id BIGSERIAL PRIMARY KEY,

  campaign_id BIGINT
    REFERENCES dreamer_campaigns(id)
    ON DELETE SET NULL,

  project_id BIGINT
    REFERENCES projects(id)
    ON DELETE SET NULL,

  contributor_user_id BIGINT
    REFERENCES users(id)
    ON DELETE SET NULL,

  contributor_name TEXT NOT NULL
    DEFAULT '',

  amount NUMERIC(12,2) NOT NULL,

  source_type TEXT NOT NULL
    DEFAULT 'app',

  payment_reference TEXT,

  status TEXT NOT NULL
    DEFAULT 'pending',

  created_at TIMESTAMP NOT NULL
    DEFAULT CURRENT_TIMESTAMP,

  confirmed_at TIMESTAMP
);


-- =========================================================
-- 6. EXTERNAL FUNDRAISING ENTRIES
-- =========================================================

CREATE TABLE IF NOT EXISTS dreamer_fundraising_entries (
  id BIGSERIAL PRIMARY KEY,

  campaign_id BIGINT NOT NULL
    REFERENCES dreamer_campaigns(id)
    ON DELETE CASCADE,

  project_id BIGINT NOT NULL
    REFERENCES projects(id)
    ON DELETE CASCADE,

  submitted_by BIGINT NOT NULL
    REFERENCES users(id)
    ON DELETE CASCADE,

  initiative_type TEXT NOT NULL,

  title TEXT NOT NULL
    DEFAULT '',

  gross_amount NUMERIC(12,2) NOT NULL,

  cost_amount NUMERIC(12,2) NOT NULL
    DEFAULT 0,

  net_amount NUMERIC(12,2) NOT NULL,

  received_at DATE,

  notes TEXT NOT NULL
    DEFAULT '',

  status TEXT NOT NULL
    DEFAULT 'pending',

  possible_duplicate INTEGER NOT NULL
    DEFAULT 0,

  reviewed_by BIGINT
    REFERENCES users(id)
    ON DELETE SET NULL,

  review_reason TEXT NOT NULL
    DEFAULT '',

  reviewed_at TIMESTAMP,

  created_at TIMESTAMP NOT NULL
    DEFAULT CURRENT_TIMESTAMP,

  updated_at TIMESTAMP NOT NULL
    DEFAULT CURRENT_TIMESTAMP
);


-- =========================================================
-- 7. RECEIPTS / PROOFS
-- =========================================================

CREATE TABLE IF NOT EXISTS dreamer_receipts (
  id BIGSERIAL PRIMARY KEY,

  fundraising_entry_id BIGINT
    REFERENCES dreamer_fundraising_entries(id)
    ON DELETE CASCADE,

  contribution_id BIGINT
    REFERENCES dreamer_contributions(id)
    ON DELETE CASCADE,

  file_url TEXT NOT NULL,

  file_hash TEXT,

  created_at TIMESTAMP NOT NULL
    DEFAULT CURRENT_TIMESTAMP
);


CREATE INDEX IF NOT EXISTS
  dreamer_receipts_hash_idx
ON dreamer_receipts(file_hash);


-- =========================================================
-- 8. REFERRALS
-- =========================================================

CREATE TABLE IF NOT EXISTS dreamer_referrals (
  id BIGSERIAL PRIMARY KEY,

  campaign_id BIGINT
    REFERENCES dreamer_campaigns(id)
    ON DELETE CASCADE,

  project_id BIGINT NOT NULL
    REFERENCES projects(id)
    ON DELETE CASCADE,

  referrer_user_id BIGINT NOT NULL
    REFERENCES users(id)
    ON DELETE CASCADE,

  referred_user_id BIGINT NOT NULL
    REFERENCES users(id)
    ON DELETE CASCADE,

  qualifying_contribution_id BIGINT
    REFERENCES dreamer_contributions(id)
    ON DELETE SET NULL,

  status TEXT NOT NULL
    DEFAULT 'registered',

  qualified_at TIMESTAMP,

  created_at TIMESTAMP NOT NULL
    DEFAULT CURRENT_TIMESTAMP
);


CREATE UNIQUE INDEX IF NOT EXISTS
  dreamer_referral_same_team_unique
ON dreamer_referrals (
  campaign_id,
  project_id,
  referred_user_id
);


-- =========================================================
-- 9. SPECIAL MISSIONS
-- =========================================================

CREATE TABLE IF NOT EXISTS dreamer_missions (
  id BIGSERIAL PRIMARY KEY,

  campaign_id BIGINT NOT NULL
    REFERENCES dreamer_campaigns(id)
    ON DELETE CASCADE,

  title TEXT NOT NULL,

  description TEXT NOT NULL
    DEFAULT '',

  mission_type TEXT NOT NULL
    DEFAULT 'special',

  starts_at TIMESTAMP,

  ends_at TIMESTAMP,

  active INTEGER NOT NULL
    DEFAULT 1,

  created_by BIGINT
    REFERENCES users(id)
    ON DELETE SET NULL,

  created_at TIMESTAMP NOT NULL
    DEFAULT CURRENT_TIMESTAMP
);


-- =========================================================
-- 10. MISSION RESULTS / POINTS
-- =========================================================

CREATE TABLE IF NOT EXISTS dreamer_mission_results (
  id BIGSERIAL PRIMARY KEY,

  mission_id BIGINT NOT NULL
    REFERENCES dreamer_missions(id)
    ON DELETE CASCADE,

  project_id BIGINT NOT NULL
    REFERENCES projects(id)
    ON DELETE CASCADE,

  user_id BIGINT
    REFERENCES users(id)
    ON DELETE SET NULL,

  points NUMERIC(10,2) NOT NULL
    DEFAULT 0,

  source_reference TEXT NOT NULL
    DEFAULT '',

  created_at TIMESTAMP NOT NULL
    DEFAULT CURRENT_TIMESTAMP
);


-- =========================================================
-- 11. FREQUENCY SNAPSHOTS
-- =========================================================

CREATE TABLE IF NOT EXISTS dreamer_frequency_snapshots (
  id BIGSERIAL PRIMARY KEY,

  campaign_id BIGINT NOT NULL
    REFERENCES dreamer_campaigns(id)
    ON DELETE CASCADE,

  project_id BIGINT NOT NULL
    REFERENCES projects(id)
    ON DELETE CASCADE,

  event_id BIGINT
    REFERENCES events(id)
    ON DELETE SET NULL,

  present_count INTEGER NOT NULL
    DEFAULT 0,

  semester_volunteer_count INTEGER NOT NULL
    DEFAULT 0,

  attendance_rate NUMERIC(8,4) NOT NULL
    DEFAULT 0,

  created_at TIMESTAMP NOT NULL
    DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(campaign_id, project_id, event_id)
);


-- =========================================================
-- 12. CAMPAIGN SCORE ADJUSTMENTS
-- =========================================================

CREATE TABLE IF NOT EXISTS dreamer_score_adjustments (
  id BIGSERIAL PRIMARY KEY,

  campaign_id BIGINT NOT NULL
    REFERENCES dreamer_campaigns(id)
    ON DELETE CASCADE,

  project_id BIGINT NOT NULL
    REFERENCES projects(id)
    ON DELETE CASCADE,

  category TEXT NOT NULL,

  points NUMERIC(10,2) NOT NULL,

  reason TEXT NOT NULL
    DEFAULT '',

  created_by BIGINT
    REFERENCES users(id)
    ON DELETE SET NULL,

  created_at TIMESTAMP NOT NULL
    DEFAULT CURRENT_TIMESTAMP
);


-- =========================================================
-- 13. CAMPAIGN CLOSURES
-- =========================================================

CREATE TABLE IF NOT EXISTS dreamer_campaign_closures (
  id BIGSERIAL PRIMARY KEY,

  campaign_id BIGINT NOT NULL
    REFERENCES dreamer_campaigns(id)
    ON DELETE CASCADE,

  closed_by BIGINT NOT NULL
    REFERENCES users(id)
    ON DELETE RESTRICT,

  status TEXT NOT NULL
    DEFAULT 'draft',

  gross_total NUMERIC(12,2) NOT NULL
    DEFAULT 0,

  cost_total NUMERIC(12,2) NOT NULL
    DEFAULT 0,

  net_total NUMERIC(12,2) NOT NULL
    DEFAULT 0,

  sent_to_finance_at TIMESTAMP,

  created_at TIMESTAMP NOT NULL
    DEFAULT CURRENT_TIMESTAMP,

  updated_at TIMESTAMP NOT NULL
    DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(campaign_id)
);


-- =========================================================
-- INDEXES
-- =========================================================

CREATE INDEX IF NOT EXISTS
  dreamer_contributions_campaign_idx
ON dreamer_contributions(campaign_id);


CREATE INDEX IF NOT EXISTS
  dreamer_contributions_project_idx
ON dreamer_contributions(project_id);


CREATE INDEX IF NOT EXISTS
  dreamer_fundraising_campaign_idx
ON dreamer_fundraising_entries(campaign_id);


CREATE INDEX IF NOT EXISTS
  dreamer_fundraising_project_idx
ON dreamer_fundraising_entries(project_id);


CREATE INDEX IF NOT EXISTS
  dreamer_missions_campaign_idx
ON dreamer_missions(campaign_id);
