ALTER TABLE dreamer_campaign_closures
  ADD COLUMN IF NOT EXISTS snapshot_data JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE dreamer_campaign_closures
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP;

ALTER TABLE dreamer_campaign_closures
  ADD COLUMN IF NOT EXISTS closure_notes TEXT NOT NULL DEFAULT '';

ALTER TABLE dreamer_campaign_closures
  ADD COLUMN IF NOT EXISTS sent_to_finance_by BIGINT REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE dreamer_campaign_closures
  ADD COLUMN IF NOT EXISTS finance_notes TEXT NOT NULL DEFAULT '';

ALTER TABLE dreamer_campaign_closures
  ADD COLUMN IF NOT EXISTS finance_received_at TIMESTAMP;

ALTER TABLE dreamer_campaign_closures
  ADD COLUMN IF NOT EXISTS finance_received_by BIGINT REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS dreamer_campaign_closures_status_idx
  ON dreamer_campaign_closures(status);
