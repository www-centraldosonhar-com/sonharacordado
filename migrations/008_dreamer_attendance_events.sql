-- =========================================================
-- SÓCIO SONHADOR
-- Eventos elegíveis para pontuação de frequência
-- =========================================================
--
-- A presença continua vindo da Central.
-- Esta tabela apenas define quais eventos oficiais
-- contam para determinada campanha.
-- =========================================================

CREATE TABLE IF NOT EXISTS dreamer_attendance_events (
  id BIGSERIAL PRIMARY KEY,

  campaign_id BIGINT NOT NULL
    REFERENCES dreamer_campaigns(id)
    ON DELETE CASCADE,

  event_id BIGINT NOT NULL
    REFERENCES events(id)
    ON DELETE CASCADE,

  active INTEGER NOT NULL
    DEFAULT 1,

  added_by BIGINT
    REFERENCES users(id)
    ON DELETE SET NULL,

  created_at TIMESTAMP NOT NULL
    DEFAULT CURRENT_TIMESTAMP,

  UNIQUE (
    campaign_id,
    event_id
  )
);


CREATE INDEX IF NOT EXISTS
  dreamer_attendance_events_campaign_idx
ON dreamer_attendance_events (
  campaign_id
);
