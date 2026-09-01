-- Sócio Sonhador: PIX + comprovante para contribuições diretas.
-- Somente status confirmed entra nos totais e no placar.

ALTER TABLE dreamer_contributions
  ADD COLUMN IF NOT EXISTS payment_receipt_path TEXT,
  ADD COLUMN IF NOT EXISTS receipt_hash TEXT,
  ADD COLUMN IF NOT EXISTS review_reason TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS reviewed_by INTEGER REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS dreamer_contributions_review_status_idx
  ON dreamer_contributions(status, created_at DESC);

CREATE INDEX IF NOT EXISTS dreamer_contributions_receipt_hash_idx
  ON dreamer_contributions(receipt_hash)
  WHERE receipt_hash IS NOT NULL;

UPDATE dreamer_contributions
SET
  provider = 'pix_manual',
  payment_method = 'pix',
  updated_at = CURRENT_TIMESTAMP
WHERE
  source_type = 'app'
  AND status = 'pending'
  AND (
    provider = 'pending_gateway'
    OR provider = ''
    OR provider IS NULL
  );
