import process from 'node:process'
import { neon } from '@neondatabase/serverless'

const sql = neon(
  process.env.DATABASE_URL
)

console.log('')
console.log(
  '🧩 Configurando perguntas dinâmicas do Pós-Evento...'
)
console.log('')


// =========================================================
// 1. PERGUNTAS DO EVENTO
// =========================================================
//
// O Admin de Projeto/Geral poderá configurar perguntas
// diferentes para cada evento.
//
// Exemplo:
// - Como foi a organização da equipe?
// - O que funcionou bem?
// - O que precisa melhorar?
//
// position controla a ordem.
// required define se a resposta é obrigatória.
// active permite desativar sem apagar histórico.
// =========================================================

await sql`
  CREATE TABLE IF NOT EXISTS
    post_event_questions (
      id SERIAL PRIMARY KEY,

      event_id INTEGER
        NOT NULL
        REFERENCES events(id)
        ON DELETE CASCADE,

      question_text TEXT
        NOT NULL,

      position INTEGER
        NOT NULL
        DEFAULT 1,

      required BOOLEAN
        NOT NULL
        DEFAULT TRUE,

      active BOOLEAN
        NOT NULL
        DEFAULT TRUE,

      created_by INTEGER
        REFERENCES users(id)
        ON DELETE SET NULL,

      created_at TIMESTAMP
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

      updated_at TIMESTAMP
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP
    )
`

await sql`
  CREATE INDEX IF NOT EXISTS
    idx_post_event_questions_event

  ON post_event_questions (
    event_id,
    active,
    position
  )
`


// =========================================================
// 2. RESPOSTAS DAS EQUIPES
// =========================================================
//
// Cada equipe responde cada pergunta uma única vez.
//
// Não apagamos respostas antigas quando uma pergunta
// é desativada. Isso preserva auditoria e histórico.
// =========================================================

await sql`
  CREATE TABLE IF NOT EXISTS
    post_event_answers (
      id SERIAL PRIMARY KEY,

      event_id INTEGER
        NOT NULL
        REFERENCES events(id)
        ON DELETE CASCADE,

      team_id INTEGER
        NOT NULL
        REFERENCES teams(id)
        ON DELETE CASCADE,

      question_id INTEGER
        NOT NULL
        REFERENCES post_event_questions(id)
        ON DELETE CASCADE,

      answer_text TEXT
        NOT NULL
        DEFAULT '',

      answered_by INTEGER
        REFERENCES users(id)
        ON DELETE SET NULL,

      created_at TIMESTAMP
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

      updated_at TIMESTAMP
        NOT NULL
        DEFAULT CURRENT_TIMESTAMP,

      UNIQUE (
        question_id,
        team_id
      )
    )
`

await sql`
  CREATE INDEX IF NOT EXISTS
    idx_post_event_answers_event_team

  ON post_event_answers (
    event_id,
    team_id
  )
`

await sql`
  CREATE INDEX IF NOT EXISTS
    idx_post_event_answers_question

  ON post_event_answers (
    question_id
  )
`


// =========================================================
// 3. VALIDAÇÃO DA ESTRUTURA
// =========================================================

console.log(
  '✅ Estrutura de perguntas e respostas criada!'
)

console.log('')
console.log(
  '===== post_event_questions ====='
)

const questionColumns = await sql`
  SELECT
    column_name,
    data_type,
    is_nullable,
    column_default

  FROM information_schema.columns

  WHERE
    table_name =
      'post_event_questions'

  ORDER BY
    ordinal_position
`

console.table(
  questionColumns
)

console.log('')
console.log(
  '===== post_event_answers ====='
)

const answerColumns = await sql`
  SELECT
    column_name,
    data_type,
    is_nullable,
    column_default

  FROM information_schema.columns

  WHERE
    table_name =
      'post_event_answers'

  ORDER BY
    ordinal_position
`

console.table(
  answerColumns
)

console.log('')
console.log(
  '✅ Pós-Evento V5 configurado.'
)
console.log('')
console.log(
  'Os campos antigos do relatório foram preservados.'
)
