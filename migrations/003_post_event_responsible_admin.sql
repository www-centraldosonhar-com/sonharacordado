-- =========================================================
-- CENTRAL DO SONHAR 3.0
-- Responsável pelo Pós-Evento em eventos gerais
-- =========================================================

ALTER TABLE post_event_team_reports
ADD COLUMN IF NOT EXISTS responsible_user_id INTEGER;

ALTER TABLE post_event_team_reports
ADD COLUMN IF NOT EXISTS assigned_by INTEGER;

ALTER TABLE post_event_team_reports
ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;

-- Usuário responsável.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname =
      'post_event_team_reports_responsible_user_fk'
  ) THEN

    ALTER TABLE post_event_team_reports
    ADD CONSTRAINT
      post_event_team_reports_responsible_user_fk
    FOREIGN KEY (responsible_user_id)
    REFERENCES users(id)
    ON DELETE SET NULL;

  END IF;
END $$;

-- Admin que realizou a atribuição.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname =
      'post_event_team_reports_assigned_by_fk'
  ) THEN

    ALTER TABLE post_event_team_reports
    ADD CONSTRAINT
      post_event_team_reports_assigned_by_fk
    FOREIGN KEY (assigned_by)
    REFERENCES users(id)
    ON DELETE SET NULL;

  END IF;
END $$;

CREATE INDEX IF NOT EXISTS
  idx_post_event_team_reports_responsible_user
ON post_event_team_reports (
  responsible_user_id
);
