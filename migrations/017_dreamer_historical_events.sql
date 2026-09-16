-- =========================================================
-- SÓCIO SONHADOR
-- Eventos históricos anteriores à Central
-- =========================================================
--
-- Registra dados oficiais de eventos realizados antes
-- da operação pela Central do Sonhar.
--
-- IMPORTANTE:
-- - não cria inscrições retroativas;
-- - não cria checklists retroativas;
-- - não cria lançamentos no Financeiro;
-- - não cria dreamer_fundraising_entries;
-- - resultados e pontos são calculados;
-- - somente registros validados entram na Olimpíada.
-- =========================================================


-- =========================================================
-- EVENTO HISTÓRICO
-- =========================================================

CREATE TABLE IF NOT EXISTS dreamer_historical_events (
  id BIGSERIAL PRIMARY KEY,

  campaign_id BIGINT NOT NULL
    REFERENCES dreamer_campaigns(id)
    ON DELETE CASCADE,

  -- NULL = evento geral / formação.
  -- Preenchido = evento específico de um projeto.
  project_id BIGINT
    REFERENCES projects(id)
    ON DELETE RESTRICT,

  name TEXT NOT NULL,

  event_date DATE NOT NULL,

  attendance_enabled INTEGER NOT NULL
    DEFAULT 0
    CHECK (attendance_enabled IN (0, 1)),

  economy_enabled INTEGER NOT NULL
    DEFAULT 0
    CHECK (economy_enabled IN (0, 1)),

  -- Somente registros validados entram
  -- nos cálculos oficiais.
  validated INTEGER NOT NULL
    DEFAULT 0
    CHECK (validated IN (0, 1)),

  validated_by BIGINT
    REFERENCES users(id)
    ON DELETE SET NULL,

  validated_at TIMESTAMP,

  created_by BIGINT
    REFERENCES users(id)
    ON DELETE SET NULL,

  created_at TIMESTAMP NOT NULL
    DEFAULT CURRENT_TIMESTAMP,

  updated_at TIMESTAMP NOT NULL
    DEFAULT CURRENT_TIMESTAMP,

  CHECK (
    attendance_enabled = 1
    OR economy_enabled = 1
  )
);


-- =========================================================
-- DADOS POR PROJETO
-- =========================================================
--
-- Evento APS:
--   uma linha APS.
--
-- Evento geral:
--   pode possuir APS + PPF + SJ.
--
-- A base histórica fica congelada aqui.
--
-- Os valores financeiros são informativos para a
-- Olimpíada e NÃO entram no Financeiro da Central.
-- =========================================================

CREATE TABLE IF NOT EXISTS dreamer_historical_event_projects (
  id BIGSERIAL PRIMARY KEY,

  historical_event_id BIGINT NOT NULL
    REFERENCES dreamer_historical_events(id)
    ON DELETE CASCADE,

  project_id BIGINT NOT NULL
    REFERENCES projects(id)
    ON DELETE RESTRICT,

  volunteer_base INTEGER NOT NULL
    CHECK (volunteer_base > 0),

  -- Podem ficar NULL quando o evento possui apenas
  -- dados de frequência.
  collected_amount NUMERIC(12,2),

  expenses_amount NUMERIC(12,2),

  created_at TIMESTAMP NOT NULL
    DEFAULT CURRENT_TIMESTAMP,

  updated_at TIMESTAMP NOT NULL
    DEFAULT CURRENT_TIMESTAMP,

  CHECK (
    collected_amount IS NULL
    OR collected_amount >= 0
  ),

  CHECK (
    expenses_amount IS NULL
    OR expenses_amount >= 0
  ),

  CHECK (
    (
      collected_amount IS NULL
      AND expenses_amount IS NULL
    )
    OR
    (
      collected_amount IS NOT NULL
      AND expenses_amount IS NOT NULL
    )
  ),

  UNIQUE (
    historical_event_id,
    project_id
  )
);


-- =========================================================
-- PRESENÇAS HISTÓRICAS
-- =========================================================
--
-- Preserva o nome original encontrado na lista.
--
-- user_id é opcional:
-- quando possível, o Admin poderá vincular a presença
-- histórica a um usuário real da Central.
--
-- project_id representa o projeto ao qual o voluntário
-- pertencia para fins da Olimpíada.
-- =========================================================

CREATE TABLE IF NOT EXISTS dreamer_historical_attendance (
  id BIGSERIAL PRIMARY KEY,

  historical_event_id BIGINT NOT NULL
    REFERENCES dreamer_historical_events(id)
    ON DELETE CASCADE,

  user_id BIGINT
    REFERENCES users(id)
    ON DELETE SET NULL,

  volunteer_name TEXT NOT NULL,

  project_id BIGINT NOT NULL
    REFERENCES projects(id)
    ON DELETE RESTRICT,

  created_at TIMESTAMP NOT NULL
    DEFAULT CURRENT_TIMESTAMP,

  UNIQUE (
    historical_event_id,
    volunteer_name
  )
);


-- =========================================================
-- INDEXES
-- =========================================================

CREATE INDEX IF NOT EXISTS
  dreamer_historical_events_campaign_idx
ON dreamer_historical_events (
  campaign_id
);


CREATE INDEX IF NOT EXISTS
  dreamer_historical_events_project_idx
ON dreamer_historical_events (
  project_id
);


CREATE INDEX IF NOT EXISTS
  dreamer_historical_events_date_idx
ON dreamer_historical_events (
  event_date
);


CREATE INDEX IF NOT EXISTS
  dreamer_historical_event_projects_event_idx
ON dreamer_historical_event_projects (
  historical_event_id
);


CREATE INDEX IF NOT EXISTS
  dreamer_historical_event_projects_project_idx
ON dreamer_historical_event_projects (
  project_id
);


CREATE INDEX IF NOT EXISTS
  dreamer_historical_attendance_event_idx
ON dreamer_historical_attendance (
  historical_event_id
);


CREATE INDEX IF NOT EXISTS
  dreamer_historical_attendance_project_idx
ON dreamer_historical_attendance (
  project_id
);


CREATE INDEX IF NOT EXISTS
  dreamer_historical_attendance_user_idx
ON dreamer_historical_attendance (
  user_id
);
