-- =========================================================
-- MEDIA CONTENT DELIVERIES
-- =========================================================
--
-- Armazém interno de Criação de Conteúdo.
--
-- NÃO substitui:
-- - confirmations.delivery_link
-- - events.drive_link
-- - fluxo oficial de entrega de Fotografias
--
-- Este armazenamento é paralelo e destinado aos membros
-- da Equipe de Mídias.
-- =========================================================

CREATE TABLE IF NOT EXISTS media_content_deliveries (
  id BIGSERIAL PRIMARY KEY,

  event_id BIGINT NOT NULL
    REFERENCES events(id)
    ON DELETE CASCADE,

  event_role_id BIGINT
    REFERENCES event_roles(id)
    ON DELETE SET NULL,

  user_id BIGINT NOT NULL
    REFERENCES users(id)
    ON DELETE CASCADE,

  drive_link TEXT NOT NULL,

  created_at TIMESTAMP NOT NULL
    DEFAULT CURRENT_TIMESTAMP,

  updated_at TIMESTAMP NOT NULL
    DEFAULT CURRENT_TIMESTAMP
);


-- Uma pessoa pode manter uma entrega de Armazém
-- por atividade/evento.
CREATE UNIQUE INDEX IF NOT EXISTS
  media_content_deliveries_user_event_role_unique
ON media_content_deliveries (
  user_id,
  event_id,
  event_role_id
);


CREATE INDEX IF NOT EXISTS
  media_content_deliveries_event_idx
ON media_content_deliveries (
  event_id
);


CREATE INDEX IF NOT EXISTS
  media_content_deliveries_user_idx
ON media_content_deliveries (
  user_id
);
