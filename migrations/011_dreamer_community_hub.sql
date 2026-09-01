-- =========================================================
-- 011 - DREAMER COMMUNITY HUB
-- Public support actions + partners/sponsors managed by
-- Dreamer Admin and displayed on the main Dreamer home.
-- =========================================================

CREATE TABLE IF NOT EXISTS dreamer_support_actions (
  id BIGSERIAL PRIMARY KEY,

  project_id BIGINT
    REFERENCES projects(id)
    ON DELETE SET NULL,

  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',

  support_kind TEXT NOT NULL DEFAULT 'mixed',
  need_label TEXT NOT NULL DEFAULT '',
  contact_url TEXT NOT NULL DEFAULT '',

  starts_at TIMESTAMP,
  ends_at TIMESTAMP,

  status TEXT NOT NULL DEFAULT 'draft',
  featured INTEGER NOT NULL DEFAULT 0,

  created_by BIGINT
    REFERENCES users(id)
    ON DELETE SET NULL,

  updated_by BIGINT
    REFERENCES users(id)
    ON DELETE SET NULL,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS dreamer_support_actions_status_idx
  ON dreamer_support_actions(status, featured, ends_at);

CREATE TABLE IF NOT EXISTS dreamer_partners (
  id BIGSERIAL PRIMARY KEY,

  name TEXT NOT NULL,
  partner_type TEXT NOT NULL DEFAULT 'partner',
  description TEXT NOT NULL DEFAULT '',
  support_summary TEXT NOT NULL DEFAULT '',

  logo_url TEXT NOT NULL DEFAULT '',
  website_url TEXT NOT NULL DEFAULT '',

  active INTEGER NOT NULL DEFAULT 1,
  featured INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,

  created_by BIGINT
    REFERENCES users(id)
    ON DELETE SET NULL,

  updated_by BIGINT
    REFERENCES users(id)
    ON DELETE SET NULL,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS dreamer_partners_public_idx
  ON dreamer_partners(active, featured, sort_order);
