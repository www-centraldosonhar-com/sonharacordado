-- SÓCIO SONHADOR — INDICAÇÕES QUALIFICADAS V2

CREATE TABLE IF NOT EXISTS dreamer_referral_codes (
  id BIGSERIAL PRIMARY KEY,
  campaign_id BIGINT NOT NULL REFERENCES dreamer_campaigns(id) ON DELETE CASCADE,
  project_id BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  referrer_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(campaign_id, project_id, referrer_user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS dreamer_referral_qualifying_contribution_unique
ON dreamer_referrals (qualifying_contribution_id)
WHERE qualifying_contribution_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS dreamer_referrals_campaign_project_status_idx
ON dreamer_referrals (campaign_id, project_id, status);
