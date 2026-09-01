-- =========================================================
-- SÓCIO SONHADOR — DIRECT CONTRIBUTIONS V1
-- =========================================================
-- Evolui dreamer_contributions para suportar intenção de
-- pagamento criada no app e futura integração com gateway.
-- Nenhum registro pendente entra no placar oficial.
-- =========================================================

ALTER TABLE dreamer_contributions
  ADD COLUMN IF NOT EXISTS message TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS provider_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS dreamer_contributions_user_idx
  ON dreamer_contributions(contributor_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS dreamer_contributions_campaign_status_idx
  ON dreamer_contributions(campaign_id, status);
